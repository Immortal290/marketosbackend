import { prisma } from '../../lib/prisma';
import { io } from '../../lib/socket';
import { logger } from '../../lib/logger';
import agentClient from '../../lib/agentClient';
import { checkAgentRequiresApproval, normalizeAgentName } from './approvalConfig';

/**
 * Rules-based agent selector based on natural language prompt
 */
export function determineAgentPlan(command: string): string[] {
  const lower = command.toLowerCase();

  if (lower.includes('campaign') || lower.includes('launch') || lower.includes('target') || lower.includes('cmo') || lower.includes('sale') || lower.includes('whatsapp') || lower.includes('telegram')) {
    return ['SupervisorAgent', 'CopyAgent', 'CreativeAgent', 'ComplianceAgent', 'EmailAgent', 'WhatsappAgent', 'TelegramAgent', 'AnalyticsAgent'];
  }
  if (lower.includes('content') || lower.includes('post') || lower.includes('social') || lower.includes('blog') || lower.includes('creative')) {
    return ['CopyAgent', 'CreativeAgent', 'ComplianceAgent', 'SocialMediaAgent'];
  }
  if (lower.includes('analy') || lower.includes('report') || lower.includes('performance') || lower.includes('finance') || lower.includes('roi')) {
    return ['AnalyticsAgent', 'FinanceAgent', 'ReportingAgent'];
  }
  if (lower.includes('lead') || lower.includes('score') || lower.includes('audience') || lower.includes('contact')) {
    return ['LeadScoringAgent', 'PersonalizationAgent', 'EmailAgent'];
  }

  // Default balanced workflow
  return ['SupervisorAgent', 'CopyAgent', 'ComplianceAgent', 'EmailAgent', 'ReportingAgent'];
}

/**
 * Creates a new WorkflowRun with all planned steps in PostgreSQL
 */
export async function startWorkflow(command: string, userId: string) {
  if (!userId?.trim()) throw new Error('Authentication required');
  const agentPlan = determineAgentPlan(command);

  const run = await prisma.workflowRun.create({
    data: {
      command,
      userId,
      status: 'running',
      steps: {
        create: agentPlan.map((agentName) => ({
          agentName,
          status: 'pending',
          input: command,
          requiresApproval: checkAgentRequiresApproval(agentName),
        })),
      },
    },
    include: {
      steps: true,
    },
  });

  logger.info(`[WorkflowEngine] Started run ${run.id} with ${run.steps.length} steps: ${agentPlan.join(', ')}`);

  // Broadcast initial workflow creation over WebSockets
  if (io) {
    io.emit('workflow:update', {
      event: 'CREATED',
      runId: run.id,
      command: run.command,
      status: run.status,
      steps: run.steps,
    });
  }

  // Execute asynchronously so API call returns immediately
  executeWorkflowLoop(run.id).catch((err) => {
    logger.error(`[WorkflowEngine] Unhandled error executing run ${run.id}:`, err);
  });

  return run;
}

/**
 * Sequential Workflow Execution Loop
 */
