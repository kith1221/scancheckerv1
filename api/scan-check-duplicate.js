// ============================================
// GET /api/scan-check-duplicate?resi=...&date=...
// Cek apakah resi sudah discan pada tanggal tertentu.
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const resi = String(req.query.resi || '').trim();
  const date = String(req.query.date || '').trim();
  if (!resi) return res.status(400).json({ success: false, message: 'Resi diperlukan' });

  try {
    // Duplikat dicek terhadap SEMUA user/toko pada tanggal yang sama (seperti PHP asli).
    const r = await query(
      `SELECT id, scan_time, ekspedisi FROM scans
        WHERE no_resi = $1 AND scan_date = $2
        LIMIT 1`,
      [resi, date]
    );
    const row = r.rows[0];
    if (row) {
      return res.status(200).json({
        success: true,
        is_duplicate: true,
        scan_id: row.id,
        scan_time: String(row.scan_time).slice(0, 5),
        ekspedisi: row.ekspedisi,
      });
    }
    return res.status(200).json({ success: true, is_duplicate: false });
  } catch (e) {
    console.error('dup check error', e);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
