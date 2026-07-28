"""
MarketOS — Onboarding Agent
PRD: CRM, product DB, drip engine, task tracker. Event-driven on new user signup.

Architecture: Hierarchical agent — spawns sub-sequences as child tasks.
This is the Anthropic multi-agent pattern: orchestrator decomposes goal into
sub-tasks, each handled by a specialist (here: EmailAgent for drip sends).

Sub-skills:
  WorkspaceClassifierSkill  — Classifies workspace as ecommerce/SaaS/agency
  DripSequenceBuilderSkill  — Builds personalised 7-day activation sequence
  MilestoneTrackerSkill     — Monitors: first campaign, first design, analytics connected
  AdaptiveDripSkill         — Adjusts sequence mid-flight based on milestone completion
  TaskListGeneratorSkill    — Creates actionable setup checklist per workspace type

Memory:
  Stores onboarding template in semantic_memory keyed by workspace_type.
  Recalls successful onboarding patterns from episodic_memory.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from utils.agent_base import AgentBase
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory, semantic_memory
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json
from core.skill_loader import load_skills

ONBOARDINGAGENT_SKILLS = [
    "onboarding-cro","churn-prevention","lead-magnets","email-sequence"
]


try:
    import psycopg2, psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Sub-skill: Workspace Classifier ──────────────────────────────────────────

class WorkspaceClassifierSkill:
    """
    Classifies workspace type from signup data.
    Used to personalise onboarding drip and task list.
    """

    SIGNALS = {
        "ecommerce": ["shopify", "woocommerce", "store", "product", "shop", "order", "d2c", "retail"],
        "saas":      ["saas", "software", "app", "platform", "subscription", "trial", "freemium"],
        "agency":    ["agency", "clients", "campaigns", "brand", "marketing agency", "creative"],
        "creator":   ["creator", "newsletter", "audience", "community", "content"],
    }

    @classmethod
    def classify(cls, company_name: str = "", industry: str = "", description: str = "") -> str:
        text = f"{company_name} {industry} {description}".lower()
        scores = {wtype: 0 for wtype in cls.SIGNALS}
        for wtype, keywords in cls.SIGNALS.items():
            for kw in keywords:
                if kw in text:
                    scores[wtype] += 1
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "general"


# ── Sub-skill: Drip Sequence Builder ─────────────────────────────────────────

class DripSequenceBuilderSkill:
    """
    Builds the 7-day onboarding drip sequence.
    Day 1-3: Activation (get them to send first campaign).
    Day 4-5: Feature discovery (A/B testing, analytics).
    Day 6-7: Value demonstration (show them ROI).
    """

    TEMPLATES = {
        "ecommerce": [
            {"day": 1, "subject": "Your first Diwali campaign is 3 clicks away",
             "goal": "Send first campaign", "milestone": "first_campaign_sent"},
            {"day": 2, "subject": "Connect your Shopify store for 1-click automation",
             "goal": "Connect store", "milestone": "store_connected"},
            {"day": 3, "subject": "Your abandoned cart recovery sequence is ready",
             "goal": "Enable automation", "milestone": "automation_enabled"},
            {"day": 5, "subject": "Your campaign got {open_rate}% opens — here's why",
             "goal": "Review analytics", "milestone": "analytics_viewed"},
            {"day": 7, "subject": "You've sent {sends} emails this week. Here's your ROI.",
             "goal": "View ROI dashboard", "milestone": "roi_viewed"},
        ],
        "saas": [
            {"day": 1, "subject": "Your first trial nurture sequence is ready",
             "goal": "Launch trial nurture", "milestone": "first_campaign_sent"},
            {"day": 2, "subject": "Add lead scoring — know who's about to convert",
             "goal": "Enable lead scoring", "milestone": "lead_scoring_enabled"},
            {"day": 3, "subject": "Connect your CRM in 2 minutes",
             "goal": "Connect CRM", "milestone": "crm_connected"},
            {"day": 5, "subject": "3 leads just hit MQL threshold — meet them",
             "goal": "Review leads", "milestone": "leads_reviewed"},
            {"day": 7, "subject": "Your pipeline this week: {pipeline_value} in qualified leads",
             "goal": "View pipeline", "milestone": "pipeline_viewed"},
        ],
        "general": [
            {"day": 1, "subject": "Welcome — your first campaign takes 60 seconds",
             "goal": "Send first campaign", "milestone": "first_campaign_sent"},
            {"day": 3, "subject": "Did you know? A/B testing increases conversions 23%",
             "goal": "Enable A/B testing", "milestone": "ab_test_created"},
            {"day": 5, "subject": "Your analytics are live — here's what to watch",
             "goal": "View analytics", "milestone": "analytics_viewed"},
            {"day": 7, "subject": "Your first week with MarketOS — results inside",
             "goal": "View weekly report", "milestone": "report_viewed"},
        ],
    }

    @classmethod
    def build(cls, workspace_type: str, user_name: str = "there") -> list[dict]:
        template = cls.TEMPLATES.get(workspace_type, cls.TEMPLATES["general"])
        sequence = []
        for step in template:
            send_at = datetime.now(timezone.utc) + timedelta(days=step["day"] - 1)
            sequence.append({
                **step,
                "send_at":    send_at.isoformat(),
                "status":     "scheduled",
                "personalization": {"user_name": user_name},
            })
        return sequence


# ── Sub-skill: Milestone Tracker ─────────────────────────────────────────────

class MilestoneTrackerSkill:
    """
    Tracks activation milestones per workspace.
    Milestones trigger drip sequence adjustments.
    """

    MILESTONES = [
        "first_campaign_sent",
        "first_design_created",
        "analytics_connected",
        "ab_test_created",
        "crm_connected",
        "first_conversion_tracked",
    ]

    @staticmethod
    def get_completed(workspace_id: str) -> list[str]:
        if not PG_AVAILABLE:
            return []
        try:
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT milestone FROM workspace_milestones
                    WHERE workspace_id = %s AND completed = TRUE
                """, (workspace_id,))
                rows = cur.fetchall()
            conn.close()
            return [r[0] for r in rows]
        except Exception:
            return []

    @staticmethod
    def mark_complete(workspace_id: str, milestone: str) -> None:
        if not PG_AVAILABLE:
            return
        try:
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO workspace_milestones (workspace_id, milestone, completed, completed_at)
                    VALUES (%s, %s, TRUE, NOW())
                    ON CONFLICT (workspace_id, milestone) DO UPDATE SET completed=TRUE, completed_at=NOW()
                """, (workspace_id, milestone))
            conn.commit()
            conn.close()
        except Exception:
            pass


# ── Sub-skill: Task List Generator ───────────────────────────────────────────

class TaskListGeneratorSkill:
    """Generates the setup task list shown in the onboarding UI."""

    TASKS = {
        "ecommerce": [
            {"task": "Connect your Shopify/WooCommerce store",      "priority": "HIGH",   "docs": "/docs/integrations/shopify"},
            {"task": "Import your customer contact list",            "priority": "HIGH",   "docs": "/docs/contacts/import"},
            {"task": "Launch your first email campaign",             "priority": "HIGH",   "docs": "/docs/campaigns/quickstart"},
            {"task": "Set up abandoned cart recovery sequence",      "priority": "MEDIUM", "docs": "/docs/automations/cart"},
            {"task": "Connect Meta Ads for ROI tracking",            "priority": "MEDIUM", "docs": "/docs/integrations/meta"},
            {"task": "Configure A/B testing for subject lines",      "priority": "LOW",    "docs": "/docs/ab-testing"},
        ],
        "saas": [
            {"task": "Import your trial user list",                  "priority": "HIGH",   "docs": "/docs/contacts/import"},
            {"task": "Set up trial-to-paid nurture sequence",        "priority": "HIGH",   "docs": "/docs/automations/trial"},
            {"task": "Connect your CRM (HubSpot/Pipedrive)",         "priority": "HIGH",   "docs": "/docs/integrations/crm"},
            {"task": "Configure lead scoring thresholds",            "priority": "MEDIUM", "docs": "/docs/lead-scoring"},
            {"task": "Launch your first trial nurture campaign",     "priority": "MEDIUM", "docs": "/docs/campaigns/quickstart"},
            {"task": "Connect analytics for revenue attribution",    "priority": "LOW",    "docs": "/docs/analytics"},
        ],
        "general": [
            {"task": "Import your contact list (CSV or integration)","priority": "HIGH",   "docs": "/docs/contacts/import"},
            {"task": "Launch your first email campaign",             "priority": "HIGH",   "docs": "/docs/campaigns/quickstart"},
            {"task": "Set up your brand voice profile",              "priority": "MEDIUM", "docs": "/docs/brand"},
            {"task": "Configure email compliance settings",          "priority": "MEDIUM", "docs": "/docs/compliance"},
            {"task": "Explore the campaign analytics dashboard",     "priority": "LOW",    "docs": "/docs/analytics"},
        ],
    }

    @classmethod
    def generate(cls, workspace_type: str) -> list[dict]:
        return cls.TASKS.get(workspace_type, cls.TASKS["general"])


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT_XML = """<role>
You are the Onboarding Agent for MarketOS.
You create personalised onboarding plans that get new workspaces to value within 24 hours.
</role>

