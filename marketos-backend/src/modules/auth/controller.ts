import { Request, Response, NextFunction } from 'express';
import { AuthService } from './service';
import { StatusCodes } from 'http-status-codes';

export class AuthController {
  private service = new AuthService();

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.service.register(req.body);
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.service.login(req.body);
      res.status(StatusCodes.OK).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'refreshToken is required',
        });
      }
      const tokens = await this.service.refresh(refreshToken);
      res.status(StatusCodes.OK).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In production: invalidate the refresh token in the DB/Redis store
      res.status(StatusCodes.OK).json({
        success: true,
        data: null,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.user is populated by auth middleware; stub for now
      const userId: string = (req as any).user?.userId ?? 'unknown';
      const user = await this.service.getMe(userId);
      res.status(StatusCodes.OK).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };
}
