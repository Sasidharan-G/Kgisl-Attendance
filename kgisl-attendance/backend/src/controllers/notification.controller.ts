import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';

const MAX_NOTIFICATIONS = 50;

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        recipientRole: req.auth!.role,
        OR: [{ recipientId: req.auth!.sub }, { recipientId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_NOTIFICATIONS,
    });
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) { next(err); }
}

export async function markNotificationReadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        recipientRole: req.auth!.role,
        OR: [{ recipientId: req.auth!.sub }, { recipientId: null }],
      },
    });
    if (!notification) { res.status(404).json({ success: false, message: 'Notification not found.' }); return; }
    const data = await prisma.notification.update({ where: { id: notification.id }, data: { readAt: notification.readAt ?? new Date() } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function markAllNotificationsReadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        recipientRole: req.auth!.role,
        readAt: null,
        OR: [{ recipientId: req.auth!.sub }, { recipientId: null }],
      },
      data: { readAt: new Date() },
    });
    res.json({ success: true, updated: result.count });
  } catch (err) { next(err); }
}
