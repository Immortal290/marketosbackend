import { Router } from 'express';
import { CampaignBriefController } from './controller';
import { validate } from '../../middlewares/validate.middleware';
import { createCampaignBriefSchema } from './validator';

const router = Router();
const controller = new CampaignBriefController();

/**
 * @openapi
 * /campaign/brief:
 *   post:
 *     summary: Create a CampaignBrief and launch the agent pipeline (SSE streaming)
 *     tags: [CampaignBrief]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignBrief'
 *     responses:
 *       200:
 *         description: Server-sent events stream of agent actions
 *       400:
 *         description: Validation error
 */
router.post(
  '/brief',
  validate(createCampaignBriefSchema),
  controller.createAndLaunch
);

export default router;
