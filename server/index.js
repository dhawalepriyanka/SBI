import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { fillOriginalPdf } from '../src/utils/fillPdf.js';
import { addClickableTables } from '../src/tableFieldMap.js';
import baseFieldMap from '../src/fieldMap.json' with { type: 'json' };
import { databaseKind, getApplication, insertApplication, listApplications, submitApplication as submitStoredApplication, updateApplicationData } from './database.js';

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(serverDir, '..');
const privateDir = join(serverDir, 'private');
const templatePath = join(privateDir, 'sbi-home-loan-application.pdf');
const pagesDir = join(privateDir, 'pages');
const isDev = process.argv.includes('--dev');
const portArgument = process.argv.find((argument) => argument.startsWith('--port='));
const port = Number(portArgument?.slice('--port='.length) || process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'local-development-secret-change-before-production');
const sessionCookie = 'sbi_session';
const canManagerEdit = process.env.MANAGER_EDIT_ENABLED !== 'false';

const fieldMap = addClickableTables(baseFieldMap);

const configuredUsers = [
  {
    id: process.env.MANAGER_ID || 'manager-001',
    username: process.env.MANAGER_USERNAME || (isProduction ? '' : 'manager'),
    password: process.env.MANAGER_PASSWORD || (isProduction ? '' : 'manager123'),
    role: 'manager',
  },
];

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function signSession(user) {
  if (!sessionSecret) throw Object.assign(new Error('SESSION_SECRET is not configured'), { status: 503 });
  const payload = Buffer.from(JSON.stringify({ sub: user.id, username: user.username, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(request) {
  const token = parseCookies(request)[sessionCookie];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', sessionSecret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(request, maximumBytes = 20 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function normalizeFormData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('Invalid form data'), { status: 400 });
  const cleanObject = (candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  return { values: cleanObject(value.values), photo: cleanObject(value.photo), signature: cleanObject(value.signature) };
}

function serializeApplication(row, includeData = false) {
  const application = {
    id: row.id,
    employeeId: row.employee_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
  if (includeData) application.formData = JSON.parse(row.form_data);
  return application;
}

function requireUser(request, response) {
  const user = readSession(request);
  if (!user) json(response, 401, { error: 'Authentication required' });
  return user;
}

function requireManager(request, response) {
  const user = readSession(request);
  if (!user || user.role !== 'manager') {
    json(response, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

async function streamOfficialPdf(response, application, disposition) {
  const stored = JSON.parse(application.form_data);
  const template = new Uint8Array(await readFile(templatePath));
  const bytes = await fillOriginalPdf(template, stored.values || {}, fieldMap, { photo: stored.photo || {}, signature: stored.signature || {} });
  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': bytes.length,
    'Content-Disposition': `${disposition}; filename="SBI-Housing-Loan-${application.id}.pdf"`,
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(Buffer.from(bytes));
}

export async function handleApi(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/auth/employee-session') {
    const existing = readSession(request);
    const employee = existing?.role === 'employee'
      ? { id: existing.sub, username: existing.username, role: 'employee' }
      : { id: `employee-${randomUUID()}`, username: 'Applicant', role: 'employee' };
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return json(response, 200, { user: { id: employee.id, username: employee.username, role: employee.role, canEdit: false } }, {
      'Set-Cookie': `${sessionCookie}=${encodeURIComponent(signSession(employee))}; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800${secure}`,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    if (!configuredUsers[0].username || !configuredUsers[0].password) {
      return json(response, 503, { error: 'Manager credentials are not configured' });
    }
    const body = await readJson(request, 16 * 1024);
    const user = configuredUsers.find((candidate) => safeEqual(candidate.username, body.username || '') && safeEqual(candidate.password, body.password || ''));
    if (!user) return json(response, 401, { error: 'Invalid username or password' });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return json(response, 200, { user: { id: user.id, username: user.username, role: user.role, canEdit: user.role === 'manager' && canManagerEdit } }, {
      'Set-Cookie': `${sessionCookie}=${encodeURIComponent(signSession(user))}; HttpOnly; Path=/; SameSite=Strict; Max-Age=28800${secure}`,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    return json(response, 200, { ok: true }, { 'Set-Cookie': `${sessionCookie}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0` });
  }

  if (request.method === 'GET' && url.pathname === '/api/session') {
    const user = requireUser(request, response);
    if (!user) return;
    return json(response, 200, { user: { id: user.sub, username: user.username, role: user.role, canEdit: user.role === 'manager' && canManagerEdit } });
  }

  const pageMatch = url.pathname.match(/^\/api\/form-pages\/(\d+)$/);
  if (request.method === 'GET' && pageMatch) {
    if (!requireUser(request, response)) return;
    const page = Number(pageMatch[1]);
    if (page < 1 || page > 24) return json(response, 404, { error: 'Page not found' });
    const path = join(pagesDir, `page-${String(page).padStart(2, '0')}.jpg`);
    if (!existsSync(path)) return json(response, 404, { error: 'Page not found' });
    response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    return createReadStream(path).pipe(response);
  }

  if (request.method === 'GET' && url.pathname === '/api/applications') {
    const user = requireUser(request, response);
    if (!user) return;
    const rows = await listApplications(user);
    return json(response, 200, { applications: rows.map((row) => serializeApplication(row)) });
  }

  if (request.method === 'POST' && url.pathname === '/api/applications') {
    const user = requireUser(request, response);
    if (!user) return;
    if (user.role !== 'employee') return json(response, 403, { error: 'Forbidden' });
    const body = await readJson(request);
    const formData = normalizeFormData(body.formData);
    const id = randomUUID();
    const now = new Date().toISOString();
    await insertApplication({ id, employee_id: user.sub, status: 'draft', form_data: JSON.stringify(formData), created_at: now, updated_at: now });
    return json(response, 201, { application: serializeApplication(await getApplication(id), true) });
  }

  const applicationMatch = url.pathname.match(/^\/api\/applications\/([^/]+)$/);
  if (applicationMatch && request.method === 'GET') {
    const user = requireUser(request, response);
    if (!user) return;
    const row = await getApplication(applicationMatch[1]);
    if (!row) return json(response, 404, { error: 'Application not found' });
    if (user.role === 'employee' && row.employee_id !== user.sub) return json(response, 403, { error: 'Forbidden' });
    if (user.role === 'manager' && row.status !== 'submitted') return json(response, 404, { error: 'Application not found' });
    return json(response, 200, { application: serializeApplication(row, true) });
  }

  if (applicationMatch && request.method === 'PUT') {
    const user = requireUser(request, response);
    if (!user) return;
    const row = await getApplication(applicationMatch[1]);
    if (!row) return json(response, 404, { error: 'Application not found' });
    const employeeCanEdit = user.role === 'employee' && row.employee_id === user.sub && row.status === 'draft';
    const managerCanEdit = user.role === 'manager' && canManagerEdit && row.status === 'submitted';
    if (!employeeCanEdit && !managerCanEdit) return json(response, 403, { error: 'Forbidden' });
    const body = await readJson(request);
    const formData = normalizeFormData(body.formData);
    await updateApplicationData(row.id, JSON.stringify(formData), new Date().toISOString());
    return json(response, 200, { application: serializeApplication(await getApplication(row.id), true) });
  }

  const submitMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/submit$/);
  if (submitMatch && request.method === 'POST') {
    const user = requireUser(request, response);
    if (!user) return;
    if (user.role !== 'employee') return json(response, 403, { error: 'Forbidden' });
    const row = await getApplication(submitMatch[1]);
    if (!row) return json(response, 404, { error: 'Application not found' });
    if (row.employee_id !== user.sub || row.status !== 'draft') return json(response, 403, { error: 'Forbidden' });
    const body = await readJson(request);
    const formData = body.formData ? normalizeFormData(body.formData) : JSON.parse(row.form_data);
    const now = new Date().toISOString();
    await submitStoredApplication(row.id, JSON.stringify(formData), now);
    return json(response, 200, { application: serializeApplication(await getApplication(row.id), true) });
  }

  const generateMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/generate-pdf$/);
  if (generateMatch && request.method === 'POST') {
    if (!requireManager(request, response)) return;
    const row = await getApplication(generateMatch[1]);
    if (!row || row.status !== 'submitted') return json(response, 404, { error: 'Application not found' });
    return streamOfficialPdf(response, row, 'inline');
  }

  const pdfMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/pdf$/);
  if (pdfMatch && request.method === 'GET') {
    if (!requireManager(request, response)) return;
    const row = await getApplication(pdfMatch[1]);
    if (!row || row.status !== 'submitted') return json(response, 404, { error: 'Application not found' });
    return streamOfficialPdf(response, row, 'attachment');
  }

  return json(response, 404, { error: 'Not found' });
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mjs': 'text/javascript; charset=utf-8' };

async function serveProduction(request, response, url) {
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const candidate = resolve(projectDir, 'dist', requested);
  const distDir = resolve(projectDir, 'dist');
  let path = candidate === distDir || candidate.startsWith(`${distDir}\\`) ? candidate : join(distDir, 'index.html');
  try {
    if (!(await stat(path)).isFile()) path = join(distDir, 'index.html');
  } catch {
    path = join(distDir, 'index.html');
  }
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(response);
}

const isMainModule = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const vite = isMainModule && isDev ? await createViteServer({ root: projectDir, server: { middlewareMode: true }, appType: 'spa' }) : null;
const server = isMainModule ? createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (url.pathname.startsWith('/forms/')) return json(response, 404, { error: 'Not found' });
    if (vite) return vite.middlewares(request, response, () => json(response, 404, { error: 'Not found' }));
    return await serveProduction(request, response, url);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    else response.end();
  }
}) : null;

server?.listen(port, () => {
  console.log(`SBI Housing Loan server running at http://localhost:${port}`);
  console.log(`Application database: ${databaseKind()}`);
  if (sessionSecret.startsWith('local-development')) console.warn('Set SESSION_SECRET before production.');
});
