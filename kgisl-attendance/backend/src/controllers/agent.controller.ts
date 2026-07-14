import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { endSession, getActiveSession, pauseSession, resumeSession, startSession } from '../services/session.service';
import { markManualAttendance } from '../services/attendance.service';

type Draft = {
  facultyId?: string; facultyName?: string;
  subjectId?: string; subjectName?: string;
  batchId?: string; batchName?: string;
  roomId?: string; roomName?: string;
  dayOfWeek?: number; dayName?: string;
  startTime?: string; endTime?: string;
  awaitingConfirmation?: boolean;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const keyFor = (id: string) => `agent:draft:${id}`;
const opKeyFor = (id: string) => `agent:operation:${id}`;
type PendingOperation = { type: string; targetId?: string; targetName?: string; sessionId?: string; allocationId?: string; subjectId?: string; roomId?: string; batchId?: string; rollNo?: string; status?: 'APPROVED' | 'REJECTED' };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function findMention<T extends { id: string; name: string }>(message: string, rows: T[]) {
  const compact = normalize(message);
  return rows.find((row) => {
    const name = normalize(row.name);
    const first = normalize(row.name.split(/\s+/)[0]);
    return compact.includes(name) || (first.length >= 4 && compact.includes(first));
  });
}

function parseDay(message: string) {
  const lower = message.toLowerCase();
  const index = DAYS.findIndex((day) => lower.includes(day.toLowerCase()));
  return index >= 0 ? { dayOfWeek: index + 1, dayName: DAYS[index] } : {};
}

function parseTime(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('after lunch') || lower.includes('lunch hour ku aprom') || lower.includes('lunch ku aprom')) {
    return { startTime: '13:40', endTime: '14:30' };
  }
  const matches = [...lower.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g)];
  if (!matches.length) return {};
  const to24 = (match: RegExpMatchArray) => {
    let hour = Number(match[1]); const minute = match[2] || '00';
    if (match[3] === 'pm' && hour < 12) hour += 12;
    if (match[3] === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  };
  const startTime = to24(matches[0]);
  const endTime = matches[1] ? to24(matches[1]) : undefined;
  return { startTime, ...(endTime ? { endTime } : {}) };
}

async function enrichDraft(message: string, current: Draft): Promise<Draft> {
  const [faculty, subjects, batches, rooms] = await Promise.all([
    prisma.faculty.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.subject.findMany({ select: { id: true, name: true, code: true } }),
    prisma.batch.findMany({ select: { id: true, name: true } }),
    prisma.room.findMany({ select: { id: true, name: true } }),
  ]);
  const facultyMatch = findMention(message, faculty);
  const subjectMatch = subjects.find((row) => normalize(message).includes(normalize(row.code))) || findMention(message, subjects);
  const batchMatch = findMention(message, batches);
  const roomMatch = findMention(message, rooms);
  return {
    ...current,
    ...(facultyMatch ? { facultyId: facultyMatch.id, facultyName: facultyMatch.name } : {}),
    ...(subjectMatch ? { subjectId: subjectMatch.id, subjectName: `${subjectMatch.code} - ${subjectMatch.name}` } : {}),
    ...(batchMatch ? { batchId: batchMatch.id, batchName: batchMatch.name } : {}),
    ...(roomMatch ? { roomId: roomMatch.id, roomName: roomMatch.name } : {}),
    ...parseDay(message), ...parseTime(message),
  };
}

function missingReply(draft: Draft) {
  const missing: string[] = [];
  if (!draft.facultyId) missing.push('faculty name');
  if (!draft.dayOfWeek) missing.push('day');
  if (!draft.startTime) missing.push('start time');
  if (!draft.endTime) missing.push('end time');
  if (!draft.subjectId) missing.push('subject/code');
  if (!draft.batchId) missing.push('class/section');
  if (!draft.roomId) missing.push('room');
  return missing;
}

