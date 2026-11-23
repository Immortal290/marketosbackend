import { prisma } from '../../lib/prisma';

import {
  executeAuthorizedOAuthOperation,
} from './oauth-connector-execution';

export interface GA4Summary {
  provider: 'ga4';
  propertyId: string;
  period: 'last_7_complete_days';
  activeUsers: number;
  sessions: number;
}

function selectedProperty(
  value: unknown,
  propertyId: string
): boolean {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('assetIds' in value)
  ) {
    return false;
  }

  const assets = value.assetIds;

  return (
    Array.isArray(assets) &&
    assets.includes(propertyId)
  );
}

function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('Invalid GA4 reporting response');
  }

  return value as Record<string, unknown>;
}

function metricValue(value: unknown): number {
  const entry = object(value);

  if (
    typeof entry.value !== 'string' ||
    !/^\d+$/.test(entry.value)
  ) {
    throw new Error('Invalid GA4 metric value');
  }

  const number = Number(entry.value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('Invalid GA4 metric value');
  }

  return number;
}

/**
 * Trusted backend adapter for read-only GA4 summaries.
 *
 * The caller must supply identity from verified authentication.
 * OAuth credentials are never returned to callers or Python agents.
 */
export async function getAuthorizedGA4Summary(input: {
  userId: string;
  workspaceId: string;
  connectionId: string;
  propertyId: string;
}): Promise<GA4Summary> {
  if (
    !input.userId?.trim() ||
    !input.workspaceId?.trim() ||
    !input.connectionId?.trim() ||
    typeof input.propertyId !== 'string' ||
    !/^properties\/[1-9]\d{0,18}$/.test(input.propertyId)
  ) {
    throw new Error('Invalid GA4 reporting request');
  }

  return executeAuthorizedOAuthOperation(
    {
      userId: input.userId,
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
      operation: 'ga4.read',
    },
    async (accessToken): Promise<GA4Summary> => {
      // Confirm the property was explicitly selected by the
      // authorized connection owner. Never trust an arbitrary
      // property ID supplied through an agent state or prompt.
      const connection = await prisma.oAuthConnection.findFirst({
        where: {
          id: input.connectionId,
          workspaceId: input.workspaceId,
          connectedByUserId: input.userId,
          provider: 'ga4',
          connectionStatus: 'ACTIVE',
        },
        select: {
          selectedAssets: true,
        },
      });

      if (
        !connection ||
        !selectedProperty(
          connection.selectedAssets,
          input.propertyId
        )
      ) {
        throw new Error('GA4 property is not authorized');
      }

      let response: Response;

      try {
        response = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/${input.propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dateRanges: [{
                startDate: '7daysAgo',
                endDate: 'yesterday',
              }],
              metrics: [
                { name: 'activeUsers' },
                { name: 'sessions' },
              ],
            }),
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
          }
        );
      } catch {
        throw new Error('GA4 reporting service unavailable');
      }

      if (!response.ok) {
        throw new Error('GA4 report could not be retrieved');
      }

      let data: Record<string, unknown>;

      try {
        data = object(await response.json());
      } catch {
        throw new Error('Invalid GA4 reporting response');
      }

      if (
        !Array.isArray(data.metricHeaders) ||
        data.metricHeaders.length !== 2 ||
        object(data.metricHeaders[0]).name !== 'activeUsers' ||
        object(data.metricHeaders[1]).name !== 'sessions'
      ) {
        throw new Error('Invalid GA4 reporting response');
      }

      const rows = data.rows ?? [];

      if (
        !Array.isArray(rows) ||
        rows.length > 1
      ) {
        throw new Error('Invalid GA4 reporting response');
      }

      let activeUsers = 0;
      let sessions = 0;

      if (rows.length === 1) {
        const row = object(rows[0]);

        if (
          !Array.isArray(row.metricValues) ||
          row.metricValues.length !== 2
        ) {
          throw new Error('Invalid GA4 reporting response');
        }

        activeUsers = metricValue(row.metricValues[0]);
        sessions = metricValue(row.metricValues[1]);
      }

      // Return only the approved aggregate metrics.
      // Never return the raw provider response or access token.
      return {
        provider: 'ga4',
        propertyId: input.propertyId,
        period: 'last_7_complete_days',
        activeUsers,
        sessions,
      };
    }
  );
}
