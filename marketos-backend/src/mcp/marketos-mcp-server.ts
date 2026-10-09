/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           MarketOS — Master MCP Server (stdio transport)        ║
 * ║                                                                  ║
 * ║  47 tools · 15 sections · Groq llama-3.3-70b-versatile         ║
 * ║  Manages ALL API keys, LLM providers, backend routes, channels  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Start:  npm run mcp:master
 * Or:     npx tsx src/mcp/marketos-mcp-server.ts
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";

// ─── Environment ─────────────────────────────────────────────────────────────
const GROQ_API_KEY   = process.env.GROQ_API_KEY   ?? "";
const BACKEND_URL    = process.env.BACKEND_URL    ?? "http://localhost:3001";
const AGENT_URL      = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";
const GEMINI_KEY     = process.env.GEMINI_API_KEY  ?? "";
const ZERNIO_KEY     = process.env.ZERNIO_API_KEY  ?? "";
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY ?? "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";
const NVIDIA_KEY     = process.env.NVIDIA_API_KEY  ?? "";
const SENDGRID_KEY   = process.env.SENDGRID_API_KEY ?? "";
const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN  ?? "";

// ─── Core helpers ─────────────────────────────────────────────────────────────
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (obj: unknown) => text(JSON.stringify(obj, null, 2));

