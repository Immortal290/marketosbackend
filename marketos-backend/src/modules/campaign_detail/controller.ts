import { Request, Response, NextFunction } from 'express';
import { CampaignDetailService } from './service';

export class CampaignDetailController {
  private service = new CampaignDetailService();
}
