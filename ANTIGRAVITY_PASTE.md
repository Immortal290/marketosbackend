# TASK FOR ANTIGRAVITY AGENT: add a WhatsApp campaign feature to my existing project

I have an existing marketing-agent website with a **prompt board / dashboard** where users type a prompt and AI generates marketing content. Add a **WhatsApp section** to it, using the code and instructions below. Do the work directly in my project, end to end. Do not just explain it.

## What the finished feature must do

1. On the dashboard there is a new **WhatsApp** section (tab or page, matching the existing navigation and design of my site).
2. The user types a campaign prompt (plus optional brand name, tone, language) and clicks **Generate message**. The AI agent writes ONE WhatsApp promotional message and shows it in a phone-style preview and in an editable text box.
3. The user enters **their business WhatsApp number** in one box and **one or more customer numbers** in another box (one per line or comma separated). Show a live count of valid and invalid numbers.
4. There is a required checkbox: "Every number above has agreed to receive WhatsApp messages from my business." The **Send** button stays disabled until it is ticked, the message is not empty, the business number is filled and at least one valid customer number exists.
5. Clicking **Send to customers** asks for confirmation, then sends the message to every customer number through the WhatsApp Business Cloud API and shows a per-number Sent/Failed table.
6. A **WhatsApp connector as an MCP server** (`mcp-server`) exposes two tools, `generate_whatsapp_message` and `send_whatsapp_messages`, using the same core code as the dashboard, so a brand manager can also automate the flow from any MCP client.

## Rules you must follow

- **First inspect my project**: language, framework, folder structure, how the frontend and backend are organized, how routes and auth work, how the existing prompt board calls its AI, and how the UI is styled. Then integrate into what already exists.
- **Do not break or rewrite existing features.** Only add files and the minimum edits to existing ones (routes registration, navigation entry, env example).
- The code below is **Node.js (ES modules) + Express + vanilla HTML/JS**. If my project uses that stack, add the files as they are. If it uses something else (Next.js, Python/FastAPI, React, etc.), **port the logic to my stack with identical behavior**: same validation, same request payloads to WhatsApp, same routes, same safety checks. Keep the MCP server as a small Node script if there is no better option.
- If my prompt board already has an AI provider and API key configured, **reuse that provider and key** inside `generateMessage` instead of adding a second one. Otherwise use the Anthropic API as written.
- **All secrets stay server side in environment variables. Never put a key in frontend code or commit it.**
- Put the two API routes **behind my site's existing login/auth**. Anyone who can call them can send messages from my business number.
- Match my site's existing UI components, colors and fonts for the new section instead of using the standalone styling below. Keep the same fields, behavior and states.
- Do not remove the opt-in checkbox, the server-side opt-in check, the recipient cap, or the business-number verification. They are required.
- **Do not send real WhatsApp messages while testing** except to a number I own. Test the generate flow and the validation first.

## Steps

1. Inspect the project and tell me the stack you found and where you will add things.
2. Add `server/core.js` (or the equivalent module in my stack) from **File 1** below.
3. Add the two routes from **File 2** to my existing backend, behind auth. Path names: `POST /api/whatsapp/generate` and `POST /api/whatsapp/send`.
4. Add the MCP connector from **File 3** and an npm script `"mcp": "node server/mcp-server.js"`.
5. Add the WhatsApp section UI from **File 4** into my dashboard as a new tab or page, restyled to match my site.
6. Install dependencies: `express` (only if my project does not already have a server), `dotenv`, `zod`, `@modelcontextprotocol/sdk`.
7. Add the variables from **File 5** to `.env.example` and tell me exactly which values to fill in `.env`.
8. Run the project, fix any errors, and verify with the checklist at the end.
9. Give me a short summary: files added, files edited, env variables to fill, how to run it, how to connect the MCP server.

## Values I will provide in `.env` (do not invent them)

