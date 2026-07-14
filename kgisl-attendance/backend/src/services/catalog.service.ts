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
