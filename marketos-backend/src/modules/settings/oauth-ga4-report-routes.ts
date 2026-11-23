import { analyzeAuthorizedGA4 } from './oauth-ga4-agent-bridge';
import { Router, Request, Response } from 'express';

import { requireJwtAuth } from '../../middlewares/jwt-auth.middleware';

import {
  requireOAuthWorkspaceOwner,
} from './oauth-workspace-auth';

import type {
  OAuthWorkspaceRequest,
} from './oauth-workspace-auth';

import {
  getAuthorizedGA4Summary,
} from './oauth-agent-ga4-report';

const router = Router();

router.get(
  '/connections/:connectionId/ga4-summary',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const context =
      (req as OAuthWorkspaceRequest).oauthWorkspace;

    if (!context) {
      return res.status(403).json({
        success: false,
        error: 'Workspace authorization required',
      });
    }

    const connectionId = req.params.connectionId;
    const propertyId = req.query.propertyId;

    if (
      typeof connectionId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(connectionId) ||
      typeof propertyId !== 'string' ||
      !/^properties\/[1-9]\d{0,18}$/.test(propertyId)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GA4 reporting request',
      });
    }

    try {
      // Identity always comes from verified authentication.
      // The query cannot supply a workspace or user identity.
      const summary = await getAuthorizedGA4Summary({
        userId: context.userId,
        workspaceId: context.workspaceId,
        connectionId,
        propertyId,
      });

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '';

      if (
        message === 'GA4 property is not authorized' ||
        message === 'OAuth workspace access denied' ||
        message === 'OAuth connection not authorized' ||
        message === 'Required OAuth permission not granted'
      ) {
        return res.status(403).json({
          success: false,
          error: 'GA4 reporting access denied',
        });
      }

      // Never return provider error bodies, tokens or secrets.
      return res.status(503).json({
        success: false,
        error: 'GA4 report unavailable',
      });
    }
  }
);

router.post(
  '/connections/:connectionId/ga4-analysis',
  requireJwtAuth,
  requireOAuthWorkspaceOwner,
  async (req: Request, res: Response) => {
    const context =
      (req as OAuthWorkspaceRequest).oauthWorkspace;

    if (!context) {
      return res.status(403).json({
        success: false,
        error: 'Workspace authorization required',
      });
    }

    const connectionId = req.params.connectionId;
    const propertyId = req.body?.propertyId;

    if (
      typeof connectionId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(connectionId) ||
      typeof propertyId !== 'string' ||
      !/^properties\/[1-9]\d{0,18}$/.test(propertyId)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GA4 analysis request',
      });
    }

    try {
      const result = await analyzeAuthorizedGA4({
        userId: context.userId,
        workspaceId: context.workspaceId,
        connectionId,
        propertyId,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '';

      if (
        message === 'GA4 property is not authorized' ||
        message === 'OAuth workspace access denied' ||
        message === 'Required OAuth permission not granted'
      ) {
        return res.status(403).json({
          success: false,
          error: 'GA4 access denied',
        });
      }

      return res.status(503).json({
        success: false,
        error: 'GA4 analysis unavailable',
      });
    }
  }
);
export default router;