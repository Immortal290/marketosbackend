import { prisma } from '../../lib/prisma';
import { encryptGmailCredential } from './gmail-crypto';

/**
 * Internal Gmail credential storage.
 *
 * Call saveVerifiedGmailConnection only after successful SMTP verification.
 * HTTP routes must independently enforce authenticated workspace ownership.
 */

export async function saveVerifiedGmailConnection(
  workspaceId: string,
  gmailAddress: string,
  appPassword: string
) {
  if (!workspaceId?.trim()) {
    throw new Error('Workspace ID is required');
  }

  const normalizedEmail = gmailAddress?.trim().toLowerCase();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid Gmail account address is required');
  }

  const normalizedPassword = appPassword?.replace(/\s/g, '');

  if (!normalizedPassword || !/^[a-zA-Z0-9]{16}$/.test(normalizedPassword)) {
    throw new Error('A valid 16-character Gmail App Password is required');
  }

  const encryptedAppPassword = encryptGmailCredential(
    normalizedPassword,
    workspaceId
  );

  const connection = await prisma.gmailConnection.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      gmailAddress: normalizedEmail,
      encryptedAppPassword,
      lastVerifiedAt: new Date(),
    },
    update: {
      gmailAddress: normalizedEmail,
      encryptedAppPassword,
      lastVerifiedAt: new Date(),
    },
    select: {
      workspaceId: true,
      gmailAddress: true,
      lastVerifiedAt: true,
    },
  });

  return {
    connected: true,
    gmailAddress: connection.gmailAddress,
    lastVerifiedAt: connection.lastVerifiedAt,
  };
}

export async function getGmailConnectionStatus(workspaceId: string) {
  if (!workspaceId?.trim()) {
    throw new Error('Workspace ID is required');
  }

  const connection = await prisma.gmailConnection.findUnique({
    where: { workspaceId },
    select: {
      gmailAddress: true,
      lastVerifiedAt: true,
    },
  });

  if (!connection) {
    return {
      connected: false,
      gmailAddress: null,
      lastVerifiedAt: null,
    };
  }

  return {
    connected: true,
    gmailAddress: connection.gmailAddress,
    lastVerifiedAt: connection.lastVerifiedAt,
  };
}

export async function disconnectGmailConnection(workspaceId: string) {
  if (!workspaceId?.trim()) {
    throw new Error('Workspace ID is required');
  }

  await prisma.gmailConnection.deleteMany({
    where: { workspaceId },
  });

  return { connected: false };
}
