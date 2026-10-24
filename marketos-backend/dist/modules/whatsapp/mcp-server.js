"use strict";

// src/modules/whatsapp/mcp-server.ts
var import_config = require("dotenv/config");
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio");
var import_zod = require("zod");

// src/modules/whatsapp/core.ts
var {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  ZERNIO_API_KEY,
  ZERNIO_ACCOUNT_ID,
  DEFAULT_COUNTRY_CODE = "",
  MAX_RECIPIENTS = "500"
} = process.env;
var ZERNIO_BASE = "https://zernio.com/api";
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function normalizeNumbers(input) {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(/[\n,;]+/);
  const valid = [];
  const invalid = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of raw) {
    const text2 = String(item).trim();
    if (!text2) continue;
    let digits = text2.replace(/\D/g, "");
    if (DEFAULT_COUNTRY_CODE && digits.length === 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
    if (digits.length < 8 || digits.length > 15) {
      invalid.push(text2);
      continue;
    }
    if (!seen.has(digits)) {
      seen.add(digits);
      valid.push(digits);
    }
  }
  return { valid, invalid };
}
var SYSTEM_PROMPT = `You are a WhatsApp marketing copywriter for brand managers.
Turn the brief into ONE WhatsApp promotional message.
Rules:
- Under 600 characters. Short lines, easy to read on a phone.
- First line is the hook. One clear call to action at the end.
- At most two emojis. No ALL CAPS shouting, no fake urgency, no invented discounts, prices, dates or claims that are not in the brief.
- If the brief lacks a detail (link, offer, date), use a clear placeholder in [square brackets].
- End with: Reply STOP to opt out.
- Write in the requested language and tone.
Return only the message text. No preamble, no quotes, no markdown.`;
async function generateMessage({
  prompt,
  brand = "",
  tone = "friendly",
  language = "English"
}) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set on the server. Add it to marketos-backend/.env"
    );
  }
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt is empty.");
  }
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
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Brand: ${brand || "(not given)"}
Tone: ${tone}
Language: ${language}
Brief: ${prompt}`
              }
            ]
          }
        ],
        generationConfig: { maxOutputTokens: 600 }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? `Gemini API request failed (${res.status})`
    );
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text2 = parts.map((p) => p.text ?? "").join("\n").trim();
  if (!text2) {
    throw new Error(
      "The AI returned an empty message (it may have been blocked by a safety filter)."
    );
  }
  return text2;
}
function requireZernioConfig() {
  if (!ZERNIO_API_KEY) {
    throw new Error(
      "ZERNIO_API_KEY must be set on the server. Get it from the Zernio dashboard (zernio.com)."
    );
  }
}
function zernioHeaders() {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    "content-type": "application/json"
  };
}
async function verifyBusinessNumber(businessNumber) {
  requireZernioConfig();
  const typed = normalizeNumbers([businessNumber]).valid[0];
  if (!typed) {
    throw new Error(
      "The business number you entered is not a valid phone number. Include the country code, e.g. +14155550100."
    );
  }
  const pnRes = await fetch(`${ZERNIO_BASE}/v1/whatsapp/phone-numbers`, {
    headers: zernioHeaders()
  });
  const pnData = await pnRes.json();
  if (!pnRes.ok) {
    throw new Error(
      pnData?.error?.message ?? pnData?.message ?? `Zernio error fetching WhatsApp phone numbers (HTTP ${pnRes.status}).`
    );
  }
  const connected = pnData.connected ?? [];
  const sandbox = pnData.sandbox ?? null;
  for (const entry of connected) {
    const entryDigits = String(entry.phoneNumber).replace(/\D/g, "");
    if (entryDigits.endsWith(typed.slice(-10))) {
      const resolvedId = ZERNIO_ACCOUNT_ID || entry.accountId;
      return {
        accountId: resolvedId,
        number: entry.phoneNumber,
        name: entry.displayName ?? ""
      };
    }
  }
  if (sandbox) {
    const sandboxDigits = String(sandbox.phoneNumber).replace(/\D/g, "");
    if (sandboxDigits.endsWith(typed.slice(-10))) {
      return {
        accountId: sandbox.accountId,
        number: sandbox.phoneNumber,
        name: "Sandbox"
      };
    }
  }
  if (ZERNIO_ACCOUNT_ID) {
    const accRes = await fetch(`${ZERNIO_BASE}/v1/accounts`, {
      headers: zernioHeaders()
    });
    const accData = await accRes.json();
    const accounts = accData.accounts ?? [];
    const waAccount = accounts.find((a) => {
      if (a.platform !== "whatsapp") return false;
      const num = String(a.username ?? a.phoneNumber ?? "").replace(/\D/g, "");
      return num.endsWith(typed.slice(-10));
    });
    if (waAccount) {
      return {
        accountId: ZERNIO_ACCOUNT_ID,
        number: waAccount.username ?? waAccount.phoneNumber ?? typed,
        name: ""
      };
    }
  }
  const connectedNums = connected.map((e) => e.phoneNumber).join(", ") || "none";
  const sandboxNum = sandbox ? ` | Sandbox: ${sandbox.phoneNumber}` : "";
  throw new Error(
    `The business number +${typed} is not connected to your Zernio account.
