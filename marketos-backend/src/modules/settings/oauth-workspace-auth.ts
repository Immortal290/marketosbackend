import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import type { AuthenticatedRequest } from '../../middlewares/jwt-auth.middleware';

export type OAuthWorkspaceRequest = AuthenticatedRequest & {
  oauthWorkspace?: {
    userId: string;
    workspaceId: string;
  };
};

export async function requireOAuthWorkspaceOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as AuthenticatedRequest).user?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  try {
    const requestedId = req.body?.workspaceId ?? req.query.workspaceId;
    let workspaceId: string;

    if (requestedId !== undefined) {
      if (typeof requestedId !== 'string' || !requestedId.trim()) {
        res.status(400).json({
          success: false,
          error: 'Invalid workspace ID',
        });
        return;
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: requestedId,
          },
        },
        select: { role: true },
      });

      if (membership?.role !== 'OWNER') {
        res.status(403).json({
          success: false,
          error: 'Workspace owner permission required',
        });
        return;
      }

      workspaceId = requestedId;
    } else {
      const owned = await prisma.workspaceMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { workspaceId: true },
        take: 2,
      });

      if (owned.length === 0) {
        res.status(403).json({
          success: false,
          error: 'No owned workspace found',
        });
        return;
      }

      if (owned.length > 1) {
        res.status(409).json({
          success: false,
          error: 'Workspace selection is required',
        });
        return;
      }

      workspaceId = owned[0].workspaceId;
    }

    (req as OAuthWorkspaceRequest).oauthWorkspace = {
      userId,
      workspaceId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
