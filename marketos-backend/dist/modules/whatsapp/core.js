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

// src/modules/whatsapp/core.ts
var core_exports = {};
__export(core_exports, {
  generateMessage: () => generateMessage,
  normalizeNumbers: () => normalizeNumbers,
  sendBulk: () => sendBulk,
  verifyBusinessNumber: () => verifyBusinessNumber
});
module.exports = __toCommonJS(core_exports);
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
    const text = String(item).trim();
    if (!text) continue;
    let digits = text.replace(/\D/g, "");
    if (DEFAULT_COUNTRY_CODE && digits.length === 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
    if (digits.length < 8 || digits.length > 15) {
      invalid.push(text);
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
  const text = parts.map((p) => p.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error(
      "The AI returned an empty message (it may have been blocked by a safety filter)."
    );
  }
  return text;
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateMessage,
  normalizeNumbers,
  sendBulk,
  verifyBusinessNumber
});
