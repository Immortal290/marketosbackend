import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export const requireClerkAuth = async (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No active Clerk session',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    // 1. Fetch user profile details from Clerk
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'No email address associated with Clerk user',
        code: 'BAD_REQUEST'
      });
    }

    // 2. Find or create matching local user in PostgreSQL
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Just-In-Time (JIT) provisioning for Clerk/Google OAuth users
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
        },
      });

      // Auto-provision a default workspace for new OAuth users
      const workspaceName = clerkUser.firstName 
        ? `${clerkUser.firstName}'s Workspace`
        : 'Default Workspace';

      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'OWNER',
        },
      });
    }

    // 3. Attach standard user metadata for downstream controllers
    (req as any).user = {
      userId: user.id,
      email: user.email,
      clerkId: auth.userId,
    };

    next();
  } catch (error) {
    console.error('Clerk Authentication Middleware Error:', error);
    next(error);
  }
};
