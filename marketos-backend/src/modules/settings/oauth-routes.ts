import ga4ReportRoutes from './oauth-ga4-report-routes';
import assetRoutes from './oauth-asset-routes';
import { Router, Request, Response } from 'express';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';
import {
  requireOAuthWorkspaceOwner,
  OAuthWorkspaceRequest,
} from './oauth-workspace-auth';
import {
  OAUTH_PROVIDERS,
  isConfiguredOAuthProvider,
} from './oauth-providers';
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  verifyGoogleOAuthAccount,
} from './oauth-google';
import {
  createExternalOAuthAuthorizationUrl,
  isExternalOAuthProvider,
} from './oauth-external-providers';
import { consumeOAuthState } from './oauth-state';
import { saveOAuthConnection, listOAuthConnections, removeOAuthConnectionIfUnchanged } from './oauth-storage';
import { prisma } from '../../lib/prisma';
import {
  completeExternalOAuthCallback,
} from './oauth-external-callback';

const router = Router();

router.use(assetRoutes);
router.use(ga4ReportRoutes);

function getFrontendUrl(): string {
  const configured = process.env.FRONTEND_URL;

  if (!configured) {
    throw new Error('FRONTEND_URL is required for OAuth callbacks');
  }

  const url = new URL(configured);

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)))
  ) {
    throw new Error('Invalid FRONTEND_URL');
  }

  return url.origin;
}

function redirectToIntegrations(
  res: Response,
  status: 'success' | 'cancelled' | 'error'
): void {
  const url = new URL('/settings/integrations', getFrontendUrl());
  url.searchParams.set('oauth', status);
  res.redirect(303, url.toString());
}

router.get(
  '/connections',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const context = (req as OAuthWorkspaceRequest).oauthWorkspace;

      if (!context) {
        return res.status(403).json({
          success: false,
          error: 'Workspace authorization required',
        });
      }

      const connections = await listOAuthConnections(
        context.workspaceId
      );

      return res.status(200).json({
        success: true,
        data: connections,
      });
    } catch {
      console.error('[OAuth] Failed to list connections');

      return res.status(503).json({
        success: false,
        error: 'Unable to retrieve OAuth connections',
      });
    }
  }
);
router.delete('/connections/:connectionId',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const context = (req as OAuthWorkspaceRequest).oauthWorkspace;
      const connectionId = req.params.connectionId;

      if (!context) {
        return res.status(403).json({
          success: false,
          error: 'Workspace authorization required',
        });
      }

      if (typeof connectionId !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(connectionId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
        });
      }

      const connection = await prisma.oAuthConnection.findFirst({
        where: {
          id: connectionId,
          workspaceId: context.workspaceId,
        },
        select: {
          provider: true,
          encryptedAccessToken: true,
        },
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found',
        });
      }

      const removed = await removeOAuthConnectionIfUnchanged({
        workspaceId: context.workspaceId,
        provider: connection.provider,
        connectionId,
        expectedEncryptedAccessToken:
          connection.encryptedAccessToken,
      });

      if (!removed) {
        return res.status(409).json({
          success: false,
          error: 'Connection changed; retry disconnection',
        });
      }

      return res.status(200).json({
        success: true,
        status: 'disconnected',
        providerAuthorizationRevoked: false,
      });
    } catch {
      console.error('[OAuth] Failed to disconnect connection');

      return res.status(503).json({
        success: false,
        error: 'Unable to disconnect OAuth connection',
      });
    }
  }
);
router.post(
  '/:provider/start',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const provider = req.params.provider;

    if (typeof provider !== 'string' ||
        (!isConfiguredOAuthProvider(provider) && !isExternalOAuthProvider(provider))) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported OAuth provider',
      });
    }

    try {
      const context = (req as OAuthWorkspaceRequest).oauthWorkspace;

      if (!context) {
        return res.status(403).json({
          success: false,
          error: 'Workspace authorization required',
        });
      }

      const authorizationUrl = isExternalOAuthProvider(provider)
          ? await createExternalOAuthAuthorizationUrl({
              userId: context.userId,
              workspaceId: context.workspaceId,
              provider,
            })
          : await createGoogleAuthorizationUrl({
        userId: context.userId,
        workspaceId: context.workspaceId,
        provider,
      });

      return res.json({
        success: true,
        authorizationUrl,
      });
    } catch (error) {
      console.error('[OAuth] Failed to start authorization');

      return res.status(503).json({
        success: false,
        error: 'Unable to start OAuth authorization',
      });
    }
  }
);

