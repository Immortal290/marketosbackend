import { prisma } from '../../lib/prisma';

import {
  buildGmailApprovalPreview,
  claimApprovedGmailPayload,
  digestGmailApprovalPayload,
} from './oauth-gmail-approval-binding';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workflowRun: {
      findFirst: jest.fn(),
    },
    workflowStep: {
      updateMany: jest.fn(),
    },
  },
}));

const findRun = prisma.workflowRun.findFirst as jest.Mock;
const claimStep = prisma.workflowStep.updateMany as jest.Mock;

const payload = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  to: 'recipient@example.com',
  subject: 'Approved campaign',
  textBody: 'This is the exact approved message.',
};

const request = {
  ...payload,
  runId: 'run-1',
  stepId: 'step-1',
};

function approvedRun() {
  return {
    id: 'run-1',
    userId: 'user-1',
    status: 'running',
    steps: [{
      id: 'step-1',
      runId: 'run-1',
      agentName: 'GmailOAuthSend',
      requiresApproval: true,
      status: 'approved',
      updatedAt: new Date(),
      output: buildGmailApprovalPreview(payload),
    }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  findRun.mockImplementation(async () => approvedRun());
  claimStep.mockResolvedValue({ count: 1 });
});

test('creates an exact-message approval preview', () => {
  const preview = buildGmailApprovalPreview(payload);

  expect(preview.to).toBe(payload.to);
  expect(preview.subject).toBe(payload.subject);
  expect(preview.textBody).toBe(payload.textBody);
  expect(preview.gmailApproval.payloadDigest).toHaveLength(64);
});

test('different message content produces a different digest', () => {
  const original = digestGmailApprovalPayload(payload);

  const changed = digestGmailApprovalPayload({
    ...payload,
    textBody: 'An altered message.',
  });

  expect(changed).not.toBe(original);
});

test('claims an approved step using authenticated ownership', async () => {
  await claimApprovedGmailPayload(request);

  expect(findRun).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: 'run-1',
        userId: 'user-1',
        status: 'running',
      }),
    })
  );

  expect(claimStep).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: 'step-1',
        status: 'approved',
        requiresApproval: true,
      }),
      data: { status: 'running' },
    })
  );
});

test('rejects a changed recipient', async () => {
  await expect(
    claimApprovedGmailPayload({
      ...request,
      to: 'another@example.com',
    })
  ).rejects.toThrow('Gmail approval payload changed');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects a changed message body', async () => {
  await expect(
    claimApprovedGmailPayload({
      ...request,
      textBody: 'Different email content.',
    })
  ).rejects.toThrow('Gmail approval payload changed');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects a different OAuth connection', async () => {
  await expect(
    claimApprovedGmailPayload({
      ...request,
      connectionId: 'another-connection',
    })
  ).rejects.toThrow('Gmail approval payload changed');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects missing workflow ownership', async () => {
  findRun.mockResolvedValue(null);

  await expect(
    claimApprovedGmailPayload(request)
  ).rejects.toThrow('Gmail workflow approval denied');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects an unapproved workflow step', async () => {
  const run = approvedRun();
  run.steps[0].status = 'awaiting_approval';

  findRun.mockResolvedValue(run);

  await expect(
    claimApprovedGmailPayload(request)
  ).rejects.toThrow('Gmail workflow approval denied');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects expired approvals', async () => {
  const run = approvedRun();

  run.steps[0].updatedAt =
    new Date(Date.now() - 20 * 60 * 1000);

  findRun.mockResolvedValue(run);

  await expect(
    claimApprovedGmailPayload(request)
  ).rejects.toThrow('Gmail workflow approval expired');

  expect(claimStep).not.toHaveBeenCalled();
});

test('rejects repeated or competing approval claims', async () => {
  claimStep.mockResolvedValue({ count: 0 });

  await expect(
    claimApprovedGmailPayload(request)
  ).rejects.toThrow('Gmail approval already claimed');
});

test('rejects a missing approval binding', async () => {
  const run = approvedRun();
  run.steps[0].output = {
    approval_required: true,
  } as any;

  findRun.mockResolvedValue(run);

  await expect(
    claimApprovedGmailPayload(request)
  ).rejects.toThrow('Gmail approval binding missing');

  expect(claimStep).not.toHaveBeenCalled();
});
