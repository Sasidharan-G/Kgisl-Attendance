# KGiSL Attendance - Deployment Checklist

## 1. Render environment variables

Configure these in the Render web service before deployment. Never commit real values.

- `DATABASE_URL` - Render PostgreSQL internal connection string
- `REDIS_URL` - Render Redis internal connection string
- `JWT_ACCESS_SECRET` - random secret, minimum 32 characters
- `JWT_REFRESH_SECRET` - separate random secret, minimum 32 characters
- `QR_HMAC_SECRET` - exactly 64 hexadecimal characters
- `FRONTEND_ORIGINS` - `https://kgisl-attendance-1.onrender.com`
- `NODE_ENV` - `production`
- `EMAIL_FROM` - for example `KGiSL Attendance <noreply@attendance.yourdomain.com>`
- `PASSWORD_RESET_TTL_SECONDS` - `600`
- `SMTP_HOST` - `smtp.gmail.com`
- `SMTP_PORT` - `465`
- `SMTP_SECURE` - `true`
- `SMTP_USER` - `25mca95@kgisliim.ac.in`
- `SMTP_PASS` - Google 16-character App Password (secret)
- `MAX_GPS_ACCURACY_METERS` - recommended `50`
- `DEFAULT_GEOFENCE_RADIUS_M` - campus-approved radius, currently recommended `120`
- `QR_REFRESH_INTERVAL_SECONDS` - recommended `10`

Generate `QR_HMAC_SECRET` locally with `openssl rand -hex 32`. Generate the two JWT secrets independently. Rotating JWT secrets logs out existing users; rotating the QR secret invalidates current QR tokens.

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

## 3. Database

- Render startup automatically runs `prisma migrate deploy`.
- Do not run `prisma db push` in production.
- Do not run `prisma:seed` on every deploy; it can restore initial credentials.
- Run the seed manually only for a brand-new empty database, then immediately replace default Admin/Faculty passwords.
- Confirm all migrations show as applied before accepting traffic.

## 4. Backup workflow

Add repository secret `DATABASE_URL` in GitHub Actions. The daily workflow stores a private PostgreSQL dump artifact for 7 days. Manually run it once and verify that the artifact is created.

## 5. Render and application checks

- Health: `/health/live` returns HTTP 200
- Readiness: `/health/ready` reports Database and Redis as true
- Admin, Faculty and Student login work
- Faculty and Student forgot-password email, OTP and new login work
- Admin timetable upload and assignment work
- Faculty session start, QR refresh, pause, resume and end work
- Student camera permission, GPS accuracy and QR scan work on a real HTTPS mobile device
- Attendance reports, Leave/OD and audit logs work
- PWA install prompt and offline warning work

## 6. Final release order

1. Take a database backup.
2. Configure all Render and GitHub secrets.
3. Commit reviewed local changes.
4. Push the branch.
5. Watch the Render build and migration logs.
6. Check health/readiness.
7. Run the three-role smoke test.
8. Test password reset using real email delivery.
9. Test QR and GPS on campus with two physical devices.
