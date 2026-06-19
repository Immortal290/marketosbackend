export enum AgentType {
  AB_TEST = 'AB_TEST',
  ANALYTICS = 'ANALYTICS',
  COMPETITOR = 'COMPETITOR',
  COMPLIANCE = 'COMPLIANCE',
  COPY = 'COPY',
  CREATIVE = 'CREATIVE',
  EMAIL = 'EMAIL',
  FINANCE = 'FINANCE',
  LEAD_SCORING = 'LEAD_SCORING',
  MONITOR = 'MONITOR',
  ONBOARDING = 'ONBOARDING',
  PERSONALIZATION = 'PERSONALIZATION',
  REPORTING = 'REPORTING',
  SEO = 'SEO',
  SMS = 'SMS',
  SOCIAL = 'SOCIAL',
  SUPERVISOR = 'SUPERVISOR',
  VOICE = 'VOICE'
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'STOPPED';
  currentTask: string | null;
  queueLength: number;
  successRate: number;
  runtimeMs: number;
  tokenUsage: number;
  costUsd: number;
}

export interface AgentTask {
  id: string;
  task: string;
  status: string;
  priority: number;
  startedAt: string;
  durationMs: number;
}

export interface AgentMemory {
  id: string;
  memType: 'WORKING' | 'EPISODIC' | 'SEMANTIC';
  key: string;
  value: any;
  createdAt: string;
}

export interface CommandPayload {
  command: 'PAUSE' | 'RESUME' | 'CLEAR_QUEUE' | 'RESTART' | 'EXECUTE_TASK';
  taskPayload?: any;
}
