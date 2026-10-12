import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findFacultyByEmail } from '../services/accountLookup';
import { endActiveSessionsForFaculty } from '../services/session.service';
import { revokeAllUserSessions } from '../services/refreshToken.service';

const createFacultySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

const facultySelect = { id: true, name: true, email: true, createdAt: true, isActive: true } as const;

/**
 * Administrators manage the directory (`includeInactive=true` also returns deactivated faculty so they can be
 * re-enabled). Dropdowns that assign classes keep the default, active-only list.
 */
export async function listFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const faculties = await prisma.faculty.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: { ...facultySelect, mentoredBatches: { select: { id: true, name: true, lifecycle: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: faculties });
  } catch (err) { next(err); }
}

export async function createFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = createFacultySchema.parse(req.body);

    // Case-insensitive: "Chithra@x.edu" and "chithra@x.edu" are the same mailbox.
    if (await findFacultyByEmail(email)) {
      res.status(409).json({ success: false, message: 'Faculty with this email already exists' });
      return;
    }

    const created = await prisma.faculty.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
      select: facultySelect,
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
}

/** Deactivating (or re-enabling) a login. A deactivated login stops working at once: its class is ended and its tokens revoked. */
export async function setFacultyStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const faculty = await prisma.faculty.update({ where: { id: req.params.id }, data: { isActive }, select: facultySelect });
    if (!isActive) {
      await endActiveSessionsForFaculty(faculty.id);
      await revokeAllUserSessions(faculty.id, 'FACULTY');
    }
    res.json({ success: true, data: faculty });
  } catch (err) { next(err); }
}
