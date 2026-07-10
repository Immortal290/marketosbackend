export interface NavItem {
  label: string;
  href: string;
}

export const primaryNav: NavItem[] = [
  { label: "Platform", href: "/platform" },
  { label: "Agents", href: "/agents" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/resources" },
  { label: "Company", href: "/company" },
];

export const appNav: NavItem[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Analytics", href: "/analytics" },
  { label: "Audience", href: "/audience" },
  { label: "Settings", href: "/settings" },
];

export const extendedAppNav: NavItem[] = [
  { label: "Contacts", href: "/contacts" },
  { label: "Creative Studio", href: "/creative-studio" },
  { label: "Competitive Intel", href: "/competitive-intelligence" },
  { label: "Finance & ROI", href: "/finance" },
  { label: "Monitoring", href: "/monitoring" },
  { label: "Reports", href: "/reports" },
];

export const trustLogos: string[] = [
  "NORTHWIND",
  "ACME CORP",
  "GLOBEX",
  "INITECH",
  "UMBRELLA",
  "SOYLENT",
  "HOOLI",
  "VEHEMENT",
  "MASSIVE DYN",
  "STARK IND",
];

export interface SolutionItem {
  title: string;
  description: string;
  accent: "yellow" | "pink" | "cyan" | "lime";
}

export const solutionsByUseCase: SolutionItem[] = [
  {
    title: "SEO, AEO & GEO",
    description:
      "Win classic search and the new answer engines with content engineered to be cited by AI.",
    accent: "yellow",
  },
  {
    title: "Personalization",
    description:
      "Spin up thousands of on-brand variants tailored to audience, channel, and intent.",
    accent: "pink",
  },
  {
    title: "Campaigns",
    description:
      "Launch multi-channel campaigns end to end — brief to publish — from one intent.",
    accent: "cyan",
  },
];

export const solutionsByRole: string[] = [
  "Performance Marketers",
  "PR & Communications",
  "Product Marketers",
  "Content Marketers",
  "Brand Marketers",
  "Field Marketers",
];

export const solutionsByIndustry: SolutionItem[] = [
  {
    title: "Financial Services",
    description:
      "Compliant, on-brand content with audit trails and governed approvals built in.",
    accent: "lime",
  },
  {
    title: "Healthcare & Life Sciences",
    description:
      "PHI-safe workflows and reviewer sign-off for regulated marketing at scale.",
    accent: "cyan",
  },
];

export interface Pillar {
  title: string;
  description: string;
  accent: "yellow" | "pink" | "cyan" | "lime";
  icon: string;
}

export const platformPillars: Pillar[] = [
  {
    title: "Agents",
    description:
      "Autonomous specialists that plan, create, and optimize marketing without prompting.",
    accent: "yellow",
    icon: "Bot",
  },
  {
    title: "Content Pipelines",
    description:
      "Structured, repeatable systems that turn one brief into a full campaign.",
    accent: "pink",
    icon: "Workflow",
  },
  {
    title: "MarketOS IQ",
    description:
      "Your brand, audiences, and rules — the shared intelligence every agent runs on.",
    accent: "cyan",
    icon: "BrainCircuit",
  },
];

export interface LifecycleStep {
  number: string;
  title: string;
  description: string;
}

export const lifecycleSteps: LifecycleStep[] = [
  {
    number: "01",
    title: "Plan",
    description:
      "Agents translate a single goal into a full, channel-aware campaign plan.",
  },
  {
    number: "02",
    title: "Create",
    description:
      "On-brand copy, visuals, and variants are generated against your guidelines.",
  },
  {
    number: "03",
    title: "Adapt",
    description:
      "Everything is reshaped per audience, locale, and channel automatically.",
  },
  {
    number: "04",
    title: "Activate",
    description:
      "Approved assets ship to your ad, email, and CMS destinations.",
  },
  {
    number: "05",
    title: "Optimize",
    description:
      "Performance is monitored and budget reallocated around the clock.",
  },
];

export interface AgentDetail {
  name: string;
  role: string;
  description: string;
  accent: "yellow" | "pink" | "cyan" | "lime";
}

export const marketingAgents: AgentDetail[] = [
  {
    name: "Personalization Agent",
    role: "Audience tailoring",
    description:
      "Generates and maintains thousands of audience-specific variants from a single source of truth.",
    accent: "pink",
  },
  {
    name: "Optimization Agent",
    role: "Performance",
    description:
      "Watches live metrics and reallocates spend and creative toward what is working.",
    accent: "yellow",
  },
  {
    name: "Research Agent",
    role: "Intelligence",
    description:
      "Surfaces brand, competitor, and market insight grounded in real data.",
    accent: "cyan",
  },
];

export interface PricingPlan {
  name: string;
  price: string;
  cadence: string;
  cta: string;
  href: string;
  highlight: boolean;
  features: string[];
}

export const pricingPlans: PricingPlan[] = [
  {
    name: "Pro",
    price: "$59",
    cadence: "per seat / month",
    cta: "Start Free 7-Day Trial",
    href: "/demo",
    highlight: false,
    features: [
      "1 seat",
      "Canvas workspace",
      "Essential Agents",
      "2 Brand Voices",
      "5 Knowledge assets",
      "3 Audiences",
    ],
  },
  {
    name: "Business",
    price: "Custom",
    cadence: "talk to our team",
    cta: "Contact Sales",
    href: "/demo",
    highlight: true,
    features: [
      "Advanced Agents",
      "No-code App Builder",
      "MarketOS Grid",
      "Unlimited IQ customization",
      "API access",
      "Enterprise governance",
      "Dedicated account management",
    ],
  },
];

export const comparisonCategories: string[] = [
  "MarketOS IQ",
  "LLM-Optimized Architecture",
  "MarketOS Platform",
  "Visual & Multimodal",
  "Extensions, Integrations & API",
  "Account & Organization",
  "Data Security & Privacy",
  "Onboarding & Support",
];

export interface CompanyStat {
  value: string;
  description: string;
}

export const companyStats: CompanyStat[] = [
  { value: "900+", description: "Enterprise customers" },
  { value: "20%", description: "of the Fortune 500 trust MarketOS" },
  { value: "125k+", description: "users on the platform" },
];

export interface ResourceCard {
  title: string;
  kind: string;
  accent: "yellow" | "pink" | "cyan" | "lime";
}

export const ebooks: ResourceCard[] = [
  {
    title: "The State of AI in Marketing 2026",
    kind: "Report",
    accent: "yellow",
  },
  { title: "The Operational Era of AI Is Here", kind: "Ebook", accent: "pink" },
  { title: "Owning AI Search in 2026", kind: "Guide", accent: "cyan" },
  {
    title: "Optimizing Content for GEO & AEO",
    kind: "Playbook",
    accent: "lime",
  },
];

export const webinars: ResourceCard[] = [
  {
    title: "Reinventing Marketing Teams for AI",
    kind: "Webinar",
    accent: "cyan",
  },
  { title: "AI Search Optimization for B2C", kind: "Event", accent: "yellow" },
  { title: "From Experiment to Execution", kind: "Webinar", accent: "pink" },
];

export const customerStories: ResourceCard[] = [
  {
    title: "How Old Dominion Scales Content",
    kind: "Case Study",
    accent: "lime",
  },
  {
    title: "Northwind 4x Campaign Velocity",
    kind: "Case Study",
    accent: "pink",
  },
  {
    title: "Globex Cuts Production Time 60%",
    kind: "Case Study",
    accent: "cyan",
  },
];

export interface FooterColumn {
  heading: string;
  links: string[];
}

export const footerColumns: FooterColumn[] = [
  {
    heading: "Platform",
    links: [
      "Platform",
      "Agents",
      "Optimization",
      "Research",
      "Content Pipelines",
      "Canvas",
      "MarketOS Grid",
      "MarketOS IQ",
      "Brand Voice",
      "APIs",
    ],
  },
  {
    heading: "Solutions",
    links: [
      "SEO, AEO & GEO",
      "Personalization",
      "Campaigns",
      "Product Marketing",
      "Content Marketing",
      "Performance Marketing",
    ],
  },
  {
    heading: "Resources",
    links: [
      "GEO Diagnostic",
      "ROI Calculator",
      "Blog",
      "Customer Stories",
      "Events & Webinars",
      "Prompt Library",
      "Support",
    ],
  },
  {
    heading: "Company",
    links: ["About MarketOS", "Newsroom", "Careers", "Legal", "Integrations"],
  },
  {
    heading: "Trust",
    links: [
      "LLM-Optimized Architecture",
      "Security",
      "Governance",
      "Compliance",
      "Ethics",
    ],
  },
];
