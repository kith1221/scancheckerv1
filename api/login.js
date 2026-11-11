// ============================================
// POST /api/login  { username, password }
// ============================================
import { query } from './_db.js';
import { verifyPassword, createSession, serializeCookie, COOKIE_NAME } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  let body = {};
  try { body = req.body || {}; } catch (e) { return res.status(400).json({ success: false, message: 'Invalid body' }); }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }

  // ---- Cloudflare Turnstile (proteksi login dari bot/brute) ----
  // Aktif hanya jika CF_TURNSTILE_SECRET_KEY di-setting di Vercel env.
  const siteSecret = process.env.CF_TURNSTILE_SECRET_KEY || '';
  const turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '');
  if (siteSecret) {
    if (!turnstileToken) {
      return res.status(400).json({ success: false, message: 'Selesaikan verifikasi keamanan (CAPTCHA) terlebih dahulu.' });
    }
    try {
      const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: siteSecret, response: turnstileToken }),
      });
      const vj = await vr.json();
      if (!vj || vj.success !== true) {
        return res.status(403).json({ success: false, message: 'Verifikasi keamanan gagal. Muat ulang halaman dan coba lagi.' });
      }
    } catch (e) {
      console.error('turnstile verify error', e);
      return res.status(403).json({ success: false, message: 'Verifikasi keamanan tidak dapat diproses. Coba lagi.' });
    }
  }

  try {
    const r = await query(
      'SELECT id, username, password, nama, role, toko, active FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    const user = r.rows[0];

    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Username atau password salah, atau akun tidak aktif.' });
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Username atau password salah, atau akun tidak aktif.' });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Single-session: login di device baru menonaktifkan semua sesi lama user ini
    // agar perangkat lama otomatis ter-logout.
    await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

    const session = await createSession(user.id);
    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, session.token, session.maxAge));
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: { id: user.id, username: user.username, nama: user.nama, role: user.role, toko: user.toko },
    });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
