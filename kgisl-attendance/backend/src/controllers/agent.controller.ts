import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export async function handleAgentChat(req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ reply: "Please provide a valid message." });
      return;
    }

    const lowerMessage = message.toLowerCase();

    // Intent 1: Active Sessions
    if (lowerMessage.includes('active') && (lowerMessage.includes('session') || lowerMessage.includes('sessions'))) {
      const activeSessions = await prisma.attendanceSession.findMany({
        where: { status: 'ACTIVE' },
        include: { subject: true, batch: true, room: true, faculty: true }
      });
      
      if (activeSessions.length === 0) {
        res.json({ reply: "There are currently no active sessions running." });
        return;
      }

      let reply = `There are ${activeSessions.length} active sessions right now:\n\n`;
      activeSessions.forEach(s => {
        reply += `- **${s.subject.name}** for **${s.batch.name}** in ${s.room.name} (Faculty: ${s.faculty.name})\n`;
      });
      res.json({ reply });
      return;
    }

    // Intent 2: Today's Attendance Summary
    if ((lowerMessage.includes('today') || lowerMessage.includes('everyday')) && (lowerMessage.includes('attendance') || lowerMessage.includes('stats') || lowerMessage.includes('summary'))) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaysSessions = await prisma.attendanceSession.findMany({
        where: { startedAt: { gte: startOfDay } },
        include: { records: true, batch: { include: { students: true } } }
      });

      if (todaysSessions.length === 0) {
        res.json({ reply: "No attendance sessions have been conducted today." });
        return;
      }

      let totalStudents = 0;
      let totalPresent = 0;

      todaysSessions.forEach(session => {
        totalStudents += session.batch.students.length;
        const presentCount = session.records.filter(r => r.status === 'PRESENT').length;
        totalPresent += presentCount;
      });

      const attendancePercentage = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : 0;

      res.json({ reply: `Today's Attendance Summary:\n- **Total Sessions**: ${todaysSessions.length}\n- **Total Present**: ${totalPresent} out of ${totalStudents} expected check-ins.\n- **Overall Attendance**: ${attendancePercentage}%` });
      return;
    }

    // Intent 3: Absent Students
    if (lowerMessage.includes('absent') || lowerMessage.includes('absentees')) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const latestSession = await prisma.attendanceSession.findFirst({
        where: { startedAt: { gte: startOfDay } },
        orderBy: { startedAt: 'desc' },
        include: { records: true, batch: { include: { students: true } }, subject: true }
      });

      if (!latestSession) {
        res.json({ reply: "There are no sessions recorded today to check for absentees." });
        return;
      }

      const presentStudentIds = new Set(latestSession.records.filter(r => r.status === 'PRESENT').map(r => r.studentId));
      const absentStudents = latestSession.batch.students.filter(s => !presentStudentIds.has(s.id));

      if (absentStudents.length === 0) {
        res.json({ reply: `Great news! Everyone was present for the latest session: **${latestSession.subject.name}** (${latestSession.batch.name}).` });
        return;
      }

      let reply = `For the latest session (**${latestSession.subject.name}** - ${latestSession.batch.name}), there are ${absentStudents.length} absentees:\n\n`;
      absentStudents.forEach(s => {
        reply += `- ${s.name} (${s.rollNo})\n`;
      });
      res.json({ reply });
      return;
    }

    // Default Fallback
    res.json({ reply: "I am Genius, your Smart Faculty Agent. You can ask me things like:\n- 'Show me today's attendance'\n- 'Are there any active sessions?'\n- 'Who is absent today?'" });
    return;

  } catch (error: any) {
    logger.error('Agent chat error', { error: error.message });
    res.status(500).json({ reply: "Sorry, I ran into an internal server error while processing your request." });
    return;
  }
}
