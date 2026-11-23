import { sendGmailWithOAuth } from './oauth-agent-gmail-send';
import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';

jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));

const executor = executeAuthorizedOAuthOperation as jest.Mock;

const input = {
  userId: 'user-test',
  workspaceId: 'workspace-test',
  connectionId: 'connection-test',
  to: 'recipient@example.com',
  subject: 'MarketOS test',
  textBody: 'This is an offline test.',
};

const originalFetch = globalThis.fetch;
const originalFlag = process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalFlag === undefined) {
    delete process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED;
  } else {
    process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED = originalFlag;
  }

  jest.clearAllMocks();
});

test('defaults to dry run without accessing credentials', async () => {
  delete process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED;

  const approval = jest.fn(async () => true);

  await expect(sendGmailWithOAuth(input, approval))
    .resolves.toEqual({ status: 'dry_run' });

  expect(approval).not.toHaveBeenCalled();
  expect(executor).not.toHaveBeenCalled();
});

test('rejects header injection in recipient', async () => {
  await expect(
    sendGmailWithOAuth(
      { ...input, to: 'recipient@example.com\r\nBcc: attacker@example.com' },
      async () => true
    )
  ).rejects.toThrow('Invalid Gmail recipient');

  expect(executor).not.toHaveBeenCalled();
});

test('rejects sending without approved workflow', async () => {
  process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED = 'true';

  await expect(
    sendGmailWithOAuth(input, async () => false)
  ).rejects.toThrow('Approved workflow required');

  expect(executor).not.toHaveBeenCalled();
});

test('uses authorized OAuth executor and mocked Gmail API', async () => {
  process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED = 'true';

  const fakeFetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'mock-message-id' }),
  }));

  globalThis.fetch = fakeFetch as unknown as typeof fetch;

  executor.mockImplementation(
    async (_authorization, operation) =>
      operation('mock-access-token')
  );

  const result = await sendGmailWithOAuth(
    input,
    async () => true
  );

  expect(result).toEqual({
    status: 'sent',
    messageId: 'mock-message-id',
  });

  expect(executor).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: 'gmail.send',
      workspaceId: 'workspace-test',
      connectionId: 'connection-test',
    }),
    expect.any(Function)
  );

  expect(fakeFetch).toHaveBeenCalledTimes(1);

  const request = fakeFetch.mock.calls[0][1] as {
    method: string;
    headers: Record<string, string>;
    body: string;
  };

  expect(request.method).toBe('POST');
  expect(request.headers.Authorization)
    .toBe('Bearer mock-access-token');

  const payload = JSON.parse(request.body);
  const mime = Buffer.from(payload.raw, 'base64url')
    .toString('utf8');

  expect(mime).toContain('To: recipient@example.com');
  expect(mime).toContain('Content-Type: text/plain');
});

test('does not expose provider errors or tokens', async () => {
  process.env.GMAIL_OAUTH_LIVE_SEND_ENABLED = 'true';

  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 403,
  })) as unknown as typeof fetch;

  executor.mockImplementation(
    async (_authorization, operation) =>
      operation('mock-access-token')
  );

  await expect(
    sendGmailWithOAuth(input, async () => true)
  ).rejects.toThrow('Gmail API operation failed (HTTP 403)');
});
