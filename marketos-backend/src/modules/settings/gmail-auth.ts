import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';

export type GmailAuthorizedRequest = Request & {
  gmailWorkspace?: {
    userId: string;
    workspaceId: string;
  };
};

export async function requireGmailWorkspaceOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = process.env.JWT_SECRET;

  // Never authorize access to Gmail credentials with a fallback secret.
  if (!secret || secret === 'secret' || secret.length < 32) {
    res.status(503).json({
      success: false,
      error: 'Secure JWT configuration is required',
    });
    return;
  }

  const authorization = req.headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!match) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  let userId: string;

  try {
    const payload = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
    });

    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string' ||
      !payload.userId
    ) {
      throw new Error('Invalid token payload');
    }

    userId = payload.userId;
  } catch {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired access token',
    });
    return;
  }

  try {
    const requestedId = req.body?.workspaceId ?? req.query.workspaceId;
    let workspaceId: string;

    if (requestedId !== undefined) {
      // Preserve explicit workspace selection for trusted API clients.
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
      });

      if (!membership || membership.role !== 'OWNER') {
        res.status(403).json({
          success: false,
          error: 'Workspace owner permission required',
        });
        return;
      }

      workspaceId = requestedId;
    } else {
      // The Gmail UI doesn't ask users for a workspace ID.
      // Resolve it only from the verified JWT identity.
      const owned = await prisma.workspaceMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { workspaceId: true },
        take: 2,
      });

      if (owned.length === 0) {
        res.status(403).json({
          success: false,
          error: 'No owned workspace found for this account',
        });
        return;
      }

      if (owned.length > 1) {
        res.status(409).json({
          success: false,
          error: 'Multiple workspaces found; workspace selection is required',
        });
        return;
      }

      workspaceId = owned[0].workspaceId;
    }

    (req as GmailAuthorizedRequest).gmailWorkspace = {
      userId,
      workspaceId,
    };

    next();
  } catch (error) {
    next(error);
  }
}