function summary(d: Draft) {
  return `Please confirm this assignment:\n- Faculty: ${d.facultyName}\n- Day: ${d.dayName}\n- Time: ${d.startTime} - ${d.endTime}\n- Subject: ${d.subjectName}\n- Section: ${d.batchName}\n- Room: ${d.roomName}\n\nType Confirm to create it, or Cancel.`;
}

async function executePendingOperation(req: Request, res: Response, op: PendingOperation) {
  const ctx = requestContext(req);
  let reply = 'Done.';
  if (op.type === 'DEACTIVATE_FACULTY') { await prisma.faculty.update({ where: { id: op.targetId! }, data: { isActive: false } }); reply = `${op.targetName} was removed from active faculty accounts.`; }
  if (op.type === 'DEACTIVATE_STUDENT') { await prisma.student.update({ where: { id: op.targetId! }, data: { isActive: false } }); reply = `${op.targetName} was removed from active student accounts.`; }
  if (op.type === 'PAUSE_SESSION') { await pauseSession(op.sessionId!, req.auth!.sub); reply = 'Your active attendance session was paused.'; }
  if (op.type === 'RESUME_SESSION') { await resumeSession(op.sessionId!, req.auth!.sub); reply = 'Your attendance session was resumed and a fresh QR was generated.'; }
  if (op.type === 'END_SESSION') { await endSession(op.sessionId!, req.auth!.sub); reply = 'Your attendance session was ended.'; }
  if (op.type === 'START_SESSION') { await startSession({ facultyId: req.auth!.sub, allocationId: op.allocationId!, subjectId: op.subjectId!, roomId: op.roomId!, batchId: op.batchId! }); reply = 'Your assigned attendance session was started and the QR is ready.'; }
  if (op.type === 'MANUAL_ATTENDANCE') { await markManualAttendance({ sessionId: op.sessionId!, rollNo: op.rollNo!, facultyId: req.auth!.sub }); reply = `Attendance was marked for ${op.rollNo}.`; }
  if (op.type === 'REVIEW_LEAVE') {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: op.targetId! }, include: { student: true } });
    if (!leave || leave.status !== 'PENDING') throw new Error('Leave request is no longer pending.');
    if (req.auth!.role === 'FACULTY') {
      const owns = await prisma.timetableAllocation.findFirst({ where: { facultyId: req.auth!.sub, batchId: leave.student.batchId } });
      if (!owns) throw new Error('You cannot review this section.');
    }
    await prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: op.status!, reviewNote: 'Reviewed through Operations Agent', reviewedBy: req.auth!.sub, reviewedAt: new Date() } });
    if (op.status === 'APPROVED') {
      const end = new Date(leave.toDate); end.setHours(23, 59, 59, 999);
      const sessions = await prisma.attendanceSession.findMany({ where: { batchId: leave.student.batchId, startedAt: { gte: leave.fromDate, lte: end } }, select: { sessionId: true } });
      const attendanceStatus = leave.type === 'ON_DUTY' ? 'ON_DUTY' : 'LEAVE';
      for (const session of sessions) await prisma.attendanceRecord.upsert({ where: { uq_student_session: { studentId: leave.studentId, sessionId: session.sessionId } }, update: { status: attendanceStatus }, create: { studentId: leave.studentId, sessionId: session.sessionId, status: attendanceStatus, gpsLat: 0, gpsLng: 0, deviceId: 'AGENT_APPROVED_REQUEST', locationVerificationStatus: 'APPROVED_REQUEST' } });
    }
    reply = `${op.targetName}'s request was ${op.status!.toLowerCase()}.`;
  }
  await writeAuditLog({ actorId: req.auth!.sub, actorType: req.auth!.role, action: `AGENT_${op.type}`, ip: ctx.ip, userAgent: ctx.userAgent, metadata: op as any });
  res.json({ reply, action: 'completed' });
}

