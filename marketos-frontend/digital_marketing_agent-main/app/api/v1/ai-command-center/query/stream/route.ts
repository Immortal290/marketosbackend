import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_CANDIDATES = [
  process.env.AGENT_SERVICE_URL,
  "http://marketos_agents:8000",
  "http://localhost:8000",
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

  let bodyPayload: {
    prompt?: string; query?: string;
    workspaceId?: string; workspace_id?: string;
    channels?: string[];
    recipient_email?: string; recipient_phone?: string;
  } = {};
  if (bodyText) {
    try { bodyPayload = JSON.parse(bodyText); } catch (_e) {}
  }

  const userQuery   = bodyPayload.query || bodyPayload.prompt || "";
  const workspaceId = bodyPayload.workspace_id || bodyPayload.workspaceId || "default";
  const channels    = bodyPayload.channels;

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

      console.log(`[AI Stream Proxy] Trying targetUrl: ${targetUrl}`);
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 4000);
      let res: Response;
      try {
        res = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forwardBody),
          signal: abortCtrl.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.ok && res.body) {
        console.log(`[AI Stream Proxy] Target succeeded: ${targetUrl}`);
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
        console.warn(`[AI Stream Proxy] Target returned HTTP ${res.status}: ${targetUrl} — ${errTxt.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[AI Stream Proxy] Fetch exception for ${base}:`, err);
    }
  }

  // No live agent server reachable
  console.error("[AI Stream Proxy] No live agent server reachable. All target URLs failed.");
  return new NextResponse(buildErrorStream("Failed to connect to AI Agent backend. Please ensure the backend is running and Docker Compose is configured correctly."), {
    status: 502,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
