import { prisma } from '../../lib/prisma';

import {
  claimApprovedGmailPayload,
} from './oauth-gmail-approval-binding';

import {
  sendGmailWithOAuth,
} from './oauth-agent-gmail-send';

import {
  dispatchApprovedGmailOAuth,
} from './oauth-gmail-workflow-dispatch';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    workflowStep: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('./oauth-gmail-approval-binding', () => ({
  claimApprovedGmailPayload: jest.fn(),
}));

jest.mock('./oauth-agent-gmail-send', () => ({
  sendGmailWithOAuth: jest.fn(),
}));

const claim = claimApprovedGmailPayload as jest.Mock;
const send = sendGmailWithOAuth as jest.Mock;
const update = prisma.workflowStep.updateMany as jest.Mock;

const request = {
  runId: 'run-1',
  stepId: 'step-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  connectionId: 'connection-1',
  to: 'recipient@example.com',
  subject: 'Approved subject',
  textBody: 'Approved message.',
};

beforeEach(() => {
  jest.clearAllMocks();

  claim.mockResolvedValue(undefined);
  update.mockResolvedValue({ count: 1 });
});

test('dry run does not consume approval or modify workflow', async () => {
  send.mockResolvedValue({ status: 'dry_run' });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).resolves.toEqual({ status: 'dry_run' });

  expect(claim).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test('approved Gmail send records provider message ID', async () => {
  send.mockImplementation(async (_input, verifyApproval) => {
    const approved = await verifyApproval();

    if (!approved) {
      throw new Error('Approval denied');
    }

    return {
      status: 'sent',
      messageId: 'mock-gmail-message-id',
    };
  });

  const result = await dispatchApprovedGmailOAuth(request);

  expect(result).toEqual({
    status: 'sent',
    messageId: 'mock-gmail-message-id',
  });

  expect(claim).toHaveBeenCalledWith(request);

  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      to: 'recipient@example.com',
    }),
    expect.any(Function)
  );

  expect(update).toHaveBeenCalledWith({
    where: {
      id: 'step-1',
      runId: 'run-1',
      agentName: 'GmailOAuthSend',
      requiresApproval: true,
      status: 'running',
    },
    data: {
      status: 'done',
      output: {
        status: 'sent',
        provider: 'gmail',
        messageId: 'mock-gmail-message-id',
      },
    },
  });
});

test('rejected approval prevents recording a send', async () => {
  claim.mockRejectedValue(new Error('Gmail workflow approval denied'));

  send.mockImplementation(async (_input, verifyApproval) => {
    await verifyApproval();
    return { status: 'sent', messageId: 'should-not-send' };
  });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).rejects.toThrow('Gmail workflow approval denied');

  expect(update).not.toHaveBeenCalled();
});

test('already-claimed approval cannot be reused', async () => {
  claim.mockRejectedValue(
    new Error('Gmail approval already claimed')
  );

  send.mockImplementation(async (_input, verifyApproval) => {
    await verifyApproval();
    return { status: 'sent', messageId: 'should-not-send' };
  });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).rejects.toThrow('Gmail approval already claimed');

  expect(update).not.toHaveBeenCalled();
});

test('does not accept a sent result without approval', async () => {
  send.mockResolvedValue({
    status: 'sent',
    messageId: 'unapproved-message',
  });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).rejects.toThrow('without a claimed approval');

  expect(update).not.toHaveBeenCalled();
});

test('failed Gmail request does not record success', async () => {
  send.mockImplementation(async (_input, verifyApproval) => {
    await verifyApproval();
    throw new Error('Gmail API operation failed (HTTP 403)');
  });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).rejects.toThrow('Gmail API operation failed');

  expect(update).not.toHaveBeenCalled();
});

test('database finalization failure requires reconciliation', async () => {
  send.mockImplementation(async (_input, verifyApproval) => {
    await verifyApproval();
    return { status: 'sent', messageId: 'mock-id' };
  });

  update.mockResolvedValue({ count: 0 });

  await expect(
    dispatchApprovedGmailOAuth(request)
  ).rejects.toThrow('manual reconciliation required');
});
