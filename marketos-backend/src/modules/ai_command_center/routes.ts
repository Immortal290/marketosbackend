import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /ai-command-center/command:
 *   post:
 *     summary: Execute a natural language AI command
 *     description: Submits a natural language prompt to the AI Supervisor Agent. The supervisor interprets intent, delegates to appropriate sub-agents, and returns a structured response with actions taken.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, workspaceId]
 *             properties:
 *               prompt:      { type: string, example: "Create a 3-email drip campaign targeting high-value leads for our Q4 product" }
 *               workspaceId: { type: string, format: uuid }
 *               context:
 *                 type: object
 *                 description: Optional context to help the AI (e.g., activeCampaignId)
 *     responses:
 *       200:
 *         description: Command accepted and being processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:       { type: string, format: uuid }
 *                     intent:       { type: string, example: "CREATE_CAMPAIGN" }
 *                     confidence:   { type: number, example: 0.94 }
 *                     agentsSpawned: { type: array, items: { type: string } }
 *                     estimatedMs:  { type: integer, example: 12000 }
 *       400:
 *         description: Invalid prompt or missing context
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/command', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { taskId: 'task-uuid', intent: 'CREATE_CAMPAIGN', confidence: 0.94, agentsSpawned: ['CopyAgent', 'CreativeAgent', 'EmailAgent'], estimatedMs: 12000 } });
});

/**
 * @openapi
 * /ai-command-center/suggestions:
 *   get:
 *     summary: Get AI-suggested actions
 *     description: Returns context-aware action suggestions from the Supervisor Agent based on current campaign performance and audience signals.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Suggested actions
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
 *                       label:       { type: string, example: "Increase budget for top-performing campaign" }
 *                       description: { type: string }
 *                       impact:      { type: string, enum: [LOW, MEDIUM, HIGH] }
 *                       prompt:      { type: string, description: "Pre-filled prompt to execute this action" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/suggestions', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 's1', label: 'Boost Q4 campaign budget', description: 'ROAS is 5.1x — increasing budget could yield 40% more revenue', impact: 'HIGH', prompt: 'Increase budget for Q4 Product Launch campaign by 20%' },
    { id: 's2', label: 'Re-engage cold leads', description: "4,200 leads haven't opened an email in 30 days", impact: 'MEDIUM', prompt: 'Create a re-engagement sequence for cold leads' },
  ]});
});

/**
 * @openapi
 * /ai-command-center/agents:
 *   get:
 *     summary: Get agent monitor — all agents with live status
 *     description: Returns the real-time status of all 11 AI agents including Supervisor, Copy, Creative, Analytics, Compliance, Email, SMS, Social, SEO, Competitor and Finance agents.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: All agents status
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
  const agents = ['SUPERVISOR','COPY','CREATIVE','ANALYTICS','COMPLIANCE','EMAIL','SMS','SOCIAL','SEO','COMPETITOR','FINANCE'];
  res.status(200).json({ success: true, data: agents.map((type, i) => ({ id: `agent-${i}`, name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`, type, status: i < 3 ? 'RUNNING' : 'IDLE', queueLength: i < 3 ? 2 : 0, successRate: 97 + Math.random() * 2 })) });
});

/**
 * @openapi
 * /ai-command-center/tasks:
 *   get:
 *     summary: Get task explorer
 *     description: Returns running, queued, failed, and completed tasks across all agents.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [RUNNING, QUEUED, FAILED, COMPLETED]
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Tasks list
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
 *                       agentType: { type: string }
 *                       status:    { type: string, enum: [RUNNING, QUEUED, FAILED, COMPLETED] }
 *                       task:      { type: string }
 *                       startedAt: { type: string, format: date-time }
 *                       duration:  { type: integer, description: "Duration in ms" }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/tasks', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /ai-command-center/decisions:
 *   get:
 *     summary: Get supervisor decision feed
 *     description: Returns recent decisions made by the Supervisor Agent with reasoning, confidence scores, and outcomes.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Supervisor decisions
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
 *                       decision:   { type: string, example: "Reallocate budget from Social to Email" }
 *                       reasoning:  { type: string }
 *                       confidence: { type: number, example: 0.91 }
 *                       outcome:    { type: string, enum: [PENDING, APPROVED, EXECUTED, REJECTED] }
 *                       timestamp:  { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/decisions', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'd1', decision: 'Pause underperforming ad set B', reasoning: 'CTR dropped 40% over 3 days with no conversions', confidence: 0.91, outcome: 'EXECUTED', timestamp: new Date().toISOString() },
  ]});
});

/**
 * @openapi
 * /ai-command-center/memory:
 *   get:
 *     summary: Query agent memory
 *     description: Search and browse agent memory — working memory (current session), episodic memory (past events), and semantic memory (long-term knowledge).
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [WORKING, EPISODIC, SEMANTIC]
 *       - name: agentType
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SUPERVISOR, COPY, CREATIVE, ANALYTICS, COMPLIANCE, EMAIL, SMS, SOCIAL, SEO, COMPETITOR, FINANCE]
 *       - name: search
 *         in: query
 *         required: false
 *         description: Full-text search across memory entries
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Memory entries
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
 *                       agentType: { type: string }
 *                       memType:   { type: string, enum: [WORKING, EPISODIC, SEMANTIC] }
 *                       key:       { type: string }
 *                       value:     { type: object }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/memory', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /ai-command-center/automation-rules:
 *   get:
 *     summary: List automation rules
 *     description: Returns all automation rules — trigger rules, optimization rules, budget rules, and alert rules.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [TRIGGER, OPTIMIZATION, BUDGET, ALERT]
 *     responses:
 *       200:
 *         description: Automation rules list
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
 *                       name:      { type: string, example: "Pause ad if ROAS < 2x" }
 *                       type:      { type: string, enum: [TRIGGER, OPTIMIZATION, BUDGET, ALERT] }
 *                       enabled:   { type: boolean }
 *                       trigger:   { type: object, description: "Condition that fires the rule" }
 *                       action:    { type: object, description: "Action taken when triggered" }
 *                       lastFired: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/automation-rules', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'r1', name: 'Pause ad if ROAS < 2x', type: 'BUDGET', enabled: true, trigger: { metric: 'roas', operator: 'lt', value: 2 }, action: { type: 'PAUSE_AD' }, lastFired: null },
    { id: 'r2', name: 'Alert on budget threshold', type: 'ALERT', enabled: true, trigger: { metric: 'budgetUsed', operator: 'gte', value: 80 }, action: { type: 'SEND_ALERT' }, lastFired: '2026-06-14T08:00:00Z' },
  ]});
});

/**
 * @openapi
 * /ai-command-center/automation-rules:
 *   post:
 *     summary: Create an automation rule
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, trigger, action, workspaceId]
 *             properties:
 *               name:        { type: string }
 *               type:        { type: string, enum: [TRIGGER, OPTIMIZATION, BUDGET, ALERT] }
 *               workspaceId: { type: string, format: uuid }
 *               trigger:     { type: object }
 *               action:      { type: object }
 *               enabled:     { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Rule created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/automation-rules', (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: 'new-uuid', ...req.body, lastFired: null } });
});

/**
 * @openapi
 * /ai-command-center/automation-rules/{id}:
 *   delete:
 *     summary: Delete an automation rule
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Rule deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Rule not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/automation-rules/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

export default router;
