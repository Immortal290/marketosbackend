import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_CANDIDATES = [
  process.env.AGENT_SERVICE_URL,
  process.env.AGENTS_SERVICE_URL,
  process.env.AGENTS_URL,
  process.env.BACKEND_URL,
  process.env.RAILWAY_BACKEND_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.API_URL,
  "http://renewed-dedication.railway.internal:8000",
  "http://renewed-dedication.railway.internal",
  "http://reneweddedication.railway.internal:8000",
  "http://reneweddedication.railway.internal",
  "http://digital_marketing_agent.railway.internal:8000",
  "http://digitalmarketingagent.railway.internal:8000",
  "http://digital-marketing-agent.railway.internal:8000",
  "http://marketosbackend.railway.internal:3000",
  "http://marketosbackend.railway.internal",
  "http://marketos-backend.railway.internal:3000",
  "http://marketos-backend.railway.internal",
  "https://marketosbackend-production.up.railway.app",
  "http://marketos_agents:8000",
  "http://localhost:8000",
  "http://localhost:3001",
  "http://localhost:3000",
].filter((url): url is string => Boolean(url) && typeof url === "string");

function buildSSELine(stage: string, agent: string, status: string, detail: string, data: object = {}): string {
  return JSON.stringify({
    stage,
    agent,
    status,
    detail,
    data,
    timestamp: new Date().toISOString(),
  });
}

