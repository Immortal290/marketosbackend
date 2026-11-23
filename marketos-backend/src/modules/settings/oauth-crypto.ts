import crypto from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

type TokenKind = 'access' | 'refresh';

function getKey(): Buffer {
  const value = process.env.OAUTH_CREDENTIAL_KEY_HEX;

  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      'OAUTH_CREDENTIAL_KEY_HEX must contain a 256-bit hexadecimal key'
    );
  }

  return Buffer.from(value, 'hex');
}

function getAAD(
  workspaceId: string,
  provider: string,
  connectionId: string,
  kind: TokenKind
): Buffer {
  if (
    !workspaceId?.trim() ||
    !provider?.trim() ||
    !connectionId?.trim()
  ) {
    throw new Error('Valid OAuth connection context is required');
  }

  return Buffer.from(
    JSON.stringify([
      'marketos-oauth',
      workspaceId,
      provider,
      connectionId,
      kind,
    ]),
    'utf8'
  );
}

export function encryptOAuthToken(
  token: string,
  workspaceId: string,
  provider: string,
  connectionId: string,
  kind: TokenKind
): string {
  if (!token) {
    throw new Error('OAuth token is required');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  cipher.setAAD(getAAD(workspaceId, provider, connectionId, kind));

  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptOAuthToken(
  encrypted: string,
  workspaceId: string,
  provider: string,
  connectionId: string,
  kind: TokenKind
): string {
  const parts = encrypted.split('.');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported OAuth token format');
  }

  const [, encodedIv, encodedTag, encodedCiphertext] = parts;

  const iv = Buffer.from(encodedIv, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  const ciphertext = Buffer.from(encodedCiphertext, 'base64url');

  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) {
    throw new Error('Invalid OAuth token format');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  decipher.setAAD(getAAD(workspaceId, provider, connectionId, kind));
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
