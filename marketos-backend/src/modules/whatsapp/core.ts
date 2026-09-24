/**
 * WhatsApp Campaign Core
 * ─────────────────────
 * All business logic lives here so it is reusable by:
 *  - The Express API routes (routes.ts)
 *  - The MCP server (mcp-server.ts)
 *
 * Secrets are read from process.env — never from request payloads.
 *
 * Zernio API reference (verified against live OpenAPI spec):
 *  GET  /v1/accounts                        → list connected social accounts
 *  GET  /v1/whatsapp/phone-numbers          → { connected: [{phoneNumber, accountId}], sandbox: {...} }
 *  POST /v1/inbox/conversations             → send message / start conversation
 *       Body: { accountId, participantId, message? } (text)
 *            | { accountId, participantId, templateName, templateLanguage, templateParams[] } (template)
 */

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  ZERNIO_API_KEY,
  ZERNIO_ACCOUNT_ID,
  DEFAULT_COUNTRY_CODE = "",
  MAX_RECIPIENTS = "500",
} = process.env;

const ZERNIO_BASE = "https://zernio.com/api";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface GenerateInput {
  prompt: string;
  brand?: string;
  tone?: string;
  language?: string;
}

export interface SendInput {
  businessNumber: string;
  recipients: string | string[];
  message: string;
  mode?: "text" | "template";
  templateName?: string;
  languageCode?: string;
  optInConfirmed?: boolean;
}

export interface SendResult {
  to: string;
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSendOutput {
  sent: number;
  failed: number;
  invalidNumbers: string[];
  results: SendResult[];
}

export interface NumberParseResult {
  valid: string[];
  invalid: string[];
}

/* ─── Number normalisation ───────────────────────────────────────────────── */

/**
 * Accepts a raw string (newline / comma / semicolon separated) or an array of
 * phone-number strings. Returns two lists: valid E.164-style digit strings
 * and raw strings that look malformed.
 */
export function normalizeNumbers(input: string | string[]): NumberParseResult {
  const raw: string[] = Array.isArray(input)
    ? input
    : String(input ?? "").split(/[\n,;]+/);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const text = String(item).trim();
    if (!text) continue;

    let digits = text.replace(/\D/g, "");

    // Prefix country code when a 10-digit number is given without one
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

/* ─── AI agent: prompt → WhatsApp message ───────────────────────────────── */

const SYSTEM_PROMPT = `You are a WhatsApp marketing copywriter for brand managers.
Turn the brief into ONE WhatsApp promotional message.
Rules:
- Under 600 characters. Short lines, easy to read on a phone.
- First line is the hook. One clear call to action at the end.
- At most two emojis. No ALL CAPS shouting, no fake urgency, no invented discounts, prices, dates or claims that are not in the brief.
- If the brief lacks a detail (link, offer, date), use a clear placeholder in [square brackets].
- End with: Reply STOP to opt out.
- Write in the requested language and tone.
Return only the message text. No preamble, no quotes, no markdown.`;

/**
 * Calls the Gemini API to produce a single WhatsApp promotional message.
 * Throws with a human-readable message on any failure including missing env.
 */
export async function generateMessage({
  prompt,
  brand = "",
  tone = "friendly",
  language = "English",
}: GenerateInput): Promise<string> {
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
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Brand: ${brand || "(not given)"}\nTone: ${tone}\nLanguage: ${language}\nBrief: ${prompt}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 600 },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as any)?.error?.message ?? `Gemini API request failed (${res.status})`
    );
  }

  const parts: { text?: string }[] =
    (data as any)?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(
      "The AI returned an empty message (it may have been blocked by a safety filter)."
    );
  }

  return text;
}

/* ─── Zernio API helpers ─────────────────────────────────────────────────── */

function requireZernioConfig(): void {
  if (!ZERNIO_API_KEY) {
    throw new Error(
      "ZERNIO_API_KEY must be set on the server. Get it from the Zernio dashboard (zernio.com)."
    );
  }
}

function zernioHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    "content-type": "application/json",
  };
}

/**
 * Resolves the Zernio accountId for a given WhatsApp business phone number.
 *
 * Strategy (matching real Zernio API structure):
 *  1. If ZERNIO_ACCOUNT_ID is set → verify it matches the typed number via
 *     GET /v1/whatsapp/phone-numbers (connected array).
 *  2. If ZERNIO_ACCOUNT_ID is not set → search GET /v1/accounts for a
 *     WhatsApp platform entry whose number matches.
 *
 * Returns the resolved accountId and display number on success.
 * Throws with a clear message on mismatch or missing connection.
 */
