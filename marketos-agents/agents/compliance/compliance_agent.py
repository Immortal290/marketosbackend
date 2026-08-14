"""
MarketOS — Compliance Agent
The legal firewall. Every campaign send is gated through this agent.
No email or SMS goes out without a compliance approval (approved: true).

Production responsibilities (full system):
- Checks suppression list against PostgreSQL contacts.suppressed table
- Verifies DKIM/SPF/DMARC sender authentication records
- Validates consent records per GDPR Article 6 / CCPA
- Writes immutable audit record to PostgreSQL audit_log table
- Blocks and logs any non-compliant campaign with reason code

Demo mode: LLM-based rule checking on copy + campaign metadata.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CampaignPlan, CopyOutput, ComplianceCheck, ComplianceResult
from utils.logger import agent_log, step_banner, kv, section, divider, check_line
from utils.json_utils import extract_json, safe_float
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory
from core.agent_base import AgentBase

COMPLIANCEAGENT_SKILLS = [
    "copy-editing","product-marketing-context"
]

class ComplianceAgent(AgentBase):
    def __init__(self):
        super().__init__("Compliance Agent", COMPLIANCEAGENT_SKILLS)



def _ensure_footer_compliance(
    html: str,
    text: str,
    company_name: str,
    unsubscribe_url: str,
    company_address: str,
) -> tuple[str, str]:
    """
    Inject mandatory CAN-SPAM footer elements if missing.
    This is deterministic and does not depend on LLM behavior.
    """
    html_out = html or ""
    text_out = text or ""

    has_unsub = bool(re.search(r"unsubscribe", html_out, flags=re.IGNORECASE))
    has_addr = company_address.lower() in html_out.lower() if company_address else False

    if not has_unsub or not has_addr:
        footer_html = (
            "<tr><td style=\"background:#f8f8f8;padding:20px 32px;border-top:1px solid #e8e8e8;\">"
            "<p style=\"margin:0;font-size:12px;color:#999;font-family:Arial,sans-serif;\">"
            f"{company_name} · {company_address}<br>"
            f"<a href=\"{unsubscribe_url}\" style=\"color:#999;\">Unsubscribe</a>"
            "</p></td></tr>"
        )

        # Insert before final closing table when present; otherwise append safely.
        lower_html = html_out.lower()
        close_idx = lower_html.rfind("</table>")
        if close_idx != -1:
            html_out = html_out[:close_idx] + footer_html + html_out[close_idx:]
        else:
            html_out = html_out + footer_html

    if "unsubscribe" not in text_out.lower():
        text_out = (
            text_out.rstrip()
            + f"\n\n{company_name} | {company_address}\nUnsubscribe: {unsubscribe_url}\n"
        )
    elif company_address.lower() not in text_out.lower():
        text_out = text_out.rstrip() + f"\n\nAddress: {company_address}\n"

    return html_out, text_out


def _has_unsubscribe(html: str, text: str) -> bool:
    return bool(
        re.search(r"unsubscribe", html or "", flags=re.IGNORECASE)
        or re.search(r"unsubscribe", text or "", flags=re.IGNORECASE)
    )


def _has_physical_address(html: str, text: str, expected_address: str) -> bool:
    if expected_address and expected_address.lower() in (html or "").lower():
        return True
    if expected_address and expected_address.lower() in (text or "").lower():
        return True
    return False


def _upsert_critical_check(
    checks: list[ComplianceCheck],
    rule_id: str,
    rule_name: str,
    category: str,
    passed: bool,
    detail_pass: str,
    detail_fail: str,
    remediation: str,
) -> list[ComplianceCheck]:
    check = ComplianceCheck(
        rule_id=rule_id,
        rule_name=rule_name,
        category=category,
        passed=passed,
        severity="CRITICAL",
        detail=detail_pass if passed else detail_fail,
        remediation=None if passed else remediation,
    )

    for i, existing in enumerate(checks):
        if existing.rule_id == rule_id:
            checks[i] = check
            return checks

    checks.append(check)
    return checks

# ── System Prompt ────────────────────────────────────────────────────────────

COMPLIANCEAGENT_EXPERTISE = """You are the Compliance Agent for MarketOS — the legal firewall for all outbound marketing communications.

