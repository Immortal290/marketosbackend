import { Router } from 'express';
import { BrandProfileController } from './controller';
import { validate } from '../../middlewares/validate.middleware';
import {
  createBrandProfileSchema,
  updateBrandProfileSchema,
  autofillSchema,
} from './validator';

const router = Router();
const controller = new BrandProfileController();

/**
 * @openapi
 * /brand-profile:
 *   post:
 *     summary: Create a new BrandProfile
 *     tags: [BrandProfile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBrandProfile'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 */
router.post('/', validate(createBrandProfileSchema), controller.create);

/**
 * @openapi
 * /brand-profile:
 *   get:
 *     summary: List all BrandProfiles for a workspace
 *     tags: [BrandProfile]
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of BrandProfiles
 */
router.get('/', controller.listByWorkspace);

/**
 * @openapi
 * /brand-profile/{id}:
 *   get:
 *     summary: Get a BrandProfile by ID
 *     tags: [BrandProfile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', controller.getById);

/**
 * @openapi
 * /brand-profile/{id}:
 *   patch:
 *     summary: Update a BrandProfile
 *     tags: [BrandProfile]
 */
router.patch('/:id', validate(updateBrandProfileSchema), controller.update);

/**
 * @openapi
 * /brand-profile/{id}/autofill:
 *   post:
 *     summary: Scrape a website and return suggested BrandProfile field values (does NOT save)
 *     tags: [BrandProfile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               websiteUrl:
 *                 type: string
 */
router.post('/:id/autofill', validate(autofillSchema), controller.autofill);

export default router;
