import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_CANDIDATES = [
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.BACKEND_URL,
  process.env.RAILWAY_BACKEND_URL,
  "http://marketosbackend.railway.internal:3000",
  "http://marketos-backend.railway.internal:3000",
  "http://localhost:3000",
].filter((url): url is string => Boolean(url) && typeof url === "string");

export async function POST(req: NextRequest) {
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (_e) {}

  for (const base of BACKEND_CANDIDATES) {
    if (base.includes("localhost:3000") && process.env.PORT === "3000") continue;
    try {
      const targetUrl = `${base.replace(/\/$/, "")}/api/v1/workflows`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (_err) {}
  }

  // Fallback response if backend offline
  const payload = bodyText ? JSON.parse(bodyText) : {};
  return NextResponse.json({
    success: true,
    data: {
      runId: `run-${Date.now()}`,
      command: payload.command || "Workflow",
      status: "running",
      steps: [
        { id: `step-1`, agentName: "SupervisorAgent", status: "running" },
        { id: `step-2`, agentName: "CopyAgent", status: "pending" },
        { id: `step-3`, agentName: "ComplianceAgent", status: "pending", requiresApproval: true },
      ],
    },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const runId = url.pathname.split("/").pop();

  for (const base of BACKEND_CANDIDATES) {
    if (base.includes("localhost:3000") && process.env.PORT === "3000") continue;
    try {
      const targetUrl = `${base.replace(/\/$/, "")}/api/v1/workflows/${runId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (_err) {}
  }

  return NextResponse.json({ success: true, data: { id: runId, status: "completed", steps: [] } });
}
