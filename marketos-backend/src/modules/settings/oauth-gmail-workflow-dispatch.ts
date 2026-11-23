import { prisma } from '../../lib/prisma';

import {
  claimApprovedGmailPayload,
} from './oauth-gmail-approval-binding';

import type {
  GmailApprovalClaim,
} from './oauth-gmail-approval-binding';

import {
  sendGmailWithOAuth,
} from './oauth-agent-gmail-send';

/**
 * Server-side bridge between a persisted Gmail workflow approval
 * and the authorized OAuth sending implementation.
 *
 * Do not expose this function directly to a client-controlled
 * endpoint. The input must come from a trusted workflow record.
 */
export async function dispatchApprovedGmailOAuth(
  input: GmailApprovalClaim
) {
  const { runId, stepId, ...message } = input;

  let approvalClaimed = false;

  const result = await sendGmailWithOAuth(
    message,
    async () => {
      await claimApprovedGmailPayload(input);
      approvalClaimed = true;
      return true;
    }
  );

  // The Gmail sending adapter returns dry_run before attempting
  // approval or any provider request when live sending is disabled.
  // Therefore a dry run must never consume an approval.
  if (result.status === 'dry_run') {
    return result;
  }

  if (!approvalClaimed) {
    throw new Error(
      'Gmail sending result cannot be accepted without a claimed approval'
    );
  }

  // Only record success after the authorized Gmail API operation
  // has returned a message ID.
  const finalized = await prisma.workflowStep.updateMany({
    where: {
      id: stepId,
      runId,
      agentName: 'GmailOAuthSend',
      requiresApproval: true,
      status: 'running',
    },
    data: {
      status: 'done',
      output: {
        status: 'sent',
        provider: 'gmail',
        messageId: result.messageId,
      },
    },
  });

  if (finalized.count !== 1) {
    // A real send may already have occurred. Do not retry
    // automatically: manual reconciliation is required.
    throw new Error(
      'Gmail send result could not be recorded; manual reconciliation required'
    );
  }

  return result;
}
