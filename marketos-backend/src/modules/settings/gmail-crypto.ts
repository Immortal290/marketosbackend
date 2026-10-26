import crypto from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const value = process.env.GMAIL_CREDENTIAL_KEY_HEX;

  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      'GMAIL_CREDENTIAL_KEY_HEX must be configured as 64 hexadecimal characters'
    );
  }

  return Buffer.from(value, 'hex');
}

function getWorkspaceAAD(workspaceId: string): Buffer {
  if (!workspaceId || !workspaceId.trim()) {
    throw new Error('A valid workspace ID is required');
  }

  return Buffer.from(`gmail-credential:${workspaceId}`, 'utf8');
}

export function encryptGmailCredential(
  appPassword: string,
  workspaceId: string
): string {
  if (typeof appPassword !== 'string' || !appPassword) {
    throw new Error('Gmail App Password is required');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(getWorkspaceAAD(workspaceId));

  const ciphertext = Buffer.concat([
    cipher.update(appPassword, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptGmailCredential(
  encryptedValue: string,
  workspaceId: string
): string {
  const parts = encryptedValue.split('.');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported Gmail credential format');
  }

  const [, ivEncoded, tagEncoded, ciphertextEncoded] = parts;

  const iv = Buffer.from(ivEncoded, 'base64url');
  const tag = Buffer.from(tagEncoded, 'base64url');
  const ciphertext = Buffer.from(ciphertextEncoded, 'base64url');

  if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) {
    throw new Error('Invalid Gmail credential format');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  decipher.setAAD(getWorkspaceAAD(workspaceId));
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}