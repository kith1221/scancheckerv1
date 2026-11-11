// ============================================
// Settings API
//   GET  /api/settings            -> { success, data: { key: value, ... } }
//   POST /api/settings            -> { key, value } upsert per-user
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  if (req.method === 'GET') {
    try {
      const r = await query('SELECT setting_key, setting_value FROM settings WHERE user_id = $1', [user.id]);
      const settings = {};
      for (const row of r.rows) settings[row.setting_key] = row.setting_value;
      return res.status(200).json({ success: true, data: settings });
    } catch (e) {
      console.error('settings get error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
    catch (e) { return res.status(400).json({ success: false, message: 'Body tidak valid' }); }

    const key = String(body.key || '').trim();
    const value = body.value === undefined || body.value === null ? '' : String(body.value);
    if (!key) return res.status(400).json({ success: false, message: 'Key diperlukan' });

    try {
      await query(
        `INSERT INTO settings (user_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3, updated_at = NOW()`,
        [user.id, key, value]
      );
      return res.status(200).json({ success: true, message: 'Setting disimpan' });
    } catch (e) {
      console.error('settings post error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
