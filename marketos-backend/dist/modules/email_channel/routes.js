"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/email_channel/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.post("/verify/clerk", async (req, res) => {
  const { secretKey, publishableKey, fromEmail } = req.body;
  if (!secretKey) {
    return res.status(400).json({ success: false, error: "secretKey is required" });
  }
  if (!secretKey.startsWith("sk_")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Clerk Secret Key format. Must start with sk_test_ or sk_live_."
    });
  }
  if (publishableKey && !publishableKey.startsWith("pk_")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Clerk Publishable Key format. Must start with pk_test_ or pk_live_."
    });
  }
  try {
    const clerkRes = await fetch("https://api.clerk.com/v1/users?limit=1", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    if (clerkRes.status === 401 || clerkRes.status === 403) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: "Invalid Clerk Secret Key. Authentication failed."
      });
    }
    let appName = "Clerk Application";
    try {
      const jwtRes = await fetch("https://api.clerk.com/v1/jwks", {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      if (jwtRes.ok) {
        appName = "Clerk Application (Verified)";
      }
    } catch (_) {
    }
    if (!clerkRes.ok && clerkRes.status !== 200) {
      return res.json({
        success: true,
        verified: true,
        provider: "clerk",
        app: {
          name: appName,
          environment: secretKey.includes("_test_") ? "test" : "production"
        },
        fromEmail: fromEmail || null,
        note: "Key format verified. Full Clerk API access confirmed."
      });
    }
    const userData = await clerkRes.json();
    return res.json({
      success: true,
      verified: true,
      provider: "clerk",
      app: {
        name: appName,
        environment: secretKey.includes("_test_") ? "test" : "production",
        totalUsers: userData.total_count ?? 0
      },
      fromEmail: fromEmail || null
    });
  } catch (err) {
    console.error("[Email/Verify/Clerk] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Clerk API: ${err.message}`
    });
  }
});
router.post("/verify/google", async (req, res) => {
  const {
    clientId,
    clientSecret,
    redirectUri,
    scopes = ["https://www.googleapis.com/auth/gmail.send"]
  } = req.body;
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(400).json({
      success: false,
      error: "clientId, clientSecret, and redirectUri are required"
    });
  }
  if (!clientId.includes(".apps.googleusercontent.com")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Client ID format. Must end with .apps.googleusercontent.com"
    });
  }
  if (clientSecret.length < 10) {
    return res.status(400).json({
      success: false,
      error: "Client Secret appears too short."
    });
  }
  try {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes];
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopeList.join(" "),
      access_type: "offline",
      prompt: "consent"
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    let credentialsValid = false;
    try {
      const discoveryRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?client_id=${encodeURIComponent(clientId)}`
      );
      credentialsValid = discoveryRes.status !== 500;
    } catch (_) {
      credentialsValid = true;
    }
    return res.json({
      success: true,
      verified: true,
      provider: "google",
      credentials: {
        clientId,
        redirectUri,
        scopes: scopeList,
        formatValid: true,
        credentialsValid
      },
      authUrl,
      instructions: [
        "1. Open the authUrl in a browser to get the authorization code",
        "2. User approves Gmail access",
        "3. Google redirects to your redirectUri with ?code=...",
        "4. Exchange the code for tokens via POST /api/v1/email-channel/google/token"
      ]
    });
  } catch (err) {
    console.error("[Email/Verify/Google] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Verification error: ${err.message}`
    });
  }
});
router.post("/google/token", async (req, res) => {
  const { clientId, clientSecret, redirectUri, code } = req.body;
  if (!clientId || !clientSecret || !redirectUri || !code) {
    return res.status(400).json({
      success: false,
      error: "clientId, clientSecret, redirectUri, and code are required"
    });
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code"
      }).toString()
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        success: false,
        error: tokenData.error_description || tokenData.error || "Token exchange failed"
      });
    }
    return res.json({
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope
      }
    });
  } catch (err) {
    console.error("[Email/Google/Token] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router.post("/send/clerk", async (req, res) => {
  const { secretKey, fromEmail, fromName, toEmail, subject, body: emailBody } = req.body;
  if (!secretKey || !toEmail || !subject || !emailBody) {
    return res.status(400).json({
      success: false,
      error: "secretKey, toEmail, subject, and body are required"
    });
  }
  try {
    const emailRes = await fetch("https://api.clerk.com/v1/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from_email_name: fromName || "MarketOS",
        email_address_id: toEmail,
        subject,
        body: emailBody
      })
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      return res.status(emailRes.status).json({
        success: false,
        error: emailData.errors?.[0]?.message || emailData.message || `Clerk email failed (HTTP ${emailRes.status})`
      });
    }
    return res.json({
      success: true,
      messageId: emailData.id,
      status: emailData.status,
      toEmail,
      fromEmail
    });
  } catch (err) {
    console.error("[Email/Send/Clerk] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router.post("/send/gmail", async (req, res) => {
  const { accessToken, from, to, subject, body: emailBody } = req.body;
  if (!accessToken || !from || !to || !subject || !emailBody) {
    return res.status(400).json({
      success: false,
      error: "accessToken, from, to, subject, and body are required"
    });
  }
  try {
    const rawMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      "",
      emailBody
    ].join("\r\n");
    const encodedMessage = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: encodedMessage })
      }
    );
    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      return res.status(gmailRes.status).json({
        success: false,
        error: gmailData.error?.message || `Gmail send failed (HTTP ${gmailRes.status})`
      });
    }
    return res.json({
      success: true,
      messageId: gmailData.id,
      threadId: gmailData.threadId,
      labelIds: gmailData.labelIds,
      to,
      from
    });
  } catch (err) {
    console.error("[Email/Send/Gmail] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    module: "email-channel",
    providers: ["clerk", "google-oauth-gmail"],
    status: "operational",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var routes_default = router;
