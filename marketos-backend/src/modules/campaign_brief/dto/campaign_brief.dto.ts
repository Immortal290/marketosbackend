export interface CreateCampaignBriefDto {
  workspaceId: string;
  brandProfileId: string;
  goal: 'awareness' | 'leads' | 'sales' | 'retention';
  channels: string[];
  budget?: number;
  timelineStart?: string; // ISO date string
  timelineEnd?: string;
  keyMessage?: string;
  offerDetails?: string;
  kpiTarget?: string;
  freeTextContext?: string;
  rawPromptFallback?: string;
  // Optional send context forwarded to agent service
  recipientEmail?: string;
  recipientPhone?: string;
  senderName?: string;
  companyName?: string;
  companyAddress?: string;
  unsubscribeUrl?: string;
}
