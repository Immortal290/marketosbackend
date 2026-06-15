import { Request, Response, NextFunction } from 'express';
import { CampaignsService } from './service';
import { StatusCodes } from 'http-status-codes';

export class CampaignsController {
  private service = new CampaignsService();

  // Assuming workspaceId is passed either in body, query, or via a middleware that extracts it from user tokens
  // For simplicity, let's extract it from query or body for now.

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      const campaigns = await this.service.getAll(workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      const campaign = await this.service.getById(req.params.id, workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await this.service.create(req.body);
      res.status(StatusCodes.CREATED).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      const campaign = await this.service.update(req.params.id, workspaceId, req.body);
      res.status(StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      await this.service.delete(req.params.id, workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
}
