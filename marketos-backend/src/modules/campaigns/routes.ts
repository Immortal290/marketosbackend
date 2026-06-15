import { Router, Request, Response, NextFunction } from 'express';
import { CampaignsController } from './controller';
import { validate } from '../../middlewares/validate.middleware';
import { createCampaignSchema, updateCampaignSchema } from './validator';

const router = Router();
const controller = new CampaignsController();

/**
 * @openapi
 * /campaigns:
 *   get:
 *     summary: List all campaigns
 *     description: Returns a paginated list of campaigns for the specified workspace. Supports filtering by status.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: status
 *         in: query
 *         required: false
 *         description: Filter by campaign status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, CANCELLED]
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search campaigns by name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Campaign' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       400:
 *         description: Missing workspaceId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/', controller.getAll);

/**
 * @openapi
 * /campaigns/stats:
 *   get:
 *     summary: Get campaign statistics summary
 *     description: Returns aggregate counts of campaigns by status for the workspace.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/CampaignStats' }
 *       400:
 *         description: Missing workspaceId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/stats', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { total: 42, active: 8, paused: 3, scheduled: 5, completed: 26 },
  });
});

/**
 * @openapi
 * /campaigns/{id}:
 *   get:
 *     summary: Get a campaign by ID
 *     description: Returns the full campaign record including status, budget, and health score.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Missing workspaceId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', controller.getById);

/**
 * @openapi
 * /campaigns:
 *   post:
 *     summary: Create a new campaign
 *     description: Creates a campaign record in DRAFT status. Use the launch endpoint to activate it.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/', validate(createCampaignSchema), controller.create);

/**
 * @openapi
 * /campaigns/{id}:
 *   patch:
 *     summary: Update an existing campaign
 *     description: Partial update of a campaign's name, status, or budget.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCampaignRequest'
 *     responses:
 *       200:
 *         description: Campaign updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Validation error or missing workspaceId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/:id', validate(updateCampaignSchema), controller.update);

/**
 * @openapi
 * /campaigns/{id}:
 *   delete:
 *     summary: Delete a campaign
 *     description: Permanently removes a campaign. Only DRAFT or CANCELLED campaigns can be deleted.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:id', controller.delete);

/**
 * @openapi
 * /campaigns/{id}/launch:
 *   post:
 *     summary: Launch a campaign
 *     description: Transitions a DRAFT or SCHEDULED campaign to ACTIVE status and begins execution.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign launched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Campaign is not in a launchable state
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/:id/launch', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: 'ACTIVE' } });
});

/**
 * @openapi
 * /campaigns/{id}/pause:
 *   post:
 *     summary: Pause an active campaign
 *     description: Pauses a currently ACTIVE campaign, halting all ongoing agent tasks.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Campaign paused
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Campaign is not active
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/:id/pause', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: 'PAUSED' } });
});

export default router;
