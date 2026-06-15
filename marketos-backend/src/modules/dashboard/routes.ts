import { Router, Request, Response } from 'express';
import { DashboardController } from './controller';

const router = Router();
const controller = new DashboardController();

/**
 * @openapi
 * /dashboard/kpis:
 *   get:
 *     summary: Get executive KPI grid
 *     description: Returns the full executive KPI grid — revenue, pipeline, leads, MQLs, SQLs, ROAS, and more.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         description: Date range for KPI calculation
 *         schema:
 *           type: string
 *           enum: [TODAY, LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS, CUSTOM]
 *           default: LAST_30_DAYS
 *     responses:
 *       200:
 *         description: Executive KPI grid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/KpiGrid' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/kpis', controller.getKpis);

/**
 * @openapi
 * /dashboard/activity:
 *   get:
 *     summary: Get live activity feed
 *     description: Returns a chronological stream of agent events, campaign events, compliance events and system events.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/limit'
 *       - name: type
 *         in: query
 *         required: false
 *         description: Filter by event type
 *         schema:
 *           type: string
 *           enum: [AGENT_EVENT, CAMPAIGN_EVENT, COMPLIANCE_EVENT, SYSTEM_EVENT]
 *     responses:
 *       200:
 *         description: Activity feed events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ActivityEvent' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/activity', controller.getActivityFeed);

/**
 * @openapi
 * /dashboard/agents:
 *   get:
 *     summary: Get agent status grid
 *     description: Returns live status of all AI agents including current task, queue length, success rate, token usage and cost.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Agent status grid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Agent' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/agents', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { id: '1', name: 'SupervisorAgent', type: 'SUPERVISOR', status: 'RUNNING', currentTask: 'Orchestrating Q4 campaign', queueLength: 5, successRate: 99.1, tokenUsage: 14200, costUsd: 0.28 },
      { id: '2', name: 'CopyAgent',       type: 'COPY',       status: 'RUNNING', currentTask: 'Generating email subject lines', queueLength: 2, successRate: 97.4, tokenUsage: 8400, costUsd: 0.17 },
      { id: '3', name: 'AnalyticsAgent',  type: 'ANALYTICS',  status: 'IDLE',    currentTask: null, queueLength: 0, successRate: 98.8, tokenUsage: 6200, costUsd: 0.12 },
    ],
  });
});

/**
 * @openapi
 * /dashboard/alerts:
 *   get:
 *     summary: Get alerts center
 *     description: Returns critical, warning, campaign and infrastructure alerts for the workspace.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         description: Filter alerts by type
 *         schema:
 *           type: string
 *           enum: [CRITICAL, WARNING, CAMPAIGN, INFRASTRUCTURE]
 *       - name: resolved
 *         in: query
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Alerts list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AlertItem' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/alerts', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { id: '1', type: 'WARNING', title: 'Budget threshold reached', message: 'Campaign "Summer Sale" has used 90% of budget', resolved: false, timestamp: new Date().toISOString() },
      { id: '2', type: 'CRITICAL', title: 'Agent failure', message: 'EmailAgent failed to send batch — retrying', resolved: false, timestamp: new Date().toISOString() },
    ],
  });
});

/**
 * @openapi
 * /dashboard/campaign-health:
 *   get:
 *     summary: Get campaign health matrix
 *     description: Returns the campaign health matrix with health scores, ROAS, CTR, conversion rates and budget status for all active campaigns.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign health matrix
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       campaignId:      { type: string, format: uuid }
 *                       campaignName:    { type: string }
 *                       healthScore:     { type: number, example: 87.5 }
 *                       roas:            { type: number, example: 4.2 }
 *                       ctr:             { type: number, example: 2.34 }
 *                       conversionRate:  { type: number, example: 3.1 }
 *                       budgetStatus:    { type: string, enum: [ON_TRACK, AT_RISK, OVERSPENT] }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/campaign-health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { campaignId: 'c1', campaignName: 'Q4 Product Launch', healthScore: 91.2, roas: 5.1, ctr: 3.2, conversionRate: 4.1, budgetStatus: 'ON_TRACK' },
      { campaignId: 'c2', campaignName: 'Summer Sale',       healthScore: 74.3, roas: 2.8, ctr: 1.9, conversionRate: 2.3, budgetStatus: 'AT_RISK' },
    ],
  });
});

export default router;