router.get('/google/callback', async (req: Request, res: Response) => {
  const state = req.query.state;
  const code = req.query.code;
  const providerError = req.query.error;

  try {
    if (typeof state !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid OAuth state',
      });
    }

    // State is consumed before processing any provider response.
    // This prevents callback replay.
    const context = await consumeOAuthState(
      state,
      ['gmail', 'ga4', 'google_ads']
    );

    if (!isConfiguredOAuthProvider(context.provider)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported OAuth state provider',
      });
    }

    if (providerError === 'access_denied') {
      redirectToIntegrations(res, 'cancelled');
      return;
    }

    if (providerError !== undefined) {
      redirectToIntegrations(res, 'error');
      return;
    }

    if (typeof code !== 'string' || !code.trim()) {
      redirectToIntegrations(res, 'error');
      return;
    }

    // Recheck authorization after consent, before accepting tokens.
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: context.userId,
          workspaceId: context.workspaceId,
        },
      },
      select: { role: true },
    });

    if (membership?.role !== 'OWNER') {
      throw new Error('Workspace authorization expired or was revoked');
    }

    const tokens = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier: context.codeVerifier,
    });

    if (!tokens.idToken) {
      throw new Error('Google identity token missing');
    }

    const account = await verifyGoogleOAuthAccount(tokens.idToken);

    // The verified Google ID token establishes account identity.
    // API authorization is checked independently using granted scopes.
    const requiredApiScopes = OAUTH_PROVIDERS[context.provider].scopes.filter(
      scope => scope.startsWith('https://www.googleapis.com/auth/')
    );

    const missingScopes = requiredApiScopes.filter(
      scope => !tokens.grantedScopes.includes(scope)
    );

    if (missingScopes.length) {
      throw new Error('Required Google API permissions were not granted');
    }

    const expiry = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await saveOAuthConnection({
      workspaceId: context.workspaceId,
      connectedByUserId: context.userId,
      provider: context.provider,
      providerAccountId: account.providerAccountId,
      accountLabel: account.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      grantedScopes: tokens.grantedScopes,
      tokenExpiresAt: expiry,
    });

    redirectToIntegrations(res, 'success');
  } catch (error) {
    console.error('[OAuth] Google callback failed');
    redirectToIntegrations(res, 'error');
  }
});


/**
 * Provider-specific authorization callbacks.
 *
 * Google continues to use /google/callback above.
 * These paths must exactly match registered provider redirects.
 */
router.get('/:provider/callback', async (req: Request, res: Response) => {
  const provider = req.params.provider;
  const state = req.query.state;
  const code = req.query.code;
  const providerError = req.query.error;

  if (
    typeof provider !== 'string' ||
    !isExternalOAuthProvider(provider)
  ) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported OAuth callback provider',
    });
  }

  if (typeof state !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid OAuth state',
    });
  }

  try {
    const result = await completeExternalOAuthCallback({
      provider,
      state,
      code: typeof code === 'string' ? code : undefined,
      error:
        typeof providerError === 'string'
          ? providerError
          : providerError === undefined
            ? undefined
            : 'invalid_provider_error',
    });

    redirectToIntegrations(res, result);
  } catch {
    // Never log provider codes, tokens, state or raw errors.
    console.error('[OAuth] External provider callback failed');
    redirectToIntegrations(res, 'error');
  }
});

export default router;
