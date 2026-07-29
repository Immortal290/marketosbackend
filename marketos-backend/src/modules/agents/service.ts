/**
 * AgentsService
 *
 * Bridges the Node.js backend to the Python agent service running at
 * AGENT_SERVICE_URL (railway private network: renewed-dedication.railway.internal:8000).
 *
 * All live agent data (list, health, single-agent runs) is fetched from the
 * Python service.  Static data (tasks, memory) still returns mock payloads
 * until those endpoints are added to the Python API.
 */

import { AgentsRepository } from './repository';
import { Agent, AgentTask, AgentMemory, CommandPayload } from './types';
import { producer } from '../../lib/kafka';
import { logger } from '../../lib/logger';
import agentClient, { AgentMeta } from '../../lib/agentClient';

// ── Helper: map Python AgentMeta → Node Agent shape ─────────────────────────

function metaToAgent(meta: AgentMeta, index: number): Agent {
  const typeKey = meta.name.toUpperCase().replace(/-/g, '_') as any;
  return {
    id: `agent-${index + 1}`,
    name: meta.name
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(''),
    type: typeKey,
    status: 'IDLE',
    currentTask: null,
    queueLength: 0,
    successRate: 98.0,
    runtimeMs: 0,
    tokenUsage: 0,
    costUsd: 0,
  };
}

export class AgentsService {
  private repository = new AgentsRepository();

  /**
   * Return live agent list from the Python service, with fallback to the
   * static mock registry if the service is unavailable.
   */
  public async getAllAgents(): Promise<Agent[]> {
    try {
      const response = await agentClient.listAgents();
      if (response.ok && Array.isArray(response.data?.agents)) {
        return response.data.agents.map((meta, i) => metaToAgent(meta, i));
      }
    } catch (err) {
      logger.warn('[AgentsService] Agent service unavailable — falling back to static data:', err);
    }
    // Fallback: static mock data from repository
    return this.repository.getAllAgents();
  }

  /**
   * Synchronous version for backwards-compatible callers that don't await.
   * Prefer getAllAgents() for new code.
   */
  public getAgentByType(type: string): Agent | null {
    return this.repository.getAgentByType(type);
  }

  public getAgentTasks(
    type: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ): { tasks: AgentTask[]; total: number } {
    return this.repository.getAgentTasks(type, status, page, limit);
  }

  public getAgentMemory(
    type: string,
    memType?: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
  ): { memories: AgentMemory[]; total: number } {
    return this.repository.getAgentMemory(type, memType, search, page, limit);
  }

  /**
   * Run a single named agent on the Python service.
   */
  public async runAgent(
    agentName: string,
    state: Record<string, unknown>,
  ) {
    return agentClient.runAgent(agentName, state);
  }

  /**
   * Execute a control command against an agent via Kafka.
   */
  public async executeCommand(type: string, payload: CommandPayload): Promise<boolean> {
    try {
      const topic = `agent.${type.toLowerCase()}.commands`;
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
      logger.info(`Successfully dispatched command to topic ${topic}`);
      return true;
    } catch (error) {
      logger.error('Failed to dispatch command to Kafka:', error);
      return false;
    }
  }
}
