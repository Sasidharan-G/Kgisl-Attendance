# KGiSL‑IIM Smart Attendance — Dynamic QR Module

Enterprise-grade, security-first dynamic QR attendance backend for the MCA
Department's Smart Attendance system (matches the Attendance dashboard and
login portal screens).

## Stack

- **Node.js + TypeScript + Express** — API layer
- **Socket.IO** — real-time QR push / live stats (no page reloads)
- **PostgreSQL + Prisma** — durable, audit-grade storage
- **Redis (ioredis)** — active-token store with TTL auto-expiry + atomic single-use claim
- **JWT** — auth for faculty/student roles
- **Node `crypto`** — CSPRNG token generation + HMAC-SHA256 signing (equivalent
  security guarantee to Java's `SecureRandom`)

## Project structure

```
kgisl-attendance/
├── prisma/
│   └── schema.prisma            # attendance_session, attendance_qr_history, attendance_record, etc.
├── src/
│   ├── config/
│   │   ├── env.ts               # zod-validated env config (fails fast on boot)
│   │   ├── prisma.ts            # Prisma client singleton
│   │   └── redis.ts             # ioredis client + key conventions
│   ├── utils/
│   │   ├── crypto.ts            # SecureRandom token, UUID, nonce, SHA-256, HMAC sign/verify
│   │   ├── geo.ts               # haversine distance for geofence check
│   │   ├── logger.ts            # pino/winston structured logger
│   │   └── AppError.ts          # typed domain errors (one per validation failure)
│   ├── services/
│   │   ├── qr.service.ts        # generateNewQr() — the core "never reuse a token" logic
│   │   ├── session.service.ts   # start/end session, 10s refresh scheduler, stats
│   │   └── validation.service.ts# the 13-step scan validation pipeline
│   ├── websocket/
│   │   └── socket.ts            # JWT-authed Socket.IO, room-per-session broadcasts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rateLimiter.middleware.ts  # IP-level + per-student Redis rate limiting
│   │   └── errorHandler.middleware.ts
│   ├── controllers/ + routes/   # thin HTTP layer over the services above
│   ├── app.ts                   # Express app assembly
│   └── server.ts                # bootstrap: HTTP + WS server, session resume, sweeper
├── package.json
├── tsconfig.json
└── .env.example
```

## How the "never reuse a QR" guarantee is implemented

1. **Generation** (`qr.service.ts::generateNewQr`): every call does
   `crypto.randomBytes(32)` for a brand-new 256-bit token, a fresh `crypto.randomUUID()`
   nonce, current `issuedAt`/`expiresAt`, and an HMAC-SHA256 signature over all of it.
   Nothing is derived from the previous QR.
2. **Immediate invalidation of the old token**: before the new one is stored, the
   previous history row is marked `revoked + isExpired`, and the new token
   *overwrites* the single Redis key for that session — so at most one token is
   ever valid at a time.
3. **Storage discipline**: Postgres (`attendance_qr_history.token_hash`) only ever
   stores `SHA-256(token)`. The raw token lives only inside the signed QR payload
   and in Redis, which self-deletes via `PX` TTL exactly at `expiresAt`.
4. **Push, not poll**: `session.service.ts` runs a `setInterval` every
   `QR_REFRESH_INTERVAL_SECONDS` (default 30s) that generates a new QR and
   broadcasts it over the session's Socket.IO room — the frontend just swaps the
   `<img>` src and resets its countdown, no reload.
5. **Single-use enforcement**: scan validation uses a Lua script (`EVAL`) to
   atomically test-and-set a `<key>:used` marker in Redis, so two near-simultaneous
   scans of a shared screenshot can't both win the race. A Postgres unique
   constraint (`studentId + sessionId`) is the final backstop.

## The 13-step scan validation pipeline

`validation.service.ts::validateAndRecordScan` runs, in order, and throws a
specific typed error on first failure:

1. Validate Student exists
2. Validate Session exists & is Active
3. Validate QR Signature (HMAC-SHA256, constant-time compare)
4. Validate QR Expiry (server clock, small skew tolerance)
5. Validate Secure Token matches the currently active Redis entry
6. Validate Token Not Revoked (Postgres history)
7. Validate Token Not Previously Used (+ atomic Redis claim)
8. Validate Batch matches session's batch
9. Validate Subject matches session's subject
10. Validate Attendance Time / session still active
11. Validate GPS payload present
12. Validate Campus Geofence (haversine distance vs room radius)
13. Validate Duplicate Attendance (DB unique constraint)

Only after all 13 pass is the `attendance_record` row written, inside a Prisma
transaction alongside marking the QR history token as used.

## Setup

```bash
cp .env.example .env
# fill in DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET (32+ chars),
# and QR_HMAC_SECRET (generate with: openssl rand -hex 32)

npm install
npm run prisma:migrate     # creates tables
npm run dev                # local dev with hot reload
# or
npm run build && npm start # production
```

## Notes for production hardening

- Lock CORS / Socket.IO origins down to your actual campus domains (currently `*`
  for local dev convenience).
- Run Redis and Postgres with TLS + auth in production; rotate `QR_HMAC_SECRET`
  via a secrets manager, not `.env`.
- The in-memory `activeTimers` map in `session.service.ts` assumes a single
  Node process. For horizontal scaling, move the refresh scheduler to a
  dedicated worker with Redis-based leader election so only one instance drives
  the countdown per session.
- Add device-binding checks (`student.deviceId` vs incoming `deviceId`) at the
  controller layer if you want to hard-block QR sharing to a second phone.
