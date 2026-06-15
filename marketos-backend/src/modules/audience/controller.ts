import { Request, Response, NextFunction } from 'express';
import { AudienceService } from './service';

export class AudienceController {
  private service = new AudienceService();
}
