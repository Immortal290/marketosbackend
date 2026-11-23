import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  saveOAuthConnection,
  getOAuthTokens,
  getOAuthRefreshSnapshot,
  updateRefreshedOAuthAccessToken,
  markOAuthReconnectRequired,
  removeOAuthConnectionIfUnchanged,
  listOAuthConnections,
} from './oauth-storage';

const workspaceId = '00000000-0000-4000-8000-000000000201';
const ownerId = '00000000-0000-4000-8000-000000000101';
const provider = 'gmail';
const providerAccountId = `oauth-integration-${randomUUID()}`;
const originalToken = `fake-access-${randomUUID()}`;
const originalRefresh = `fake-refresh-${randomUUID()}`;
const replacementToken = `fake-replacement-${randomUUID()}`;

let connectionId: string | undefined;
let initialCiphertext = '';
let replacementCiphertext = '';
let databaseVerified = false;

beforeAll(async () => {
  if (
    process.env.OAUTH_INTEGRATION_TEST !== 'YES_ISOLATED_ONLY'
  ) {
    throw new Error('Isolated OAuth test approval missing');
  }

  const url = new URL(process.env.DATABASE_URL || 'http://invalid');

  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== 'db' ||
    url.username !== 'oauth_test' ||
    url.pathname !== '/marketos_oauth_test'
  ) {
    throw new Error('STOP: Unexpected database connection');
  }

  if (
    !/^[0-9a-f]{64}$/i.test(
      process.env.OAUTH_CREDENTIAL_KEY_HEX || ''
    )
  ) {
    throw new Error('OAuth test encryption key missing');
  }

  const rows = await prisma.$queryRaw<
    { database_name: string; username: string }[]
  >`
    SELECT current_database() AS database_name,
           current_user AS username
  `;

  if (
    rows[0]?.database_name !== 'marketos_oauth_test' ||
    rows[0]?.username !== 'oauth_test'
  ) {
    throw new Error('STOP: Connected to unexpected PostgreSQL database');
  }

  databaseVerified = true;

  const connection = await saveOAuthConnection({
    workspaceId,
    connectedByUserId: ownerId,
    provider,
    providerAccountId,
    accountLabel: 'integration-test@example.invalid',
    accessToken: originalToken,
    refreshToken: originalRefresh,
    grantedScopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    tokenExpiresAt: new Date(Date.now() + 3600000),
  });

  connectionId = connection.id;
}, 30000);

afterAll(async () => {
  try {
    if (databaseVerified) {
      await prisma.oAuthConnection.deleteMany({
        where: {
          workspaceId,
          provider,
          providerAccountId,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}, 30000);

describe('OAuth PostgreSQL token lifecycle', () => {
  test('stores encrypted credentials and decrypts them internally', async () => {
    const record = await prisma.oAuthConnection.findUniqueOrThrow({
      where: { id: connectionId! },
    });

    initialCiphertext = record.encryptedAccessToken;

    expect(record.encryptedAccessToken).not.toContain(originalToken);
    expect(record.encryptedRefreshToken).not.toContain(originalRefresh);

    const tokens = await getOAuthTokens(
      workspaceId,
      provider,
      connectionId!
    );

    expect(tokens?.accessToken).toBe(originalToken);
    expect(tokens?.refreshToken).toBe(originalRefresh);
  });

  test('rejects expired access tokens', async () => {
    await prisma.oAuthConnection.update({
      where: { id: connectionId! },
      data: {
        tokenExpiresAt: new Date(Date.now() - 60000),
      },
    });

    const expired = await getOAuthTokens(
      workspaceId,
      provider,
      connectionId!
    );

    expect(expired).toBeNull();

    await prisma.oAuthConnection.update({
      where: { id: connectionId! },
      data: {
        tokenExpiresAt: new Date(Date.now() + 3600000),
      },
    });
  });
  test('conditionally updates the encrypted access token', async () => {
    const snapshot = await getOAuthRefreshSnapshot(
      workspaceId,
      provider,
      connectionId!
    );

    expect(snapshot?.refreshToken).toBe(originalRefresh);

    const updated = await updateRefreshedOAuthAccessToken({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: snapshot!.encryptedAccessToken,
      newAccessToken: replacementToken,
      expiresIn: 3600,
    });

    expect(updated).toBe(true);

    const record = await prisma.oAuthConnection.findUniqueOrThrow({
      where: { id: connectionId! },
    });

    replacementCiphertext = record.encryptedAccessToken;

    expect(replacementCiphertext).not.toBe(initialCiphertext);
    expect(record.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const tokens = await getOAuthTokens(
      workspaceId,
      provider,
      connectionId!
    );

    expect(tokens?.accessToken).toBe(replacementToken);
    expect(tokens?.refreshToken).toBe(originalRefresh);
  });

  test('rejects an outdated token update', async () => {
    const updated = await updateRefreshedOAuthAccessToken({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: initialCiphertext,
      newAccessToken: 'fake-stale-token',
      expiresIn: 3600,
    });

    expect(updated).toBe(false);
  });

  test('rejects stale revocation attempts', async () => {
    const marked = await markOAuthReconnectRequired({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: initialCiphertext,
    });

    expect(marked).toBe(false);
  });

  test('persists reconnection status and blocks active-token access', async () => {
    const marked = await markOAuthReconnectRequired({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: replacementCiphertext,
    });

    expect(marked).toBe(true);

    const connections = await listOAuthConnections(workspaceId);
    const connection = connections.find(
      item => item.id === connectionId
    );

    expect(connection?.connectionStatus).toBe('RECONNECT_REQUIRED');

    const tokens = await getOAuthTokens(
      workspaceId,
      provider,
      connectionId!
    );

    expect(tokens).toBeNull();
  });

  test('rejects token updates after reconnection becomes required', async () => {
    const updated = await updateRefreshedOAuthAccessToken({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: replacementCiphertext,
      newAccessToken: 'fake-inactive-token',
      expiresIn: 3600,
    });

    expect(updated).toBe(false);
  });
  test('rejects stale connection deletion', async () => {
    const removed = await removeOAuthConnectionIfUnchanged({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: initialCiphertext,
    });

    expect(removed).toBe(false);

    const record = await prisma.oAuthConnection.findUnique({
      where: { id: connectionId! },
    });

    expect(record).not.toBeNull();
  });

  test('removes the matching OAuth connection', async () => {
    const removed = await removeOAuthConnectionIfUnchanged({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: replacementCiphertext,
    });

    expect(removed).toBe(true);

    const record = await prisma.oAuthConnection.findUnique({
      where: { id: connectionId! },
    });

    expect(record).toBeNull();
  });

  test('cannot delete an already removed connection', async () => {
    const removed = await removeOAuthConnectionIfUnchanged({
      workspaceId,
      provider,
      connectionId: connectionId!,
      expectedEncryptedAccessToken: replacementCiphertext,
    });

    expect(removed).toBe(false);
  });
});
