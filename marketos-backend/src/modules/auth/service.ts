
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { OAuth2Client } from 'google-auth-library';

class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export class AuthService {
  private getSecrets() {
    const access = process.env.JWT_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;

    if (!access || !refresh) {
      throw new AuthError(
        'Authentication is not configured',
        500
      );
    }

    return { access, refresh };
  }

  async register(data: RegisterDto) {
    const email = data.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AuthError('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const emailPrefix = email.split('@')[0];

    try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: data.firstName?.trim() || null,
            lastName: data.lastName?.trim() || null,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            name:
              data.workspaceName?.trim() ||
              `${data.firstName?.trim() || emailPrefix}'s Workspace`,
          },
        });

        await tx.workspaceMember.create({
          data: {
            userId: createdUser.id,
            workspaceId: workspace.id,
            role: 'OWNER',
          },
        });

        return createdUser;
      });

      return await this.createSessionTokens(user.id);
    } catch (error) {
      if (
        error instanceof AuthError
      ) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new AuthError('Email already registered', 409);
      }

      throw error;
    }
  }

  async login(data: LoginDto) {
    const email = data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.password ||
      !user.isActive ||
      !(await bcrypt.compare(data.password, user.password))
    ) {
      throw new AuthError('Invalid credentials', 401);
    }

    return this.createSessionTokens(user.id);
  }

  async refresh(refreshToken: string) {
    const { refresh } = this.getSecrets();

    let payload: JwtPayload;

    try {
      const verified = jwt.verify(refreshToken, refresh);

      if (
        typeof verified === 'string' ||
        typeof verified.userId !== 'string' ||
        !verified.userId
      ) {
        throw new Error('Invalid token payload');
      }

      payload = verified;
    } catch {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash },
    });

    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true },
    });

    if (!user?.isActive) {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    // Only one concurrent request can rotate this session.
    const revoked = await prisma.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (revoked.count !== 1) {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    return this.createSessionTokens(session.userId);
  }

  async logout(refreshToken: string) {
    await prisma.authSession.updateMany({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthError('User not found', 404);
    }

    return user;
  }

  private async createSessionTokens(userId: string) {
    const { access, refresh } = this.getSecrets();

    const accessToken = jwt.sign(
      { userId },
      access,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any }
    );

    const refreshToken = jwt.sign(
      { userId, tokenId: randomUUID() },
      refresh,
      {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
      }
    );

    const decoded = jwt.decode(refreshToken) as JwtPayload | null;

    if (!decoded?.exp) {
      throw new AuthError('Could not create session', 500);
    }

    await prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
    };
  }

  async googleLogin(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new AuthError('Google sign-in is not configured', 500);
    }

    const client = new OAuth2Client(clientId);
    let payload;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      payload = ticket.getPayload();
    } catch {
      throw new AuthError('Invalid Google ID token', 401);
    }

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      throw new AuthError('Google account email is not verified', 401);
    }

    const email = payload.email.trim().toLowerCase();

    const identity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'GOOGLE',
          providerUserId: payload.sub,
        },
      },
      include: { user: true },
    });

    if (identity) {
      if (!identity.user.isActive) {
        throw new AuthError('This account is disabled', 403);
      }

      return this.createSessionTokens(identity.userId);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AuthError(
        'This email already has an account. Log in with your existing method first.',
        409,
      );
    }

    const firstName = payload.given_name?.trim() || null;
    const lastName = payload.family_name?.trim() || null;
    const workspaceName = firstName
      ? `${firstName}'s Workspace`
      : `${email.split('@')[0]}'s Workspace`;

    try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            password: null,
            firstName,
            lastName,
          },
        });

        const workspace = await tx.workspace.create({
          data: { name: workspaceName },
        });

        await tx.workspaceMember.create({
          data: {
            userId: createdUser.id,
            workspaceId: workspace.id,
            role: 'OWNER',
          },
        });

        await tx.authIdentity.create({
          data: {
            userId: createdUser.id,
            provider: 'GOOGLE',
            providerUserId: payload.sub,
          },
        });

        return createdUser;
      });

      return this.createSessionTokens(user.id);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new AuthError(
          'This account may already exist. Please try signing in again.',
          409,
        );
      }

      throw error;
    }
  }
}