<instructions>
Given the workspace type and user information:
1. Write a personalised welcome message (warm, specific to their industry)
2. Identify the single most important first action (the "aha moment")
3. Write the Day 1 email copy (subject + body) — this is the first impression
4. Predict: what is the most likely reason this workspace will churn in 30 days?
5. Write one proactive intervention to prevent that churn

Be specific. Use their industry context. Sound human, not automated.
</instructions>

<output_format>
Valid JSON only.
{
  "welcome_message": "personalised 2-sentence welcome",
  "first_action": "The single most important thing to do first",
  "aha_moment_description": "When they send their first campaign and see 30%+ open rates",
  "day1_email": {
    "subject": "...",
    "body_text": "full body text of day 1 email (plain text)"
  },
  "churn_risk": "Most likely churn reason for this workspace type",
  "churn_intervention": "Specific action to take if milestone not hit by Day 3"
}
</output_format>"""


# ── Agent ─────────────────────────────────────────────────────────────────────

class OnboardingAgent(AgentBase):
    def __init__(self):
        self.skill_ctx = load_skills(ONBOARDINGAGENT_SKILLS)

    agent_name = "onboarding_agent"
    temperature = 0.5   # slightly creative for welcoming tone

    def memory_query(self, state: dict) -> str:
        return f"onboarding {state.get('workspace_type','general')} activation drip"

    def execute(self, state: dict) -> dict:
        step_banner("ONBOARDING AGENT  ─  Workspace Activation & Drip Sequence")

        # Onboarding state comes from signup event, not campaign_plan
        user_name      = state.get("user_name", "there")
        user_email     = state.get("user_email") or state.get("recipient_email", "")
        company_name   = state.get("company_name", "")
        industry       = state.get("industry", "")
        workspace_id   = state.get("workspace_id", WORKSPACE)

        agent_log("ONBOARDING", f"New workspace: {company_name or workspace_id}")
        agent_log("ONBOARDING", f"User: {user_name} | {user_email}")

        # ── Classify workspace ────────────────────────────────────────────
        workspace_type = WorkspaceClassifierSkill.classify(company_name, industry)
        agent_log("ONBOARDING", f"Workspace type: {workspace_type.upper()}")

        # ── Check episodic memory for successful patterns ──────────────────
        memories = episodic_memory.recall("onboarding_agent", f"{workspace_type} onboarding", top_k=2)
        memory_ctx = ""
        if memories:
            memory_ctx = f"\nSuccessful past patterns:\n" + "\n".join(m.get("summary","") for m in memories)

        # ── LLM personalisation ───────────────────────────────────────────
        llm = self.get_llm()
        response = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT_XML + "\n\nSKILLS:\n" + self.skill_ctx),
            HumanMessage(content=f"""
