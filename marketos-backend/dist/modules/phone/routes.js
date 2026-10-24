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

// src/modules/phone/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.post("/verify", async (req, res) => {
  const { accountSid, authToken, phoneNumber } = req.body;
  if (!accountSid || !authToken) {
    return res.status(400).json({
      success: false,
      error: "accountSid and authToken are required"
    });
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
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: errData.message || `Twilio authentication failed (HTTP ${accountRes.status})`,
        code: accountRes.status
      });
    }
    const accountData = await accountRes.json();
    let phoneVerified = false;
    let phoneFriendlyName = phoneNumber;
    if (phoneNumber) {
      try {
        const phoneRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );
        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const numbers = phoneData.incoming_phone_numbers || [];
          phoneVerified = numbers.length > 0;
          if (phoneVerified) {
            phoneFriendlyName = numbers[0].friendly_name || phoneNumber;
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
        type: accountData.type,
        dateCreated: accountData.date_created
      },
      phone: phoneNumber ? {
        number: phoneNumber,
        friendlyName: phoneFriendlyName,
        verifiedOnAccount: phoneVerified
      } : null
    });
  } catch (err) {
    console.error("[Phone/Verify] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router.post("/call", async (req, res) => {
  const { accountSid, authToken, from, to, url } = req.body;
  if (!accountSid || !authToken || !from || !to) {
    return res.status(400).json({
      success: false,
      error: "accountSid, authToken, from, and to are required"
    });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const twimlUrl = url || "http://demo.twilio.com/docs/voice.xml";
    const body = new URLSearchParams({ To: to, From: from, Url: twimlUrl });
    const callRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );
    const callData = await callRes.json();
    if (!callRes.ok) {
      return res.status(callRes.status).json({
        success: false,
        error: callData.message || `Twilio call failed (HTTP ${callRes.status})`,
        twilioCode: callData.code
      });
    }
    return res.json({
      success: true,
      call: {
        sid: callData.sid,
        status: callData.status,
        to: callData.to,
        from: callData.from,
        direction: callData.direction,
        dateCreated: callData.date_created
      }
    });
  } catch (err) {
    console.error("[Phone/Call] Error:", err);
    return res.status(502).json({
      success: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router.get("/status", async (req, res) => {
  const { accountSid, authToken } = req.query;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!accountRes.ok) {
      return res.status(401).json({ success: false, connected: false, error: "Invalid credentials" });
    }
    const data = await accountRes.json();
    return res.json({
      success: true,
      connected: true,
      account: {
        sid: data.sid,
        friendlyName: data.friendly_name,
        status: data.status
      }
    });
  } catch (err) {
    return res.status(502).json({ success: false, connected: false, error: err.message });
  }
});
var routes_default = router;
