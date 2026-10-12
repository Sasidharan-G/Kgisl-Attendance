import { prisma } from '../config/prisma';

/** Subjects, rooms, sections and beacons: the reference data the dropdowns and the timetable are built from. */

export function listSubjects() {
  return prisma.subject.findMany({ orderBy: { name: 'asc' } });
}

export function listRooms() {
  return prisma.room.findMany({ orderBy: { name: 'asc' } });
}

const activeStudents = { where: { isActive: true, archivedAt: null } } as const;

export function listBatches(role: 'ADMIN' | 'FACULTY', actorId: string) {
  return prisma.batch.findMany({
    where: role === 'FACULTY' ? { mentorId: actorId, lifecycle: { not: 'ARCHIVED' } } : undefined,
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      _count: { select: { students: activeStudents } },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * A section whose completion date has passed waits for an administrator's approval before its students are moved to
 * the passed-out database. Run on a timer (and at start-up), never as a side effect of reading the list.
 */
export async function flagFinishedBatchesForArchive(): Promise<number> {
  const result = await prisma.batch.updateMany({
    where: { lifecycle: 'ACTIVE', completionDate: { lte: new Date() } },
    data: { lifecycle: 'ARCHIVE_PENDING', archiveRequestedAt: new Date() },
  });
  return result.count;
}

interface BatchInput {
  name: string;
  department: string;
  programme: string;
  semester: number;
  academicYear: string;
  mentorId?: string | null;
  completionDate?: Date | null;
}

export function createBatch(data: BatchInput) {
  return prisma.batch.create({ data });
}

export function updateBatch(id: string, data: BatchInput) {
  return prisma.batch.update({ where: { id }, data });
}

interface SubjectInput { name: string; code: string }
export function createSubject(data: SubjectInput) { return prisma.subject.create({ data }); }
export function updateSubject(id: string, data: SubjectInput) { return prisma.subject.update({ where: { id }, data }); }

interface RoomInput { name: string; latitude: number; longitude: number; geofenceRadiusM: number }
export function createRoom(data: RoomInput) { return prisma.room.create({ data }); }
export function updateRoom(id: string, data: RoomInput) { return prisma.room.update({ where: { id }, data }); }

interface BeaconInput { beaconId: number; name: string; roomId: string; enabled: boolean }
export function listBeacons() {
  return prisma.classroomBeacon.findMany({ include: { room: { select: { id: true, name: true } } }, orderBy: { beaconId: 'asc' } });
}
export function createBeacon(data: BeaconInput) { return prisma.classroomBeacon.create({ data }); }
export function updateBeacon(id: string, data: BeaconInput) { return prisma.classroomBeacon.update({ where: { id }, data }); }
