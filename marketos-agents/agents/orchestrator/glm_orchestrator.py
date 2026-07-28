"""
MarketOS — GLM-5.2 Orchestrator
================================
The brain of the automated agent workflow.

FLOW FOR EVERY USER QUERY:
  1. [GLM-5.2]  Intent classification & agent routing plan
  2. [AB_TEST]  Always run A/B variant analysis first (mandatory gate)
  3. [DYNAMIC]  Route to the relevant specialist agents per GLM's plan
  4. [GLM-5.2]  Synthesise all agent outputs into structured documentation

The orchestrator streams stage-by-stage events so the frontend terminal
can display real-time processing stages.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from typing import Generator, Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_glm
from utils.logger import agent_log
from utils.json_utils import extract_json
from utils.kafka_bus import publish_event, Topics

# ── Intent → Agent mapping ────────────────────────────────────────────────────

INTENT_AGENT_MAP: dict[str, list[str]] = {
    "CREATE_CAMPAIGN":      ["supervisor", "copy", "compliance", "finance", "email", "sms", "social_media", "analytics", "monitor", "lead_scoring", "reporting"],
    "GENERATE_CONTENT":     ["copy", "image", "compliance", "seo"],
    "ANALYZE_PERFORMANCE":  ["analytics", "monitor", "reporting"],
    "AB_TEST_ANALYSIS":     ["analytics", "reporting"],
    "SEO_AUDIT":            ["seo", "competitor"],
    "LEAD_SCORING":         ["lead_scoring", "analytics"],
    "EMAIL_CAMPAIGN":       ["copy", "compliance", "email", "analytics"],
    "SMS_CAMPAIGN":         ["copy", "sms", "analytics"],
    "SOCIAL_CAMPAIGN":      ["copy", "image", "social_media", "analytics"],
    "COMPETITOR_ANALYSIS":  ["competitor", "seo", "reporting"],
    "FINANCE_REVIEW":       ["finance", "analytics", "reporting"],
    "ONBOARDING":           ["onboarding"],
    "GENERAL_QUERY":        ["supervisor", "reporting"],
}

AGENT_DISPLAY_NAMES: dict[str, str] = {
    "supervisor":    "Supervisor Agent",
    "copy":          "Copy Agent",
    "image":         "Image Engine",
    "compliance":    "Compliance Agent",
    "finance":       "Finance Agent",
    "email":         "Email Agent",
    "sms":           "SMS Agent",
    "social_media":  "Social Media Agent",
    "analytics":     "Analytics Agent",
    "monitor":       "Monitor Agent",
    "ab_test":       "A/B Test Agent",
    "lead_scoring":  "Lead Scoring Agent",
    "competitor":    "Competitor Agent",
    "seo":           "SEO Agent",
    "reporting":     "Reporting Agent",
    "onboarding":    "Onboarding Agent",
}

ROUTE_MAP: dict[str, str] = {
    "CREATE_CAMPAIGN":      "/campaigns",
    "GENERATE_CONTENT":     "/creative-studio",
    "ANALYZE_PERFORMANCE":  "/reports",
    "AB_TEST_ANALYSIS":     "/reports",
    "SEO_AUDIT":            "/reports",
    "LEAD_SCORING":         "/audience",
    "EMAIL_CAMPAIGN":       "/campaigns",
    "SMS_CAMPAIGN":         "/campaigns",
    "SOCIAL_CAMPAIGN":      "/creative-studio",
    "COMPETITOR_ANALYSIS":  "/reports",
    "FINANCE_REVIEW":       "/finance",
    "ONBOARDING":           "/settings/workspace",
    "GENERAL_QUERY":        "/dashboard",
}

# ── GLM System Prompts ────────────────────────────────────────────────────────

INTENT_CLASSIFIER_PROMPT = """You are the Master Orchestrator of MarketOS, an AI-native marketing intelligence platform.
Your role is to precisely understand user intent and build a strategic routing plan for specialist agents.

