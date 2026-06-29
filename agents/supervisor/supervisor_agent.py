"""
MarketOS — Supervisor Agent
Receives raw user intent, decomposes it into a structured campaign plan,
and routes tasks to the right agents via the LangGraph state.

Production responsibilities (full system):
- Publishes task graph to Kafka agent.supervisor.tasks topic
- Stores plan in PostgreSQL campaigns table
- Manages campaign lifecycle state machine

Demo mode: runs entirely in-memory via LangGraph state dict.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CampaignPlan, AgentTask
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory, semantic_memory
from core.agent_base import AgentBase

SUPERVISORAGENT_SKILLS = [
    "product-marketing-context","launch-strategy","marketing-ideas","marketing-psychology"
]

class SupervisorAgent(AgentBase):
    def __init__(self):
        super().__init__("Supervisor Agent", SUPERVISORAGENT_SKILLS)


# ── System Prompt ────────────────────────────────────────────────────────────

SUPERVISORAGENT_EXPERTISE = """You are the Supervisor Agent for MarketOS, an autonomous AI-native marketing operations platform.

ROLE:
You receive a raw marketing campaign intent from a user and decompose it into a precise, structured campaign plan. This plan is the single source of truth for all downstream agents.

RESPONSIBILITIES:
1. Parse the user intent and extract every available campaign parameter
2. Infer any missing parameters intelligently from context
3. Define 4–6 specific, concrete key messages (not generic statements)
4. Specify agent tasks in correct execution order with dependencies
5. Set a tone that matches the brand, product, and audience

OUTPUT RULES:
- Respond ONLY with a valid JSON object — no prose, no markdown, no code blocks
- Be specific and concrete — no vague filler text
- key_messages must be actual copy-ready statements, not instructions
- tasks must have clear, specific task descriptions