async function backendFetch(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  token?: string
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`Backend ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function agentFetch(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`Agent ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function groqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model = "llama-3.3-70b-versatile",
  temperature = 0.7,
  maxTokens = 2048
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { choices: { message: { content: string } }[] };
  return d.choices[0]?.message?.content ?? "";
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({ name: "marketos-master", version: "2.0.0" });

// ════════════════════════════════════════════════════════
// 🔑  SECTION 1 — API KEY MANAGEMENT
// ════════════════════════════════════════════════════════

server.tool(
  "list_api_keys",
  "Return a masked summary of all configured API keys and service URLs.",
  {},
  async () =>
    json({
      GROQ_API_KEY:   GROQ_API_KEY   ? `gsk_...${GROQ_API_KEY.slice(-4)}   ✅` : "❌ NOT SET",
      GEMINI_KEY:     GEMINI_KEY     ? `...${GEMINI_KEY.slice(-4)}          ✅` : "❌ NOT SET",
      ANTHROPIC_KEY:  ANTHROPIC_KEY  ? `...${ANTHROPIC_KEY.slice(-4)}       ✅` : "❌ NOT SET",
      OPENROUTER_KEY: OPENROUTER_KEY ? `...${OPENROUTER_KEY.slice(-4)}      ✅` : "❌ NOT SET",
      NVIDIA_KEY:     NVIDIA_KEY     ? `...${NVIDIA_KEY.slice(-4)}          ✅` : "❌ NOT SET",
      ZERNIO_KEY:     ZERNIO_KEY     ? `...${ZERNIO_KEY.slice(-4)}          ✅` : "❌ NOT SET",
      SENDGRID_KEY:   SENDGRID_KEY   ? `...${SENDGRID_KEY.slice(-4)}        ✅` : "❌ NOT SET",
      TWILIO_SID:     TWILIO_SID     ? `...${TWILIO_SID.slice(-4)}          ✅` : "❌ NOT SET",
      BACKEND_URL,
      AGENT_URL,
    })
);

server.tool(
  "validate_groq_key",
  "Ping Groq API to confirm the key is valid and list available models.",
  { api_key: z.string().optional().describe("Override key for this call only.") },
  async ({ api_key }) => {
    const key = api_key ?? GROQ_API_KEY;
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Groq validation failed: ${res.status} ${await res.text()}`);
    const d = (await res.json()) as { data: { id: string }[] };
    return text(`✅ Groq key valid. Models: ${d.data.map((m) => m.id).join(", ")}`);
  }
);

server.tool(
  "save_api_keys_to_backend",
  "Persist one or more API keys into the MarketOS database so all agents pick them up.",
  {
    groq_api_key:       z.string().optional(),
    gemini_api_key:     z.string().optional(),
    anthropic_api_key:  z.string().optional(),
    openrouter_api_key: z.string().optional(),
    nvidia_api_key:     z.string().optional(),
    sendgrid_api_key:   z.string().optional(),
    twilio_account_sid: z.string().optional(),
    twilio_auth_token:  z.string().optional(),
    zernio_api_key:     z.string().optional(),
    zernio_account_id:  z.string().optional(),
    auth_token:         z.string().optional(),
  },
  async (args) => {
    const { auth_token, ...keys } = args;
    const filtered = Object.fromEntries(
      Object.entries(keys).filter(([, v]) => v !== undefined && v !== "")
    );
    return json(await backendFetch("/settings/api-keys", "PATCH", filtered, auth_token));
  }
);

server.tool(
  "get_api_keys_from_backend",
  "Fetch the API keys stored in the MarketOS database.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) =>
    json(await backendFetch("/settings/api-keys", "GET", undefined, auth_token))
);

// ════════════════════════════════════════════════════════
// 🤖  SECTION 2 — GROQ LLM TOOLS
// ════════════════════════════════════════════════════════

server.tool(
  "groq_chat",
  "Run a Groq Llama-3 chat completion for any task: copy, analysis, translation, etc.",
  {
    system:       z.string().optional().describe("System prompt / persona."),
    user_message: z.string().describe("Task to complete."),
    model: z
      .enum(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"])
      .default("llama-3.3-70b-versatile"),
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens:  z.number().min(64).max(32768).default(2048),
  },
  async ({ system, user_message, model, temperature, max_tokens }) => {
    const msgs: { role: "system" | "user"; content: string }[] = [];
    if (system) msgs.push({ role: "system", content: system });
    msgs.push({ role: "user", content: user_message });
    return text(await groqChat(msgs, model, temperature, max_tokens));
  }
);

server.tool(
  "groq_generate_marketing_copy",
  "Generate channel-optimized marketing copy using Groq Llama-3.3-70B.",
  {
    channel: z.enum(["email", "sms", "whatsapp", "social", "landing_page", "ad"]),
    product_or_offer: z.string(),
    target_audience:  z.string(),
    tone: z.enum(["professional", "friendly", "urgent", "playful", "luxury", "bold"]).default("professional"),
    brand_name:    z.string().optional(),
    cta:           z.string().optional(),
    key_benefits:  z.array(z.string()).optional(),
    word_limit:    z.number().default(150),
    language:      z.string().default("English"),
  },
  async (args) => {
    const charNote =
      args.channel === "sms"       ? "CRITICAL: Under 160 chars with STOP opt-out." :
      args.channel === "whatsapp"  ? "CRITICAL: Under 600 chars with opt-out line." : "";
    const reply = await groqChat(
      [
        { role: "system", content: `Expert ${args.channel} marketing copywriter. Write conversion-focused copy only. No commentary.` },
        { role: "user",   content: `${args.channel} copy for: ${args.product_or_offer}\nAudience: ${args.target_audience}\nTone: ${args.tone}\nBrand: ${args.brand_name ?? "N/A"}\nCTA: ${args.cta ?? "Shop Now"}\nBenefits: ${args.key_benefits?.join(", ") ?? "N/A"}\nMax words: ${args.word_limit}\nLanguage: ${args.language}\n${charNote}` },
      ],
      "llama-3.3-70b-versatile", 0.8, 1024
    );
    return text(reply);
  }
);

server.tool(
  "groq_analyze_campaign",
  "Feed campaign metrics to Groq and get structured AI analysis with recommendations.",
  {
    campaign_name:  z.string(),
    metrics:        z.record(z.union([z.string(), z.number()])),
    goals:          z.string().optional(),
    budget_spent:   z.number().optional(),
    channels:       z.array(z.string()).optional(),
  },
  async ({ campaign_name, metrics, goals, budget_spent, channels }) => {
    const reply = await groqChat(
      [
        { role: "system", content: "Senior digital marketing analyst. Provide structured, data-driven insights." },
        { role: "user",   content: `Analyze: ${campaign_name}\nGoals: ${goals ?? "N/A"}\nBudget: ${budget_spent ? `$${budget_spent}` : "N/A"}\nChannels: ${channels?.join(", ") ?? "N/A"}\nMetrics:\n${JSON.stringify(metrics, null, 2)}` },
      ],
      "llama-3.3-70b-versatile", 0.4, 2048
    );
    return text(reply);
  }
);

server.tool(
  "groq_list_models",
  "List all Groq models available under the configured API key.",
  {},
  async () => {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Models fetch failed: ${res.status}`);
    const d = (await res.json()) as { data: { id: string; owned_by: string }[] };
    return json(d.data.map((m) => ({ id: m.id, owner: m.owned_by })));
  }
);

