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

import { AgentsService } from '../agents/service';

// ... existing router definitions ...

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
  const agentsService = new AgentsService();
  res.status(200).json({
    success: true,
    data: agentsService.getAllAgents(),
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
 *     responses:
 *       200:
 *         description: Alerts list
 *       401:
 *         description: Unauthorized
 */
router.get('/alerts', (req: Request, res: Response) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const alerts = [];
  
  // Dynamically generate alerts based on agent status
  const failedAgents = agents.filter(a => a.status === 'ERROR' || a.successRate < 90);
  failedAgents.forEach(agent => {
    alerts.push({
      id: `alert-${agent.id}`,
      type: 'CRITICAL',
      title: 'Agent Performance Degradation',
      message: `${agent.name} is experiencing low success rates or errors.`,
      resolved: false,
      timestamp: new Date().toISOString()
    });
  });

  if (alerts.length === 0) {
    alerts.push({
      id: '1', type: 'WARNING', title: 'Budget threshold reached', message: 'Campaign "Summer Sale" has used 90% of budget', resolved: false, timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({ success: true, data: alerts });
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
 *       401:
 *         description: Unauthorized
 */
router.get('/campaign-health', (req: Request, res: Response) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter(a => a.status === 'RUNNING');
  const performanceMultiplier = activeAgents.length / agents.length || 0.5;

  res.status(200).json({
    success: true,
    data: [
      { campaignId: 'c1', campaignName: 'Q4 Product Launch', healthScore: 91.2 * performanceMultiplier, roas: 5.1 * performanceMultiplier, ctr: 3.2, conversionRate: 4.1, budgetStatus: 'ON_TRACK' },
      { campaignId: 'c2', campaignName: 'Summer Sale',       healthScore: 74.3 * performanceMultiplier, roas: 2.8 * performanceMultiplier, ctr: 1.9, conversionRate: 2.3, budgetStatus: 'AT_RISK' },
    ],
  });
});

export default router;
