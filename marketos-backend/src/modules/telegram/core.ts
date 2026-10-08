/**
 * Telegram Channel Campaign Core
 * ──────────────────────────────
 * Business logic for:
 *  - Generating short Telegram ad messages + image prompts via Gemini AI
 *  - Sending messages to customer phone numbers / chat IDs via:
 *      1. Direct Telegram Bot API (primary — sends to each recipient individually)
 *      2. Composio TELEGRAM_SEND_MESSAGE (fallback if Bot API not configured)
 *
 * Required env vars:
 *   GEMINI_API_KEY           — Gemini AI key
 *   COMPOSIO_API_KEY         — Composio platform key (optional fallback)
 *   TELEGRAM_BOT_TOKEN       — Telegram Bot token from @BotFather
 *
 * NOTE: Telegram bots cannot initiate chats with users who have never started
 *       the bot. The customer must have started the bot (or be in a channel/group
 *       the bot is in) for the send to succeed.
 */

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  COMPOSIO_API_KEY = "",
  TELEGRAM_BOT_TOKEN = "",
  TELEGRAM_CHANNEL_ID = "",
} = process.env;

const TELEGRAM_BOT_API = "https://api.telegram.org";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface TelegramGenerateInput {
  prompt: string;
  brand?: string;
  tone?: string;
  language?: string;
  ctaUrl?: string;
}

export interface TelegramGenerateOutput {
  message: string;
  imagePrompt: string;
  hashtags: string[];
  charCount: number;
}

export interface TelegramSendInput {
  /** List of customer phone numbers (E.164 or local) or Telegram chat IDs.
   *  Phone numbers are passed directly as the chat_id — requires the user
   *  to have started the bot first or be in a shared group/channel. */
  phones: string[];
  message: string;
  botToken?: string; // optional override
}

export interface RecipientResult {
  phone: string;
  sent: boolean;
  provider: "composio" | "telegram_bot_api" | "none";
  messageId?: number;
  error?: string;
}

export interface TelegramSendOutput {
  /** Number of recipients the message was successfully delivered to */
  sentCount: number;
  /** Total recipients attempted */
  total: number;
  results: RecipientResult[];
}

/* ─── AI Generation ──────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a Telegram channel advertising specialist.

Write ONE short Telegram advertisement message for a brand's product/service.

STRICT RULES:
- For image posts (caption): max 280 characters.
- For text-only posts: max 1024 characters.
- Start with a punchy one-line hook. Max 2 emojis total.
- Include exactly ONE call-to-action with the provided URL or [LINK] placeholder.
- No invented discounts, prices, or facts not in the brief.
- End with 2–4 relevant hashtags on their own line.
- Write in the requested language and tone.
- Also provide a short IMAGE PROMPT (≤50 words) for a product/lifestyle visual.

Return ONLY valid JSON:
{
  "message": "<telegram ad text with hashtags>",
  "image_prompt": "<50-word FLUX/DALL-E image prompt>",
  "hashtags": ["#tag1", "#tag2"],
  "char_count": <integer>
}`;

export async function generateTelegramMessage(
  input: TelegramGenerateInput
): Promise<TelegramGenerateOutput> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to marketos-backend/.env"
    );
  }
  if (!input.prompt?.trim()) {
    throw new Error("Prompt is required.");
  }

  const userText = [
    `Brand: ${input.brand || "(not provided)"}`,
    `Tone: ${input.tone || "Friendly"}`,
    `Language: ${input.language || "English"}`,
    `CTA URL: ${input.ctaUrl || "[LINK]"}`,
    `Brief: ${input.prompt}`,
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 800, responseMimeType: "application/json" },
      }),
    }
  );

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? `Gemini API error (${res.status})`
    );
  }

  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!rawText) {
    throw new Error("Gemini returned an empty response (possible safety filter).");
  }

  let parsed: any;
  try {
    // Strip potential ```json fences
    const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(clean);
  } catch {
    // Fallback: use raw text as message
    parsed = {
      message: rawText.slice(0, 1024),
      image_prompt: "",
      hashtags: [],
      char_count: rawText.length,
    };
  }

  return {
    message:     parsed.message     ?? rawText.slice(0, 1024),
    imagePrompt: parsed.image_prompt ?? "",
    hashtags:    Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    charCount:   parsed.char_count  ?? (parsed.message ?? rawText).length,
  };
}

/* ─── Composio send ──────────────────────────────────────────────────────── */