export async function verifyBusinessNumber(
  businessNumber: string
): Promise<{ accountId: string; number: string; name: string }> {
  requireZernioConfig();

  const typed = normalizeNumbers([businessNumber]).valid[0];
  if (!typed) {
    throw new Error(
      "The business number you entered is not a valid phone number. " +
        "Include the country code, e.g. +14155550100."
    );
  }

  // ── Fetch connected WhatsApp phone numbers from Zernio ────────────────────
  const pnRes = await fetch(`${ZERNIO_BASE}/v1/whatsapp/phone-numbers`, {
    headers: zernioHeaders(),
  });
  const pnData = await pnRes.json();

  if (!pnRes.ok) {
    throw new Error(
      (pnData as any)?.error?.message ??
        (pnData as any)?.message ??
        `Zernio error fetching WhatsApp phone numbers (HTTP ${pnRes.status}).`
    );
  }

  // connected[] = live WhatsApp Business numbers; sandbox = free test number
  const connected: Array<{ phoneNumber: string; accountId: string; displayName?: string }> =
    (pnData as any).connected ?? [];
  const sandbox: { phoneNumber: string; accountId: string } | null =
    (pnData as any).sandbox ?? null;

  // Match against connected live numbers first
  for (const entry of connected) {
    const entryDigits = String(entry.phoneNumber).replace(/\D/g, "");
    if (entryDigits.endsWith(typed.slice(-10))) {
      const resolvedId = ZERNIO_ACCOUNT_ID || entry.accountId;
      return {
        accountId: resolvedId,
        number: entry.phoneNumber,
        name: entry.displayName ?? "",
      };
    }
  }

  // Fall back to sandbox for testing (only if business number matches sandbox)
  if (sandbox) {
    const sandboxDigits = String(sandbox.phoneNumber).replace(/\D/g, "");
    if (sandboxDigits.endsWith(typed.slice(-10))) {
      return {
        accountId: sandbox.accountId,
        number: sandbox.phoneNumber,
        name: "Sandbox",
      };
    }
  }

  // If ZERNIO_ACCOUNT_ID is set, also try GET /v1/accounts for non-WhatsApp
  // native platforms (accounts connected via OAuth)
  if (ZERNIO_ACCOUNT_ID) {
    const accRes = await fetch(`${ZERNIO_BASE}/v1/accounts`, {
      headers: zernioHeaders(),
    });
    const accData = await accRes.json();
    const accounts: Array<{ _id: string; platform: string; username?: string; phoneNumber?: string }> =
      (accData as any).accounts ?? [];

    const waAccount = accounts.find((a) => {
      if (a.platform !== "whatsapp") return false;
      const num = String(a.username ?? a.phoneNumber ?? "").replace(/\D/g, "");
      return num.endsWith(typed.slice(-10));
    });

    if (waAccount) {
      return {
        accountId: ZERNIO_ACCOUNT_ID,
        number: waAccount.username ?? waAccount.phoneNumber ?? typed,
        name: "",
      };
    }
  }

  // Build a helpful error listing connected numbers
  const connectedNums = connected.map((e) => e.phoneNumber).join(", ") || "none";
  const sandboxNum = sandbox ? ` | Sandbox: ${sandbox.phoneNumber}` : "";
  throw new Error(
    `The business number +${typed} is not connected to your Zernio account.\n` +
      `Connected numbers: ${connectedNums}${sandboxNum}.\n` +
      `Connect your WhatsApp Business number in the Zernio dashboard first.`
  );
}

/* ─── Send one message via Zernio ────────────────────────────────────────── */

interface SendOneOpts {
  accountId: string;
  mode: "text" | "template";
  message: string;
  templateName?: string;
  languageCode?: string;
}

function buildPayload(
  to: string,
  { accountId, mode, message, templateName, languageCode }: SendOneOpts
): Record<string, unknown> {
  // POST /v1/inbox/conversations
  // participantId = recipient phone in international format (digits + country code)
  const base = { accountId, participantId: to };

  if (mode === "template") {
    // templateLanguage must be a valid BCP-47/Meta locale code e.g. "en_US", "en", "hi"
    // Zernio looks up the exact APPROVED template definition by name + language.
    // templateParams is a flat array of variable values in order.
    const flat = message
      .replace(/[\r\n\t]+/g, " ")
      .replace(/ {4,}/g, "   ")
      .trim();

    return {
      ...base,
      templateName,
      templateLanguage: languageCode ?? "en",
      templateParams: [flat],
    };
  }

  // Plain text — only works within the 24-hour customer-service window.
  // Zernio returns TEMPLATE_REQUIRED if the window is closed.
  return { ...base, message };
}

async function sendOne(to: string, opts: SendOneOpts): Promise<SendResult> {
  const res = await fetch(`${ZERNIO_BASE}/v1/inbox/conversations`, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify(buildPayload(to, opts)),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      to,
      ok: false,
      error:
        (data as any)?.error?.message ??
        (data as any)?.message ??
        (data as any)?.error ??
        `HTTP ${res.status}`,
    };
  }

  return {
    to,
    ok: true,
    messageId: (data as any)?.data?.id ?? (data as any)?.id ?? (data as any)?._id,
  };
}

/* ─── Bulk send ──────────────────────────────────────────────────────────── */

/**
 * Validates opt-in, verifies the business number against Zernio's connected
 * accounts, normalises the recipient list, then sends via Zernio in small
 * batches for a per-number Sent/Failed result.
 */
export async function sendBulk({
  businessNumber,
  recipients,
  message,
  mode = "text",
  templateName,
  languageCode = "en",
  optInConfirmed = false,
}: SendInput): Promise<BulkSendOutput> {
  // ── Server-side safety checks (not bypassable via UI) ────────────────────
  if (!optInConfirmed) {
    throw new Error(
      "You must confirm that every recipient has opted in to receive WhatsApp " +
        "messages from your business before sending."
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

  const opts: SendOneOpts = { accountId, mode, message, templateName, languageCode };
  const results: SendResult[] = [];

  // Send in batches of 5 with a small pause to avoid rate-limit spikes.
  for (let i = 0; i < valid.length; i += 5) {
    const batch = valid.slice(i, i + 5);
    results.push(...(await Promise.all(batch.map((n) => sendOne(n, opts)))));
    if (i + 5 < valid.length) await sleep(300);
  }

  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    invalidNumbers: invalid,
    results,
  };
}
