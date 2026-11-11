// ============================================
// ScanChecker - DB connection helper (Postgres/Neon)
// Koneksi tunggal yang di-reuse lintas invocation (serverless).
// ============================================
import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL belum di-set. Tambahkan di Vercel env vars (dari Neon).');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  const res = await p.query(text, params);
  return res;
}

export { getPool };
