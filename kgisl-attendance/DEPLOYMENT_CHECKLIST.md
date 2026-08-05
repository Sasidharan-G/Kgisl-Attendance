# KGiSL Attendance - Deployment Checklist

## 1. Render environment variables

Configure these in the Render web service before deployment. Never commit real values.

- `DATABASE_URL` - Render PostgreSQL internal connection string
- `REDIS_URL` - Render Redis internal connection string
- `JWT_ACCESS_SECRET` - random secret, minimum 32 characters
- `JWT_REFRESH_SECRET` - separate random secret, minimum 32 characters
- `QR_HMAC_SECRET` - exactly 64 hexadecimal characters
- `ACOUSTIC_TOKEN_PEPPER` - independent random secret, minimum 32 characters; the Blueprint generates this automatically
- `ACOUSTIC_TOKEN_TTL_SECONDS` - `30`; keep this aligned with the acoustic broadcast refresh window
- `FRONTEND_ORIGINS` - `https://kgisl-attendance-1.onrender.com`
- `NODE_ENV` - `production`
- `EMAIL_FROM` - for example `KGiSL Attendance <noreply@attendance.yourdomain.com>`
- `BREVO_API_KEY` - Brevo transactional email API key (recommended for Render free services)
- `PASSWORD_RESET_TTL_SECONDS` - `600`
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 Web application Client ID used by the login page and backend ID-token verification
- `SMTP_HOST` - `smtp.gmail.com`
- `SMTP_PORT` - `465`
- `SMTP_SECURE` - `true`
- `SMTP_USER` - `25mca95@kgisliim.ac.in`
- `SMTP_PASS` - Google 16-character App Password (secret)
- `MAX_GPS_ACCURACY_METERS` - recommended `50`
- `DEFAULT_GEOFENCE_RADIUS_M` - campus-approved radius, currently recommended `120`
- `QR_REFRESH_INTERVAL_SECONDS` - recommended `10`

Generate `QR_HMAC_SECRET` locally with `openssl rand -hex 32`. Generate the two JWT secrets independently. Do not reuse any JWT, QR, or acoustic secret for another purpose. Rotating JWT secrets logs out existing users; rotating the QR or acoustic secret invalidates current broadcast tokens.

## 2. Password-reset email

1. Create a Resend account.
2. Add and verify the college-owned sending domain in Resend.
3. Add the DNS records shown by Resend.
4. Create a restricted production API key.
5. Set `RESEND_API_KEY` and `EMAIL_FROM` in Render.
6. Test one Faculty and one Student reset email after deployment.

Until a domain is verified, Resend test-mode recipient restrictions may apply.

### Current no-domain setup

This project is configured to use Google Workspace SMTP. Set `EMAIL_FROM` to `KGiSL Attendance <25mca95@kgisliim.ac.in>` and store the Google App Password only in Render as `SMTP_PASS`. Do not put it in Git, `.env.example`, screenshots, or chat. Gmail/Workspace sending limits apply.

Render free web services block outbound SMTP ports. For a free Render deployment, verify `25mca95@kgisliim.ac.in` as a Brevo sender and set `BREVO_API_KEY`; the application prioritizes Brevo's HTTPS API over SMTP. SMTP remains available for local or paid-host testing and fails fast instead of hanging requests.

## 2A. Google Sign-In

1. In Google Cloud Console, configure the OAuth consent screen.
2. Create an OAuth 2.0 Client ID with application type `Web application`.
3. Add `https://kgisl-attendance-1.onrender.com` under Authorized JavaScript origins.
4. Add the resulting public Client ID to Render as `GOOGLE_CLIENT_ID`; never add or expose a Google client secret because this flow does not use one.
5. Redeploy and verify Google sign-in separately for an existing Student, Faculty, and Admin email. Google login never auto-creates accounts; the verified Google email must already exist under the selected role.

## 3. Database

