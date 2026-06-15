import { Request, Response, NextFunction } from 'express';
import { CreativeStudioService } from './service';

export class CreativeStudioController {
  private service = new CreativeStudioService();
}
