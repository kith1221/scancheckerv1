// ============================================
// Menjalankan schema.sql ke database (Neon/Postgres)
// Jalankan:  node --env-file=.env.local scripts/init-schema.js
// Menggunakan Client tunggal + eksekusi multi-statement sekaligus.
// ============================================
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf8');

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log('Schema berhasil dijalankan.');
} catch (e) {
  console.error('Schema gagal:');
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
