"""
MarketOS — SEO Agent
PRD: GSC API, headless crawler, keyword rank API. Weekly + on-demand.

Architecture: Uses ReAct (Reason + Act) loop — the agent reasons about
what to check next, then acts, then reasons again. This is the Google
Vertex AI Agent pattern for research tasks.

Sub-skills:
  GSCSkill              — Google Search Console Performance API
  KeywordRankSkill      — Tracks keyword positions from GSC data
  HeadlessCrawlerSkill  — On-page SEO audit (title, meta, h1, canonical)
  ContentGapSkill       — pgvector semantic similarity → finds missing topics
  ContentBriefSkill     — Structured brief for Copy Agent to fill gaps
  ReflectionSkill       — Self-critiques the briefing for completeness

Memory integration:
  Writes content gaps to semantic_memory so Copy Agent knows what to write.
  Recalls past SEO wins from episodic_memory before briefing.
"""

from __future__ import annotations

import json
import os
import urllib.request
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from utils.agent_base import AgentBase, CircuitBreaker, retry
from utils.memory import episodic_memory, semantic_memory
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json
from core.skill_loader import load_skills

SEOAGENT_SKILLS = [
    "seo-audit","ai-seo","programmatic-seo","schema-markup","site-architecture"
]


PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Sub-skill: GSC ────────────────────────────────────────────────────────────

