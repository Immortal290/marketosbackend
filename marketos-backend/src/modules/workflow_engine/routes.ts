import { Router, Request, Response } from 'express';
import { startWorkflow, getWorkflowRun, approveWorkflowStep } from './orchestrator';

const router = Router();

/**
 * @openapi
 * /workflows:
 *   post:
 *     summary: Start a new workflow from a command string
 *     tags: [Workflow Engine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command: { type: string, example: "Create a 3-email drip campaign targeting enterprise CMOs" }
 *     responses:
 *       200:
 *         description: Workflow run created and started
 */
router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const command = req.body.command || req.body.prompt;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ success: false, error: 'Command string is required.' });
      return;
    }

    const run = await startWorkflow(command);
    res.status(200).json({
      success: true,
      data: {
        runId: run.id,
        command: run.command,
        status: run.status,
        steps: run.steps,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for root post if mounted under /api/workflows directly
router.post('/', async (req: Request, res: Response) => {
  try {
    const command = req.body.command || req.body.prompt;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ success: false, error: 'Command string is required.' });
      return;
    }

    const run = await startWorkflow(command);
    res.status(200).json({
      success: true,
      data: {
        runId: run.id,
        command: run.command,
        status: run.status,
        steps: run.steps,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @openapi
 * /workflows/{runId}:
 *   get:
 *     summary: Get full run status and all step outputs
 *     tags: [Workflow Engine]
 */
router.get('/workflows/:runId', async (req: Request, res: Response) => {
  try {
    const run = await getWorkflowRun(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: 'Workflow run not found' });
      return;
    }
    res.status(200).json({ success: true, data: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:runId', async (req: Request, res: Response) => {
  try {
    const run = await getWorkflowRun(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: 'Workflow run not found' });
      return;
    }
    res.status(200).json({ success: true, data: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @openapi
 * /workflows/{runId}/approve:
 *   post:
 *     summary: Approve or reject a paused workflow step
 *     tags: [Workflow Engine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approved, rejected] }
 */
router.post('/workflows/:runId/approve', async (req: Request, res: Response) => {
  try {
    const { decision } = req.body;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ success: false, error: "Decision must be 'approved' or 'rejected'" });
      return;
    }

    const updatedRun = await approveWorkflowStep(req.params.runId, decision);
    res.status(200).json({ success: true, data: updatedRun });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:runId/approve', async (req: Request, res: Response) => {
  try {
    const { decision } = req.body;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ success: false, error: "Decision must be 'approved' or 'rejected'" });
      return;
    }

    const updatedRun = await approveWorkflowStep(req.params.runId, decision);
    res.status(200).json({ success: true, data: updatedRun });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ── Legacy Graph & Execution endpoints ───────────────────────────────────── */

router.get('/graph', (_req: Request, res: Response) => {
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

router.get('/executions', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

router.get('/executions/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});

router.post('/executions/:id/cancel', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: 'CANCELLED' } });
});

router.get('/dependencies', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [['CopyAgent', 'CreativeAgent'], ['EmailAgent', 'SmsAgent', 'SocialAgent'], ['AnalyticsAgent']],
      criticalPath: ['SupervisorAgent', 'CopyAgent', 'ComplianceAgent', 'EmailAgent', 'AnalyticsAgent'],
    },
  });
});

router.get('/automation', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'wf1', name: 'Full Campaign Launch Workflow', description: 'End-to-end workflow from brief to launch', steps: 8, lastRun: null, enabled: true },
    { id: 'wf2', name: 'Re-engagement Workflow', description: 'Automated re-engagement sequence for cold leads', steps: 5, lastRun: '2026-06-01T10:00:00Z', enabled: true },
  ]});
});

router.post('/automation/:id/trigger', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { executionId: 'exec-uuid', status: 'RUNNING' } });
});

export default router;
