import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: "API key is required" }, { status: 400 });
    }

    let isValid = false;

    try {
      if (provider === "gemini") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        isValid = res.ok;
      } else if (provider === "openai" || provider === "dall-e") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        isValid = res.ok;
      } else if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: { 
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01" 
          },
        });
        // 404 is okay if models endpoint is disabled, but 401 is unauthorized
        isValid = res.status !== 401;
      } else if (provider === "groq") {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        isValid = res.ok;
      } else if (provider === "openrouter") {
        const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        isValid = res.ok;
      } else if (provider === "black-forest-labs") {
        // HuggingFace / BFL
        const res = await fetch("https://huggingface.co/api/whoami-v2", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        isValid = res.ok;
      } else {
        // Unknown provider, assume valid or perform regex?
        isValid = true;
      }
    } catch (e) {
      return NextResponse.json({ valid: false, error: "Network error during verification" }, { status: 500 });
    }

    if (isValid) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false, error: "Invalid API key" }, { status: 401 });
    }
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