- Render startup automatically runs `prisma migrate deploy`.
- Every production schema change must be committed as a reviewed Prisma migration. CI verifies that all migrations apply cleanly to an empty PostgreSQL database inside the production image.
- Do not run `prisma db push` in production.
- Do not run `prisma:seed` on every deploy; it can restore initial credentials.
- Run the seed manually only for a brand-new empty database, then immediately replace default Admin/Faculty passwords.
- Use expand/contract migrations: add nullable columns or new tables first, deploy compatible code, backfill separately, and remove old columns only in a later release. This keeps the old Render instance compatible while the candidate instance migrates.
- Take a verified backup before any destructive migration and confirm all migrations show as applied before accepting traffic.

### Migration rollback rule

Render can roll the application image back, but it does not reverse PostgreSQL migrations. A rolled-back image must therefore remain compatible with the migrated schema. If a migration causes a production issue, stop new writes if necessary, roll back only to a schema-compatible image, and deploy a reviewed forward-fix migration. Restore a database backup only as a last resort because it discards writes made after the backup.

## 4. Backup workflow

Add repository secret `DATABASE_URL` in GitHub Actions. Use Render PostgreSQL's TLS-enabled external connection URL here; the internal hostname is reachable only from Render services. Restrict GitHub repository access because the dump contains production data.

The daily workflow creates a custom-format dump, verifies it with `pg_restore --list`, writes a SHA-256 checksum, and stores both as a private artifact for 7 days. Manually run it once, download the artifact, verify the checksum, and perform a restore drill into a disposable database before the first production release.

## 4A. CI-gated automatic deployment

- The production branch is `main`.
- `.github/workflows/ci.yml` runs for pull requests and every relevant push to `main`.
- Required checks are backend Prisma generation/build/tests, frontend typecheck/tests/build, and a production Docker build plus PostgreSQL/Redis readiness smoke test.
- `render.yaml` uses `autoDeployTrigger: checksPass`; Render deploys a `main` commit only after all checks for that commit pass.
- Link the Render Blueprint to this repository with Blueprint path `kgisl-attendance/render.yaml`. In the Render dashboard, confirm the web service branch is `main` and Auto-Deploy is **After CI Checks Pass** after syncing the Blueprint.
- Protect `main` in GitHub and require the CI jobs before merge. Do not configure a separate Render deploy hook for the same service, because that would bypass or duplicate the CI-gated deploy.

## 5. Render and application checks

- Health: `/health/live` returns HTTP 200
- Readiness: `/health/ready` reports Database and Redis as true
- Admin, Faculty and Student login work
- Faculty and Student forgot-password email, OTP and new login work
- Admin timetable upload and assignment work
- Faculty session start, QR refresh, pause, resume and end work
- Student camera permission, GPS accuracy and QR scan work on a real HTTPS mobile device
- Faculty acoustic broadcast and Student listen/decode work on the supported physical-device matrix
- Denied microphone permission and acoustic timeout clearly offer QR fallback
- QR failure still permits acoustic attendance, and failure of both methods still permits a Faculty manual Present override
- Faculty manual Absent correction works for a falsely or fraudulently marked student, with reason and audit history retained
- Repeating QR, acoustic, and manual actions never creates duplicate attendance rows
- Attendance reports, Leave/OD and audit logs work
- PWA install prompt and offline warning work

## 6. Final release order

1. Configure all Render and GitHub secrets, sync the Blueprint, and confirm CI-gated auto-deploy is enabled.
2. Open a pull request and wait for all CI jobs to pass.
3. Take and verify a database backup immediately before merging a migration release.
4. Merge the reviewed pull request into `main`; do not manually trigger a second deploy.
5. Confirm Render waits for GitHub checks, then watch the Docker build, migration, startup, and health-check logs.
6. Check `/health/live` and `/health/ready`; readiness must report both Database and Redis as true.
7. Run the Admin, Faculty, and Student smoke test.
8. Test password reset using real email delivery.
9. Test QR, acoustic listening, GPS, and both manual corrections on campus with supported physical devices.
10. If validation fails, stop the rollout and follow the migration rollback rule above; do not run `prisma db push` or seed production.
