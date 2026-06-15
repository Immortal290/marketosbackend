import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /finance/spend:
 *   get:
 *     summary: Get spend dashboard
 *     description: Returns total budget, total spend, remaining budget, projected spend, and spend breakdown by channel and campaign.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER, THIS_YEAR], default: THIS_MONTH }
 *     responses:
 *       200:
 *         description: Spend dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/SpendSummary' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/spend', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { totalBudget: 500000, totalSpend: 214300, remainingBudget: 285700, projectedSpend: 490000, roas: 4.2, roi: 3.2 } });
});

/**
 * @openapi
 * /finance/revenue:
 *   get:
 *     summary: Get revenue attribution breakdown
 *     description: Returns revenue broken down by channel, campaign, and time period with attribution model applied.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS, THIS_YEAR], default: LAST_30_DAYS }
 *       - name: attributionModel
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [FIRST_TOUCH, LAST_TOUCH, MULTI_TOUCH, DATA_DRIVEN], default: MULTI_TOUCH }
 *     responses:
 *       200:
 *         description: Revenue attribution data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number, example: 1240000 }
 *                     byChannel:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           channel: { type: string }
 *                           revenue: { type: number }
 *                           pct:     { type: number }
 *                     byCampaign:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           campaignId:   { type: string }
 *                           campaignName: { type: string }
 *                           revenue:      { type: number }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/revenue', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      totalRevenue: 1240000,
      byChannel: [
        { channel: 'EMAIL',    revenue: 424080, pct: 34.2 },
        { channel: 'PAID_ADS', revenue: 355880, pct: 28.7 },
        { channel: 'SOCIAL',   revenue: 274040, pct: 22.1 },
        { channel: 'SMS',      revenue: 186000, pct: 15.0 },
      ],
      byCampaign: [],
    },
  });
});

/**
 * @openapi
 * /finance/roas:
 *   get:
 *     summary: Get ROAS analysis
 *     description: Returns Return on Ad Spend analysis by campaign, channel, and ad group with trend data.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: dateRange
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS], default: LAST_30_DAYS }
 *       - name: groupBy
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [CAMPAIGN, CHANNEL, AD_GROUP], default: CAMPAIGN }
 *     responses:
 *       200:
 *         description: ROAS analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallRoas: { type: number, example: 4.2 }
 *                     benchmark:   { type: number, example: 3.5, description: "Industry benchmark" }
 *                     breakdown:   { type: array, items: { type: object } }
 *                     trend:       { type: array, items: { type: object, properties: { date: { type: string }, roas: { type: number } } } }
 */
router.get('/roas', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { overallRoas: 4.2, benchmark: 3.5, breakdown: [], trend: [] } });
});

/**
 * @openapi
 * /finance/budget:
 *   get:
 *     summary: Get budget controls
 *     description: Returns budget allocations, utilization rates, and alert thresholds for all campaigns.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Budget controls data
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
 *                       campaignId:     { type: string, format: uuid }
 *                       campaignName:   { type: string }
 *                       budget:         { type: number }
 *                       spent:          { type: number }
 *                       utilization:    { type: number, description: "% of budget used" }
 *                       alertThreshold: { type: number, description: "Alert at this % utilization" }
 *                       status:         { type: string, enum: [ON_TRACK, AT_RISK, OVERSPENT] }
 */
router.get('/budget', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /finance/budget/{campaignId}:
 *   patch:
 *     summary: Update campaign budget
 *     description: Adjusts the budget allocation for a specific campaign.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: campaignId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [budget]
 *             properties:
 *               budget:         { type: number, example: 75000 }
 *               alertThreshold: { type: number, example: 80, description: "Alert at this % utilization" }
 *     responses:
 *       200:
 *         description: Budget updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.patch('/budget/:campaignId', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { campaignId: req.params.campaignId, ...req.body } });
});

/**
 * @openapi
 * /finance/forecast:
 *   get:
 *     summary: Get revenue and spend forecasts
 *     description: Returns AI-generated revenue and spend forecasts for the current and next quarter based on historical data and campaign pipeline.
 *     tags: [Finance & ROI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: horizon
 *         in: query
 *         required: false
 *         description: Forecasting horizon
 *         schema: { type: string, enum: [30_DAYS, 60_DAYS, 90_DAYS, QUARTER], default: QUARTER }
 *     responses:
 *       200:
 *         description: Forecast data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     projectedRevenue: { type: number, example: 1480000 }
 *                     projectedSpend:   { type: number, example: 490000 }
 *                     projectedRoas:    { type: number, example: 3.9 }
 *                     confidence:       { type: number, example: 0.84 }
 *                     timeline:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:     { type: string, format: date }
 *                           revenue:  { type: number }
 *                           spend:    { type: number }
 */
router.get('/forecast', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { projectedRevenue: 1480000, projectedSpend: 490000, projectedRoas: 3.9, confidence: 0.84, timeline: [] } });
});

export default router;
