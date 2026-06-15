import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './service';

export class ReportsController {
  private service = new ReportsService();
}
