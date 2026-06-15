import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './service';

export class AnalyticsController {
  private service = new AnalyticsService();
}
