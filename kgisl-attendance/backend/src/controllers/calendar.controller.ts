import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requestContext, writeAuditLog } from '../services/audit.service';
import { Errors } from '../utils/AppError';

const isRealDate = (value: string) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(isRealDate, 'Not a real calendar date');
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:30');

const eventSchema = z.object({
  date: dateOnly,
  title: z.string().trim().min(2).max(150),
  type: z.enum(['HOLIDAY', 'EXAM', 'EVENT', 'WORKING']).default('EVENT'),
  description: z.string().trim().max(300).default(''),
}).strict();
const bulkEventSchema = z.object({ events: z.array(eventSchema).min(1).max(500) }).strict();

const blockTestSchema = z.object({
  date: dateOnly,
  startTime: clockTime,
  endTime: clockTime,
  subjectCode: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  subjectName: z.string().trim().min(2).max(150),
  room: z.string().trim().min(1).max(100),
  /** null / omitted = every section. */
  batchId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => value.startTime < value.endTime, { message: 'End time must be after start time' });
const bulkBlockTestSchema = z.object({ tests: z.array(blockTestSchema).min(1).max(500) }).strict();

const rangeSchema = z.object({ from: dateOnly.optional(), to: dateOnly.optional() });

const toDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const fromDay = (value: Date) => value.toISOString().slice(0, 10);

function presentEvent(row: { id: string; date: Date; title: string; type: string; description: string }) {
  return { id: row.id, date: fromDay(row.date), title: row.title, type: row.type, description: row.description };
}

function presentBlockTest(row: {
  id: string; date: Date; startTime: string; endTime: string; subjectCode: string; subjectName: string; room: string;
  batchId: string | null; batch?: { name: string } | null;
}) {
  return {
    id: row.id,
    date: fromDay(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    room: row.room,
    batchId: row.batchId,
    batchName: row.batch?.name ?? null,
  };
}

export async function listEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    const rows = await prisma.calendarEvent.findMany({
      where: from || to ? { date: { ...(from && { gte: toDay(from) }), ...(to && { lte: toDay(to) }) } } : {},
      orderBy: [{ date: 'asc' }, { title: 'asc' }],
    });
    res.json({ success: true, data: rows.map(presentEvent) });
  } catch (err) { next(err); }
}

export async function createEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = eventSchema.parse(req.body);
    const row = await prisma.calendarEvent.create({
      data: { date: toDay(input.date), title: input.title, type: input.type, description: input.description, createdBy: req.auth!.sub },
    });
    res.status(201).json({ success: true, data: presentEvent(row) });
  } catch (err) { next(err); }
}

/** CSV import: rows that already exist (same date and title) are skipped so importing a file twice is harmless. */
export async function bulkCreateEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { events } = bulkEventSchema.parse(req.body);
    const dates = [...new Set(events.map((event) => event.date))].map(toDay);
    const existing = await prisma.calendarEvent.findMany({ where: { date: { in: dates } }, select: { date: true, title: true } });
    const known = new Set(existing.map((event) => `${fromDay(event.date)}|${event.title.toLowerCase()}`));
    const fresh = events.filter((event) => {
      const key = `${event.date}|${event.title.toLowerCase()}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await prisma.calendarEvent.createMany({
        data: fresh.map((event) => ({ date: toDay(event.date), title: event.title, type: event.type, description: event.description, createdBy: req.auth!.sub })),
      });
    }
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: req.auth!.role as 'ADMIN' | 'FACULTY', action: 'CALENDAR_EVENTS_IMPORTED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { added: fresh.length, skipped: events.length - fresh.length } });
    res.status(201).json({ success: true, data: { added: fresh.length, skipped: events.length - fresh.length } });
  } catch (err) { next(err); }
}

export async function deleteEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function listBlockTestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = rangeSchema.parse(req.query);
    let sectionFilter = {};
    if (req.auth!.role === 'STUDENT') {
      // A student sees tests for their own section plus tests that apply to everybody.
      const student = await prisma.student.findUnique({ where: { id: req.auth!.sub }, select: { batchId: true } });
      if (!student) throw Errors.STUDENT_NOT_FOUND();
      sectionFilter = { OR: [{ batchId: null }, { batchId: student.batchId }] };
    }
    const rows = await prisma.blockTest.findMany({
      where: { ...sectionFilter, ...(from || to ? { date: { ...(from && { gte: toDay(from) }), ...(to && { lte: toDay(to) }) } } : {}) },
      include: { batch: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ success: true, data: rows.map(presentBlockTest) });
  } catch (err) { next(err); }
}

export async function createBlockTestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = blockTestSchema.parse(req.body);
    const row = await prisma.blockTest.create({
      data: { ...input, date: toDay(input.date), batchId: input.batchId ?? null, createdBy: req.auth!.sub },
      include: { batch: { select: { name: true } } },
    });
    res.status(201).json({ success: true, data: presentBlockTest(row) });
  } catch (err) { next(err); }
}

export async function bulkCreateBlockTestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { tests } = bulkBlockTestSchema.parse(req.body);
    const dates = [...new Set(tests.map((test) => test.date))].map(toDay);
    const existing = await prisma.blockTest.findMany({ where: { date: { in: dates } }, select: { date: true, subjectCode: true, startTime: true, batchId: true } });
    const known = new Set(existing.map((test) => `${fromDay(test.date)}|${test.subjectCode}|${test.startTime}|${test.batchId ?? ''}`));
    const fresh = tests.filter((test) => {
      const key = `${test.date}|${test.subjectCode}|${test.startTime}|${test.batchId ?? ''}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await prisma.blockTest.createMany({
        data: fresh.map((test) => ({ ...test, date: toDay(test.date), batchId: test.batchId ?? null, createdBy: req.auth!.sub })),
      });
    }
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: req.auth!.role as 'ADMIN' | 'FACULTY', action: 'BLOCK_TESTS_IMPORTED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { added: fresh.length, skipped: tests.length - fresh.length } });
    res.status(201).json({ success: true, data: { added: fresh.length, skipped: tests.length - fresh.length } });
  } catch (err) { next(err); }
}

export async function deleteBlockTestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.blockTest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
}
