import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './service';

export class SettingsController {
  private service = new SettingsService();
}
