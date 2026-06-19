import { Request, Response, NextFunction } from 'express';
import { AgentsService } from './service';

export class AgentsController {
  private service = new AgentsService();

  public getAllAgents = (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = this.service.getAllAgents();
      res.status(200).json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  };

  public getAgentByType = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType } = req.params;
      const agent = this.service.getAgentByType(agentType);
      
      if (!agent) {
        return res.status(404).json({ success: false, message: 'Agent type not found' });
      }

      res.status(200).json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  };

  public getAgentTasks = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType } = req.params;
      const { status, page, limit } = req.query;
      
      const { tasks, total } = this.service.getAgentTasks(
        agentType, 
        status as string | undefined, 
        parseInt(page as string) || 1, 
        parseInt(limit as string) || 20
      );
      
      res.status(200).json({ 
        success: true, 
        data: tasks, 
        meta: { total, page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 20, pages: Math.ceil(total / (parseInt(limit as string) || 20)) } 
      });
    } catch (error) {
      next(error);
    }
  };

  public getAgentMemory = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType } = req.params;
      const { memType, search, page, limit } = req.query;
      
      const { memories, total } = this.service.getAgentMemory(
        agentType,
        memType as string | undefined,
        search as string | undefined,
        parseInt(page as string) || 1, 
        parseInt(limit as string) || 20
      );
      
      res.status(200).json({ 
        success: true, 
        data: memories, 
        meta: { total, page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 20, pages: Math.ceil(total / (parseInt(limit as string) || 20)) } 
      });
    } catch (error) {
      next(error);
    }
  };

  public executeCommand = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentType } = req.params;
      const { command, taskPayload } = req.body;

      if (!command) {
        return res.status(400).json({ success: false, message: 'Command is required' });
      }

      const success = await this.service.executeCommand(agentType, { command, taskPayload });
      
      if (!success) {
        return res.status(500).json({ success: false, message: 'Failed to dispatch command to agent via Kafka' });
      }

      res.status(200).json({ 
        success: true, 
        data: { agentType, command, status: 'ACCEPTED' } 
      });
    } catch (error) {
      next(error);
    }
  };
}
