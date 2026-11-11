// ============================================
// Feedback API
//   GET  /api/feedback -> riwayat feedback sendiri (max 20)
//   POST /api/feedback -> { judul, pesan }
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  if (req.method === 'GET') {
    try {
      const r = await query(
        'SELECT id, judul, pesan, status, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
        [user.id]
      );
      return res.status(200).json({ success: true, data: r.rows });
    } catch (e) {
      console.error('feedback get error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
    catch (e) { return res.status(400).json({ success: false, message: 'Body tidak valid' }); }

    const judul = String(body.judul || '').trim();
    const pesan = String(body.pesan || '').trim();
    if (!judul || !pesan) {
      return res.status(400).json({ success: false, message: 'Mohon lengkapi judul dan pesan.' });
    }

    try {
      await query('INSERT INTO feedback (user_id, judul, pesan) VALUES ($1, $2, $3)', [user.id, judul, pesan]);
      return res.status(200).json({ success: true, message: 'Feedback berhasil dikirim. Terima kasih!' });
    } catch (e) {
      console.error('feedback post error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
