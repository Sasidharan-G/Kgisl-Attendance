import { prisma } from '../config/prisma';

/** Subjects, rooms, sections and beacons: the reference data the dropdowns and the timetable are built from. */

/** Tiny in-process cache: these lists change a few times a term but are read by every page load. */
function cached<T>(load: () => Promise<T>, ttlMs = 30_000) {
  let value: T | undefined;
  let expires = 0;
  const read = async (): Promise<T> => {
    if (value !== undefined && Date.now() < expires) return value;
    value = await load();
    expires = Date.now() + ttlMs;
    return value;
  };
  read.clear = () => { value = undefined; expires = 0; };
  return read;
}

const subjectsCache = cached(() => prisma.subject.findMany({ orderBy: { name: 'asc' } }));
const roomsCache = cached(() => prisma.room.findMany({ orderBy: { name: 'asc' } }));

export const listSubjects = () => subjectsCache();
export const listRooms = () => roomsCache();

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

export async function updateBatch(id: string, data: BatchInput) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id }, select: { lifecycle: true } });
    const shouldReactivate = batch?.lifecycle === 'ARCHIVE_PENDING'
      && data.completionDate !== undefined
      && (data.completionDate === null || data.completionDate > new Date());

    return tx.batch.update({
      where: { id },
      data: {
        ...data,
        ...(shouldReactivate ? { lifecycle: 'ACTIVE', archiveRequestedAt: null } : {}),
      },
    });
  });
}

interface SubjectInput { name: string; code: string }
export async function createSubject(data: SubjectInput) { try { return await prisma.subject.create({ data }); } finally { subjectsCache.clear(); } }
export async function updateSubject(id: string, data: SubjectInput) { try { return await prisma.subject.update({ where: { id }, data }); } finally { subjectsCache.clear(); } }

interface RoomInput { name: string; latitude: number; longitude: number; geofenceRadiusM: number }
export async function createRoom(data: RoomInput) { try { return await prisma.room.create({ data }); } finally { roomsCache.clear(); } }
export async function updateRoom(id: string, data: RoomInput) { try { return await prisma.room.update({ where: { id }, data }); } finally { roomsCache.clear(); } }

interface BeaconInput { beaconId: number; name: string; roomId: string; enabled: boolean }
export function listBeacons() {
  return prisma.classroomBeacon.findMany({ include: { room: { select: { id: true, name: true } } }, orderBy: { beaconId: 'asc' } });
}
export function createBeacon(data: BeaconInput) { return prisma.classroomBeacon.create({ data }); }
export function updateBeacon(id: string, data: BeaconInput) { return prisma.classroomBeacon.update({ where: { id }, data }); }
