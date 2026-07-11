import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ override: true });

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

  // Geofence / GPS settings
  DEFAULT_GEOFENCE_RADIUS_M: z.coerce.number().int().positive().default(120),
  // Reject scans whose GPS accuracy reading is worse than this threshold (metres).
  MAX_GPS_ACCURACY_METERS: z.coerce.number().int().positive().default(50),

  SCAN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  SCAN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Comma-separated list of allowed frontend origins, e.g.
  // "http://localhost:5173,https://attendance.kgisl-iim.ac.in"
  FRONTEND_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast — never boot with an invalid/missing security config.
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.FRONTEND_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
