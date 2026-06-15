import { Request, Response, NextFunction } from 'express';
import { CompetitiveIntelligenceService } from './service';

export class CompetitiveIntelligenceController {
  private service = new CompetitiveIntelligenceService();
}
