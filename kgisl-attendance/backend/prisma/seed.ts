import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create a Batch
  const batch = await prisma.batch.upsert({
    where: { name: 'MCA - 2025' },
    update: {},
    create: {
      name: 'MCA - 2025',
    },
  });

  const studentsData = [
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

  console.log('Seeding students...');

  for (const s of studentsData) {
    const email = `${s.rollNo.toLowerCase()}@kgisliim.ac.in`;
    const studentPasswordHash = await bcrypt.hash(s.rollNo, 10);
    await prisma.student.upsert({
      where: { rollNo: s.rollNo },
      update: { email: email, passwordHash: studentPasswordHash },
      create: {
        name: s.name,
        rollNo: s.rollNo,
        email: email,
        passwordHash: studentPasswordHash,
        batchId: batch.id,
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

  await prisma.room.upsert({
    where: { name: 'MCA Lab' },
    update: {},
    create: {
      name: 'MCA Lab',
      latitude: 11.0827,
      longitude: 76.9959,
      geofenceRadiusM: 10000, 
      wifiBssidWhitelist: []
    }
  });

  console.log('Created sample Faculty, Subject, Room for testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
