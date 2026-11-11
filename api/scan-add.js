// ============================================
// POST /api/scan-add  { no_resi, ekspedisi, ekspedisi_kode, jenis, catatan }
// Menyimpan scan milik user yang login.
// Tanggal & jam diambil dari SERVER (WIB) agar konsisten & bebas bug timezone client.
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

// Waktu WIB (UTC+7) tanpa library
function wibNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}
function wibDate() {
  const d = wibNow();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function wibTime() {
  const d = wibNow();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${mi}:${s}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  let b = {};
  try { b = req.body || {}; } catch (e) { return res.status(400).json({ success: false, message: 'Invalid body' }); }

  const no_resi = String(b.no_resi || '').trim();
  const ekspedisi = String(b.ekspedisi || 'Lainnya').trim();
  const ekspedisi_kode = String(b.ekspedisi_kode || 'OTHER').toUpperCase().trim();
  const jenis = ['pengiriman', 'retur'].includes(b.jenis) ? b.jenis : 'pengiriman';
  const catatan = String(b.catatan || '').trim();
  const produk_retur = String(b.produk_retur || '').trim();
  const kondisi_retur = String(b.kondisi_retur || '').trim();
  const keterangan_retur = String(b.keterangan_retur || '').trim();
  const sku_retur = String(b.sku_retur || '').trim();

  if (no_resi.length < 5) return res.status(400).json({ success: false, message: 'Nomor resi terlalu pendek (min. 5 karakter)' });
  if (no_resi.length > 100) return res.status(400).json({ success: false, message: 'Nomor resi terlalu panjang (max. 100 karakter)' });

  const scan_date = wibDate();
  const scan_time = wibTime();

  try {
    // Cegah duplikat di sisi SERVER (kunci anti-race & anti double-submit).
    // Duplikat dicek terhadap SEMUA user/toko pada tanggal yang sama (seperti PHP asli).
    const dup = await query(
      `SELECT id, scan_time, ekspedisi FROM scans
        WHERE no_resi = $1 AND scan_date = $2
        LIMIT 1`,
      [no_resi, scan_date]
    );
    if (dup.rows.length > 0) {
      const row = dup.rows[0];
      return res.status(200).json({
        success: true,
        is_duplicate: true,
        scan_id: row.id,
        scan_time: String(row.scan_time).slice(0, 5),
        ekspedisi: row.ekspedisi,
        message: 'Duplikat! Resi sudah discan hari ini',
      });
    }

    const r = await query(
      `INSERT INTO scans
         (no_resi, ekspedisi, ekspedisi_kode, jenis, user_id, username, toko, scan_date, scan_time, catatan, produk_retur, kondisi_retur, keterangan_retur, sku_retur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [no_resi, ekspedisi, ekspedisi_kode, jenis, user.id, user.username, user.toko, scan_date, scan_time, catatan, produk_retur || null, kondisi_retur || null, keterangan_retur || null, sku_retur || null]
    );
    const id = r.rows[0].id;
    return res.status(200).json({ success: true, message: 'Scan berhasil disimpan', data: { id, scan_time } });
  } catch (e) {
    console.error('scan add error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}
