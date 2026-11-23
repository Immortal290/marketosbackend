import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

import type {
  AuthorizeOAuthOperationInput,
  OAuthConnectorOperation,
} from './oauth-agent-authorization';

export type OAuthAssetProvider =
  | 'ga4'
  | 'google_ads'
  | 'meta_ads'
  | 'linkedin';

export interface OAuthAsset {
  id: string;
  label: string;
  type:
    | 'ga4_property'
    | 'google_ads_customer'
    | 'meta_ad_account'
    | 'linkedin_ad_account';
}

const OPERATIONS: Record<
  OAuthAssetProvider,
  OAuthConnectorOperation
> = {
  ga4: 'ga4.read',
  google_ads: 'google_ads.manage',
  meta_ads: 'meta_ads.read',
  linkedin: 'linkedin.ads_reporting',
};

const MAX_PAGES = 10;
const MAX_ASSETS = 500;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid provider asset response');
  }

  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid provider asset list');
  }

  return value;
}

function label(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 160)
    : fallback;
}

function addAsset(
  assets: Map<string, OAuthAsset>,
  asset: OAuthAsset,
  pattern: RegExp
): void {
  if (!pattern.test(asset.id)) {
    throw new Error('Invalid provider asset identifier');
  }

  assets.set(asset.id, asset);

  if (assets.size > MAX_ASSETS) {
    throw new Error('Provider asset list exceeds supported limit');
  }
}

async function fetchAssetData(
  url: string,
  accessToken: string,
  extraHeaders: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    // Do not expose provider bodies or request credentials.
    throw new Error('Unable to retrieve provider assets');
  }

  return object(await response.json());
}

/**
 * Only trusted backend code receives the access token.
 * The returned list contains asset identifiers and labels, never tokens.
 */
export async function discoverOAuthAssets(
  provider: OAuthAssetProvider,
  accessToken: string
): Promise<OAuthAsset[]> {
  if (
    !Object.prototype.hasOwnProperty.call(OPERATIONS, provider)
  ) {
    throw new Error('Unsupported OAuth asset provider');
  }

  if (!accessToken?.trim()) {
    throw new Error('OAuth credential unavailable');
  }

  const assets = new Map<string, OAuthAsset>();

  if (provider === 'google_ads') {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!developerToken?.trim()) {
      throw new Error('Google Ads developer token not configured');
    }

    const data = await fetchAssetData(
      'https://googleads.googleapis.com/v26/customers:listAccessibleCustomers',
      accessToken,
      { 'developer-token': developerToken }
    );

    for (const value of array(data.resourceNames)) {
      if (typeof value !== 'string') {
        throw new Error('Invalid Google Ads customer');
      }

      addAsset(assets, {
        id: value,
        label: `Google Ads ${value.replace('customers/', '')}`,
        type: 'google_ads_customer',
      }, /^customers\/\d+$/);
    }

    // This endpoint lists directly accessible customers only.
    // Manager-account hierarchy discovery is separate.
    return [...assets.values()];
  }

  if (provider === 'ga4') {
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries'
      );

      url.searchParams.set('pageSize', '200');

      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const data = await fetchAssetData(
        url.toString(),
        accessToken
      );

      for (const entry of array(data.accountSummaries ?? [])) {
        const account = object(entry);

        for (const value of array(account.propertySummaries ?? [])) {
          const property = object(value);

          if (typeof property.property !== 'string') {
            throw new Error('Invalid GA4 property');
          }

          addAsset(assets, {
            id: property.property,
            label: label(property.displayName, property.property),
            type: 'ga4_property',
          }, /^properties\/\d+$/);
        }
      }

      if (
        data.nextPageToken !== undefined &&
        typeof data.nextPageToken !== 'string'
      ) {
        throw new Error('Invalid GA4 pagination');
      }

      pageToken = data.nextPageToken as string | undefined;

      if (!pageToken) return [...assets.values()];
    }

    throw new Error('GA4 asset pagination limit exceeded');
  }

  if (provider === 'meta_ads') {
    let after: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(
        'https://graph.facebook.com/v26.0/me/adaccounts'
      );

      url.searchParams.set('fields', 'id,name,account_status');
      url.searchParams.set('limit', '100');

      if (after) url.searchParams.set('after', after);

      const data = await fetchAssetData(
        url.toString(),
        accessToken
      );

      for (const value of array(data.data)) {
        const account = object(value);

        if (typeof account.id !== 'string') {
          throw new Error('Invalid Meta advertising account');
        }

        addAsset(assets, {
          id: account.id,
          label: label(account.name, account.id),
          type: 'meta_ad_account',
        }, /^act_\d+$/);
      }

      const paging = data.paging
        ? object(data.paging)
        : {};

      if (!paging.next) return [...assets.values()];

      const cursors = object(paging.cursors);
      const next = cursors.after;

      if (typeof next !== 'string' || !next) {
        throw new Error('Invalid Meta asset pagination');
      }

      // Rebuild the URL ourselves. Never follow paging.next
      // because an external URL must not control backend fetches.
      after = next;
    }

    throw new Error('Meta asset pagination limit exceeded');
  }

  let start = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(
      'https://api.linkedin.com/rest/adAccountUsers'
    );

    url.searchParams.set('q', 'authenticatedUser');
    url.searchParams.set('start', String(start));
    url.searchParams.set('count', '100');

    const data = await fetchAssetData(
      url.toString(),
      accessToken,
      {
        'LinkedIn-Version': '202609',
        'X-Restli-Protocol-Version': '2.0.0',
      }
    );

    const entries = array(data.elements);

    for (const value of entries) {
      const account = object(value);

      if (typeof account.account !== 'string') {
        throw new Error('Invalid LinkedIn advertising account');
      }

      addAsset(assets, {
        id: account.account,
        label: account.account,
        type: 'linkedin_ad_account',
      }, /^urn:li:sponsoredAccount:\d+$/);
    }

    if (!data.paging) return [...assets.values()];

    const paging = object(data.paging);
    const total = paging.total;

    if (
      typeof total !== 'number' ||
      !Number.isSafeInteger(total) ||
      total < 0
    ) {
      throw new Error('Invalid LinkedIn pagination');
    }

    start += entries.length;

    if (start >= total) return [...assets.values()];

    if (entries.length === 0) {
      throw new Error('Incomplete LinkedIn asset listing');
    }
  }

  throw new Error('LinkedIn asset pagination limit exceeded');
}

/**
 * Entry point used by authenticated backend routes.
 *
 * User ID must come from verified JWT authentication,
 * never an arbitrary frontend body or agent prompt.
 */
export async function listAccessibleOAuthAssets(input: {
  userId: string;
  workspaceId: string;
  connectionId: string;
  provider: OAuthAssetProvider;
}): Promise<OAuthAsset[]> {
  if (
    !Object.prototype.hasOwnProperty.call(
      OPERATIONS,
      input.provider
    )
  ) {
    throw new Error('Unsupported OAuth asset provider');
  }

  const authorization: AuthorizeOAuthOperationInput = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    operation: OPERATIONS[input.provider],
  };

  return executeAuthorizedOAuthOperation(
    authorization,
    (accessToken) => discoverOAuthAssets(
      input.provider,
      accessToken
    )
  );
}
