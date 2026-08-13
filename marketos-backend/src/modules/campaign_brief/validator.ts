import { z } from 'zod';

export const createCampaignBriefSchema = z.object({
  body: z.object({
    workspaceId: z.string().uuid('workspaceId must be a valid UUID'),
    brandProfileId: z.string().uuid('brandProfileId must be a valid UUID'),
    goal: z.enum(['awareness', 'leads', 'sales', 'retention'], {
      errorMap: () => ({
        message: 'goal must be one of: awareness, leads, sales, retention',
      }),
    }),
    channels: z
      .array(z.enum(['email', 'sms', 'voice', 'whatsapp', 'social']))
      .min(1, 'At least one channel is required'),
    budget: z.number().positive().optional(),
    timelineStart: z.string().datetime({ offset: true }).optional(),
    timelineEnd: z.string().datetime({ offset: true }).optional(),
    keyMessage: z.string().min(1).optional(),
    offerDetails: z.string().optional(),
    kpiTarget: z.string().optional(),
    freeTextContext: z.string().optional(),
    rawPromptFallback: z.string().optional(),
    // Optional send context
    recipientEmail: z.string().email().optional(),
    recipientPhone: z.string().optional(),
    senderName: z.string().optional(),
    companyName: z.string().optional(),
    companyAddress: z.string().optional(),
    unsubscribeUrl: z.string().url().optional(),
  }),
});
