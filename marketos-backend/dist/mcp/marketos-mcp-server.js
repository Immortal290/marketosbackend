"use strict";

// src/mcp/marketos-mcp-server.ts
var import_config = require("dotenv/config");
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio");
var import_zod = require("zod");
var GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
var BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
var AGENT_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";
var GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
var ZERNIO_KEY = process.env.ZERNIO_API_KEY ?? "";
var ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
var OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";
var NVIDIA_KEY = process.env.NVIDIA_API_KEY ?? "";
var SENDGRID_KEY = process.env.SENDGRID_API_KEY ?? "";
var TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
var TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
var text = (t) => ({ content: [{ type: "text", text: t }] });
var json = (obj) => text(JSON.stringify(obj, null, 2));
async function backendFetch(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    method,
    headers,
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`Backend ${method} ${path} \u2192 ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
async function agentFetch(path, method = "GET", body) {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`Agent ${method} ${path} \u2192 ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
async function groqChat(messages, model = "llama-3.3-70b-versatile", temperature = 0.7, maxTokens = 2048) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices[0]?.message?.content ?? "";
}
var server = new import_mcp.McpServer({ name: "marketos-master", version: "2.0.0" });
server.tool(
  "list_api_keys",
  "Return a masked summary of all configured API keys and service URLs.",
  {},
  async () => json({
    GROQ_API_KEY: GROQ_API_KEY ? `gsk_...${GROQ_API_KEY.slice(-4)}   \u2705` : "\u274C NOT SET",
    GEMINI_KEY: GEMINI_KEY ? `...${GEMINI_KEY.slice(-4)}          \u2705` : "\u274C NOT SET",
    ANTHROPIC_KEY: ANTHROPIC_KEY ? `...${ANTHROPIC_KEY.slice(-4)}       \u2705` : "\u274C NOT SET",
    OPENROUTER_KEY: OPENROUTER_KEY ? `...${OPENROUTER_KEY.slice(-4)}      \u2705` : "\u274C NOT SET",
    NVIDIA_KEY: NVIDIA_KEY ? `...${NVIDIA_KEY.slice(-4)}          \u2705` : "\u274C NOT SET",
    ZERNIO_KEY: ZERNIO_KEY ? `...${ZERNIO_KEY.slice(-4)}          \u2705` : "\u274C NOT SET",
    SENDGRID_KEY: SENDGRID_KEY ? `...${SENDGRID_KEY.slice(-4)}        \u2705` : "\u274C NOT SET",
    TWILIO_SID: TWILIO_SID ? `...${TWILIO_SID.slice(-4)}          \u2705` : "\u274C NOT SET",
    BACKEND_URL,
    AGENT_URL
  })
);
server.tool(
  "validate_groq_key",
  "Ping Groq API to confirm the key is valid and list available models.",
  { api_key: import_zod.z.string().optional().describe("Override key for this call only.") },
  async ({ api_key }) => {
    const key = api_key ?? GROQ_API_KEY;
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`Groq validation failed: ${res.status} ${await res.text()}`);
    const d = await res.json();
    return text(`\u2705 Groq key valid. Models: ${d.data.map((m) => m.id).join(", ")}`);
  }
);
server.tool(
  "save_api_keys_to_backend",
  "Persist one or more API keys into the MarketOS database so all agents pick them up.",
  {
    groq_api_key: import_zod.z.string().optional(),
    gemini_api_key: import_zod.z.string().optional(),
    anthropic_api_key: import_zod.z.string().optional(),
    openrouter_api_key: import_zod.z.string().optional(),
    nvidia_api_key: import_zod.z.string().optional(),
    sendgrid_api_key: import_zod.z.string().optional(),
    twilio_account_sid: import_zod.z.string().optional(),
    twilio_auth_token: import_zod.z.string().optional(),
    zernio_api_key: import_zod.z.string().optional(),
    zernio_account_id: import_zod.z.string().optional(),
    auth_token: import_zod.z.string().optional()
  },
  async (args) => {
    const { auth_token, ...keys } = args;
    const filtered = Object.fromEntries(
      Object.entries(keys).filter(([, v]) => v !== void 0 && v !== "")
    );
    return json(await backendFetch("/settings/api-keys", "PATCH", filtered, auth_token));
  }
);
server.tool(
  "get_api_keys_from_backend",
  "Fetch the API keys stored in the MarketOS database.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/api-keys", "GET", void 0, auth_token))
);
server.tool(
  "groq_chat",
  "Run a Groq Llama-3 chat completion for any task: copy, analysis, translation, etc.",
  {
    system: import_zod.z.string().optional().describe("System prompt / persona."),
    user_message: import_zod.z.string().describe("Task to complete."),
    model: import_zod.z.enum(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"]).default("llama-3.3-70b-versatile"),
    temperature: import_zod.z.number().min(0).max(2).default(0.7),
    max_tokens: import_zod.z.number().min(64).max(32768).default(2048)
  },
  async ({ system, user_message, model, temperature, max_tokens }) => {
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    msgs.push({ role: "user", content: user_message });
    return text(await groqChat(msgs, model, temperature, max_tokens));
  }
);
server.tool(
  "groq_generate_marketing_copy",
  "Generate channel-optimized marketing copy using Groq Llama-3.3-70B.",
  {
    channel: import_zod.z.enum(["email", "sms", "whatsapp", "social", "landing_page", "ad"]),
    product_or_offer: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    tone: import_zod.z.enum(["professional", "friendly", "urgent", "playful", "luxury", "bold"]).default("professional"),
    brand_name: import_zod.z.string().optional(),
    cta: import_zod.z.string().optional(),
    key_benefits: import_zod.z.array(import_zod.z.string()).optional(),
    word_limit: import_zod.z.number().default(150),
    language: import_zod.z.string().default("English")
  },
  async (args) => {
    const charNote = args.channel === "sms" ? "CRITICAL: Under 160 chars with STOP opt-out." : args.channel === "whatsapp" ? "CRITICAL: Under 600 chars with opt-out line." : "";
    const reply = await groqChat(
      [
        { role: "system", content: `Expert ${args.channel} marketing copywriter. Write conversion-focused copy only. No commentary.` },
        { role: "user", content: `${args.channel} copy for: ${args.product_or_offer}
Audience: ${args.target_audience}
Tone: ${args.tone}
Brand: ${args.brand_name ?? "N/A"}
CTA: ${args.cta ?? "Shop Now"}
Benefits: ${args.key_benefits?.join(", ") ?? "N/A"}
Max words: ${args.word_limit}
Language: ${args.language}
${charNote}` }
      ],
      "llama-3.3-70b-versatile",
      0.8,
      1024
    );
    return text(reply);
  }
);
server.tool(
  "groq_analyze_campaign",
  "Feed campaign metrics to Groq and get structured AI analysis with recommendations.",
  {
    campaign_name: import_zod.z.string(),
    metrics: import_zod.z.record(import_zod.z.union([import_zod.z.string(), import_zod.z.number()])),
    goals: import_zod.z.string().optional(),
    budget_spent: import_zod.z.number().optional(),
    channels: import_zod.z.array(import_zod.z.string()).optional()
  },
  async ({ campaign_name, metrics, goals, budget_spent, channels }) => {
    const reply = await groqChat(
      [
        { role: "system", content: "Senior digital marketing analyst. Provide structured, data-driven insights." },
        { role: "user", content: `Analyze: ${campaign_name}
Goals: ${goals ?? "N/A"}
Budget: ${budget_spent ? `$${budget_spent}` : "N/A"}
Channels: ${channels?.join(", ") ?? "N/A"}
Metrics:
${JSON.stringify(metrics, null, 2)}` }
      ],
      "llama-3.3-70b-versatile",
      0.4,
      2048
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
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` }
    });
    if (!res.ok) throw new Error(`Models fetch failed: ${res.status}`);
    const d = await res.json();
    return json(d.data.map((m) => ({ id: m.id, owner: m.owned_by })));
  }
);
server.tool(
  "list_agents",
  "List all 21 MarketOS AI agents with metadata.",
  {},
  async () => json(await agentFetch("/v1/agents"))
);
server.tool(
  "run_agent",
  "Run a single MarketOS agent by name.",
  {
    agent_name: import_zod.z.string().describe("e.g. copy, analytics, sms, email, social, voice, competitor, seo, finance, compliance, ab_test, lead_scoring, creative, monitor, reporting"),
    input: import_zod.z.record(import_zod.z.unknown()),
    llm_provider: import_zod.z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    llm_model: import_zod.z.string().optional(),
    api_key_override: import_zod.z.string().optional()
  },
  async ({ agent_name, input, llm_provider, llm_model, api_key_override }) => json(await agentFetch(`/v1/agents/${agent_name}/run`, "POST", {
    input,
    llm_provider,
    ...llm_model ? { llm_model } : {},
    api_key_override: api_key_override ?? GROQ_API_KEY
  }))
);
server.tool(
  "run_campaign_pipeline",
  "Execute the full 21-agent MarketOS campaign pipeline synchronously.",
  {
    campaign_name: import_zod.z.string(),
    goal: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    channels: import_zod.z.array(import_zod.z.enum(["email", "sms", "whatsapp", "social", "voice"])).default(["email", "sms"]),
    budget: import_zod.z.number(),
    timeline: import_zod.z.string(),
    tone: import_zod.z.enum(["bold", "professional", "friendly", "playful", "luxury", "urgent"]).default("professional"),
    key_messages: import_zod.z.array(import_zod.z.string()).optional(),
    brand_name: import_zod.z.string().optional(),
    llm_provider: import_zod.z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    api_key_override: import_zod.z.string().optional()
  },
  async ({ llm_provider, api_key_override, ...rest }) => json(await agentFetch("/v1/pipeline/campaign", "POST", {
    ...rest,
    llm_provider,
    api_key_override: api_key_override ?? GROQ_API_KEY
  }))
);
server.tool(
  "run_campaign_pipeline_async",
  "Start the full pipeline asynchronously (Kafka-backed). Returns campaign_id for polling.",
  {
    campaign_name: import_zod.z.string(),
    goal: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    channels: import_zod.z.array(import_zod.z.enum(["email", "sms", "whatsapp", "social", "voice"])).default(["email", "sms"]),
    budget: import_zod.z.number(),
    timeline: import_zod.z.string(),
    tone: import_zod.z.enum(["bold", "professional", "friendly", "playful", "luxury", "urgent"]).default("professional"),
    llm_provider: import_zod.z.enum(["groq", "gemini", "anthropic", "openrouter", "mock"]).default("groq"),
    api_key_override: import_zod.z.string().optional()
  },
  async ({ llm_provider, api_key_override, ...rest }) => json(await agentFetch("/v1/pipeline/campaign/async", "POST", {
    ...rest,
    llm_provider,
    api_key_override: api_key_override ?? GROQ_API_KEY
  }))
);
server.tool(
  "get_pipeline_status",
  "Poll the status of an async campaign pipeline run.",
  { campaign_id: import_zod.z.string() },
  async ({ campaign_id }) => json(await agentFetch(`/v1/pipeline/${campaign_id}/status`))
);
server.tool(
  "agent_health_check",
  "Check if the Python agent service is reachable.",
  {},
  async () => json(await agentFetch("/v1/health"))
);
server.tool(
  "generate_whatsapp_message",
  "Write a WhatsApp promotional message using Groq (\u2264600 chars with opt-out).",
  {
    prompt: import_zod.z.string(),
    brand: import_zod.z.string().optional(),
    tone: import_zod.z.enum(["friendly", "premium", "playful", "urgent", "formal"]).default("friendly"),
    language: import_zod.z.string().default("English")
  },
  async ({ prompt, brand, tone, language }) => text(await groqChat(
    [
      { role: "system", content: "Expert WhatsApp marketing writer. Messages under 600 chars, always end with opt-out. No markdown." },
      { role: "user", content: `Write ${tone} WhatsApp message in ${language}.
Brand: ${brand ?? "N/A"}
Brief: ${prompt}` }
    ],
    "llama-3.3-70b-versatile",
    0.8,
    512
  ))
);
server.tool(
  "send_whatsapp_campaign",
  "Send a WhatsApp campaign to opted-in recipients via the MarketOS backend (Zernio).",
  {
    recipients: import_zod.z.array(import_zod.z.string()).min(1),
    message: import_zod.z.string(),
    from_number: import_zod.z.string().optional(),
    confirm_opt_in: import_zod.z.boolean().describe("Must be true \u2014 confirms opt-in compliance."),
    auth_token: import_zod.z.string().optional()
  },
  async ({ recipients, message, from_number, confirm_opt_in, auth_token }) => {
    if (!confirm_opt_in) throw new Error("confirm_opt_in must be true \u2014 opt-in compliance required.");
    return json(await backendFetch("/whatsapp/send", "POST", { recipients, message, from_number }, auth_token));
  }
);
server.tool(
  "generate_email_campaign",
  "Generate a full HTML email campaign (subject, preview, body, CTA) using Groq.",
  {
    product_or_offer: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    tone: import_zod.z.enum(["professional", "friendly", "urgent", "playful", "luxury"]).default("professional"),
    brand_name: import_zod.z.string().optional(),
    cta_text: import_zod.z.string().default("Shop Now"),
    cta_url: import_zod.z.string().default("https://example.com"),
    key_benefits: import_zod.z.array(import_zod.z.string()).optional(),
    variants: import_zod.z.number().min(1).max(3).default(1)
  },
  async (args) => text(await groqChat(
    [
      { role: "system", content: "Expert email marketer. Return JSON: {variants:[{variant_id,subject_line,preview_text,body_html,body_text,cta_text,cta_url,estimated_open_rate,estimated_ctr}]}" },
      { role: "user", content: `Create ${args.variants} email variant(s):
- Product: ${args.product_or_offer}
- Audience: ${args.target_audience}
- Tone: ${args.tone}
- Brand: ${args.brand_name ?? "N/A"}
- CTA: ${args.cta_text} -> ${args.cta_url}
- Benefits: ${args.key_benefits?.join(", ") ?? "N/A"}
Return ONLY valid JSON.` }
    ],
    "llama-3.3-70b-versatile",
    0.7,
    4096
  ))
);
server.tool(
  "send_email_campaign",
  "Trigger a bulk email send via the MarketOS email channel backend.",
  {
    recipients: import_zod.z.array(import_zod.z.object({ email: import_zod.z.string().email(), name: import_zod.z.string().optional() })).min(1),
    subject: import_zod.z.string(),
    html_body: import_zod.z.string(),
    text_body: import_zod.z.string().optional(),
    from_email: import_zod.z.string().email().optional(),
    from_name: import_zod.z.string().optional(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ recipients, subject, html_body, text_body, from_email, from_name, auth_token }) => json(await backendFetch("/email-channel/send", "POST", { recipients, subject, html_body, text_body, from_email, from_name }, auth_token))
);
server.tool(
  "get_email_analytics",
  "Fetch email channel delivery and engagement analytics.",
  { campaign_id: import_zod.z.string().optional(), auth_token: import_zod.z.string().optional() },
  async ({ campaign_id, auth_token }) => json(await backendFetch(campaign_id ? `/email-channel/analytics/${campaign_id}` : "/email-channel/analytics", "GET", void 0, auth_token))
);
server.tool(
  "generate_sms_campaign",
  "Generate 1\u20133 SMS variants (\u2264160 chars) using Groq with opt-out lines.",
  {
    product_or_offer: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    tone: import_zod.z.enum(["professional", "friendly", "urgent", "playful"]).default("urgent"),
    brand_name: import_zod.z.string().optional(),
    cta_url: import_zod.z.string().optional(),
    variants: import_zod.z.number().min(1).max(3).default(2)
  },
  async (args) => text(await groqChat(
    [
      { role: "system", content: "SMS marketing expert. Messages under 160 chars with opt-out. Return JSON: {variants:[{variant_id,message,char_count,estimated_ctr,angle}]}" },
      { role: "user", content: `Create ${args.variants} SMS variants:
- Product: ${args.product_or_offer}
- Audience: ${args.target_audience}
- Tone: ${args.tone}
- Brand: ${args.brand_name ?? "N/A"}
- URL: ${args.cta_url ?? "N/A"}
Return ONLY valid JSON.` }
    ],
    "llama-3.3-70b-versatile",
    0.8,
    1024
  ))
);
server.tool(
  "send_sms_campaign",
  "Send an SMS blast to opted-in recipients via the MarketOS SMS backend (Twilio).",
  {
    recipients: import_zod.z.array(import_zod.z.string()).min(1),
    message: import_zod.z.string().max(160),
    confirm_opt_in: import_zod.z.boolean(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ recipients, message, confirm_opt_in, auth_token }) => {
    if (!confirm_opt_in) throw new Error("confirm_opt_in must be true for TCPA/CTIA compliance.");
    return json(await backendFetch("/sms/send", "POST", { recipients, message }, auth_token));
  }
);
server.tool(
  "get_dashboard_metrics",
  "Fetch live dashboard KPIs: revenue, CAC, ROAS, active campaigns.",
  {
    period: import_zod.z.enum(["7d", "30d", "90d", "ytd"]).default("30d"),
    auth_token: import_zod.z.string().optional()
  },
  async ({ period, auth_token }) => json(await backendFetch(`/dashboard?period=${period}`, "GET", void 0, auth_token))
);
server.tool(
  "get_analytics",
  "Pull detailed analytics for campaigns, channels, or audience segments.",
  {
    type: import_zod.z.enum(["overview", "campaigns", "channels", "audience", "funnel"]).default("overview"),
    start_date: import_zod.z.string().optional(),
    end_date: import_zod.z.string().optional(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ type, start_date, end_date, auth_token }) => {
    const params = new URLSearchParams();
    if (start_date) params.set("start", start_date);
    if (end_date) params.set("end", end_date);
    const qs = params.toString() ? `?${params}` : "";
    return json(await backendFetch(`/analytics/${type}${qs}`, "GET", void 0, auth_token));
  }
);
server.tool(
  "get_reports",
  "Fetch generated campaign or audience reports.",
  {
    report_type: import_zod.z.enum(["campaign", "audience", "finance", "monitoring"]).default("campaign"),
    auth_token: import_zod.z.string().optional()
  },
  async ({ report_type, auth_token }) => json(await backendFetch(`/reports/${report_type}`, "GET", void 0, auth_token))
);
server.tool(
  "list_campaigns",
  "List all campaigns with status, budget, and performance summary.",
  {
    status: import_zod.z.enum(["all", "active", "draft", "paused", "completed"]).default("all"),
    limit: import_zod.z.number().default(20),
    auth_token: import_zod.z.string().optional()
  },
  async ({ status, limit, auth_token }) => json(await backendFetch(`/campaigns?status=${status}&limit=${limit}`, "GET", void 0, auth_token))
);
server.tool(
  "create_campaign",
  "Create a new campaign in the MarketOS backend.",
  {
    name: import_zod.z.string(),
    goal: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    channels: import_zod.z.array(import_zod.z.enum(["email", "sms", "whatsapp", "social", "voice"])),
    budget: import_zod.z.number(),
    start_date: import_zod.z.string(),
    end_date: import_zod.z.string().optional(),
    tone: import_zod.z.string().default("professional"),
    key_messages: import_zod.z.array(import_zod.z.string()).optional(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ auth_token, ...data }) => json(await backendFetch("/campaigns", "POST", data, auth_token))
);
server.tool(
  "get_campaign_detail",
  "Get full details of a campaign including agent outputs.",
  { campaign_id: import_zod.z.string(), auth_token: import_zod.z.string().optional() },
  async ({ campaign_id, auth_token }) => json(await backendFetch(`/campaign-detail/${campaign_id}`, "GET", void 0, auth_token))
);
server.tool(
  "update_campaign",
  "Update campaign fields like status, budget, or dates.",
  {
    campaign_id: import_zod.z.string(),
    updates: import_zod.z.record(import_zod.z.unknown()),
    auth_token: import_zod.z.string().optional()
  },
  async ({ campaign_id, updates, auth_token }) => json(await backendFetch(`/campaigns/${campaign_id}`, "PATCH", updates, auth_token))
);
server.tool(
  "create_campaign_brief",
  "Submit a natural-language campaign brief to the AI pipeline.",
  {
    brief: import_zod.z.string(),
    workspace_id: import_zod.z.string().optional(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ brief, workspace_id, auth_token }) => json(await backendFetch("/campaign/brief", "POST", { brief, workspace_id }, auth_token))
);
server.tool(
  "get_audience_segments",
  "List all audience segments.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/audience", "GET", void 0, auth_token))
);
server.tool(
  "create_audience_segment",
  "Create a new audience segment with targeting filters.",
  {
    name: import_zod.z.string(),
    description: import_zod.z.string().optional(),
    filters: import_zod.z.record(import_zod.z.unknown()),
    auth_token: import_zod.z.string().optional()
  },
  async ({ auth_token, ...data }) => json(await backendFetch("/audience", "POST", data, auth_token))
);
server.tool(
  "get_workspace_settings",
  "Retrieve current workspace configuration.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/workspace", "GET", void 0, auth_token))
);
server.tool(
  "update_workspace_settings",
  "Update workspace name, timezone, brand color, and feature flags.",
  { settings: import_zod.z.record(import_zod.z.unknown()), auth_token: import_zod.z.string().optional() },
  async ({ settings, auth_token }) => json(await backendFetch("/settings/workspace", "PATCH", settings, auth_token))
);
server.tool(
  "list_integrations",
  "List all external integrations and connection status.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/integrations", "GET", void 0, auth_token))
);
server.tool(
  "toggle_integration",
  "Connect or disconnect a third-party integration.",
  {
    integration_id: import_zod.z.string(),
    connected: import_zod.z.boolean(),
    auth_token: import_zod.z.string().optional()
  },
  async ({ integration_id, connected, auth_token }) => json(await backendFetch(`/settings/integrations/${integration_id}`, "PATCH", { connected }, auth_token))
);
server.tool(
  "get_billing",
  "Retrieve billing plan, seat usage, and token consumption.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/billing", "GET", void 0, auth_token))
);
server.tool(
  "get_security_settings",
  "Retrieve MFA, SSO, and session policies.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/security", "GET", void 0, auth_token))
);
server.tool(
  "get_compliance_settings",
  "Retrieve GDPR, CAN-SPAM, and compliance controls.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/settings/compliance", "GET", void 0, auth_token))
);
server.tool(
  "login",
  "Authenticate a MarketOS user and receive a JWT access token.",
  { email: import_zod.z.string().email(), password: import_zod.z.string() },
  async ({ email, password }) => json(await backendFetch("/auth/login", "POST", { email, password }))
);
server.tool(
  "register",
  "Register a new MarketOS user account.",
  {
    name: import_zod.z.string(),
    email: import_zod.z.string().email(),
    password: import_zod.z.string().min(8),
    workspace_name: import_zod.z.string().optional()
  },
  async (data) => json(await backendFetch("/auth/register", "POST", data))
);
server.tool(
  "refresh_token",
  "Exchange a refresh token for a new JWT access token.",
  { refresh_token: import_zod.z.string() },
  async ({ refresh_token }) => json(await backendFetch("/auth/refresh", "POST", { refresh_token }))
);
server.tool(
  "generate_creative_brief",
  "Generate a comprehensive creative brief using Groq.",
  {
    campaign_goal: import_zod.z.string(),
    brand_name: import_zod.z.string(),
    target_audience: import_zod.z.string(),
    channels: import_zod.z.array(import_zod.z.string()),
    budget: import_zod.z.number().optional(),
    timeline: import_zod.z.string().optional(),
    tone: import_zod.z.string().default("professional"),
    competitors: import_zod.z.array(import_zod.z.string()).optional()
  },
  async (args) => text(await groqChat(
    [
      { role: "system", content: "You are a creative director. Generate detailed, actionable creative briefs." },
      { role: "user", content: `Creative Brief:
- Brand: ${args.brand_name}
- Goal: ${args.campaign_goal}
- Audience: ${args.target_audience}
- Channels: ${args.channels.join(", ")}
- Budget: ${args.budget ? `$${args.budget}` : "TBD"}
- Timeline: ${args.timeline ?? "TBD"}
- Tone: ${args.tone}
- Competitors: ${args.competitors?.join(", ") ?? "N/A"}

Include: Executive Summary, Brand Voice, Visual Direction, Channel Strategy, KPIs, Do's & Don'ts.` }
    ],
    "llama-3.3-70b-versatile",
    0.7,
    3e3
  ))
);
server.tool(
  "competitor_analysis",
  "Run a competitive intelligence report using Groq.",
  {
    brand_name: import_zod.z.string(),
    industry: import_zod.z.string(),
    competitors: import_zod.z.array(import_zod.z.string()).optional(),
    focus: import_zod.z.enum(["pricing", "messaging", "social_presence", "content", "full"]).default("full")
  },
  async ({ brand_name, industry, competitors, focus }) => text(await groqChat(
    [
      { role: "system", content: "Competitive intelligence analyst. Provide structured analysis with counter-strategies." },
      { role: "user", content: `Competitive Analysis:
- Brand: ${brand_name}
- Industry: ${industry}
- Competitors: ${competitors?.join(", ") ?? "Identify top 3-5 from industry"}
- Focus: ${focus}

Provide: Competitor profiles, Threat assessment (Low/Medium/High), Market gaps, Counter-strategy for ${brand_name}, Quick wins (30 days).` }
    ],
    "llama-3.3-70b-versatile",
    0.5,
    3e3
  ))
);
server.tool(
  "list_workflows",
  "List all automation workflows.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/workflow-engine", "GET", void 0, auth_token))
);
server.tool(
  "get_monitoring_status",
  "Get system monitoring health \u2014 agent performance, API latency, error rates.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/monitoring", "GET", void 0, auth_token))
);
server.tool(
  "get_audit_logs",
  "Retrieve immutable audit logs for all administrative actions.",
  { limit: import_zod.z.number().default(50), auth_token: import_zod.z.string().optional() },
  async ({ limit, auth_token }) => json(await backendFetch(`/audit-logs?limit=${limit}`, "GET", void 0, auth_token))
);
server.tool(
  "get_brand_profile",
  "Retrieve brand profile: voice, colors, logos, positioning.",
  { auth_token: import_zod.z.string().optional() },
  async ({ auth_token }) => json(await backendFetch("/brand-profile", "GET", void 0, auth_token))
);
server.tool(
  "update_brand_profile",
  "Update brand profile with new guidelines, colors, or voice specs.",
  { updates: import_zod.z.record(import_zod.z.unknown()), auth_token: import_zod.z.string().optional() },
  async ({ updates, auth_token }) => json(await backendFetch("/brand-profile", "PATCH", updates, auth_token))
);
server.tool(
  "system_health_check",
  "Full health check across Groq API, Node.js backend, Python agent service, and all configured API keys.",
  {},
  async () => {
    const results = {};
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` }
      });
      results.groq = r.ok ? `\u2705 Groq OK` : `\u274C Groq error ${r.status}`;
    } catch (e) {
      results.groq = `\u274C Groq unreachable: ${e}`;
    }
    try {
      const r = await fetch(`${BACKEND_URL}/health`);
      const d = await r.json();
      results.backend = r.ok ? `\u2705 Backend OK (${d.status})` : `\u274C Backend error ${r.status}`;
    } catch (e) {
      results.backend = `\u274C Backend unreachable: ${e}`;
    }
    try {
      const r = await fetch(`${AGENT_URL}/v1/health`);
      const d = await r.json();
      results.agent_service = r.ok ? `\u2705 Agent OK (${d.status})` : `\u274C Agent error ${r.status}`;
    } catch (e) {
      results.agent_service = `\u274C Agent unreachable: ${e}`;
    }
    results.key_status = [
      GROQ_API_KEY ? "GROQ \u2705" : "GROQ \u274C",
      GEMINI_KEY ? "GEMINI \u2705" : "GEMINI \u274C",
      ZERNIO_KEY ? "ZERNIO \u2705" : "ZERNIO \u274C",
      ANTHROPIC_KEY ? "ANTHROPIC \u2705" : "ANTHROPIC \u274C",
      SENDGRID_KEY ? "SENDGRID \u2705" : "SENDGRID \u274C",
      TWILIO_SID ? "TWILIO \u2705" : "TWILIO \u274C"
    ].join(" | ");
    return json(results);
  }
);
(async () => {
  await server.connect(new import_stdio.StdioServerTransport());
  process.stderr.write(
    "\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551  MarketOS Master MCP Server v2.0.0 \u2014 READY  \u2551\n\u2551  47 tools \xB7 Groq llama-3.3-70b-versatile    \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n"
  );
})();
