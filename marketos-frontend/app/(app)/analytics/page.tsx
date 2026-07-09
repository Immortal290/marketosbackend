"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoSkeleton } from "@/components/ui/NeoSkeleton";
import { api } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Clock,
  Wifi,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_90_DAYS";

interface ExecutiveData {
  revenue: number;
  pipeline: number;
  cac: number;
  ltv: number;
  roas: number;
  conversionRate: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  convRate: number;
  dropoffRate: number;
}

interface AttributionChannel {
  channel: string;
  contribution: number;
  revenue: number;
}

interface AnalyticsData {
  executive: ExecutiveData | null;
  funnel: FunnelStage[];
  attribution: { model: string; channels: AttributionChannel[] } | null;
  lastUpdated: Date | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cron interval — analytics data is refetched every 30 seconds */
const CRON_INTERVAL_MS = 30_000;

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: "Last 7 Days", value: "LAST_7_DAYS" },
  { label: "Last 30 Days", value: "LAST_30_DAYS" },
  { label: "Last 90 Days", value: "LAST_90_DAYS" },
];

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  IMPRESSION: "Impressions",
  CLICK: "Clicks",
  VISIT: "Visits",
  LEAD: "Leads",
  MQL: "MQL",
  SQL: "SQL",
  CUSTOMER: "Customers",
};

