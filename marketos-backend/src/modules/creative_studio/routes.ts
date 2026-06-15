import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /creative-studio/assets:
 *   get:
 *     summary: List creative assets
 *     description: Returns a paginated list of all creative assets — images, videos, copy, templates, and landing pages.
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [IMAGE, VIDEO, COPY, TEMPLATE, LANDING_PAGE]
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Assets list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Asset' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/assets', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /creative-studio/assets/{id}:
 *   delete:
 *     summary: Delete a creative asset
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Asset deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Asset not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/assets/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

/**
 * @openapi
 * /creative-studio/brand-kit:
 *   get:
 *     summary: Get brand kit
 *     description: Returns the workspace brand kit — colors, fonts, logo variants, and tone of voice guidelines.
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Brand kit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     colors:
 *                       type: object
 *                       properties:
 *                         primary:   { type: string, example: "#6C63FF" }
 *                         secondary: { type: string, example: "#FF6584" }
 *                         background: { type: string, example: "#0F0F1A" }
 *                     fonts:
 *                       type: object
 *                       properties:
 *                         heading: { type: string, example: "Inter" }
 *                         body:    { type: string, example: "Inter" }
 *                     logos:   { type: array, items: { type: string, format: uri } }
 *                     toneOfVoice: { type: string, example: "Professional, confident, data-driven" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/brand-kit', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { colors: { primary: '#6C63FF', secondary: '#FF6584', background: '#0F0F1A' }, fonts: { heading: 'Inter', body: 'Inter' }, logos: [], toneOfVoice: 'Professional, confident, data-driven' } });
});

/**
 * @openapi
 * /creative-studio/brand-kit:
 *   patch:
 *     summary: Update brand kit
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               colors:      { type: object }
 *               fonts:       { type: object }
 *               toneOfVoice: { type: string }
 *     responses:
 *       200:
 *         description: Brand kit updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.patch('/brand-kit', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: req.body });
});

/**
 * @openapi
 * /creative-studio/generate:
 *   post:
 *     summary: Generate creative assets with AI
 *     description: Submits a creative generation request to the Creative Agent. Supports generating email copy, social posts, ad creatives, and landing page content.
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, prompt, workspaceId]
 *             properties:
 *               type:        { type: string, enum: [EMAIL_COPY, SOCIAL_POST, AD_CREATIVE, LANDING_PAGE, SMS_COPY] }
 *               prompt:      { type: string, example: "Write a compelling subject line for our Q4 product launch targeting CTOs" }
 *               workspaceId: { type: string, format: uuid }
 *               campaignId:  { type: string, format: uuid }
 *               variants:    { type: integer, default: 3, minimum: 1, maximum: 10 }
 *               brandKit:    { type: boolean, default: true, description: "Apply workspace brand kit" }
 *     responses:
 *       200:
 *         description: Generation task queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:      { type: string, format: uuid }
 *                     status:      { type: string, enum: [QUEUED, GENERATING] }
 *                     estimatedMs: { type: integer, example: 8000 }
 *       400:
 *         description: Invalid generation request
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/generate', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { taskId: 'gen-task-uuid', status: 'QUEUED', estimatedMs: 8000 } });
});

/**
 * @openapi
 * /creative-studio/generated:
 *   get:
 *     summary: List AI-generated creatives
 *     description: Returns all creatives previously generated by the Creative Agent, with status and download links.
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [EMAIL_COPY, SOCIAL_POST, AD_CREATIVE, LANDING_PAGE, SMS_COPY] }
 *     responses:
 *       200:
 *         description: Generated creatives list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:        { type: string, format: uuid }
 *                       type:      { type: string }
 *                       status:    { type: string, enum: [QUEUED, GENERATING, READY, FAILED] }
 *                       variants:  { type: array, items: { type: object } }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/generated', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /creative-studio/templates:
 *   get:
 *     summary: List creative templates
 *     description: Returns all email, social, landing page, and campaign templates available in the workspace.
 *     tags: [Creative Studio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: type
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [EMAIL, SOCIAL, LANDING_PAGE, CAMPAIGN] }
 *     responses:
 *       200:
 *         description: Templates list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Asset' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/templates', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

export default router;