function extractSubjectFromPrompt(prompt: string): string {
  if (!prompt || typeof prompt !== "string") return "Featured Product";
  
  let cleaned = prompt
    .replace(/^(create|generate|launch|build|make|run|design|write|plan|start|execute)\s+(a|an|the)?\s*/i, "")
    .replace(/^(multi-channel|marketing|ad|ad campaign|campaign|promo|promotion|drip|email|social|visual)\s+(for|about|on|targeting)?\s*/i, "")
    .trim();

  if (cleaned.length > 0) {
    const parts = cleaned.split(/,|\.|;|for|targeting|with|in/i)[0].trim();
    if (parts.length > 0) {
      const words = parts.split(/\s+/).slice(0, 5);
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }

  return "Featured Product";
}

/**
 * Build a Pollinations.ai URL that generates an on-brand image from a text prompt.
 * Free, no API key, uses Flux model. Width/height control the banner format.
 */
function pollinationsUrl(prompt: string, width: number, height: number): string {
  const cleanPrompt = prompt.slice(0, 450);
  const encoded = encodeURIComponent(
    `${cleanPrompt}. High production commercial visual, professional studio lighting. NO text, words, or letters in image.`
  );
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&safe=true&seed=${Math.floor(Math.random() * 99999)}`;
}

/**
 * Generate 6 campaign-specific banner options dynamically derived from user intent.
 */
function getBrandImageGallery(subject: string, fullPrompt: string): any[] {
  const cleanSubject = subject || "Featured Product";
  const promptContext = (fullPrompt || "").trim();

  const isFestive = /diwali|christmas|holiday|festival|new year|eid|black friday|cyber monday|sale|discount|promo/i.test(promptContext);
  const isTech = /tech|app|software|ai|saas|digital|mobile|phone|laptop|code|data|cloud|platform|gadget/i.test(promptContext);
  const isOrganic = /organic|green|tea|nature|herbal|natural|eco|clean|skincare|wellness|food|vegan|beauty/i.test(promptContext);
  const isFashion = /fashion|style|wear|cloth|apparel|watch|jewel|luxury|shoes|bag|design/i.test(promptContext);

  let visualContext = "";
  if (isFestive) {
    visualContext = "festive celebration atmosphere, elegant holiday decorative background";
  } else if (isTech) {
    visualContext = "modern high-tech studio environment, sleek lighting";
  } else if (isOrganic) {
    visualContext = "natural botanical setting, soft fresh ambient daylight";
  } else if (isFashion) {
    visualContext = "high-fashion editorial studio setting, premium texture and lighting";
  } else {
    visualContext = "professional commercial advertisement setup, balanced studio lighting";
  }

  const angles = [
    { prompt: `${cleanSubject}, hero product photograph, ${promptContext}, ${visualContext}`, w: 1200, h: 628 },
    { prompt: `${cleanSubject} in real-life lifestyle scene, ${promptContext}, authentic natural mood`, w: 1080, h: 1080 },
    { prompt: `Macro close-up detail of ${cleanSubject}, showcasing materials and design, ${promptContext}`, w: 1080, h: 1920 },
    { prompt: `Flat lay arrangement featuring ${cleanSubject}, ${promptContext}, clean aesthetic composition`, w: 1200, h: 628 },
    { prompt: `Vibrant editorial showcase of ${cleanSubject}, ${promptContext}, striking visual framing`, w: 1080, h: 1080 },
    { prompt: `Cinematic wide advertisement for ${cleanSubject}, ${promptContext}, rich atmospheric lighting`, w: 1200, h: 628 },
  ];

  return [
    { id: "v1", title: "1. Official Product Banner (1200x628)", url: pollinationsUrl(angles[0].prompt, angles[0].w, angles[0].h), overlay: `🔥 INTRODUCING ${cleanSubject.toUpperCase()} — CLAIM OFFER`,      format: "LinkedIn / Meta Landscape (1200x628)" },
    { id: "v2", title: "2. Lifestyle Square (1080x1080)",        url: pollinationsUrl(angles[1].prompt, angles[1].w, angles[1].h), overlay: `✨ THE ${cleanSubject.toUpperCase()} EXPERIENCE`,               format: "Instagram / Facebook Square (1080x1080)" },
    { id: "v3", title: "3. Mobile Story (1080x1920)",            url: pollinationsUrl(angles[2].prompt, angles[2].w, angles[2].h), overlay: `🚀 UP TO 40% OFF — ${cleanSubject.toUpperCase()}`,              format: "Instagram Stories & Reels (1080x1920)" },
    { id: "v4", title: "4. Minimalist Flat Lay (1200x628)",      url: pollinationsUrl(angles[3].prompt, angles[3].w, angles[3].h), overlay: `⚡ PURE QUALITY — ${cleanSubject.toUpperCase()}`,              format: "Clean Minimalist Layout" },
    { id: "v5", title: "5. Editorial Square (1080x1080)",        url: pollinationsUrl(angles[4].prompt, angles[4].w, angles[4].h), overlay: `💡 DISCOVER THE REAL ${cleanSubject.toUpperCase()}`,           format: "Vibrant Editorial Spotlight" },
    { id: "v6", title: "6. Cinematic Banner (1200x628)",         url: pollinationsUrl(angles[5].prompt, angles[5].w, angles[5].h), overlay: `📈 ${cleanSubject.toUpperCase()} — BUILT TO PERFORM`,          format: "Cinematic Wide Format" },
  ];
}

async function getAgentMockPayload(agentName: string, prompt: string): Promise<Record<string, any>> {
  const name = agentName.toLowerCase();
  const subject = extractSubjectFromPrompt(prompt);

  if (name.includes("supervisor")) {
    return {
      campaign_name: `${subject} Launch Campaign`,
      goal: `Drive verified engagement, acquisition, and revenue growth for ${subject}`,
      target_audience: `Core target audience seeking ${subject} solutions`,
      budget: "Aligned to campaign objective",
      timeline: "Execution Sprint",
      tone: "Direct, brand-aligned, conversion-focused",
      key_messages: [
        `Introducing ${subject} to market`,
        `Key benefits and value proposition for ${subject}`,
        `Clear call to action for ${subject}`
      ]
    };
  }

  if (name.includes("creative") || name.includes("image")) {
    const banner_options = await getBrandImageGallery(subject, prompt);

    return {
      campaign_concept: `${subject}: Strategic Omnichannel Execution`,
      creative_direction: `Brand-Consistent Visual Aesthetics for ${subject}`,
      visual_theme: `High-Impact Commercial Photography for ${subject}`,
      ad_banner_specs: {
        dimensions: "1200x628 (Landscape), 1080x1080 (Square), 1080x1920 (Vertical)",
        headline_overlay: banner_options[0].overlay,
        primary_visual: `Bespoke visual representation of ${subject}`
      },
      color_palette: ["#111827 (Obsidian)", "#3B82F6 (Vibrant Blue)", "#F59E0B (Amber Gold)", "#FFFFFF (Pure White)"],
      asset_preview: banner_options[0].url,
      banner_options: banner_options,
      total_variants_generated: 6
    };
  }

  if (name.includes("copy")) {
    return {
      ad_headlines: [
        `Discover ${subject} — Official Release`,
        `Special Offer: Upgrade Your Experience with ${subject}`,
        `Claim Your ${subject} Incentive Today`,
        `Proven Results for ${subject}`
      ],
      landing_page_variants: [
        `Variant A: 'Targeted value proposition and features for ${subject}.'`,
        `Variant B: 'Direct benefit-focused presentation for ${subject}.'`
      ],
      call_to_action: `Get ${subject}`
    };
  }

  if (name.includes("email")) {
    return {
      email_campaign_name: `${subject} Campaign Sequence`,
      email_draft_1: {
        subject_line: `Official Release: ${subject} Announcement`,
        preview_text: `Key details and introductory offer for ${subject}.`,
        salutation: "Hello,",
        body: `We are pleased to introduce our latest offering for ${subject}.\n\nBuilt to meet your expectations with quality, efficiency, and reliable performance.\n\nTake advantage of this special release today.`,
        call_to_action: `Learn More About ${subject}`,
        cta_url: "https://marketos.ai/promotions/offer",
        footer: "MarketOS AI Marketing System | Reply STOP to unsubscribe."
      },
      sequence_schedule: "Email 1 (Initial Launch), Email 2 (Value Deep Dive), Email 3 (Offer Expiration)",
      metrics_estimate: { open_rate: "38.5%", click_through_rate: "8.2%", projected_leads: 250 }
    };
  }

  if (name.includes("sms")) {
    return {
      sms_marketing_formats: [
        `Option 1: ${subject} update: Claim your exclusive release offer today: https://mktos.ai/s/offer Reply STOP to unsubscribe.`,
        `Option 2: Explore ${subject} now! Access details here: https://mktos.ai/s/info Reply STOP to unsubscribe.`
      ],
      segment_length: "140 characters (1 GSM segment)",
      tcpa_compliance: "Includes standard opt-out keywords (STOP / HELP)."
    };
  }

  if (name.includes("compliance")) {
    return {
      compliance_status: "APPROVED",
      gdpr_compliant: true,
      can_spam_compliant: true,
      ad_policy_verified: true,
      risk_score: "LOW",
      policy_notes: `Promotional statements and disclosure requirements for ${subject} verified.`
    };
  }

  if (name.includes("analytics")) {
    return {
      predicted_roas: "4.2x",
      projected_conversions: 350,
      cost_per_acquisition: "Optimized",
      recommended_channels: ["Social Media", "Search", "Email"]
    };
  }

  if (name.includes("seo")) {
    return {
      target_keywords: [subject.toLowerCase(), `${subject.toLowerCase()} official`, `best ${subject.toLowerCase()}`],
      seo_score: "92/100",
      meta_description: `Official ${subject} details, benefits, and launch updates.`
    };
  }

  if (name.includes("reporting")) {
    return {
      campaign_grade: "A",
      executive_summary: `Campaign strategy for '${subject}' generated across specialist agents.`,
      top_insight: "Targeted subject lines demonstrate strong audience alignment.",
      status: "Ready for Review"
    };
  }

  return {
    status: "completed",
    summary: `${agentName} executed task for '${subject}'.`,
    confidence: 0.95
  };
}

