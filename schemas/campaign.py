"""
MarketOS — Campaign Data Schemas
All Pydantic models that define the data contracts between agents.
Agents communicate ONLY through these typed structures.

Changelog:
- CopyVariant: added hero_image_query, hero_image_prompt
- CopyOutput: added hero_image_url, hero_image_base64, hero_image_type
- SendResult: removed delivery simulation; added real_email_sent/status
- DeliverySimulation: kept for future Analytics Agent integration
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


# ── Supervisor Output ────────────────────────────────────────────────────────

class AgentTask(BaseModel):
    agent: str
    task: str
    priority: str = "NORMAL"   # LOW | NORMAL | HIGH | CRITICAL
    depends_on: List[str] = []


class CampaignPlan(BaseModel):
    campaign_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    campaign_name: str
    goal: str
    target_audience: str
    channels: List[str]
    budget: Optional[float] = None
    timeline: str
    tone: str
    key_messages: List[str]
    tasks: List[AgentTask]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())



# ── Copy Agent Output ────────────────────────────────────────────────────────

class CopyVariant(BaseModel):
    variant_id: str = Field(default_factory=lambda: f"V-{str(uuid.uuid4())[:6].upper()}")
    subject_line: str
    preview_text: str
    body_html: str
    body_text: str
    cta_text: str
    cta_url: str = "https://example.com/offer"

    # Image fields — populated by Copy Agent, used by Image Agent
    hero_image_query: Optional[str] = None     # Unsplash search query (2-3 words)
    hero_image_prompt: Optional[str] = None    # Gemini Imagen fallback prompt

    # Scoring
    readability_score: float        # 0–100, higher = more readable
    tone_alignment_score: float     # 0–100, alignment with requested tone
    spam_risk_score: float          # 0–100, lower = safer
    estimated_open_rate: float      # percentage
    estimated_ctr: float            # click-through-rate percentage


class CopyOutput(BaseModel):
    variants: List[CopyVariant]
    selected_variant_id: str
    selection_reasoning: str
    brand_voice_notes: str

    # Image fields — populated by Image Agent after copy_agent runs
    hero_image_url: Optional[str] = None       # Unsplash photo URL (if found + verified)
    hero_image_base64: Optional[str] = None    # Gemini Imagen base64 bytes (fallback)
    hero_image_type: Optional[str] = None      # "URL" | "CID" | None


# ── Compliance Agent Output ──────────────────────────────────────────────────

class ComplianceCheck(BaseModel):
    rule_id: str
    rule_name: str
    category: str    # CAN_SPAM | GDPR | TCPA | DELIVERABILITY | BRAND_SAFETY
    passed: bool
    severity: str    # INFO | WARNING | CRITICAL
    detail: str
    remediation: Optional[str] = None


class ComplianceResult(BaseModel):
    approved: bool
    compliance_score: float         # 0–100
    checks: List[ComplianceCheck]
    reason_code: Optional[str] = None
    blocked_reason: Optional[str] = None
    suggestions: List[str] = []
    reviewed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Email Agent Output ───────────────────────────────────────────────────────

class SendResult(BaseModel):
    """
    Result of the Email Agent execution.
    real_email_sent / real_email_status track the actual SMTP send.
    Delivery projections are intentionally removed from this model —
    they will be owned by the Analytics Agent in the full system.
    """
    campaign_id: str
    status: str                             # SENT | SCHEDULED | FAILED
    provider: str = "SendGrid"
    message_id: str = Field(default_factory=lambda: f"MSG-{str(uuid.uuid4())[:12].upper()}")

    # Send strategy
    optimal_send_time: str
    next_drip_trigger: Optional[str] = None
    drip_sequence_preview: List[str] = []

    # Real email delivery tracking
    real_email_sent: bool = False
    real_email_status: Optional[str] = None    # "sent" | error message | "not_attempted"

    sent_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Graph State ──────────────────────────────────────────────────────────────

class CampaignState(dict):
    """
    Typed wrapper for the LangGraph state dict.
    All fields stored as plain dicts (model.model_dump()) for JSON serializability.
    """
    pass
"""
MarketOS — Campaign Data Schemas (Phase 3 additions)
Append these classes to the existing schemas/campaign.py
"""

# ── Finance Agent ─────────────────────────────────────────────────────────────

class BudgetCheck(BaseModel):
    """Pre-send budget gate result from Finance Agent."""
    approved:               bool
    campaign_id:            str
    budget_total:           Optional[float] = None
    budget_spent:           float = 0.0
    budget_remaining:       Optional[float] = None
    spend_pct:              float = 0.0           # 0-1 fraction spent
    projected_overpace:     bool = False
    cpm_estimate:           Optional[float] = None  # cost per 1000 impressions
    roas_estimate:          Optional[float] = None  # return on ad spend
    block_reason:           Optional[str] = None
    recommendations:        List[str] = []
    checked_at:             str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ROIAttribution(BaseModel):
    campaign_id:            str
    total_spend:            float = 0.0
    attributed_revenue:     float = 0.0
    conversions:            int = 0
    cost_per_conversion:    Optional[float] = None
    roas:                   Optional[float] = None   # revenue / spend
    cpa:                    Optional[float] = None   # cost per acquisition
    ltv_estimate:           Optional[float] = None
    channel_breakdown:      Dict[str, float] = {}
    attributed_at:          str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Personalization Agent ─────────────────────────────────────────────────────

class ContactProfile(BaseModel):
    """Minimal contact profile consumed by Personalization Agent."""
    contact_id:             str
    email:                  Optional[str] = None
    first_name:             Optional[str] = None
    last_name:              Optional[str] = None
    city:                   Optional[str] = None
    country:                Optional[str] = None
    language:               Optional[str] = "en"
    segment:                Optional[str] = None      # e.g. "high_intent", "lapsed"
    last_purchase_days_ago: Optional[int] = None
    total_orders:           int = 0
    avg_order_value:        Optional[float] = None
    email_opens_30d:        int = 0
    email_clicks_30d:       int = 0
    preferred_time:         Optional[str] = None      # "morning" | "evening"
    tags:                   List[str] = []
    custom:                 Dict[str, Any] = {}


class PersonalizedVariant(BaseModel):
    """A single personalized copy variant for one contact."""
    contact_id:             str
    original_variant_id:    str
    subject_line:           str
    preview_text:           str
    body_html:              str
    body_text:              str
    cta_text:               str
    personalization_signals: List[str] = []     # which signals were used
    fallback_used:          bool = False         # True if fell back to segment-level
    generated_at:           str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── A/B Test Agent ────────────────────────────────────────────────────────────

class ABVariantStats(BaseModel):
    variant_id:             str
    sends:                  int = 0
    opens:                  int = 0
    clicks:                 int = 0
    conversions:            int = 0
    open_rate:              float = 0.0
    ctr:                    float = 0.0
    conversion_rate:        float = 0.0
    # Bayesian posterior
    beta_alpha:             float = 1.0    # successes + 1
    beta_beta:              float = 1.0    # failures  + 1
    prob_best:              float = 0.0    # P(this variant is best)
    expected_improvement:   float = 0.0   # vs baseline


class ABTestResult(BaseModel):
    test_id:                str = Field(default_factory=lambda: f"ABT-{str(uuid.uuid4())[:8].upper()}")
    campaign_id:            str
    metric:                 str = "open_rate"    # primary metric for winner selection
    variants:               List[ABVariantStats] = []
    winner_id:              Optional[str] = None
    loser_ids:              List[str] = []
    confidence:             float = 0.0          # 0-1, Bayesian probability winner is best
    sample_size_reached:    bool = False
    sample_threshold:       int = 100            # min opens to declare winner
    decision:               str = "pending"      # pending | winner_declared | inconclusive
    decision_reasoning:     str = ""
    learning_stored:        bool = False         # written to episodic memory
    concluded_at:           Optional[str] = None


# ── Lead Scoring Agent ────────────────────────────────────────────────────────

class EngagementEvent(BaseModel):
    """A single contact engagement event consumed from Kafka."""
    event_id:               str
    contact_id:             str
    campaign_id:            Optional[str] = None
    event_type:             str   # open|click|page_visit|form_fill|purchase|unsubscribe
    url:                    Optional[str] = None
    value:                  Optional[float] = None   # purchase value if event_type=purchase
    timestamp:              str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LeadScore(BaseModel):
    contact_id:             str
    previous_score:         float = 0.0
    new_score:              float = 0.0
    score_delta:            float = 0.0
    lifecycle_stage:        str = "subscriber"   # subscriber|mql|sql|opportunity|customer
    previous_stage:         Optional[str] = None
    stage_changed:          bool = False
    top_signals:            List[str] = []       # e.g. ["3 clicks in 24h", "visited pricing page"]
    crm_updated:            bool = False
    crm_webhook_status:     Optional[str] = None
    escalate_to_supervisor: bool = False
    scored_at:              str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ScoreModelConfig(BaseModel):
    """Per-workspace lead scoring weights (configurable)."""
    workspace_id:           str = "default"
    weights:                Dict[str, float] = Field(default_factory=lambda: {
        "email_open":        5.0,
        "email_click":       15.0,
        "page_visit":        3.0,
        "pricing_page":      25.0,
        "form_fill":         40.0,
        "purchase":          100.0,
        "unsubscribe":       -50.0,
        "spam_complaint":    -100.0,
        "email_open_repeat": 2.0,    # diminishing returns on repeat opens
    })
    mql_threshold:          float = 50.0
    sql_threshold:          float = 100.0
    score_decay_days:       int = 30    # score halves every N days of inactivity
