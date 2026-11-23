import { Router, Request, Response } from 'express';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import { requireOAuthWorkspaceOwner } from './oauth-workspace-auth';
import type { OAuthWorkspaceRequest } from './oauth-workspace-auth';
import {
  readAuthorizedGoogleAdsCampaigns,
  readAuthorizedMetaAdsCampaigns,
  readAuthorizedLinkedInAnalytics,
} from './oauth-agent-ad-campaign-read';

const router = Router();

type Context = {
  userId: string;
  workspaceId: string;
  connectionId: string;
  assetId: string;
};

async function handleRead(
  req: Request,
  res: Response,
  read: (input: Context) => Promise<unknown>
) {
  const workspace = (req as OAuthWorkspaceRequest).oauthWorkspace;
  if (!workspace) {
    return res.status(403).json({ success: false, error: 'Workspace authorization required' });
  }
  const connectionId = req.params.connectionId;
  const assetId = req.query.assetId;
  if (
    typeof connectionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(connectionId) ||
    typeof assetId !== 'string' ||
    assetId.length > 128 ||
    !assetId.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Invalid advertising report request' });
  }
  try {
    const data = await read({ ...workspace, connectionId, assetId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message === 'OAuth workspace access denied' ||
      message === 'OAuth connection not authorized' ||
      message === 'Required OAuth permission not granted' ||
      message === 'Selected OAuth asset not authorized' ||
      message === 'OAuth asset access revoked'
    ) {
      return res.status(403).json({ success: false, error: 'Advertising account access denied' });
    }
    if (message.startsWith('Invalid Google Ads customer ID') ||
        message.startsWith('Invalid Meta advertising account ID') ||
        message.startsWith('Invalid LinkedIn sponsored account ID')) {
      return res.status(400).json({ success: false, error: 'Invalid advertising account ID' });
    }
    return res.status(503).json({ success: false, error: 'Advertising report unavailable' });
  }
}

router.get(
  '/connections/:connectionId/google-ads-campaigns',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  (req: Request, res: Response) => handleRead(req, res, readAuthorizedGoogleAdsCampaigns)
);

router.get(
  '/connections/:connectionId/meta-ads-campaigns',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  (req: Request, res: Response) => handleRead(req, res, readAuthorizedMetaAdsCampaigns)
);

router.get(
  '/connections/:connectionId/linkedin-analytics',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  (req: Request, res: Response) => handleRead(req, res, readAuthorizedLinkedInAnalytics)
);

export default router;
