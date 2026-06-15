import { Request, Response, NextFunction } from 'express';
import { AgentsService } from './service';

export class AgentsController {
  private service = new AgentsService();
}
