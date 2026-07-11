import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createFacultySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function listFacultyHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const faculties = await prisma.faculty.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
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
    
    // Check if faculty already exists
    const existing = await prisma.faculty.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Faculty with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newFaculty = await prisma.faculty.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: newFaculty });
  } catch (err) {
    next(err);
  }
}

export async function deleteFacultyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { sessions: true } } },
    });
    if (!faculty) {
      res.status(404).json({ success: false, message: 'Faculty does not exist' });
      return;
    }
    if (faculty._count.sessions > 0) {
      res.status(409).json({ success: false, message: 'Faculty has attendance history and cannot be removed' });
      return;
    }
    await prisma.faculty.delete({ where: { id: faculty.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
