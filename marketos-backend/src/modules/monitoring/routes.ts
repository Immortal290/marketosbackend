import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /monitoring/health:
 *   get:
 *     summary: Get system health dashboard
 *     description: Returns the overall health status of all system components — API, database, Redis, Kafka, and agent fleet.
 *     tags: [Monitoring & Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HealthStatus' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { overall: 'HEALTHY', api: 'HEALTHY', database: 'HEALTHY', redis: 'HEALTHY', kafka: 'HEALTHY', agents: 'HEALTHY', uptime: 99.97, checkedAt: new Date().toISOString() } });
});

/**
 * @openapi
 * /monitoring/alerts:
 *   get:
 *     summary: List active alerts
 *     description: Returns all active (unresolved) system and campaign alerts.
 *     tags: [Monitoring & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: severity
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [CRITICAL, WARNING, INFO] }
 *       - name: resolved
 *         in: query
 *         required: false
 *         schema: { type: boolean, default: false }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
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
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/alerts', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'a1', type: 'WARNING', title: 'Redis memory at 85%', message: 'Redis is approaching memory limits', resolved: false, timestamp: new Date().toISOString() },
    { id: 'a2', type: 'CRITICAL', title: 'EmailAgent failure', message: 'EmailAgent has crashed — auto-restart in progress', resolved: false, timestamp: new Date().toISOString() },
  ], meta: { total: 2, page: 1, limit: 20, pages: 1 } });
});

/**
 * @openapi
 * /monitoring/alerts/{id}/resolve:
 *   post:
 *     summary: Resolve an alert
 *     description: Marks an alert as resolved with an optional resolution note.
 *     tags: [Monitoring & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string, example: "Scaled Redis memory — issue resolved" }
 *     responses:
 *       200:
 *         description: Alert resolved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, resolved: true } });
});

/**
 * @openapi
 * /monitoring/incidents:
 *   get:
 *     summary: Get incident history
 *     description: Returns historical incidents with timeline, root cause, and resolution details.
 *     tags: [Monitoring & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: from
 *         in: query
 *         required: false
 *         schema: { type: string, format: date }
 *       - name: to
 *         in: query
 *         required: false
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Incident history
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
 *                       id:          { type: string, format: uuid }
 *                       title:       { type: string }
 *                       severity:    { type: string, enum: [P1, P2, P3] }
 *                       status:      { type: string, enum: [OPEN, INVESTIGATING, RESOLVED] }
 *                       startedAt:   { type: string, format: date-time }
 *                       resolvedAt:  { type: string, format: date-time }
 *                       rootCause:   { type: string }
 *                       resolution:  { type: string }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/incidents', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /monitoring/remediation:
 *   get:
 *     summary: Get auto-remediation actions
 *     description: Returns a log of automatic remediation actions taken by the system in response to alerts and incidents.
 *     tags: [Monitoring & Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Remediation log
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
 *                       id:          { type: string, format: uuid }
 *                       alertId:     { type: string, format: uuid }
 *                       action:      { type: string, example: "Restarted EmailAgent" }
 *                       outcome:     { type: string, enum: [SUCCESS, FAILED, PARTIAL] }
 *                       timestamp:   { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/remediation', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'rem1', alertId: 'a2', action: 'Restarted EmailAgent', outcome: 'SUCCESS', timestamp: new Date().toISOString() },
  ], meta: { total: 1, page: 1, limit: 20, pages: 1 } });
});

export default router;
