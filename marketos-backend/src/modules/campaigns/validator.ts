import { z } from 'zod';

export const createCampaignSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    workspaceId: z.string().uuid(),
  }),
});

export const updateCampaignSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  }),
});
