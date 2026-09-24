/**
 * WhatsApp Marketing MCP Server (stdio transport)
 * ────────────────────────────────────────────────
 * Exposes two tools so any MCP client (Claude Desktop, custom agents, etc.)
 * can generate and send WhatsApp campaigns using the same core logic and
 * safety rules as the dashboard.
 *
 * Run with:
 *   npm run mcp          (uses tsx — no build step needed)
 *
 * Required env vars (same as marketos-backend/.env):
 *   GEMINI_API_KEY, ZERNIO_API_KEY, ZERNIO_ACCOUNT_ID
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import { generateMessage, sendBulk } from "./core";

const server = new McpServer({ name: "whatsapp-marketing", version: "1.0.0" });

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (e: Error) => ({
  isError: true,
  content: [{ type: "text" as const, text: e.message }],
});

/* ─── Tool: generate_whatsapp_message ───────────────────────────────────── */

server.tool(
  "generate_whatsapp_message",
  "Write a WhatsApp promotional message from a marketing brief. Returns a single message ≤600 characters that ends with an opt-out line.",
  {
    prompt: z
      .string()
      .describe("What the campaign is about: offer, product, target audience, link."),
    brand: z.string().optional().describe("Brand name shown in the message."),
    tone: z
      .string()
      .optional()
      .describe("Message tone, e.g. friendly, premium, playful, urgent but honest, formal."),
    language: z
      .string()
      .optional()
      .describe("Language for the message, e.g. English, Hindi, Spanish."),
  },
  async (args) => {
    try {
      return text(await generateMessage(args));
    } catch (e: any) {
      return fail(e);
    }
  }
);

/* ─── Tool: send_whatsapp_messages ──────────────────────────────────────── */

server.tool(
  "send_whatsapp_messages",
  "Send a WhatsApp campaign message from the connected business number to one or more opted-in customer numbers via Zernio. Returns a per-number Sent/Failed breakdown.",
  {
    business_number: z
      .string()
      .describe(
        "The WhatsApp Business number connected to the Zernio account (with country code, e.g. +14155550100)."
      ),
    recipients: z
      .array(z.string())
      .min(1)
      .describe("Customer phone numbers with country code. Max 500 per call."),
    message: z.string().describe("The WhatsApp message text to send."),
    mode: z
      .enum(["text", "template"])
      .default("text")
      .describe(
        "Use 'template' for customers who have NOT messaged you in the last 24 hours (requires an approved Meta template). Use 'text' for the 24-hour window."
      ),
    template_name: z
      .string()
      .optional()
      .describe("Required when mode=template. The approved Meta template name."),
    language_code: z
      .string()
      .default("en")
      .describe("Template language code, e.g. en, hi, es. Defaults to en."),
    confirm_opt_in: z
      .boolean()
      .describe(
        "MUST be true: confirms that every recipient has explicitly opted in to receive WhatsApp messages from your business."
      ),
  },
  async (a) => {
    try {
      const out = await sendBulk({
        businessNumber: a.business_number,
        recipients: a.recipients,
        message: a.message,
        mode: a.mode,
        templateName: a.template_name,
        languageCode: a.language_code,
        optInConfirmed: a.confirm_opt_in,
      });
      return text(JSON.stringify(out, null, 2));
    } catch (e: any) {
      return fail(e);
    }
  }
);

/* ─── Start ──────────────────────────────────────────────────────────────── */

(async () => {
  await server.connect(new StdioServerTransport());
})();
