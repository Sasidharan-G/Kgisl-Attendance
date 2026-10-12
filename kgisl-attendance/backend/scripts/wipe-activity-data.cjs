// One-off cleanup before going live: removes attendance activity and login state, keeps accounts and timetable.
// Dry run by default; pass --yes to actually delete. Usage (from backend/):  node scripts/wipe-activity-data.cjs --yes
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apply = process.argv.includes('--yes');

(async () => {
  const host = (process.env.DATABASE_URL || '').replace(/^.*@/, '').split('/')[0];
  console.log(`Database host: ${host}`);
  const steps = [
    ['attendance_record', () => prisma.attendanceRecord],
    ['attendance_qr_history', () => prisma.attendanceQrHistory],
    ['attendance_correction_request', () => prisma.attendanceCorrectionRequest],
    ['leave_request', () => prisma.leaveRequest],
    ['attendance_session', () => prisma.attendanceSession],
    ['student_passkey', () => prisma.studentPasskey],
    ['audit_log', () => prisma.auditLog],
  ];
  for (const [name, model] of steps) {
    const count = await model().count();
    console.log(`${apply ? 'deleting' : 'would delete'} ${String(count).padStart(6)}  ${name}`);
  }
  if (!apply) { console.log('\nDry run only. Re-run with --yes to delete.'); return; }
  await prisma.$transaction(steps.map(([, model]) => model().deleteMany({})));
  const devices = await prisma.student.updateMany({ data: { deviceId: null } });
  console.log(`student device bindings cleared: ${devices.count}`);
  console.log('Done. Also flush Redis (refresh tokens) or just redeploy Render Redis: users must sign in again.');
})().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
