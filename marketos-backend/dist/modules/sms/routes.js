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

// src/modules/sms/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.post("/verify", async (req, res) => {
  const { accountSid, authToken, fromNumber } = req.body;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  if (!accountSid.startsWith("AC") || accountSid.length < 34) {
    return res.status(400).json({
      success: false,
      error: "Invalid Account SID format. Must start with AC and be 34 characters."
    });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: errData.message || `Authentication failed (HTTP ${accountRes.status})`
      });
    }
    const accountData = await accountRes.json();
    let smsCapable = false;
    let phoneDetails = null;
    if (fromNumber) {
      try {
        const phoneRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );
        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const numbers = phoneData.incoming_phone_numbers || [];
          if (numbers.length > 0) {
            const num = numbers[0];
            smsCapable = num.capabilities?.sms === true;
            phoneDetails = {
              sid: num.sid,
              friendlyName: num.friendly_name,
              phoneNumber: num.phone_number,
              smsCapable: num.capabilities?.sms,
              voiceCapable: num.capabilities?.voice,
              mmsCapable: num.capabilities?.mms
            };
          }
        }
      } catch (_) {
      }
    }
    return res.json({
      success: true,
      verified: true,
      account: {
        sid: accountData.sid,
        friendlyName: accountData.friendly_name,
        status: accountData.status,
        type: accountData.type
      },
      phone: phoneDetails,
      smsCapable
    });
  } catch (err) {
    console.error("[SMS/Verify] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router.post("/send", async (req, res) => {
  const { accountSid, authToken, from, to, body: messageBody } = req.body;
  if (!accountSid || !authToken || !from || !to || !messageBody) {
    return res.status(400).json({
      success: false,
      error: "accountSid, authToken, from, to, and body are required"
    });
  }
  const recipients = Array.isArray(to) ? to : String(to).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: "No valid recipient numbers provided" });
  }
  const maxRecipients = parseInt(process.env.MAX_RECIPIENTS || "100", 10);
  if (recipients.length > maxRecipients) {
    return res.status(400).json({
      success: false,
      error: `Too many recipients. Maximum is ${maxRecipients}.`
    });
  }
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const results = [];
  for (const recipient of recipients) {
    try {
      const formBody = new URLSearchParams({
        To: recipient,
        From: from,
        Body: messageBody
      });
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formBody.toString()
        }
      );
      const smsData = await smsRes.json();
      if (smsRes.ok && smsData.sid) {
        results.push({
          to: recipient,
          ok: true,
          sid: smsData.sid,
          status: smsData.status
        });
      } else {
        results.push({
          to: recipient,
          ok: false,
          error: smsData.message || `HTTP ${smsRes.status}`
        });
      }
    } catch (err) {
      results.push({ to: recipient, ok: false, error: err.message });
    }
  }
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return res.json({
    success: true,
    sent,
    failed,
    total: recipients.length,
    results
  });
});
router.get("/messages", async (req, res) => {
  const { accountSid, authToken, limit = "20" } = req.query;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const msgRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=${Math.min(parseInt(limit, 10), 50)}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!msgRes.ok) {
      return res.status(msgRes.status).json({ success: false, error: "Failed to fetch messages" });
    }
    const msgData = await msgRes.json();
    const messages = (msgData.messages || []).map((m) => ({
      sid: m.sid,
      to: m.to,
      from: m.from,
      body: m.body,
      status: m.status,
      direction: m.direction,
      dateCreated: m.date_created,
      numSegments: m.num_segments
    }));
    return res.json({ success: true, total: messages.length, messages });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});
var routes_default = router;
