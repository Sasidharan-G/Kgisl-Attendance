const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const outputDir = path.resolve(__dirname, '..', '..', 'database-docs');
const migrationsDir = path.resolve(__dirname, '..', 'prisma', 'migrations');

const models = [
  ['admin', 'admin'],
  ['faculty', 'faculty'],
  ['student', 'student'],
  ['batch', 'batch'],
  ['subject', 'subject'],
  ['room', 'room'],
  ['timetableAllocation', 'timetable_allocation'],
  ['attendanceSession', 'attendance_session'],
  ['attendanceQrHistory', 'attendance_qr_history'],
  ['attendanceRecord', 'attendance_record'],
  ['leaveRequest', 'leave_request'],
  ['auditLog', 'audit_log'],
];

const sensitiveFields = new Set([
  'passwordHash', 'currentQrTokenHash', 'tokenHash', 'nonce', 'deviceId',
  'ip', 'userAgent', 'metadata', 'gpsLat', 'gpsLng',
]);

function safeValue(key, value) {
  if (sensitiveFields.has(key) && value !== null && value !== undefined) return '[REDACTED]';
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function markdownTable(rows) {
  if (!rows.length) return '_No records._\n';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((key) => cell(safeValue(key, row[key]))).join(' | ')} |`).join('\n');
  return `${header}\n${separator}\n${body}\n`;
}

async function exportData() {
  const generatedAt = new Date().toISOString();
  const sections = [
    '# KGiSL Attendance Database Data Export',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '> This is a read-only export. Password hashes, QR/token material, device IDs, exact scan GPS, IP addresses, user agents, and audit metadata are intentionally redacted.',
    '',
  ];

  for (const [modelName, tableName] of models) {
    const rows = await prisma[modelName].findMany();
    sections.push(`## ${tableName}`, '', `Record count: **${rows.length}**`, '', markdownTable(rows), '');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'DATABASE_DATA_EXPORT.md'), sections.join('\n'), 'utf8');
}

async function exportSchemaDictionary() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT c.table_name, c.ordinal_position, c.column_name, c.data_type,
           c.udt_name, c.is_nullable, c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name IN (${models.map(([, table]) => `'${table}'`).join(', ')})
    ORDER BY c.table_name, c.ordinal_position
  `);
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
           ccu.table_name AS referenced_table,
           string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) AS referenced_columns
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN (${models.map(([, table]) => `'${table}'`).join(', ')})
    GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, ccu.table_name
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `);

  const sections = ['# Database Schema Data Dictionary', '', 'Generated directly from PostgreSQL `information_schema`.', ''];
  for (const [, tableName] of models) {
    const tableColumns = columns.filter((row) => row.table_name === tableName).map((row) => ({
      position: row.ordinal_position,
      column: row.column_name,
      type: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
      nullable: row.is_nullable,
      default: row.column_default,
    }));
    const tableConstraints = constraints.filter((row) => row.table_name === tableName).map((row) => ({
      constraint: row.constraint_name,
      type: row.constraint_type,
      columns: row.columns,
      referencedTable: row.referenced_table,
      referencedColumns: row.referenced_columns,
    }));
    sections.push(`## ${tableName}`, '', '### Columns', '', markdownTable(tableColumns), '', '### Constraints', '', markdownTable(tableConstraints), '');
  }
  fs.writeFileSync(path.join(outputDir, 'DATABASE_SCHEMA_TABLES.md'), sections.join('\n'), 'utf8');
}

function exportMigrations() {
  const migrationFolders = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const output = [
    '-- KGiSL Attendance exact Prisma migration SQL',
    '-- Concatenated in migration timestamp order. Do not rerun against a database where these migrations are already applied.',
    '',
  ];
  for (const folder of migrationFolders) {
    const file = path.join(migrationsDir, folder, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    output.push(`-- ============================================================================`, `-- MIGRATION: ${folder}`, `-- SOURCE: backend/prisma/migrations/${folder}/migration.sql`, `-- ============================================================================`, fs.readFileSync(file, 'utf8').trim(), '');
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'DATABASE_MIGRATIONS_EXACT.sql'), output.join('\n'), 'utf8');
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await exportData();
  await exportSchemaDictionary();
  exportMigrations();
  console.log(`Database documentation written to ${outputDir}`);
}

main().catch((error) => {
  console.error('Database documentation export failed:', error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
