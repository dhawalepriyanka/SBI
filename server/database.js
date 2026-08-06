import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const useNeon = Boolean(process.env.DATABASE_URL);
let readyPromise;
let sqlite;
let neonSql;

async function initialize() {
  if (process.env.VERCEL === '1' && !useNeon) {
    throw Object.assign(new Error('DATABASE_URL is not configured'), { status: 503 });
  }
  if (useNeon) {
    const { neon } = await import('@neondatabase/serverless');
    neonSql = neon(process.env.DATABASE_URL);
    await neonSql.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('draft', 'submitted')),
        form_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT
      )
    `);
    await neonSql.query('CREATE INDEX IF NOT EXISTS applications_employee_updated_idx ON applications (employee_id, updated_at DESC)');
    await neonSql.query('CREATE INDEX IF NOT EXISTS applications_status_submitted_idx ON applications (status, submitted_at DESC)');
    return;
  }

  const dataDir = join(serverDir, 'data');
  await mkdir(dataDir, { recursive: true });
  const { DatabaseSync } = await import('node:sqlite');
  sqlite = new DatabaseSync(join(dataDir, 'applications.sqlite'));
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'submitted')),
      form_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      submitted_at TEXT
    );
  `);
}

function ready() {
  readyPromise ||= initialize();
  return readyPromise;
}

export async function getApplication(id) {
  await ready();
  if (useNeon) return (await neonSql.query('SELECT * FROM applications WHERE id = $1', [id]))[0];
  return sqlite.prepare('SELECT * FROM applications WHERE id = ?').get(id);
}

export async function listApplications(user) {
  await ready();
  if (user.role === 'manager') {
    if (useNeon) return neonSql.query("SELECT * FROM applications WHERE status = 'submitted' ORDER BY submitted_at DESC");
    return sqlite.prepare("SELECT * FROM applications WHERE status = 'submitted' ORDER BY submitted_at DESC").all();
  }
  if (useNeon) return neonSql.query('SELECT * FROM applications WHERE employee_id = $1 ORDER BY updated_at DESC', [user.sub]);
  return sqlite.prepare('SELECT * FROM applications WHERE employee_id = ? ORDER BY updated_at DESC').all(user.sub);
}

export async function insertApplication(row) {
  await ready();
  if (useNeon) {
    await neonSql.query(
      'INSERT INTO applications (id, employee_id, status, form_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [row.id, row.employee_id, row.status, row.form_data, row.created_at, row.updated_at],
    );
    return;
  }
  sqlite.prepare('INSERT INTO applications (id, employee_id, status, form_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(row.id, row.employee_id, row.status, row.form_data, row.created_at, row.updated_at);
}

export async function updateApplicationData(id, formData, updatedAt) {
  await ready();
  if (useNeon) {
    await neonSql.query('UPDATE applications SET form_data = $1, updated_at = $2 WHERE id = $3', [formData, updatedAt, id]);
    return;
  }
  sqlite.prepare('UPDATE applications SET form_data = ?, updated_at = ? WHERE id = ?').run(formData, updatedAt, id);
}

export async function submitApplication(id, formData, submittedAt) {
  await ready();
  if (useNeon) {
    await neonSql.query(
      "UPDATE applications SET status = 'submitted', form_data = $1, updated_at = $2, submitted_at = $2 WHERE id = $3",
      [formData, submittedAt, id],
    );
    return;
  }
  sqlite.prepare("UPDATE applications SET status = 'submitted', form_data = ?, updated_at = ?, submitted_at = ? WHERE id = ?")
    .run(formData, submittedAt, submittedAt, id);
}

export function databaseKind() {
  return useNeon ? 'neon' : 'sqlite';
}
