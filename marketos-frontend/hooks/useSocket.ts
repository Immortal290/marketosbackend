"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/**
 * Low-level Socket.io hook.
 * Connects once and exposes subscribe/unsubscribe helpers.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[Socket] Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, connected, subscribe, emit };
}

/**
 * Subscribe to the analytics room and receive real-time updates.
 */
export function useAnalyticsSocket() {
  const { socket, connected, subscribe, emit } = useSocket();
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!connected) return;

    // Join analytics room
    emit("subscribe:analytics");

    const unsubs = [
      subscribe("analytics:metrics", (data: any) => {
        setLatestMetrics(data);
      }),
      subscribe("analytics:alert", (data: any) => {
        setAlerts((prev) => [data, ...prev].slice(0, 50));
      }),
      subscribe("analytics:executive", (data: any) => {
        setLatestMetrics((prev: any) => ({ ...prev, ...data }));
      }),
      subscribe("analytics:agentEvent", (data: any) => {
        setAgentEvents((prev) => [data, ...prev].slice(0, 100));
      }),
    ];

    return () => {
      emit("unsubscribe:analytics");
      unsubs.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, emit]);

  return { connected, latestMetrics, alerts, agentEvents };
}

/**
 * Subscribe to the monitoring room and receive real-time system health updates.
 */
export function useMonitoringSocket() {
  const { socket, connected, subscribe, emit } = useSocket();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!connected) return;

    emit("subscribe:monitoring");

    const unsubs = [
      subscribe("monitoring:alert", (data: any) => {
        setAlerts((prev) => [data, ...prev].slice(0, 50));
      }),
      subscribe("monitoring:agentEvent", (data: any) => {
        setAgentEvents((prev) => [data, ...prev].slice(0, 100));
      }),
    ];

    return () => {
      emit("unsubscribe:monitoring");
      unsubs.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, emit]);

  return { connected, alerts, agentEvents };
}