// ════════════════════════════════════════════════════════
// 🧠  SECTION 3 — AGENT PIPELINE
// ════════════════════════════════════════════════════════

server.tool("list_agents", "List all 21 MarketOS AI agents with metadata.", {},
  async () => json(await agentFetch("/v1/agents"))
);

server.tool(
  "run_agent",
  "Run a single MarketOS agent by name.",
  {
    agent_name:       z.string().describe("e.g. copy, analytics, sms, email, social, voice, competitor, seo, finance, compliance, ab_test, lead_scoring, creative, monitor, reporting"),
    input:            z.record(z.unknown()),
    llm_provider:     z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    llm_model:        z.string().optional(),
    api_key_override: z.string().optional(),
  },
  async ({ agent_name, input, llm_provider, llm_model, api_key_override }) =>
    json(await agentFetch(`/v1/agents/${agent_name}/run`, "POST", {
      input,
      llm_provider,
      ...(llm_model ? { llm_model } : {}),
      api_key_override: api_key_override ?? GROQ_API_KEY,
    }))
);

server.tool(
  "run_campaign_pipeline",
  "Execute the full 21-agent MarketOS campaign pipeline synchronously.",
  {
    campaign_name:    z.string(),
    goal:             z.string(),
    target_audience:  z.string(),
    channels:         z.array(z.enum(["email", "sms", "whatsapp", "social", "voice"])).default(["email", "sms"]),
    budget:           z.number(),
    timeline:         z.string(),
    tone:             z.enum(["bold", "professional", "friendly", "playful", "luxury", "urgent"]).default("professional"),
    key_messages:     z.array(z.string()).optional(),
    brand_name:       z.string().optional(),
    llm_provider:     z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    api_key_override: z.string().optional(),
  },
  async ({ llm_provider, api_key_override, ...rest }) =>
    json(await agentFetch("/v1/pipeline/campaign", "POST", {
      ...rest,
      llm_provider,
      api_key_override: api_key_override ?? GROQ_API_KEY,
    }))
);

server.tool(
  "run_campaign_pipeline_async",
  "Start the full pipeline asynchronously (Kafka-backed). Returns campaign_id for polling.",
  {
    campaign_name:    z.string(),
    goal:             z.string(),
    target_audience:  z.string(),
    channels:         z.array(z.enum(["email", "sms", "whatsapp", "social", "voice"])).default(["email", "sms"]),
    budget:           z.number(),
    timeline:         z.string(),
    tone:             z.enum(["bold", "professional", "friendly", "playful", "luxury", "urgent"]).default("professional"),
    llm_provider:     z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    api_key_override: z.string().optional(),
  },
  async ({ llm_provider, api_key_override, ...rest }) =>
    json(await agentFetch("/v1/pipeline/campaign/async", "POST", {
      ...rest,
      llm_provider,
      api_key_override: api_key_override ?? GROQ_API_KEY,
    }))
);

