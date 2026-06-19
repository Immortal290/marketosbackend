import { AgentsRepository } from './repository';
import { Agent, AgentTask, AgentMemory, CommandPayload } from './types';
import { producer } from '../../lib/kafka';
import { logger } from '../../lib/logger';

export class AgentsService {
  private repository = new AgentsRepository();

  public getAllAgents(): Agent[] {
    return this.repository.getAllAgents();
  }

  public getAgentByType(type: string): Agent | null {
    return this.repository.getAgentByType(type);
  }

  public getAgentTasks(type: string, status?: string, page: number = 1, limit: number = 20): { tasks: AgentTask[], total: number } {
    return this.repository.getAgentTasks(type, status, page, limit);
  }

  public getAgentMemory(type: string, memType?: string, search?: string, page: number = 1, limit: number = 20): { memories: AgentMemory[], total: number } {
    return this.repository.getAgentMemory(type, memType, search, page, limit);
  }

  public async executeCommand(type: string, payload: CommandPayload): Promise<boolean> {
    try {
      const topic = `agent.${type.toLowerCase()}.commands`;
      await producer.send({
        topic,
        messages: [
          { value: JSON.stringify(payload) }
        ],
      });
      logger.info(`Successfully dispatched command to topic ${topic}`);
      return true;
    } catch (error) {
      logger.error('Failed to dispatch command to Kafka:', error);
      return false;
    }
  }
}
