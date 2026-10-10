import { prisma } from '../config/prisma';

/**
 * E-mail addresses are case-insensitive, but older rows may have been stored exactly as typed
 * ("Chithra.M@kgisl.edu"). Phone keyboards also capitalise the first letter. Looking accounts up with an
 * exact match therefore rejected the right password with "Invalid email or password".
 */
const sameEmail = (email: string) => ({ email: { equals: email.trim(), mode: 'insensitive' as const } });

export const findAdminByEmail = (email: string) => prisma.admin.findFirst({ where: sameEmail(email) });
export const findFacultyByEmail = (email: string) => prisma.faculty.findFirst({ where: sameEmail(email) });
export const findStudentByEmail = (email: string) => prisma.student.findFirst({ where: sameEmail(email) });
