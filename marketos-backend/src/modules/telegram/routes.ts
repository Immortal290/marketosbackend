import { Router, Request, Response } from "express";
import { requireClerkAuth } from "../../middlewares/auth.middleware";
import { generateTelegramMessage, sendTelegramMessage } from "./core";

const router = Router();

/**
 * @openapi
 * /telegram/generate:
 *   post:
 *     summary: Generate a Telegram advertisement message using AI
 *     description: >
 *       Uses Gemini to write a short Telegram channel advertisement (≤1024 chars)
 *       including a call-to-action and hashtags. Also returns an image prompt
 *       suitable for FLUX/DALL-E image generation.
 *     tags: [Telegram Campaigns]
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
 *                 description: Campaign brief — product, offer, audience, goal
 *               brand:
 *                 type: string
 *               tone:
 *                 type: string
 *                 example: Friendly
 *               language:
 *                 type: string
 *                 example: English
 *               ctaUrl:
 *                 type: string
 *                 example: https://yourdomain.com/offer
 *     responses:
 *       200:
 *         description: Generated message + image prompt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:      { type: string }
 *                 imagePrompt:  { type: string }
 *                 hashtags:
 *                   type: array
 *                   items: { type: string }
 *                 charCount:    { type: integer }
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/generate",
  requireClerkAuth,
  async (req: Request, res: Response) => {
    try {
      const result = await generateTelegramMessage(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);

/**
 * @openapi
 * /telegram/send:
 *   post:
 *     summary: Send AI-generated ad message to customer phone numbers
 *     description: >
 *       Posts the provided message directly to each customer phone number
 *       (or Telegram chat ID) via the Telegram Bot API. Each recipient
 *       must have previously started the bot to receive messages.
 *     tags: [Telegram Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phones, message]
 *             properties:
 *               phones:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: |
 *                   List of customer phone numbers (E.164 format, e.g. +919876543210)
 *                   or Telegram numeric chat IDs.
 *               message:
 *                 type: string
 *                 description: The AI-generated ad message to send
 *               botToken:
 *                 type: string
 *                 description: Optional bot token override (uses server env by default)
 *     responses:
 *       200:
 *         description: Bulk send result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sentCount: { type: integer }
 *                 total:     { type: integer }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       phone:     { type: string }
 *                       sent:      { type: boolean }
 *                       provider:  { type: string }
 *                       messageId: { type: integer }
 *                       error:     { type: string }
 *       400:
 *         description: Validation error or missing configuration
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/send",
  requireClerkAuth,
  async (req: Request, res: Response) => {
    try {
      const result = await sendTelegramMessage(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);

export default router;
