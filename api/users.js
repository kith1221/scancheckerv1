// ============================================
// Users API (admin only)
//   GET  /api/users -> list users + scan counts
//   POST /api/users -> { action: 'create'|'toggle'|'delete'|'reset_password', ... }
// ============================================
import bcrypt from 'bcryptjs';
import { query } from './_db.js';
import { getSessionUser, hashPassword } from './_auth.js';


export default async function handler(req, res) {
  const admin = await getSessionUser(req);
  if (!admin) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (admin.role !== 'admin') return res.status(403).json({ success: false, message: 'Akses ditolak' });

  if (req.method === 'GET') {
    try {
      const r = await query(
        `SELECT u.id, u.username, u.nama, u.role, u.toko, u.active, u.last_login,
                (SELECT COUNT(*) FROM scans WHERE user_id = u.id)::int AS total_scans
           FROM users u
          ORDER BY u.role, u.nama`
      );
      return res.status(200).json({ success: true, data: r.rows });
    } catch (e) {
      console.error('users get error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
    catch (e) { return res.status(400).json({ success: false, message: 'Body tidak valid' }); }

    const action = body.action || '';

    try {
      if (action === 'create') {
        const uname = String(body.username || '').trim();
        const nama = String(body.nama || '').trim();
        const pw = String(body.password || '');
        const role = (body.role === 'admin' || body.role === 'operator') ? body.role : 'operator';
        const toko = String(body.toko || '').trim() || 'Toko Utama';

        if (!uname || !nama || pw.length < 6) {
          return res.status(400).json({ success: false, message: 'Lengkapi semua field. Password minimal 6 karakter.' });
        }

        const hashed = await hashPassword(pw);
        let newId;
        try {
          const ins = await query(
            'INSERT INTO users (username, password, nama, role, toko) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [uname, hashed, nama, role, toko]
          );
          newId = ins.rows[0].id;
        } catch (e) {
          return res.status(409).json({ success: false, message: 'Username sudah ada.' });
        }

        await query(
          `INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, setting_key) DO NOTHING`,
          [newId, 'dark_mode', '1']
        );
        await query(
          `INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, setting_key) DO NOTHING`,
          [newId, 'ekspedisi_aktif', JSON.stringify(['JNT','JNTC','JNE','SICEPAT','POS','NINJA','ANTERAJA','SPX','LAZADA','IDX','LION','WAHANA','SAP','TIKI'])]
        );
        return res.status(200).json({ success: true, message: 'Pengguna berhasil ditambahkan.' });
      }

      if (action === 'toggle') {
        const id = parseInt(body.id, 10) || 0;
        if (id !== admin.id) {
          await query('UPDATE users SET active = NOT active WHERE id = $1', [id]);
          return res.status(200).json({ success: true, message: 'Status pengguna diperbarui.' });
        }
        return res.status(400).json({ success: false, message: 'Tidak dapat mengubah status akun sendiri.' });
      }

      if (action === 'delete') {
        const id = parseInt(body.id, 10) || 0;
        if (id === admin.id) {
          return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri.' });
        }
        if (id > 0) {
          await query('DELETE FROM users WHERE id = $1', [id]);
          return res.status(200).json({ success: true, message: 'Pengguna berhasil dihapus.' });
        }
        return res.status(400).json({ success: false, message: 'ID tidak valid.' });
      }

      if (action === 'reset_password') {
        const id = parseInt(body.id, 10) || 0;
        const pw = String(body.new_password || '');
        if (id > 0 && pw.length >= 6) {
          const hashed = await hashPassword(pw);
          await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, id]);
          return res.status(200).json({ success: true, message: 'Password berhasil direset.' });
        }
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
      }

      return res.status(400).json({ success: false, message: 'Aksi tidak dikenal.' });
    } catch (e) {
      console.error('users post error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