server.tool("get_pipeline_status", "Poll the status of an async campaign pipeline run.",
  { campaign_id: z.string() },
  async ({ campaign_id }) => json(await agentFetch(`/v1/pipeline/${campaign_id}/status`))
);

server.tool("agent_health_check", "Check if the Python agent service is reachable.", {},
  async () => json(await agentFetch("/v1/health"))
);

// ════════════════════════════════════════════════════════
// 📢  SECTION 4 — WHATSAPP CHANNEL
// ════════════════════════════════════════════════════════

server.tool(
  "generate_whatsapp_message",
  "Write a WhatsApp promotional message using Groq (≤600 chars with opt-out).",
  {
    prompt:   z.string(),
    brand:    z.string().optional(),
    tone:     z.enum(["friendly", "premium", "playful", "urgent", "formal"]).default("friendly"),
    language: z.string().default("English"),
  },
  async ({ prompt, brand, tone, language }) =>
    text(await groqChat(
      [
        { role: "system", content: "Expert WhatsApp marketing writer. Messages under 600 chars, always end with opt-out. No markdown." },
        { role: "user",   content: `Write ${tone} WhatsApp message in ${language}.\nBrand: ${brand ?? "N/A"}\nBrief: ${prompt}` },
      ],
      "llama-3.3-70b-versatile", 0.8, 512
    ))
);

server.tool(
  "send_whatsapp_campaign",
  "Send a WhatsApp campaign to opted-in recipients via the MarketOS backend (Zernio).",
  {
    recipients:      z.array(z.string()).min(1),
    message:         z.string(),
    from_number:     z.string().optional(),
    confirm_opt_in:  z.boolean().describe("Must be true — confirms opt-in compliance."),
    auth_token:      z.string().optional(),
  },
  async ({ recipients, message, from_number, confirm_opt_in, auth_token }) => {
    if (!confirm_opt_in) throw new Error("confirm_opt_in must be true — opt-in compliance required.");
    return json(await backendFetch("/whatsapp/send", "POST", { recipients, message, from_number }, auth_token));
  }
);

// ════════════════════════════════════════════════════════
// 📧  SECTION 5 — EMAIL CHANNEL
// ════════════════════════════════════════════════════════

server.tool(
  "generate_email_campaign",
  "Generate a full HTML email campaign (subject, preview, body, CTA) using Groq.",
  {
    product_or_offer: z.string(),
    target_audience:  z.string(),
    tone:             z.enum(["professional", "friendly", "urgent", "playful", "luxury"]).default("professional"),
    brand_name:       z.string().optional(),
    cta_text:         z.string().default("Shop Now"),
    cta_url:          z.string().default("https://example.com"),
    key_benefits:     z.array(z.string()).optional(),
    variants:         z.number().min(1).max(3).default(1),
  },
  async (args) =>
    text(await groqChat(
      [
        { role: "system", content: 'Expert email marketer. Return JSON: {variants:[{variant_id,subject_line,preview_text,body_html,body_text,cta_text,cta_url,estimated_open_rate,estimated_ctr}]}' },
        { role: "user",   content: `Create ${args.variants} email variant(s):\n- Product: ${args.product_or_offer}\n- Audience: ${args.target_audience}\n- Tone: ${args.tone}\n- Brand: ${args.brand_name ?? "N/A"}\n- CTA: ${args.cta_text} -> ${args.cta_url}\n- Benefits: ${args.key_benefits?.join(", ") ?? "N/A"}\nReturn ONLY valid JSON.` },
      ],
      "llama-3.3-70b-versatile", 0.7, 4096
    ))
);

server.tool(
  "send_email_campaign",
  "Trigger a bulk email send via the MarketOS email channel backend.",
  {
    recipients:  z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1),
    subject:     z.string(),
    html_body:   z.string(),
    text_body:   z.string().optional(),
    from_email:  z.string().email().optional(),
    from_name:   z.string().optional(),
    auth_token:  z.string().optional(),
  },
  async ({ recipients, subject, html_body, text_body, from_email, from_name, auth_token }) =>
    json(await backendFetch("/email-channel/send", "POST", { recipients, subject, html_body, text_body, from_email, from_name }, auth_token))
);

