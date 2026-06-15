import { Request, Response, NextFunction } from 'express';
import { WorkflowEngineService } from './service';

export class WorkflowEngineController {
  private service = new WorkflowEngineService();
}
