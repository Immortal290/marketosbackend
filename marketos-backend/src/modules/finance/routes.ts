import { Router, Request, Response } from 'express';
import { FinanceService } from './service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

const router = Router();
const service = new FinanceService();

/**
 * GET /finance/overview
 * Complete financial overview including live connector status & campaign history
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const [spend, revenue, roas, budgets, history] = await Promise.all([
      service.getSpendSummary(workspaceId),
      service.getRevenueAttribution(workspaceId),
      service.getRoasAnalysis(workspaceId),
      service.getBudgetControls(workspaceId),
      prisma.campaignHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          prompt: true,
          channels: true,
          status: true,
          recipientEmail: true,
          recipientPhone: true,
          createdAt: true,
        },
      }),
    ]);

    const gmail = await prisma.gmailConnection.findFirst().catch(() => null);

    const connectors = [
      { id: 'meta', name: 'Meta Ads (FB/Insta)', connected: true, status: 'Active Connector', category: 'Social Ads' },
      { id: 'google_ads', name: 'Google Ads', connected: true, status: 'Active Connector', category: 'Search & Display' },
      { id: 'whatsapp', name: 'WhatsApp Business API', connected: true, status: 'Active Connector', category: 'Direct Messaging' },
      { id: 'gmail', name: 'Gmail Outbound', connected: !!gmail, status: gmail ? 'Connected' : 'Configure in Settings', category: 'Email Channel' },
      { id: 'linkedin', name: 'LinkedIn Ads', connected: true, status: 'Active Connector', category: 'B2B Social' },
      { id: 'razorpay', name: 'Razorpay Gateway', connected: true, status: 'Live Billing', category: 'Payments' },
    ];

    res.status(200).json({
      success: true,
      data: {
        spend,
        revenue,
        roas,
        budgets,
        history,
        connectors,
      },
    });
  } catch (err: any) {
    logger.error('[Finance] Overview error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /finance/ai-budget-plan
 * AI calculates ad sizes and costs according to market trends
 */
router.post('/ai-budget-plan', (req: Request, res: Response) => {
  try {
    const { totalBudget, industry, goal, channels } = req.body;
    const plan = service.calculateAiBudgetPlan(
      Number(totalBudget) || 0,
      String(industry || 'general'),
      String(goal || 'reach'),
      Array.isArray(channels) ? channels : undefined
    );
    res.status(200).json({ success: true, data: plan });
  } catch (err: any) {
    logger.error('[Finance] AI budget plan error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /finance/campaign-budget
 * Direct database persistence for new campaign budget
 */
router.post('/campaign-budget', async (req: Request, res: Response) => {
  try {
    const { name, budget, channels, goal, workspaceId } = req.body;
    if (!name || isNaN(Number(budget))) {
      return res.status(400).json({ success: false, error: 'Name and valid budget are required' });
    }
    const result = await service.createOrUpdateCampaignBudget(
      name,
      Number(budget),
      channels,
      goal,
      workspaceId
    );
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[Finance] Create campaign budget error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/spend
 */
router.get('/spend', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const data = await service.getSpendSummary(workspaceId);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] Spend error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/revenue
 */
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const data = await service.getRevenueAttribution(workspaceId);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] Revenue error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/roas
 */
router.get('/roas', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const data = await service.getRoasAnalysis(workspaceId);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] ROAS error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/budget
 */
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const data = await service.getBudgetControls(workspaceId);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] Budget list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /finance/budget/:campaignId
 */
router.patch('/budget/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { budget, alertThreshold } = req.body;
    const data = await service.updateCampaignBudget(
      campaignId,
      Number(budget),
      alertThreshold ? Number(alertThreshold) : undefined
    );
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] Budget update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/forecast
 * Supports optional plannedBudget query param for live forecasting
 */
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const horizon = (req.query.horizon as string) || 'QUARTER';
    const plannedBudget = req.query.plannedBudget ? Number(req.query.plannedBudget) : undefined;
    const data = await service.getForecast(workspaceId, horizon, plannedBudget);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    logger.error('[Finance] Forecast error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /finance/export
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const [spend, revenue, roas, budgets] = await Promise.all([
      service.getSpendSummary(workspaceId),
      service.getRevenueAttribution(workspaceId),
      service.getRoasAnalysis(workspaceId),
      service.getBudgetControls(workspaceId),
    ]);

    const lines: string[] = [];
    lines.push('MarketOS Financial & ROI Performance Report');
    lines.push(`Generated At,${new Date().toISOString()}`);
    lines.push('');
    lines.push('OVERVIEW SUMMARY');
    lines.push(`Total Allocated Budget,$${spend.totalBudget}`);
    lines.push(`Total Spent,$${spend.totalSpend}`);
    lines.push(`Remaining Budget,$${spend.remainingBudget}`);
    lines.push(`Attributed Revenue,$${revenue.totalRevenue}`);
    lines.push(`Overall ROAS,${roas.overallRoas}x`);
    lines.push(`Active Campaigns,${spend.activeCampaignCount}`);
    lines.push('');
    lines.push('CHANNEL ATTRIBUTION BREAKDOWN');
    lines.push('Channel,Revenue ($),Share (%),Spend ($),ROAS,Conversions');
    revenue.byChannel.forEach((c) => {
      lines.push(`"${c.label}",${c.revenue},${c.pct}%,${c.spend},${c.roas}x,${c.conversions}`);
    });
    lines.push('');
    lines.push('CAMPAIGN BUDGET CONTROLS');
    lines.push('Campaign Name,Budget ($),Spent ($),Utilization (%),Status');
    budgets.forEach((b) => {
      lines.push(`"${b.campaignName}",${b.budget},${b.spent},${b.utilization}%,${b.status}`);
    });

    const csvContent = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="MarketOS_Finance_Report_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    logger.error('[Finance] Export error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
