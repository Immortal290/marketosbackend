import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import type { AuthorizeOAuthOperationInput } from './oauth-agent-authorization';

export interface GmailOAuthSendInput
  extends Omit<AuthorizeOAuthOperationInput, 'operation'> {
  to: string;
  subject: string;
  textBody: string;
}

export type GmailOAuthSendResult =
  | { status: 'dry_run' }
  | { status: 'sent'; messageId: string };

function encodeMime(input: GmailOAuthSendInput): string {
  const to = input.to?.trim();
  const subject = input.subject?.trim();
  const body = input.textBody;

  if (
    !to ||
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(to) ||
    to.includes('\r') ||
    to.includes('\n')
  ) {
    throw new Error('Invalid Gmail recipient');
  }

  if (
    !subject ||
    subject.length > 500 ||
    /[\r\n]/.test(subject)
  ) {
    throw new Error('Invalid Gmail subject');
  }

  if (
    typeof body !== 'string' ||
    !body.trim() ||
    Buffer.byteLength(body, 'utf8') > 1024 * 1024
  ) {
    throw new Error('Invalid Gmail message body');
  }

  const subjectEncoded =
    '=?UTF-8?B?' +
    Buffer.from(subject, 'utf8').toString('base64') +
    '?=';

  const encodedBody = Buffer.from(body, 'utf8')
    .toString('base64')
    .match(/.{1,76}/g)
    ?.join('\r\n') ?? '';

  const mime = [
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n');

  return Buffer.from(mime, 'utf8').toString('base64url');
}

/**
 * Backend-only Gmail OAuth operation.
 *
 * No public route is registered here.
 * Live sending is disabled unless explicitly enabled.
 * The approval checker must be supplied by trusted server-side
 * workflow code, not from a client-controlled request field.
 */
export async function sendGmailWithOAuth(
  input: GmailOAuthSendInput,
  verifyWorkflowApproval: () => Promise<boolean>
): Promise<GmailOAuthSendResult> {
  const raw = encodeMime(input);

  if (process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED !== 'true') {
    return { status: 'dry_run' };
  }

  if (
    typeof verifyWorkflowApproval !== 'function' ||
    !(await verifyWorkflowApproval())
  ) {
    throw new Error('Approved workflow required for Gmail sending');
  }

  return executeAuthorizedOAuthOperation(
    {
      userId: input.userId,
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
      operation: 'gmail.send',
    },
    async (accessToken) => {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Gmail API operation failed (HTTP ${response.status})`
        );
      }

      const data = (await response.json()) as { id?: unknown };

      if (typeof data.id !== 'string' || !data.id) {
        throw new Error('Gmail API returned an invalid message ID');
      }

      return {
        status: 'sent' as const,
        messageId: data.id,
      };
    }
  );
}
