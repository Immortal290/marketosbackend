import { z } from 'zod';

const PersonaSchema = z.object({
  name: z.string().min(1),
  demographics: z.string().min(1),
  painPoints: z.string().min(1),
  goals: z.string().min(1),
});

const CompetitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const createBrandProfileSchema = z.object({
  body: z.object({
    workspaceId: z.string().uuid('workspaceId must be a valid UUID'),
    businessName: z.string().min(1, 'Business name is required'),
    industry: z.string().min(1, 'Industry is required'),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    mission: z.string().optional(),
    usp: z.string().optional(),
    positioning: z.string().optional(),
    voiceAdjectives: z.array(z.string()).min(1, 'At least one voice adjective is required'),
    voiceDos: z.array(z.string()),
    voiceDonts: z.array(z.string()),
    logoUrl: z.string().optional(),
    brandColors: z.array(z.string()),
    styleGuideUrl: z.string().optional(),
    personas: z.array(PersonaSchema).min(1).max(5),
    competitors: z.array(CompetitorSchema).max(5),
    complianceRegion: z
      .enum(['none', 'EU-GDPR', 'US-HIPAA', 'US-FINRA', 'other'])
      .optional(),
    complianceNotes: z.string().optional(),
    pastCampaignRefs: z.array(z.object({}).passthrough()).optional(),
  }),
});

export const updateBrandProfileSchema = z.object({
  body: z.object({
    businessName: z.string().min(1).optional(),
    industry: z.string().min(1).optional(),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    mission: z.string().optional(),
    usp: z.string().optional(),
    positioning: z.string().optional(),
    voiceAdjectives: z.array(z.string()).optional(),
    voiceDos: z.array(z.string()).optional(),
    voiceDonts: z.array(z.string()).optional(),
    logoUrl: z.string().optional(),
    brandColors: z.array(z.string()).optional(),
    styleGuideUrl: z.string().optional(),
    personas: z.array(PersonaSchema).max(5).optional(),
    competitors: z.array(CompetitorSchema).max(5).optional(),
    complianceRegion: z
      .enum(['none', 'EU-GDPR', 'US-HIPAA', 'US-FINRA', 'other'])
      .optional(),
    complianceNotes: z.string().optional(),
    pastCampaignRefs: z.array(z.object({}).passthrough()).optional(),
  }),
});

export const autofillSchema = z.object({
  body: z.object({
    websiteUrl: z.string().url('websiteUrl must be a valid URL'),
  }),
});
