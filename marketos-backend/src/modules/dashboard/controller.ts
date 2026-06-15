import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './service';
import { StatusCodes } from 'http-status-codes';

export class DashboardController {
  private service = new DashboardService();

  public getKpis = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      const kpis = await this.service.getKpis(workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  };

  public getActivityFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'workspaceId required' });
      const feed = await this.service.getActivityFeed(workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: feed });
    } catch (error) {
      next(error);
    }
  };
}
