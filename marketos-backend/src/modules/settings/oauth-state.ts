import { createHash, randomBytes } from 'crypto';
import { redisClient } from '../../lib/redis';

const STATE_TTL_SECONDS = 600;
const REDIS_TIMEOUT_MS = 3000;
const STATE_PREFIX = 'marketos:oauth:state:';

export interface OAuthStateContext {
  userId: string;
  workspaceId: string;
  provider: string;
  codeVerifier: string;
  createdAt: number;
}

function assertNonempty(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('OAuth state storage unavailable')),
      REDIS_TIMEOUT_MS
    );
  });

  return Promise.race([operation, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

async function ensureRedisReady(): Promise<void> {
  if (redisClient.status === 'ready') return;

  if (redisClient.status === 'wait') {
    await withTimeout(redisClient.connect());
  }

  const response = await withTimeout(redisClient.ping());

  if (response !== 'PONG') {
    throw new Error('OAuth state storage unavailable');
  }
}

function requireRedisReady(): void {
  if (redisClient.status !== 'ready') {
    throw new Error('OAuth state storage unavailable');
  }
}

function stateKey(state: string): string {
  const digest = createHash('sha256')
    .update(state, 'utf8')
    .digest('hex');

  return STATE_PREFIX + digest;
}

function createPKCE() {
  const codeVerifier = randomBytes(32).toString('base64url');

  const codeChallenge = createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

export async function createOAuthState(input: {
  userId: string;
  workspaceId: string;
  provider: string;
}): Promise<{
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}> {
  assertNonempty(input.userId, 'User ID');
  assertNonempty(input.workspaceId, 'Workspace ID');
  assertNonempty(input.provider, 'Provider');

  const state = randomBytes(32).toString('base64url');
  const { codeVerifier, codeChallenge } = createPKCE();

  const context: OAuthStateContext = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    provider: input.provider,
    codeVerifier,
    createdAt: Date.now(),
  };

  await ensureRedisReady();

  requireRedisReady();

  const result = await withTimeout(
    redisClient.set(
      stateKey(state),
      JSON.stringify(context),
      'EX',
      STATE_TTL_SECONDS,
      'NX'
    )
  );

  if (result !== 'OK') {
    throw new Error('Failed to create OAuth authorization state');
  }

  return {
    state,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

export async function consumeOAuthState(
  state: string,
  expectedProvider: string | readonly string[]
): Promise<OAuthStateContext> {
  assertNonempty(state, 'OAuth state');

  const allowedProviders = Array.isArray(expectedProvider)
    ? expectedProvider
    : [expectedProvider];

  if (
    allowedProviders.length === 0 ||
    allowedProviders.some(
      provider => typeof provider !== 'string' || !provider.trim()
    )
  ) {
    throw new Error('Valid expected OAuth providers are required');
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new Error('Invalid OAuth state');
  }

  await ensureRedisReady();

  // GETDEL ensures the state can only be consumed once.
  requireRedisReady();
  const stored = await withTimeout(redisClient.getdel(stateKey(state)));

  if (!stored) {
    throw new Error('OAuth state is invalid, expired, or already used');
  }

  let context: OAuthStateContext;

  try {
    context = JSON.parse(stored);
  } catch {
    throw new Error('Invalid stored OAuth state');
  }

  if (
    !context ||
    typeof context.userId !== 'string' ||
    !context.userId.trim() ||
    typeof context.workspaceId !== 'string' ||
    !context.workspaceId.trim() ||
    typeof context.provider !== 'string' ||
    !allowedProviders.includes(context.provider) ||
    typeof context.codeVerifier !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(context.codeVerifier) ||
    typeof context.createdAt !== 'number' ||
    !Number.isFinite(context.createdAt) ||
    context.createdAt > Date.now() ||
    Date.now() - context.createdAt > STATE_TTL_SECONDS * 1000
  ) {
    throw new Error('Invalid OAuth authorization context');
  }

  return context;
}