async function sendViaComposio(
  channelId: string,
  text: string
): Promise<TelegramSendOutput> {
  if (!COMPOSIO_API_KEY) {
    return { sent: false, provider: "composio", error: "COMPOSIO_API_KEY not set" };
  }

  try {
    // Composio REST execute-action endpoint
    const res = await fetch("https://backend.composio.dev/api/v1/actions/TELEGRAM_SEND_MESSAGE/execute", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-api-key":      COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connectedAccountId: "ca_WpoPDvF0cbTz",
        input: {
          chat_id:    channelId,
          text:       text,
          parse_mode: "HTML",
        },
      }),
    });

    const data = await res.json() as any;

    if (!res.ok || data?.error) {
      return {
        sent: false,
        provider: "composio",
        error: data?.message ?? data?.error ?? `Composio error (${res.status})`,
      };
    }

    return {
      sent:      true,
      provider:  "composio",
      messageId: data?.data?.result?.message_id,
    };
  } catch (err: any) {
    return { sent: false, provider: "composio", error: err.message };
  }
}

/* ─── Direct Bot API send ────────────────────────────────────────────────── */

async function sendViaBotApi(
  botToken: string,
  channelId: string,
  text: string
): Promise<TelegramSendOutput> {
  try {
    const res = await fetch(`${TELEGRAM_BOT_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    channelId,
        text:       text.slice(0, 4096),
        parse_mode: "HTML",
      }),
    });

    const data = await res.json() as any;

    if (!data.ok) {
      return {
        sent:     false,
        provider: "telegram_bot_api",
        error:    data.description ?? "Unknown Telegram error",
      };
    }

    return {
      sent:      true,
      provider:  "telegram_bot_api",
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    return { sent: false, provider: "telegram_bot_api", error: err.message };
  }
}

/* ─── Orchestrated bulk send to phone numbers / chat IDs ─────────────────── */

export async function sendTelegramMessage(
  input: TelegramSendInput
): Promise<TelegramSendOutput> {
  const phones   = input.phones.map((p) => p.trim()).filter(Boolean);
  const botToken = input.botToken || TELEGRAM_BOT_TOKEN;

  if (phones.length === 0) {
    throw new Error(
      "At least one phone number or chat ID is required."
    );
  }

  if (!botToken && !COMPOSIO_API_KEY) {
    throw new Error(
      "Neither TELEGRAM_BOT_TOKEN nor COMPOSIO_API_KEY is configured on the server."
    );
  }

  const results: RecipientResult[] = [];

  for (const phone of phones) {
    let recipientResult: RecipientResult;

    // Normalise phone: strip spaces/dashes, ensure leading + for international
    const chatId = phone.startsWith("+") || phone.startsWith("-") || /^\d+$/.test(phone)
      ? phone  // numeric chat_id or E.164 phone — pass as-is
      : `+${phone}`;

    if (botToken) {
      // Primary: direct Bot API to the chat_id (phone number as chat identifier)
      const r = await sendViaBotApi(botToken, chatId, input.message);
      recipientResult = { phone, ...r };
    } else if (COMPOSIO_API_KEY) {
      // Fallback: Composio
      const r = await sendViaComposio(chatId, input.message);
      recipientResult = { phone, ...r };
    } else {
      recipientResult = {
        phone,
        sent: false,
        provider: "none",
        error: "No send provider configured",
      };
    }

    results.push(recipientResult);

    // Small delay between sends to avoid Telegram rate-limiting (30 msg/sec global)
    if (phones.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const sentCount = results.filter((r) => r.sent).length;

  return {
    sentCount,
    total: phones.length,
    results,
  };
}
