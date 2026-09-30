import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/v1/phone/verify
 * Verifies Twilio credentials server-side by calling the Twilio REST API.
 * Body: { accountSid, authToken, phoneNumber }
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { accountSid, authToken, phoneNumber } = req.body;

  if (!accountSid || !authToken) {
    return res.status(400).json({
      success: false,
      error: 'accountSid and authToken are required',
    });
  }

  if (!accountSid.startsWith('AC') || accountSid.length < 34) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Account SID format. Must start with AC and be 34 characters.',
    });
  }

  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // Verify credentials by fetching the Twilio account
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: (errData as any).message || `Twilio authentication failed (HTTP ${accountRes.status})`,
        code: accountRes.status,
      });
    }

    const accountData = await accountRes.json();

    // If a phone number was provided, verify it belongs to this account
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
          const numbers = (phoneData as any).incoming_phone_numbers || [];
          phoneVerified = numbers.length > 0;
          if (phoneVerified) {
            phoneFriendlyName = numbers[0].friendly_name || phoneNumber;
          }
        }
      } catch (_) {
        // Non-fatal — phone verification is optional
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
        dateCreated: accountData.date_created,
      },
      phone: phoneNumber
        ? {
            number: phoneNumber,
            friendlyName: phoneFriendlyName,
            verifiedOnAccount: phoneVerified,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[Phone/Verify] Error:', err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`,
    });
  }
});

/**
 * POST /api/v1/phone/call
 * Places an outbound voice call via Twilio.
 * Body: { accountSid, authToken, from, to, url (TwiML webhook) }
 */
router.post('/call', async (req: Request, res: Response) => {
  const { accountSid, authToken, from, to, url } = req.body;

  if (!accountSid || !authToken || !from || !to) {
    return res.status(400).json({
      success: false,
      error: 'accountSid, authToken, from, and to are required',
    });
  }

  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twimlUrl = url || 'http://demo.twilio.com/docs/voice.xml';

    const body = new URLSearchParams({ To: to, From: from, Url: twimlUrl });

    const callRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const callData = await callRes.json();

    if (!callRes.ok) {
      return res.status(callRes.status).json({
        success: false,
        error: (callData as any).message || `Twilio call failed (HTTP ${callRes.status})`,
        twilioCode: (callData as any).code,
      });
    }

    return res.json({
      success: true,
      call: {
        sid: (callData as any).sid,
        status: (callData as any).status,
        to: (callData as any).to,
        from: (callData as any).from,
        direction: (callData as any).direction,
        dateCreated: (callData as any).date_created,
      },
    });
  } catch (err: any) {
    console.error('[Phone/Call] Error:', err);
    return res.status(502).json({
      success: false,
      error: `Could not reach Twilio API: ${err.message}`,
    });
  }
});

/**
 * GET /api/v1/phone/status
 * Returns the status of the phone integration (account info).
 * Query: accountSid, authToken
 */
router.get('/status', async (req: Request, res: Response) => {
  const { accountSid, authToken } = req.query as Record<string, string>;

  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
  }

  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );

    if (!accountRes.ok) {
      return res.status(401).json({ success: false, connected: false, error: 'Invalid credentials' });
    }

    const data = await accountRes.json();
    return res.json({
      success: true,
      connected: true,
      account: {
        sid: (data as any).sid,
        friendlyName: (data as any).friendly_name,
        status: (data as any).status,
      },
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, connected: false, error: err.message });
  }
});

export default router;