AUTHORITY:
You have the power to BLOCK any campaign. Your decision is final and cannot be overridden by any other agent. A blocked campaign does NOT proceed to the Email Agent.

REGULATIONS YOU ENFORCE:
1. CAN-SPAM Act (USA): Honest subject lines, physical address, working unsubscribe mechanism, no deceptive headers
2. GDPR (EU/UK): Consent verification, data processing transparency, right-to-erasure compatibility
3. TCPA (USA - SMS only): Prior express written consent for promotional messages
4. Email Deliverability: Spam trigger word detection, excessive caps/punctuation, misleading claims
5. Brand Safety: No false/unverifiable claims, FTC disclosure requirements, no guarantee language without basis

EVALUATION APPROACH:
Examine the email copy carefully for each rule below. Read the FULL body text carefully. Check subject line, preview text, body paragraphs, CTA, and footer as SEPARATE sections.

COMPLIANCE CHECKS TO RUN (return ALL 10):
1. CANSPAM_001: Honest subject line (not misleading or deceptive)
2. CANSPAM_002: Unsubscribe mechanism present in email body
3. CANSPAM_003: Physical mailing address present in footer
4. CANSPAM_004: Clear identification as promotional/advertisement
5. GDPR_001: No explicit collection of personal data without consent stated
6. GDPR_002: Data processing purpose is clear and proportionate
7. DELIVER_001: No high-risk spam trigger words (FREE!!, GUARANTEED, $$, WINNER, URGENT!!!)
8. DELIVER_002: Subject line length <= 50 characters (optimal deliverability)
9. BRAND_001: No unverifiable absolute claims ("the BEST", "100% guaranteed results")
10. BRAND_002: Discount/offer claims are specific and not misleading

MANDATORY DETAIL QUALITY REQUIREMENTS:
Each check "detail" field MUST be minimum 2-3 full sentences. You MUST:
- QUOTE the exact text from the email (using quotation marks) that caused the pass or fail
- State WHY it passes or fails with the specific legal/deliverability standard
- For failures: provide a concrete word-for-word rewrite in "remediation" field
- For passes: cite what specific element in the copy satisfies the rule

GOOD detail example: "Subject line 'NovaSkin Glow Serum - 20% Launch Offer' (43 chars) accurately reflects the email's core offer without exaggeration. The 20% discount is explicitly substantiated in the body with the retail price of Rs.999. This satisfies CAN-SPAM Section 5(a)(2) which prohibits deceptive subject headings in commercial email."

BAD detail (never acceptable): "Subject line is accurate." or "Check passed." — these are 1-line non-answers.

SCORING:
- CRITICAL failed checks: deduct 15 from score per failure, set approved=false
- WARNING failed checks: deduct 5 from score but do not block
- INFO failed checks: deduct 2 from score

REQUIRED JSON SCHEMA:
{
  "approved": true,
  "compliance_score": 94.0,
  "checks": [
    {
      "rule_id": "CANSPAM_001",
      "rule_name": "Honest subject line",
      "category": "CAN_SPAM",
      "passed": true,
      "severity": "CRITICAL",
      "detail": "Write 2-3 detailed sentences here with QUOTED evidence from the actual email copy, citing the specific regulation clause that is satisfied or violated.",
      "remediation": null
    }
  ],
  "reason_code": null,
  "blocked_reason": null,
  "suggestions": [
    "Campaign-specific suggestion 1 with measurable expected impact",
    "Campaign-specific suggestion 2 with concrete action",
    "Campaign-specific suggestion 3 addressing deliverability optimization"
  ]
}

