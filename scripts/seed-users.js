// ============================================
// Seed: membuat / memperbarui hash password (bcryptjs) untuk user
// Jalankan:  node scripts/seed-users.js [username] [passwordBaru] [nama] [toko] [role]
// Memerlukan env: DATABASE_URL (di .env.local saat local, / vercel env saat prod)
// Contoh:
//   node scripts/seed-users.js rank.glc "password123" "RANK GLC" "RANK GLC" "operator"
//   node scripts/seed-users.js rank.kld "password123" "RANK KALIDERES" "RANK KALIDERES" "operator"
// Jika user belum ada, user akan dibuat; jika sudah ada, hanya password yang diupdate.
// ============================================
import bcrypt from 'bcryptjs';
import { query } from '../api/_db.js';

const username = process.argv[2] || 'admin';
const newPassword = process.argv[3] || 'password';
const nama = process.argv[4] || username;
const toko = process.argv[5] || 'Toko Utama';
const role = process.argv[6] || 'operator';

const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(newPassword, salt);

try {
  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length === 0) {
    const ins = await query(
      'INSERT INTO users (username, password, nama, role, toko) VALUES ($1,$2,$3,$4,$5) RETURNING id, username',
      [username, hash, nama, role, toko]
    );
    const id = ins.rows[0].id;
    await query(
      `INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, setting_key) DO NOTHING`,
      [id, 'dark_mode', '0']
    );
    await query(
      `INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, setting_key) DO NOTHING`,
      [id, 'ekspedisi_aktif', JSON.stringify(['JNT','JNTC','JNE','SICEPAT','POS','NINJA','ANTERAJA','SPX','LAZADA','IDX','LION','WAHANA','SAP','TIKI'])]
    );
    console.log('User dibuat:', username, `(nama=${nama}, toko=${toko}, role=${role})`);
  } else {
    const r = await query('UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username', [hash, username]);
    console.log('Password diperbarui untuk:', r.rows[0].username);
  }
} catch (e) {
  console.error('Gagal seed user:', e.message || e);
  process.exit(1);
}
process.exit(0);
