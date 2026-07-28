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
Examine the email copy carefully for each rule below. Be thorough — check the subject line, preview text, body, and CTA separately.

COMPLIANCE CHECKS TO RUN (return ALL 10):
1. CANSPAM_001: Honest subject line (not misleading or deceptive)
2. CANSPAM_002: Unsubscribe mechanism present in email body
3. CANSPAM_003: Physical mailing address present in footer
4. CANSPAM_004: Clear identification as promotional/advertisement
5. GDPR_001: No explicit collection of personal data without consent stated
6. GDPR_002: Data processing purpose is clear and proportionate
7. DELIVER_001: No high-risk spam trigger words (FREE!!, GUARANTEED, $$, WINNER, URGENT!!!)
8. DELIVER_002: Subject line length ≤ 50 characters (optimal deliverability)
9. BRAND_001: No unverifiable absolute claims ("the BEST", "100% guaranteed results")
10. BRAND_002: Discount/offer claims are specific and not misleading

SCORING:
- CRITICAL failed checks → approved: false
- WARNING checks can pass overall but reduce compliance_score
- INFO checks are advisory only

APPROVED criteria: All CRITICAL checks must pass. A WARNING on non-critical rules is acceptable.

OUTPUT RULES:
- Respond ONLY with valid JSON — no prose, no markdown
- Be specific in "detail" — quote the exact problematic text if failing
- remediation must be actionable if the check fails

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
      "detail": "Subject line is accurate and not misleading.",
      "remediation": null
    },
    ... (all 10 checks)
  ],
  "reason_code": null,
  "blocked_reason": null,
  "suggestions": ["optional improvement suggestion 1", "optional improvement suggestion 2"]
}

If blocking: set approved=false, reason_code to the failing rule_id, blocked_reason to a clear explanation."""


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
        return {**state, "errors": state.get("errors", []) + [err], "current_step": "failed"}

    plan        = CampaignPlan(**plan_data)
    copy_output = CopyOutput(**copy_data)
    company_name = state.get("company_name", "Deep Duo Foundation")
    unsubscribe_url = state.get("unsubscribe_url", "https://example.com/unsubscribe")
    company_address = state.get("company_address", "123 Main St, City, State 00000")

    # Get the selected variant
    selected_id = copy_output.selected_variant_id
    selected = next(
        (v for v in copy_output.variants if v.variant_id == selected_id),
        copy_output.variants[0]
    )

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

    review_payload = f"""
CAMPAIGN METADATA:
- Campaign Name: {plan.campaign_name}
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

    response = llm.invoke(messages)
    raw = response.content.strip()

    try:
        data = extract_json(raw)
    except ValueError as e:
        error_msg = f"Compliance Agent JSON parse failed: {e}"
        agent_log("COMPLIANCE", f"ERROR — {error_msg} — USING FALLBACK")
        data = {
            "approved": False,
            "compliance_score": 0.0,
            "checks": [],
            "reason_code": None,
            "blocked_reason": None,
            "suggestions": []
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

    next_step = "email_agent" if result.approved else "blocked"

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
        agent_log("COMPLIANCE", "Pipeline halted — campaign did not pass compliance gate.")
        return "end"
