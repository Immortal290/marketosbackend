import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /workflow-engine/graph:
 *   get:
 *     summary: Get agent workflow DAG
 *     description: Returns the directed acyclic graph (DAG) of the current agent workflow — nodes represent agents, edges represent data/task flow dependencies.
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: campaignId
 *         in: query
 *         required: false
 *         description: Filter graph to a specific campaign's workflow
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Workflow DAG
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     nodes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:     { type: string }
 *                           label:  { type: string, example: "CopyAgent" }
 *                           type:   { type: string }
 *                           status: { type: string, enum: [IDLE, RUNNING, WAITING, DONE, FAILED] }
 *                           x:      { type: number, description: "Layout position X" }
 *                           y:      { type: number, description: "Layout position Y" }
 *                     edges:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           source: { type: string }
 *                           target: { type: string }
 *                           label:  { type: string, description: "Data flowing on this edge" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/graph', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      nodes: [
        { id: 'supervisor', label: 'SupervisorAgent', type: 'SUPERVISOR', status: 'RUNNING', x: 400, y: 50 },
        { id: 'copy',       label: 'CopyAgent',       type: 'COPY',       status: 'RUNNING', x: 200, y: 200 },
        { id: 'creative',   label: 'CreativeAgent',   type: 'CREATIVE',   status: 'WAITING', x: 400, y: 200 },
        { id: 'compliance', label: 'ComplianceAgent', type: 'COMPLIANCE', status: 'WAITING', x: 600, y: 200 },
        { id: 'email',      label: 'EmailAgent',      type: 'EMAIL',      status: 'IDLE',    x: 200, y: 350 },
        { id: 'analytics',  label: 'AnalyticsAgent',  type: 'ANALYTICS',  status: 'IDLE',    x: 600, y: 350 },
      ],
      edges: [
        { source: 'supervisor', target: 'copy',       label: 'brief' },
        { source: 'supervisor', target: 'creative',   label: 'brief' },
        { source: 'supervisor', target: 'compliance', label: 'content' },
        { source: 'copy',       target: 'email',      label: 'email_copy' },
        { source: 'creative',   target: 'email',      label: 'assets' },
        { source: 'compliance', target: 'email',      label: 'approval' },
        { source: 'email',      target: 'analytics',  label: 'metrics' },
      ],
    },
  });
});

/**
 * @openapi
 * /workflow-engine/executions:
 *   get:
 *     summary: List workflow executions
 *     description: Returns all past and current workflow execution instances with their status and duration.
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [RUNNING, COMPLETED, FAILED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Workflow executions list
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
 *                       campaignId: { type: string, format: uuid }
 *                       status:     { type: string, enum: [RUNNING, COMPLETED, FAILED, CANCELLED] }
 *                       startedAt:  { type: string, format: date-time }
 *                       completedAt: { type: string, format: date-time }
 *                       steps:      { type: integer, example: 12 }
 *                       stepsOk:    { type: integer, example: 11 }
 *                       stepsFailed: { type: integer, example: 1 }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/executions', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /workflow-engine/executions/{id}:
 *   get:
 *     summary: Get execution detail and runtime state
 *     description: Returns the full step-by-step execution log for a workflow run, including agent I/O at each step and current runtime state.
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Execution detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     execution: { type: object }
 *                     steps:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           step:       { type: integer }
 *                           agent:      { type: string }
 *                           action:     { type: string }
 *                           status:     { type: string, enum: [PENDING, RUNNING, DONE, FAILED] }
 *                           input:      { type: object }
 *                           output:     { type: object }
 *                           durationMs: { type: integer }
 *       404:
 *         description: Execution not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/executions/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});

/**
 * @openapi
 * /workflow-engine/executions/{id}/cancel:
 *   post:
 *     summary: Cancel a running workflow execution
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Execution cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400:
 *         description: Execution is not running
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/executions/:id/cancel', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: 'CANCELLED' } });
});

/**
 * @openapi
 * /workflow-engine/dependencies:
 *   get:
 *     summary: Get agent dependency map
 *     description: Returns the dependency resolution map — which agents depend on which outputs, and in what order tasks can be parallelized.
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Dependency map
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     parallelGroups:
 *                       type: array
 *                       description: Groups of agents that can run in parallel
 *                       items:
 *                         type: array
 *                         items: { type: string }
 *                     criticalPath: { type: array, items: { type: string } }
 */
router.get('/dependencies', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [['CopyAgent', 'CreativeAgent'], ['EmailAgent', 'SmsAgent', 'SocialAgent'], ['AnalyticsAgent']],
      criticalPath: ['SupervisorAgent', 'CopyAgent', 'ComplianceAgent', 'EmailAgent', 'AnalyticsAgent'],
    },
  });
});

/**
 * @openapi
 * /workflow-engine/automation:
 *   get:
 *     summary: List automation workflows
 *     description: Returns saved automation workflow definitions that can be triggered manually or by rules.
 *     tags: [Workflow Engine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Automation workflows list
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
 *                       name:        { type: string, example: "Full Campaign Launch Workflow" }
 *                       description: { type: string }
 *                       steps:       { type: integer, example: 8 }
 *                       lastRun:     { type: string, format: date-time }
 *                       enabled:     { type: boolean }
 */
router.get('/automation', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'wf1', name: 'Full Campaign Launch Workflow', description: 'End-to-end workflow from brief to launch', steps: 8, lastRun: null, enabled: true },
    { id: 'wf2', name: 'Re-engagement Workflow', description: 'Automated re-engagement sequence for cold leads', steps: 5, lastRun: '2026-06-01T10:00:00Z', enabled: true },
  ]});
});

/**
 * @openapi
 * /workflow-engine/automation/{id}/trigger:
 *   post:
 *     summary: Manually trigger an automation workflow
 *     description: Initiates a workflow execution run for the specified automation.
 *     tags: [Workflow Engine]
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
 *               input: { type: object, description: "Input variables for the workflow" }
 *     responses:
 *       200:
 *         description: Workflow triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     executionId: { type: string, format: uuid }
 *                     status:      { type: string, enum: [RUNNING] }
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/automation/:id/trigger', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { executionId: 'exec-uuid', status: 'RUNNING' } });
});

export default router;
