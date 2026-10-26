import nodemailer from 'nodemailer';

export interface GmailVerificationResult {
  verified: true;
  gmailAddress: string;
}

export function createGmailSmtpTransport(
  gmailAddress: string,
  appPassword: string
) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: gmailAddress,
      pass: appPassword,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
}

export async function verifyGmailCredentials(
  gmailAddress: string,
  appPassword: string
): Promise<GmailVerificationResult> {
  if (typeof gmailAddress !== 'string') {
    throw new Error('A valid Gmail address is required');
  }

  if (typeof appPassword !== 'string') {
    throw new Error('A 16-character Gmail App Password is required');
  }

  const email = gmailAddress.trim().toLowerCase();
  const password = appPassword.replace(/\s/g, '');

  if (!/^[a-z0-9._%+-]+@(gmail\.com|googlemail\.com)$/.test(email)) {
    throw new Error('Enter a valid Gmail address');
  }

  if (!/^[a-zA-Z0-9]{16}$/.test(password)) {
    throw new Error('Enter a valid 16-character Gmail App Password');
  }

  const transporter = createGmailSmtpTransport(email, password);

  try {
    const verified = await transporter.verify();

    if (!verified) {
      throw new Error('SMTP verification unsuccessful');
    }

    return {
      verified: true,
      gmailAddress: email,
    };
  } catch {
    // Do not return raw SMTP errors that might contain sensitive data.
    throw new Error(
      'Gmail verification failed. Check your App Password and SMTP connectivity.'
    );
  } finally {
    transporter.close();
  }
}
