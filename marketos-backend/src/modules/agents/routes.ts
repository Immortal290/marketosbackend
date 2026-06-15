import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /agents:
 *   get:
 *     summary: List all AI agents
 *     description: Returns live status and metadata for all 11 AI agents in the MarketOS fleet.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [IDLE, RUNNING, PAUSED, ERROR, STOPPED] }
 *     responses:
 *       200:
 *         description: Agents list
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
router.get('/', (req: Request, res: Response) => {
  const types = ['SUPERVISOR','COPY','CREATIVE','ANALYTICS','COMPLIANCE','EMAIL','SMS','SOCIAL','SEO','COMPETITOR','FINANCE'];
  res.status(200).json({ success: true, data: types.map((type, i) => ({
    id: `agent-${i + 1}`,
    name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`,
    type,
    status: i < 2 ? 'RUNNING' : 'IDLE',
    currentTask: i < 2 ? 'Processing tasks' : null,
    queueLength: i < 2 ? 3 : 0,
    successRate: 96 + Math.round(Math.random() * 3 * 10) / 10,
    runtimeMs: 142000,
    tokenUsage: Math.floor(Math.random() * 50000),
    costUsd: Math.round(Math.random() * 200) / 100,
  }))});
});

/**
 * @openapi
 * /agents/{agentType}:
 *   get:
 *     summary: Get agent status by type
 *     description: Returns detailed status, configuration, and performance metrics for a specific agent type.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [supervisor, copy, creative, analytics, compliance, email, sms, social, seo, competitor, finance]
 *         example: copy
 *     responses:
 *       200:
 *         description: Agent detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Agent' }
 *       404:
 *         description: Agent type not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:agentType', (req: Request, res: Response) => {
  const type = req.params.agentType.toUpperCase();
  res.status(200).json({ success: true, data: { id: `agent-${type}`, name: `${req.params.agentType}Agent`, type, status: 'IDLE', queueLength: 0, successRate: 98.4, runtimeMs: 0, tokenUsage: 12400, costUsd: 0.24 } });
});

/**
 * @openapi
 * /agents/{agentType}/tasks:
 *   get:
 *     summary: Get tasks for a specific agent
 *     description: Returns all tasks (running, queued, failed, completed) assigned to the specified agent.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *         schema: { type: string, enum: [supervisor, copy, creative, analytics, compliance, email, sms, social, seo, competitor, finance] }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [RUNNING, QUEUED, FAILED, COMPLETED] }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Agent tasks
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
 *                       task:      { type: string }
 *                       status:    { type: string }
 *                       priority:  { type: integer }
 *                       startedAt: { type: string, format: date-time }
 *                       durationMs: { type: integer }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/:agentType/tasks', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /agents/{agentType}/memory:
 *   get:
 *     summary: Get agent memory
 *     description: Returns the working, episodic, and semantic memory for the specified agent.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *         schema: { type: string, enum: [supervisor, copy, creative, analytics, compliance, email, sms, social, seo, competitor, finance] }
 *       - name: memType
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [WORKING, EPISODIC, SEMANTIC] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Agent memory entries
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
 *                       memType:   { type: string, enum: [WORKING, EPISODIC, SEMANTIC] }
 *                       key:       { type: string }
 *                       value:     { type: object }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/:agentType/memory', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /agents/{agentType}/command:
 *   post:
 *     summary: Send a direct command to an agent
 *     description: Sends a direct operational command to a specific agent — e.g., pause, resume, clear queue, or execute a specific task.
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agentType
 *         in: path
 *         required: true
 *         schema: { type: string, enum: [supervisor, copy, creative, analytics, compliance, email, sms, social, seo, competitor, finance] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *                 enum: [PAUSE, RESUME, CLEAR_QUEUE, RESTART, EXECUTE_TASK]
 *               taskPayload:
 *                 type: object
 *                 description: Required when command is EXECUTE_TASK
 *     responses:
 *       200:
 *         description: Command accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     agentType: { type: string }
 *                     command:   { type: string }
 *                     status:    { type: string, enum: [ACCEPTED, QUEUED] }
 *       400:
 *         description: Invalid command
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/:agentType/command', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { agentType: req.params.agentType, command: req.body.command, status: 'ACCEPTED' } });
});

export default router;