class GSCSkill:
    """
    Google Search Console Performance API.
    Returns top queries, pages, CTR, impressions for the workspace's domain.
    """
    _circuit = CircuitBreaker("GSC")

    @classmethod
    def get_performance(cls, domain: str, days: int = 28) -> dict:
        token = os.getenv("GOOGLE_OAUTH_TOKEN")
        if not token:
            agent_log("SEO", "No GOOGLE_OAUTH_TOKEN — GSC data skipped")
            return {"rows": [], "status": "skipped", "reason": "no_gsc_token"}

        start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        end   = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        payload = json.dumps({
            "startDate":  start,
            "endDate":    end,
            "dimensions": ["query"],
            "rowLimit":   50,
        }).encode()

        def _call():
            req = urllib.request.Request(
                f"https://searchconsole.googleapis.com/webmasters/v3/sites/"
                f"{urllib.parse.quote(domain, safe='')}/searchAnalytics/query",
                data=payload,
                headers={
                    "Authorization":  f"Bearer {token}",
                    "Content-Type":   "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())

        try:
            return cls._circuit.call(_call, fallback={"rows": [], "status": "skipped", "reason": "gsc_api_error"})
        except Exception:
            return {"rows": [], "status": "skipped", "reason": "gsc_api_error"}


# ── Sub-skill: Keyword Rank ───────────────────────────────────────────────────

class KeywordRankSkill:
    """
    Analyses keyword performance from GSC data.
    Identifies opportunities: high impression / low CTR = SERP snippet fix needed.
    """

    @staticmethod
    def analyse(gsc_rows: list[dict]) -> dict:
        opportunities  = []
        quick_wins     = []
        low_performers = []

        for row in gsc_rows:
            query      = row["keys"][0] if isinstance(row.get("keys"), list) else row.get("query", "")
            clicks     = row.get("clicks", 0)
            impressions= row.get("impressions", 0)
            ctr        = row.get("ctr", 0)
            position   = row.get("position", 99)

            if impressions > 2000 and ctr < 0.03:
                opportunities.append({"keyword": query, "impressions": impressions, "ctr": ctr,
                                      "issue": "high impressions, low CTR — improve title/meta"})
            if 4 <= position <= 15 and clicks > 50:
                quick_wins.append({"keyword": query, "position": round(position, 1),
                                   "opportunity": "near top-3 — internal linking + content depth"})
            if position > 20:
                low_performers.append({"keyword": query, "position": round(position, 1)})

        return {
            "opportunities":  opportunities[:5],
            "quick_wins":     quick_wins[:5],
            "low_performers": low_performers[:3],
        }


# ── Sub-skill: Content Gap ────────────────────────────────────────────────────

class ContentGapSkill:
    """
    Finds missing content topics using pgvector semantic similarity.
    Compares competitor topics (from semantic_memory) with existing content.
    """

    TOPIC_SEEDS = [
        "skincare routine for Indian skin",
        "vitamin C benefits for dark spots",
        "best time to apply serum",
        "niacinamide vs vitamin c",
        "summer skincare tips India",
        "how to layer skincare products",
        "SPF importance Indian climate",
        "anti-pollution skincare routine",
    ]

    @classmethod
    def find_gaps(cls, existing_content: list[str]) -> list[str]:
        """
        Returns topics not yet covered in existing content.
        Uses simple string matching as proxy for semantic search in demo.
        Production: uses pgvector similarity search.
        """
        existing_lower = " ".join(existing_content).lower()
        gaps = []
        for seed in cls.TOPIC_SEEDS:
            key_words = seed.split()[:2]
            if not any(w in existing_lower for w in key_words):
                gaps.append(seed)
        return gaps[:5]


# ── System Prompt (ReAct style) ───────────────────────────────────────────────

SYSTEM_PROMPT_XML = """<role>
You are the SEO Agent for MarketOS.
You analyse search performance data and produce actionable SEO briefings.
You think step-by-step before producing output (ReAct: Reason then Act).
</role>

<instructions>
Given the GSC performance data and keyword analysis:

STEP 1 — REASON: Identify the top 3 most impactful opportunities.
STEP 2 — PRIORITISE: Rank by potential traffic gain × effort.
STEP 3 — BRIEF: Write a concrete content brief for each gap.

A content brief MUST include:
- Target keyword (primary + 2 LSI keywords)
- Recommended title (under 60 chars, includes keyword)
- Meta description (under 155 chars)
- H1 suggestion
- 4-6 section headings covering search intent
- Word count recommendation
- Internal linking targets
- Priority: high/medium/low

STEP 4 — QUICK WINS: List 3 existing pages that need title/meta improvements only.
</instructions>

<output_format>
Valid JSON only.
{
  "weekly_briefing": {
    "domain": "example.com",
    "period": "last 28 days",
    "summary": "3-sentence executive summary of search health",
    "top_metrics": {"total_clicks": 1234, "avg_position": 12.4, "top_keyword": "..."}
  },
  "content_briefs": [
    {
      "priority": "high",
      "target_keyword": "...",
      "lsi_keywords": ["...", "..."],
      "title": "...",
      "meta_description": "...",
      "h1": "...",
      "sections": ["Intro: ...", "Section 1: ...", "Section 2: ..."],
      "word_count": 1200,
      "internal_links": ["link to existing page A", "link to existing page B"]
    }
  ],
  "quick_wins": [
    {"page": "/blog/vitamin-c", "current_title": "...", "recommended_title": "...",
     "current_meta": "...", "recommended_meta": "...", "reason": "CTR below 3%"}
  ],
  "content_gaps": ["topic1", "topic2", "topic3"]
}
</output_format>"""


# ── Agent ─────────────────────────────────────────────────────────────────────

class SEOAgent(AgentBase):
    agent_name         = "seo_agent"
    reflection_enabled = True
    temperature        = 0.2

    def memory_query(self, state: dict) -> str:
        plan = state.get("campaign_plan") or {}
        return f"SEO content gap keyword {plan.get('target_audience','')}"

    def execute(self, state: dict) -> dict:
        step_banner("SEO AGENT  ─  Search Performance Analysis & Content Briefing")

        plan_data = state.get("campaign_plan") or {}
        from schemas.campaign import CampaignPlan
        plan   = CampaignPlan(**plan_data)
        domain = os.getenv("WORKSPACE_DOMAIN", "example.com")

        agent_log("SEO", f"Domain: {domain}  |  Campaign: {plan.campaign_name}")
        agent_log("SEO", "Fetching GSC performance data...")

        # ── Phase 1: Data collection ──────────────────────────────────────
        gsc_data = GSCSkill.get_performance(domain)
        rows     = gsc_data.get("rows", [])
        agent_log("SEO", f"GSC rows returned: {len(rows)}")

        keyword_analysis = KeywordRankSkill.analyse(rows)
        content_gaps     = ContentGapSkill.find_gaps(
            [r["keys"][0] for r in rows if isinstance(r.get("keys"), list)]
        )

        agent_log("SEO", f"Opportunities: {len(keyword_analysis['opportunities'])}  |  Quick wins: {len(keyword_analysis['quick_wins'])}")
        agent_log("SEO", f"Content gaps identified: {len(content_gaps)}")

        # ── Phase 2: LLM briefing generation (ReAct) ─────────────────────
        llm = self.get_llm()

        gsc_summary = json.dumps({
            "top_queries":    rows[:5],
            "opportunities":  keyword_analysis["opportunities"],
            "quick_wins":     keyword_analysis["quick_wins"],
            "content_gaps":   content_gaps,
            "gsc_status":     gsc_data.get("status", "live"),
        }, indent=2)

        response = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT_XML + "\n\nSKILLS:\n" + load_skills(SEOAGENT_SKILLS)),
            HumanMessage(content=f"Domain: {domain}\nCampaign topic: {plan.campaign_name}\n\n{gsc_summary}"),
        ])

        try:
            data = extract_json(response.content.strip())
        except ValueError as e:
            err = f"SEO Agent JSON parse: {e}"
            return {**state, "errors": state.get("errors", []) + [err]}

        # ── Phase 3: Write content gaps to semantic_memory ────────────────
        for gap in data.get("content_gaps", []):
            semantic_memory.upsert(
                category="content_gap",
                key=gap[:100],
                content=f"Missing content topic for domain {domain}: {gap}",
            )

        for brief in data.get("content_briefs", []):
            semantic_memory.upsert(
                category="content_brief",
                key=brief.get("target_keyword", "")[:100],
                content=json.dumps(brief),
            )

        briefing_id = f"SEO-{str(uuid.uuid4())[:8].upper()}"

        # ── Terminal output ───────────────────────────────────────────────
        agent_log("SEO", f"✓ Briefing ID: {briefing_id}")
        divider()
        summary = data.get("weekly_briefing", {})
        section("WEEKLY SEO BRIEFING")
        kv("Domain",     summary.get("domain", domain))
        kv("Period",     summary.get("period", "28 days"))
        kv("Summary",    summary.get("summary", "")[:100])

        section("CONTENT BRIEFS")
        for brief in data.get("content_briefs", []):
            print(f"\n  [{brief.get('priority','?').upper()}]  {brief.get('target_keyword')}")
            print(f"    Title: {brief.get('title')}")
            print(f"    Words: {brief.get('word_count')}")

        section("QUICK WINS")
        for qw in data.get("quick_wins", []):
            print(f"  →  {qw.get('page')}  |  {qw.get('reason')}")

        if content_gaps:
            section("CONTENT GAPS → SEMANTIC MEMORY")
            for gap in content_gaps:
                print(f"  →  {gap}")

        divider()

        return {
            **state,
            "seo_result": {
                "briefing_id":     briefing_id,
                "domain":          domain,
                "briefing":        data,
                "keyword_analysis":keyword_analysis,
                "content_gaps":    content_gaps,
                "generated_at":    datetime.now(timezone.utc).isoformat(),
            },
            "current_step": "competitor_agent",
            "trace": state.get("trace", []) + [{
                "agent":       "seo_agent",
                "status":      "completed",
                "briefing_id": briefing_id,
                "timestamp":   datetime.now(timezone.utc).isoformat(),
            }],
        }

    def should_reflect(self, result: dict) -> bool:
        briefs = (result.get("seo_result") or {}).get("briefing", {}).get("content_briefs", [])
        return len(briefs) == 0   # reflect if no briefs generated

    def store_memory(self, state: dict, result: dict) -> None:
        seo = result.get("seo_result") or {}
        episodic_memory.store(
            agent_name="seo_agent",
            event_type="seo_briefing",
            summary=f"SEO briefing {seo.get('briefing_id')} for {seo.get('domain')}. "
                    f"Gaps: {', '.join(seo.get('content_gaps', [])[:3])}",
            metadata={"briefing_id": seo.get("briefing_id"), "domain": seo.get("domain")},
        )


seo_agent = SEOAgent()
def seo_agent_node(state: dict) -> dict:
    return seo_agent(state)
