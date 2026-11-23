import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import { requireOAuthWorkspaceOwner } from './oauth-workspace-auth';
import type { OAuthWorkspaceRequest } from './oauth-workspace-auth';
import { authorizeOAuthOperation } from './oauth-agent-authorization';
import { buildGmailApprovalPreview } from './oauth-gmail-approval-binding';
import type { GmailApprovalPayload } from './oauth-gmail-approval-binding';
import { dispatchApprovedGmailOAuth } from './oauth-gmail-workflow-dispatch';

const router = Router();
const identityOf = (req: Request) => (req as OAuthWorkspaceRequest).oauthWorkspace;
const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail = (res: Response, status: number, error: string) => res.status(status).json({success: false, error});

// Store the exact email and its SHA-256 digest, pending the EXISTING user approval flow.
// Identity is always derived from validated JWT + owner-verified workspace middleware.
router.post('/gmail/messages/prepare', requireJwtAuth, requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const identity = identityOf(req);
    if (!identity) return fail(res, 403, 'Workspace authorization required');
    const { connectionId, to, subject, textBody } = req.body ?? {};
    if (!validId(connectionId) || typeof to !== 'string' ||
        typeof subject !== 'string' || typeof textBody !== 'string') {
      return fail(res, 400, 'Invalid Gmail approval request');
    }
    const payload: GmailApprovalPayload = { ...identity, connectionId, to, subject, textBody };
    let preview: ReturnType<typeof buildGmailApprovalPreview>;
    try { preview = buildGmailApprovalPreview(payload); }
    catch { return fail(res, 400, 'Invalid Gmail approval request'); }
    try {
      // Existing operation authorization checks workspace, connection and gmail.send scope.
      await authorizeOAuthOperation({ ...identity, connectionId, operation: 'gmail.send' });
      const storedPreview = { ...preview, workspaceId: identity.workspaceId, connectionId };
      const run = await prisma.workflowRun.create({
        data: {
          command: 'Gmail OAuth approved email',
          userId: identity.userId,
          status: 'awaiting_approval',
          steps: { create: [{
            agentName: 'GmailOAuthSend', status: 'awaiting_approval',
            requiresApproval: true, input: 'Gmail OAuth email approval', output: storedPreview,
          }] },
        },
        include: { steps: true },
      });
      const step = run.steps.find(s => s.agentName === 'GmailOAuthSend');
      if (!step) throw new Error('Missing Gmail workflow step');
      return res.status(201).json({ success: true, data: {
        runId: run.id, stepId: step.id, status: 'awaiting_approval', preview: storedPreview,
      } });
    } catch {
      // Never return provider error bodies, OAuth credentials or tokens.
      return fail(res, 503, 'Gmail approval preparation unavailable');
    }
  }
);

// Never trust caller-supplied email content at dispatch. Rehydrate ONLY from DB.
// Existing bridge claims approval atomically; live sends remain disabled by default.
router.post('/gmail/workflows/:runId/dispatch', requireJwtAuth, requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const identity = identityOf(req);
    if (!identity) return fail(res, 403, 'Workspace authorization required');
    const runId = req.params.runId;
    if (!validId(runId)) return fail(res, 400, 'Invalid Gmail workflow ID');
    try {
      const run = await prisma.workflowRun.findFirst({
        where: { id: runId, userId: identity.userId, status: 'running' },
        include: { steps: {
          where: { agentName: 'GmailOAuthSend', requiresApproval: true }, take: 2,
        } },
      });
      if (!run || run.steps.length !== 1 || run.steps[0].status !== 'approved') {
        return fail(res, 409, 'Gmail workflow not approved or unavailable');
      }
      const step = run.steps[0];
      const preview = step.output;
      if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
        return fail(res, 403, 'Stored Gmail approval missing');
      }
      const record = preview as Record<string, unknown>;
      if (record.workspaceId !== identity.workspaceId || !validId(record.connectionId) ||
          typeof record.to !== 'string' || typeof record.subject !== 'string' ||
          typeof record.textBody !== 'string') {
        return fail(res, 403, 'Stored Gmail approval invalid');
      }
      const result = await dispatchApprovedGmailOAuth({
        ...identity, runId, stepId: step.id, connectionId: record.connectionId,
        to: record.to, subject: record.subject, textBody: record.textBody,
      });
      return res.status(200).json({ success: true, data: result });
    } catch {
      return fail(res, 503, 'Gmail dispatch unavailable; review workflow state');
    }
  }
);
export default router;
