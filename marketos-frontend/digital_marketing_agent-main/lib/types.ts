export type SettingsSectionId =
  | "workspace"
  | "team"
  | "integrations"
  | "compliance"
  | "billing"
  | "security";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Editor" | "Viewer";
  status: "active" | "invited" | "suspended";
  avatarColor: string;
}

export interface Integration {
  id: string;
  name: string;
  category: "Ads" | "Analytics" | "CRM" | "Email" | "Social";
  connected: boolean;
  description: string;
}

export interface BillingPlan {
  id: string;
  name: "Starter" | "Growth" | "Scale";
  priceMonthly: number;
  features: string[];
  current: boolean;
}

export interface ComplianceControl {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  standard: "GDPR" | "SOC2" | "CCPA" | "HIPAA";
}

export interface SecurityPolicy {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface WorkspaceSettings {
  name: string;
  subdomain: string;
  defaultTimezone: string;
  brandColor: string;
}
