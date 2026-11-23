import { Router, Request, Response } from 'express';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import { requireOAuthWorkspaceOwner } from './oauth-workspace-auth';
import type { OAuthWorkspaceRequest } from './oauth-workspace-auth';
import {
  readMailchimpOAuthCampaigns,
  readHubSpotOAuthLists,
} from './oauth-agent-marketing-list-read';

const router = Router();

async function readResource(
  req: Request,
  res: Response,
  action: (context: { userId: string; workspaceId: string; connectionId: string }) => Promise<unknown>
) {
  const workspace = (req as OAuthWorkspaceRequest).oauthWorkspace;
  if (!workspace) {
    return res.status(403).json({ success: false, error: 'Workspace authorization required' });
  }
  const connectionId = req.params.connectionId;
  if (typeof connectionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(connectionId)) {
    return res.status(400).json({ success: false, error: 'Invalid OAuth connection ID' });
  }
  try {
    const data = await action({ ...workspace, connectionId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message === 'OAuth workspace access denied' ||
      message === 'OAuth connection not authorized' ||
      message === 'Required OAuth permission not granted'
    ) {
      return res.status(403).json({ success: false, error: 'OAuth permission denied' });
    }
    return res.status(503).json({ success: false, error: 'OAuth provider operation unavailable' });
  }
}

router.get(
  '/connections/:connectionId/mailchimp-campaigns',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  (req: Request, res: Response) => readResource(req, res, readMailchimpOAuthCampaigns)
);

router.get(
  '/connections/:connectionId/hubspot-lists',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  (req: Request, res: Response) => readResource(req, res, readHubSpotOAuthLists)
);

export default router;
