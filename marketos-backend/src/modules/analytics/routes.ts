import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /analytics/executive:
 *   get:
 *     summary: Executive analytics dashboard
 *     description: Returns top-level revenue, pipeline, CAC, LTV, ROAS, and conversion rate metrics.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS, LAST_YEAR, CUSTOM]
 *           default: LAST_30_DAYS
 *       - name: from
 *         in: query
 *         required: false
 *         description: ISO 8601 start date (required if dateRange=CUSTOM)
 *         schema: { type: string, format: date }
 *       - name: to
 *         in: query
 *         required: false
 *         description: ISO 8601 end date (required if dateRange=CUSTOM)
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Executive analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     revenue:        { type: number, example: 1240000 }
 *                     pipeline:       { type: number, example: 5600000 }
 *                     cac:            { type: number, example: 124.50 }
 *                     ltv:            { type: number, example: 4800 }
 *                     roas:           { type: number, example: 4.2 }
 *                     conversionRate: { type: number, example: 3.47 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/executive', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { revenue: 1240000, pipeline: 5600000, cac: 124.5, ltv: 4800, roas: 4.2, conversionRate: 3.47 } });
});

/**
 * @openapi
 * /analytics/attribution:
 *   get:
 *     summary: Get attribution analytics
 *     description: Returns first-touch, last-touch, multi-touch, and data-driven attribution model results.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: model
 *         in: query
 *         required: false
 *         description: Attribution model to use
 *         schema:
 *           type: string
 *           enum: [FIRST_TOUCH, LAST_TOUCH, MULTI_TOUCH, DATA_DRIVEN]
 *           default: MULTI_TOUCH
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_30_DAYS, LAST_90_DAYS, LAST_YEAR], default: LAST_30_DAYS }
 *     responses:
 *       200:
 *         description: Attribution data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     model: { type: string, example: "MULTI_TOUCH" }
 *                     channels:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           channel:     { type: string, example: "EMAIL" }
 *                           contribution: { type: number, example: 34.2 }
 *                           revenue:     { type: number, example: 424080 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/attribution', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      model: 'MULTI_TOUCH',
      channels: [
        { channel: 'EMAIL',    contribution: 34.2, revenue: 424080 },
        { channel: 'PAID_ADS', contribution: 28.7, revenue: 355880 },
        { channel: 'SOCIAL',   contribution: 22.1, revenue: 274040 },
        { channel: 'SMS',      contribution: 15.0, revenue: 186000 },
      ],
    },
  });
});

/**
 * @openapi
 * /analytics/channels:
 *   get:
 *     summary: Channel-level analytics
 *     description: Returns performance metrics broken down by channel — email, SMS, social, and paid ads.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: channel
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [EMAIL, SMS, SOCIAL, PAID_ADS] }
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS], default: LAST_30_DAYS }
 *     responses:
 *       200:
 *         description: Channel analytics
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
router.get('/channels', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { email: {}, sms: {}, social: {}, paidAds: {} } });
});

/**
 * @openapi
 * /analytics/funnel:
 *   get:
 *     summary: Get funnel analytics
 *     description: Returns conversion funnel data across all stages — Impression → Click → Visit → Lead → MQL → SQL → Customer.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS], default: LAST_30_DAYS }
 *       - name: campaignId
 *         in: query
 *         required: false
 *         description: Filter funnel by specific campaign
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Funnel data
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
 *                       stage:       { type: string, enum: [IMPRESSION, CLICK, VISIT, LEAD, MQL, SQL, CUSTOMER] }
 *                       count:       { type: integer }
 *                       convRate:    { type: number }
 *                       dropoffRate: { type: number }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/funnel', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { stage: 'IMPRESSION', count: 1640000, convRate: 100,  dropoffRate: 0 },
      { stage: 'CLICK',      count: 42300,   convRate: 2.58, dropoffRate: 97.42 },
      { stage: 'VISIT',      count: 38100,   convRate: 90.1, dropoffRate: 9.9 },
      { stage: 'LEAD',       count: 12400,   convRate: 32.5, dropoffRate: 67.5 },
      { stage: 'MQL',        count: 1870,    convRate: 15.1, dropoffRate: 84.9 },
      { stage: 'SQL',        count: 430,     convRate: 23.0, dropoffRate: 77.0 },
      { stage: 'CUSTOMER',   count: 186,     convRate: 43.3, dropoffRate: 56.7 },
    ],
  });
});

/**
 * @openapi
 * /analytics/journey:
 *   get:
 *     summary: Get customer journey analytics
 *     description: Returns customer path analysis — top conversion paths, touchpoint sequences, drop-off points, and conversion paths.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_30_DAYS, LAST_90_DAYS], default: LAST_30_DAYS }
 *     responses:
 *       200:
 *         description: Journey analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     topPaths:      { type: array, items: { type: object } }
 *                     touchpoints:   { type: array, items: { type: object } }
 *                     dropoffs:      { type: array, items: { type: object } }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/journey', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { topPaths: [], touchpoints: [], dropoffs: [] } });
});

/**
 * @openapi
 * /analytics/cohorts:
 *   get:
 *     summary: Get cohort analysis
 *     description: Returns retention, revenue, engagement, and conversion cohort analysis tables.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [RETENTION, REVENUE, ENGAGEMENT, CONVERSION]
 *           default: RETENTION
 *       - name: granularity
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [WEEKLY, MONTHLY]
 *           default: MONTHLY
 *     responses:
 *       200:
 *         description: Cohort data table
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     cohorts:  { type: array, items: { type: object } }
 *                     periods:  { type: array, items: { type: string } }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/cohorts', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { cohorts: [], periods: [] } });
});

/**
 * @openapi
 * /analytics/realtime:
 *   get:
 *     summary: Real-time analytics snapshot
 *     description: Returns the latest live metrics snapshot and any active anomaly alerts.
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Realtime snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:      { type: boolean }
 *                     latestSnapshot: { type: object }
 *                     anomalies:      { type: array, items: { type: object } }
 *                     lastUpdated:    { type: string, format: date-time }
 */
router.get('/realtime', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      connected: true,
      latestSnapshot: {
        revenue: 1240000,
        pipeline: 5600000,
        cac: 124.5,
        ltv: 4800,
        roas: 4.2,
        conversionRate: 3.47,
        _ts: new Date().toISOString(),
      },
      anomalies: [],
      lastUpdated: new Date().toISOString(),
    },
  });
});

export default router;

