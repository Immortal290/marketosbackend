"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAnalyticsSocket } from "@/hooks/useSocket";

export interface AnalyticsState {
  // Executive metrics
  executive: {
    revenue: number;
    pipeline: number;
    cac: number;
    ltv: number;
    roas: number;
    conversionRate: number;
    lastUpdated: string;
  } | null;

  // Attribution
  attribution: {
    model: string;
    channels: Array<{ channel: string; contribution: number; revenue: number }>;
  } | null;

  // Funnel
  funnel: Array<{
    stage: string;
    count: number;
    convRate: number;
    dropoffRate: number;
  }>;

  // Real-time from Kafka/AnalyticsAgent
  realtimeSnapshot: any;
  anomalies: any[];

  // State
  loading: boolean;
  error: string | null;
  socketConnected: boolean;
  lastRefresh: string | null;
}

/**
 * Combined analytics hook: fetches initial data via REST,
 * then subscribes to real-time updates via Socket.io.
 */
export function useAnalytics() {
  const { connected, latestMetrics, alerts, agentEvents } = useAnalyticsSocket();

  const [state, setState] = useState<AnalyticsState>({
    executive: null,
    attribution: null,
    funnel: [],
    realtimeSnapshot: null,
    anomalies: [],
    loading: true,
    error: null,
    socketConnected: false,
    lastRefresh: null,
  });

  // Fetch initial data from REST API
  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [execRes, attrRes, funnelRes, realtimeRes] = await Promise.allSettled([
        api.getExecutiveAnalytics(),
        api.getAttribution(),
        api.getFunnelAnalytics(),
        api.getRealtimeAnalytics(),
      ]);

      setState((prev) => ({
        ...prev,
        executive: execRes.status === "fulfilled" ? execRes.value.data : prev.executive,
        attribution: attrRes.status === "fulfilled" ? attrRes.value.data : prev.attribution,
        funnel: funnelRes.status === "fulfilled" ? funnelRes.value.data : prev.funnel,
        realtimeSnapshot:
          realtimeRes.status === "fulfilled"
            ? realtimeRes.value.data.latestSnapshot
            : prev.realtimeSnapshot,
        anomalies:
          realtimeRes.status === "fulfilled"
            ? realtimeRes.value.data.anomalies
            : prev.anomalies,
        loading: false,
        lastRefresh: new Date().toISOString(),
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to fetch analytics",
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Merge real-time socket updates into state
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      socketConnected: connected,
    }));
  }, [connected]);

  useEffect(() => {
    if (latestMetrics) {
      setState((prev) => ({
        ...prev,
        realtimeSnapshot: latestMetrics,
        executive: prev.executive
          ? {
              ...prev.executive,
              ...latestMetrics,
              lastUpdated: latestMetrics._ts || new Date().toISOString(),
            }
          : prev.executive,
      }));
    }
  }, [latestMetrics]);

  useEffect(() => {
    if (alerts.length > 0) {
      setState((prev) => ({
        ...prev,
        anomalies: alerts,
      }));
    }
  }, [alerts]);

  return { ...state, refresh: fetchAll, agentEvents };
}