REQUIRED JSON SCHEMA:
{
  "campaign_name": "short descriptive name for this campaign",
  "goal": "specific measurable goal with a number (e.g. 500 conversions, 20% revenue uplift)",
  "target_audience": "precise audience description with demographics/psychographics",
  "channels": ["email"],
  "budget": <number or null>,
  "timeline": "e.g. 7 days, ending DD Mon YYYY",
  "tone": "one of: urgent | friendly | professional | playful | inspirational | bold",
  "key_messages": [
    "message 1 — actual copy-ready statement",
    "message 2",
    "message 3",
    "message 4"
  ],
  "tasks": [
    {
      "agent": "copy_agent",
      "task": "Write 2 email copy variants for <specific goal>. Tone: <tone>. Highlight: <specific offer>.",
      "priority": "HIGH",
      "depends_on": []
    },
    {
      "agent": "compliance_agent",
      "task": "Run full CAN-SPAM, GDPR, deliverability compliance check on approved copy variant.",
      "priority": "HIGH",
      "depends_on": ["copy_agent"]
    },
    {
      "agent": "email_agent",
      "task": "Execute campaign send to <audience> list. Track opens, clicks, conversions.",
      "priority": "HIGH",
      "depends_on": ["compliance_agent"]
    }
  ]
}"""


# ── Agent Node ───────────────────────────────────────────────────────────────

def supervisor_node(state: dict) -> dict:
    step_banner("SUPERVISOR AGENT  ─  Intent Decomposition & Task Planning")

    user_intent = state.get("user_intent", "")
    user_channels = state.get("user_channels")
    agent_log("SUPERVISOR", f"Received intent → \"{user_intent[:80]}{'...' if len(user_intent) > 80 else ''}\"")
    if user_channels:
        agent_log("SUPERVISOR", f"Explicit user channels set: {user_channels}")

    # ── Recall past campaigns from episodic memory ────────────────────────
    past_campaigns = episodic_memory.recall(
        agent_name="supervisor",
        query=user_intent[:500],
        top_k=3,
    )
    memory_context = ""
    if past_campaigns:
        agent_log("SUPERVISOR", f"Recalled {len(past_campaigns)} past campaign(s) from memory")
        memory_context = "\n\nPAST CAMPAIGN CONTEXT (from episodic memory):\n" + "\n".join(
            f"  - {m.get('summary', '')}" for m in past_campaigns
        )

    # ── Get brand knowledge from semantic memory ──────────────────────────
    brand_items = semantic_memory.search(query=user_intent[:300], top_k=3)
    brand_context = ""
    if brand_items:
        agent_log("SUPERVISOR", f"Loaded {len(brand_items)} brand knowledge items")
        brand_context = "\n\nBRAND KNOWLEDGE (from semantic memory):\n" + "\n".join(
            f"  [{item.get('category', '')}] {item.get('content', '')[:200]}" for item in brand_items
        )

    # ── Publish task_started to Kafka ──────────────────────────────────────
    publish_event(
        topic=Topics.SUPERVISOR_TASKS,
        source_agent="supervisor",
        payload={
            "event": "intent_received",
            "intent": user_intent[:200],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    llm = get_llm(temperature=0)

    agent = SupervisorAgent()


    messages = [
        SystemMessage(content=agent.build_prompt(SUPERVISORAGENT_EXPERTISE)),
        HumanMessage(content=f"Campaign Intent:\n{user_intent}\n" +
                             (f"\nCRITICAL: The user has explicitly selected only these channels: {user_channels}. You MUST ONLY use these channels for this campaign.\n" if user_channels else "") +
                             f"{memory_context}{brand_context}"),
    ]

    agent_log("SUPERVISOR", "Calling LLM to decompose intent...")
    response = llm.invoke(messages)
    raw = response.content.strip()

    # Parse and validate
    try:
        data = extract_json(raw)
    except ValueError as e:
        error_msg = f"Supervisor JSON parse failed: {e}"
        agent_log("SUPERVISOR", f"ERROR — {error_msg}")
        return {**state, "errors": [error_msg], "current_step": "failed"}

    # Build typed plan
    campaign_id = str(uuid.uuid4())[:8].upper()
    tasks = [AgentTask(**t) for t in data.get("tasks", [])]

    plan = CampaignPlan(
        campaign_id=campaign_id,
        campaign_name=data["campaign_name"],
        goal=data["goal"],
        target_audience=data["target_audience"],
        channels=data.get("channels", ["email"]),
        budget=data.get("budget"),
        timeline=data["timeline"],
        tone=data["tone"],
        key_messages=data["key_messages"],
        tasks=tasks,
    )

    # ── Terminal Output ──────────────────────────────────────────────────────
    agent_log("SUPERVISOR", "✓ Campaign plan generated successfully")
    divider()

    section("CAMPAIGN PLAN")
    kv("Campaign ID",    plan.campaign_id)
    kv("Name",          plan.campaign_name)
    kv("Goal",          plan.goal)
    kv("Audience",      plan.target_audience)
    kv("Channels",      ", ".join(plan.channels))
    kv("Budget",        f"₹{plan.budget:,.0f}" if plan.budget else "Not specified")
    kv("Timeline",      plan.timeline)
    kv("Tone",          plan.tone.upper())

    section("KEY MESSAGES")
    for i, msg in enumerate(plan.key_messages, 1):
        print(f"  {i}.  {msg}")

    section("TASK GRAPH")
    for t in plan.tasks:
        deps = f" (after {', '.join(t.depends_on)})" if t.depends_on else " (parallel)"
        print(f"  [{t.priority:>8}]  {t.agent:>20}  →  {t.task[:55]}")

    divider()

    # ── Publish plan to Kafka ──────────────────────────────────────────────
    publish_event(
        topic=Topics.SUPERVISOR_RESULTS,
        source_agent="supervisor",
        payload={
            "event":       "campaign_plan_created",
            "campaign_id": plan.campaign_id,
            "campaign_name": plan.campaign_name,
            "channels":    plan.channels,
            "budget":      plan.budget,
            "agents":      [t.agent for t in plan.tasks],
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        priority="HIGH",
    )

    # Also publish to campaign.events for lifecycle tracking
    publish_event(
        topic=Topics.CAMPAIGN_EVENTS,
        source_agent="supervisor",
        payload={
            "event": "campaign_planned",
            "campaign_id": plan.campaign_id,
            "campaign_name": plan.campaign_name,
        },
    )

    # ── Store to episodic memory ──────────────────────────────────────────
    episodic_memory.store(
        agent_name="supervisor",
        event_type="campaign_planned",
        summary=f"Planned campaign '{plan.campaign_name}' — {plan.goal}. Channels: {', '.join(plan.channels)}. Budget: ₹{plan.budget:,.0f}" if plan.budget else f"Planned campaign '{plan.campaign_name}' — {plan.goal}",
        metadata={"campaign_id": plan.campaign_id, "channels": plan.channels},
    )

    return {
        **state,
        "campaign_plan": plan.model_dump(),
        "current_step":  "copy_agent",
        "errors":        [],
        "trace": state.get("trace", []) + [{
            "agent":       "supervisor",
            "status":      "completed",
            "campaign_id": plan.campaign_id,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        }],
    }
