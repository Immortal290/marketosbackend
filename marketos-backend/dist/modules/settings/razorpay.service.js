"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/settings/razorpay.service.ts
var razorpay_service_exports = {};
__export(razorpay_service_exports, {
  RazorpayService: () => RazorpayService,
  razorpayService: () => razorpayService
});
module.exports = __toCommonJS(razorpay_service_exports);
var import_crypto = __toESM(require("crypto"));
var RazorpayService = class {
  keyId;
  keySecret;
  baseUrl = "https://api.razorpay.com/v1";
  constructor(keyId, keySecret) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || "rzp_test_TrhNQHCvgOMUn9";
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || "k811k53ViV7fAdern0v5vpAi";
  }
  getKeyId() {
    return this.keyId;
  }
  getAuthHeader() {
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }
  /**
   * Create a new Razorpay order
   */
  async createOrder(options) {
    const payload = {
      amount: Math.round(options.amount),
      currency: options.currency || "USD",
      receipt: options.receipt || `rcpt_${Date.now()}`,
      notes: options.notes || {}
    };
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.description || `Razorpay order creation failed with status ${res.status}`);
    }
    return await res.json();
  }
  /**
   * Cryptographically verify Razorpay payment HMAC SHA-256 signature
   */
  verifyPaymentSignature(options) {
    const { orderId, paymentId, signature } = options;
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = import_crypto.default.createHmac("sha256", this.keySecret).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Fetch payment details from Razorpay
   */
  async getPaymentDetails(paymentId) {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader()
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.description || `Failed to fetch payment details: ${res.status}`);
    }
    return await res.json();
  }
  /**
   * Verify Razorpay credentials validity
   */
  async verifyCredentials() {
    try {
      const res = await fetch(`${this.baseUrl}/payments?count=1`, {
        method: "GET",
        headers: {
          Authorization: this.getAuthHeader()
        }
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};
var razorpayService = new RazorpayService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RazorpayService,
  razorpayService
});
