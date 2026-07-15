from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class AgentTask(BaseModel):
    agent: str
    task: str
    priority: str = "HIGH"
    depends_on: List[str] = []

class CampaignPlan(BaseModel):
    campaign_id: str
    campaign_name: str
    goal: str
    target_audience: str
    channels: List[str]
    budget: Optional[float] = None
    timeline: str
    tone: str
    key_messages: List[str]
    tasks: List[AgentTask] = []

class CopyVariant(BaseModel):
    variant_id: str
    subject_line: str
    preview_text: str
    body_html: str
    body_text: str
    cta_text: str
    cta_url: str
    hero_image_query: str
    hero_image_prompt: str
    readability_score: float
    tone_alignment_score: float
    spam_risk_score: float
    estimated_open_rate: float
    estimated_ctr: float

class CopyOutput(BaseModel):
    variants: List[CopyVariant]
    selected_variant_id: str
    selection_reasoning: str
    brand_voice_notes: str
    hero_image_url: Optional[str] = None
    hero_image_base64: Optional[str] = None
    hero_image_type: Optional[str] = None

class ComplianceCheck(BaseModel):
    rule_id: str
    rule_name: str
    category: str
    passed: bool
    severity: str = "INFO"
    detail: str = ""
    remediation: Optional[str] = None

class ComplianceResult(BaseModel):
    approved: bool
    compliance_score: float
    checks: List[ComplianceCheck]
    reason_code: Optional[str] = None
    blocked_reason: Optional[str] = None
    suggestions: List[str] = []

class SendResult(BaseModel):
    campaign_id: str
    status: str
    provider: str
    message_id: str
    optimal_send_time: str
    next_drip_trigger: Optional[str] = None
    drip_sequence_preview: List[str] = []