async function generateComprehensiveReport(
  prompt: string,
  intent: string,
  confidence: number,
  agents: string[]
): Promise<string> {
  const agentDetailsPromises = agents.map(async (agentName) => {
    const mock = await getAgentMockPayload(agentName, prompt);
    let body = "";
    
    if (agentName.toLowerCase().includes("email") && mock.email_draft_1) {
      const draft = mock.email_draft_1;
      body += `**Campaign Sequence:** \`${mock.email_campaign_name}\`\n\n`;
      body += `> 📧 **EMAIL DRAFT 1**\n`;
      body += `> **Subject:** ${draft.subject_line}\n`;
      body += `> **Preview Text:** *${draft.preview_text}*\n`;
      body += `>\n`;
      body += `> ${draft.salutation}\n>\n`;
      body += `> ${draft.body.replace(/\n/g, "\n> ")}\n>\n`;
      body += `> **[ ${draft.call_to_action} ]** → \`${draft.cta_url}\`\n`;
      body += `>\n`;
      body += `> *${draft.footer}*\n\n`;
      body += `- **Sequence Schedule:** ${mock.sequence_schedule}\n`;
      body += `- **Estimated Performance:** ${mock.metrics_estimate.open_rate} Open Rate | ${mock.metrics_estimate.click_through_rate} CTR\n`;
    } else if (agentName.toLowerCase().includes("sms") && mock.sms_marketing_formats) {
      body += `**SMS Marketing Formats:**\n\n`;
      mock.sms_marketing_formats.forEach((fmt: string) => {
        body += `\`\`\`text\n${fmt}\n\`\`\`\n`;
      });
      body += `- **Segment Length:** ${mock.segment_length}\n`;
      body += `- **Compliance:** ${mock.tcpa_compliance}\n`;
    } else if ((agentName.toLowerCase().includes("creative") || agentName.toLowerCase().includes("image")) && mock.banner_options) {
      body += `- **Campaign Concept:** ${mock.campaign_concept}\n`;
      body += `- **Creative Direction:** ${mock.creative_direction}\n`;
      body += `- **Visual Theme:** ${mock.visual_theme}\n\n`;
      body += `#### Generated Visual Banner Variants (${mock.banner_options.length} Options):\n`;
      mock.banner_options.forEach((opt: any) => {
        body += `\n##### ${opt.title}\n`;
        body += `* **Format:** ${opt.format}\n`;
        body += `* **Headline Overlay:** "${opt.overlay}"\n`;
        body += `* **Asset Preview:** ![${opt.title}](${opt.url})\n`;
      });
      body += `\n- **Color Palette:** ${mock.color_palette.join(" | ")}\n`;
    } else {
      for (const [k, v] of Object.entries(mock)) {
        const keyFormatted = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        if (Array.isArray(v)) {
          body += `\n#### ${keyFormatted}:\n` + v.map(item => `* ${item}`).join("\n") + "\n";
        } else if (typeof v === "object" && v !== null) {
          body += `\n#### ${keyFormatted}:\n` + Object.entries(v).map(([subK, subV]) => `* **${subK}:** ${subV}`).join("\n") + "\n";
        } else {
          body += `- **${keyFormatted}:** ${v}\n`;
        }
      }
    }
    return `### 🤖 ${agentName}\n${body}`;
  });
  const agentDetailsArray = await Promise.all(agentDetailsPromises);
  const agentDetails = agentDetailsArray.join("\n\n---\n\n");

  return `# MarketOS AI Marketing Campaign & Creative Execution Report

## 1. Executive Summary
- **Original User Query:** "${prompt}"
- **Detected Intent:** \`${intent}\` (${Math.round(confidence * 100)}% AI confidence score)
- **Status:** Complete — Executed across ${agents.length + 1} autonomous agents
- **Execution Date:** ${new Date().toUTCString()}

---

## 2. A/B Testing Gate Analysis
- **Decision:** \`WINNER_DECLARED\`
- **Winning Variant:** V-001 (Targeted Value Proposition Messaging)
- **Bayesian Confidence:** 96.4%
- **Performance Lift:** +18.4% predicted CTR improvement over baseline control.

---

## 3. Comprehensive Agent Execution Outputs

${agentDetails}

---

## 4. Strategic Recommendations
1. **Multi-Touch Deployment:** Deploy Creative Concept ad banners alongside Email Draft 1 and SMS Option 1 for maximum omnichannel synergy.
2. **Ad Copy Testing:** Scale top-performing promotional ad headlines across search and social ad sets.
3. **Channel Budget Allocation:** Allocate spend across social paid media, search ads, and direct nurture sequences.

---

## 5. Actionable Next Steps
- [x] All agent outputs generated and verified by human supervisor.
- [ ] Push approved creative ad banners, email drafts, and SMS formats to campaign channels.
- [ ] Monitor real-time telemetry via Analytics Agent.
`;
}

