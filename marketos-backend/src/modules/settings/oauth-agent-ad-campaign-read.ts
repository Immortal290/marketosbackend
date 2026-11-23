import { prisma } from '../../lib/prisma';
import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import { listAccessibleOAuthAssets } from './oauth-asset-discovery';

export type CampaignProvider = 'google_ads' | 'meta_ads' | 'linkedin';

export interface AdCampaignReadInput {
  userId: string;
  workspaceId: string;
  connectionId: string;
  assetId: string;
}

/**
 * Require the selected ad account to belong to this exact owner/workspace/connection,
 * and still be accessible at the provider. Never trust a client-provided account alone.
 */
async function requireAuthorizedSelectedAsset(
  input: AdCampaignReadInput,
  provider: CampaignProvider
): Promise<void> {
  const connection = await prisma.oAuthConnection.findFirst({
    where: {
      id: input.connectionId,
      workspaceId: input.workspaceId,
      connectedByUserId: input.userId,
      provider,
      connectionStatus: 'ACTIVE',
    },
    select: { selectedAssets: true },
  });

  if (!connection) {
    throw new Error('OAuth connection not authorized');
  }

  const stored: unknown = connection.selectedAssets;
  const ids = stored && typeof stored === 'object' &&
    !Array.isArray(stored) && 'assetIds' in stored &&
    Array.isArray(stored.assetIds)
    ? stored.assetIds
    : [];

  if (!ids.some((id: unknown) => id === input.assetId)) {
    throw new Error('Selected OAuth asset not authorized');
  }

  const accessible = await listAccessibleOAuthAssets({
    userId: input.userId,
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    provider,
  });

  if (!accessible.some((asset) => asset.id === input.assetId)) {
    throw new Error('OAuth asset access revoked');
  }
}

async function providerJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Provider response bodies can contain identifying information; never expose them.
    throw new Error(`Advertising report unavailable (HTTP ${response.status})`);
  }
  return response.json();
}

/** Read only: Google Ads searchStream performs a reporting query (no mutation). */
export async function readAuthorizedGoogleAdsCampaigns(input: AdCampaignReadInput) {
  const match = /^(?:customers\/)?(\d{10})$/.exec(input.assetId);
  if (!match) throw new Error('Invalid Google Ads customer ID');

  await requireAuthorizedSelectedAsset(input, 'google_ads');

  return executeAuthorizedOAuthOperation(
    { ...input, operation: 'google_ads.manage' },
    async (token) => {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!developerToken?.trim()) {
        throw new Error('Google Ads developer token not configured');
      }
      const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
      if (loginId && !/^\d{10}$/.test(loginId)) {
        throw new Error('Invalid Google Ads manager customer ID');
      }

      const data = await providerJson(
        `https://googleads.googleapis.com/v26/customers/${match[1]}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'developer-token': developerToken,
            ...(loginId ? { 'login-customer-id': loginId } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'SELECT campaign.id, campaign.name, campaign.status FROM campaign LIMIT 50',
          }),
        }
      );
      if (!Array.isArray(data) || data.some((part: any) => !Array.isArray(part?.results))) {
        throw new Error('Invalid Google Ads campaign response');
      }
      const campaigns = data.flatMap((part: any) => part.results).slice(0, 50);
      return {
        provider: 'google_ads' as const,
        assetId: input.assetId,
        campaigns: campaigns.map((row: any) => ({
          id: String(row?.campaign?.id ?? ''),
          name: String(row?.campaign?.name ?? ''),
          status: String(row?.campaign?.status ?? ''),
        })),
      };
    }
  );
}

/** Read only: Meta Marketing API campaign listing. */
export async function readAuthorizedMetaAdsCampaigns(input: AdCampaignReadInput) {
  const match = /^(?:act_)?(\d{1,20})$/.exec(input.assetId);
  if (!match) throw new Error('Invalid Meta advertising account ID');

  await requireAuthorizedSelectedAsset(input, 'meta_ads');

  return executeAuthorizedOAuthOperation(
    { ...input, operation: 'meta_ads.read' },
    async (token) => {
      const version = process.env.META_GRAPH_API_VERSION || 'v27.0';
      if (!/^v\d{1,2}\.\d{1,2}$/.test(version)) {
        throw new Error('Invalid Meta Graph API version');
      }
      const url = new URL(
        `https://graph.facebook.com/${version}/act_${match[1]}/campaigns`
      );
      url.searchParams.set('fields', 'id,name,status,effective_status');
      url.searchParams.set('limit', '50');
      const data = await providerJson(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!Array.isArray(data?.data)) {
        throw new Error('Invalid Meta advertising campaign response');
      }
      return {
        provider: 'meta_ads' as const,
        assetId: input.assetId,
        campaigns: data.data.slice(0, 50).map((item: any) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
          status: String(item.effective_status ?? item.status ?? ''),
        })),
      };
    }
  );
}

/**
 * Read-only LinkedIn account analytics using the existing r_ads_reporting grant.
 * Version is validated and the account must be selected and still accessible.
 */
export async function readAuthorizedLinkedInAnalytics(input: AdCampaignReadInput) {
  const match = /^(?:urn:li:sponsoredAccount:)?(\d{1,20})$/.exec(input.assetId);
  if (!match) throw new Error('Invalid LinkedIn sponsored account ID');

  await requireAuthorizedSelectedAsset(input, 'linkedin');

  return executeAuthorizedOAuthOperation(
    { ...input, operation: 'linkedin.ads_reporting' },
    async (token) => {
      const version = process.env.LINKEDIN_MARKETING_VERSION || '202609';
      if (!/^20\d{4}$/.test(version)) {
        throw new Error('Invalid LinkedIn marketing API version');
      }

      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      const date = (d: Date) =>
        `year:${d.getUTCFullYear()},month:${d.getUTCMonth() + 1},day:${d.getUTCDate()}`;
      const dateRange = `(start:(${date(start)}),end:(${date(end)}))`;
      const account = `urn:li:sponsoredAccount:${match[1]}`;
      const url =
        'https://api.linkedin.com/rest/adAnalytics' +
        '?q=analytics' +
        `&dateRange=${encodeURIComponent(dateRange)}` +
        '&timeGranularity=ALL' +
        `&accounts=List(${encodeURIComponent(account)})` +
        '&pivot=ACCOUNT' +
        '&fields=impressions,clicks,costInLocalCurrency,pivotValues';
      const data = await providerJson(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Linkedin-Version': version,
          'X-Restli-Protocol-Version': '2.0.0',
          Accept: 'application/json',
        },
      });
      if (!Array.isArray(data?.elements)) {
        throw new Error('Invalid LinkedIn analytics response');
      }
      return {
        provider: 'linkedin' as const,
        assetId: input.assetId,
        metrics: data.elements.slice(0, 50).map((row: any) => ({
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          costInLocalCurrency: String(row.costInLocalCurrency ?? '0'),
        })),
      };
    }
  );
}
