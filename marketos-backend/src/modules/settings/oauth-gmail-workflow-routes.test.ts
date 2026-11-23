import router from './oauth-gmail-workflow-routes';
import { prisma } from '../../lib/prisma';
import { authorizeOAuthOperation } from './oauth-agent-authorization';
import { dispatchApprovedGmailOAuth } from './oauth-gmail-workflow-dispatch';

jest.mock('../../lib/prisma', () => ({ prisma: { workflowRun: {
  create: jest.fn(), findFirst: jest.fn(),
} } }));
jest.mock('../../middlewares/jwt-auth.middleware', () => ({
  requireJwtAuth: jest.fn((_req, _res, next) => next()),
}));
jest.mock('./oauth-workspace-auth', () => ({
  requireOAuthWorkspaceOwner: jest.fn((_req, _res, next) => next()),
}));
jest.mock('./oauth-agent-authorization', () => ({ authorizeOAuthOperation: jest.fn() }));
jest.mock('./oauth-gmail-workflow-dispatch', () => ({ dispatchApprovedGmailOAuth: jest.fn() }));

const auth = authorizeOAuthOperation as jest.Mock;
const create = prisma.workflowRun.create as jest.Mock;
const get = prisma.workflowRun.findFirst as jest.Mock;
const dispatch = dispatchApprovedGmailOAuth as jest.Mock;
const owner = { userId: 'owner-1', workspaceId: 'workspace-1' };
const message = {
  connectionId: 'connection-1', to: 'recipient@example.com',
  subject: 'Approved email', textBody: 'Exactly this message',
};
const prepare = '/gmail/messages/prepare';
const send = '/gmail/workflows/:runId/dispatch';

function response() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
async function call(path: string, req: any) {
  const layer: any = (router as any).stack.find(
    (entry: any) => entry.route?.path === path
  );
  if (!layer) throw new Error(`Route missing: ${path}`);
  expect(layer.route.stack).toHaveLength(3); // JWT, owner middleware, handler
  const res = response();
  await layer.route.stack[2].handle(req, res);
  return res;
}
const approvedOutput = {
  ...message, workspaceId: owner.workspaceId,
  gmailApproval: { version: 1, payloadDigest: 'a'.repeat(64) },
};
beforeEach(() => {
  jest.resetAllMocks();
  auth.mockResolvedValue(undefined);
  create.mockResolvedValue({ id: 'run-1', steps: [{ id: 'step-1', agentName: 'GmailOAuthSend' }] });
  get.mockResolvedValue({ steps: [{ id: 'step-1', status: 'approved', output: approvedOutput }] });
  dispatch.mockResolvedValue({ status: 'dry_run' });
});

test('prepares a persisted approval using authenticated identity', async () => {
  const res = await call(prepare, {
    oauthWorkspace: owner,
    body: { ...message, workspaceId: 'attacker', userId: 'attacker' },
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(auth).toHaveBeenCalledWith({
    ...owner, connectionId: message.connectionId, operation: 'gmail.send',
  });
  const data = create.mock.calls[0][0].data;
  expect(data.userId).toBe('owner-1');
  expect(data.status).toBe('awaiting_approval');
  expect(data.steps.create[0].requiresApproval).toBe(true);
  expect(data.steps.create[0].output.textBody).toBe(message.textBody);
  expect(data.steps.create[0].output.gmailApproval.payloadDigest).toMatch(/^[0-9a-f]{64}$/);
});

test('rejects invalid MIME recipient before creating workflow', async () => {
  const res = await call(prepare, { oauthWorkspace: owner, body: {
    ...message, to: 'recipient@example.com\r\nBcc: attacker@example.com',
  } });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(create).not.toHaveBeenCalled();
});

test('rejects missing authenticated workspace', async () => {
  const res = await call(prepare, { body: message });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(create).not.toHaveBeenCalled();
});

test('rejects denied OAuth scope without leaking provider details', async () => {
  auth.mockRejectedValue(new Error('provider-secret-123'));
  const res = await call(prepare, { oauthWorkspace: owner, body: message });
  expect(res.status).toHaveBeenCalledWith(503);
  expect(create).not.toHaveBeenCalled();
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('provider-secret-123');
});

test('dispatches only the approved stored payload, never client body', async () => {
  const res = await call(send, {
    oauthWorkspace: owner, params: { runId: 'run-1' },
    body: { to: 'attacker@example.com', textBody: 'malicious' },
  });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(get).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'run-1', userId: 'owner-1', status: 'running' },
  }));
  expect(dispatch).toHaveBeenCalledWith({
    ...owner, ...message, runId: 'run-1', stepId: 'step-1',
  });
});

test('blocks stored payload from different workspace', async () => {
  get.mockResolvedValue({ steps: [{ id: 'step-1', status: 'approved',
    output: { ...approvedOutput, workspaceId: 'other-workspace' },
  }] });
  const res = await call(send, { oauthWorkspace: owner, params: { runId: 'run-1' } });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(dispatch).not.toHaveBeenCalled();
});

test('cannot dispatch unapproved workflow', async () => {
  get.mockResolvedValue({ steps: [{ id: 'step-1', status: 'awaiting_approval', output: approvedOutput }] });
  const res = await call(send, { oauthWorkspace: owner, params: { runId: 'run-1' } });
  expect(res.status).toHaveBeenCalledWith(409);
  expect(dispatch).not.toHaveBeenCalled();
});

test('cannot dispatch missing or foreign workflow', async () => {
  get.mockResolvedValue(null);
  const res = await call(send, { oauthWorkspace: owner, params: { runId: 'run-1' } });
  expect(res.status).toHaveBeenCalledWith(409);
  expect(dispatch).not.toHaveBeenCalled();
});

test('dispatch failures do not expose tokens', async () => {
  dispatch.mockRejectedValue(new Error('secret-token-123'));
  const res = await call(send, { oauthWorkspace: owner, params: { runId: 'run-1' } });
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret-token-123');
});
