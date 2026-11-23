import { prisma } from '../../lib/prisma';
import agentClient from '../../lib/agentClient';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import { executeWorkflowLoop, approveWorkflowStep, getWorkflowRun } from './orchestrator';
import router from './routes';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workflowRun: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workflowStep: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../lib/socket', () => ({ io: null }));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../lib/agentClient', () => ({
  __esModule: true,
  default: { runAgent: jest.fn() },
}));

const db = prisma as any;
const agent = agentClient.runAgent as jest.Mock;

function run(
  status: string,
  userId: string | null = 'user-1',
  runStatus = 'running'
) {
  return {
    id: 'run-1',
    command: 'Email campaign',
    status: runStatus,
    userId,
    steps: [{
      id: 'step-1',
      runId: 'run-1',
      agentName: 'EmailAgent',
      status,
      requiresApproval: true,
    }],
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  db.$transaction.mockImplementation(
    async (fn: any) => fn(db)
  );

  db.workflowStep.updateMany.mockResolvedValue({ count: 1 });
  db.workflowRun.updateMany.mockResolvedValue({ count: 1 });

  db.workflowStep.update.mockResolvedValue({
    id: 'step-1',
    agentName: 'EmailAgent',
    status: 'running',
  });

  db.workflowRun.update.mockResolvedValue({ steps: [] });
  agent.mockResolvedValue({ data: { completed: true } });
});

describe('Workflow approval security', () => {
  test('JWT protects workflow routes', () => {
    expect((router as any).stack[0].handle).toBe(requireJwtAuth);
  });

  test('approval is requested before agent execution', async () => {
    db.workflowRun.findUnique.mockResolvedValue(run('pending'));

    await executeWorkflowLoop('run-1');

    expect(agent).not.toHaveBeenCalled();

    expect(db.workflowStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'awaiting_approval',
        }),
      })
    );
  });

  test('approved agent executes only once', async () => {
    db.workflowRun.findUnique
      .mockResolvedValueOnce(run('approved'))
      .mockResolvedValueOnce(run('done'));

    await executeWorkflowLoop('run-1');
    await executeWorkflowLoop('run-1');

    expect(agent).toHaveBeenCalledTimes(1);
  });

  test('ownerless workflows cannot execute', async () => {
    db.workflowRun.findUnique.mockResolvedValue(
      run('approved', null)
    );

    await executeWorkflowLoop('run-1');

    expect(agent).not.toHaveBeenCalled();
  });

  test('cross-user approval is rejected', async () => {
    db.workflowRun.findFirst.mockResolvedValue(null);

    await expect(
      approveWorkflowStep('run-1', 'approved', 'attacker')
    ).rejects.toThrow('Workflow not found or not awaiting approval');

    expect(agent).not.toHaveBeenCalled();
  });

  test('duplicate approval is rejected', async () => {
    db.workflowRun.findFirst.mockResolvedValue(
      run('awaiting_approval', 'user-1', 'awaiting_approval')
    );

    db.workflowStep.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      approveWorkflowStep('run-1', 'approved', 'user-1')
    ).rejects.toThrow('Approval already processed');
  });

  test('workflow reads enforce user ownership', async () => {
    db.workflowRun.findFirst.mockResolvedValue(null);

    await getWorkflowRun('run-1', 'user-1');

    expect(db.workflowRun.findFirst).toHaveBeenCalledWith({
      where: { id: 'run-1', userId: 'user-1' },
      include: {
        steps: { orderBy: { createdAt: 'asc' } },
      },
    });
  });
});