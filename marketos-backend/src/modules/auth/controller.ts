
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from './service';
import { AuthenticatedRequest } from '../../middlewares/jwt-auth.middleware';

export class AuthController {
  private service = new AuthService();

  public register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
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

  public login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
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

  public refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { refreshToken } = req.body;

      if (typeof refreshToken !== 'string' || !refreshToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'refreshToken is required',
        });
      }

      const tokens = await this.service.refresh(refreshToken);
      return res.status(StatusCodes.OK).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { refreshToken } = req.body;

      if (typeof refreshToken !== 'string' || !refreshToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'refreshToken is required',
        });
      }

      await this.service.logout(refreshToken);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: null,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public me = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;

      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await this.service.getMe(userId);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  public google = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { idToken } = req.body;

      if (typeof idToken !== 'string' || !idToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Google ID token is required',
        });
      }

      const tokens = await this.service.googleLogin(idToken);

      return res.status(StatusCodes.OK).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  };
}
