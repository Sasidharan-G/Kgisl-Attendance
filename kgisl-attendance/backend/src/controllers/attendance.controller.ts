import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { markAttendance } from '../services/attendance.service';

const scanSchema = z.object({
  qrPayload: z.any(),
  gpsLat: z.number(),
  gpsLng: z.number(),
  gpsAccuracy: z.number().optional(),
  deviceId: z.string(),
});

export async function scanAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = scanSchema.parse(req.body);

    const result = await markAttendance({
      studentId: req.auth!.sub,
      qrPayload: body.qrPayload,
      gpsLat: body.gpsLat,
      gpsLng: body.gpsLng,
      gpsAccuracy: body.gpsAccuracy,
      deviceId: body.deviceId,
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
