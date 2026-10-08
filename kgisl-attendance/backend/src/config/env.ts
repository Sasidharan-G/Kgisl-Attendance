import dotenv from 'dotenv';
import { z } from 'zod';

// Deployment/runtime environment variables must win over a local .env file.
dotenv.config();

const DEVELOPMENT_BEACON_TOKEN_PEPPER = 'development-only-beacon-token-pepper-do-not-use-in-production';
const DEVELOPMENT_BEACON_HMAC_SECRET = '11'.repeat(32);

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),

  // Separate secret so a leaked access-token key can't be used to mint refresh tokens.
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7), // 7 days

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Must be a 64-char hex string = 32 bytes = 256 bits
  QR_HMAC_SECRET: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'QR_HMAC_SECRET must be a 64-char hex string (256-bit)'),

  QR_REFRESH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  QR_CLOCK_SKEW_TOLERANCE_SECONDS: z.coerce.number().int().min(0).default(2),

  // Pepper for short BLE beacon bearer tokens. This must be independent from
  // the QR signing key so compromise of one channel does not expose the other.
  BEACON_TOKEN_PEPPER: z.string().min(32, 'BEACON_TOKEN_PEPPER must be at least 32 chars').optional(),
  BEACON_TOKEN_TTL_SECONDS: z.coerce.number().int().min(15).max(60).default(30),

  // Independent signing key for compact ESP32 BLE advertisements. Keeping it
  // separate limits the impact of a QR/token key compromise.
  BEACON_HMAC_SECRET: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'BEACON_HMAC_SECRET must be a 64-char hex string (256-bit)')
    .optional(),
  BEACON_PACKET_TTL_SECONDS: z.coerce.number().int().min(5).max(60).default(30),
  BEACON_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(0).max(10).default(3),
  // RSSI is supporting telemetry, not a cryptographic distance proof. The
  // conservative default rejects only extremely weak/out-of-room receptions.
  BEACON_MIN_RSSI_DBM: z.coerce.number().int().min(-127).max(-20).default(-95),

  // WebAuthn passkeys (Face ID / Touch ID). RP ID is the bare domain students open the site on
  // (e.g. kgisl-attendance-1.onrender.com); passkeys only work on HTTPS or localhost.
  WEBAUTHN_RP_ID: z.string().min(1).default('localhost'),
  WEBAUTHN_RP_NAME: z.string().min(1).default('KGiSL Attendance'),

  // Geofence / GPS settings
  DEFAULT_GEOFENCE_RADIUS_M: z.coerce.number().int().positive().default(120),
  // Reject scans whose GPS accuracy reading is worse than this threshold (metres).
  MAX_GPS_ACCURACY_METERS: z.coerce.number().int().positive().default(50),

  SCAN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  SCAN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Comma-separated list of allowed frontend origins, e.g.
  // "http://localhost:5173,https://attendance.kgisl-iim.ac.in"
  FRONTEND_ORIGINS: z.string().default('http://localhost:5173'),

  // Transactional email (Resend). Required in production for self-service password reset.
  RESEND_API_KEY: z.string().default(''),
  BREVO_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('KGiSL Attendance <onboarding@resend.dev>'),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(1800).default(600),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  // Public OAuth audience used to verify Google Identity Services ID tokens.
  GOOGLE_CLIENT_ID: z.string().default(''),

  // Online AI assistant. Keep disabled until an API key is configured.
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.6-luna'),
  AI_AGENT_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

}).superRefine((value, ctx) => {
  // Email delivery is optional at startup. The attendance portal remains
  // available until an administrator configures a mail provider.
  if (value.NODE_ENV === 'production' && !value.BEACON_TOKEN_PEPPER) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BEACON_TOKEN_PEPPER'], message: 'BEACON_TOKEN_PEPPER is required in production' });
  }
  if (value.NODE_ENV === 'production' && !value.BEACON_HMAC_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BEACON_HMAC_SECRET'], message: 'BEACON_HMAC_SECRET is required in production' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast — never boot with an invalid/missing security config.
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Local development stays zero-setup; production is rejected above unless
  // it supplies an independent secret.
  BEACON_TOKEN_PEPPER: parsed.data.BEACON_TOKEN_PEPPER ?? DEVELOPMENT_BEACON_TOKEN_PEPPER,
  BEACON_HMAC_SECRET: parsed.data.BEACON_HMAC_SECRET ?? DEVELOPMENT_BEACON_HMAC_SECRET,
};

export const allowedOrigins = env.FRONTEND_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
