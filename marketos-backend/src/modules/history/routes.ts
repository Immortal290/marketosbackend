import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

const router = Router();

// Helper: extract userId from request (auth middleware or fallback to first user)
async function getUserId(req: Request): Promise<string | null> {
  const userId = (req as any).user?.userId;
  if (userId) return userId;
  // Fallback for unauthenticated dev mode — use first user
  const user = await prisma.user.findFirst().catch(() => null);
  return user?.id ?? null;
}

// ── GET /history — List all saved campaign runs for the user ─────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const page  = parseInt(String(req.query.page  || '1'));
    const limit = parseInt(String(req.query.limit || '20'));
    const skip  = (page - 1) * limit;
    const search = String(req.query.search || '');

    const where = {
      userId,
      ...(search ? { prompt: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.campaignHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.campaignHistory.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    logger.error('[History] List error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /history/:id — Get a single saved run with full agent outputs ─────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    const item = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId: userId! },
    });
    if (!item) {
      return res.status(404).json({ success: false, error: 'History item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /history — Save a completed campaign run to history ─────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const {
      prompt,
      agentOutputs,
      documentation,
      channels = [],
      runId,
      recipientEmail,
      recipientPhone,
      status = 'completed',
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    const item = await prisma.campaignHistory.create({
      data: {
        userId,
        runId: runId || null,
        prompt,
        agentOutputs: agentOutputs || {},
        documentation: documentation || null,
        channels: Array.isArray(channels) ? channels : [],
        recipientEmail: recipientEmail || null,
        recipientPhone: recipientPhone || null,
        status,
        dispatchLog: [],
      },
    });

    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    logger.error('[History] Save error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /history/:id — Archive/delete a saved run ─────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    const existing = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId: userId! },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'History item not found' });
    }
    await prisma.campaignHistory.update({
      where: { id: req.params.id },
      data: { status: 'archived' },
    });
    res.status(200).json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /history/:id/dispatch — Send agent outputs to real channels ──────────
// This is the "connector" action: takes the saved agent email/sms/social outputs
// and fires them via the real send APIs (email via Python agents, etc.)
router.post('/:id/dispatch', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    const item = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId: userId! },
    });
    if (!item) {
      return res.status(404).json({ success: false, error: 'History item not found' });
    }

    const {
      channels = item.channels,
      recipientEmail = item.recipientEmail,
      recipientPhone = item.recipientPhone,
      customMessage,
    } = req.body;

    // Extract agent outputs
    const outputs = item.agentOutputs as Record<string, any>;
    const dispatchLog: any[] = Array.isArray(item.dispatchLog) ? item.dispatchLog as any[] : [];

    const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://marketos_agents:8000';

    for (const channel of channels) {
      const sentAt = new Date().toISOString();
      let status = 'failed';
      let messageId = '';
      let detail = '';

      try {
        if (channel === 'email' && (outputs.email || outputs.Email || outputs['Email Agent'])) {
          // Send email via Python agent
          const emailOutput = outputs.email || outputs.Email || outputs['Email Agent'] || {};
          const emailBody = emailOutput?.email_draft_1 || emailOutput;
          const payload = {
            user_intent: `Dispatch saved campaign: ${item.prompt}`,
            channels: ['email'],
            recipient_email: recipientEmail,
            sender_name: emailBody?.sender_name || 'MarketOS',
          };
          const agentResp = await fetch(`${agentServiceUrl}/v1/pipeline/campaign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => null);
          status = agentResp?.ok ? 'sent' : 'failed';
          messageId = `email-${Date.now()}`;
          detail = agentResp?.ok ? 'Email dispatched via agent service' : 'Agent service unavailable';
        } else if (channel === 'sms' && (outputs.sms || outputs.SMS || outputs['SMS Agent'])) {
          const smsOutput = outputs.sms || outputs.SMS || outputs['SMS Agent'] || {};
          const message = customMessage || smsOutput?.selected_message || smsOutput?.variants?.[0]?.message || '';
          const payload = {
            user_intent: `Send SMS: ${message}`,
            channels: ['sms'],
            recipient_phone: recipientPhone,
          };
          const agentResp = await fetch(`${agentServiceUrl}/v1/pipeline/campaign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => null);
          status = agentResp?.ok ? 'sent' : 'failed';
          messageId = `sms-${Date.now()}`;
          detail = agentResp?.ok ? 'SMS dispatched via agent service' : 'Agent service unavailable';
        } else if (channel === 'social') {
          // Social posts are logged as scheduled (no direct send API here)
          status = 'scheduled';
          messageId = `social-${Date.now()}`;
          detail = 'Social post queued for publishing';
        } else {
          status = 'skipped';
          detail = `No output available for channel: ${channel}`;
        }
      } catch (dispatchErr: any) {
        detail = dispatchErr.message;
      }

      dispatchLog.push({ channel, status, sentAt, messageId, detail });
    }

    const updated = await prisma.campaignHistory.update({
      where: { id: item.id },
      data: {
        status: 'dispatched',
        dispatchLog,
      },
    });

    res.status(200).json({
      success: true,
      data: { dispatchLog, status: 'dispatched', id: updated.id },
    });
  } catch (err: any) {
    logger.error('[History] Dispatch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