server.tool(
  "get_email_analytics",
  "Fetch email channel delivery and engagement analytics.",
  { campaign_id: z.string().optional(), auth_token: z.string().optional() },
  async ({ campaign_id, auth_token }) =>
    json(await backendFetch(campaign_id ? `/email-channel/analytics/${campaign_id}` : "/email-channel/analytics", "GET", undefined, auth_token))
);

// ════════════════════════════════════════════════════════
// 💬  SECTION 6 — SMS CHANNEL
// ════════════════════════════════════════════════════════

server.tool(
  "generate_sms_campaign",
  "Generate 1–3 SMS variants (≤160 chars) using Groq with opt-out lines.",
  {
    product_or_offer: z.string(),
    target_audience:  z.string(),
    tone:             z.enum(["professional", "friendly", "urgent", "playful"]).default("urgent"),
    brand_name:       z.string().optional(),
    cta_url:          z.string().optional(),
    variants:         z.number().min(1).max(3).default(2),
  },
  async (args) =>
    text(await groqChat(
      [
        { role: "system", content: 'SMS marketing expert. Messages under 160 chars with opt-out. Return JSON: {variants:[{variant_id,message,char_count,estimated_ctr,angle}]}' },
        { role: "user",   content: `Create ${args.variants} SMS variants:\n- Product: ${args.product_or_offer}\n- Audience: ${args.target_audience}\n- Tone: ${args.tone}\n- Brand: ${args.brand_name ?? "N/A"}\n- URL: ${args.cta_url ?? "N/A"}\nReturn ONLY valid JSON.` },
      ],
      "llama-3.3-70b-versatile", 0.8, 1024
    ))
);

server.tool(
  "send_sms_campaign",
  "Send an SMS blast to opted-in recipients via the MarketOS SMS backend (Twilio).",
  {
    recipients:      z.array(z.string()).min(1),
    message:         z.string().max(160),
    confirm_opt_in:  z.boolean(),
    auth_token:      z.string().optional(),
  },
  async ({ recipients, message, confirm_opt_in, auth_token }) => {
    if (!confirm_opt_in) throw new Error("confirm_opt_in must be true for TCPA/CTIA compliance.");
    return json(await backendFetch("/sms/send", "POST", { recipients, message }, auth_token));
  }
);

// ════════════════════════════════════════════════════════
// 📊  SECTION 7 — DASHBOARD & ANALYTICS
// ════════════════════════════════════════════════════════

server.tool(
  "get_dashboard_metrics",
  "Fetch live dashboard KPIs: revenue, CAC, ROAS, active campaigns.",
  {
    period:     z.enum(["7d", "30d", "90d", "ytd"]).default("30d"),
    auth_token: z.string().optional(),
  },
  async ({ period, auth_token }) =>
    json(await backendFetch(`/dashboard?period=${period}`, "GET", undefined, auth_token))
);

server.tool(
  "get_analytics",
  "Pull detailed analytics for campaigns, channels, or audience segments.",
  {
    type:       z.enum(["overview", "campaigns", "channels", "audience", "funnel"]).default("overview"),
    start_date: z.string().optional(),
    end_date:   z.string().optional(),
    auth_token: z.string().optional(),
  },
  async ({ type, start_date, end_date, auth_token }) => {
    const params = new URLSearchParams();
    if (start_date) params.set("start", start_date);
    if (end_date)   params.set("end", end_date);
    const qs = params.toString() ? `?${params}` : "";
    return json(await backendFetch(`/analytics/${type}${qs}`, "GET", undefined, auth_token));
  }
);

