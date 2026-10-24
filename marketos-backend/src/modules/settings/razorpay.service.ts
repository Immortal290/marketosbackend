import crypto from 'crypto';

export interface RazorpayOrderOptions {
  amount: number; // in lowest currency unit, e.g. cents or paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayVerifyPaymentOptions {
  orderId: string;
  paymentId: string;
  signature: string;
}

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_TrhNQHCvgOMUn9';
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || 'k811k53ViV7fAdern0v5vpAi';
  }

  public getKeyId(): string {
    return this.keyId;
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Create a new Razorpay order
   */
  async createOrder(options: RazorpayOrderOptions): Promise<any> {
    const payload = {
      amount: Math.round(options.amount),
      currency: options.currency || 'USD',
      receipt: options.receipt || `rcpt_${Date.now()}`,
      notes: options.notes || {},
    };

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
  verifyPaymentSignature(options: RazorpayVerifyPaymentOptions): boolean {
    const { orderId, paymentId, signature } = options;
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Fetch payment details from Razorpay
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: this.getAuthHeader(),
      },
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
  async verifyCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/payments?count=1`, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
