import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import process from 'process';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(16), (byte) => alphabet[byte % alphabet.length]).join('') + '#7a';
}

async function finishSeed() {
  await prisma.admin.updateMany({ data: { mustChangePassword: true } });
  await prisma.faculty.updateMany({ data: { mustChangePassword: true } });
  await prisma.student.updateMany({ data: { mustChangePassword: true } });
}

async function main() {
  // Seeding creates sample accounts and must never run against production by accident.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to seed in production. Set ALLOW_PRODUCTION_SEED=true only for a deliberate first-time bootstrap.');
  }
  // Sample accounts get random passwords (printed once) and must change them at first login.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || randomPassword();
  const facultyPassword = randomPassword();
  const passwordHash = await bcrypt.hash(facultyPassword, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  console.log(`Seed admin: admin@kgisl.edu / ${adminPassword}`);
  console.log(`Seed faculty password: ${facultyPassword}`);

  await prisma.admin.upsert({
    where: { email: 'admin@kgisl.edu' }, update: {},
    create: { name: 'System Administrator', email: 'admin@kgisl.edu', passwordHash: adminPasswordHash },
  });

  // These are the only valid MCA sections.
  const validSections = ['MCA-A', 'MCA-B', 'MCA-C'] as const;
  for (const name of validSections) {
    await prisma.batch.upsert({ where: { name }, update: {}, create: { name } });
  }

  /* Previous partial test list retained only in git history. The authoritative
     section-wise student roster is imported from students.tsv below. */
  const legacyStudentsData = [
    { regNo: '2538M0054', rollNo: '25MCA01', name: 'ABDULLAH NIYAS A' },
    { regNo: '2538M0060', rollNo: '25MCA07', name: 'ALAGIRI K' },
    { regNo: '2538M0061', rollNo: '25MCA08', name: 'AMAL C SIMON' },
    { regNo: '2538M0072', rollNo: '25MCA19', name: 'CHARLES JEYASEELAN A' },
    { regNo: '2538M0080', rollNo: '25MCA27', name: 'DINESH T' },
    { regNo: '2538M0087', rollNo: '25MCA33', name: 'GNANASANKAR M' },
    { regNo: '2538M0094', rollNo: '25MCA40', name: 'HARI KRISHNAN K' },
    { regNo: '2538M0101', rollNo: '25MCA46', name: 'JAYAKUMAR J' },
    { regNo: '2538M0106', rollNo: '25MCA52', name: 'KAVIYARASU K' },
    { regNo: '2538M0107', rollNo: '25MCA53', name: 'KAVYA R' },
    { regNo: '2538M0114', rollNo: '25MCA60', name: 'MOURISHARAN T' },
    { regNo: '2538M0116', rollNo: '25MCA62', name: 'MURUGAN R' },
    { regNo: '2538M0131', rollNo: '25MCA77', name: 'PRAVEEN M' },
    { regNo: '2538M0132', rollNo: '25MCA78', name: 'PREMKUMAR S' },
    { regNo: '2538M0139', rollNo: '25MCA85', name: 'RICHARD IMPRANCH M' },
    { regNo: '2538M0141', rollNo: '25MCA87', name: 'SAKTHIVEL C' },
    { regNo: '2538M0146', rollNo: '25MCA92', name: 'SANJEEV M S' },
    { regNo: '2538M0149', rollNo: '25MCA95', name: 'SASIDHARAN G R' },
    { regNo: '2538M0150', rollNo: '25MCA96', name: 'SAVITHA G' },
    { regNo: '2538M0162', rollNo: '25MCA109', name: 'SUNDAR P' },
    { regNo: '2538M0163', rollNo: '25MCA110', name: 'SURENDER VIGNESH M' },
    { regNo: '2538M0164', rollNo: '25MCA111', name: 'SURYA D' },
    { regNo: '2538M0171', rollNo: '25MCA118', name: 'VIGNESH B' },
    { regNo: '2538M0174', rollNo: '25MCA121', name: 'VINOTHKUMAR' },
  ];
  // Keep the legacy setup compatible while the roster import owns student data.
  void legacyStudentsData;

  console.log('Seeding students...');

  // The roster contains personal data and initial passwords, so it is not stored in the repository.
  const rosterPath = process.env.SEED_STUDENTS_FILE || path.join(__dirname, 'students.tsv');
  const hasRoster = fs.existsSync(rosterPath);
  if (!hasRoster) console.log(`No student roster at ${rosterPath}; skipping student seeding (set SEED_STUDENTS_FILE).`);
  const rows = hasRoster ? fs.readFileSync(rosterPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1) : [];
  const studentsData = rows.map((row, index) => {
    const columns = row.split('\t');
    if (columns.length < 7) throw new Error(`Invalid student row ${index + 2}`);
    const [, section, rollNo, regNo, name, email, initialPassword] = columns.map((value) => value.trim());
    if (!section || !rollNo || !regNo || !name || !email || !initialPassword) {
      throw new Error(`Missing required student data at row ${index + 2}`);
    }
    return { section, rollNo, regNo, name, email: email.toLowerCase(), initialPassword };
  });

  const duplicateCheck = (field: 'rollNo' | 'email') => {
    const values = studentsData.map((student) => student[field]);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    if (duplicates.length) throw new Error(`Duplicate ${field}: ${[...new Set(duplicates)].join(', ')}`);
  };
  duplicateCheck('rollNo');
  duplicateCheck('email');

  const invalidSections = [...new Set(studentsData.map((student) => student.section))]
    .filter((section) => !validSections.includes(section as typeof validSections[number]));
  if (invalidSections.length) {
    throw new Error(`Invalid section(s): ${invalidSections.join(', ')}. Allowed: ${validSections.join(', ')}`);
  }

  const sectionBatches = new Map<string, string>();
  for (const section of [...new Set(studentsData.map((student) => student.section))]) {
    const sectionBatch = await prisma.batch.upsert({
      where: { name: section },
      update: {},
      create: { name: section },
    });
    sectionBatches.set(section, sectionBatch.id);
  }

  for (const s of studentsData) {
    const studentPasswordHash = await bcrypt.hash(s.initialPassword, 10);
    await prisma.student.upsert({
      where: { rollNo: s.rollNo },
      // Keep an existing student's password intact. This makes the bootstrap
      // safe to run during every production release without resetting users.
      update: { name: s.name, regNo: s.regNo, email: s.email, batchId: sectionBatches.get(s.section)! },
      create: {
        name: s.name,
        rollNo: s.rollNo,
        regNo: s.regNo,
        email: s.email,
        passwordHash: studentPasswordHash,
        batchId: sectionBatches.get(s.section)!,
      },
    });
  }
  console.log(`Seeded ${studentsData.length} students successfully.`);

  // Create test data for Faculty, Subject, Room
  await prisma.faculty.upsert({
    where: { email: 'faculty@kgisl.edu' },
    update: {},
    create: {
      name: 'Sample Faculty',
      email: 'faculty@kgisl.edu',
      passwordHash,
    },
  });

  await prisma.subject.upsert({
    where: { code: 'MCA101' },
    update: {},
    create: {
      name: 'Full Stack Development',
      code: 'MCA101'
    }
  });

  const timetableFaculty = [
    { name: 'Surendhran D', email: 'surendhran.d@kgisl.edu' },
    { name: 'Gomathi R', email: 'gomathi.r@kgisl.edu' },
    { name: 'Saranya S', email: 'saranya.s@kgisl.edu' },
    { name: 'Yamunarani K', email: 'yamunarani.k@kgisl.edu' },
    { name: 'Chithra M', email: 'chithra.m@kgisl.edu' },
    { name: 'Rajesh R', email: 'rajesh.r@kgisl.edu' },
  ];
  for (const faculty of timetableFaculty) {
    await prisma.faculty.upsert({
      where: { email: faculty.email },
      update: { name: faculty.name },
      create: { ...faculty, passwordHash },
    });
  }

  const timetableSubjects = [
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
  for (const subject of timetableSubjects) {
    await prisma.subject.upsert({ where: { code: subject.code }, update: { name: subject.name }, create: subject });
  }

  await prisma.room.upsert({
    where: { name: 'MCA Lab' },
    update: {
      latitude: 11.0843583,
      longitude: 76.9975306,
      geofenceRadiusM: 200,
    },
    create: {
      name: 'MCA Lab',
      latitude: 11.0843583,
      longitude: 76.9975306,
      geofenceRadiusM: 200,
      wifiBssidWhitelist: []
    }
  });

  // ESP32 BLE classroom beacon (beaconId is broadcast inside the signed packet).
  const mcaLab = await prisma.room.findUniqueOrThrow({ where: { name: 'MCA Lab' } });
  await prisma.classroomBeacon.upsert({
    where: { beaconId: 1 },
    update: { roomId: mcaLab.id, enabled: true },
    create: { beaconId: 1, name: 'MCA Lab ESP32', roomId: mcaLab.id, enabled: true },
  });

  await finishSeed();
  console.log('Created sample Faculty, Subject, Room, Beacon for testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
