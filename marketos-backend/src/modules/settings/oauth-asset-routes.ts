import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';

import {
  requireOAuthWorkspaceOwner,
} from './oauth-workspace-auth';

import type {
  OAuthWorkspaceRequest,
} from './oauth-workspace-auth';

import {
  listAccessibleOAuthAssets,
} from './oauth-asset-discovery';

import type {
  OAuthAssetProvider,
} from './oauth-asset-discovery';

import {
  saveVerifiedOAuthAssetSelection,
} from './oauth-asset-selection';

const router = Router();

const supported = new Set<string>([
  'ga4',
  'google_ads',
  'meta_ads',
  'linkedin',
]);

function isAssetProvider(
  provider: string
): provider is OAuthAssetProvider {
  return supported.has(provider);
}

function validConnectionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value
  );
}

router.get(
  '/connections/:connectionId/assets',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const context = (req as OAuthWorkspaceRequest).oauthWorkspace;
    const connectionId = req.params.connectionId;

    if (!context) {
      return res.status(403).json({
        success: false,
        error: 'Workspace authorization required',
      });
    }

    if (!validConnectionId(connectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OAuth connection ID',
      });
    }

    try {
      const connection = await prisma.oAuthConnection.findFirst({
        where: {
          id: connectionId,
          workspaceId: context.workspaceId,
          connectedByUserId: context.userId,
          connectionStatus: 'ACTIVE',
        },
        select: {
          provider: true,
          selectedAssets: true,
        },
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'OAuth connection not found',
        });
      }

      if (!isAssetProvider(connection.provider)) {
        return res.status(400).json({
          success: false,
          error: 'Asset selection is not supported',
        });
      }

      const assets = await listAccessibleOAuthAssets({
        userId: context.userId,
        workspaceId: context.workspaceId,
        connectionId,
        provider: connection.provider,
      });

      const availableIds = new Set(
        assets.map((asset) => asset.id)
      );

      const stored: unknown = connection.selectedAssets;

      let selected: unknown[] = [];

      if (
        stored &&
        typeof stored === 'object' &&
        !Array.isArray(stored) &&
        'assetIds' in stored &&
        Array.isArray(stored.assetIds)
      ) {
        selected = stored.assetIds;
      }

      // Do not report stale or no-longer-accessible assets
      // as currently selected and usable.
      const selectedAssetIds = [
        ...new Set(
          selected.filter(
            (id): id is string =>
              typeof id === 'string' &&
              availableIds.has(id)
          )
        ),
      ];

      return res.status(200).json({
        success: true,
        data: {
          provider: connection.provider,
          assets,
          selectedAssetIds,
        },
      });
    } catch {
      return res.status(503).json({
        success: false,
        error: 'Unable to retrieve OAuth assets',
      });
    }
  }
);

router.put(
  '/connections/:connectionId/assets',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const context = (req as OAuthWorkspaceRequest).oauthWorkspace;
    const connectionId = req.params.connectionId;

    if (!context) {
      return res.status(403).json({
        success: false,
        error: 'Workspace authorization required',
      });
    }

    if (!validConnectionId(connectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OAuth connection ID',
      });
    }

    const body: unknown = req.body;

    // Accept exactly one frontend field: assetIds.
    // Tokens, provider IDs and workspace IDs are not accepted.
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(body, 'assetIds')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset selection request',
      });
    }

    const assetIds = (
      body as Record<string, unknown>
    ).assetIds;

    if (
      !Array.isArray(assetIds) ||
      assetIds.length > 50 ||
      !assetIds.every(
        (id) =>
          typeof id === 'string' &&
          id.length > 0 &&
          id.length <= 256 &&
          id.trim() === id
      )
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset selection request',
      });
    }

    try {
      const result = await saveVerifiedOAuthAssetSelection({
        userId: context.userId,
        workspaceId: context.workspaceId,
        connectionId,
        assetIds,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '';

      if (
        message === 'Invalid OAuth asset selection' ||
        message === 'Duplicate OAuth asset selection' ||
        message ===
          'One or more selected assets are not accessible' ||
        message ===
          'Provider does not support asset selection'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or inaccessible asset selection',
        });
      }

      if (
        message === 'OAuth connection not authorized' ||
        message === 'Workspace owner permission required'
      ) {
        return res.status(403).json({
          success: false,
          error: 'OAuth asset selection not authorized',
        });
      }

      if (
        message === 'OAuth connection changed' ||
        message ===
          'OAuth connection changed; retry asset selection'
      ) {
        return res.status(409).json({
          success: false,
          error: 'OAuth connection changed; please retry',
        });
      }

      return res.status(503).json({
        success: false,
        error: 'Unable to save OAuth asset selection',
      });
    }
  }
);

export default router;