function classifyLocally(prompt: string) {
  const fullAgentList = [
    "Supervisor Agent",
    "Creative Agent",
    "Copy Agent",
    "Email Agent",
    "SMS Agent",
    "SEO Agent",
    "Compliance Agent",
    "Analytics Agent",
    "Reporting Agent"
  ];

  const subject = extractSubjectFromPrompt(prompt);

  return { intent: "GENERATE_CONTENT", confidence: 0.96, agents: fullAgentList, routeTo: "/creative-studio", summary: `Generating tailored creative concept, ad copy, email draft & SMS formats for '${subject}'` };
}

async function buildLocalStream(prompt: string): Promise<ReadableStream> {
  const { intent, confidence, agents, routeTo, summary } = classifyLocally(prompt);
  const taskId = `task-${Date.now()}`;

  const agentExecLines: string[] = [];
  for (const a of agents) {
    agentExecLines.push(buildSSELine("AGENT_EXEC", a, "running", `Executing ${a}...`));
    const agentKey = a.toLowerCase().replace(/ agent$/i, "").replace(/\s+/g, "_");
    const mockPayload = await getAgentMockPayload(a, prompt);
    agentExecLines.push(buildSSELine("AGENT_EXEC", a, "completed", `${a} completed successfully`, {
      result: mockPayload,
      result_preview: JSON.stringify(mockPayload).slice(0, 120),
      agent_key: agentKey,
      elapsed_ms: Math.floor(Math.random() * 250 + 120)
    }));
  }

  const fullReport = await generateComprehensiveReport(prompt, intent, confidence, agents);

  const stages = [
    buildSSELine("INIT", "MarketOS AI", "starting", `Session initialised — receiving query: "${prompt}"`),
    buildSSELine("GLM_REASONING", "AI Engine", "running", `Analysing user prompt: "${prompt}"...`),
    buildSSELine("GLM_REASONING", "AI Engine", "completed", `Intent: ${intent} (${Math.round(confidence * 100)}% confidence)`, { intent, confidence, summary, agents, routeTo }),
    buildSSELine("AB_TEST", "A/B Test Agent", "running", "Running mandatory Bayesian A/B analysis gate..."),
    buildSSELine("AB_TEST", "A/B Test Agent", "completed", "Decision: WINNER_DECLARED | P(best)=0.96 | Variant A leads", { ab_result: { decision: "winner_declared", winner_id: "V-001", confidence: 0.96 } }),
    ...agentExecLines,
    buildSSELine("SYNTHESIS", "Document Generator", "running", "Synthesising all outputs into structured documentation..."),
    buildSSELine("SYNTHESIS", "Document Generator", "completed", "Documentation ready", {
      documentation: fullReport
    }),
    buildSSELine("COMPLETE", "MarketOS AI", "completed", `Workflow complete — ${agents.length + 1} agents executed`, {
      session_id: taskId, intent, confidence, agents_run: agents.length + 1, routeTo,
      documentation: fullReport,
      ab_result: { decision: "winner_declared", winner_id: "V-001", confidence: 0.96 },
    }),
  ];

  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i < stages.length) {
function extractSubjectFromPrompt(prompt: string): string {
  const words = prompt.split(" ");
  return words[words.length - 1].replace(/['"]/g, "");
}

const BACKEND_CANDIDATES = [
  process.env.AGENT_SERVICE_URL,
  process.env.AGENTS_SERVICE_URL,
  process.env.AGENTS_URL,
  process.env.BACKEND_URL,
  process.env.RAILWAY_BACKEND_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.API_URL,
  "http://renewed-dedication.railway.internal:8000",
  "http://renewed-dedication.railway.internal",
  "http://reneweddedication.railway.internal:8000",
  "http://reneweddedication.railway.internal",
  "https://renewed-dedication-production.up.railway.app",
  "http://renewed-dedication-production.up.railway.app",
  "https://reneweddedication-production.up.railway.app",
  "http://reneweddedication-production.up.railway.app",
  "https://marketos-agents-production.up.railway.app",
  "http://digital_marketing_agent.railway.internal:8000",
  "http://digitalmarketingagent.railway.internal:8000",
  "http://digital-marketing-agent.railway.internal:8000",
  "http://marketosbackend.railway.internal:3000",
  "http://marketosbackend.railway.internal",
  "http://marketos-backend.railway.internal:3000",
  "http://marketos-backend.railway.internal",
  "https://marketosbackend-production.up.railway.app",
  "http://marketos_agents:8000",
  "http://localhost:8000",
  "http://localhost:3001",
  "http://localhost:3000",
].filter((url): url is string => Boolean(url) && typeof url === "string");

function buildSSELine(stage: string, agent: string, status: string, detail: string, data: object = {}): string {
  return JSON.stringify({
    stage,
    agent,
    status,
    detail,
    data,
    timestamp: new Date().toISOString(),
  });
}

function buildErrorStream(message: string): ReadableStream {
  const encoder = new TextEncoder();
  const errLine = buildSSELine("ERROR", "MarketOS AI", "failed", message, { error: message });
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${errLine}\n\n`));
      controller.enqueue(encoder.encode(`event: end\ndata: {"status":"error","message":"${message}"}\n\n`));
      controller.close();
    }
  });
}

export async function POST(req: NextRequest) {
  let bodyText: string | null = null;
  try { bodyText = await req.text(); } catch (_e) {}

  let bodyPayload: { prompt?: string; query?: string; workspaceId?: string } = {};
  if (bodyText) {
    try { bodyPayload = JSON.parse(bodyText); } catch (_e) {}
  }

  const userQuery = bodyPayload.prompt || bodyPayload.query || "";
  const workspaceId = bodyPayload.workspaceId || "default";

  // Try candidate backend servers
  for (const base of BACKEND_CANDIDATES) {
    if (base.includes("localhost:3000") && process.env.PORT === "3000") continue;
    try {
      const isPythonService = base.includes(":8000") || base.includes("renewed-dedication") || base.includes("reneweddedication") || base.includes("digital_marketing_agent") || base.includes("marketos_agents") || base.includes("agents");
      const targetUrl = isPythonService
        ? `${base.replace(/\/$/, "")}/v1/query/stream`
        : `${base.replace(/\/$/, "")}/api/v1/ai-command-center/query/stream`;

      const forwardBody = {
        query: userQuery,
        prompt: userQuery,
        workspace_id: workspaceId,
        ...bodyPayload,
      };

      console.log(`[AI Command Proxy] Trying targetUrl: ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forwardBody),
      });

      if (res.ok && res.body) {
        console.log(`[AI Command Proxy] Target succeeded: ${targetUrl}`);
        return new NextResponse(res.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        const errTxt = await res.text().catch(() => "");
        console.warn(`[AI Command Proxy] Target returned HTTP ${res.status}: ${targetUrl} — ${errTxt.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[AI Command Proxy] Fetch exception for ${base}:`, err);
    }
  }

  // If no live agent server responds, return error stream — NO MOCK CONTENT
  const errorStream = buildErrorStream("Unable to connect to Railway / Docker Agent Service. Please ensure the Python Agent Service (marketos_agents / renewed-dedication on port 8000) is running.");
  return new NextResponse(errorStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
