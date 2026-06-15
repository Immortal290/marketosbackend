import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /campaign-detail/{campaignId}/overview:
 *   get:
 *     summary: Get campaign overview
 *     description: Returns the campaign summary, goal progress, timeline, budget overview, and health score.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaign: { $ref: '#/components/schemas/Campaign' }
 *                     goalProgress:
 *                       type: object
 *                       properties:
 *                         target:  { type: number, example: 1000 }
 *                         current: { type: number, example: 642 }
 *                         pct:     { type: number, example: 64.2 }
 *                     timeline:
 *                       type: object
 *                       properties:
 *                         startDate: { type: string, format: date-time }
 *                         endDate:   { type: string, format: date-time }
 *                         daysLeft:  { type: integer, example: 14 }
 *                     budget:
 *                       type: object
 *                       properties:
 *                         total:     { type: number, example: 50000 }
 *                         spent:     { type: number, example: 23400 }
 *                         remaining: { type: number, example: 26600 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/overview', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      campaign: { id: req.params.campaignId, name: 'Q4 Product Launch', status: 'ACTIVE', healthScore: 87.5 },
      goalProgress: { target: 1000, current: 642, pct: 64.2 },
      timeline: { startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', daysLeft: 14 },
      budget: { total: 50000, spent: 23400, remaining: 26600 },
    },
  });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/audience:
 *   get:
 *     summary: Get campaign audience breakdown
 *     description: Returns audience overview, segment distribution, geographic distribution, lifecycle stage distribution, and suppression analysis.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Audience breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:            { type: integer, example: 48200 }
 *                     reachable:        { type: integer, example: 44100 }
 *                     suppressed:       { type: integer, example: 4100 }
 *                     segments:         { type: array, items: { $ref: '#/components/schemas/Segment' } }
 *                     geoDistribution:  { type: object }
 *                     lifecycleBreakdown: { type: object }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/audience', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { total: 48200, reachable: 44100, suppressed: 4100, segments: [] } });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/assets:
 *   get:
 *     summary: Get campaign assets
 *     description: Returns all creative assets for the campaign including emails, SMS content, social posts, landing pages, and version history.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [EMAIL, SMS, SOCIAL, LANDING_PAGE]
 *     responses:
 *       200:
 *         description: Campaign assets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Asset' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/assets', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/channels:
 *   get:
 *     summary: Get channel performance breakdown
 *     description: Returns performance metrics for each active channel — email, SMS, social, and paid ads.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Channel performance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: object
 *                       properties:
 *                         sent:          { type: integer, example: 24000 }
 *                         openRate:      { type: number, example: 28.4 }
 *                         clickRate:     { type: number, example: 4.2 }
 *                         unsubRate:     { type: number, example: 0.3 }
 *                         revenue:       { type: number, example: 48200 }
 *                     sms:
 *                       type: object
 *                       properties:
 *                         sent:          { type: integer, example: 8000 }
 *                         deliveryRate:  { type: number, example: 97.8 }
 *                         clickRate:     { type: number, example: 6.1 }
 *                     social:
 *                       type: object
 *                       properties:
 *                         impressions:   { type: integer, example: 420000 }
 *                         engagement:    { type: number, example: 3.7 }
 *                         clicks:        { type: integer, example: 15540 }
 *                     paidAds:
 *                       type: object
 *                       properties:
 *                         impressions:   { type: integer, example: 1200000 }
 *                         cpc:           { type: number, example: 1.24 }
 *                         roas:          { type: number, example: 4.8 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/channels', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      email: { sent: 24000, openRate: 28.4, clickRate: 4.2, unsubRate: 0.3, revenue: 48200 },
      sms: { sent: 8000, deliveryRate: 97.8, clickRate: 6.1 },
      social: { impressions: 420000, engagement: 3.7, clicks: 15540 },
      paidAds: { impressions: 1200000, cpc: 1.24, roas: 4.8 },
    },
  });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/timeline:
 *   get:
 *     summary: Get campaign timeline events
 *     description: Returns key milestone events — creation, approval, launch, optimization actions, and completion.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *     responses:
 *       200:
 *         description: Campaign timeline
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
 *                       stage:     { type: string, enum: [CREATION, APPROVAL, LAUNCH, OPTIMIZATION, COMPLETION] }
 *                       timestamp: { type: string, format: date-time }
 *                       actor:     { type: string, example: "CopyAgent" }
 *                       note:      { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/timeline', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { stage: 'CREATION', timestamp: '2026-10-01T10:00:00Z', actor: 'John Doe', note: 'Campaign created' },
    { stage: 'LAUNCH',   timestamp: '2026-10-05T09:00:00Z', actor: 'SupervisorAgent', note: 'Campaign launched' },
  ]});
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/ab-tests:
 *   get:
 *     summary: Get A/B test results
 *     description: Returns all A/B tests for the campaign including variant comparison, statistical confidence, winner selection, and historical tests.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *     responses:
 *       200:
 *         description: A/B test data
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
 *                       id:         { type: string, format: uuid }
 *                       name:       { type: string, example: "Subject Line Test" }
 *                       status:     { type: string, enum: [RUNNING, CONCLUDED] }
 *                       winner:     { type: string, example: "variant_b" }
 *                       confidence: { type: number, example: 95.4 }
 *                       variants:   { type: array, items: { type: object } }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/ab-tests', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/analytics:
 *   get:
 *     summary: Get campaign analytics
 *     description: Returns the KPI dashboard, funnel analysis, attribution analysis, trend analysis, heatmaps, and cohort data for this campaign.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - name: view
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [KPI, FUNNEL, ATTRIBUTION, TRENDS, HEATMAP, COHORTS]
 *           default: KPI
 *     responses:
 *       200:
 *         description: Campaign analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/analytics', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { impressions: 1640000, clicks: 42300, leads: 2810, mqls: 410, revenue: 96400 } });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/finance:
 *   get:
 *     summary: Get campaign financial summary
 *     description: Returns budget allocation, spend breakdown, revenue attribution, ROI and forecasts for the campaign.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *     responses:
 *       200:
 *         description: Campaign financial data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     budget:          { type: number, example: 50000 }
 *                     spend:           { type: number, example: 23400 }
 *                     revenue:         { type: number, example: 96400 }
 *                     roi:             { type: number, example: 3.12 }
 *                     roas:            { type: number, example: 4.12 }
 *                     projectedRevenue: { type: number, example: 190000 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/finance', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { budget: 50000, spend: 23400, revenue: 96400, roi: 3.12, roas: 4.12, projectedRevenue: 190000 } });
});

/**
 * @openapi
 * /campaign-detail/{campaignId}/activity-log:
 *   get:
 *     summary: Get campaign activity log
 *     description: Returns all campaign events, agent actions, user actions, and compliance events for this campaign.
 *     tags: [Campaign Detail]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/campaignId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [CAMPAIGN_EVENT, AGENT_ACTION, USER_ACTION, COMPLIANCE_EVENT]
 *     responses:
 *       200:
 *         description: Activity log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ActivityEvent' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:campaignId/activity-log', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

export default router;
