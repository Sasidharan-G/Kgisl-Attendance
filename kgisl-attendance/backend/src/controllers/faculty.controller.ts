import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findFacultyByEmail } from '../services/accountLookup';
import { endActiveSessionsForFaculty } from '../services/session.service';
import { revokeAllUserSessions } from '../services/refreshToken.service';

const createFacultySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

/**
 * Administrators manage the directory (`includeInactive=true` also returns deactivated faculty so they can be
 * re-enabled). Dropdowns that assign classes keep the default, active-only list.
 */
export async function listFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const faculties = await prisma.faculty.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        isActive: true,
        mentoredBatches: { select: { id: true, name: true, lifecycle: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: faculties });
  } catch (err) {
    next(err);
  }
}

export async function createFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = createFacultySchema.parse(req.body);

    // Case-insensitive: "Chithra@x.edu" and "chithra@x.edu" are the same mailbox.
    const existing = await findFacultyByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, message: 'Faculty with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newFaculty = await prisma.faculty.create({
      data: {
        name,
        email,
        passwordHash,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: newFaculty });
  } catch (err) {
    next(err);
  }
}

/** A deactivated login must stop working immediately: close its running class and revoke its refresh tokens. */
async function lockOut(facultyId: string) {
  await endActiveSessionsForFaculty(facultyId);
  await revokeAllUserSessions(facultyId, 'FACULTY');
}

export async function deleteFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!faculty) {
      res.status(404).json({ success: false, message: 'Faculty does not exist' });
      return;
    }
    await prisma.faculty.update({ where: { id: faculty.id }, data: { isActive: false } });
    await lockOut(faculty.id);
    res.json({ success: true, message: 'Faculty account deactivated; attendance history was preserved.' });
  } catch (err) {
    next(err);
  }
}

export async function setFacultyStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const faculty = await prisma.faculty.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });
    if (!isActive) await lockOut(faculty.id);
    res.json({ success: true, data: faculty });
  } catch (err) { next(err); }
}