If blocking: set approved=false, reason_code to the failing rule_id, blocked_reason to a 2-3 sentence explanation quoting the specific failing text."""


# ── Agent Node ───────────────────────────────────────────────────────────────

def compliance_agent_node(state: dict) -> dict:
    step_banner("COMPLIANCE AGENT  ─  Legal & Deliverability Pre-Send Gate")

    plan_data   = state.get("campaign_plan", {})
    copy_data   = state.get("copy_output")

    if not copy_data:
        plan = CampaignPlan(**plan_data)
        if "email" not in plan.channels:
            agent_log("COMPLIANCE", "No email channels detected, fast-tracking compliance.")
            dummy_result = ComplianceResult(approved=True, compliance_score=100.0, checks=[])
            return {**state, "compliance_result": dummy_result.model_dump(), "current_step": "finance_agent"}
        
        err = "Compliance Agent skipped: missing copy_output"
        dummy_checks = [
            {"rule_id": "SYS_001", "rule_name": "Copy Generation", "category": "SYSTEM", "passed": False, "severity": "CRITICAL", "detail": "Missing copy_output to review.", "remediation": "Ensure Copy Agent ran successfully."},
            {"rule_id": "CANSPAM_001", "rule_name": "Honest subject line", "category": "CAN_SPAM", "passed": False, "severity": "CRITICAL", "detail": "No copy to evaluate.", "remediation": "Wait for copy generation."},
            {"rule_id": "GDPR_001", "rule_name": "Consent verification", "category": "GDPR", "passed": False, "severity": "CRITICAL", "detail": "Cannot evaluate GDPR without copy.", "remediation": "N/A"},
        ]
        import json
        dummy_result = ComplianceResult(
            approved=False, 
            compliance_score=0.0, 
            checks=dummy_checks,
            blocked_reason=err,
            reason_code="SYS_001"
        )
        return {**state, "compliance_result": dummy_result.model_dump(), "errors": state.get("errors", []) + [err], "current_step": "failed"}

    plan        = CampaignPlan(**plan_data)
    copy_output = CopyOutput(**copy_data)
    company_name = state.get("company_name", "Deep Duo Foundation")
    unsubscribe_url = state.get("unsubscribe_url", "https://example.com/unsubscribe")
    company_address = state.get("company_address", "123 Main St, City, State 00000")

    # Get the selected variant
    selected_id = copy_output.selected_variant_id
    selected = next(
        (v for v in copy_output.variants if v.variant_id == selected_id),
        copy_output.variants[0] if copy_output.variants else None
    )

    if not selected:
        err = "Compliance Agent skipped: no variants in copy_output"
        dummy_checks = [
            {"rule_id": "SYS_002", "rule_name": "Variant Generation", "category": "SYSTEM", "passed": False, "severity": "CRITICAL", "detail": "Missing copy variants to review.", "remediation": "Check Copy Agent logs."},
        ]
        dummy_result = ComplianceResult(
            approved=False, compliance_score=0.0, checks=dummy_checks, blocked_reason=err, reason_code="SYS_002"
        )
        return {**state, "compliance_result": dummy_result.model_dump(), "errors": state.get("errors", []) + [err], "current_step": "failed"}

    # Deterministic guardrail: auto-inject mandatory footer compliance fields.
    patched_html, patched_text = _ensure_footer_compliance(
        selected.body_html,
        selected.body_text,
        company_name,
        unsubscribe_url,
        company_address,
    )
    selected.body_html = patched_html
    selected.body_text = patched_text

    agent_log("COMPLIANCE", f"Reviewing variant: {selected.variant_id}")
    agent_log("COMPLIANCE", f"Subject: \"{selected.subject_line}\"")
    agent_log("COMPLIANCE", "Running 10-point compliance checklist...")

    llm = get_llm(temperature=0)   # Zero temp — deterministic legal checks

    brand_profile = state.get("brand_profile", {})
    compliance_region = brand_profile.get("complianceRegion", "none") if brand_profile else "none"

    review_payload = f"""
CAMPAIGN METADATA:
- Campaign Name: {plan.campaign_name}
- Compliance Region: {compliance_region}
- Goal: {plan.goal}
- Target Audience: {plan.target_audience}
- Channels: {', '.join(plan.channels)}
- Timeline: {plan.timeline}

COPY VARIANT UNDER REVIEW ({selected.variant_id}):
Subject Line: {selected.subject_line}
Preview Text: {selected.preview_text}
CTA Text: {selected.cta_text}
CTA URL: {selected.cta_url}

---EMAIL BODY (plain text)---
{selected.body_text}

---EMAIL BODY (HTML — check for footer elements)---
{selected.body_html[:2000]}{'...[truncated]' if len(selected.body_html) > 2000 else ''}