const CHANNEL_ACCENT: Record<string, string> = {
  EMAIL: "bg-neo-yellow",
  PAID_ADS: "bg-neo-pink",
  SOCIAL: "bg-neo-cyan",
  SMS: "bg-neo-lime",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <NeoSkeleton className="h-3 w-24" />
      <NeoSkeleton className="h-8 w-32" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("LAST_30_DAYS");
  const [data, setData] = useState<AnalyticsData>({
    executive: null,
    funnel: [],
    attribution: null,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false); // for cron refresh indicator
  const [error, setError] = useState<string | null>(null);

  // Track cron countdown for UI
  const [countdown, setCountdown] = useState(CRON_INTERVAL_MS / 1000);
  const cronRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch all analytics data ───────────────────────────────────────────────
  const fetchAnalytics = useCallback(
    async (range: DateRange, showLoadingSpinner = false) => {
      if (showLoadingSpinner) setIsLoading(true);
      setIsFetching(true);
      setError(null);

      try {
        const [executive, funnelRaw, attribution] = await Promise.all([
          api.analytics.executive(range),
          api.analytics.funnel(range),
          api.analytics.attribution(range),
        ]);

        setData({
          executive,
          funnel: Array.isArray(funnelRaw) ? funnelRaw : [],
          attribution,
          lastUpdated: new Date(),
        });
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load analytics data."
        );
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    []
  );

  // ─── Cron job: re-fetch every 30 seconds ───────────────────────────────────
  const startCron = useCallback(
    (range: DateRange) => {
      // Clear any existing intervals
      if (cronRef.current) clearInterval(cronRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      // Reset countdown
      setCountdown(CRON_INTERVAL_MS / 1000);

      // Countdown ticker (every 1 second)
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) return CRON_INTERVAL_MS / 1000;
          return prev - 1;
        });
      }, 1000);

      // Main cron — re-fetches analytics data
      cronRef.current = setInterval(() => {
        fetchAnalytics(range);
        setCountdown(CRON_INTERVAL_MS / 1000);
      }, CRON_INTERVAL_MS);
    },
    [fetchAnalytics]
  );

  // Initial load
  useEffect(() => {
    fetchAnalytics(dateRange, true);
    startCron(dateRange);

    return () => {
      if (cronRef.current) clearInterval(cronRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When dateRange changes: re-fetch immediately and reset cron
  useEffect(() => {
    fetchAnalytics(dateRange, true);
    startCron(dateRange);

    return () => {
      if (cronRef.current) clearInterval(cronRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [dateRange, fetchAnalytics, startCron]);

  // ─── Derived display values ─────────────────────────────────────────────────

  const exec = data.executive;

  const metrics = exec
    ? [
        {
          label: "Total Revenue",
          value: fmtCurrency(exec.revenue),
          sub: `Pipeline: ${fmtCurrency(exec.pipeline)}`,
          accent: "yellow" as const,
          icon: TrendingUp,
          positive: true,
        },
        {
          label: "ROAS",
          value: `${exec.roas.toFixed(1)}×`,
          sub: `Conv. Rate: ${exec.conversionRate.toFixed(2)}%`,
          accent: "pink" as const,
          icon: exec.roas >= 3 ? TrendingUp : TrendingDown,
          positive: exec.roas >= 3,
        },
        {
          label: "Customer Acq. Cost",
          value: fmtCurrency(exec.cac),
          sub: `LTV: ${fmtCurrency(exec.ltv)}`,
          accent: "cyan" as const,
          icon: exec.cac < 200 ? TrendingUp : TrendingDown,
          positive: exec.cac < 200,
        },
        {
          label: "LTV : CAC Ratio",
          value: `${(exec.ltv / exec.cac).toFixed(1)}×`,
          sub: exec.ltv / exec.cac >= 3 ? "Healthy" : "Needs improvement",
          accent: "lime" as const,
          icon: exec.ltv / exec.cac >= 3 ? TrendingUp : TrendingDown,
          positive: exec.ltv / exec.cac >= 3,
        },
      ]
    : [];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Analytics Dashboard
          </h1>
          <div className="mt-1 flex items-center gap-3 font-mono text-xs text-black/60">
            {data.lastUpdated ? (
              <>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Updated {data.lastUpdated.toLocaleTimeString()}
                </span>
                <span className="flex items-center gap-1">
                  {isFetching ? (
                    <RefreshCw size={10} className="animate-spin text-neo-pink" />
                  ) : (
                    <Wifi size={10} className="text-neo-green" />
                  )}
                  {isFetching
                    ? "Syncing…"
                    : `Auto-refresh in ${countdown}s`}
                </span>
              </>
            ) : (
              <span>Loading live data…</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range selector */}
          <div className="flex border-[2px] border-black overflow-hidden shadow-[2px_2px_0_0_#000]">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                  dateRange === opt.value
                    ? "bg-neo-yellow"
                    : "bg-white hover:bg-neo-cyan"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => fetchAnalytics(dateRange)}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </NeoButton>

          <NeoButton
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            Export Data
          </NeoButton>
        </div>
      </div>

      {/* Export modal */}
      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Export Analytics"
      >
        <div className="flex flex-col gap-4">
          <p className="font-medium text-black/70">
            Export feature coming soon! Data is synced live from the MarketOS backend.
          </p>
          <NeoButton
            variant="primary"
            className="mt-4"
            onClick={() => setIsModalOpen(false)}
          >
            Close
          </NeoButton>
        </div>
      </NeoModal>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 border-[3px] border-red-600 bg-red-50 px-5 py-4">
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-bold text-red-700">{error}</p>
            <p className="font-mono text-xs text-red-500">
              Auto-retry in {countdown}s — or click Refresh above
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <section className="grid gap-4 md:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <NeoCard key={i} title="">
                <MetricSkeleton />
              </NeoCard>
            ))
          : metrics.map((metric) => (
              <NeoCard key={metric.label} title={metric.label} accent={metric.accent}>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-display text-3xl font-black">
                      {metric.value}
                    </span>
                    <p className="font-mono text-[10px] text-black/60 mt-1">
                      {metric.sub}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1 font-mono text-xs font-bold ${
                      metric.positive ? "text-neo-green" : "text-red-600"
                    }`}
                  >
                    <metric.icon className="h-4 w-4" />
                  </span>
                </div>
              </NeoCard>
            ))}
      </section>

      {/* Funnel */}
      <section>
        <h2 className="mb-4 font-display text-2xl font-black uppercase">
          Conversion Funnel
        </h2>
        <NeoCard title="Full-Funnel Performance" accent="cyan">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <NeoSkeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data.funnel.length === 0 ? (
            <p className="font-mono text-sm text-black/50">
              No funnel data available for this period.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.funnel.map((stage, i) => {
                const maxCount = data.funnel[0]?.count ?? 1;
                const widthPct = Math.max(
                  4,
                  Math.round((stage.count / maxCount) * 100)
                );
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <span className="w-24 font-mono text-[10px] font-bold uppercase text-black/60">
                      {FUNNEL_STAGE_LABELS[stage.stage] ?? stage.stage}
                    </span>
                    <div className="relative flex-1 h-7 border-[2px] border-black bg-neo-surface">
                      <div
                        className="h-full bg-neo-cyan transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-display text-sm font-black">
                      {fmtCount(stage.count)}
                    </span>
                    {i > 0 && (
                      <span
                        className={`w-16 text-right font-mono text-xs font-bold ${
                          stage.dropoffRate > 80 ? "text-red-500" : "text-black/50"
                        }`}
                      >
                        −{stage.dropoffRate.toFixed(0)}%
                      </span>
                    )}
                    {i === 0 && <span className="w-16" />}
                  </div>
                );
              })}
            </div>
          )}
        </NeoCard>
      </section>

      {/* Attribution + Cron indicator */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Attribution */}
        <NeoCard title="Channel Attribution" accent="pink">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <NeoSkeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : data.attribution?.channels.length ? (
            <ul className="flex flex-col gap-4">
              {data.attribution.channels.map((ch) => (
                <li key={ch.channel} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {ch.channel.replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs font-black">
                      {ch.contribution.toFixed(1)}% · {fmtCurrency(ch.revenue)}
                    </span>
                  </div>
                  <div className="h-3 border-[2px] border-black bg-neo-surface">
                    <div
                      className={`h-full transition-all duration-700 ${
                        CHANNEL_ACCENT[ch.channel] ?? "bg-neo-yellow"
                      }`}
                      style={{ width: `${ch.contribution}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-sm text-black/50">
              No attribution data available.
            </p>
          )}
        </NeoCard>

        {/* Live Cron Status */}
        <NeoCard title="Real-Time Sync Status" accent="lime">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-[2px] border-black bg-neo-surface p-4">
              <div
                className={`h-3 w-3 rounded-full border-[2px] border-black ${
                  isFetching ? "bg-neo-yellow animate-pulse" : "bg-neo-lime"
                }`}
              />
              <div>
                <p className="font-bold text-sm">
                  {isFetching ? "Syncing with backend…" : "Live — Connected"}
                </p>
                <p className="font-mono text-[10px] text-black/60">
                  marketosbackend-production.up.railway.app
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border-[2px] border-black p-3 bg-white">
                <p className="font-mono text-[10px] uppercase text-black/60">
                  Cron Interval
                </p>
                <p className="font-display text-xl font-black">30s</p>
              </div>
              <div className="border-[2px] border-black p-3 bg-white">
                <p className="font-mono text-[10px] uppercase text-black/60">
                  Next Refresh
                </p>
                <p className="font-display text-xl font-black">{countdown}s</p>
              </div>
              <div className="border-[2px] border-black p-3 bg-white">
                <p className="font-mono text-[10px] uppercase text-black/60">
                  Date Range
                </p>
                <p className="font-display text-sm font-black">
                  {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label}
                </p>
              </div>
              <div className="border-[2px] border-black p-3 bg-white">
                <p className="font-mono text-[10px] uppercase text-black/60">
                  Last Sync
                </p>
                <p className="font-display text-sm font-black">
                  {data.lastUpdated
                    ? data.lastUpdated.toLocaleTimeString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* AI Alerts derived from funnel */}
            {data.funnel.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] font-bold uppercase text-black/60">
                  AI Insights
                </p>
                {data.funnel
                  .filter((s) => s.dropoffRate > 75 && s.stage !== "IMPRESSION")
                  .slice(0, 2)
                  .map((s) => (
                    <div
                      key={s.stage}
                      className="flex items-start gap-2 border-l-[3px] border-neo-yellow pl-3"
                    >
                      <NeoBadge tone="warning">alert</NeoBadge>
                      <p className="font-medium text-xs">
                        {FUNNEL_STAGE_LABELS[s.stage] ?? s.stage} stage has{" "}
                        {s.dropoffRate.toFixed(0)}% drop-off — optimization
                        recommended
                      </p>
                    </div>
                  ))}
                {data.funnel.filter(
                  (s) => s.dropoffRate > 75 && s.stage !== "IMPRESSION"
                ).length === 0 && (
                  <div className="flex items-start gap-2 border-l-[3px] border-neo-lime pl-3">
                    <NeoBadge tone="success">healthy</NeoBadge>
                    <p className="font-medium text-xs">
                      All funnel stages performing within normal thresholds
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
