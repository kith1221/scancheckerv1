// ============================================
// Account / Session API
//   GET  /api/me      -> user saat ini (jika login)
//   POST /api/logout  -> hapus sesi & cookie
// ============================================
import { getSessionUser, destroySession, clearCookie, COOKIE_NAME } from './_auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const user = await getSessionUser(req);
      if (!user) {
        return res.status(401).json({
          success: false, message: 'Not authenticated', data: null,
          config: { turnstileSiteKey: process.env.CF_TURNSTILE_SITE_KEY || '' },
        });
      }
      return res.status(200).json({ success: true, data: user });
    } catch (e) {
      console.error('me error', e);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      await destroySession(req);
      res.setHeader('Set-Cookie', clearCookie(COOKIE_NAME));
      return res.status(200).json({ success: true, message: 'Logout berhasil' });
    } catch (e) {
      console.error('logout error', e);
      return res.status(200).json({ success: true, message: 'Logout berhasil' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