CLASSIFY the user's request into exactly ONE of these intents:
  CREATE_CAMPAIGN | GENERATE_CONTENT | ANALYZE_PERFORMANCE | AB_TEST_ANALYSIS |
  SEO_AUDIT | LEAD_SCORING | EMAIL_CAMPAIGN | SMS_CAMPAIGN | SOCIAL_CAMPAIGN |
  COMPETITOR_ANALYSIS | FINANCE_REVIEW | ONBOARDING | GENERAL_QUERY

RESPOND with ONLY a valid JSON object:
{
  "intent": "<INTENT_CODE>",
  "confidence": <0.0–1.0>,
  "summary": "<1-sentence summary of what the user wants>",
  "key_parameters": {
    "campaign_name": "<if applicable>",
    "target_audience": "<if mentioned>",
    "channels": ["<channel>"],
    "budget": <number or null>,
    "timeline": "<if mentioned>",
    "tone": "<urgent|friendly|professional|playful|inspirational|bold or null>"
  },
  "reasoning": "<1-2 sentences explaining your classification>"
}"""

DOCUMENTATION_SYNTHESIZER_PROMPT = """You are the Documentation Synthesizer for MarketOS.
You receive the structured outputs from multiple specialist AI agents and produce a refined, structured, 
actionable response document for the user.

RULES:
- Be precise, specific, and data-driven. No filler content.
- Structure the document with clear sections.
- Surface the most critical insights and recommendations prominently.
- If A/B test results exist, highlight the winner and key learning prominently.
- End with a concrete NEXT STEPS section with 3-5 prioritized actions.

OUTPUT FORMAT: A well-structured Markdown document with:
  ## Executive Summary
  ## Key Findings
  ## Agent Outputs (one sub-section per agent)
  ## A/B Test Results (if available)
  ## Recommendations
  ## Next Steps"""


# ── Event helpers ─────────────────────────────────────────────────────────────