Workspace type: {workspace_type}
Company name: {company_name or 'not provided'}
Industry: {industry or 'not specified'}
User name: {user_name}
{memory_ctx}
"""),
        ])

        try:
            plan = extract_json(response.content.strip())
        except ValueError:
            plan = {
                "welcome_message": f"Welcome to MarketOS, {user_name}! Let's get your first campaign live.",
                "first_action": "Send your first email campaign",
                "day1_email": {"subject": f"Welcome {user_name} — your first campaign awaits",
                               "body_text": "Let's get started!"},
            }

        # ── Build drip sequence ───────────────────────────────────────────
        drip = DripSequenceBuilderSkill.build(workspace_type, user_name)

        # ── Generate task list ────────────────────────────────────────────
        tasks = TaskListGeneratorSkill.generate(workspace_type)

        # ── Check existing milestones ─────────────────────────────────────
        completed = MilestoneTrackerSkill.get_completed(workspace_id)
        agent_log("ONBOARDING", f"Milestones already completed: {len(completed)}")

        # ── Write onboarding plan to semantic_memory ──────────────────────
        semantic_memory.upsert(
            category="onboarding",
            key=f"plan_{workspace_id}",
            content=json.dumps({
                "workspace_type":    workspace_type,
                "drip_count":        len(drip),
                "tasks_count":       len(tasks),
                "churn_risk":        plan.get("churn_risk",""),
                "churn_intervention":plan.get("churn_intervention",""),
            }),
        )

        # ── Publish drip trigger to Kafka (Email Agent picks up) ──────────
        for step in drip[:1]:   # Day 1 fires immediately
            publish_event(
                topic=Topics.EMAIL_TASKS,
                source_agent="onboarding_agent",
                payload={
                    "type":         "onboarding_drip",
                    "workspace_id": workspace_id,
                    "recipient":    user_email,
                    "subject":      plan.get("day1_email", {}).get("subject", step["subject"]),
                    "body_text":    plan.get("day1_email", {}).get("body_text", ""),
                    "send_at":      step["send_at"],
                },
                priority="HIGH",
            )

        onboarding_id = f"OB-{str(uuid.uuid4())[:8].upper()}"

        # ── Store in PostgreSQL ───────────────────────────────────────────
        if PG_AVAILABLE:
            try:
                conn = psycopg2.connect(PG_DSN)
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO onboarding_plans
                            (onboarding_id, workspace_id, workspace_type, user_email,
                             drip_json, tasks_json, churn_risk, status, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', NOW())
                    """, (onboarding_id, workspace_id, workspace_type, user_email,
                          json.dumps(drip), json.dumps(tasks),
                          plan.get("churn_risk", "")))
                conn.commit()
                conn.close()
            except Exception as e:
                agent_log("ONBOARDING", f"DB write failed: {e}")

        # ── Terminal output ───────────────────────────────────────────────
        agent_log("ONBOARDING", f"✓ Onboarding ID: {onboarding_id}")
        divider()
        section("WORKSPACE PROFILE")
        kv("Type",          workspace_type.upper())
        kv("First action",  plan.get("first_action",""))
        kv("Aha moment",    plan.get("aha_moment_description","")[:80])

        section("WELCOME MESSAGE")
        print(f"\n  {plan.get('welcome_message','')}")

        section("7-DAY DRIP SEQUENCE")
        for step in drip:
            print(f"  Day {step['day']:>2}  |  {step['subject'][:60]:<60}  →  goal: {step['goal']}")

        section("SETUP TASK LIST")
        for t in tasks:
            print(f"  [{t['priority']:>6}]  {t['task']}")

        section("CHURN RISK MITIGATION")
        kv("Risk",         plan.get("churn_risk",""))
        kv("Intervention", plan.get("churn_intervention","")[:80])

        divider()

        return {
            **state,
            "onboarding_result": {
                "onboarding_id":  onboarding_id,
                "workspace_type": workspace_type,
                "drip_sequence":  drip,
                "task_list":      tasks,
                "plan":           plan,
                "milestones_done":completed,
                "created_at":     datetime.now(timezone.utc).isoformat(),
            },
            "current_step": "complete",
            "trace": state.get("trace", []) + [{
                "agent":         "onboarding_agent",
                "status":        "completed",
                "onboarding_id": onboarding_id,
                "workspace_type":workspace_type,
                "drip_steps":    len(drip),
                "timestamp":     datetime.now(timezone.utc).isoformat(),
            }],
        }

    def store_memory(self, state: dict, result: dict) -> None:
        ob = result.get("onboarding_result") or {}
        episodic_memory.store(
            agent_name="onboarding_agent",
            event_type="onboarding_created",
            summary=f"{ob.get('workspace_type')} workspace onboarded. "
                    f"{len(ob.get('drip_sequence',[]))} drip emails scheduled.",
            metadata={"onboarding_id": ob.get("onboarding_id"),
                      "workspace_type": ob.get("workspace_type")},
        )


onboarding_agent = OnboardingAgent()
def onboarding_agent_node(state: dict) -> dict:
    return onboarding_agent(state)
