import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Development bootstrap: an administrator, the MCA sections, sample faculty/subjects/room/beacon and (optionally) a
 * student roster from `students.tsv`. Every account it creates gets a random password that is printed once and must
 * be replaced at the first sign-in. Existing accounts and passwords are never touched.
 */
const prisma = new PrismaClient();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db']);
const SECTIONS = ['MCA-A', 'MCA-B', 'MCA-C'] as const;

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(16), (byte) => alphabet[byte % alphabet.length]).join('') + '#7a';
}

function assertSafeTarget() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to seed in production. Set ALLOW_PRODUCTION_SEED=true only for a deliberate first-time bootstrap.');
  }
  // A development .env can point at a hosted database; seeding that by accident would add sample accounts to real data.
  let host = '';
  try { host = new URL(process.env.DATABASE_URL ?? '').hostname; } catch { /* reported below */ }
  if (!LOCAL_HOSTS.has(host) && process.env.ALLOW_REMOTE_SEED !== 'true') {
    throw new Error(`Refusing to seed "${host || 'an unknown host'}": it is not a local database. Set ALLOW_REMOTE_SEED=true if that is really intended.`);
  }
}

async function seedStudents() {
  // The roster holds personal data and initial passwords, so it is never stored in the repository.
  const rosterPath = process.env.SEED_STUDENTS_FILE || path.join(__dirname, 'students.tsv');
  if (!fs.existsSync(rosterPath)) {
    console.log(`No student roster at ${rosterPath}; skipping students (set SEED_STUDENTS_FILE to import one).`);
    return;
  }
  const rows = fs.readFileSync(rosterPath, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
  const students = rows.map((row, index) => {
    const columns = row.split('\t').map((value) => value.trim());
    if (columns.length < 7) throw new Error(`Invalid student row ${index + 2}`);
    const [, section, rollNo, regNo, name, email, initialPassword] = columns;
    if (!section || !rollNo || !regNo || !name || !email || !initialPassword) throw new Error(`Missing required student data at row ${index + 2}`);
    if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) throw new Error(`Invalid section "${section}" at row ${index + 2}. Allowed: ${SECTIONS.join(', ')}`);
    return { section, rollNo, regNo, name, email: email.toLowerCase(), initialPassword };
  });
  for (const field of ['rollNo', 'email'] as const) {
    const values = students.map((student) => student[field]);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    if (duplicates.length) throw new Error(`Duplicate ${field}: ${[...new Set(duplicates)].join(', ')}`);
  }

  const sectionIds = new Map<string, string>();
  for (const name of SECTIONS) {
    sectionIds.set(name, (await prisma.batch.upsert({ where: { name }, update: {}, create: { name } })).id);
  }
  for (const student of students) {
    await prisma.student.upsert({
      where: { rollNo: student.rollNo },
      // An existing student keeps their password, so the bootstrap is safe to run again.
      update: { name: student.name, regNo: student.regNo, email: student.email, batchId: sectionIds.get(student.section)! },
      create: {
        name: student.name,
        rollNo: student.rollNo,
        regNo: student.regNo,
        email: student.email,
        passwordHash: await bcrypt.hash(student.initialPassword, 10),
        mustChangePassword: true,
        batchId: sectionIds.get(student.section)!,
      },
    });
  }
  console.log(`Seeded ${students.length} students.`);
}

async function main() {
  assertSafeTarget();

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || randomPassword();
  await prisma.admin.upsert({
    where: { email: 'admin@kgisl.edu' },
    update: {},
    create: { name: 'System Administrator', email: 'admin@kgisl.edu', passwordHash: await bcrypt.hash(adminPassword, 12), mustChangePassword: true },
  });
  console.log(`Admin:   admin@kgisl.edu / ${adminPassword}`);

  for (const name of SECTIONS) await prisma.batch.upsert({ where: { name }, update: {}, create: { name } });
  await seedStudents();

  const faculty = [
    { name: 'Sample Faculty', email: 'faculty@kgisl.edu' },
    { name: 'Surendhran D', email: 'surendhran.d@kgisl.edu' },
    { name: 'Gomathi R', email: 'gomathi.r@kgisl.edu' },
    { name: 'Saranya S', email: 'saranya.s@kgisl.edu' },
    { name: 'Yamunarani K', email: 'yamunarani.k@kgisl.edu' },
    { name: 'Chithra M', email: 'chithra.m@kgisl.edu' },
    { name: 'Rajesh R', email: 'rajesh.r@kgisl.edu' },
  ];
  for (const member of faculty) {
    const existing = await prisma.faculty.findUnique({ where: { email: member.email } });
    if (existing) {
      await prisma.faculty.update({ where: { id: existing.id }, data: { name: member.name } });
      continue;
    }
    const password = randomPassword();
    await prisma.faculty.create({ data: { ...member, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
    console.log(`Faculty: ${member.email} / ${password}`);
  }

  const subjects = [
    { code: 'MCA101', name: 'Full Stack Development' },
    { code: 'AIML', name: 'Artificial Intelligence and Machine Learning' },
    { code: 'PHP', name: 'PHP Programming' },
    { code: 'OSC', name: 'Open Source Computing' },
    { code: 'NSC', name: 'Network Security and Cryptography' },
    { code: 'AIML-LAB', name: 'AI and ML Laboratory' },
    { code: 'CC', name: 'Cloud Computing' },
    { code: 'OSC-LAB', name: 'Open Source Computing Laboratory' },
    { code: 'PLAC', name: 'Placement Training' },
    { code: 'TECH', name: 'Technical Training' },
  ];
  for (const subject of subjects) {
    await prisma.subject.upsert({ where: { code: subject.code }, update: { name: subject.name }, create: subject });
  }

  const room = await prisma.room.upsert({
    where: { name: 'MCA Lab' },
    update: {},
    create: { name: 'MCA Lab', latitude: 11.0843583, longitude: 76.9975306, geofenceRadiusM: 200 },
  });
  // ESP32 BLE classroom beacon (the id is broadcast inside the signed packet).
  await prisma.classroomBeacon.upsert({
    where: { beaconId: 1 },
    update: { roomId: room.id, enabled: true },
    create: { beaconId: 1, name: 'MCA Lab ESP32', roomId: room.id, enabled: true },
  });
  console.log('Seed finished: sections, sample faculty, subjects, MCA Lab room and beacon #1.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
