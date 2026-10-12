import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import {
  listSubjects, listRooms, listBatches, createBatch, updateBatch, createSubject, updateSubject,
  createRoom, updateRoom, listBeacons, createBeacon, updateBeacon,
} from '../services/catalog.service';
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
const subjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
});
const roomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  geofenceRadiusM: z.coerce.number().int().min(10).max(2000).default(env.DEFAULT_GEOFENCE_RADIUS_M),
});
const beaconSchema = z.object({
  beaconId: z.coerce.number().int().min(1).max(65535),
  name: z.string().trim().min(2).max(100),
  roomId: z.string().uuid(),
  enabled: z.boolean().default(true),
}).strict();
const retrieveSchema = z.object({ completionDate: z.coerce.date() });

/** `GET` handlers that return one collection, and `POST`/`PATCH` handlers that parse a body and call the service. */
const handle = (run: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: await run(req) });
    } catch (err) {
      next(err);
    }
  };

export const listSubjectsHandler = handle(() => listSubjects());
export const listRoomsHandler = handle(() => listRooms());
export const listBeaconsHandler = handle(() => listBeacons());
export const listBatchesHandler = handle((req) => listBatches(req.auth!.role as 'ADMIN' | 'FACULTY', req.auth!.sub));

export const createBatchHandler = handle((req) => createBatch(batchSchema.parse(req.body)), 201);
export const updateBatchHandler = handle((req) => updateBatch(req.params.id, batchSchema.parse(req.body)));
export const createSubjectHandler = handle((req) => createSubject(subjectSchema.parse(req.body)), 201);
export const updateSubjectHandler = handle((req) => updateSubject(req.params.id, subjectSchema.parse(req.body)));
export const createRoomHandler = handle((req) => createRoom(roomSchema.parse(req.body)), 201);
export const updateRoomHandler = handle((req) => updateRoom(req.params.id, roomSchema.parse(req.body)));
export const createBeaconHandler = handle((req) => createBeacon(beaconSchema.parse(req.body)), 201);
export const updateBeaconHandler = handle((req) => updateBeacon(req.params.id, beaconSchema.parse(req.body)));

export async function approveBatchArchiveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch || batch.lifecycle !== 'ARCHIVE_PENDING') {
      res.status(409).json({ success: false, message: 'Batch is not waiting for archive approval' });
      return;
    }
    const archivedAt = new Date();
    await prisma.$transaction([
      // Passed-out students lose their device binding with their account, so no orphaned passkeys remain.
      prisma.studentPasskey.deleteMany({ where: { student: { batchId: batch.id } } }),
      prisma.student.updateMany({ where: { batchId: batch.id }, data: { archivedAt, isActive: false, deviceId: null } }),
      prisma.batch.update({ where: { id: batch.id }, data: { lifecycle: 'ARCHIVED', archivedAt } }),
    ]);
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: 'ADMIN', action: 'BATCH_ARCHIVE_APPROVED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { batchId: batch.id, batchName: batch.name } });
    res.json({ success: true, message: `${batch.name} moved to the passed-out database.` });
  } catch (err) { next(err); }
}

export async function retrieveBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { completionDate } = retrieveSchema.parse(req.body);
    if (completionDate <= new Date()) {
      res.status(400).json({ success: false, message: 'New completion date must be in the future' });
      return;
    }
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch || batch.lifecycle !== 'ARCHIVED') {
      res.status(409).json({ success: false, message: 'Only an archived batch can be retrieved' });
      return;
    }
    await prisma.$transaction([
      prisma.student.updateMany({ where: { batchId: batch.id }, data: { archivedAt: null, isActive: true } }),
      prisma.batch.update({ where: { id: batch.id }, data: { lifecycle: 'ACTIVE', completionDate, archivedAt: null, archiveRequestedAt: null } }),
    ]);
    const ctx = requestContext(req);
    await writeAuditLog({ actorId: req.auth!.sub, actorType: 'ADMIN', action: 'BATCH_RETRIEVED', ip: ctx.ip, userAgent: ctx.userAgent, metadata: { batchId: batch.id, completionDate: completionDate.toISOString() } });
    res.json({ success: true, message: `${batch.name} restored to current students.` });
  } catch (err) { next(err); }
}
