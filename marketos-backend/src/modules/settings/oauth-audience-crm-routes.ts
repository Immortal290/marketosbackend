import { Router, Request, Response } from 'express';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import {
  requireOAuthWorkspaceOwner,
  OAuthWorkspaceRequest,
} from './oauth-workspace-auth';
import {
  readMailchimpOAuthAudiences,
  readHubSpotOAuthContacts,
} from './oauth-agent-audience-crm-read';

const router = Router();

function authorizedContext(req: Request) {
  const workspace = (req as OAuthWorkspaceRequest).oauthWorkspace;
  const connectionId = req.params.connectionId;

  if (!workspace) {
    return { error: 403 as const };
  }

  if (
    typeof connectionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(connectionId)
  ) {
    return { error: 400 as const };
  }

  return {
    context: {
      userId: workspace.userId,
      workspaceId: workspace.workspaceId,
      connectionId,
    },
  };
}

function handleProviderError(error: unknown, res: Response) {
  const message = error instanceof Error ? error.message : '';

  if (
    message === 'OAuth workspace access denied' ||
    message === 'OAuth connection not authorized' ||
    message === 'Required OAuth permission not granted'
  ) {
    return res.status(403).json({
      success: false,
      error: 'OAuth provider access denied',
    });
  }

  if (
    message === 'OAuth connection requires reconnection' ||
    message === 'OAuth access token unavailable or requires reconnection'
  ) {
    return res.status(409).json({
      success: false,
      error: 'Reconnect the OAuth account',
    });
  }

  // Never return provider response bodies or OAuth credentials.
  return res.status(503).json({
    success: false,
    error: 'OAuth provider data unavailable',
  });
}

router.get(
  '/connections/:connectionId/mailchimp-audiences',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const result = authorizedContext(req);

    if (result.error) {
      return res.status(result.error).json({
        success: false,
        error: 'Invalid or unauthorized OAuth request',
      });
    }

    try {
      const data = await readMailchimpOAuthAudiences(result.context!);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleProviderError(error, res);
    }
  }
);

router.get(
  '/connections/:connectionId/hubspot-contacts',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const result = authorizedContext(req);

    if (result.error) {
      return res.status(result.error).json({
        success: false,
        error: 'Invalid or unauthorized OAuth request',
      });
    }

    try {
      const data = await readHubSpotOAuthContacts(result.context!);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleProviderError(error, res);
    }
  }
);

export default router;
