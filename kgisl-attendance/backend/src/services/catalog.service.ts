import { prisma } from '../config/prisma';

/** Simple read-only lookups so the faculty dashboard can populate real
 * Subject/Room/Batch dropdowns with actual UUIDs instead of display labels.
 * Kept intentionally minimal — no create/update/delete here, that belongs to
 * a separate admin-management module outside this attendance-QR scope. */

export function listSubjects() {
  return prisma.subject.findMany({ orderBy: { name: 'asc' } });
}

export function listRooms() {
  return prisma.room.findMany({ orderBy: { name: 'asc' } });
}

export function listBatches() {
  return prisma.batch.findMany({ orderBy: { name: 'asc' } });
}

export type BatchInput = {
  name: string;
  department: string;
  programme: string;
  semester: number;
  academicYear: string;
};

export function createBatch(data: BatchInput) {
  return prisma.batch.create({ data });
}

export function updateBatch(id: string, data: BatchInput) {
  return prisma.batch.update({ where: { id }, data });
}

export type SubjectInput = { name: string; code: string };
export type RoomInput = { name: string; latitude: number; longitude: number; geofenceRadiusM: number; wifiBssidWhitelist: string[] };

export function createSubject(data: SubjectInput) { return prisma.subject.create({ data }); }
export function updateSubject(id: string, data: SubjectInput) { return prisma.subject.update({ where: { id }, data }); }
export function createRoom(data: RoomInput) { return prisma.room.create({ data }); }
export function updateRoom(id: string, data: RoomInput) { return prisma.room.update({ where: { id }, data }); }
