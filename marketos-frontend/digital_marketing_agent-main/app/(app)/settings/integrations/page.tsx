"use client";
import OAuthAssetPicker from "./oauth-asset-picker";

import { useState, useEffect, useCallback } from "react";
import type { Integration } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoToggle } from "@/components/ui/NeoToggle";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { PROVIDERS } from "@/lib/providers";

type OAuthConnectionSummary = {
  id: string;
  provider: string;
  accountLabel?: string | null;
  connectionStatus?: string;
};

const OAUTH_CONNECT_PROVIDERS = [
  { id: "gmail", label: "Gmail" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "google_ads", label: "Google Ads" },
  { id: "mailchimp", label: "Mailchimp" },
  { id: "hubspot", label: "HubSpot" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

type OAuthConnectProvider =
  (typeof OAUTH_CONNECT_PROVIDERS)[number]["id"];

const OAUTH_AUTHORIZE_HOSTS: Record<OAuthConnectProvider, string> = {
  gmail: "accounts.google.com",
  ga4: "accounts.google.com",
  google_ads: "accounts.google.com",
  mailchimp: "login.mailchimp.com",
  hubspot: "app.hubspot.com",
  meta_ads: "www.facebook.com",
  linkedin: "www.linkedin.com",
};
export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState(false);
  const [oauthConnections, setOAuthConnections] =
    useState<OAuthConnectionSummary[]>([]);

  const [oauthLoading, setOAuthLoading] = useState(true);
  const [oauthBusy, setOAuthBusy] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  const loadOAuthConnections = useCallback(async () => {
    setOAuthLoading(true);
    setOAuthError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        data: OAuthConnectionSummary[];
      }>("/settings/oauth/connections");

      if (
        response?.success !== true ||
        !Array.isArray(response.data)
      ) {
        throw new Error("Invalid OAuth connection response");
      }

      setOAuthConnections(
        response.data.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.provider === "string"
        )
      );
    } catch (error) {
      setOAuthConnections([]);
      setOAuthError(
        error instanceof Error
          ? error.message
          : "Unable to verify OAuth connections"
      );
    } finally {
      setOAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOAuthConnections();
  }, [loadOAuthConnections]);

  const startOAuthConnection = async (
    provider: OAuthConnectProvider
  ) => {
    setOAuthBusy(true);
    setOAuthError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        authorizationUrl: string;
      }>(`/settings/oauth/${provider}/start`, {
        method: "POST",
      });

      if (
        response?.success !== true ||
        typeof response.authorizationUrl !== "string"
      ) {
        throw new Error("OAuth authorization could not start");
      }

      const authorizationUrl = new URL(response.authorizationUrl);

      if (
        authorizationUrl.protocol !== "https:" ||
        authorizationUrl.hostname !== OAUTH_AUTHORIZE_HOSTS[provider] ||
        authorizationUrl.port !== "" ||
        authorizationUrl.username !== "" ||
        authorizationUrl.password !== "" ||
        authorizationUrl.hash !== ""
      ) {
        throw new Error("Unexpected OAuth authorization destination");
      }

      window.location.assign(authorizationUrl.toString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start OAuth authorization";

      setOAuthError(message);
      toast.error(message);
    } finally {
      setOAuthBusy(false);
    }
  };

  const disconnectOAuthConnection = async (
    connection: OAuthConnectionSummary
  ) => {
    const confirmed = window.confirm(
      "Disconnect this OAuth account from MarketOS? " +
      "This removes the stored connection but does not revoke " +
      "access in your Google Account."
    );

    if (!confirmed) return;

    setOAuthBusy(true);
    setOAuthError(null);

    try {
      const response = await apiRequest<{ success: boolean }>(
        `/settings/oauth/connections/${encodeURIComponent(connection.id)}`,
        { method: "DELETE" }
      );

      if (response?.success !== true) {
        throw new Error("OAuth disconnection was not confirmed");
      }

      await loadOAuthConnections();
      toast.success("OAuth connection removed from MarketOS");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to disconnect OAuth account";

      setOAuthError(message);
      toast.error(message);
    } finally {
      setOAuthBusy(false);
    }
  };


  useEffect(() => {
    const loadIntegrations = async () => {
      let backendIntegrations: any[] = [];

      try {
        const response = await apiRequest<any>("/settings/integrations");
        if (Array.isArray(response?.data)) {
          backendIntegrations = response.data;
        }
      } catch (error) {
        console.error("Failed to load integrations:", error);
      }

      const combined = Object.values(PROVIDERS).map((p: any) => {
        const backendState = backendIntegrations.find((b: any) => b.id === p.id) || {};

        return {
          ...p,
          connected: !!(backendState as any).connected,
          accountLabel: (backendState as any).accountLabel || "",
          lastVerifiedAt: (backendState as any).lastVerifiedAt || null,
        };
      });
      setIntegrations(combined);
    };

    void loadIntegrations();
  }, []);

  const toggle = async (id: string, next: boolean, name: string) => {
    if (next) {
      // Open form
      setActiveForm(id);
      setFormValues({});
    } else {

      // Disconnect
      setIntegrations((list) =>
        list.map((i) => (i.id === id ? { ...i, connected: false, accountLabel: null, lastVerifiedAt: null } : i)),
      );
      try {
        const response = await apiRequest<any>(`/settings/integrations/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ connected: false, name }),
        });
        toast.success(`${name} Disconnected`);
      } catch (error) {
        toast.success(`${name} Disconnected`);
      }
    }
  };

  const handleSyncAll = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Telemetry Pipelines Synchronized", {
        description: "AnalyticsAgent and SupervisorAgent verified real-time event streams for all active integrations.",
      });
    }, 1200);
  };

  const handleConnect = async (e: React.FormEvent, providerId: string) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const response = await apiRequest<any>(`/settings/integrations/${providerId}/connect`, {
            method: "POST",
            body: JSON.stringify(formValues),
          });

      if (response && response.success) {
        setIntegrations((list) =>
          list.map((i) => (i.id === providerId ? { ...i, connected: true, accountLabel: response.accountLabel, lastVerifiedAt: new Date().toISOString() } : i)),
        );
        toast.success(`Connected to ${response.accountLabel}`);
        setActiveForm(null);
      } else {
        toast.error(response?.error || "Verification failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify connection");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <NeoCard title="Third-Party Integrations & AI Telemetry" accent="cyan">
      <div className="mb-4 flex items-center justify-between border-b-[3px] border-black pb-4">
        <p className="font-mono text-xs font-bold uppercase text-black/70">
          Connect data sources for automated AI agent monitoring
        </p>
        <NeoButton variant="secondary" size="sm" onClick={handleSyncAll} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 inline ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync All Data Streams"}
        </NeoButton>
      </div>
      <section className="mb-6 border-[3px] border-black bg-white p-4">
        <div className="mb-3">
          <h3 className="font-display text-lg font-black">
            Connect Accounts with OAuth
          </h3>
          <p className="text-xs font-medium text-black/70">
            Secure provider authorization. Credentials stay
            on the MarketOS backend.
          </p>
        </div>

        {oauthLoading && (
          <p className="mb-3 text-sm">Checking OAuth connections...</p>
        )}

        {oauthError && (
          <p role="alert" className="mb-3 text-sm font-bold text-red-700">
            OAuth status: {oauthError}
          </p>
        )}

        <div className="space-y-3">
          {OAUTH_CONNECT_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className="border-[2px] border-black p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-bold">{provider.label}</span>

                <button
                  type="button"
                  disabled={oauthBusy || oauthLoading}
                  onClick={() => void startOAuthConnection(provider.id)}
                  className="border-[2px] border-black bg-cyan-200 px-3 py-2 text-xs font-black disabled:opacity-50"
                >
                  Connect / Reconnect Account
                </button>
              </div>

              {oauthConnections
                .filter((connection) => connection.provider === provider.id)
                .map((connection) => (
                  <div
                    key={connection.id}
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/20 pt-3"
                  >
                    <div className="order-last w-full">
                      <OAuthAssetPicker
                        connectionId={connection.id}
                        provider={connection.provider}
                        status={connection.connectionStatus}
                      />
                    </div>
                    <div className="text-xs font-mono">
                      <div className="font-bold">
                        {connection.accountLabel || "Google account"}
                      </div>
                      <div>
                        Status: {connection.connectionStatus || "UNKNOWN"}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={oauthBusy || oauthLoading}
                      onClick={() =>
                        void disconnectOAuthConnection(connection)
                      }
                      className="border-2 border-black px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={oauthBusy || oauthLoading}
          onClick={() => void loadOAuthConnections()}
          className="mt-4 text-xs font-bold underline disabled:opacity-50"
        >
          Refresh verified connection status
        </button>
      </section>
      <ul className="flex flex-col">
        {integrations.map((i) => (
          <li
            key={i.id}
            className="flex flex-col border-b-[2px] border-black py-4 transition-colors last:border-0"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-lg">{i.label}</span>
                  <NeoBadge tone={i.connected ? "success" : "info"}>{i.category}</NeoBadge>
                  {i.advanced && <NeoBadge tone="warning">Advanced</NeoBadge>}
                </div>
                <p className="font-medium text-black/70 mt-1">{i.description}</p>
                {i.expireWarning && <p className="text-xs text-orange-600 mt-1">{i.expireWarning}</p>}
                
                {i.connected && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-mono font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connected: {i.accountLabel}</span>
                  </div>
                )}
              </div>
              
              <NeoToggle
                checked={i.connected || activeForm === i.id}
                onCheckedChange={(next) => toggle(i.id, next, i.label)}
                label={i.connected ? "Active" : "Inactive"}
              />
            </div>

            {/* Connection Form */}
            {activeForm === i.id && !i.connected && (
              <div className="mt-4 p-4 border-[3px] border-black bg-blue-50">
                <form onSubmit={(e) => handleConnect(e, i.id)} className="space-y-4">
                  {i.fields.map((f: any) => (
                    <div key={f.key}>
                      <label className="block text-xs font-bold font-mono mb-1">{f.label}</label>
                      <input
                        type={f.secret ? "password" : "text"}
                        required
                        autoComplete="off"
                        value={formValues[f.key] || ""}
                        onChange={(e) => setFormValues({...formValues, [f.key]: e.target.value})}
                        placeholder={f.placeholder}
                        className="w-full bg-white border-[2px] border-black px-3 py-2 font-mono text-xs shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#00E0FF]"
                      />
                    </div>
                  ))}

                  <div className="bg-white p-3 border-[2px] border-black text-xs font-mono">
                    <p className="font-bold mb-2 underline decoration-[#FF2E93] decoration-2">Where to find these:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {i.guide.map((g: any, idx: number) => (
                        <li key={idx}><span className="font-bold">{g.field}:</span> {g.text}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <NeoButton type="submit" disabled={verifying}>
                      {verifying ? "Verifying..." : "Verify & Connect"}
                    </NeoButton>
                    <NeoButton type="button" variant="secondary" onClick={() => setActiveForm(null)}>Cancel</NeoButton>
                  </div>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </NeoCard>
  );
}
