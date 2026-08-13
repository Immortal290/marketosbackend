import { Request, Response, NextFunction } from 'express';
import { BrandProfileService } from './service';
import { StatusCodes } from 'http-status-codes';

export class BrandProfileController {
  private service = new BrandProfileService();

  /** POST /brand-profile */
  public create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.create(req.body);
      res.status(StatusCodes.CREATED).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  /** GET /brand-profile?workspaceId=... */
  public listByWorkspace = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'workspaceId query param is required' });
      const profiles = await this.service.findByWorkspace(workspaceId);
      res.status(StatusCodes.OK).json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  };

  /** GET /brand-profile/:id */
  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.findById(req.params.id);
      res.status(StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /brand-profile/:id */
  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.update(req.params.id, req.body);
      res.status(StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /brand-profile/:id/autofill
   * Body: { websiteUrl: string }
   * Returns suggested field values WITHOUT saving — user must confirm.
   */
  public autofill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suggestions = await this.service.autofill(req.body.websiteUrl);
      res.status(StatusCodes.OK).json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  };
}
