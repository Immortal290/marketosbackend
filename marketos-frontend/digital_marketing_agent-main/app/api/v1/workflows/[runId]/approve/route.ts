import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKENDS = [
  process.env.BACKEND_URL,
  process.env.RAILWAY_BACKEND_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
  "http://marketosbackend.railway.internal:3000",
  "http://marketos-backend.railway.internal:3000",
  "http://localhost:3001",
].filter((url): url is string => Boolean(url));

export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const authorization = req.headers.get("authorization");

  if (!authorization || !/^Bearer \S+$/.test(authorization)) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.runId)) {
    return NextResponse.json(
      { success: false, error: "Invalid workflow ID" },
      { status: 400 }
    );
  }

  const body = await req.text();

  for (const candidate of BACKENDS) {
    const base = candidate
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, "");

    if (base === "http://localhost:3000" &&
        process.env.PORT === "3000") {
      continue;
    }

    try {
      const response = await fetch(
        `${base}/api/v1/workflows/${encodeURIComponent(params.runId)}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
          },
          body,
          signal: AbortSignal.timeout(4000),
          cache: "no-store",
        }
      );

      return new NextResponse(await response.text(), {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "application/json",
        },
      });
    } catch {
      // Try the next configured backend only if unreachable.
    }
  }

  return NextResponse.json(
    { success: false, error: "Workflow backend unavailable" },
    { status: 502 }
  );
}