Connected numbers: ${connectedNums}${sandboxNum}.
Connect your WhatsApp Business number in the Zernio dashboard first.`
  );
}
function buildPayload(to, { accountId, mode, message, templateName, languageCode }) {
  const base = { accountId, participantId: to };
  if (mode === "template") {
    const flat = message.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
    return {
      ...base,
      templateName,
      templateLanguage: languageCode ?? "en",
      templateParams: [flat]
    };
  }
  return { ...base, message };
}
async function sendOne(to, opts) {
  const res = await fetch(`${ZERNIO_BASE}/v1/inbox/conversations`, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify(buildPayload(to, opts))
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      to,
      ok: false,
      error: data?.error?.message ?? data?.message ?? data?.error ?? `HTTP ${res.status}`
    };
  }
  return {
    to,
    ok: true,
    messageId: data?.data?.id ?? data?.id ?? data?._id
  };
}
async function sendBulk({
  businessNumber,
  recipients,
  message,
  mode = "text",
  templateName,
  languageCode = "en",
  optInConfirmed = false
}) {
  if (!optInConfirmed) {
    throw new Error(
      "You must confirm that every recipient has opted in to receive WhatsApp messages from your business before sending."
    );
  }
  if (!message || !message.trim()) {
    throw new Error("Message is empty.");
  }
  if (mode === "template" && !templateName) {
    throw new Error("Template name is required when using template send mode.");
  }
  const { accountId } = await verifyBusinessNumber(businessNumber);
  const { valid, invalid } = normalizeNumbers(recipients);
  if (!valid.length) {
    throw new Error(
      "No valid recipient numbers found. Use international format, e.g. +14155550123."
    );
  }
  const cap = Number(MAX_RECIPIENTS);
  if (valid.length > cap) {
    throw new Error(
      `Too many recipients (${valid.length}). Maximum allowed per send is ${cap}.`
    );
  }
  const opts = { accountId, mode, message, templateName, languageCode };
  const results = [];
  for (let i = 0; i < valid.length; i += 5) {
    const batch = valid.slice(i, i + 5);
    results.push(...await Promise.all(batch.map((n) => sendOne(n, opts))));
    if (i + 5 < valid.length) await sleep(300);
  }
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    invalidNumbers: invalid,
    results
  };
}

// src/modules/whatsapp/mcp-server.ts
var server = new import_mcp.McpServer({ name: "whatsapp-marketing", version: "1.0.0" });
var text = (t) => ({ content: [{ type: "text", text: t }] });
var fail = (e) => ({
  isError: true,
  content: [{ type: "text", text: e.message }]
});
server.tool(
  "generate_whatsapp_message",
  "Write a WhatsApp promotional message from a marketing brief. Returns a single message \u2264600 characters that ends with an opt-out line.",
  {
    prompt: import_zod.z.string().describe("What the campaign is about: offer, product, target audience, link."),
    brand: import_zod.z.string().optional().describe("Brand name shown in the message."),
    tone: import_zod.z.string().optional().describe("Message tone, e.g. friendly, premium, playful, urgent but honest, formal."),
    language: import_zod.z.string().optional().describe("Language for the message, e.g. English, Hindi, Spanish.")
  },
  async (args) => {
    try {
      return text(await generateMessage(args));
    } catch (e) {
      return fail(e);
    }
  }
);
server.tool(
  "send_whatsapp_messages",
  "Send a WhatsApp campaign message from the connected business number to one or more opted-in customer numbers via Zernio. Returns a per-number Sent/Failed breakdown.",
  {
    business_number: import_zod.z.string().describe(
      "The WhatsApp Business number connected to the Zernio account (with country code, e.g. +14155550100)."
    ),
    recipients: import_zod.z.array(import_zod.z.string()).min(1).describe("Customer phone numbers with country code. Max 500 per call."),
    message: import_zod.z.string().describe("The WhatsApp message text to send."),
    mode: import_zod.z.enum(["text", "template"]).default("text").describe(
      "Use 'template' for customers who have NOT messaged you in the last 24 hours (requires an approved Meta template). Use 'text' for the 24-hour window."
    ),
    template_name: import_zod.z.string().optional().describe("Required when mode=template. The approved Meta template name."),
    language_code: import_zod.z.string().default("en").describe("Template language code, e.g. en, hi, es. Defaults to en."),
    confirm_opt_in: import_zod.z.boolean().describe(
      "MUST be true: confirms that every recipient has explicitly opted in to receive WhatsApp messages from your business."
    )
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
        optInConfirmed: a.confirm_opt_in
      });
      return text(JSON.stringify(out, null, 2));
    } catch (e) {
      return fail(e);
    }
  }
);
(async () => {
  await server.connect(new import_stdio.StdioServerTransport());
})();
