import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './service';

export class MonitoringController {
  private service = new MonitoringService();
}