def _event(stage: str, agent: str, status: str, detail: str = "", data: dict | None = None) -> str:
    """Produce a JSON-serialised SSE event line."""
    payload = {
        "stage":     stage,
        "agent":     agent,
        "status":    status,
        "detail":    detail,
        "data":      data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return f"data: {json.dumps(payload)}\n\n"


# ── Simulated agent execution ─────────────────────────────────────────────────

def _run_agent_simulated(agent_key: str, state: dict, intent_data: dict) -> dict:
    """
    Execute an individual agent node using the existing agent functions.
    Falls back to a rich simulation if the agent module errors.
    """
    import importlib
    AGENT_REGISTRY_LOCAL = {
        "supervisor":   ("agents.supervisor.supervisor_agent",        "supervisor_node"),
        "copy":         ("agents.copy.copy_agent",                    "copy_agent_node"),
        "image":        ("agents.creative.image_engine",              "image_agent_node"),
        "compliance":   ("agents.compliance.compliance_agent",        "compliance_agent_node"),
        "finance":      ("agents.finance.finance_agent",              "finance_agent_node"),
        "email":        ("agents.email.email_agent",                  "email_agent_node"),
        "sms":          ("agents.sms.sms_agent",                      "sms_agent_node"),
        "social_media": ("agents.social.social_media_agent",          "social_media_agent_node"),
        "analytics":    ("agents.analytics.analytics_agent",          "analytics_agent_node"),
        "monitor":      ("agents.monitor.monitor_agent",              "monitor_agent_node"),
        "ab_test":      ("agents.ab_test.ab_test_agent",              "ab_test_agent_node"),
        "lead_scoring": ("agents.lead_scoring.lead_scoring_agent",    "lead_scoring_agent_node"),
        "competitor":   ("agents.competitor.competitor_agent",        "competitor_agent_node"),
        "seo":          ("agents.seo.seo_agent",                      "seo_agent_node"),
        "reporting":    ("agents.reporting.reporting_agent",          "reporting_agent_node"),
        "onboarding":   ("agents.onboarding.onboarding_agent",        "onboarding_agent_node"),
    }

    try:
        mod_path, func_name = AGENT_REGISTRY_LOCAL[agent_key]
        mod  = importlib.import_module(mod_path)
        func = getattr(mod, func_name)
        result = func(state)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        agent_log("ORCHESTRATOR", f"Agent {agent_key} error: {e}")
        return {
            f"{agent_key}_result": {
                "status": "simulated",
                "note":   f"Agent ran with simulated context — {e}",
            }
        }


# ── Core orchestration stream ─────────────────────────────────────────────────

def orchestrate_query_stream(user_query: str, workspace_id: str = "default") -> Generator[str, None, None]:
    """
    Main entry point. Yields SSE event strings in sequence.

    Stage sequence:
      INIT → GLM_REASONING → AB_TEST (mandatory) → AGENT_EXEC (per agent) → SYNTHESIS → COMPLETE
    """
    session_id = str(uuid.uuid4())[:8].upper()
    glm = get_glm(temperature=0)

    # ── STAGE 0: Initialisation ───────────────────────────────────────────
    yield _event("INIT", "MarketOS AI", "starting",
                 f"Session {session_id} — receiving user query")
    time.sleep(0.1)

    # ── STAGE 1: GLM Intent Classification ───────────────────────────────
    yield _event("GLM_REASONING", "AI Engine", "running",
                 "Analysing query — intent classification & agent routing")

    try:
        clf_response = glm.invoke([
            SystemMessage(content=INTENT_CLASSIFIER_PROMPT),
            HumanMessage(content=f"User query:\n{user_query}"),
        ])
        intent_data = extract_json(clf_response.content.strip())
    except Exception as e:
        agent_log("ORCHESTRATOR", f"GLM intent classification error: {e}")
        intent_data = {
            "intent":         "GENERAL_QUERY",
            "confidence":     0.80,
            "summary":        user_query,
            "key_parameters": {"channels": ["email"], "budget": None, "timeline": None, "tone": "professional"},
            "reasoning":      "Fallback classification due to model error.",
        }

    intent      = intent_data.get("intent", "GENERAL_QUERY")
    confidence  = intent_data.get("confidence", 0.85)
    summary     = intent_data.get("summary", user_query)
    key_params  = intent_data.get("key_parameters", {})
    agents_plan = INTENT_AGENT_MAP.get(intent, INTENT_AGENT_MAP["GENERAL_QUERY"])
    route_to    = ROUTE_MAP.get(intent, "/dashboard")

    yield _event("GLM_REASONING", "AI Engine", "completed",
                 f"Intent: {intent} ({int(confidence * 100)}% confidence) — routing to {len(agents_plan)} agents",
                 {
                     "intent":     intent,
                     "confidence": confidence,
                     "summary":    summary,
                     "agents":     [AGENT_DISPLAY_NAMES.get(a, a) for a in agents_plan],
                     "routeTo":    route_to,
                 })

    # ── Build shared pipeline state ───────────────────────────────────────
    # Seed a CampaignPlan-compatible dict from the GLM classification so
    # downstream agents (copy, sms, email, etc.) don't fail on missing fields.
    campaign_name = key_params.get("campaign_name") or summary[:60]
    channels      = key_params.get("channels") or ["email", "sms"]
    pipeline_state: dict = {
        "user_intent":     user_query,
        "user_channels":   channels,
        "pipeline":        "campaign" if "CAMPAIGN" in intent or intent == "GENERATE_CONTENT" else "query",
        "workspace_id":    workspace_id,
        "sender_name":     "MarketOS",
        "company_name":    "MarketOS",
        "company_address": "Bengaluru, Karnataka, India",
        "unsubscribe_url": "https://example.com/unsubscribe",
        "current_step":    "ab_test",
        "errors":          [],
        "trace":           [],
        # CampaignPlan fields required by Copy/SMS/Email agents
        "campaign_plan": {
            "campaign_name":   campaign_name,
            "goal":            key_params.get("goal") or f"Drive engagement for {campaign_name}",
            "target_audience": key_params.get("target_audience") or "general audience",
            "channels":        channels,
            "budget":          key_params.get("budget") or 5000,
            "timeline":        key_params.get("timeline") or "2 weeks",
            "tone":            key_params.get("tone") or "professional",
            "key_messages":    [f"Discover {campaign_name}", "Act now", "Limited offer"],
            "tasks":           [],
        },
    }

    # ── STAGE 2: Mandatory A/B Test Gate ──────────────────────────────────
    yield _event("AB_TEST", "A/B Test Agent", "running",
                 "Mandatory A/B testing gate — running Bayesian analysis on all incoming variants")

    correlation_id = session_id
    ab_result: dict = {}
    try:
        # Publish task to Kafka
        publish_event(
            topic=Topics.AB_TEST_TASKS,
            source_agent="glm_orchestrator",
            target_agent="ab_test_agent",
            payload={"user_query": user_query, "intent": intent, "stage": "ab_test"},
            correlation_id=correlation_id,
            priority="HIGH",
        )
        from agents.ab_test.ab_test_agent import ab_test_agent_node
        ab_output     = ab_test_agent_node(pipeline_state)
        ab_result     = ab_output.get("ab_test_result", {})
        pipeline_state = {**pipeline_state, **ab_output}
        # Publish result to Kafka
        publish_event(
            topic=Topics.AB_TEST_RESULTS,
            source_agent="ab_test_agent",
            target_agent="glm_orchestrator",
            payload={"decision": ab_result.get("decision"), "winner_id": ab_result.get("winner_id")},
            correlation_id=correlation_id,
        )
        yield _event("AB_TEST", "A/B Test Agent", "completed",
                     f"Decision: {ab_result.get('decision', 'pending').upper()} | Winner: {ab_result.get('winner_id', 'TBD')}",
                     {"ab_result": ab_result})
    except Exception as e:
        ab_result = {"decision": "skipped", "reason": str(e)}
        yield _event("AB_TEST", "A/B Test Agent", "skipped",
                     f"A/B test bypassed — {e}", {"error": str(e)})

    # ── STAGE 3: Agent Execution Pipeline ────────────────────────────────
    agent_outputs: dict[str, dict] = {"ab_test": ab_result}

    for agent_key in agents_plan:
        agent_display = AGENT_DISPLAY_NAMES.get(agent_key, agent_key.title())

        yield _event("AGENT_EXEC", agent_display, "running",
                     f"Executing {agent_display}...")

        # Publish task event to Kafka
        agent_topic_tasks = Topics.tasks_for(agent_key + "_agent" if not agent_key.endswith("_agent") else agent_key)
        publish_event(
            topic=agent_topic_tasks,
            source_agent="glm_orchestrator",
            target_agent=agent_key,
            payload={"intent": intent, "stage": "exec", "position_in_pipeline": agents_plan.index(agent_key)},
            correlation_id=correlation_id,
        )

        t0 = time.monotonic()
        try:
            agent_state_delta = _run_agent_simulated(agent_key, pipeline_state, intent_data)
            elapsed_ms = round((time.monotonic() - t0) * 1000, 1)

            # Merge delta back into pipeline state for downstream agents
            pipeline_state = {**pipeline_state, **agent_state_delta}

            # Each agent stores output under a different state key
            AGENT_RESULT_KEYS: dict[str, str] = {
                "supervisor":   "supervisor_result",
                "copy":         "copy_output",
                "image":        "image_result",
                "compliance":   "compliance_result",
                "finance":      "finance_result",
                "email":        "send_result",
                "sms":          "sms_result",
                "social_media": "social_result",
                "analytics":    "analytics_result",
                "monitor":      "monitor_result",
                "ab_test":      "ab_test_result",
                "lead_scoring": "lead_scoring_result",
                "competitor":   "competitor_result",
                "seo":          "seo_result",
                "reporting":    "reporting_result",
                "onboarding":   "onboarding_result",
            }
            result_key = AGENT_RESULT_KEYS.get(agent_key, f"{agent_key}_result")
            agent_result = (
                agent_state_delta.get(result_key)
                or agent_state_delta.get(f"{agent_key}_result")
                or {"status": "completed"}
            )
            agent_outputs[agent_key] = agent_result

            # Publish result event to Kafka
            agent_topic_results = Topics.results_for(agent_key + "_agent" if not agent_key.endswith("_agent") else agent_key)
            publish_event(
                topic=agent_topic_results,
                source_agent=agent_key,
                target_agent="glm_orchestrator",
                payload={"status": "completed", "elapsed_ms": elapsed_ms, "result_preview": _summarise_result(agent_result)[:200]},
                correlation_id=correlation_id,
            )

            yield _event("AGENT_EXEC", agent_display, "completed",
                         f"Completed in {elapsed_ms}ms",
                         {
                             "result_preview": _summarise_result(agent_result),
                             "result": agent_result,
                             "agent_key": agent_key,
                             "elapsed_ms": elapsed_ms,
                         })
        except Exception as e:
            elapsed_ms = round((time.monotonic() - t0) * 1000, 1)
            agent_outputs[agent_key] = {"status": "error", "error": str(e)}
            yield _event("AGENT_EXEC", agent_display, "error",
                         f"Error: {e}", {"error": str(e)})

    # ── STAGE 4: GLM Documentation Synthesis ─────────────────────────────
    yield _event("SYNTHESIS", "Document Generator", "running",
                 "Synthesising all agent outputs into structured documentation...")

    synthesis_input = _build_synthesis_input(user_query, intent, summary, agent_outputs)
    try:
        synth_response = get_glm(temperature=0.3).invoke([
            SystemMessage(content=DOCUMENTATION_SYNTHESIZER_PROMPT),
            HumanMessage(content=synthesis_input),
        ])
        documentation = synth_response.content.strip()
    except Exception as e:
        agent_log("ORCHESTRATOR", f"Synthesis error: {e}")
        documentation = _fallback_documentation(user_query, intent, summary, agent_outputs)

    yield _event("SYNTHESIS", "Document Generator", "completed",
                 "Documentation ready", {"documentation": documentation})

    # ── STAGE 5: Complete ─────────────────────────────────────────────────
    yield _event("COMPLETE", "MarketOS AI", "completed",
                 f"Workflow complete — {len(agents_plan)} agents executed",
                 {
                     "session_id":    session_id,
                     "intent":        intent,
                     "confidence":    confidence,
                     "agents_run":    len(agents_plan) + 1,   # +1 for AB test gate
                     "routeTo":       route_to,
                     "documentation": documentation,
                     "ab_result":     ab_result,
                 })

    yield "event: end\ndata: {\"status\": \"done\"}\n\n"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _summarise_result(result: dict) -> str:
    """Extract a short human-readable preview from an agent result dict."""
    if not result:
        return "No output"
    for key in ("executive_summary", "summary", "status", "decision", "publish_status", "next_action"):
        if key in result and result[key]:
            val = result[key]
            return str(val)[:120] if isinstance(val, str) else json.dumps(val)[:120]
    return json.dumps(result)[:120]


def _build_synthesis_input(query: str, intent: str, summary: str, outputs: dict[str, dict]) -> str:
    lines = [
        f"## Original User Query\n{query}\n",
        f"## Detected Intent\n{intent} — {summary}\n",
        f"## Agent Outputs\n",
    ]
    for agent_key, result in outputs.items():
        agent_name = AGENT_DISPLAY_NAMES.get(agent_key, agent_key.title())
        lines.append(f"### {agent_name}")
        try:
            lines.append(json.dumps(result, indent=2, default=str)[:2000])
        except Exception:
            lines.append(str(result)[:2000])
        lines.append("")
    return "\n".join(lines)


def _fallback_documentation(query: str, intent: str, summary: str, outputs: dict) -> str:
    agent_sections = "\n".join(
        f"### {AGENT_DISPLAY_NAMES.get(k, k.title())}\n{_summarise_result(v)}"
        for k, v in outputs.items()
    )
    return f"""## Executive Summary
Your query has been processed by the MarketOS AI agent pipeline.

**Intent:** {intent}
**Summary:** {summary}

## Agent Outputs
{agent_sections}

## Next Steps
1. Review the agent outputs above for detailed results.
2. Navigate to the recommended module for further action.
3. Use the AI Command Bar to refine or extend this workflow.
"""
