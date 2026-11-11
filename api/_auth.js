// ============================================
// ScanChecker - Auth & session helper (cookie httpOnly)
// ============================================
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from './_db.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const COOKIE_NAME = 'sc_session';

// bcryptjs (Node) tidak menerima prefix "$2y$" milik PHP.
// Hash $2y$ adalah bcrypt standar, jadi cukup ganti prefix ke $2a$ untuk verify.
function normalizeHash(hash) {
  if (typeof hash === 'string' && hash.startsWith('$2y$')) {
    return '$2a$' + hash.slice(4);
  }
  return hash;
}

export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, normalizeHash(hash));
  } catch (e) {
    return false;
  }
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

function serializeCookie(name, value, maxAgeSeconds) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// Ambil session dari cookie, kembalikan user atau null
export async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const res = await query(
    `SELECT u.id, u.username, u.nama, u.role, u.toko, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1`,
    [token]
  );
  if (res.rows.length === 0) return null;
  const sess = res.rows[0];
  if (new Date(sess.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }
  return { id: sess.id, username: sess.username, nama: sess.nama, role: sess.role, toko: sess.toko };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expires.toISOString()]
  );
  return { token, maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

export async function destroySession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (token) {
    await query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = v;
    }
  }
  return out;
}

export { COOKIE_NAME, serializeCookie, clearCookie };
