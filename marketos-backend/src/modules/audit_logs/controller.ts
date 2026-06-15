import { Request, Response, NextFunction } from 'express';
import { AuditLogsService } from './service';

export class AuditLogsController {
  private service = new AuditLogsService();
}
