import { Agent, AgentType, AgentTask, AgentMemory } from './types';

export class AgentsRepository {
  private getAgentName(type: AgentType): string {
    const parts = type.split('_');
    const capitalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
    return `${capitalized}Agent`;
  }

  public getAllAgents(): Agent[] {
    return Object.values(AgentType).map((type, i) => ({
      id: `agent-${i + 1}`,
      name: this.getAgentName(type),
      type,
      status: ['SUPERVISOR', 'COPY', 'EMAIL', 'COMPLIANCE'].includes(type) ? 'RUNNING' : 'IDLE',
      currentTask: ['SUPERVISOR', 'COPY', 'EMAIL', 'COMPLIANCE'].includes(type) ? 'Processing tasks' : null,
      queueLength: ['SUPERVISOR', 'COPY', 'EMAIL', 'COMPLIANCE'].includes(type) ? 3 : 0,
      successRate: 96 + Math.round(Math.random() * 3 * 10) / 10,
      runtimeMs: 142000,
      tokenUsage: Math.floor(Math.random() * 50000),
      costUsd: Math.round(Math.random() * 200) / 100,
    }));
  }

  public getAgentByType(type: string): Agent | null {
    const uppercaseType = type.toUpperCase() as AgentType;
    if (!Object.values(AgentType).includes(uppercaseType)) {
      return null;
    }
    return {
      id: `agent-${uppercaseType}`,
      name: this.getAgentName(uppercaseType),
      type: uppercaseType,
      status: 'IDLE',
      currentTask: null,
      queueLength: 0,
      successRate: 98.4,
      runtimeMs: 0,
      tokenUsage: 12400,
      costUsd: 0.24,
    };
  }

  public getAgentTasks(type: string, status?: string, page: number = 1, limit: number = 20): { tasks: AgentTask[], total: number } {
    return { tasks: [], total: 0 };
  }

  public getAgentMemory(type: string, memType?: string, search?: string, page: number = 1, limit: number = 20): { memories: AgentMemory[], total: number } {
    return { memories: [], total: 0 };
  }
}