server.tool(
  "get_reports",
  "Fetch generated campaign or audience reports.",
  {
    report_type: z.enum(["campaign", "audience", "finance", "monitoring"]).default("campaign"),
    auth_token:  z.string().optional(),
  },
  async ({ report_type, auth_token }) =>
    json(await backendFetch(`/reports/${report_type}`, "GET", undefined, auth_token))
);

// ════════════════════════════════════════════════════════
// 🎯  SECTION 8 — CAMPAIGN MANAGEMENT
// ════════════════════════════════════════════════════════

server.tool(
  "list_campaigns",
  "List all campaigns with status, budget, and performance summary.",
  {
    status:     z.enum(["all", "active", "draft", "paused", "completed"]).default("all"),
    limit:      z.number().default(20),
    auth_token: z.string().optional(),
  },
  async ({ status, limit, auth_token }) =>
    json(await backendFetch(`/campaigns?status=${status}&limit=${limit}`, "GET", undefined, auth_token))
);

server.tool(
  "create_campaign",
  "Create a new campaign in the MarketOS backend.",
  {
    name:             z.string(),
    goal:             z.string(),
    target_audience:  z.string(),
    channels:         z.array(z.enum(["email", "sms", "whatsapp", "social", "voice"])),
    budget:           z.number(),
    start_date:       z.string(),
    end_date:         z.string().optional(),
    tone:             z.string().default("professional"),
    key_messages:     z.array(z.string()).optional(),
    auth_token:       z.string().optional(),
  },
  async ({ auth_token, ...data }) =>
    json(await backendFetch("/campaigns", "POST", data, auth_token))
);

server.tool(
  "get_campaign_detail",
  "Get full details of a campaign including agent outputs.",
  { campaign_id: z.string(), auth_token: z.string().optional() },
  async ({ campaign_id, auth_token }) =>
    json(await backendFetch(`/campaign-detail/${campaign_id}`, "GET", undefined, auth_token))
);

server.tool(
  "update_campaign",
  "Update campaign fields like status, budget, or dates.",
  {
    campaign_id: z.string(),
    updates:     z.record(z.unknown()),
    auth_token:  z.string().optional(),
  },
  async ({ campaign_id, updates, auth_token }) =>
    json(await backendFetch(`/campaigns/${campaign_id}`, "PATCH", updates, auth_token))
);

server.tool(
  "create_campaign_brief",
  "Submit a natural-language campaign brief to the AI pipeline.",
  {
    brief:        z.string(),
    workspace_id: z.string().optional(),
    auth_token:   z.string().optional(),
  },
  async ({ brief, workspace_id, auth_token }) =>
    json(await backendFetch("/campaign/brief", "POST", { brief, workspace_id }, auth_token))
);

// ════════════════════════════════════════════════════════
// 👥  SECTION 9 — AUDIENCE MANAGEMENT
// ════════════════════════════════════════════════════════

server.tool("get_audience_segments", "List all audience segments.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) =>
    json(await backendFetch("/audience", "GET", undefined, auth_token))
);

server.tool(
  "create_audience_segment",
  "Create a new audience segment with targeting filters.",
  {
    name:        z.string(),
    description: z.string().optional(),
    filters:     z.record(z.unknown()),
    auth_token:  z.string().optional(),
  },
  async ({ auth_token, ...data }) =>
    json(await backendFetch("/audience", "POST", data, auth_token))
);

// ════════════════════════════════════════════════════════
// ⚙️   SECTION 10 — SETTINGS & INTEGRATIONS
// ════════════════════════════════════════════════════════

server.tool("get_workspace_settings", "Retrieve current workspace configuration.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/workspace", "GET", undefined, auth_token))
);

server.tool(
  "update_workspace_settings",
  "Update workspace name, timezone, brand color, and feature flags.",
  { settings: z.record(z.unknown()), auth_token: z.string().optional() },
  async ({ settings, auth_token }) =>
    json(await backendFetch("/settings/workspace", "PATCH", settings, auth_token))
);

server.tool("list_integrations", "List all external integrations and connection status.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/integrations", "GET", undefined, auth_token))
);

