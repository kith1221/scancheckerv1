// ============================================
// Account API (profile + password + logout)
//   POST /api/account  { action: 'save_profile', toko }
//   POST /api/account  { action: 'change_password', old_password, new_password }
//   POST /api/account  { action: 'logout' }
// ============================================
import { query } from './_db.js';
import { getSessionUser, verifyPassword, hashPassword, destroySession, clearCookie, COOKIE_NAME } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch (e) { return res.status(400).json({ success: false, message: 'Body tidak valid' }); }

  const action = body.action || '';

  // Logout: proses DULU sebelum cek auth (sesi lama dihancurkan + cookie dibersihkan).
  if (action === 'logout') {
    await destroySession(req).catch(() => {});
    res.setHeader('Set-Cookie', clearCookie(COOKIE_NAME));
    return res.status(200).json({ success: true, message: 'Logout berhasil.' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  try {
    if (action === 'save_profile') {
      const toko = String(body.toko || '').trim();
      if (!toko) return res.status(400).json({ success: false, message: 'Nama toko wajib diisi' });
      await query('UPDATE users SET toko = $1 WHERE id = $2', [toko, user.id]);
      await query(
        `INSERT INTO settings (user_id, setting_key, setting_value) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3, updated_at = NOW()`,
        [user.id, 'nama_toko', toko]
      );
      return res.status(200).json({ success: true, message: 'Profil berhasil disimpan.' });
    }

    if (action === 'change_password') {
      const oldPw = String(body.old_password || '');
      const newPw = String(body.new_password || '');
      if (newPw.length < 6) {
        return res.status(400).json({ success: false, message: 'Password lama salah atau password baru terlalu pendek.' });
      }
      const r = await query('SELECT password FROM users WHERE id = $1', [user.id]);
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
      const ok = await verifyPassword(oldPw, r.rows[0].password);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Password lama salah atau password baru terlalu pendek.' });
      }
      const hashed = await hashPassword(newPw);
      await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
      return res.status(200).json({ success: true, message: 'Password berhasil diubah.' });
    }

    return res.status(400).json({ success: false, message: 'Aksi tidak dikenal.' });
  } catch (e) {
    console.error('account error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}
