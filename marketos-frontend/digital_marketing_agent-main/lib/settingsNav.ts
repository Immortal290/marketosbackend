import type { SettingsSectionId } from "@/lib/types";

export interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  href: string;
  icon: string;
  description: string;
}

export const settingsNav: SettingsNavItem[] = [
  {
    id: "workspace",
    label: "Workspace",
    href: "/settings/workspace",
    icon: "Building2",
    description: "General workspace-level configuration",
  },
  {
    id: "team",
    label: "Team",
    href: "/settings/team",
    icon: "Users",
    description: "Manage team members and roles",
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/settings/integrations",
    icon: "Plug",
    description: "Connect third-party services",
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/settings/compliance",
    icon: "ShieldCheck",
    description: "Regulatory and policy controls",
  },
  {
    id: "billing",
    label: "Billing",
    href: "/settings/billing",
    icon: "CreditCard",
    description: "Subscription, plans, and payment",
  },
  {
    id: "security",
    label: "Security",
    href: "/settings/security",
    icon: "Lock",
    description: "Authentication and access controls",
  },
];
