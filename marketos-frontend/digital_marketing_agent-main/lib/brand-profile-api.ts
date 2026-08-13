// Type definitions mirroring the backend DTOs

export interface Persona {
  name: string;
  demographics: string;
  painPoints: string;
  goals: string;
}

export interface Competitor {
  name: string;
  url?: string;
  notes?: string;
}

export interface BrandProfile {
  id?: string;
  workspaceId: string;
  businessName: string;
  industry: string;
  websiteUrl?: string;
  mission?: string;
  usp?: string;
  positioning?: string;
  voiceAdjectives: string[];
  voiceDos: string[];
  voiceDonts: string[];
  logoUrl?: string;
  brandColors: string[];
  styleGuideUrl?: string;
  personas: Persona[];
  competitors: Competitor[];
  complianceRegion?: string;
  complianceNotes?: string;
  pastCampaignRefs?: any[];
}

export interface CampaignBrief {
  id?: string;
  workspaceId: string;
  brandProfileId: string;
  goal: 'awareness' | 'leads' | 'sales' | 'retention';
  channels: string[];
  budget?: number;
  timelineStart?: string;
  timelineEnd?: string;
  keyMessage?: string;
  offerDetails?: string;
  kpiTarget?: string;
  freeTextContext?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const brandProfileApi = {
  async getByWorkspace(workspaceId: string): Promise<BrandProfile[]> {
    const res = await fetch(`${API_BASE}/brand-profile?workspaceId=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch brand profiles');
    const data = await res.json();
    return data.data;
  },

  async create(profile: BrandProfile): Promise<BrandProfile> {
    const res = await fetch(`${API_BASE}/brand-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error('Failed to create brand profile');
    const data = await res.json();
    return data.data;
  },

  async autofill(websiteUrl: string): Promise<Partial<BrandProfile>> {
    const res = await fetch(`${API_BASE}/brand-profile/autofill`, { // NOTE: Mocking endpoint for now, would need a real ID in a real system or a dedicated autofill route without ID
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl }),
    });
    if (!res.ok) throw new Error('Failed to autofill brand profile');
    const data = await res.json();
    return data.data;
  }
};

export const campaignBriefApi = {
  async createAndLaunch(brief: CampaignBrief): Promise<void> {
    // Note: We don't return JSON here because it streams SSE,
    // but for the wizard completion we just need a successful POST
    const res = await fetch(`${API_BASE}/campaign/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief),
    });
    if (!res.ok) throw new Error('Failed to launch campaign pipeline');
  }
};
