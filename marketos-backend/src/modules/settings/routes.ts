import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /settings/workspace:
 *   get:
 *     summary: Get workspace settings
 *     description: Returns the current workspace configuration including name, timezone, logo, and feature flags.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Workspace settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:           { type: string, format: uuid }
 *                     name:         { type: string, example: "Acme Corp" }
 *                     timezone:     { type: string, example: "America/New_York" }
 *                     logoUrl:      { type: string, format: uri }
 *                     plan:         { type: string, enum: [FREE, STARTER, GROWTH, ENTERPRISE] }
 *                     featureFlags: { type: object }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/workspace', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: 'ws-uuid', name: 'Acme Corp', timezone: 'America/New_York', plan: 'GROWTH', featureFlags: {} } });
});

/**
 * @openapi
 * /settings/workspace:
 *   patch:
 *     summary: Update workspace settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:     { type: string }
 *               timezone: { type: string }
 *               logoUrl:  { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Workspace updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.patch('/workspace', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { ...req.body } });
});

/**
 * @openapi
 * /settings/team:
 *   get:
 *     summary: List team members
 *     description: Returns all users in the workspace with their roles and statuses.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Team members list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/team', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /settings/team/invite:
 *   post:
 *     summary: Invite a team member
 *     description: Sends an email invitation to a new user to join the workspace with a specified role.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role, workspaceId]
 *             properties:
 *               email:       { type: string, format: email }
 *               role:        { type: string, enum: [ADMIN, MEMBER, VIEWER] }
 *               workspaceId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invitation sent
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/team/invite', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { invited: req.body.email } });
});

/**
 * @openapi
 * /settings/team/{userId}:
 *   delete:
 *     summary: Remove a team member
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Member removed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/team/:userId', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

/**
 * @openapi
 * /settings/integrations:
 *   get:
 *     summary: List connected integrations
 *     description: Returns a list of all third-party integrations and their connection status.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Integrations list
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
 *                       id:          { type: string }
 *                       name:        { type: string, example: "HubSpot" }
 *                       type:        { type: string, enum: [CRM, ADS, ANALYTICS, EMAIL, SMS] }
 *                       status:      { type: string, enum: [CONNECTED, DISCONNECTED, ERROR] }
 *                       connectedAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/integrations', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'hubspot',    name: 'HubSpot',    type: 'CRM',       status: 'CONNECTED',    connectedAt: '2026-01-15T10:00:00Z' },
    { id: 'google-ads', name: 'Google Ads', type: 'ADS',       status: 'CONNECTED',    connectedAt: '2026-01-20T10:00:00Z' },
    { id: 'meta',       name: 'Meta Ads',   type: 'ADS',       status: 'DISCONNECTED', connectedAt: null },
    { id: 'salesforce', name: 'Salesforce', type: 'CRM',       status: 'DISCONNECTED', connectedAt: null },
  ]});
});

/**
 * @openapi
 * /settings/compliance:
 *   get:
 *     summary: Get compliance settings
 *     description: Returns GDPR, CAN-SPAM, and CASL compliance configurations and current compliance posture.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Compliance settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     gdprEnabled:   { type: boolean }
 *                     canSpamEnabled: { type: boolean }
 *                     caslEnabled:   { type: boolean }
 *                     dataRetention: { type: integer, description: "Days to retain data", example: 365 }
 *                     score:         { type: integer, description: "Compliance score 0-100", example: 94 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/compliance', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { gdprEnabled: true, canSpamEnabled: true, caslEnabled: false, dataRetention: 365, score: 94 } });
});

/**
 * @openapi
 * /settings/billing:
 *   get:
 *     summary: Get billing information
 *     description: Returns the current subscription plan, usage, and billing history.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Billing info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     plan:           { type: string, enum: [FREE, STARTER, GROWTH, ENTERPRISE] }
 *                     billingCycle:   { type: string, enum: [MONTHLY, ANNUAL] }
 *                     nextBillingDate: { type: string, format: date }
 *                     seats:          { type: object, properties: { used: { type: integer }, total: { type: integer } } }
 *                     agentTokens:    { type: object, properties: { used: { type: integer }, total: { type: integer } } }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/billing', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { plan: 'GROWTH', billingCycle: 'ANNUAL', nextBillingDate: '2027-01-01', seats: { used: 8, total: 25 }, agentTokens: { used: 4200000, total: 10000000 } } });
});

/**
 * @openapi
 * /settings/security:
 *   get:
 *     summary: Get security settings
 *     description: Returns MFA configuration, SSO status, IP allowlist, and active session information.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Security settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     mfaRequired:   { type: boolean }
 *                     ssoEnabled:    { type: boolean }
 *                     ipAllowlist:   { type: array, items: { type: string } }
 *                     activeSessions: { type: integer, example: 3 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/security', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { mfaRequired: true, ssoEnabled: false, ipAllowlist: [], activeSessions: 3 } });
});

export default router;
