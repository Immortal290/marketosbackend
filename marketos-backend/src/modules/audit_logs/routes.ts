import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /audit-logs/activity:
 *   get:
 *     summary: Get user activity logs
 *     description: Returns paginated user activity logs — login events, resource creates/updates/deletes, and setting changes.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: userId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: action
 *         in: query
 *         required: false
 *         schema: { type: string, example: "campaign.create" }
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
 *         description: Activity log entries
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
 *                       userId:     { type: string, format: uuid }
 *                       userEmail:  { type: string, format: email }
 *                       action:     { type: string, example: "campaign.create" }
 *                       resource:   { type: string, example: "campaigns/abc-123" }
 *                       ipAddress:  { type: string, example: "192.168.1.1" }
 *                       timestamp:  { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/activity', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audit-logs/agents:
 *   get:
 *     summary: Get agent action logs
 *     description: Returns all actions taken by AI agents — task executions, decisions, errors, and outputs.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: agentType
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [SUPERVISOR, COPY, CREATIVE, ANALYTICS, COMPLIANCE, EMAIL, SMS, SOCIAL, SEO, COMPETITOR, FINANCE] }
 *       - name: outcome
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [SUCCESS, FAILED, PARTIAL] }
 *     responses:
 *       200:
 *         description: Agent log entries
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
 *                       agentType:  { type: string }
 *                       action:     { type: string }
 *                       input:      { type: object }
 *                       output:     { type: object }
 *                       outcome:    { type: string, enum: [SUCCESS, FAILED, PARTIAL] }
 *                       durationMs: { type: integer }
 *                       tokenUsage: { type: integer }
 *                       timestamp:  { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/agents', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audit-logs/api:
 *   get:
 *     summary: Get API request logs
 *     description: Returns raw API access logs — endpoint, method, status code, response time, and requester identity.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: method
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [GET, POST, PATCH, DELETE] }
 *       - name: statusCode
 *         in: query
 *         required: false
 *         schema: { type: integer, example: 500 }
 *       - name: endpoint
 *         in: query
 *         required: false
 *         schema: { type: string, example: "/campaigns" }
 *     responses:
 *       200:
 *         description: API log entries
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
 *                       method:      { type: string }
 *                       endpoint:    { type: string }
 *                       statusCode:  { type: integer }
 *                       responseMs:  { type: integer }
 *                       ipAddress:   { type: string }
 *                       userId:      { type: string, format: uuid }
 *                       timestamp:   { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/api', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audit-logs/compliance:
 *   get:
 *     summary: Get compliance event logs
 *     description: Returns compliance-specific events — consent collection, data deletion requests, suppression list changes, and GDPR/CAN-SPAM violations.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: eventType
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [CONSENT_COLLECTED, DATA_DELETED, SUPPRESSED, VIOLATION_FLAGGED, OPT_OUT] }
 *       - name: severity
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [INFO, WARNING, CRITICAL] }
 *     responses:
 *       200:
 *         description: Compliance log entries
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
 *                       id:        { type: string, format: uuid }
 *                       eventType: { type: string }
 *                       severity:  { type: string }
 *                       contactId: { type: string, format: uuid }
 *                       details:   { type: object }
 *                       timestamp: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/compliance', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audit-logs/events:
 *   get:
 *     summary: Get live event stream
 *     description: Returns a real-time paginated stream of all system events in reverse chronological order. Use with polling or WebSocket for live updates.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/limit'
 *       - name: since
 *         in: query
 *         required: false
 *         description: Only return events after this timestamp (ISO 8601)
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Event stream
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ActivityEvent' }
 *                 lastEventAt: { type: string, format: date-time }
 */
router.get('/events', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], lastEventAt: new Date().toISOString() });
});

export default router;
