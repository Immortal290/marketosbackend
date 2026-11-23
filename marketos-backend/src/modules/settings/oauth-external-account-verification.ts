import {
  ExternalOAuthProvider,
  getExternalOAuthCredentials,
} from './oauth-external-providers';

export interface VerifiedExternalAccount {
  providerAccountId: string;
  accountLabel: string;
  grantedScopes: string[];
  dataCenter?: string;
  availableAssets?: string[];
}

function requireIdentifier(value: unknown, label: string): string {
  const id = typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';

  if (!id || id.length > 256) {
    throw new Error(`Invalid verified ${label}`);
  }

  return id;
}

function readScopes(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...new Set(value.split(/[,\s]+/).filter(Boolean))];
  }

  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string')
  ) {
    return [...new Set(value.filter(Boolean))];
  }

  return [];
}

function requireScopes(
  granted: string[],
  required: readonly string[]
): void {
  if (!required.every((scope) => granted.includes(scope))) {
    throw new Error('Required OAuth permissions not granted');
  }
}

async function requestVerifiedData(
  url: string,
  options: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error('OAuth account verification failed');
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error('Invalid OAuth account metadata');
  }

  return data as Record<string, unknown>;
}

export async function verifyExternalOAuthAccount(input: {
  provider: ExternalOAuthProvider;
  accessToken: string;
}): Promise<VerifiedExternalAccount> {
  if (
    typeof input.accessToken !== 'string' ||
    !input.accessToken.trim()
  ) {
    throw new Error('Missing OAuth access token');
  }

  if (input.provider === 'mailchimp') {
    const data = await requestVerifiedData(
      'https://login.mailchimp.com/oauth2/metadata',
      {
        headers: {
          Authorization: `OAuth ${input.accessToken}`,
        },
      }
    );

    const id = requireIdentifier(data.user_id, 'Mailchimp user ID');
    const dc = requireIdentifier(data.dc, 'Mailchimp data center');

    if (!/^[a-z]{2}\d{1,2}$/.test(dc)) {
      throw new Error('Invalid Mailchimp data center');
    }

    const label =
      typeof data.accountname === 'string' &&
      data.accountname.trim()
        ? data.accountname.trim()
        : `Mailchimp account ${id}`;

    return {
      providerAccountId: id,
      accountLabel: label,
      grantedScopes: [],
      dataCenter: dc,
    };
  }

  const credentials = getExternalOAuthCredentials(input.provider);

  if (input.provider === 'hubspot') {
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      token_type_hint: 'access_token',
      token: input.accessToken,
    });

    const data = await requestVerifiedData(
      'https://api.hubapi.com/oauth/2026-09/token/introspect',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    if (
      data.active !== true ||
      data.client_id !== credentials.clientId
    ) {
      throw new Error('HubSpot token verification failed');
    }

    const id = requireIdentifier(data.hub_id, 'HubSpot account ID');
    const scopes = readScopes(data.scopes);

    requireScopes(scopes, ['crm.objects.contacts.read']);

    return {
      providerAccountId: id,
      accountLabel:
        typeof data.hub_domain === 'string' &&
        data.hub_domain.trim()
          ? data.hub_domain.trim()
          : `HubSpot ${id}`,
      grantedScopes: scopes,
    };
  }

  if (input.provider === 'meta_ads') {
    const url = new URL(
      'https://graph.facebook.com/v26.0/debug_token'
    );

    url.searchParams.set('input_token', input.accessToken);
    url.searchParams.set(
      'access_token',
      `${credentials.clientId}|${credentials.clientSecret}`
    );

    // URL contains private credentials; never log it.
    const response = await requestVerifiedData(
      url.toString(),
      { method: 'GET' }
    );

    const data = response.data;

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error('Invalid Meta token metadata');
    }

    const metadata = data as Record<string, unknown>;

    if (
      metadata.is_valid !== true ||
      String(metadata.app_id) !== credentials.clientId ||
      metadata.type !== 'USER'
    ) {
      throw new Error('Meta OAuth token verification failed');
    }

    const expiry = Number(metadata.expires_at);

    if (
      !Number.isFinite(expiry) ||
      expiry * 1000 <= Date.now() + 30000
    ) {
      throw new Error('Meta OAuth token expired');
    }

    const scopes = readScopes(metadata.scopes);
    requireScopes(scopes, ['ads_read']);

    const id = requireIdentifier(
      metadata.user_id,
      'Meta user ID'
    );

    return {
      providerAccountId: id,
      accountLabel: `Meta advertising user ${id}`,
      grantedScopes: scopes,
    };
  }

  if (input.provider === 'linkedin') {
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      token: input.accessToken,
    });

    const data = await requestVerifiedData(
      'https://www.linkedin.com/oauth/v2/introspectToken',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    if (
      data.active !== true ||
      data.client_id !== credentials.clientId ||
      (data.auth_type !== undefined &&
        data.auth_type !== '3L')
    ) {
      throw new Error('LinkedIn OAuth token verification failed');
    }

    const scopes = readScopes(data.scope);

    requireScopes(scopes, ['r_ads', 'r_ads_reporting']);

    const accounts = await requestVerifiedData(
      'https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'LinkedIn-Version': '202609',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    if (!Array.isArray(accounts.elements)) {
      throw new Error('Invalid LinkedIn advertising accounts');
    }

    const elements = accounts.elements as unknown[];
    const userIds = new Set<string>();
    const assets = new Set<string>();

    for (const element of elements) {
      if (
        !element ||
        typeof element !== 'object' ||
        Array.isArray(element)
      ) {
        throw new Error('Invalid LinkedIn advertising account');
      }

      const record = element as Record<string, unknown>;

      if (
        typeof record.user !== 'string' ||
        !/^urn:li:person:[A-Za-z0-9_-]+$/.test(record.user) ||
        typeof record.account !== 'string' ||
        !/^urn:li:sponsoredAccount:\d+$/.test(record.account)
      ) {
        throw new Error('Invalid LinkedIn account ownership');
      }

      userIds.add(record.user);
      assets.add(record.account);
    }

    if (userIds.size !== 1 || assets.size === 0) {
      throw new Error('No verified LinkedIn advertising account');
    }

    const id = [...userIds][0];

    return {
      providerAccountId: id,
      accountLabel: `LinkedIn advertising (${assets.size} accounts)`,
      grantedScopes: scopes,
      availableAssets: [...assets],
    };
  }

  throw new Error('Unsupported external OAuth provider');
}
