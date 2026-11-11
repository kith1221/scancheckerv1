// ============================================
// GET /api/stats
// Dashboard stats: today/month/all-time totals, last-7-days chart,
// and per-expedition counts for today.
// Operator melihat datanya sendiri; admin melihat semua.
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const isAdmin = user.role === 'admin';
  const tNow = new Date(Date.now() + 7 * 60 * 60 * 1000); // WIB
  const today = tNow.toISOString().slice(0, 10); // YYYY-MM-DD
  const thisMonth = today.slice(0, 7); // YYYY-MM

  const userFilter = isAdmin ? '' : 'AND user_id = $uidParam';
  const params = (extra) => {
    const p = [];
    if (!isAdmin) p.push(user.id);
    if (extra) p.push(...extra);
    return p;
  };

  try {
    const countByJenis = async (dateCond, monthCond, jenis) => {
      const conds = [];
      const vals = [];
      let idx = 1;
      if (dateCond) { conds.push(`scan_date = $${idx++}`); vals.push(dateCond); }
      if (monthCond) { conds.push(`to_char(scan_date,'YYYY-MM') = $${idx++}`); vals.push(monthCond); }
      if (jenis) { conds.push(`jenis = $${idx++}`); vals.push(jenis); }
      if (!isAdmin) { conds.push(`user_id = $${idx++}`); vals.push(user.id); }
      const r = await query(`SELECT COUNT(*)::int AS c FROM scans WHERE ${conds.join(' AND ')}`, vals);
      return r.rows[0].c;
    };

    const todayPengiriman = await countByJenis(today, null, 'pengiriman');
    const todayRetur = await countByJenis(today, null, 'retur');
    const monthPengiriman = await countByJenis(null, thisMonth, 'pengiriman');
    const monthRetur = await countByJenis(null, thisMonth, 'retur');
    const totalPengiriman = await countByJenis(null, null, 'pengiriman');
    const totalRetur = await countByJenis(null, null, 'retur');

    // Last 7 days chart
    const chart7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(tNow.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const conds = [`scan_date = $1`];
      const vals = [d];
      if (!isAdmin) { conds.push(`user_id = $2`); vals.push(user.id); }
      const r = await query(`SELECT COUNT(*)::int AS c FROM scans WHERE ${conds.join(' AND ')}`, vals);
      const [yy, mm, dd] = d.split('-');
      chart7days.push({ date: `${dd}/${mm}`, count: r.rows[0].c });
    }

    // Per expedition today
    const expConds = ['scan_date = $1'];
    const expVals = [today];
    if (!isAdmin) { expConds.push(`user_id = $2`); expVals.push(user.id); }
    const expR = await query(
      `SELECT ekspedisi_kode, ekspedisi, COUNT(*)::int AS cnt
         FROM scans
        WHERE ${expConds.join(' AND ')}
        GROUP BY ekspedisi_kode, ekspedisi
        ORDER BY cnt DESC`,
      expVals
    );
    const byExpedition = expR.rows;

    return res.status(200).json({
      success: true,
      data: {
        today_pengiriman: todayPengiriman,
        today_retur: todayRetur,
        month_pengiriman: monthPengiriman,
        month_retur: monthRetur,
        total_pengiriman: totalPengiriman,
        total_retur: totalRetur,
        chart_7days: chart7days,
        by_expedition: byExpedition,
      },
    });
  } catch (e) {
    console.error('stats error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}
