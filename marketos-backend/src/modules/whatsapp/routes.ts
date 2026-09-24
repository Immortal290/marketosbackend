import { Router, Request, Response } from "express";
import { requireClerkAuth } from "../../middlewares/auth.middleware";
import { generateMessage, sendBulk } from "./core";

const router = Router();

/**
 * @openapi
 * /whatsapp/generate:
 *   post:
 *     summary: Generate a WhatsApp promotional message from a campaign prompt
 *     description: >
 *       Uses the Gemini AI to write a single WhatsApp promotional message from
 *       the supplied brief. Returns the raw message text (≤ 600 chars, ends
 *       with "Reply STOP to opt out.").
 *     tags: [WhatsApp Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: What the campaign is about (offer, product, audience, link)
 *               brand:
 *                 type: string
 *               tone:
 *                 type: string
 *                 example: friendly
 *               language:
 *                 type: string
 *                 example: English
 *     responses:
 *       200:
 *         description: Generated message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Bad request / missing env variable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/generate",
  requireClerkAuth,
  async (req: Request, res: Response) => {
    try {
      const message = await generateMessage(req.body);
      res.json({ message });
    } catch (e: any) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);

/**
 * @openapi
 * /whatsapp/send:
 *   post:
 *     summary: Send a WhatsApp campaign message to customer numbers
 *     description: >
 *       Validates opt-in confirmation, verifies the business number matches the
 *       Zernio-connected account, then sends the message to every valid recipient
 *       via the Zernio API. Returns a per-number Sent/Failed breakdown.
 *       The opt-in check is enforced server-side even if the UI is bypassed.
 *     tags: [WhatsApp Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [businessNumber, recipients, message, optInConfirmed]
 *             properties:
 *               businessNumber:
 *                 type: string
 *                 description: The WhatsApp Business number connected to this account (with country code)
 *               recipients:
 *                 oneOf:
 *                   - type: string
 *                     description: Newline/comma-separated list of numbers
 *                   - type: array
 *                     items: { type: string }
 *               message:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [text, template]
 *                 default: text
 *               templateName:
 *                 type: string
 *                 description: Required when mode=template
 *               languageCode:
 *                 type: string
 *                 default: en
 *               optInConfirmed:
 *                 type: boolean
 *                 description: Must be true — every recipient has opted in
 *     responses:
 *       200:
 *         description: Per-number send results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent: { type: integer }
 *                 failed: { type: integer }
 *                 invalidNumbers:
 *                   type: array
 *                   items: { type: string }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       to: { type: string }
 *                       ok: { type: boolean }
 *                       messageId: { type: string }
 *                       error: { type: string }
 *       400:
 *         description: Validation error (opt-in missing, number mismatch, missing env, etc.)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/send",
  requireClerkAuth,
  async (req: Request, res: Response) => {
    try {
      const result = await sendBulk(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);

export default router;
