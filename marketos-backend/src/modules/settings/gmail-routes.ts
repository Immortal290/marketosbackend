import { Router, Request, Response, NextFunction } from 'express';
import {
  requireGmailWorkspaceOwner,
  GmailAuthorizedRequest,
} from './gmail-auth';
import {
  getGmailConnectionStatus,
  disconnectGmailConnection,
  saveVerifiedGmailConnection,
} from './gmail-storage';
import { verifyGmailCredentials } from './gmail-smtp';

const router = Router();

// Every Gmail endpoint requires authenticated workspace ownership.
router.use(requireGmailWorkspaceOwner);

function authorizedWorkspaceId(req: Request): string {
  const context = (req as GmailAuthorizedRequest).gmailWorkspace;

  if (!context) {
    throw new Error('Gmail authorization context missing');
  }

  return context.workspaceId;
}

router.post(
  '/connect',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = authorizedWorkspaceId(req);
      const { gmailAddress, appPassword } = req.body ?? {};

      if (
        typeof gmailAddress !== 'string' ||
        typeof appPassword !== 'string' ||
        !gmailAddress.trim() ||
        !appPassword.trim()
      ) {
        res.status(400).json({
          success: false,
          error: 'Gmail address and App Password are required',
        });
        return;
      }

      let verifiedAddress: string;

      try {
        const verification = await verifyGmailCredentials(
          gmailAddress,
          appPassword
        );
        verifiedAddress = verification.gmailAddress;
      } catch {
        res.status(422).json({
          success: false,
          error: 'Gmail verification failed. Check your address, App Password, and connection.',
        });
        return;
      }

      // Persist credentials only after successful SMTP verification.
      const data = await saveVerifiedGmailConnection(
        workspaceId,
        verifiedAddress,
        appPassword
      );

      res.status(200).json({
        success: true,
        status: 'active',
        accountLabel: data.gmailAddress,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = authorizedWorkspaceId(req);
      const data = await getGmailConnectionStatus(workspaceId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = authorizedWorkspaceId(req);
      const data = await disconnectGmailConnection(workspaceId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);


export default router;