- `ANTHROPIC_API_KEY`: key for the AI that writes the message (or reuse the one my prompt board already uses).
- `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API token (permanent system-user token).
- `WHATSAPP_PHONE_NUMBER_ID`: the ID of my business number from Meta for Developers > WhatsApp > API Setup.

## WhatsApp platform rules the implementation must respect

- The Cloud API sends from a `phone_number_id`, not from a typed number. The server verifies that the business number typed in the box matches the number connected to `WHATSAPP_PHONE_NUMBER_ID` and rejects a mismatch.
- Promotional messages to people who have not messaged the business in the last 24 hours must use an **approved Marketing template** with one body variable `{{1}}` (the generated message goes into it). Plain text mode only works inside the 24-hour window. The UI has a "Sending method" option for this.
- Recipients must have opted in. Numbers need the country code.

---

## File 1: `server/core.js`

````js
import "dotenv/config";

const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-sonnet-5",
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  GRAPH_API_VERSION = "v21.0",
  DEFAULT_COUNTRY_CODE = "",
  MAX_RECIPIENTS = "500",
} = process.env;

const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Numbers ---------- */

export function normalizeNumbers(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(/[\n,;]+/);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  for (const item of raw) {
    const text = String(item).trim();
    if (!text) continue;
    let digits = text.replace(/\D/g, "");
    if (DEFAULT_COUNTRY_CODE && digits.length === 10) digits = DEFAULT_COUNTRY_CODE + digits;
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

/* ---------- AI agent: prompt -> WhatsApp message ---------- */

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

export async function generateMessage({ prompt, brand = "", tone = "friendly", language = "English" }) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  if (!prompt || !prompt.trim()) throw new Error("Prompt is empty.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Brand: ${brand || "(not given)"}\nTone: ${tone}\nLanguage: ${language}\nBrief: ${prompt}`,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `AI request failed (${res.status})`);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

/* ---------- WhatsApp Cloud API ---------- */

function requireWhatsAppConfig() {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set on the server.");
  }
}

// The Cloud API sends from a phone_number_id, not from a typed number.
// This checks the number the user typed is the one connected to that ID.
export async function verifyBusinessNumber(businessNumber) {
  requireWhatsAppConfig();
  const res = await fetch(
    `${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Could not read the WhatsApp business number.");
  const connected = String(data.display_phone_number || "").replace(/\D/g, "");
  const typed = normalizeNumbers([businessNumber]).valid[0];
  if (!typed || !connected.endsWith(typed.slice(-10))) {
    throw new Error(
      `The business number you entered does not match the WhatsApp number connected to this account (${data.display_phone_number}).`
    );
  }
  return { number: data.display_phone_number, name: data.verified_name };
}

function buildPayload(to, { mode, message, templateName, languageCode }) {
  if (mode === "template") {
    // Template body variable {{1}} carries the generated message.
    // Meta rejects newlines, tabs and 4+ consecutive spaces inside a variable.
    const flat = message.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode || "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: flat }] }],
      },
    };
  }
  return { messaging_product: "whatsapp", to, type: "text", text: { body: message, preview_url: true } };
}

async function sendOne(to, opts) {
  const res = await fetch(`${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(buildPayload(to, opts)),
  });
  const data = await res.json();
  if (!res.ok) return { to, ok: false, error: data?.error?.message || `HTTP ${res.status}` };
  return { to, ok: true, messageId: data.messages?.[0]?.id };
}

export async function sendBulk({
  businessNumber,
  recipients,
  message,
  mode = "text",
  templateName,
  languageCode = "en",
  optInConfirmed = false,
}) {
  if (!optInConfirmed) throw new Error("Confirm that every recipient has opted in to receive WhatsApp messages.");
  if (!message || !message.trim()) throw new Error("Message is empty.");
  if (mode === "template" && !templateName) throw new Error("Template name is required in template mode.");

  await verifyBusinessNumber(businessNumber);

  const { valid, invalid } = normalizeNumbers(recipients);
  if (!valid.length) throw new Error("No valid recipient numbers. Use international format, e.g. +14155550123.");
  if (valid.length > Number(MAX_RECIPIENTS)) throw new Error(`Too many recipients (max ${MAX_RECIPIENTS} per send).`);

  const results = [];
  for (let i = 0; i < valid.length; i += 5) {
    const batch = valid.slice(i, i + 5);
    results.push(...(await Promise.all(batch.map((n) => sendOne(n, { mode, message, templateName, languageCode })))));
    if (i + 5 < valid.length) await sleep(300); // gentle pacing
  }
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    invalidNumbers: invalid,
    results,
  };
}

