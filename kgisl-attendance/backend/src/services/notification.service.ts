import { ActorType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

type NotificationInput = {
  recipientId?: string | null;
  recipientRole: Exclude<ActorType, 'SYSTEM'>;
  type: string;
  title: string;
  message: string;
  href?: string;
};

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({ data: input });
  } catch (error) {
    // A notification must never undo a successful attendance or approval action.
    logger.error('[notifications] unable to create notification', {
      type: input.type,
      recipientRole: input.recipientRole,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyFacultyForLeaveRequest(input: { studentName: string; studentRollNo: string; batchId: string }): Promise<void> {
  const batch = await prisma.batch.findUnique({ where: { id: input.batchId }, select: { mentorId: true } });
  if (!batch?.mentorId) return;
  await createNotification({
    recipientId: batch.mentorId,
    recipientRole: 'FACULTY',
    type: 'LEAVE_REQUESTED',
    title: 'New leave request',
    message: `${input.studentName} (${input.studentRollNo}) submitted a leave or on-duty request.`,
    href: '/faculty/leave',
  });
}
