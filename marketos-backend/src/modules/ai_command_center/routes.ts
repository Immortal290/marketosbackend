import { Router, Request, Response } from 'express';
import { logger } from '../../lib/logger';
import agentClient from '../../lib/agentClient';

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
  const prompt = req.body.prompt?.toLowerCase() || '';
  
  let intent = 'UNKNOWN_INTENT';
  let agentsSpawned = ['GeneralAgent'];
  let routeTo = '/dashboard';

  if (prompt.includes('campaign')) {
    intent = 'CREATE_CAMPAIGN';
    agentsSpawned = ['CopyAgent', 'CreativeAgent', 'EmailAgent'];
    routeTo = '/campaigns';
  } else if (prompt.includes('content') || prompt.includes('post') || prompt.includes('email') || prompt.includes('generation')) {
    intent = 'GENERATE_CONTENT';
    agentsSpawned = ['CreativeAgent', 'CopyAgent'];
    routeTo = '/creative-studio';
  } else if (prompt.includes('analy') || prompt.includes('report') || prompt.includes('performance')) {
    intent = 'ANALYZE_PERFORMANCE';
    agentsSpawned = ['AnalyticsAgent'];
    routeTo = '/reports';
  } else {
    intent = 'GENERAL_QUERY';
  }

  res.status(200).json({ 
    success: true, 
    data: { 
      taskId: `task-${Date.now()}`, 
      intent, 
      confidence: 0.94, 
      agentsSpawned, 
      estimatedMs: 12000,
      routeTo
    } 
  });
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

// ── Agent Service Pipeline Proxy Routes ────────────────────────────────────
// These routes forward requests to the Python agent service running at
// AGENT_SERVICE_URL (e.g. http://renewed-dedication.railway.internal:8000)
// via Railway's private networking (no public proxy, real app port).

/**
 * @openapi
 * /ai-command-center/pipeline/campaign:
 *   post:
 *     summary: Run the full campaign pipeline (sync)
 *     description: Executes the 4-agent campaign pipeline synchronously via the Python agent service. Returns the complete campaign result.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_intent]
 *             properties:
 *               user_intent:     { type: string, example: "Launch a Diwali sale campaign for our skincare brand" }
 *               channels:        { type: array, items: { type: string }, example: ["email", "sms"] }
 *               recipient_email: { type: string, format: email }
 *               recipient_phone: { type: string }
 *               sender_name:     { type: string, default: "MarketOS" }
 *               company_name:    { type: string, default: "MarketOS" }
 *               workspace_id:    { type: string, default: "default" }
 *     responses:
 *       200:
 *         description: Campaign pipeline result
 *       502:
 *         description: Agent service unavailable
 */
router.post('/pipeline/campaign', async (req: Request, res: Response) => {
  try {
    const result = await agentClient.runCampaignSync(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Campaign pipeline error:', message);
    res.status(502).json({ success: false, error: 'Agent service unavailable', detail: message });
  }
});

/**
 * @openapi
 * /ai-command-center/pipeline/campaign/async:
 *   post:
 *     summary: Run the campaign pipeline asynchronously (Kafka-backed, 202)
 *     description: Submits the campaign intent to Kafka via the agent service and returns immediately with a campaign_id and poll URL.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_intent]
 *             properties:
 *               user_intent: { type: string }
 *               channels:    { type: array, items: { type: string } }
 *               workspace_id: { type: string }
 *     responses:
 *       202:
 *         description: Campaign accepted — poll /pipeline/{id}/status
 *       502:
 *         description: Agent service unavailable
 */
router.post('/pipeline/campaign/async', async (req: Request, res: Response) => {
  try {
    const result = await agentClient.runCampaignAsync(req.body);
    res.status(202).json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Async campaign error:', message);
    res.status(502).json({ success: false, error: 'Agent service unavailable', detail: message });
  }
});

/**
 * @openapi
 * /ai-command-center/pipeline/{campaignId}/status:
 *   get:
 *     summary: Poll async campaign status
 *     description: Polls the agent service for the status of an asynchronous campaign.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: campaignId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign status
 *       502:
 *         description: Agent service unavailable
 */
router.get('/pipeline/:campaignId/status', async (req: Request, res: Response) => {
  try {
    const result = await agentClient.getCampaignStatus(req.params.campaignId);
    res.status(200).json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Campaign status error:', message);
    res.status(502).json({ success: false, error: 'Agent service unavailable', detail: message });
  }
});

/**
 * @openapi
 * /ai-command-center/pipeline/campaign/stream:
 *   post:
 *     summary: Stream campaign pipeline via SSE
 *     description: Runs the campaign pipeline on the agent service and streams Server-Sent Events back to the client. Each event contains the node name, trace, and any errors.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_intent]
 *             properties:
 *               user_intent: { type: string }
 *               channels:    { type: array, items: { type: string } }
 *               workspace_id: { type: string }
 *     responses:
 *       200:
 *         description: SSE stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       502:
 *         description: Agent service unavailable
 */
router.post('/pipeline/campaign/stream', async (req: Request, res: Response) => {
  try {
    const stream = await agentClient.streamCampaign(req.body);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');

    // Pipe Web Streams API ReadableStream → Node.js Writable (res)
    const reader = stream.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (pipeErr) {
        logger.warn('[AI CC] Stream pipe error:', pipeErr);
      } finally {
        res.end();
      }
    };
    pump();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Campaign stream error:', message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Agent service unavailable', detail: message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

/**
 * @openapi
 * /ai-command-center/query/stream:
 *   post:
 *     summary: GLM-Orchestrated query pipeline (SSE)
 *     description: Sends a natural language query to the GLM-5.2 orchestrator on the agent service. Returns a Server-Sent Events stream of stage-by-stage results.
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:        { type: string, example: "Analyse our Q3 email performance and suggest improvements" }
 *               workspace_id: { type: string, default: "default" }
 *     responses:
 *       200:
 *         description: SSE stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       502:
 *         description: Agent service unavailable
 */
router.post('/query/stream', async (req: Request, res: Response) => {
  try {
    const stream = await agentClient.streamQuery(req.body);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');

    const reader = stream.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (pipeErr) {
        logger.warn('[AI CC] Query stream pipe error:', pipeErr);
      } finally {
        res.end();
      }
    };
    pump();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Query stream error:', message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Agent service unavailable', detail: message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

/**
 * @openapi
 * /ai-command-center/agent-service/health:
 *   get:
 *     summary: Check agent service health
 *     description: Proxies to GET /v1/health on the Python agent service and returns infrastructure status (Kafka, PostgreSQL, Redis, ClickHouse).
 *     tags: [AI Command Center]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent service health
 *       502:
 *         description: Agent service unreachable
 */
router.get('/agent-service/health', async (_req: Request, res: Response) => {
  try {
    const health = await agentClient.getHealth();
    res.status(health.data?.status === 'healthy' ? 200 : 207).json({ success: true, data: health });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AI CC] Agent service health check failed:', message);
    res.status(502).json({ success: false, error: 'Agent service unreachable', detail: message });
  }
});

export default router;
