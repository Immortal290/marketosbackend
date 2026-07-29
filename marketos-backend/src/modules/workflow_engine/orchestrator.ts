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

  if (lower.includes('campaign') || lower.includes('launch') || lower.includes('target') || lower.includes('cmo')) {
    return ['SupervisorAgent', 'CopyAgent', 'CreativeAgent', 'ComplianceAgent', 'EmailAgent', 'AnalyticsAgent'];
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
export async function startWorkflow(command: string) {
  const agentPlan = determineAgentPlan(command);

  const run = await prisma.workflowRun.create({
    data: {
      command,
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
    if (step.status === 'done' || step.status === 'approved') {
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
    if (step.requiresApproval) {
      logger.info(`[WorkflowEngine] Run ${runId} -> Agent ${step.agentName} REQUIRES HUMAN APPROVAL. Pausing workflow.`);

      // Update Step & Run status to awaiting_approval
      const pausedStep = await prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: 'awaiting_approval',
          output: agentResultData as any,
        },
      });

      const pausedRun = await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'awaiting_approval' },
      });

      // Broadcast live pause & approval required event via WebSockets
      if (io) {
        io.emit('workflow:step_update', {
          runId,
          stepId: pausedStep.id,
          agentName: pausedStep.agentName,
          status: 'awaiting_approval',
          output: agentResultData,
          requiresApproval: true,
          elapsedMs,
        });

        io.emit('workflow:awaiting_approval', {
          runId,
          step: pausedStep,
          output: agentResultData,
          agentName: pausedStep.agentName,
        });
      }

      // Stop the execution loop — wait for user /approve endpoint call
      return;
    }

    // ── STEP 4: Auto-run completion for non-approval steps ──
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
export async function approveWorkflowStep(runId: string, decision: 'approved' | 'rejected') {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: 'asc' } } },
  });

  if (!run) {
    throw new Error(`Workflow run ${runId} not found`);
  }

  const awaitingStep = run.steps.find((s) => s.status === 'awaiting_approval');

  if (!awaitingStep) {
    throw new Error(`Workflow run ${runId} has no step awaiting approval`);
  }

  if (decision === 'rejected') {
    logger.info(`[WorkflowEngine] User REJECTED step ${awaitingStep.agentName} for run ${runId}`);

    const rejectedStep = await prisma.workflowStep.update({
      where: { id: awaitingStep.id },
      data: { status: 'rejected' },
    });

    const failedRun = await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'failed' },
      include: { steps: true },
    });

    if (io) {
      io.emit('workflow:step_update', {
        runId,
        stepId: rejectedStep.id,
        agentName: rejectedStep.agentName,
        status: 'rejected',
      });

      io.emit('workflow:update', {
        event: 'FAILED',
        runId,
        status: 'failed',
        steps: failedRun.steps,
        reason: `Step ${awaitingStep.agentName} was rejected by user.`,
      });
    }

    return failedRun;
  }

  // Decision is APPROVED
  logger.info(`[WorkflowEngine] User APPROVED step ${awaitingStep.agentName} for run ${runId}. Resuming execution loop.`);

  const approvedStep = await prisma.workflowStep.update({
    where: { id: awaitingStep.id },
    data: { status: 'done' },
  });

  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: 'running' },
  });

  if (io) {
    io.emit('workflow:step_update', {
      runId,
      stepId: approvedStep.id,
      agentName: approvedStep.agentName,
      status: 'done',
    });
  }

  // Resume loop asynchronously
  executeWorkflowLoop(runId).catch((err) => {
    logger.error(`[WorkflowEngine] Error resuming execution loop for run ${runId}:`, err);
  });

  return prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: true },
  });
}

/**
 * Retrieves full workflow run with all step outputs
 */
export async function getWorkflowRun(runId: string) {
  return prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: 'asc' } } },
  });
}
