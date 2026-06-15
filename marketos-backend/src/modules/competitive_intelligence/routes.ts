import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /competitive-intelligence/competitors:
 *   get:
 *     summary: List tracked competitors
 *     description: Returns all competitors being monitored for the workspace.
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Competitors list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Competitor' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/competitors', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'c1', name: 'RivalCo', website: 'https://rivalco.com', adSpend: 250000, keywords: ['crm', 'marketing automation'] },
  ]});
});

/**
 * @openapi
 * /competitive-intelligence/competitors:
 *   post:
 *     summary: Add a competitor to track
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, website, workspaceId]
 *             properties:
 *               name:        { type: string, example: "RivalCo" }
 *               website:     { type: string, format: uri }
 *               workspaceId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Competitor added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Competitor' }
 */
router.post('/competitors', (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: 'new-uuid', ...req.body } });
});

/**
 * @openapi
 * /competitive-intelligence/competitors/{id}:
 *   delete:
 *     summary: Remove a tracked competitor
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Competitor removed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.delete('/competitors/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

/**
 * @openapi
 * /competitive-intelligence/ad-monitoring:
 *   get:
 *     summary: Get competitor ad monitoring data
 *     description: Returns ads detected from tracked competitors across Google, Meta, and LinkedIn.
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: competitorId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: platform
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [GOOGLE, META, LINKEDIN, TIKTOK] }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Competitor ads
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
 *                       id:           { type: string, format: uuid }
 *                       competitorId: { type: string, format: uuid }
 *                       platform:     { type: string }
 *                       adCopy:       { type: string }
 *                       imageUrl:     { type: string, format: uri }
 *                       targetAudience: { type: string }
 *                       firstSeen:    { type: string, format: date-time }
 *                       lastSeen:     { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/ad-monitoring', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /competitive-intelligence/pricing:
 *   get:
 *     summary: Get competitor pricing changes
 *     description: Returns detected pricing changes from competitor websites, tracked by the Competitor Agent.
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - name: competitorId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pricing change events
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
 *                       id:           { type: string, format: uuid }
 *                       competitorId: { type: string, format: uuid }
 *                       product:      { type: string }
 *                       oldPrice:     { type: number }
 *                       newPrice:     { type: number }
 *                       changePct:    { type: number }
 *                       detectedAt:   { type: string, format: date-time }
 */
router.get('/pricing', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

/**
 * @openapi
 * /competitive-intelligence/seo:
 *   get:
 *     summary: Get SEO comparison data
 *     description: Returns keyword ranking comparisons, domain authority scores, and backlink analysis vs tracked competitors.
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: SEO comparison
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     yourDomain:    { type: object, properties: { domainAuthority: { type: integer }, organicKeywords: { type: integer }, backlinks: { type: integer } } }
 *                     competitors:   { type: array, items: { type: object } }
 *                     keywordGaps:   { type: array, items: { type: object } }
 */
router.get('/seo', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { yourDomain: { domainAuthority: 48, organicKeywords: 3200, backlinks: 12400 }, competitors: [], keywordGaps: [] } });
});

/**
 * @openapi
 * /competitive-intelligence/opportunities:
 *   get:
 *     summary: Get opportunity feed
 *     description: Returns AI-generated competitive opportunity alerts — e.g., competitor paused campaigns, pricing gaps, uncontested keywords.
 *     tags: [Competitive Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Opportunities list
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
 *                       id:          { type: string, format: uuid }
 *                       type:        { type: string, enum: [KEYWORD_GAP, PRICING_GAP, AD_PAUSE, CONTENT_GAP] }
 *                       title:       { type: string }
 *                       description: { type: string }
 *                       impact:      { type: string, enum: [LOW, MEDIUM, HIGH] }
 *                       detectedAt:  { type: string, format: date-time }
 */
router.get('/opportunities', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'o1', type: 'PRICING_GAP', title: 'RivalCo raised starter plan price by 25%', description: 'Their starter plan now costs $149/mo vs your $99/mo — opportunity to capture price-sensitive segment', impact: 'HIGH', detectedAt: new Date().toISOString() },
  ]});
});

export default router;