server.tool(
  "toggle_integration",
  "Connect or disconnect a third-party integration.",
  {
    integration_id: z.string(),
    connected:      z.boolean(),
    auth_token:     z.string().optional(),
  },
  async ({ integration_id, connected, auth_token }) =>
    json(await backendFetch(`/settings/integrations/${integration_id}`, "PATCH", { connected }, auth_token))
);

server.tool("get_billing", "Retrieve billing plan, seat usage, and token consumption.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/billing", "GET", undefined, auth_token))
);

server.tool("get_security_settings", "Retrieve MFA, SSO, and session policies.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/security", "GET", undefined, auth_token))
);

server.tool("get_compliance_settings", "Retrieve GDPR, CAN-SPAM, and compliance controls.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/compliance", "GET", undefined, auth_token))
);

// ════════════════════════════════════════════════════════
// 🔒  SECTION 11 — AUTH
// ════════════════════════════════════════════════════════

server.tool(
  "login",
  "Authenticate a MarketOS user and receive a JWT access token.",
  { email: z.string().email(), password: z.string() },
  async ({ email, password }) =>
    json(await backendFetch("/auth/login", "POST", { email, password }))
);

server.tool(
  "register",
  "Register a new MarketOS user account.",
  {
    name:           z.string(),
    email:          z.string().email(),
    password:       z.string().min(8),
    workspace_name: z.string().optional(),
  },
  async (data) => json(await backendFetch("/auth/register", "POST", data))
);

server.tool(
  "refresh_token",
  "Exchange a refresh token for a new JWT access token.",
  { refresh_token: z.string() },
  async ({ refresh_token }) =>
    json(await backendFetch("/auth/refresh", "POST", { refresh_token }))
);

// ════════════════════════════════════════════════════════
// 🖼️  SECTION 12 — CREATIVE STUDIO & COMPETITIVE INTEL
// ════════════════════════════════════════════════════════

server.tool(
  "generate_creative_brief",
  "Generate a comprehensive creative brief using Groq.",
  {
    campaign_goal:   z.string(),
    brand_name:      z.string(),
    target_audience: z.string(),
    channels:        z.array(z.string()),
    budget:          z.number().optional(),
    timeline:        z.string().optional(),
    tone:            z.string().default("professional"),
    competitors:     z.array(z.string()).optional(),
  },
  async (args) =>
    text(await groqChat(
      [
        { role: "system", content: "You are a creative director. Generate detailed, actionable creative briefs." },
        { role: "user",   content: `Creative Brief:\n- Brand: ${args.brand_name}\n- Goal: ${args.campaign_goal}\n- Audience: ${args.target_audience}\n- Channels: ${args.channels.join(", ")}\n- Budget: ${args.budget ? `$${args.budget}` : "TBD"}\n- Timeline: ${args.timeline ?? "TBD"}\n- Tone: ${args.tone}\n- Competitors: ${args.competitors?.join(", ") ?? "N/A"}\n\nInclude: Executive Summary, Brand Voice, Visual Direction, Channel Strategy, KPIs, Do's & Don'ts.` },
      ],
      "llama-3.3-70b-versatile", 0.7, 3000
    ))
);

server.tool(
  "competitor_analysis",
  "Run a competitive intelligence report using Groq.",
  {
    brand_name:  z.string(),
    industry:    z.string(),
    competitors: z.array(z.string()).optional(),
    focus:       z.enum(["pricing", "messaging", "social_presence", "content", "full"]).default("full"),
  },
  async ({ brand_name, industry, competitors, focus }) =>
    text(await groqChat(
      [
        { role: "system", content: "Competitive intelligence analyst. Provide structured analysis with counter-strategies." },
        { role: "user",   content: `Competitive Analysis:\n- Brand: ${brand_name}\n- Industry: ${industry}\n- Competitors: ${competitors?.join(", ") ?? "Identify top 3-5 from industry"}\n- Focus: ${focus}\n\nProvide: Competitor profiles, Threat assessment (Low/Medium/High), Market gaps, Counter-strategy for ${brand_name}, Quick wins (30 days).` },
      ],
      "llama-3.3-70b-versatile", 0.5, 3000
    ))
);

