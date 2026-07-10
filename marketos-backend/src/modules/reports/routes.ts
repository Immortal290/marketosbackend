import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /reports/scheduled:
 *   get:
 *     summary: List scheduled reports
 *     description: Returns all scheduled recurring reports configured for the workspace.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Scheduled reports list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Report' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/scheduled', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /reports/scheduled:
 *   post:
 *     summary: Create a scheduled report
 *     description: Schedules a recurring report to be generated and distributed on a defined cadence.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, format, schedule, recipients, workspaceId]
 *             properties:
 *               name:        { type: string, example: "Weekly Executive Report" }
 *               type:        { type: string, enum: [CAMPAIGN, ANALYTICS, FINANCE, AUDIENCE] }
 *               format:      { type: string, enum: [PDF, CSV, EXCEL] }
 *               workspaceId: { type: string, format: uuid }
 *               schedule:    { type: string, description: "Cron expression", example: "0 9 * * MON" }
 *               recipients:  { type: array, items: { type: string, format: email } }
 *     responses:
 *       201:
 *         description: Scheduled report created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Report' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/scheduled', (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: 'new-uuid', ...req.body, status: 'PENDING', createdAt: new Date().toISOString() } });
});

/**
 * @openapi
 * /reports/custom:
 *   post:
 *     summary: Generate a custom on-demand report
 *     description: Generates a one-time custom report based on specified metrics, date range, and filters.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, metrics, dateRange, workspaceId, format]
 *             properties:
 *               name:        { type: string, example: "Q4 Campaign Performance" }
 *               workspaceId: { type: string, format: uuid }
 *               format:      { type: string, enum: [PDF, CSV, EXCEL, JSON] }
 *               metrics:     { type: array, items: { type: string }, example: ["revenue", "roas", "ctr"] }
 *               dateRange:   { type: object, properties: { from: { type: string, format: date }, to: { type: string, format: date } } }
 *               filters:     { type: object, description: "Optional filters e.g. campaignId, channelType" }
 *     responses:
 *       200:
 *         description: Report generation started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:    { type: string, format: uuid }
 *                     status:      { type: string, enum: [GENERATING] }
 *                     estimatedMs: { type: integer, example: 15000 }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/custom', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { reportId: 'rpt-uuid', status: 'GENERATING', estimatedMs: 15000 } });
});

import { AgentsService } from '../agents/service';
const agentsService = new AgentsService();

// ... existing code until executive reports ...

/**
 * @openapi
 * /reports/executive:
 *   get:
 *     summary: Get pre-built executive reports
 *     description: Returns the list of available pre-built executive-level report templates and recently generated copies.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Executive reports list
 *       401:
 *         description: Unauthorized
 */
router.get('/executive', (req: Request, res: Response) => {
  const agents = agentsService.getAllAgents();
  const reportingAgent = agents.find(a => a.type === 'REPORTING');
  
  const isAgentActive = reportingAgent && reportingAgent.status === 'RUNNING';
  const reportStatus = isAgentActive ? 'READY' : 'GENERATING';

  res.status(200).json({ success: true, data: [
    { id: 'r1', name: 'Monthly Revenue Summary', type: 'EXECUTIVE', format: 'PDF', status: reportStatus, downloadUrl: 'https://example.com/reports/r1.pdf', createdAt: new Date().toISOString() },
    { id: 'r2', name: 'AI Agent Performance ROI', type: 'ANALYTICS', format: 'EXCEL', status: reportStatus, downloadUrl: 'https://example.com/reports/r2.xlsx', createdAt: new Date().toISOString() },
  ]});
});

/**
 * @openapi
 * /reports/{id}/download:
 *   get:
 *     summary: Download a generated report
 *     description: Returns a signed download URL for a completed report.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Download URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     downloadUrl: { type: string, format: uri }
 *                     expiresAt:   { type: string, format: date-time }
 *       404:
 *         description: Report not found or not ready
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/download', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { downloadUrl: `https://example.com/reports/${req.params.id}.pdf`, expiresAt: new Date(Date.now() + 3600000).toISOString() } });
});

/**
 * @openapi
 * /reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Report deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

export default router;
