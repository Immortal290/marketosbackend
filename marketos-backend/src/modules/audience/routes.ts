import { Router, Request, Response } from 'express';

const router = Router();

/* ────────────────────────────── CONTACTS ────────────────────────────── */

/**
 * @openapi
 * /audience/contacts:
 *   get:
 *     summary: List contacts
 *     description: Returns a paginated list of contacts in the workspace. Supports search and filtering by lifecycle stage.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: lifecycleStage
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [LEAD, MQL, SQL, OPPORTUNITY, CUSTOMER, EVANGELIST]
 *     responses:
 *       200:
 *         description: Paginated contacts list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Contact' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/contacts', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audience/contacts/{id}:
 *   get:
 *     summary: Get a contact by ID
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Contact detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Contact' }
 *       404:
 *         description: Contact not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/contacts/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, email: 'contact@example.com', firstName: 'Jane', lastName: 'Smith', leadScore: 72, lifecycleStage: 'MQL' } });
});

/**
 * @openapi
 * /audience/contacts:
 *   post:
 *     summary: Create a contact
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, workspaceId]
 *             properties:
 *               email:          { type: string, format: email }
 *               firstName:      { type: string }
 *               lastName:       { type: string }
 *               phone:          { type: string }
 *               workspaceId:    { type: string, format: uuid }
 *               lifecycleStage: { type: string, enum: [LEAD, MQL, SQL, OPPORTUNITY, CUSTOMER, EVANGELIST] }
 *     responses:
 *       201:
 *         description: Contact created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Contact' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/contacts', (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: 'new-uuid', ...req.body, leadScore: 0, createdAt: new Date().toISOString() } });
});

/**
 * @openapi
 * /audience/contacts/{id}:
 *   patch:
 *     summary: Update a contact
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:      { type: string }
 *               lastName:       { type: string }
 *               phone:          { type: string }
 *               lifecycleStage: { type: string, enum: [LEAD, MQL, SQL, OPPORTUNITY, CUSTOMER, EVANGELIST] }
 *     responses:
 *       200:
 *         description: Contact updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Contact' }
 *       404:
 *         description: Contact not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/contacts/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { id: req.params.id, ...req.body } });
});

/**
 * @openapi
 * /audience/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Contact deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Contact not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/contacts/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

/* ────────────────────────────── SEGMENTS ────────────────────────────── */

/**
 * @openapi
 * /audience/segments:
 *   get:
 *     summary: List audience segments
 *     description: Returns all audience segments with size and filter rule summaries.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Segments list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Segment' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/segments', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});

/**
 * @openapi
 * /audience/segments:
 *   post:
 *     summary: Create an audience segment
 *     description: Creates a new audience segment with filter rules. The segment size is calculated asynchronously.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, workspaceId, rules]
 *             properties:
 *               name:        { type: string, example: "High-Value Leads" }
 *               description: { type: string }
 *               workspaceId: { type: string, format: uuid }
 *               rules:
 *                 type: object
 *                 description: Segment filter rules (field/operator/value combinations)
 *     responses:
 *       201:
 *         description: Segment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Segment' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 */
router.post('/segments', (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: 'new-uuid', ...req.body, size: 0, createdAt: new Date().toISOString() } });
});

/**
 * @openapi
 * /audience/segments/{id}:
 *   delete:
 *     summary: Delete a segment
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/resourceId'
 *     responses:
 *       200:
 *         description: Segment deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404:
 *         description: Segment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/segments/:id', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: null });
});

/* ─────────────────────────── LEAD SCORES ───────────────────────────── */

/**
 * @openapi
 * /audience/lead-scores:
 *   get:
 *     summary: Get lead scoring model and distribution
 *     description: Returns the current lead scoring model configuration and the score distribution across contacts.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Lead score data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     model:        { type: object, description: "Scoring rules" }
 *                     distribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           range:  { type: string, example: "80-100" }
 *                           count:  { type: integer, example: 1240 }
 *                           label:  { type: string, example: "Hot" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/lead-scores', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      model: { fields: ['email_opens', 'page_visits', 'demo_requested'] },
      distribution: [
        { range: '80-100', count: 1240, label: 'Hot' },
        { range: '60-79',  count: 3420, label: 'Warm' },
        { range: '40-59',  count: 5810, label: 'Cool' },
        { range: '0-39',   count: 2130, label: 'Cold' },
      ],
    },
  });
});

/* ──────────────────────────── PERSONAS ─────────────────────────────── */

/**
 * @openapi
 * /audience/personas:
 *   get:
 *     summary: List buyer personas
 *     description: Returns all AI-generated buyer personas for the workspace.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Personas list
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
 *                       name:        { type: string, example: "Enterprise CTO" }
 *                       description: { type: string }
 *                       size:        { type: integer, example: 2840 }
 *                       traits:      { type: array, items: { type: string } }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/personas', (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [
    { id: 'p1', name: 'Enterprise CTO', description: 'Technical leader at 500+ employee companies', size: 2840, traits: ['technical', 'risk-averse', 'ROI-focused'] },
    { id: 'p2', name: 'SMB Founder',    description: 'Owner of 10-50 employee companies',          size: 5120, traits: ['budget-conscious', 'growth-driven', 'hands-on'] },
  ]});
});

/* ─────────────────────────── LIFECYCLE STAGES ──────────────────────── */

/**
 * @openapi
 * /audience/lifecycle:
 *   get:
 *     summary: Get lifecycle stage distribution
 *     description: Returns the count of contacts at each lifecycle stage and stage-to-stage conversion rates.
 *     tags: [Audience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/workspaceId'
 *     responses:
 *       200:
 *         description: Lifecycle stage data
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
 *                       stage:       { type: string, enum: [LEAD, MQL, SQL, OPPORTUNITY, CUSTOMER, EVANGELIST] }
 *                       count:       { type: integer }
 *                       convRate:    { type: number, description: "Conversion rate to next stage (%)" }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/lifecycle', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: [
      { stage: 'LEAD',        count: 12400, convRate: 15.1 },
      { stage: 'MQL',         count: 1870,  convRate: 23.0 },
      { stage: 'SQL',         count: 430,   convRate: 43.3 },
      { stage: 'OPPORTUNITY', count: 186,   convRate: 58.1 },
      { stage: 'CUSTOMER',    count: 108,   convRate: null },
      { stage: 'EVANGELIST',  count: 32,    convRate: null },
    ],
  });
});

export default router;
