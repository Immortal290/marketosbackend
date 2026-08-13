export interface PersonaDto {
  name: string;
  demographics: string;
  painPoints: string;
  goals: string;
}

export interface CompetitorDto {
  name: string;
  url?: string;
  notes?: string;
}

export interface CreateBrandProfileDto {
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
  personas: PersonaDto[];
  competitors: CompetitorDto[];
  complianceRegion?: string;
  complianceNotes?: string;
  pastCampaignRefs?: object[];
}

export type UpdateBrandProfileDto = Partial<Omit<CreateBrandProfileDto, 'workspaceId'>>;
