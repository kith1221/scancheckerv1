// ============================================
// GET /api/scan-list           -> list (filter: date, search, ekspedisi, jenis, page, per_page)
// GET /api/scan-list?id=123    -> detail 1 baris (read)
// GET /api/scan-list?mode=report&from=..&to=.. -> laporan grafik (admin only)
// POST /api/scan-list          -> update 1 baris (edit)
// Operator: data sendiri; admin: semua.
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

// Validasi string tanggal YYYY-MM-DD nyata (14-13-99 dsb ditolak).
function isValidDateParam(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Timestamp "hari ini" WIB (UTC+7), konsisten dengan scan-add.
function todayWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---- LAPORAN GRAFIK (admin only) ----
// GET /api/scan-list?mode=report&from=YYYY-MM-DD&to=YYYY-MM-DD
async function reportHandler(req, res, user) {
  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Khusus admin' });
  }
  const rawFrom = String(req.query.from || '').trim();
  const rawTo = String(req.query.to || '').trim();
  if (rawFrom && !isValidDateParam(rawFrom)) {
    return res.status(400).json({ success: false, message: 'Format tanggal dari tidak valid (YYYY-MM-DD)' });
  }
  if (rawTo && !isValidDateParam(rawTo)) {
    return res.status(400).json({ success: false, message: 'Format tanggal sampai tidak valid (YYYY-MM-DD)' });
  }
  let from = rawFrom || todayWIB();
  let to = rawTo || todayWIB();
  if (from > to) { const t = from; from = to; to = t; }
  const days = Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000) + 1;
  if (days > 426) {
    return res.status(400).json({ success: false, message: 'Rentang maksimal 426 hari' });
  }

  try {
    const base = `FROM scans WHERE scan_date >= $1 AND scan_date <= $2`;
    const bp = [from, to];

    const s1 = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE jenis = 'pengiriman')::int AS pengiriman,
              COUNT(*) FILTER (WHERE jenis = 'retur')::int AS retur
         ${base}`, bp);

    const s2 = await query(
      `SELECT ekspedisi_kode, MAX(ekspedisi) AS ekspedisi,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE jenis = 'pengiriman')::int AS pengiriman,
              COUNT(*) FILTER (WHERE jenis = 'retur')::int AS retur
         ${base}
        GROUP BY ekspedisi_kode
        ORDER BY total DESC, ekspedisi_kode ASC`, bp);

    const s3 = await query(
      `SELECT to_char(scan_date, 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS total
         ${base}
        GROUP BY scan_date
        ORDER BY scan_date`, bp);

    const topDates = s3.rows
      .slice()
      .sort((a, b) => b.total - a.total || (a.tanggal > b.tanggal ? 1 : -1))
      .slice(0, 15);

    const s4 = await query(
      `SELECT username, COUNT(*)::int AS total
         ${base}
        GROUP BY username
        ORDER BY total DESC, username ASC`, bp);

    const s5 = await query(
      `SELECT toko, COUNT(*)::int AS total
         ${base}
        GROUP BY toko
        ORDER BY total DESC, toko ASC`, bp);

    const s6 = await query(
      `SELECT no_resi, COUNT(*)::int AS jumlah,
              to_char(MIN(scan_date), 'YYYY-MM-DD') AS tanggal_awal,
              to_char(MAX(scan_date), 'YYYY-MM-DD') AS tanggal_akhir
         ${base}
        GROUP BY no_resi
        HAVING COUNT(*) > 1
        ORDER BY jumlah DESC, no_resi ASC
        LIMIT 20`, bp);

    return res.status(200).json({
      success: true,
      data: {
        dari: from,
        sampai: to,
        total: s1.rows[0].total,
        pengiriman: s1.rows[0].pengiriman,
        retur: s1.rows[0].retur,
        by_expedition: s2.rows.map((r) => ({
          kode: r.ekspedisi_kode, nama: r.ekspedisi, total: r.total, pengiriman: r.pengiriman, retur: r.retur,
        })),
        by_date: s3.rows.map((r) => ({ tanggal: r.tanggal, total: r.total })),
        top_dates: topDates.map((r) => ({ tanggal: r.tanggal, total: r.total })),
        by_operator: s4.rows.map((r) => ({ username: r.username, total: r.total })),
        by_toko: s5.rows.map((r) => ({ toko: r.toko, total: r.total })),
        duplikat_resi: s6.rows.map((r) => ({ no_resi: r.no_resi, jumlah: r.jumlah, tanggal_awal: r.tanggal_awal, tanggal_akhir: r.tanggal_akhir })),
      },
    });
  } catch (e) {
    console.error('report error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const isAdmin = user.role === 'admin';

  // ---- LAPORAN GRAFIK (admin only) ----
  if (req.method === 'GET' && req.query.mode === 'report') {
    return reportHandler(req, res, user);
  }

  // ---- READ (GET ?id=123 -> detail 1 baris) ----
  if (req.method === 'GET' && req.query.id) {
    const id = parseInt(req.query.id, 10) || 0;
    if (id <= 0) return res.status(400).json({ success: false, message: 'ID tidak valid' });
    try {
      let where = 'id = $1';
      const params = [id];
      if (!isAdmin) { params.push(user.id); where += ' AND user_id = $2'; }
      const r = await query(
        `SELECT id, no_resi, ekspedisi, ekspedisi_kode, jenis, username, toko, scan_date, scan_time, catatan,
                produk_retur, kondisi_retur, keterangan_retur, sku_retur
           FROM scans WHERE ${where} LIMIT 1`,
        params
      );
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
      return res.status(200).json({ success: true, data: r.rows[0] });
    } catch (e) {
      console.error('scan get error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  // ---- UPDATE (POST -> edit 1 baris) ----
  if (req.method === 'POST') {
    let b = {};
    try { b = req.body || {}; } catch (e) { return res.status(400).json({ success: false, message: 'Invalid body' }); }
    const id = parseInt(b.id, 10) || 0;
    if (id <= 0) return res.status(400).json({ success: false, message: 'ID tidak valid' });

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

    try {
      let where = 'id = $1';
      const params = [id];
      if (!isAdmin) { params.push(user.id); where += ' AND user_id = $2'; }
      const chk = await query(`SELECT id FROM scans WHERE ${where} LIMIT 1`, params);
      if (chk.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data tidak ditemukan atau tidak berhak mengubah' });
      }
      const r = await query(
        `UPDATE scans SET
           no_resi = $1, ekspedisi = $2, ekspedisi_kode = $3, jenis = $4,
           catatan = $5, produk_retur = $6, kondisi_retur = $7, keterangan_retur = $8, sku_retur = $9
         WHERE id = $10`,
        [no_resi, ekspedisi, ekspedisi_kode, jenis, catatan || null, produk_retur || null, kondisi_retur || null, keterangan_retur || null, sku_retur || null, id]
      );
      if (r.rowCount > 0) return res.status(200).json({ success: true, message: 'Data berhasil diperbarui' });
      return res.status(200).json({ success: false, message: 'Tidak ada perubahan' });
    } catch (e) {
      console.error('scan update error', e);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  // Jika tanggal tidak dikirim, gunakan "hari ini" WIB (UTC+7) agar sinkron dengan scan-add
  const rawDate = String(req.query.date || '').trim();
  if (rawDate && !isValidDateParam(rawDate)) {
    return res.status(400).json({ success: false, message: 'Format tanggal tidak valid (YYYY-MM-DD)' });
  }
  const date = rawDate || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const search = String(req.query.search || '').trim();
  const ekspedisi = String(req.query.ekspedisi || '').toUpperCase().trim();
  const jenis = String(req.query.jenis || '').trim();
  const perPage = Math.min(500, Math.max(10, parseInt(req.query.per_page, 10) || 20));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * perPage;

  function inCond(col, raw, iObj) {
    const list = raw.split(',').filter(Boolean);
    if (list.length === 0) return { sql: '', params: [] };
    if (list.length === 1) return { sql: `${col} = $${iObj.i++}`, params: [list[0]] };
    const ph = list.map(() => `$${iObj.i++}`).join(',');
    return { sql: `${col} IN (${ph})`, params: list };
  }

  const conds = [];
  const params = [];
  const iObj = { i: 1 };
  const uid = isAdmin ? (parseInt(req.query.user_id, 10) || 0) : 0;

  if (date) { conds.push(`scan_date = $${iObj.i++}`); params.push(date); }
  if (search) { conds.push(`no_resi LIKE $${iObj.i++}`); params.push(`%${search}%`); }
  let ex = inCond('ekspedisi_kode', ekspedisi, iObj);
  if (ex.sql) { conds.push(ex.sql); params.push(...ex.params); }
  let jn = inCond('jenis', jenis, iObj);
  if (jn.sql) { conds.push(jn.sql); params.push(...jn.params); }
  if (!isAdmin) { conds.push(`user_id = $${iObj.i++}`); params.push(user.id); }
  else if (uid > 0) { conds.push(`user_id = $${iObj.i++}`); params.push(uid); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  try {
    const countR = await query(`SELECT COUNT(*)::int AS total FROM scans ${where}`, params);
    const total = countR.rows[0].total;

    const dataR = await query(
      `SELECT id, no_resi, ekspedisi, ekspedisi_kode, jenis, username, toko, scan_date, scan_time, catatan, produk_retur, kondisi_retur, keterangan_retur, sku_retur
         FROM scans ${where}
        ORDER BY scan_date DESC, scan_time DESC
        LIMIT $${iObj.i} OFFSET $${iObj.i + 1}`,
      [...params, perPage, offset]
    );
    const scans = dataR.rows;

    // Count per ekspedisi (untuk tanggal filter)
    const countDate = date;
    const cConds = [`scan_date = $1`];
    const cParams = [countDate];
    const cObj = { i: 2 };
    if (jenis) {
      const cj = inCond('jenis', jenis, cObj);
      if (cj.sql) { cConds.push(cj.sql); cParams.push(...cj.params); }
    }
    if (!isAdmin) { cConds.push(`user_id = $${cObj.i++}`); cParams.push(user.id); }
    else if (uid > 0) { cConds.push(`user_id = $${cObj.i++}`); cParams.push(uid); }
    const expR = await query(
      `SELECT ekspedisi_kode, COUNT(*)::int AS cnt FROM scans WHERE ${cConds.join(' AND ')} GROUP BY ekspedisi_kode`,
      cParams
    );
    const counts = {};
    for (const row of expR.rows) counts[row.ekspedisi_kode] = row.cnt;

    return res.status(200).json({ success: true, data: { scans, total, counts, today: date } });
  } catch (e) {
    console.error('scan list error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}