// ════════════════════════════════════════════════════════
// 🔄  SECTION 13 — WORKFLOW ENGINE & MONITORING
// ════════════════════════════════════════════════════════

server.tool("list_workflows", "List all automation workflows.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/workflow-engine", "GET", undefined, auth_token))
);

server.tool("get_monitoring_status", "Get system monitoring health — agent performance, API latency, error rates.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/monitoring", "GET", undefined, auth_token))
);

server.tool(
  "get_audit_logs",
  "Retrieve immutable audit logs for all administrative actions.",
  { limit: z.number().default(50), auth_token: z.string().optional() },
  async ({ limit, auth_token }) =>
    json(await backendFetch(`/audit-logs?limit=${limit}`, "GET", undefined, auth_token))
);

// ════════════════════════════════════════════════════════
// 🏷️  SECTION 14 — BRAND PROFILE
// ════════════════════════════════════════════════════════

server.tool("get_brand_profile", "Retrieve brand profile: voice, colors, logos, positioning.",
  { auth_token: z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/brand-profile", "GET", undefined, auth_token))
);

server.tool(
  "update_brand_profile",
  "Update brand profile with new guidelines, colors, or voice specs.",
  { updates: z.record(z.unknown()), auth_token: z.string().optional() },
  async ({ updates, auth_token }) =>
    json(await backendFetch("/brand-profile", "PATCH", updates, auth_token))
);

// ════════════════════════════════════════════════════════
// 🚀  SECTION 15 — MASTER HEALTH CHECK
// ════════════════════════════════════════════════════════

server.tool(
  "system_health_check",
  "Full health check across Groq API, Node.js backend, Python agent service, and all configured API keys.",
  {},
  async () => {
    const results: Record<string, string> = {};

    // Groq
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      });
      results.groq = r.ok ? `✅ Groq OK` : `❌ Groq error ${r.status}`;
    } catch (e) { results.groq = `❌ Groq unreachable: ${e}`; }

    // Node.js Backend
    try {
      const r = await fetch(`${BACKEND_URL}/health`);
      const d = await r.json() as { status: string };
      results.backend = r.ok ? `✅ Backend OK (${d.status})` : `❌ Backend error ${r.status}`;
    } catch (e) { results.backend = `❌ Backend unreachable: ${e}`; }

    // Python Agent Service
    try {
      const r = await fetch(`${AGENT_URL}/v1/health`);
      const d = await r.json() as { status: string };
      results.agent_service = r.ok ? `✅ Agent OK (${d.status})` : `❌ Agent error ${r.status}`;
    } catch (e) { results.agent_service = `❌ Agent unreachable: ${e}`; }

    // Key inventory
    results.key_status = [
      GROQ_API_KEY   ? "GROQ ✅"   : "GROQ ❌",
      GEMINI_KEY     ? "GEMINI ✅" : "GEMINI ❌",
      ZERNIO_KEY     ? "ZERNIO ✅" : "ZERNIO ❌",
      ANTHROPIC_KEY  ? "ANTHROPIC ✅" : "ANTHROPIC ❌",
      SENDGRID_KEY   ? "SENDGRID ✅" : "SENDGRID ❌",
      TWILIO_SID     ? "TWILIO ✅" : "TWILIO ❌",
    ].join(" | ");

    return json(results);
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────
(async () => {
  await server.connect(new StdioServerTransport());
  process.stderr.write(
    "\n╔══════════════════════════════════════════════╗\n" +
    "║  MarketOS Master MCP Server v2.0.0 — READY  ║\n" +
    "║  47 tools · Groq llama-3.3-70b-versatile    ║\n" +
    "╚══════════════════════════════════════════════╝\n\n"
  );
})();
