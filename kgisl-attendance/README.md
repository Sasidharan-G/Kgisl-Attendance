# KGiSL-IIM Smart Attendance — Full Stack

Connected backend + frontend for the Dynamic QR Attendance module.

```
kgisl-attendance-fullstack/
├── docker-compose.yml    # Postgres + Redis for local dev
├── backend/              # Node/TypeScript API + Socket.IO + Redis + Prisma
└── frontend/             # React + Vite + Tailwind dashboard & scan app
```

## How they're connected

- **REST**: frontend calls `/api/v1/...` — in dev, Vite's proxy (`frontend/vite.config.js`)
  forwards these to `http://localhost:4000`. In production, put both behind
  the same reverse proxy (nginx/Caddy) so `/api` and `/socket.io` route to the
  backend and everything else serves the built frontend — the frontend code
  makes no assumption about absolute hostnames.
- **WebSocket**: `frontend/src/services/socket.js` connects to `/socket.io`
  with the logged-in user's JWT in the handshake (`auth: { token }`). The dev
  proxy forwards this too (`ws: true`) so `npm run dev` "just works" without
  any extra config.
- **CORS**: the backend only accepts the frontend origin(s) listed in
  `FRONTEND_ORIGINS` (`.env`) — defaults to `http://localhost:5173` for local
  dev. Update this before deploying anywhere else.
- **Auth**: `POST /api/v1/auth/faculty/login` and `/auth/student/login` issue
  a JWT the frontend stores and attaches as `Authorization: Bearer <token>`
  on every request and on the socket handshake.
- **Catalog**: the faculty dashboard's Subject/Batch/Room dropdowns are
  populated from `GET /api/v1/catalog/{subjects,rooms,batches}` — real
  UUIDs from Postgres, not placeholder labels — so "Start Session" sends IDs
  the backend can actually look up.
- **QR → scan loop**: dashboard opens a session → backend starts a 10s
  refresh loop pushing `qr_updated` over the session's Socket.IO room →
  student's camera decodes the QR → app looks up the session's batch/subject
  via `GET /sessions/:id/public` (the QR itself never carries that data,
  per spec) → submits `POST /api/v1/scan` with GPS → backend's 13-step
  validation pipeline → `attendance_marked` broadcast back to the dashboard.

## Run it end-to-end

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
# generate a real HMAC secret:
#   openssl rand -hex 32   -> paste into QR_HMAC_SECRET
# generate a JWT secret (32+ chars) into JWT_ACCESS_SECRET
# DATABASE_URL should read: postgresql://kgisl:kgisl@localhost:5432/kgisl_attendance
# REDIS_URL should read: redis://localhost:6379
npm install
npm run prisma:migrate     # creates tables
npm run prisma:seed        # creates sample faculty/students/subjects/rooms/batches
npm run dev                # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Then open **http://localhost:5173**:

- **Faculty**: `ravi.kumar@kgisl-iim.ac.in` / `Password@123` → Admin Portal →
  pick Subject/Batch/Room → Start Session → live QR appears.
- **Student**: `mca24001@students.kgisl-iim.ac.in` / `Password@123` → Student
  Portal → Start Scanning → point the camera at the faculty's QR (on a second
  device/browser window).

### Note on the geofence check

The seeded rooms use placeholder coordinates. If your test devices aren't
physically near those coordinates (or you're testing on localhost), scans
will correctly fail step 12 (`Validate Campus Geofence`) — that's the
security feature working as designed, not a bug. Update the lat/lng values
in `backend/prisma/seed.ts` to your actual location before testing, or widen
`geofenceRadiusM` temporarily.

## Production deployment (Render)

This repository is a monorepo whose Git root is one level above this application directory. Render must use `kgisl-attendance/render.yaml` as the Blueprint path; the web service intentionally keeps `rootDir: kgisl-attendance` so the existing Docker build context remains correct.

The production release path is:

1. Open a pull request and let GitHub Actions validate the backend, frontend, and production Docker image.
2. Merge into the protected `main` branch only after all checks pass.
3. Render's `autoDeployTrigger: checksPass` then builds and deploys that exact commit automatically.
4. The container applies committed Prisma migrations, starts the API, and must pass `/health/ready` before Render sends traffic to it.

Before the first deployment, sync the Blueprint and enter every `sync: false` secret in Render. Confirm that `ACOUSTIC_TOKEN_PEPPER` exists (the Blueprint can generate it), `ACOUSTIC_TOKEN_TTL_SECONDS` is `30`, and the deployed HTTPS origin exactly matches `FRONTEND_ORIGINS`. Microphone access for acoustic attendance requires HTTPS on physical mobile devices.

Do not use `prisma db push` or automatic seeding in production. Render application rollback does not undo database migrations, so use backward-compatible expand/contract migrations and take a verified database backup before destructive schema changes. The complete release, smoke-test, backup, and rollback procedure is in [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md).

## What's still a stub

- No admin UI for managing students/subjects/rooms/batches (only read-only
  list endpoints exist, enough to power the dashboard's dropdowns).
- Device-binding (`student.deviceId`) exists in the schema but isn't
  enforced in the validation pipeline yet — see the backend README's
  "production hardening" notes.
- Reports/Timetable/Students/Courses/Logs sidebar items are visual only
  (matching the reference dashboard) and aren't wired to real data.
