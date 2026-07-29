/**
 * Agent Approval Configuration
 * 
 * Defines which agents require human approval before execution continues.
 * E.g. EmailAgent, ComplianceAgent, SocialMediaAgent (external publishing),
 * VoiceAgent, WhatsappAgent.
 */

export interface AgentApprovalRule {
  requiresApproval: boolean;
  reason?: string;
}

export const AGENT_APPROVAL_CONFIG: Record<string, AgentApprovalRule> = {
  EmailAgent: {
    requiresApproval: true,
    reason: "Email dispatch to external contacts requires human review",
  },
  ComplianceAgent: {
    requiresApproval: true,
    reason: "Compliance policy & legal check requires explicit approval",
  },
  SocialMediaAgent: {
    requiresApproval: true,
    reason: "Publishing ad campaigns/posts to social platforms requires approval",
  },
  VoiceAgent: {
    requiresApproval: true,
    reason: "Outbound AI voice calls require manual authorization",
  },
  WhatsappAgent: {
    requiresApproval: true,
    reason: "Outbound WhatsApp messaging requires manual authorization",
  },
  // Auto-run agents (no approval required)
  SupervisorAgent: { requiresApproval: false },
  CopyAgent: { requiresApproval: false },
  CreativeAgent: { requiresApproval: false },
  AnalyticsAgent: { requiresApproval: false },
  FinanceAgent: { requiresApproval: false },
  LeadScoringAgent: { requiresApproval: false },
  MonitorAgent: { requiresApproval: false },
  OnboardingAgent: { requiresApproval: false },
  PersonalizationAgent: { requiresApproval: false },
  ReportingAgent: { requiresApproval: false },
  SeoAgent: { requiresApproval: false },
  CompetitorAgent: { requiresApproval: false },
  AbTestAgent: { requiresApproval: false },
};

/**
 * Normalizes any variation of an agent name to standard Agent class name (e.g. "email" -> "EmailAgent")
 */
export function normalizeAgentName(name: string): string {
  const cleaned = name.trim();
  if (cleaned.endsWith("Agent")) {
    return cleaned;
  }
  // Convert snake_case or lowercase to PascalCase + Agent
  const pascal = cleaned
    .split(/_|\s|-/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  return `${pascal}Agent`;
}

/**
 * Checks if a given agent requires human approval
 */
export function checkAgentRequiresApproval(agentName: string): boolean {
  const normalized = normalizeAgentName(agentName);
  return AGENT_APPROVAL_CONFIG[normalized]?.requiresApproval ?? false;
}
