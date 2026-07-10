"use client";

import React from "react";

export default function ApiDocsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const docsUrl = apiBase.replace(/\/$/, "") + "/api-docs";

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-black">API Documentation</h1>
      <p className="mt-2 text-sm text-black/70">Embedded Swagger UI from: {docsUrl}</p>

      <div className="mt-4 h-[75vh] w-full border-[3px] border-black shadow-[2px_2px_0_0_#000]">
        <iframe
          src={docsUrl}
          title="API Docs"
          style={{ width: "100%", height: "100%", border: "0" }}
        />
      </div>

      <div className="mt-3">
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Open API docs in a new tab
        </a>
      </div>

      <p className="mt-3 text-xs text-black/60">
        If the iframe is blocked, ensure your backend allows framing (no X-Frame-Options deny) or
        set `NEXT_PUBLIC_API_BASE_URL` to the exact docs URL.
      </p>
    </div>
  );
}
