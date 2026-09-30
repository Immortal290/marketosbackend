import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/v1/sms/verify
 * Verifies Twilio SMS credentials.
 * Body: { accountSid, authToken, fromNumber }
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { accountSid, authToken, fromNumber } = req.body;

  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
  }

  if (!accountSid.startsWith('AC') || accountSid.length < 34) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Account SID format. Must start with AC and be 34 characters.',
    });
  }

  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );

    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: (errData as any).message || `Authentication failed (HTTP ${accountRes.status})`,
      });
    }

    const accountData = await accountRes.json();

    // Check if the number supports SMS
    let smsCapable = false;
    let phoneDetails: any = null;

    if (fromNumber) {
      try {
        const phoneRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );

        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const numbers = (phoneData as any).incoming_phone_numbers || [];
          if (numbers.length > 0) {
            const num = numbers[0];
            smsCapable = num.capabilities?.sms === true;
            phoneDetails = {
              sid: num.sid,
              friendlyName: num.friendly_name,
              phoneNumber: num.phone_number,
              smsCapable: num.capabilities?.sms,
              voiceCapable: num.capabilities?.voice,
              mmsCapable: num.capabilities?.mms,
            };
          }
        }
      } catch (_) {}
    }

    return res.json({
      success: true,
      verified: true,
      account: {
        sid: (accountData as any).sid,
        friendlyName: (accountData as any).friendly_name,
        status: (accountData as any).status,
        type: (accountData as any).type,
      },
      phone: phoneDetails,
      smsCapable,
    });
  } catch (err: any) {
    console.error('[SMS/Verify] Error:', err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`,
    });
  }
});

/**
 * POST /api/v1/sms/send
 * Sends SMS message(s) via Twilio.
 * Body: { accountSid, authToken, from, to (string or array), body }
 */
router.post('/send', async (req: Request, res: Response) => {
  const { accountSid, authToken, from, to, body: messageBody } = req.body;

  if (!accountSid || !authToken || !from || !to || !messageBody) {
    return res.status(400).json({
      success: false,
      error: 'accountSid, authToken, from, to, and body are required',
    });
  }

  const recipients: string[] = Array.isArray(to)
    ? to
    : String(to).split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);

  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid recipient numbers provided' });
  }

  const maxRecipients = parseInt(process.env.MAX_RECIPIENTS || '100', 10);
  if (recipients.length > maxRecipients) {
    return res.status(400).json({
      success: false,
      error: `Too many recipients. Maximum is ${maxRecipients}.`,
    });
  }

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const results: Array<{ to: string; ok: boolean; sid?: string; status?: string; error?: string }> = [];

  for (const recipient of recipients) {
    try {
      const formBody = new URLSearchParams({
        To: recipient,
        From: from,
        Body: messageBody,
      });

      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody.toString(),
        }
      );

      const smsData = await smsRes.json();

      if (smsRes.ok && (smsData as any).sid) {
        results.push({
          to: recipient,
          ok: true,
          sid: (smsData as any).sid,
          status: (smsData as any).status,
        });
      } else {
        results.push({
          to: recipient,
          ok: false,
          error: (smsData as any).message || `HTTP ${smsRes.status}`,
        });
      }
    } catch (err: any) {
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
    results,
  });
});

/**
 * GET /api/v1/sms/messages
 * Lists recent SMS messages from this Twilio account.
 * Query: accountSid, authToken, limit (default 20)
 */
router.get('/messages', async (req: Request, res: Response) => {
  const { accountSid, authToken, limit = '20' } = req.query as Record<string, string>;

  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: 'accountSid and authToken are required' });
  }

  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const msgRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=${Math.min(parseInt(limit, 10), 50)}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );

    if (!msgRes.ok) {
      return res.status(msgRes.status).json({ success: false, error: 'Failed to fetch messages' });
    }

    const msgData = await msgRes.json();
    const messages = ((msgData as any).messages || []).map((m: any) => ({
      sid: m.sid,
      to: m.to,
      from: m.from,
      body: m.body,
      status: m.status,
      direction: m.direction,
      dateCreated: m.date_created,
      numSegments: m.num_segments,
    }));

    return res.json({ success: true, total: messages.length, messages });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
