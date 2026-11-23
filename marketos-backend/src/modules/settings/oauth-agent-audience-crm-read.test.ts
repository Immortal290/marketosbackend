import {
  readMailchimpOAuthAudiences,
  readHubSpotOAuthContacts,
} from './oauth-agent-audience-crm-read';

import { executeAuthorizedOAuthOperation } from './oauth-connector-execution';

jest.mock('./oauth-connector-execution', () => ({
  executeAuthorizedOAuthOperation: jest.fn(),
}));

const executor = executeAuthorizedOAuthOperation as jest.Mock;
const originalFetch = globalThis.fetch;

const context = {
  userId: 'test-user',
  workspaceId: 'test-workspace',
  connectionId: 'test-connection',
};

function reply(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

beforeEach(() => {
  executor.mockImplementation(async (_authorization, operation) => {
    return operation('mock-oauth-access-token');
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.resetAllMocks();
});

test('reads Mailchimp audiences using OAuth metadata', async () => {
  const fakeFetch = jest.fn()
    .mockResolvedValueOnce(reply({ dc: 'us6' }))
    .mockResolvedValueOnce(reply({
      lists: [{ id: 'aud-1', name: 'Test Audience' }],
    }));

  globalThis.fetch = fakeFetch;

  const result = await readMailchimpOAuthAudiences(context);

  expect(result).toEqual({
    provider: 'mailchimp',
    audiences: [{ id: 'aud-1', name: 'Test Audience' }],
  });

  expect(executor).toHaveBeenCalledWith(
    expect.objectContaining({ operation: 'mailchimp.read' }),
    expect.any(Function)
  );

  expect(fakeFetch.mock.calls[0][0])
    .toBe('https://login.mailchimp.com/oauth2/metadata');

  expect(fakeFetch.mock.calls[0][1].headers.Authorization)
    .toBe('OAuth mock-oauth-access-token');

  expect(fakeFetch.mock.calls[1][0])
    .toBe('https://us6.api.mailchimp.com/3.0/lists?count=10');
});

test('blocks unsafe Mailchimp data centers', async () => {
  const fakeFetch = jest.fn()
    .mockResolvedValue(reply({ dc: 'evil.example.com' }));

  globalThis.fetch = fakeFetch;

  await expect(readMailchimpOAuthAudiences(context))
    .rejects.toThrow('Invalid Mailchimp data center');

  expect(fakeFetch).toHaveBeenCalledTimes(1);
});

test('reads HubSpot contacts through authorized OAuth', async () => {
  const fakeFetch = jest.fn().mockResolvedValue(
    reply({
      results: [{
        id: 'contact-1',
        properties: {
          email: 'test@example.com',
          firstname: 'Test',
          lastname: 'User',
        },
      }],
    })
  );

  globalThis.fetch = fakeFetch;

  const result = await readHubSpotOAuthContacts(context);

  expect(result.contacts).toEqual([{
    id: 'contact-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  }]);

  expect(executor).toHaveBeenCalledWith(
    expect.objectContaining({ operation: 'hubspot.contacts_read' }),
    expect.any(Function)
  );

  expect(fakeFetch.mock.calls[0][1].method).toBe('GET');
});

test('does not expose OAuth tokens in provider errors', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({}, 403));

  await expect(readHubSpotOAuthContacts(context))
    .rejects.toThrow('OAuth provider read failed (HTTP 403)');
});

test('rejects unauthorized workspace access before network calls', async () => {
  executor.mockRejectedValue(new Error('OAuth workspace access denied'));

  const fakeFetch = jest.fn();
  globalThis.fetch = fakeFetch;

  await expect(readHubSpotOAuthContacts(context))
    .rejects.toThrow('OAuth workspace access denied');

  expect(fakeFetch).not.toHaveBeenCalled();
});

test('rejects unexpected provider response shapes', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply({
    unexpected: true,
  }));

  await expect(readHubSpotOAuthContacts(context))
    .rejects.toThrow('Invalid HubSpot contacts response');
});