SPAM RISK SCORE (from Copy Agent): {selected.spam_risk_score}/100

Please run all 10 compliance checks and return the JSON result."""

    agent = ComplianceAgent()


    messages = [
        SystemMessage(content=agent.build_prompt(COMPLIANCEAGENT_EXPERTISE)),
        HumanMessage(content=review_payload),
    ]

    agent_log("COMPLIANCE", "Calling LLM for compliance review...")
    try:
        response = llm.invoke(messages)
        raw = response.content.strip()
    except Exception as e:
        agent_log("COMPLIANCE", f"LLM invocation failed: {e}. Using deterministic fallback.")
        raw = """{
          "approved": false,
          "compliance_score": 45.0,
          "checks": [
            {"rule_id": "CANSPAM_001", "rule_name": "Honest subject line", "category": "CAN_SPAM", "passed": true, "severity": "CRITICAL", "detail": "Subject line aligns with content."},
            {"rule_id": "CANSPAM_002", "rule_name": "Unsubscribe mechanism", "category": "CAN_SPAM", "passed": false, "severity": "CRITICAL", "detail": "Missing clear unsubscribe link.", "remediation": "Add an unsubscribe link in the footer."},
            {"rule_id": "CANSPAM_003", "rule_name": "Physical address", "category": "CAN_SPAM", "passed": false, "severity": "CRITICAL", "detail": "Missing company physical address.", "remediation": "Add your physical address to the footer."},
            {"rule_id": "CANSPAM_004", "rule_name": "Promotional identification", "category": "CAN_SPAM", "passed": false, "severity": "CRITICAL", "detail": "Not clearly identified as an ad.", "remediation": "State clearly that this is a promotional email."},
            {"rule_id": "GDPR_001", "rule_name": "Consent verification", "category": "GDPR", "passed": true, "severity": "CRITICAL", "detail": "No explicit data collection in copy."},
            {"rule_id": "GDPR_002", "rule_name": "Data processing purpose", "category": "GDPR", "passed": true, "severity": "CRITICAL", "detail": "Purpose of email is clear."},
            {"rule_id": "DELIVER_001", "rule_name": "Spam trigger words", "category": "DELIVERABILITY", "passed": false, "severity": "WARNING", "detail": "Contains high-risk trigger words like 'FREE!!'.", "remediation": "Remove excessive exclamation marks and spam words."},
            {"rule_id": "DELIVER_002", "rule_name": "Subject line length", "category": "DELIVERABILITY", "passed": true, "severity": "INFO", "detail": "Subject line is an optimal length."},
            {"rule_id": "BRAND_001", "rule_name": "Verifiable claims", "category": "BRAND_SAFETY", "passed": false, "severity": "WARNING", "detail": "Uses unverifiable absolute claims like '100% guaranteed'.", "remediation": "Soften claims to be factual and verifiable."},
            {"rule_id": "BRAND_002", "rule_name": "Discount clarity", "category": "BRAND_SAFETY", "passed": true, "severity": "INFO", "detail": "Offers are clearly stated."}
          ],
          "reason_code": "CANSPAM_002",
          "blocked_reason": "Missing mandatory unsubscribe mechanism.",
          "suggestions": ["Add a clear unsubscribe link.", "Remove spam trigger words like 'FREE!!'.", "Ensure physical address is present."]
        }"""

    try:
        data = extract_json(raw)
    except ValueError as e:
        error_msg = f"Compliance Agent JSON parse failed: {e}"
        agent_log("COMPLIANCE", f"ERROR — {error_msg} — USING FALLBACK")
        data = {
            "approved": False,
            "compliance_score": 45.0,
            "checks": [
                {"rule_id": "CANSPAM_001", "rule_name": "Honest subject line", "category": "CAN_SPAM", "passed": True, "severity": "CRITICAL", "detail": "Subject line aligns with content."},
                {"rule_id": "CANSPAM_002", "rule_name": "Unsubscribe mechanism", "category": "CAN_SPAM", "passed": False, "severity": "CRITICAL", "detail": "Missing clear unsubscribe link.", "remediation": "Add an unsubscribe link in the footer."},
                {"rule_id": "CANSPAM_003", "rule_name": "Physical address", "category": "CAN_SPAM", "passed": False, "severity": "CRITICAL", "detail": "Missing company physical address.", "remediation": "Add your physical address to the footer."},
                {"rule_id": "CANSPAM_004", "rule_name": "Promotional identification", "category": "CAN_SPAM", "passed": False, "severity": "CRITICAL", "detail": "Not clearly identified as an ad.", "remediation": "State clearly that this is a promotional email."},
                {"rule_id": "GDPR_001", "rule_name": "Consent verification", "category": "GDPR", "passed": True, "severity": "CRITICAL", "detail": "No explicit data collection in copy."},
                {"rule_id": "GDPR_002", "rule_name": "Data processing purpose", "category": "GDPR", "passed": True, "severity": "CRITICAL", "detail": "Purpose of email is clear."},
                {"rule_id": "DELIVER_001", "rule_name": "Spam trigger words", "category": "DELIVERABILITY", "passed": False, "severity": "WARNING", "detail": "Contains high-risk trigger words like 'FREE!!'.", "remediation": "Remove excessive exclamation marks and spam words."},
                {"rule_id": "DELIVER_002", "rule_name": "Subject line length", "category": "DELIVERABILITY", "passed": True, "severity": "INFO", "detail": "Subject line is an optimal length."},
                {"rule_id": "BRAND_001", "rule_name": "Verifiable claims", "category": "BRAND_SAFETY", "passed": False, "severity": "WARNING", "detail": "Uses unverifiable absolute claims like '100% guaranteed'.", "remediation": "Soften claims to be factual and verifiable."},
                {"rule_id": "BRAND_002", "rule_name": "Discount clarity", "category": "BRAND_SAFETY", "passed": True, "severity": "INFO", "detail": "Offers are clearly stated."}
            ],
            "reason_code": "CANSPAM_002",
            "blocked_reason": "Missing mandatory unsubscribe mechanism.",
            "suggestions": ["Add a clear unsubscribe link.", "Remove spam trigger words like 'FREE!!'.", "Ensure physical address is present."]
        }

    # Build typed result
    checks = []
    for c in data.get("checks", []):
        try:
            checks.append(ComplianceCheck(
                rule_id=c.get("rule_id", "UNKNOWN"),
                rule_name=c.get("rule_name", "Unknown Rule"),
                category=c.get("category", "UNKNOWN"),
                passed=bool(c.get("passed", True)),
                severity=c.get("severity", "INFO"),
                detail=c.get("detail", ""),
                remediation=c.get("remediation"),
            ))
        except Exception as e:
            agent_log("COMPLIANCE", f"Warning: skipping malformed check — {e}")

    result = ComplianceResult(
        approved=data.get("approved", True),
        compliance_score=data.get("compliance_score", 100),
        checks=checks,
        reason_code=data.get("reason_code"),
        blocked_reason=data.get("blocked_reason", ""),
        suggestions=data.get("suggestions", []),
    )

    # Deterministic enforcement for CAN-SPAM critical checks (LLM-independent).
    has_unsub = _has_unsubscribe(selected.body_html, selected.body_text)
    has_addr = _has_physical_address(selected.body_html, selected.body_text, company_address)

    result.checks = _upsert_critical_check(
        result.checks,
        "CANSPAM_002",
        "Unsubscribe mechanism present in email body",
        "CAN_SPAM",
        has_unsub,
        "Unsubscribe mechanism is present in the email content.",
        "Unsubscribe mechanism is missing from the email content.",
        "Add a clear unsubscribe link in the email body or footer.",
    )
    result.checks = _upsert_critical_check(
        result.checks,
        "CANSPAM_003",
        "Physical mailing address present in footer",
        "CAN_SPAM",
        has_addr,
        "Physical mailing address is present in the email footer.",
        "Physical mailing address is missing from the email footer.",
        "Add a valid physical mailing address in the footer.",
    )

    failed_critical = [c for c in result.checks if c.severity == "CRITICAL" and not c.passed]
    result.approved = len(failed_critical) == 0
    if failed_critical:
        result.reason_code = failed_critical[0].rule_id
        result.blocked_reason = failed_critical[0].detail
    else:
        result.reason_code = None
        result.blocked_reason = None

    # Keep score conservative but deterministic for critical compliance failures.
    result.compliance_score = max(
        0.0,
        min(100.0, safe_float(data.get("compliance_score"), 0.0) - (10.0 * len(failed_critical))),
    )

    # ── Final Outcome ────────────────────────────────────────────────────────
    # Compliance decision is now determined by the 10-point check above.

    # ── Terminal Output ──────────────────────────────────────────────────────
    divider()
    section("COMPLIANCE CHECKLIST")
    print()

    category_order = ["CAN_SPAM", "GDPR", "DELIVERABILITY", "BRAND_SAFETY", "DELIVER"]
    for check in result.checks:
        sev_label = f"[{check.severity}]" if not check.passed else ""
        check_line(
            f"{check.rule_id:<15} {check.rule_name}",
            check.passed,
            f"{sev_label} {check.detail[:80]}" if check.detail else sev_label,
        )

    print()
    kv("Compliance Score", f"{result.compliance_score:.1f} / 100")

    if result.approved:
        agent_log("COMPLIANCE", f"✅ APPROVED — Campaign cleared for send")
    else:
        agent_log("COMPLIANCE", f"🚫 BLOCKED — {result.blocked_reason}")
        kv("Block Reason",   result.blocked_reason or "See checks above")
        kv("Reason Code",    result.reason_code or "N/A")

    if result.suggestions:
        section("IMPROVEMENT SUGGESTIONS")
        for s in result.suggestions:
            print(f"  →  {s}")

    divider()

    retry_count = state.get("compliance_retry_count", 0)
    rewrite_suggestion = None
    
    if result.approved:
        next_step = "email_agent"
    else:
        if retry_count < 2:
            next_step = "copy_agent"
            retry_count += 1
            if result.suggestions:
                rewrite_suggestion = result.suggestions[0]
            agent_log("COMPLIANCE", f"Triggering advisory retry {retry_count}/2 to copy_agent")
        else:
            next_step = "blocked"
            agent_log("COMPLIANCE", "Max retries reached. Campaign blocked.")

    # ── Publish compliance result to Kafka ────────────────────────────────
    publish_event(
        topic=Topics.COMPLIANCE_RESULTS,
        source_agent="compliance_agent",
        payload={
            "event":       "compliance_check_completed",
            "campaign_id": plan.campaign_id,
            "approved":    result.approved,
            "score":       result.compliance_score,
            "checks_run":  len(result.checks),
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    )

    # ── Store to episodic memory ──────────────────────────────────────────
    episodic_memory.store(
        agent_name="compliance_agent",
        event_type="compliance_approved" if result.approved else "compliance_blocked",
        summary=(
            f"Compliance {'APPROVED' if result.approved else 'BLOCKED'} for "
            f"campaign '{plan.campaign_name}'. Score: {result.compliance_score}/100. "
            f"Checks: {len(result.checks)}."
        ),
        metadata={
            "campaign_id": plan.campaign_id,
            "approved": result.approved,
            "score": result.compliance_score,
        },
    )

    return {
        **state,
        "copy_output": copy_output.model_dump(),
        "compliance_result": result.model_dump(),
        "compliance_retry_count": retry_count,
        "compliance_rewrite_suggestion": rewrite_suggestion,
        "current_step": next_step,
        "trace": state.get("trace", []) + [{
            "agent":            "compliance_agent",
            "status":           "approved" if result.approved else "blocked",
            "compliance_score": result.compliance_score,
            "checks_run":       len(result.checks),
            "timestamp":        datetime.now(timezone.utc).isoformat(),
        }],
    }


# ── Conditional Router ───────────────────────────────────────────────────────

def compliance_router(state: dict) -> str:
    """
    LangGraph conditional edge function.
    Returns the name of the next node based on compliance decision.
    """
    compliance = state.get("compliance_result", {})
    if compliance.get("approved", False):
        return "email_agent"
    else:
        retry_count = state.get("compliance_retry_count", 0)
        if retry_count > 0 and retry_count <= 2:
            return "copy_agent"
        agent_log("COMPLIANCE", "Pipeline halted — campaign did not pass compliance gate.")
        return "end"
