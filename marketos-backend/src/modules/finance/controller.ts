import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './service';

export class FinanceController {
  private service = new FinanceService();
}
