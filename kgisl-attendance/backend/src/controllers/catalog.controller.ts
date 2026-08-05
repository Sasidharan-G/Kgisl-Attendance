import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listSubjects, listRooms, listBatches, createBatch, updateBatch } from '../services/catalog.service';

const batchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  programme: z.string().trim().min(2).max(50),
  semester: z.coerce.number().int().min(1).max(12),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Academic year must look like 2026-2027'),
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

export async function listBatchesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await listBatches() });
  } catch (err) {
    next(err);
  }
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