async function handleOperations(req: Request, res: Response, message: string): Promise<boolean> {
  const lower = message.toLowerCase().trim();
  const opKey = opKeyFor(req.auth!.sub);
  const pendingRaw = await redis.get(opKey);
  if (pendingRaw && (lower === 'confirm' || lower === 'yes confirm')) {
    const op: PendingOperation = JSON.parse(pendingRaw); await redis.del(opKey); await executePendingOperation(req, res, op); return true;
  }
  if (pendingRaw && lower === 'cancel') { await redis.del(opKey); res.json({ reply: 'The pending operation was cancelled.', action: 'cancelled' }); return true; }

  if (/how many|count|list/.test(lower) && lower.includes('faculty')) {
    const rows = await prisma.faculty.findMany({ where: { isActive: true }, select: { name: true, email: true }, orderBy: { name: 'asc' } });
    res.json({ reply: `${rows.length} active faculty accounts:\n${rows.map((r) => `- ${r.name} (${r.email})`).join('\n')}`, action: 'read' }); return true;
  }
  if (/how many|count/.test(lower) && lower.includes('student')) {
    const count = await prisma.student.count({ where: { isActive: true } }); res.json({ reply: `There are ${count} active student accounts.`, action: 'read' }); return true;
  }
  if (lower.includes('pending') && (lower.includes('leave') || lower.includes('od'))) {
    let where: any = { status: 'PENDING' };
    if (req.auth!.role === 'FACULTY') { const batches = await prisma.timetableAllocation.findMany({ where: { facultyId: req.auth!.sub }, select: { batchId: true }, distinct: ['batchId'] }); where.student = { batchId: { in: batches.map((b) => b.batchId) } }; }
    const rows = await prisma.leaveRequest.findMany({ where, include: { student: { include: { batch: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json({ reply: rows.length ? rows.map((r) => `- ${r.student.name} (${r.student.rollNo}), ${r.type}, ${r.student.batch.name}: ${r.reason}`).join('\n') : 'There are no pending leave or On Duty requests.', action: 'read' }); return true;
  }
  if (req.auth!.role === 'ADMIN' && /(delete|remove|deactivate).*(faculty)/.test(lower)) {
    const rows = await prisma.faculty.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true } });
    const target = rows.find((r) => lower.includes(r.email.toLowerCase())) || findMention(message, rows);
    if (!target) { res.json({ reply: 'Tell me the faculty name or exact email address to remove.', action: 'needs_input' }); return true; }
    const op = { type: 'DEACTIVATE_FACULTY', targetId: target.id, targetName: target.name }; await redis.set(opKey, JSON.stringify(op), 'EX', 600);
    res.json({ reply: `Confirm removal of faculty ${target.name} (${target.email}). Attendance history will remain safe. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
  }
  if (req.auth!.role === 'ADMIN' && /(delete|remove|deactivate).*(student)/.test(lower)) {
    const rows = await prisma.student.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, rollNo: true } });
    const compact = normalize(message); const target = rows.find((r) => compact.includes(normalize(r.email)) || compact.includes(normalize(r.rollNo))) || findMention(message, rows);
    if (!target) { res.json({ reply: 'Tell me the student name, roll number, or email address to remove.', action: 'needs_input' }); return true; }
    const op = { type: 'DEACTIVATE_STUDENT', targetId: target.id, targetName: `${target.name} (${target.rollNo})` }; await redis.set(opKey, JSON.stringify(op), 'EX', 600);
    res.json({ reply: `Confirm removal of ${op.targetName}. Attendance history will remain safe. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
  }
  if (/(approve|reject).*(leave|od|request)/.test(lower)) {
    const status = lower.includes('approve') ? 'APPROVED' : 'REJECTED';
    let where: any = { status: 'PENDING' };
    if (req.auth!.role === 'FACULTY') { const batches = await prisma.timetableAllocation.findMany({ where: { facultyId: req.auth!.sub }, select: { batchId: true }, distinct: ['batchId'] }); where.student = { batchId: { in: batches.map((b) => b.batchId) } }; }
    const rows = await prisma.leaveRequest.findMany({ where, include: { student: true } });
    const target = rows.find((r) => normalize(message).includes(normalize(r.student.rollNo))) || rows.find((r) => normalize(message).includes(normalize(r.student.name)));
    if (!target) { res.json({ reply: 'Tell me the student name or roll number for the pending request.', action: 'needs_input' }); return true; }
    const op: PendingOperation = { type: 'REVIEW_LEAVE', targetId: target.id, targetName: `${target.student.name} (${target.student.rollNo})`, status }; await redis.set(opKey, JSON.stringify(op), 'EX', 600);
    res.json({ reply: `Confirm: ${status === 'APPROVED' ? 'approve' : 'reject'} ${op.targetName}'s ${target.type} request. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
  }
  if (req.auth!.role === 'FACULTY') {
    const active = await getActiveSession(req.auth!.sub);
    if (lower.includes('my active session') || lower === 'session status') { res.json({ reply: active ? `${active.subject.code} for ${active.batch.name} is ${active.status} in ${active.room.name}.` : 'You do not have an active session.', action: 'read' }); return true; }
    const control = lower.includes('pause') ? 'PAUSE_SESSION' : lower.includes('resume') ? 'RESUME_SESSION' : lower.includes('end session') || lower.includes('stop session') ? 'END_SESSION' : null;
    if (control) {
      if (!active) { res.json({ reply: 'You do not have an active or paused session.', action: 'not_found' }); return true; }
      const op = { type: control, sessionId: active.sessionId }; await redis.set(opKey, JSON.stringify(op), 'EX', 600); res.json({ reply: `Confirm that you want to ${control.split('_')[0].toLowerCase()} your ${active.subject.code} session. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
    }
    if (/mark.*attendance/.test(lower)) {
      const roll = message.match(/\b\d{2}[A-Za-z]{2,5}\d{1,4}\b/)?.[0]?.toUpperCase();
      if (!active || !roll) { res.json({ reply: !active ? 'Start a session first.' : 'Tell me the student roll number.', action: 'needs_input' }); return true; }
      const op = { type: 'MANUAL_ATTENDANCE', sessionId: active.sessionId, rollNo: roll }; await redis.set(opKey, JSON.stringify(op), 'EX', 600); res.json({ reply: `Confirm manual attendance for ${roll}. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
    }
    if (/start.*(session|class)/.test(lower)) {
      const now = new Date(Date.now() + 330 * 60_000); const day = now.getUTCDay() || 7;
      const allocations = await prisma.timetableAllocation.findMany({ where: { facultyId: req.auth!.sub, dayOfWeek: day }, include: { subject: true, batch: true, room: true } });
      const target = allocations.find((a) => normalize(message).includes(normalize(a.subject.code))) || (allocations.length === 1 ? allocations[0] : undefined);
      if (!target) { res.json({ reply: allocations.length ? `Specify one of today's subjects: ${allocations.map((a) => a.subject.code).join(', ')}.` : 'You have no assigned class today.', action: 'needs_input' }); return true; }
      const op = { type: 'START_SESSION', allocationId: target.id, subjectId: target.subjectId, roomId: target.roomId, batchId: target.batchId }; await redis.set(opKey, JSON.stringify(op), 'EX', 600); res.json({ reply: `Confirm starting ${target.subject.code} for ${target.batch.name} in ${target.room.name}. Type Confirm or Cancel.`, action: 'confirm_required' }); return true;
    }
  }
  return false;
}

async function handleAdminAction(req: Request, res: Response, message: string): Promise<boolean> {
  const key = keyFor(req.auth!.sub);
  const saved = await redis.get(key);
  let draft: Draft = saved ? JSON.parse(saved) : {};
  const lower = message.trim().toLowerCase();
  if (lower === 'cancel') {
    await redis.del(key); res.json({ reply: 'The pending admin action was cancelled.', action: 'cancelled' }); return true;
  }
  if ((lower === 'confirm' || lower === 'yes confirm') && draft.awaitingConfirmation) {
    const conflict = await prisma.timetableAllocation.findFirst({
      where: { dayOfWeek: draft.dayOfWeek!, startTime: { lt: draft.endTime! }, endTime: { gt: draft.startTime! }, OR: [{ facultyId: draft.facultyId! }, { batchId: draft.batchId! }, { roomId: draft.roomId! }] },
      include: { faculty: true, batch: true, room: true },
    });
    if (conflict) {
      await redis.del(key);
      res.status(409).json({ reply: `I could not assign it because ${conflict.faculty.name}, ${conflict.batch.name}, or ${conflict.room.name} already has a class from ${conflict.startTime} to ${conflict.endTime}.`, action: 'conflict' }); return true;
    }
    const created = await prisma.timetableAllocation.create({ data: { facultyId: draft.facultyId!, subjectId: draft.subjectId!, batchId: draft.batchId!, roomId: draft.roomId!, dayOfWeek: draft.dayOfWeek!, startTime: draft.startTime!, endTime: draft.endTime! } });
    await redis.del(key);
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: 'ADMIN', action: 'AGENT_TIMETABLE_ASSIGNED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { allocationId: created.id, ...draft } });
    res.json({ reply: `Done. ${draft.facultyName} was assigned to ${draft.subjectName} for ${draft.batchName} on ${draft.dayName}, ${draft.startTime} - ${draft.endTime}, in ${draft.roomName}.`, action: 'created', data: created }); return true;
  }

  const isNewAssignment = /(assign|schedule|allocate).*(session|class|period)|(?:session|class|period).*(assign|schedule|allocate)/i.test(message);
  if (!saved && !isNewAssignment) return false;
  draft = await enrichDraft(message, draft);
  const missing = missingReply(draft);
  if (missing.length) {
    draft.awaitingConfirmation = false;
    await redis.set(key, JSON.stringify(draft), 'EX', 600);
    res.json({ reply: `I can do that. I still need: ${missing.join(', ')}. Send those details in one message.`, action: 'needs_input', missing }); return true;
  }
  draft.awaitingConfirmation = true;
  await redis.set(key, JSON.stringify(draft), 'EX', 600);
  res.json({ reply: summary(draft), action: 'confirm_required', draft }); return true;
}

export async function handleAgentChat(req: Request, res: Response): Promise<void> {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 500) { res.status(400).json({ reply: 'Please provide a valid message under 500 characters.' }); return; }
    if (await handleOperations(req, res, message)) return;
    if (req.auth!.role === 'ADMIN' && await handleAdminAction(req, res, message)) return;
    const lower = message.toLowerCase();
    if (lower.includes('active') && lower.includes('session')) {
      const sessions = await prisma.attendanceSession.findMany({ where: { status: 'ACTIVE' }, include: { subject: true, batch: true, room: true, faculty: true } });
      res.json({ reply: sessions.length ? sessions.map((s) => `${s.subject.name} - ${s.batch.name}, ${s.room.name}, ${s.faculty.name}`).join('\n') : 'There are currently no active sessions.' }); return;
    }
    res.json({ reply: req.auth!.role === 'ADMIN'
      ? 'I can manage timetable assignments, list or remove faculty/students, review leave and On Duty requests, show active sessions, and answer operational counts. All write actions require confirmation.'
      : 'I can start, pause, resume or end your session, mark manual attendance, review leave requests for your sections, and show session status. All write actions require confirmation.' });
  } catch (error: any) {
    logger.error('Agent chat error', { error: error.message });
    res.status(500).json({ reply: 'I could not complete that request. Please try again.' });
  }
}