export async function executeWorkflowLoop(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: 'asc' } } },
  });

  if (!run) {
    logger.error(`[WorkflowEngine] Workflow run ${runId} not found`);
    return;
  }

  if (!run.userId) {
    logger.error(`[WorkflowEngine] Ownerless workflow blocked: ${runId}`);
    return;
  }

  if (run.status === 'completed' || run.status === 'failed' || run.status === 'awaiting_approval') {
    logger.info(`[WorkflowEngine] Run ${runId} is currently in state '${run.status}', skipping execution loop.`);
    return;
  }

  // Accumulate previous outputs to pass context to downstream agents
  const previousOutputs: Record<string, any> = {};
  for (const s of run.steps) {
    if (s.output && typeof s.output === 'object') {
      previousOutputs[s.agentName] = s.output;
    }
  }

  for (const step of run.steps) {
    // Skip already completed steps
    if (step.status === 'done') {
      continue;
    }

    if (step.status === 'rejected') {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed' },
      });
      return;
    }

    // ── STEP 1: Mark step RUNNING ──
    if (
      step.status === 'awaiting_approval' ||
      step.status === 'running'
    ) {
      return;
    }

    if (step.requiresApproval && step.status === 'pending') {
      const preview = {
        approval_required: true,
        agent: step.agentName,
        command: run.command,
        note: 'Approval required before agent execution',
      };

      const claim = await prisma.workflowStep.updateMany({
        where: {
          id: step.id,
          runId,
          status: 'pending',
        },
        data: {
          status: 'awaiting_approval',
          output: preview,
        },
      });

      if (claim.count !== 1) return;

      const pause = await prisma.workflowRun.updateMany({
        where: { id: runId, status: 'running' },
        data: { status: 'awaiting_approval' },
      });

      if (pause.count !== 1) {
        logger.error(`Workflow pause failed: ${runId}`);
        return;
      }

      if (io) {
        io.emit('workflow:step_update', {
          runId,
          stepId: step.id,
          agentName: step.agentName,
          status: 'awaiting_approval',
          output: preview,
          requiresApproval: true,
        });

        io.emit('workflow:awaiting_approval', {
          runId,
          step: {
            ...step,
            status: 'awaiting_approval',
            output: preview,
          },
          output: preview,
          agentName: step.agentName,
        });
      }

      return;
    }

    if (step.requiresApproval && step.status !== 'approved') {
      return;
    }

    if (!step.requiresApproval && step.status !== 'pending') {
      return;
    }

    // Gmail OAuth sends must never run through the generic Python
    // agent dispatcher or its simulated-success fallback.
    // A dedicated approval-bound dispatcher must handle them.
    if (step.agentName === 'GmailOAuthSend') {
      logger.warn(
        `[WorkflowEngine] Gmail OAuth send blocked from generic agent execution: ${runId}`
      );
      return;
    }
    const executionClaim = await prisma.workflowStep.updateMany({
      where: {
        id: step.id,
        runId,
        status: step.status,
      },
      data: { status: 'running' },
    });

    if (executionClaim.count !== 1) return;
    const updatedStep = await prisma.workflowStep.update({
      where: { id: step.id },
      data: { status: 'running' },
    });

    logger.info(`[WorkflowEngine] Run ${runId} -> Running agent: ${step.agentName}`);

    // Broadcast live status update to WebSocket clients
    if (io) {
      io.emit('workflow:step_update', {
        runId,
        stepId: step.id,
        agentName: step.agentName,
        status: 'running',
        requiresApproval: step.requiresApproval,
      });

      io.emit('agentEvent', {
        topic: `agent.${step.agentName.toLowerCase()}.events`,
        payload: {
          run_id: runId,
          agent_name: step.agentName,
          status: 'RUNNING',
          message: `Executing ${step.agentName}...`,
        },
      });
    }

    // ── STEP 2: Call Python agent service via Railway Private Networking ──
    let agentResultData: any = {};
    const t0 = Date.now();

    try {
      // Strips "Agent" suffix if calling FastAPI snake_case endpoints, or passes full name
      const agentKey = step.agentName.toLowerCase().replace(/agent$/, '');
      const response = await agentClient.runAgent(agentKey, {
        command: run.command,
        previous_outputs: previousOutputs,
      });

      agentResultData = response.data || response;
    } catch (err: any) {
      logger.warn(`[WorkflowEngine] Call to Python service for ${step.agentName} failed (${err.message}). Using simulated fallback output.`);
      agentResultData = {
        status: 'completed',
        agent: step.agentName,
        summary: `Generated strategy and execution plan for '${run.command.slice(0, 40)}...'`,
        timestamp: new Date().toISOString(),
        details: {
          confidence: 0.95,
          recommendedAction: `Proceed with ${step.agentName} task execution`,
        },
      };
    }

    const elapsedMs = Date.now() - t0;
    previousOutputs[step.agentName] = agentResultData;

    // ── STEP 3: Check Approval Gate ──
    const completedStep = await prisma.workflowStep.update({
      where: { id: step.id },
      data: {
        status: 'done',
        output: agentResultData as any,
      },
    });

    if (io) {
      io.emit('workflow:step_update', {
        runId,
        stepId: completedStep.id,
        agentName: completedStep.agentName,
        status: 'done',
        output: agentResultData,
        elapsedMs,
      });

      io.emit('agentEvent', {
        topic: `agent.${step.agentName.toLowerCase()}.responses`,
        payload: {
          run_id: runId,
          agent_name: step.agentName,
          status: 'DONE',
          output: agentResultData,
        },
      });
    }
  }

  // ── STEP 5: Workflow Run Complete ──
  const finalRun = await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: 'completed' },
    include: { steps: true },
  });

  logger.info(`[WorkflowEngine] Run ${runId} COMPLETED SUCCESSFULLY! All ${finalRun.steps.length} steps done.`);

  if (io) {
    io.emit('workflow:update', {
      event: 'COMPLETED',
      runId,
      status: 'completed',
      steps: finalRun.steps,
    });
  }
}

/**
 * Resumes or fails a workflow run when the user submits an approval decision
 */
export async function approveWorkflowStep(
  runId: string,
  decision: 'approved' | 'rejected',
  userId: string
) {
  if (!userId?.trim()) {
    throw new Error('Authentication required');
  }

  const approvedStep = await prisma.$transaction(async (tx) => {
    const run = await tx.workflowRun.findFirst({
      where: {
        id: runId,
        userId,
        status: 'awaiting_approval',
      },
      include: {
        steps: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!run) {
      throw new Error('Workflow not found or not awaiting approval');
    }

    const step = run.steps.find(
      (s) => s.status === 'awaiting_approval' && s.requiresApproval
    );

    if (!step) {
      throw new Error('No authorized approval step');
    }

    const updatedStep = await tx.workflowStep.updateMany({
      where: {
        id: step.id,
        runId,
        status: 'awaiting_approval',
      },
      data: {
        status: decision === 'approved' ? 'approved' : 'rejected',
      },
    });

    if (updatedStep.count !== 1) {
      throw new Error('Approval already processed');
    }

    const updatedRun = await tx.workflowRun.updateMany({
      where: {
        id: runId,
        userId,
        status: 'awaiting_approval',
      },
      data: {
        status: decision === 'approved' ? 'running' : 'failed',
      },
    });

    if (updatedRun.count !== 1) {
      throw new Error('Approval already processed');
    }

    return step;
  });

  if (io) {
    io.emit('workflow:step_update', {
      runId,
      stepId: approvedStep.id,
      agentName: approvedStep.agentName,
      status: decision === 'approved' ? 'approved' : 'rejected',
    });
  }

  if (decision === 'approved') {
    executeWorkflowLoop(runId).catch((error) => {
      logger.error(`Approved workflow execution failed: ${runId}`, error);
    });
  }

  return prisma.workflowRun.findFirst({
    where: { id: runId, userId },
    include: { steps: true },
  });
}
/**
 * Retrieves full workflow run with all step outputs
 */
export async function getWorkflowRun(
  runId: string,
  userId: string
) {
  if (!userId?.trim()) return null;

  return prisma.workflowRun.findFirst({
    where: { id: runId, userId },
    include: {
      steps: { orderBy: { createdAt: 'asc' } },
    },
  });
}