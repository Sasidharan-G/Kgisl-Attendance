import { env } from '../config/env';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(to: string, code: string) {
  const subject = 'KGiSL Attendance password reset code';
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>KGiSL Smart Attendance</h2><p>Your one-time password reset code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in ${Math.floor(env.PASSWORD_RESET_TTL_SECONDS / 60)} minutes. If you did not request it, ignore this email.</p><p>Never share this code with anyone.</p></div>`;
  if (env.BREVO_API_KEY) {
    const match = env.EMAIL_FROM.match(/^(.*?)\s*<([^>]+)>$/);
    const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { name: 'KGiSL Attendance', email: env.EMAIL_FROM.trim() };
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Brevo rejected reset email (${response.status})`);
    return true;
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000 });
    await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    return true;
  }
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === 'development') logger.info('[password-reset] development code generated', { email: to, code });
    else logger.error('[password-reset] RESEND_API_KEY is not configured');
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Email provider rejected reset email (${response.status})`);
  return true;
}
