// ============================================
// Scan Delete API
//   POST /api/scan-delete
//   { id }          -> hapus satu baris
//   { ids: [] }     -> hapus beberapa baris
//   { delete_all }  -> hapus semua data scan (admin only)
//   { filters }     -> hapus massal berdasarkan kriteria (admin only)
//                      filters: date_from, date_to, jenis[], ekspedisi[], user_id
//   { preview: true, filters } -> hanya hitung jumlah yang cocok, tanpa menghapus
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

function buildMassWhere(f) {
  const conds = [];
  const params = [];
  let i = 1;
  if (f.date_from) { conds.push(`scan_date >= $${i++}`); params.push(String(f.date_from).slice(0, 10)); }
  if (f.date_to) { conds.push(`scan_date <= $${i++}`); params.push(String(f.date_to).slice(0, 10)); }

  const splitList = (v) => Array.isArray(v)
    ? v.map(x => String(x)).filter(Boolean)
    : (typeof v === 'string' && v.trim() ? v.split(',').map(x => x.trim()).filter(Boolean) : []);
  const jenisList = splitList(f.jenis);
  if (jenisList.length === 1) { conds.push(`jenis = $${i++}`); params.push(jenisList[0]); }
  else if (jenisList.length > 1) {
    const ph = jenisList.map(() => `$${i++}`).join(',');
    conds.push(`jenis IN (${ph})`);
    params.push(...jenisList);
  }

  const expList = splitList(f.ekspedisi).map(x => x.toUpperCase());
  if (expList.length === 1) { conds.push(`ekspedisi_kode = $${i++}`); params.push(expList[0]); }
  else if (expList.length > 1) {
    const ph = expList.map(() => `$${i++}`).join(',');
    conds.push(`ekspedisi_kode IN (${ph})`);
    params.push(...expList);
  }

  if (f.user_id) {
    const uid = parseInt(f.user_id, 10);
    if (Number.isInteger(uid) && uid > 0) { conds.push(`user_id = $${i++}`); params.push(uid); }
  }

  if (!conds.length) return null;
  return { where: conds.join(' AND '), params };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch (e) { return res.status(400).json({ success: false, message: 'Body tidak valid' }); }

  try {
    if (body.filters && typeof body.filters === 'object') {
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Hanya admin yang dapat melakukan pembersihan massal.' });
      }
      const built = buildMassWhere(body.filters);
      if (!built) {
        return res.status(400).json({ success: false, message: 'Pilih minimal satu kriteria pembersihan.' });
      }
      const where = 'WHERE ' + built.where;
      if (body.preview) {
        const c = await query(`SELECT COUNT(*)::int AS total FROM scans ${where}`, built.params);
        return res.status(200).json({ success: true, count: c.rows[0].total });
      }
      const r = await query(`DELETE FROM scans ${where}`, built.params);
      return res.status(200).json({ success: true, message: `${r.rowCount} data berhasil dihapus`, deleted: r.rowCount });
    }

    if (body.delete_all) {
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Hanya admin yang dapat menghapus semua data.' });
      }
      await query('DELETE FROM scans');
      return res.status(200).json({ success: true, message: 'Semua data scan berhasil dihapus' });
    }

    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = [...new Set(body.ids.map(x => parseInt(x, 10)))]
        .filter(x => Number.isInteger(x) && x > 0);
      if (!ids.length) return res.status(400).json({ success: false, message: 'ID tidak valid' });
      const placeholders = ids.map((_, i) => '$' + (i + 1)).join(',');
      const r = await query(`DELETE FROM scans WHERE id IN (${placeholders})`, ids);
      return res.status(200).json({
        success: true,
        message: `${r.rowCount} data berhasil dihapus`,
        deleted: r.rowCount
      });
    }

    const id = parseInt(body.id, 10) || 0;
    if (id <= 0) return res.status(400).json({ success: false, message: 'ID tidak valid' });

    const r = await query('DELETE FROM scans WHERE id = $1', [id]);
    if (r.rowCount > 0) {
      return res.status(200).json({ success: true, message: 'Data berhasil dihapus' });
    }
    return res.status(200).json({ success: false, message: 'Data tidak ditemukan' });
  } catch (e) {
    console.error('scan delete error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}
