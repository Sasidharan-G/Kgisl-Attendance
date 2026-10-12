import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function isEmailDeliveryConfigured() {
  return Boolean(env.BREVO_API_KEY || env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS));
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, provider: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${provider} rejected the e-mail (${response.status})`);
}

/** Sends one e-mail through whichever provider is configured: Brevo, SMTP or Resend (in that order). */
async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (env.BREVO_API_KEY) {
    const match = env.EMAIL_FROM.match(/^(.*?)\s*<([^>]+)>$/);
    const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { name: 'KGiSL Attendance', email: env.EMAIL_FROM.trim() };
    await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': env.BREVO_API_KEY }, { sender, to: [{ email: to }], subject, htmlContent: html }, 'Brevo');
    return;
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
    await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    return;
  }
  if (env.RESEND_API_KEY) {
    await postJson('https://api.resend.com/emails', { Authorization: `Bearer ${env.RESEND_API_KEY}` }, { from: env.EMAIL_FROM, to: [to], subject, html }, 'Resend');
    return;
  }
  throw new Error('E-mail delivery is not configured.');
}

function codeEmail(heading: string, intro: string, code: string, footer: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>KGiSL Smart Attendance</h2><p>${heading}</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>${intro}</p><p>${footer}</p></div>`;
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<boolean> {
  if (!isEmailDeliveryConfigured()) {
    // Without a mail provider the reset code is only visible to developers; administrators can issue codes by hand.
    if (env.NODE_ENV === 'development') logger.info('[password-reset] development code generated', { email: to, code });
    else logger.warn('[password-reset] no e-mail provider configured; the code was not delivered');
    return false;
  }
  const minutes = Math.floor(env.PASSWORD_RESET_TTL_SECONDS / 60);
  await sendMail(
    to,
    'KGiSL Attendance password reset code',
    codeEmail('Your one-time password reset code is:', `This code expires in ${minutes} minutes. If you did not request it, ignore this e-mail.`, code, 'Never share this code with anyone.')
  );
  return true;
}

export async function sendAdminLoginOtp(to: string, code: string): Promise<void> {
  await sendMail(
    to,
    'KGiSL Attendance admin sign-in code',
    codeEmail('Your admin sign-in code is:', 'This one-time code expires in 10 minutes. If this was not you, change your password and contact support.', code, '')
  );
}
