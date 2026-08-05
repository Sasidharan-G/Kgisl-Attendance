import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listSubjects, listRooms, listBatches, createBatch, updateBatch, createSubject, updateSubject, createRoom, updateRoom } from '../services/catalog.service';
import { prisma } from '../config/prisma';
import { requestContext, writeAuditLog } from '../services/audit.service';

const batchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  programme: z.string().trim().min(2).max(50),
  semester: z.coerce.number().int().min(1).max(12),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Academic year must look like 2026-2027'),
  mentorId: z.string().uuid().nullable().optional(),
  completionDate: z.coerce.date().nullable().optional(),
});
const subjectSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(30).transform((v) => v.toUpperCase()) });
const roomSchema = z.object({
  name: z.string().trim().min(2).max(100), latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180),
  geofenceRadiusM: z.coerce.number().int().min(10).max(2000).default(120), wifiBssidWhitelist: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});

export async function listSubjectsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await listSubjects() });
  } catch (err) {
    next(err);
  }
}

export async function listRoomsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await listRooms() });
  } catch (err) {
    next(err);
  }
}

export async function listBatchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await listBatches(req.auth!.role as 'ADMIN' | 'FACULTY', req.auth!.sub) });
  } catch (err) {
    next(err);
  }
}

const retrieveSchema = z.object({ completionDate: z.coerce.date() });

export async function approveBatchArchiveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch || batch.lifecycle !== 'ARCHIVE_PENDING') { res.status(409).json({ success: false, message: 'Batch is not waiting for archive approval' }); return; }
    const archivedAt = new Date();
    await prisma.$transaction([
      prisma.student.updateMany({ where: { batchId: batch.id }, data: { archivedAt, isActive: false, deviceId: null } }),
      prisma.batch.update({ where: { id: batch.id }, data: { lifecycle: 'ARCHIVED', archivedAt } }),
    ]);
    const ctx = requestContext(req); await writeAuditLog({ actorId: req.auth!.sub, actorType: 'ADMIN', action: 'BATCH_ARCHIVE_APPROVED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { batchId: batch.id, batchName: batch.name } });
    res.json({ success: true, message: `${batch.name} moved to Passed Out Student Database.` });
  } catch (err) { next(err); }
}

export async function retrieveBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { completionDate } = retrieveSchema.parse(req.body);
    if (completionDate <= new Date()) { res.status(400).json({ success: false, message: 'New completion date must be in the future' }); return; }
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch || batch.lifecycle !== 'ARCHIVED') { res.status(409).json({ success: false, message: 'Only an archived batch can be retrieved' }); return; }
    await prisma.$transaction([
      prisma.student.updateMany({ where: { batchId: batch.id }, data: { archivedAt: null, isActive: true } }),
      prisma.batch.update({ where: { id: batch.id }, data: { lifecycle: 'ACTIVE', completionDate, archivedAt: null, archiveRequestedAt: null } }),
    ]);
    const ctx = requestContext(req); await writeAuditLog({ actorId: req.auth!.sub, actorType: 'ADMIN', action: 'BATCH_RETRIEVED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { batchId: batch.id, completionDate: completionDate.toISOString() } });
    res.json({ success: true, message: `${batch.name} restored to current students.` });
  } catch (err) { next(err); }
}

export async function createBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await createBatch(batchSchema.parse(req.body));
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function updateBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await updateBatch(req.params.id, batchSchema.parse(req.body));
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function createSubjectHandler(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await createSubject(subjectSchema.parse(req.body)) }); } catch (err) { next(err); } }
export async function updateSubjectHandler(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await updateSubject(req.params.id, subjectSchema.parse(req.body)) }); } catch (err) { next(err); } }
export async function createRoomHandler(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await createRoom(roomSchema.parse(req.body)) }); } catch (err) { next(err); } }
export async function updateRoomHandler(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await updateRoom(req.params.id, roomSchema.parse(req.body)) }); } catch (err) { next(err); } }
