import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';
import type { AuthorizeOAuthOperationInput } from './oauth-agent-authorization';

type Context = Omit<AuthorizeOAuthOperationInput, 'operation'>;

async function readJson(
  url: string,
  accessToken: string,
  authorizationScheme: 'Bearer' | 'OAuth' = 'Bearer'
): Promise<any> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `${authorizationScheme} ${accessToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    // Do not expose provider response bodies, tokens, or credentials.
    throw new Error(`OAuth provider read failed (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * Retrieve Mailchimp audiences through the existing OAuth executor.
 *
 * OAuth metadata determines the account-specific data center.
 * The data center is validated before constructing an API URL.
 */
export async function readMailchimpOAuthAudiences(context: Context) {
  return executeAuthorizedOAuthOperation(
    { ...context, operation: 'mailchimp.read' },
    async (accessToken) => {
      const metadata = await readJson(
        'https://login.mailchimp.com/oauth2/metadata',
        accessToken,
        'OAuth'
      );

      const dc = metadata?.dc;

      if (
        typeof dc !== 'string' ||
        !/^[a-z]{2}\d{1,3}$/.test(dc)
      ) {
        throw new Error('Invalid Mailchimp data center');
      }

      const data = await readJson(
        `https://${dc}.api.mailchimp.com/3.0/lists?count=10`,
        accessToken
      );

      if (!Array.isArray(data?.lists)) {
        throw new Error('Invalid Mailchimp audience response');
      }

      return {
        provider: 'mailchimp' as const,
        audiences: data.lists.slice(0, 10).map((item: any) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        })),
      };
    }
  );
}

/**
 * Read CRM contacts through authorized HubSpot OAuth.
 * No contact is created, edited, or deleted.
 */
export async function readHubSpotOAuthContacts(context: Context) {
  return executeAuthorizedOAuthOperation(
    { ...context, operation: 'hubspot.contacts_read' },
    async (accessToken) => {
      const data = await readJson(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=10&properties=email,firstname,lastname',
        accessToken
      );

      if (!Array.isArray(data?.results)) {
        throw new Error('Invalid HubSpot contacts response');
      }

      return {
        provider: 'hubspot' as const,
        contacts: data.results.slice(0, 10).map((item: any) => ({
          id: String(item.id ?? ''),
          email: String(item.properties?.email ?? ''),
          firstName: String(item.properties?.firstname ?? ''),
          lastName: String(item.properties?.lastname ?? ''),
        })),
      };
    }
  );
}
