import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import type { AuthorizeOAuthOperationInput } from './oauth-agent-authorization';

type Context = Omit<AuthorizeOAuthOperationInput, 'operation'>;

async function fetchProviderJson(
  url: string,
  accessToken: string,
  options?: { method?: 'GET' | 'POST'; body?: string; authorization?: 'OAuth' | 'Bearer' }
): Promise<any> {
  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `${options?.authorization ?? 'Bearer'} ${accessToken}`,
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options?.body ? { body: options.body } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Provider operation unavailable (HTTP ${response.status})`);
  }
  return response.json();
}

/** Read-only Mailchimp campaign listing. Reuses encrypted OAuth token + workspace check. */
export async function readMailchimpOAuthCampaigns(context: Context) {
  return executeAuthorizedOAuthOperation(
    { ...context, operation: 'mailchimp.read' },
    async (token) => {
      const meta = await fetchProviderJson(
        'https://login.mailchimp.com/oauth2/metadata', token,
        { authorization: 'OAuth' }
      );
      if (typeof meta?.dc !== 'string' || !/^[a-z]{2}\d{1,3}$/.test(meta.dc)) {
        throw new Error('Invalid Mailchimp account data center');
      }
      const data = await fetchProviderJson(
        `https://${meta.dc}.api.mailchimp.com/3.0/campaigns?count=10`, token
      );
      if (!Array.isArray(data?.campaigns)) {
        throw new Error('Invalid Mailchimp campaign response');
      }
      return {
        provider: 'mailchimp' as const,
        campaigns: data.campaigns.slice(0, 10).map((item: any) => ({
          id: String(item.id ?? ''),
          status: String(item.status ?? ''),
          title: String(item.settings?.title ?? ''),
          subject: String(item.settings?.subject_line ?? ''),
        })),
      };
    }
  );
}

/**
 * HubSpot list/segment discovery. Requires crm.lists.read in the OAuth grant.
 * HubSpot's POST /lists/search is a read operation; it does not mutate lists.
 */
export async function readHubSpotOAuthLists(context: Context) {
  return executeAuthorizedOAuthOperation(
    { ...context, operation: 'hubspot.lists_read' },
    async (token) => {
      const data = await fetchProviderJson(
        'https://api.hubapi.com/crm/v3/lists/search', token,
        { method: 'POST', body: JSON.stringify({ offset: 0, count: 10 }) }
      );
      if (!Array.isArray(data?.lists)) {
        throw new Error('Invalid HubSpot list response');
      }
      return {
        provider: 'hubspot' as const,
        lists: data.lists.slice(0, 10).map((item: any) => ({
          id: String(item.listId ?? ''),
          name: String(item.name ?? ''),
          processingType: String(item.processingType ?? ''),
        })),
      };
    }
  );
}
