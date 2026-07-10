import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from './logger';

export let io: Server;

// Simulate live metric variance around a base value
function jitter(base: number, pct = 0.05): number {
  return parseFloat((base * (1 + (Math.random() * 2 - 1) * pct)).toFixed(2));
}

function buildAnalyticsSnapshot() {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  
  // ── Link analytics to agent functioning ──
  const activeAgents = agents.filter(a => a.status === 'RUNNING');
  const avgSuccessRate = activeAgents.length > 0 
    ? activeAgents.reduce((acc, a) => acc + a.successRate, 0) / activeAgents.length 
    : 90;
  
  const totalTokens = agents.reduce((acc, a) => acc + a.tokenUsage, 0);
  const totalCost = agents.reduce((acc, a) => acc + a.costUsd, 0);
  
  // Performance multiplier based on active agents and their success rate
  const performanceMultiplier = (activeAgents.length / agents.length) * (avgSuccessRate / 100);
  const baseRevenue = 1240000;
  const currentRevenue = baseRevenue * (0.5 + (performanceMultiplier * 0.8));

  return {
    executive: {
      revenue:        jitter(currentRevenue, 0.02),
      pipeline:       jitter(currentRevenue * 4.5, 0.02),
      cac:            jitter(124.5 + (totalCost / 10), 0.04), // AI costs increase CAC slightly
      ltv:            jitter(4800 * (avgSuccessRate / 100), 0.02),
      roas:           jitter(4.2 * (avgSuccessRate / 100), 0.05), // Better agent success = better ROAS
      conversionRate: jitter(3.47 * (avgSuccessRate / 100), 0.06),
    },
    funnel: [
      { stage: 'IMPRESSION', count: Math.round(jitter(1640000, 0.01)), convRate: 100,                    dropoffRate: 0 },
      { stage: 'CLICK',      count: Math.round(jitter(42300,   0.04)), convRate: jitter(2.58,  0.05),   dropoffRate: jitter(97.42, 0.01) },
      { stage: 'VISIT',      count: Math.round(jitter(38100,   0.04)), convRate: jitter(90.1,  0.02),   dropoffRate: jitter(9.9,   0.05) },
      { stage: 'LEAD',       count: Math.round(jitter(12400,   0.05)), convRate: jitter(32.5,  0.04),   dropoffRate: jitter(67.5,  0.02) },
      { stage: 'MQL',        count: Math.round(jitter(1870,    0.06)), convRate: jitter(15.1,  0.05),   dropoffRate: jitter(84.9,  0.02) },
      { stage: 'SQL',        count: Math.round(jitter(430,     0.08)), convRate: jitter(23.0,  0.06),   dropoffRate: jitter(77.0,  0.03) },
      { stage: 'CUSTOMER',   count: Math.round(jitter(186,     0.10)), convRate: jitter(43.3,  0.07),   dropoffRate: jitter(56.7,  0.04) },
    ],
    attribution: [
      { channel: 'EMAIL',    contribution: jitter(34.2, 0.03), revenue: jitter(424080, 0.03) },
      { channel: 'PAID_ADS', contribution: jitter(28.7, 0.03), revenue: jitter(355880, 0.03) },
      { channel: 'SOCIAL',   contribution: jitter(22.1, 0.04), revenue: jitter(274040, 0.04) },
      { channel: 'SMS',      contribution: jitter(15.0, 0.05), revenue: jitter(186000, 0.05) },
    ],
    timestamp: new Date().toISOString(),
  };
}

import { AgentsService } from '../modules/agents/service';

function buildDashboardSnapshot() {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter(a => a.status === 'RUNNING');
  const performanceMultiplier = agents.length > 0 ? activeAgents.length / agents.length : 1;
  const avgSuccessRate = activeAgents.length > 0 
    ? activeAgents.reduce((acc, a) => acc + a.successRate, 0) / activeAgents.length 
    : 90;

  const baseRevenue = 1240000;
  const currentRevenue = baseRevenue * (0.5 + (performanceMultiplier * 0.8));

  return {
    kpis: {
      totalCampaigns:  12,
      activeCampaigns: Math.round(jitter(12 * performanceMultiplier, 0.1)), // More active agents = more active campaigns
      totalLeads:      Math.round(jitter(12400 * (avgSuccessRate / 100), 0.03)),
      revenue:         jitter(currentRevenue, 0.02),
      roas:            jitter(4.2 * (avgSuccessRate / 100), 0.05),
    },
    agents: agents,
    campaignHealth: [
      { campaignId: 'c1', campaignName: 'Q4 Product Launch', healthScore: jitter(91.2 * performanceMultiplier, 0.03), roas: jitter(5.1 * performanceMultiplier, 0.04), ctr: jitter(3.2, 0.05), conversionRate: jitter(4.1, 0.04), budgetStatus: 'ON_TRACK' },
      { campaignId: 'c2', campaignName: 'Summer Sale',       healthScore: jitter(74.3 * performanceMultiplier, 0.04), roas: jitter(2.8 * performanceMultiplier, 0.05), ctr: jitter(1.9, 0.06), conversionRate: jitter(2.3, 0.05), budgetStatus: 'AT_RISK'  },
    ],
    timestamp: new Date().toISOString(),
  };
}

export const initSocket = (server: HttpServer) => {
  const corsOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : '*';

  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Immediately send a snapshot on connect
    socket.emit('analytics:update', buildAnalyticsSnapshot());
    socket.emit('dashboard:update', buildDashboardSnapshot());

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Broadcast live updates to ALL connected clients every 5 seconds
  setInterval(() => {
    if (io.engine.clientsCount > 0) {
      io.emit('analytics:update', buildAnalyticsSnapshot());
      io.emit('dashboard:update', buildDashboardSnapshot());
    }
  }, 5000);

  return io;
};

