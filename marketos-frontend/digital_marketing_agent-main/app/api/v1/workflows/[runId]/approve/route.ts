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

export async function POST(req: NextRequest, { params }: { params: { runId: string } }) {
  const runId = params.runId;
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (_e) {}

  for (const base of BACKEND_CANDIDATES) {
    if (base.includes("localhost:3000") && process.env.PORT === "3000") continue;
    try {
      const targetUrl = `${base.replace(/\/$/, "")}/api/v1/workflows/${runId}/approve`;
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

  const payload = bodyText ? JSON.parse(bodyText) : {};
  return NextResponse.json({
    success: true,
    data: { id: runId, status: payload.decision === "approved" ? "running" : "failed" },
  });
}
