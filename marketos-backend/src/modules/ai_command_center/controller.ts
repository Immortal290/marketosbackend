import { Request, Response, NextFunction } from 'express';
import { AiCommandCenterService } from './service';

export class AiCommandCenterController {
  private service = new AiCommandCenterService();
}
