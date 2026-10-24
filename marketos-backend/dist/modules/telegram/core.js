"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/telegram/core.ts
var core_exports = {};
__export(core_exports, {
  generateTelegramMessage: () => generateTelegramMessage,
  sendTelegramMessage: () => sendTelegramMessage
});
module.exports = __toCommonJS(core_exports);
var {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  COMPOSIO_API_KEY = "",
  TELEGRAM_BOT_TOKEN = "",
  TELEGRAM_CHANNEL_ID = ""
} = process.env;
var TELEGRAM_BOT_API = "https://api.telegram.org";
var SYSTEM_PROMPT = `You are a Telegram channel advertising specialist.

Write ONE short Telegram advertisement message for a brand's product/service.

STRICT RULES:
- For image posts (caption): max 280 characters.
- For text-only posts: max 1024 characters.
- Start with a punchy one-line hook. Max 2 emojis total.
- Include exactly ONE call-to-action with the provided URL or [LINK] placeholder.
- No invented discounts, prices, or facts not in the brief.
- End with 2\u20134 relevant hashtags on their own line.
- Write in the requested language and tone.
- Also provide a short IMAGE PROMPT (\u226450 words) for a product/lifestyle visual.

Return ONLY valid JSON:
{
  "message": "<telegram ad text with hashtags>",
  "image_prompt": "<50-word FLUX/DALL-E image prompt>",
  "hashtags": ["#tag1", "#tag2"],
  "char_count": <integer>
}`;
async function generateTelegramMessage(input) {
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
    `Brief: ${input.prompt}`
  ].join("\n");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 800, responseMimeType: "application/json" }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? `Gemini API error (${res.status})`
    );
  }
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!rawText) {
    throw new Error("Gemini returned an empty response (possible safety filter).");
  }
  let parsed;
  try {
    const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      message: rawText.slice(0, 1024),
      image_prompt: "",
      hashtags: [],
      char_count: rawText.length
    };
  }
  return {
    message: parsed.message ?? rawText.slice(0, 1024),
    imagePrompt: parsed.image_prompt ?? "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    charCount: parsed.char_count ?? (parsed.message ?? rawText).length
  };
}
async function sendViaComposio(channelId, text) {
  if (!COMPOSIO_API_KEY) {
    return { sent: false, provider: "composio", error: "COMPOSIO_API_KEY not set" };
  }
  try {
    const res = await fetch("https://backend.composio.dev/api/v1/actions/TELEGRAM_SEND_MESSAGE/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY
      },
      body: JSON.stringify({
        connectedAccountId: "ca_WpoPDvF0cbTz",
        input: {
          chat_id: channelId,
          text,
          parse_mode: "HTML"
        }
      })
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      return {
        sent: false,
        provider: "composio",
        error: data?.message ?? data?.error ?? `Composio error (${res.status})`
      };
    }
    return {
      sent: true,
      provider: "composio",
      messageId: data?.data?.result?.message_id
    };
  } catch (err) {
    return { sent: false, provider: "composio", error: err.message };
  }
}
async function sendViaBotApi(botToken, channelId, text) {
  try {
    const res = await fetch(`${TELEGRAM_BOT_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: text.slice(0, 4096),
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (!data.ok) {
      return {
        sent: false,
        provider: "telegram_bot_api",
        error: data.description ?? "Unknown Telegram error"
      };
    }
    return {
      sent: true,
      provider: "telegram_bot_api",
      messageId: data.result?.message_id
    };
  } catch (err) {
    return { sent: false, provider: "telegram_bot_api", error: err.message };
  }
}
async function sendTelegramMessage(input) {
  const phones = input.phones.map((p) => p.trim()).filter(Boolean);
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
  const results = [];
  for (const phone of phones) {
    let recipientResult;
    const chatId = phone.startsWith("+") || phone.startsWith("-") || /^\d+$/.test(phone) ? phone : `+${phone}`;
    if (botToken) {
      const r = await sendViaBotApi(botToken, chatId, input.message);
      recipientResult = { phone, ...r };
    } else if (COMPOSIO_API_KEY) {
      const r = await sendViaComposio(chatId, input.message);
      recipientResult = { phone, ...r };
    } else {
      recipientResult = {
        phone,
        sent: false,
        provider: "none",
        error: "No send provider configured"
      };
    }
    results.push(recipientResult);
    if (phones.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const sentCount = results.filter((r) => r.sent).length;
  return {
    sentCount,
    total: phones.length,
    results
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateTelegramMessage,
  sendTelegramMessage
});