````

## File 2: `server/index.js`

````js
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateMessage, sendBulk } from "./core.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public")));

// NOTE: put these routes behind your site's existing login/auth.
app.post("/api/whatsapp/generate", async (req, res) => {
  try {
    res.json({ message: await generateMessage(req.body) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/whatsapp/send", async (req, res) => {
  try {
    res.json(await sendBulk(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Dashboard on http://localhost:" + (process.env.PORT || 3000)));

````

## File 3: `server/mcp-server.js`

````js
// WhatsApp connector as an MCP server (stdio).
// Lets any MCP client (Claude Desktop, your own agent, etc.) generate and send WhatsApp campaigns.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateMessage, sendBulk } from "./core.js";

const server = new McpServer({ name: "whatsapp-marketing", version: "1.0.0" });
const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e.message }] });

server.tool(
  "generate_whatsapp_message",
  "Write a WhatsApp promotional message from a marketing prompt.",
  {
    prompt: z.string().describe("What the campaign is about: offer, product, audience, link."),
    brand: z.string().optional(),
    tone: z.string().optional().describe("e.g. friendly, premium, playful"),
    language: z.string().optional(),
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
  "Send a WhatsApp message to one or more customers from the connected business number. Only for contacts who opted in.",
  {
    business_number: z.string().describe("The WhatsApp business number connected to this account."),
    recipients: z.array(z.string()).min(1).describe("Customer numbers with country code."),
    message: z.string(),
    mode: z.enum(["text", "template"]).default("text").describe("Use template for customers who have not messaged you in the last 24 hours."),
    template_name: z.string().optional(),
    language_code: z.string().default("en"),
    confirm_opt_in: z.boolean().describe("Must be true: every recipient opted in to receive these messages."),
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
    } catch (e) {
      return fail(e);
    }
  }
);

await server.connect(new StdioServerTransport());

````

## File 4: `public/index.html`

````html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WhatsApp campaigns</title>
<style>
  :root {
    --bg: #eef1f0; --panel: #ffffff; --ink: #14201d; --muted: #5d6b67; --line: #d7dedb;
    --brand: #0f6b52; --brand-ink: #ffffff; --danger: #b3261e;
    --chat-bg: #d8e0d6; --bubble: #e3f7cf;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1614; --panel: #17211e; --ink: #e8efec; --muted: #93a39d; --line: #2a3733;
      --brand: #3fbf93; --brand-ink: #06231a; --danger: #ff8a80; --chat-bg: #1e2b26; --bubble: #1f4a34; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); margin: 0 0 28px; }
  .grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 24px; align-items: start; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
  section.card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 22px; margin-bottom: 20px; }
  h2 { font-size: 1.05rem; margin: 0 0 14px; }
  label { display: block; font-weight: 600; font-size: .9rem; margin: 14px 0 6px; }
  .hint { font-weight: 400; color: var(--muted); }
  input, textarea, select { width: 100%; font: inherit; color: var(--ink); background: transparent; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  textarea { resize: vertical; min-height: 96px; }
  input:focus, textarea:focus, select:focus, button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 8px; padding: 11px 18px; cursor: pointer; background: var(--brand); color: var(--brand-ink); }
  button.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .count { font-size: .85rem; color: var(--muted); margin-top: 6px; }
  .count b.bad { color: var(--danger); }
  .check { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; font-weight: 400; }
  .check input { width: auto; margin-top: 5px; }
  .preview { position: sticky; top: 20px; }
  .phone { background: var(--chat-bg); border-radius: 14px; padding: 18px; min-height: 220px; border: 1px solid var(--line); }
  .bubble { background: var(--bubble); color: var(--ink); border-radius: 12px 12px 2px 12px; padding: 10px 12px; margin-left: auto; max-width: 92%; white-space: pre-wrap; overflow-wrap: anywhere; box-shadow: 0 1px 1px rgba(0,0,0,.12); }
  .empty { color: var(--muted); text-align: center; margin-top: 60px; }
  .meta { font-size: .78rem; color: var(--muted); text-align: right; margin-top: 4px; }
  #status { margin-top: 14px; font-size: .92rem; }
  #status.err { color: var(--danger); }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; margin-top: 10px; }
  th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); }
  .ok { color: var(--brand); font-weight: 600; } .no { color: var(--danger); font-weight: 600; }
  details { margin-top: 16px; } summary { cursor: pointer; font-weight: 600; font-size: .9rem; }
  @media (prefers-reduced-motion: no-preference) { button { transition: opacity .15s; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>WhatsApp campaigns</h1>
  <p class="sub">Describe the campaign, review the message, then send it to your customers.</p>

  <div class="grid">
    <div>
      <section class="card">
        <h2>Campaign prompt</h2>
        <label for="prompt">What should the message promote?</label>
        <textarea id="prompt" placeholder="Diwali sale on handmade candles, 20% off till Sunday, link to shop.example.com"></textarea>
        <div class="row">
          <div><label for="brand">Brand name</label><input id="brand" placeholder="Glow &amp; Co"></div>
          <div><label for="tone">Tone</label>
            <select id="tone"><option>Friendly</option><option>Premium</option><option>Playful</option><option>Urgent but honest</option><option>Formal</option></select>
          </div>
        </div>
        <label for="lang">Language</label>
        <input id="lang" value="English">
        <div class="actions"><button id="gen">Generate message</button></div>
      </section>

      <section class="card">
        <h2>Audience</h2>
        <label for="biz">Your business WhatsApp number <span class="hint">with country code</span></label>
        <input id="biz" inputmode="tel" placeholder="+91 98765 43210">
        <label for="to">Customer numbers <span class="hint">one per line or comma separated</span></label>
        <textarea id="to" placeholder="+91 91234 56789&#10;+91 99887 76655"></textarea>
        <div class="count" id="count">No numbers yet</div>

        <details>
          <summary>Sending method</summary>
          <label for="mode">Message type</label>
          <select id="mode">
            <option value="text">Regular message (customers who wrote to you in the last 24 hours)</option>
            <option value="template">Approved template (customers you are starting a conversation with)</option>
          </select>
          <div class="row" id="tplRow" hidden>
            <div><label for="tpl">Template name</label><input id="tpl" placeholder="promo_offer"></div>
            <div><label for="tplLang">Template language code</label><input id="tplLang" value="en"></div>
          </div>
        </details>

        <label class="check"><input type="checkbox" id="optin"> <span>Every number above has agreed to receive WhatsApp messages from my business.</span></label>
        <div class="actions"><button id="send" disabled>Send to customers</button></div>
        <div id="status" role="status"></div>
        <div id="results"></div>
      </section>
    </div>

    <aside class="preview">
      <section class="card">
        <h2>Message preview</h2>
        <div class="phone">
          <div class="empty" id="empty">The generated message will appear here.</div>
          <div class="bubble" id="bubble" hidden></div>
          <div class="meta" id="chars" hidden></div>
        </div>
        <label for="msg">Edit before sending</label>
        <textarea id="msg" rows="6" placeholder="Generate a message, or write your own."></textarea>
      </section>
    </aside>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);

function parseNumbers(text) {
  const seen = new Set(), valid = [], bad = [];
  text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
    const d = s.replace(/\D/g, "");
    if (d.length < 8 || d.length > 15) return bad.push(s);
    if (!seen.has(d)) { seen.add(d); valid.push(d); }
  });
  return { valid, bad };
}

function refresh() {
  const { valid, bad } = parseNumbers($("to").value);
  $("count").innerHTML = valid.length || bad.length
    ? `${valid.length} valid number${valid.length === 1 ? "" : "s"}` + (bad.length ? ` · <b class="bad">${bad.length} look wrong</b>` : "")
    : "No numbers yet";
  const msg = $("msg").value;
  $("bubble").hidden = $("chars").hidden = !msg;
  $("empty").hidden = !!msg;
  $("bubble").textContent = msg;
  $("chars").textContent = msg.length + " characters";
  $("tplRow").hidden = $("mode").value !== "template";
  $("send").disabled = !(valid.length && msg.trim() && $("biz").value.trim() && $("optin").checked);
}
["to", "msg", "biz", "optin", "mode"].forEach((id) => $(id).addEventListener("input", refresh));

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function say(text, isErr) { $("status").textContent = text; $("status").className = isErr ? "err" : ""; }

$("gen").onclick = async () => {
  $("gen").disabled = true; say("Writing your message…");
  try {
    const { message } = await post("/api/whatsapp/generate", {
      prompt: $("prompt").value, brand: $("brand").value, tone: $("tone").value, language: $("lang").value,
    });
    $("msg").value = message; say("");
  } catch (e) { say(e.message, true); }
  $("gen").disabled = false; refresh();
};

$("send").onclick = async () => {
  const n = parseNumbers($("to").value).valid.length;
  if (!confirm(`Send this message to ${n} customer${n === 1 ? "" : "s"}?`)) return;
  $("send").disabled = true; say("Sending…"); $("results").innerHTML = "";
  try {
    const out = await post("/api/whatsapp/send", {
      businessNumber: $("biz").value, recipients: $("to").value, message: $("msg").value,
      mode: $("mode").value, templateName: $("tpl").value, languageCode: $("tplLang").value,
      optInConfirmed: $("optin").checked,
    });
    say(`${out.sent} sent, ${out.failed} failed.`, out.failed > 0);
    $("results").innerHTML = "<table><tr><th>Number</th><th>Status</th></tr>" + out.results.map((r) =>
      `<tr><td>+${r.to}</td><td>${r.ok ? '<span class="ok">Sent</span>' : '<span class="no">Failed</span> ' + (r.error || "").replace(/</g, "&lt;")}</td></tr>`).join("") + "</table>";
  } catch (e) { say(e.message, true); }
  refresh();
};
refresh();
</script>
</body>
</html>

````

## File 5: `.env.example` additions

````bash
# --- AI agent (generates the WhatsApp message from the prompt) ---
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-5

# --- WhatsApp Business Cloud API (Meta) ---
# From Meta for Developers > your app > WhatsApp > API Setup
WHATSAPP_ACCESS_TOKEN=your-permanent-system-user-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
GRAPH_API_VERSION=v21.0

# Optional: prefix added to 10-digit numbers typed without a country code (e.g. 91)
DEFAULT_COUNTRY_CODE=

# Safety cap per send
MAX_RECIPIENTS=500
PORT=3000

````

## File 6: `package.json` (dependencies and scripts to add or merge)

````json
{
  "name": "whatsapp-marketing-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "mcp": "node server/mcp-server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "engines": { "node": ">=18" }
}

````

## MCP connector config (for Claude Desktop or any MCP client)

````json
{
  "mcpServers": {
    "whatsapp-marketing": {
      "command": "node",
      "args": ["/absolute/path/to/project/server/mcp-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "...",
        "WHATSAPP_ACCESS_TOKEN": "...",
        "WHATSAPP_PHONE_NUMBER_ID": "..."
      }
    }
  }
}
````

## Acceptance checklist (verify each one before you say you are done)

- [ ] The WhatsApp section appears in my dashboard navigation and matches my site's look.
- [ ] Entering a prompt and clicking Generate returns a message under about 600 characters that ends with "Reply STOP to opt out."
- [ ] Customer numbers are parsed from lines and commas, deduplicated, and invalid ones are flagged live.
- [ ] Send is disabled until: message present, business number present, at least one valid number, opt-in ticked.
- [ ] The send route rejects the request on the server if opt-in is not confirmed, even if the UI is bypassed.
- [ ] A business number that does not match the connected WhatsApp number is rejected with a clear error.
- [ ] Missing env variables produce a clear error message, not a crash.
- [ ] The routes require my site's login.
- [ ] `npm run mcp` starts the MCP server and lists both tools.
- [ ] No API key appears anywhere in frontend code or in git.
- [ ] Existing features (prompt board and other content generation) still work exactly as before.
