// ============================================
// Export API
//   GET /api/export?format=xlsx|csv|print
//   Filters: date, search, ekspedisi, jenis
//   Operator melihat datanya sendiri; admin melihat semua.
//   xlsx: 2 sheet (Data Scan + Rekap Ekspedisi) built manually, store-only ZIP.
//   csv:  sep=, directive + UTF-8 BOM + baris "total = N".
//   print: HTML tabel dengan window.print().
// ============================================
import { query } from './_db.js';
import { getSessionUser } from './_auth.js';

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EXP_NAMES = {
  JNT: 'J&T Express', JNTC: 'J&T Cargo', JNE: 'JNE Express', SICEPAT: 'SiCepat',
  POS: 'Pos Indonesia', NINJA: 'Ninja Xpress', ANTERAJA: 'AnterAja', SPX: 'Shopee Express',
  LAZADA: 'Lazada Logistics', IDX: 'ID Express', LION: 'Lion Parcel', WAHANA: 'Wahana',
  SAP: 'SAP Express', TIKI: 'TIKI', OTHER: 'Lainnya',
};

function expName(code) {
  return EXP_NAMES[code] || code;
}

// ---- Minimal ZIP writer (STORE, method 0) ----
function crc32(buf) {
  let crc = 0xffffffff;
  const table = crc32.table;
  for (let i = 0; i < buf.length; i++) {
    const c = (crc ^ buf[i]) & 0xff;
    crc = (crc >>> 8) ^ table[c];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
crc32.table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function buildZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(dataBuf);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(0, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0x21, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(dataBuf.length, 18);
    lfh.writeUInt32LE(dataBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    parts.push(lfh, nameBuf, dataBuf);
    central.push({ name: nameBuf, crc, size: dataBuf.length, offset });
    offset += lfh.length + nameBuf.length + dataBuf.length;
  }

  const cdStart = offset;
  const centralBufs = [];
  for (const c of central) {
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(c.crc, 16);
    cd.writeUInt32LE(c.size, 20);
    cd.writeUInt32LE(c.size, 24);
    cd.writeUInt16LE(c.name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(c.offset, 42);
    centralBufs.push(cd, c.name);
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  const cdSize = centralBufs.reduce((a, b) => a + b.length, 0);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...centralBufs, eocd]);
}

// ---- Shared strings builder ----
function createSharedStringsBuilder() {
  const list = [];
  const map = {};
  return {
    add(val) {
      const v = String(val);
      if (!(v in map)) { map[v] = list.length; list.push(v); }
      return map[v];
    },
    get list() { return list; },
    build() {
      let s = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'
        + list.length + '" uniqueCount="' + list.length + '">';
      for (const text of list) s += '<si><t>' + escXml(text) + '</t></si>';
      s += '</sst>';
      return s;
    },
  };
}

// ---- Build the xlsx file (store ZIP) ----
function buildXlsx(scans, rekap, useReturCols) {
  const ss = createSharedStringsBuilder();
  const header = useReturCols
    ? ['No', 'No Resi', 'Ekspedisi', 'SKU', 'Produk', 'Kondisi', 'Operator', 'Toko', 'Tanggal', 'Waktu']
    : ['No', 'No Resi', 'Ekspedisi', 'Operator', 'Toko', 'Tanggal', 'Waktu'];
  const colLetters = ['A','B','C','D','E','F','G','H','I','J'];
  const lastCol = colLetters[header.length - 1];
  const totalData = scans.length;

  // Sheet 1: Data Scan
  let s1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="A1:${lastCol}${2 + totalData}"/><sheetData>`;
  s1 += '<row r="1">';
  header.forEach((h, ci) => { s1 += `<c r="${colLetters[ci]}1" t="s" s="1"><v>${ss.add(h)}</v></c>`; });
  s1 += '</row>';
  let no = 1;
  let rn = 2;
  for (const s of scans) {
    let vals;
    if (useReturCols) {
      const kondisi = s.kondisi_retur === 'sesuai' ? 'Sesuai' : (s.kondisi_retur ? 'Tidak Sesuai' : '');
      vals = [
        [colLetters[0] + rn, String(no++), true],
        [colLetters[1] + rn, s.no_resi, false],
        [colLetters[2] + rn, s.ekspedisi, false],
        [colLetters[3] + rn, s.sku_retur || '', false],
        [colLetters[4] + rn, s.produk_retur || '', false],
        [colLetters[5] + rn, kondisi, false],
        [colLetters[6] + rn, s.username, false],
        [colLetters[7] + rn, s.toko, false],
        [colLetters[8] + rn, s.scan_date, false],
        [colLetters[9] + rn, String(s.scan_time || '').slice(0, 5), false],
      ];
    } else {
      vals = [
        [colLetters[0] + rn, String(no++), true],
        [colLetters[1] + rn, s.no_resi, false],
        [colLetters[2] + rn, s.ekspedisi, false],
        [colLetters[3] + rn, s.username, false],
        [colLetters[4] + rn, s.toko, false],
        [colLetters[5] + rn, s.scan_date, false],
        [colLetters[6] + rn, String(s.scan_time || '').slice(0, 5), false],
      ];
    }
    s1 += `<row r="${rn}">`;
    for (const [ref, value, isNum] of vals) {
      if (isNum) s1 += `<c r="${ref}" s="2"><v>${value}</v></c>`;
      else s1 += `<c r="${ref}" t="s"><v>${ss.add(value)}</v></c>`;
    }
    s1 += '</row>';
    rn++;
  }
  s1 += `<row r="${rn}"><c r="A${rn}" t="s" s="1"><v>${ss.add('total = ' + totalData)}</v></c></row>`;
  s1 += '</sheetData></worksheet>';

  // Sheet 2: Rekap Ekspedisi
  const s2LastRow = 2 + rekap.length + 2;
  let s2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="A1:B${s2LastRow}"/><sheetData>`;
  s2 += `<row r="1"><c r="A1" t="s" s="1"><v>${ss.add('Rekap Per Ekspedisi')}</v></c></row>`;
  s2 += `<row r="2"><c r="A2" t="s" s="1"><v>${ss.add('Ekspedisi')}</v></c><c r="B2" t="s" s="1"><v>${ss.add('Jumlah Resi')}</v></c></row>`;
  let r2 = 3;
  for (const [name, count] of rekap) {
    s2 += `<row r="${r2}"><c r="A${r2}" t="s"><v>${ss.add(name)}</v></c><c r="B${r2}" s="2"><v>${count}</v></c></row>`;
    r2++;
  }
  s2 += `<row r="${r2}"><c r="A${r2}" t="s" s="1"><v>${ss.add('TOTAL')}</v></c><c r="B${r2}" s="2"><v>${totalData}</v></c></row>`;
  s2 += '</sheetData></worksheet>';

  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2">'
    + '<font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
    + '</fonts>'
    + '<fills count="3">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF8E1B2E"/><bgColor indexed="64"/></patternFill></fill>'
    + '</fills>'
    + '<borders count="2">'
    + '<border><left/><right/><top/><bottom/><diagonal/></border>'
    + '<border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right>'
    + '<top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border>'
    + '</borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>'
    + '<sheet name="Data Scan" sheetId="1" r:id="rId1"/>'
    + '<sheet name="Rekap Ekspedisi" sheetId="2" r:id="rId2"/>'
    + '</sheets></workbook>';

  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
    + '</Relationships>';

  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/sharedStrings.xml', data: ss.build() },
    { name: 'xl/worksheets/sheet1.xml', data: s1 },
    { name: 'xl/worksheets/sheet2.xml', data: s2 },
  ];

  return buildZip(files);
}

// ---- Shared: build filter + fetch scans ----
function buildWhere(user, q) {
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
  if (q.date) { conds.push(`scan_date = $${iObj.i++}`); params.push(q.date); }
  if (q.search) { conds.push(`no_resi LIKE $${iObj.i++}`); params.push(`%${q.search}%`); }
  let ex = inCond('ekspedisi_kode', q.ekspedisi, iObj);
  if (ex.sql) { conds.push(ex.sql); params.push(...ex.params); }
  let jn = inCond('jenis', q.jenis, iObj);
  if (jn.sql) { conds.push(jn.sql); params.push(...jn.params); }
  if (user.role === 'admin' && q.user_id) { conds.push(`user_id = $${iObj.i++}`); params.push(parseInt(q.user_id, 10) || 0); }
  else if (user.role !== 'admin') { conds.push(`user_id = $${iObj.i++}`); params.push(user.id); }
  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
}

function nowStamp() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
}
function nowId() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${p(n.getDate())}/${p(n.getMonth() + 1)}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}`;
}

// Validasi string tanggal YYYY-MM-DD nyata (14-13-99 dsb ditolak).
function isValidDateParam(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Format tanggal pendek: '2026-08-30' / Date -> '30/08/26'
function fmtDateShort(v) {
  let d = null;
  if (v instanceof Date) d = v;
  else if (v != null) {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if (!d) return v == null ? '' : String(v).slice(0, 10);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

// ---- Minimal PDF builder (A4, tabel + rekap, tanpa library) ----
const PDF_W = 595;       // A4 width  (pt)
const PDF_H = 842;       // A4 height (pt)
const PDF_LEFT = 40;
const PDF_BOTTOM = 50;
const PDF_RIGHT = PDF_W - 40;
// Warna brand RankSports — merah #C8102E & merah tua #8E1B2E
const TEAL = '0.784 0.063 0.180';      // C8102E — merah brand (aksen)
const TEAL_DARK = '0.557 0.106 0.180'; // 8E1B2E — merah tua (header/tabel)
const LIGHT_BG = '0.969 0.855 0.867';  // F7DADD — baris total (sama dgn halaman print)
const ZEBRA = '0.98 0.941 0.945';      // FAF0F1 — baris genap (sama dgn halaman print)
const HEADER_TEXT = '1 1 1';
const BORDER = '0.733 0.733 0.733';    // BBB — border tabel (sama dgn halaman print)

// Lebar karakter Helvetica / Helvetica-Bold (standar PDF, 1/1000 em) utk ASCII 32-126
const HW = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584';
const HBW = '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584';
const WTAB = { F1: HW.split(' ').map(Number), F2: HBW.split(' ').map(Number) };
function strw(font, size, str) {
  const t = WTAB[font] || WTAB.F1;
  let w = 0;
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    w += (c < 32 || c > 126) ? 556 : t[c - 32];
  }
  return (w / 1000) * size;
}

function escPdfHex(str) {
  let hex = '';
  for (const ch of String(str)) {
    let c = ch.codePointAt(0);
    if (c > 255 || (c < 32 && c !== 9)) c = 0x3f; // non-WinAnsi -> '?'
    hex += c.toString(16).padStart(2, '0');
  }
  return hex;
}

function buildPdf(scans, rekap, meta) {
  const cols = [
    { t: 'No', w: 22 },
    { t: 'No Resi', w: 118 },
    { t: 'Ekspedisi', w: 88 },
    { t: 'Jenis', w: 38 },
    { t: 'Operator', w: 64 },
    { t: 'Toko', w: 80 },
    { t: 'Tanggal', w: 62 },
    { t: 'Waktu', w: 40 },
  ];
  const x0 = PDF_LEFT;
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const x1 = x0 + tableW;
  const colXs = [];
  let accX = x0;
  for (const c of cols) { colXs.push(accX); accX += c.w; }

  const headerH = 20;
  const rowH = 18;

  // Format tanggal: '30/08/26' (sama dengan print) + waktu
  const fmtDate = fmtDateShort;
  const fmtTime = (v) => (v == null ? '' : String(v).slice(0, 5));

  // Truncate agar pas di lebar kolom (Helvetica 9pt ~ 4.8pt/kar).
  const fit = (val, w) => {
    const s = String(val);
    const maxLen = Math.max(4, Math.floor((w - 8) / 4.8));
    return s.length > maxLen ? s.slice(0, maxLen - 3) + '...' : s;
  };

  const pages = [];
  let y = 0;
  let content = [];
  let pageNo = 1;

  const push = (s) => content.push(s);
  const nf = (v) => (Math.round(v * 100) / 100).toString();
  const text = (font, size, x, yy, str, rgb) => {
    push(`${rgb || '0 0 0'} rg`);
    push(`BT /${font} ${size} Tf ${nf(x)} ${nf(yy)} Td <${escPdfHex(str)}> Tj ET`);
  };
  const box = (x, yy, w, h) => push(`${nf(x)} ${nf(yy)} ${nf(w)} ${nf(h)} re f`);
  const rect = (x, yy, w, h) => push(`${nf(x)} ${nf(yy)} ${nf(w)} ${nf(h)} re S`);
  const line = (x1n, y1n, x2n, y2n) => push(`${nf(x1n)} ${nf(y1n)} m ${nf(x2n)} ${nf(y2n)} l S`);

  function drawTableHeader() {
    push(`${TEAL_DARK} rg`);
    box(x0, y - headerH, tableW, headerH);
    cols.forEach((c, i) => {
      const cx = colXs[i];
      text('F2', 9.5, cx + 4, y - 14, c.t, HEADER_TEXT);
    });
    push(`${TEAL_DARK} RG 0.8 w`);
    line(x0, y - headerH, x1, y - headerH);
    line(x0, y, x1, y);
    push(`${BORDER} RG 0.6 w`);
    cols.forEach((c, i) => line(colXs[i], y - headerH, colXs[i], y));
    line(x1, y - headerH, x1, y);
    line(x0, y, x1, y);
    y -= headerH;
  }

  function footer() {
    push(`${BORDER} RG 0.5 w`);
    line(x0, 36, PDF_RIGHT, 36);
    text('F1', 9, x0, 26, `Dibuat oleh Muhammad Irfandi © ${new Date().getFullYear()}`, TEAL);
    text('F1', 9, PDF_RIGHT - 30, 26, String(pageNo), '0.45 0.45 0.45');
  }

  function drawRow(values, highlight) {
    if (y - rowH < PDF_BOTTOM) {
      footer();
      pages.push(content.join('\n'));
      content = [];
      pageNo++;
      y = PDF_H - 58;
      drawTableHeader();
    }
    if (highlight) { push(`${ZEBRA} rg`); box(x0, y - rowH, tableW, rowH); }
    push(`${BORDER} RG 0.5 w`);
    cols.forEach((c, i) => {
      const cx = colXs[i];
      line(cx, y - rowH, cx, y);
      if (values[i] !== '') text('F1', 9, cx + 4, y - 12, values[i]);
    });
    line(x1, y - rowH, x1, y);
    line(x0, y - rowH, x1, y - rowH);
    y -= rowH;
  }

  // ----- halaman pertama: judul (meniru tampilan halaman print) -----
  const isAdmin = meta.role === 'admin' || meta.role === 'member';
  y = PDF_H - 58;
  const titleStr = 'RANK SPORTS - Data Scan & Retur';
  text('F2', 14, (x0 + PDF_RIGHT) / 2 - strw('F2', 14, titleStr) / 2, y, titleStr, TEAL);
  y -= 19;
  const byLine = `${isAdmin ? 'Admin' : 'Operator'}  |  ${meta.printedBy}`;
  text('F1', 10, (x0 + PDF_RIGHT) / 2 - strw('F1', 10, byLine) / 2, y, byLine, '0.35 0.35 0.4');
  y -= 14;
  text('F1', 10, (x0 + PDF_RIGHT) / 2 - strw('F1', 10, meta.filterStr) / 2, y, meta.filterStr, '0.45 0.45 0.45');
  y -= 12;
  push(`${TEAL} rg`);
  box(x0, y - 1, tableW, 3);
  y -= 24;

  // subtitle total
  push(`${LIGHT_BG} rg`);
  box(x0, y - 20, tableW, 20);
  text('F1', 10, x0 + 8, y - 14, 'Total Resi: ', '0.25 0.25 0.3');
  text('F2', 12, x0 + 8 + 50, y - 14, String(meta.total), TEAL_DARK);
  text('F1', 10, x0 + 68, y - 14, 'resi tercatat', '0.45 0.45 0.45');
  y -= 28;
  drawTableHeader();

if (scans.length === 0) {
    drawRow(['', 'Tidak ada data ditemukan', '', '', '', '', '', ''], false);
  } else {
    // kelompokkan scan per ekspedisi (urutan mengikuti rekap: terbanyak dulu)
    const byExp = {};
    for (const s of scans) {
      const k = s.ekspedisi || 'Lainnya';
      (byExp[k] = byExp[k] || []).push(s);
    }
    const groups = [];
    const used = new Set();
    for (const [name] of rekap) if (byExp[name]) { groups.push([name, byExp[name]]); used.add(name); }
    for (const k of Object.keys(byExp)) if (!used.has(k)) { groups.push([k, byExp[k]]); used.add(k); }

    for (const [name, rows] of groups) {
      // band judul bagian per ekspedisi
      if (y - 30 < PDF_BOTTOM) {
        footer();
        pages.push(content.join('\n'));
        content = [];
        pageNo++;
        y = PDF_H - 58;
        drawTableHeader();
      }
      push(`${TEAL_DARK} rg`);
      box(x0, y - 22, tableW, 22);
      text('F2', 10, x0 + 6, y - 15, 'Ekspedisi: ' + fit(name, tableW - 70) + '  ·  ' + rows.length + ' resi', HEADER_TEXT);
      y -= 30;
      // baris data bagian ini
      let rn = 0;
      for (const s of rows) {
        const jenis = s.jenis ? s.jenis.charAt(0).toUpperCase() + s.jenis.slice(1) : '';
        drawRow([
          String(rn + 1),
          fit(s.no_resi, cols[1].w),
          fit(s.ekspedisi, cols[2].w),
          fit(jenis, cols[3].w),
          fit(s.username, cols[4].w),
          fit(s.toko, cols[5].w),
          fit(fmtDate(s.scan_date), cols[6].w),
          fit(fmtTime(s.scan_time), cols[7].w),
        ], rn % 2 === 1);
        rn++;
      }
      // subtotal bagian ini
      if (y - rowH < PDF_BOTTOM) {
        footer();
        pages.push(content.join('\n'));
        content = [];
        pageNo++;
        y = PDF_H - 58;
        drawTableHeader();
      }
      push(`${LIGHT_BG} rg`);
      box(x0, y - rowH, tableW, rowH);
      push(`${BORDER} RG 0.5 w`);
      cols.forEach((c, i) => line(colXs[i], y - rowH, colXs[i], y));
      line(x1, y - rowH, x1, y);
      line(x0, y - rowH, x1, y - rowH);
      text('F2', 9, x0 + 4, y - 12, 'Subtotal ' + fit(name, 40), TEAL_DARK);
      text('F2', 9, x0 + colXs[1] + 4, y - 12, String(rows.length), TEAL_DARK);
      y -= rowH;
    }
  }

// grand total (seperti .total pada halaman print)
  if (y - rowH < PDF_BOTTOM) {
    footer();
    pages.push(content.join('\n'));
    content = [];
    pageNo++;
    y = PDF_H - 58;
    drawTableHeader();
  }
  push(`${LIGHT_BG} rg`);
  box(x0, y - rowH, tableW, rowH);
  push(`${BORDER} RG 0.5 w`);
  cols.forEach((c, i) => line(colXs[i], y - rowH, colXs[i], y));
  line(x1, y - rowH, x1, y);
  line(x0, y - rowH, x1, y - rowH);
  text('F2', 9, x0 + 4, y - 12, 'TOTAL', TEAL_DARK);
  text('F2', 9, x0 + colXs[1] + 4, y - 12, String(scans.length) + ' resi', TEAL_DARK);
  y -= rowH;

  // ----- rekap per ekspedisi (full width, seperti halaman print) -----
  if (y < PDF_BOTTOM + 110) {
    footer();
    pages.push(content.join('\n'));
    content = [];
    pageNo++;
    y = PDF_H - 58;
  }
  y -= 12;
  text('F2', 12, x0, y, 'Rekap Per Ekspedisi', TEAL_DARK);
  y -= 8;
  push(`${TEAL} rg`);
  box(x0, y - 2, tableW, 2);
  y -= 18;
  const rw = tableW, rx = x0;
  const col2 = 90, col1 = rw - col2;
  push(`${TEAL_DARK} rg`); box(rx, y - headerH, rw, headerH);
  text('F2', 9.5, rx + 4, y - 14, 'Ekspedisi', HEADER_TEXT);
  text('F2', 9.5, rx + col1 + 4, y - 14, 'Jumlah Resi', HEADER_TEXT);
  push(`${TEAL_DARK} RG 0.8 w`);
  line(rx, y - headerH, rx + rw, y - headerH);
  line(rx, y, rx + rw, y);
  push(`${BORDER} RG 0.6 w`);
  line(rx + col1, y - headerH, rx + col1, y);
  line(rx + rw, y - headerH, rx + rw, y);
  line(rx, y, rx + rw, y);
  y -= headerH;
  if (rekap.length === 0) {
    text('F1', 9, rx + 4, y - 12, 'Tidak ada data');
    if (y - rowH >= PDF_BOTTOM) y -= rowH;
  } else {
    let rn = 0;
    for (const [name, cnt] of rekap) {
      if (y - rowH < PDF_BOTTOM) {
        footer();
        pages.push(content.join('\n'));
        content = [];
        pageNo++;
        y = PDF_H - 58;
        drawTableHeader();
      }
      if (rn % 2 === 1) { push(`${ZEBRA} rg`); box(rx, y - rowH, rw, rowH); }
      push(`${BORDER} RG 0.5 w`);
      line(rx, y - rowH, rx + rw, y - rowH);
      line(rx + col1, y - rowH, rx + col1, y);
      line(rx + rw, y - rowH, rx + rw, y);
      text('F1', 9, rx + 4, y - 12, fit(name, col1 - 8));
      text('F1', 9, rx + col1 + 6, y - 12, String(cnt));
      y -= rowH;
      rn++;
    }
    // TOTAL rekap
    if (y - rowH < PDF_BOTTOM) {
      footer();
      pages.push(content.join('\n'));
      content = [];
      pageNo++;
      y = PDF_H - 58;
      drawTableHeader();
    }
push(`${LIGHT_BG} rg`); box(rx, y - rowH, rw, rowH);
    push(`${TEAL_DARK} RG 0.8 w`);
    line(rx, y - rowH, rx + rw, y - rowH);
    line(rx + col1, y - rowH, rx + col1, y);
    line(rx + rw, y - rowH, rx + rw, y);
    line(rx, y, rx + rw, y);
    text('F2', 9, rx + 4, y - 12, 'TOTAL', TEAL_DARK);
    text('F2', 9, rx + col1 + 6, y - 12, String(scans.length), TEAL_DARK);
  }

  // ----- blok TTD (menyamai halaman print: Pengirim / Penerima) -----
  if (y - 112 < PDF_BOTTOM) {
    footer();
    pages.push(content.join('\n'));
    content = [];
    pageNo++;
    y = PDF_H - 58;
  }
  y -= 30;
  const cx1 = x0 + tableW / 4;
  const cx2 = x0 + (tableW * 3) / 4;
  const drawSig = (label, name, cx, yy) => {
    text('F2', 11, cx - strw('F2', 11, label) / 2, yy, label, TEAL_DARK);
    push(`${BORDER} RG 0.6 w`);
    line(cx - 55, yy - 7, cx + 55, yy - 7);
    text('F1', 10, cx - strw('F1', 10, name) / 2, yy - 20, name, '0.2 0.2 0.25');
    line(cx - 95, yy - 62, cx + 95, yy - 62);
    text('F1', 9, cx - strw('F1', 9, '( Tanda Tangan )') / 2, yy - 72, '( Tanda Tangan )', '0.45 0.45 0.45');
  };
  drawSig('Pengirim', 'RankSports', cx1, y);
  drawSig('Penerima', 'Ekspedisi', cx2, y);

  footer();
  pages.push(content.join('\n'));

// ----- rakit file PDF -----
  const contents = pages.map(p => Buffer.from(p, 'utf8'));
  const P = pages.length;
  const font1Ref = 3 + 2 * P;
  const font2Ref = 4 + 2 * P;

  const objBufs = [];
  const buildObj = (str) => Buffer.from(str, 'utf8');

  // obj 1: Catalog
  objBufs.push(buildObj('<< /Type /Catalog /Pages 2 0 R >>'));
  // obj 2: Pages
  let kids = [];
  for (let i = 0; i < P; i++) kids.push(`${3 + i} 0 R`);
  objBufs.push(buildObj(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${P} >>`));

  // page objects
  for (let i = 0; i < P; i++) {
    objBufs.push(buildObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_W} ${PDF_H}] `
      + `/Resources << /Font << /F1 ${font1Ref} 0 R /F2 ${font2Ref} 0 R >> >> `
      + `/Contents ${3 + P + i} 0 R >>`
    ));
  }
  // content streams
  for (let i = 0; i < P; i++) {
    objBufs.push(buildObj(`<< /Length ${contents[i].length} >>\nstream\n${contents[i].toString('utf8')}\nendstream`));
  }
  // fonts
  objBufs.push(buildObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objBufs.push(buildObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objBufs.forEach((b, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n` + b.toString('utf8') + '\nendobj\n';
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objBufs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objBufs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objBufs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const q = {
    date: String(req.query.date || ''),
    search: String(req.query.search || '').trim(),
    ekspedisi: String(req.query.ekspedisi || '').toUpperCase().trim(),
    jenis: String(req.query.jenis || '').trim(),
    user_id: String(req.query.user_id || '').trim(),
  };
const format = String(req.query.format || 'csv');
  const preview = String(req.query.preview || '') === '1';

  if (!['pdf', 'csv', 'xlsx', 'print'].includes(format)) {
    return res.status(400).json({ success: false, message: 'Format tidak dikenali' });
  }
  if (q.date && !isValidDateParam(q.date)) {
    return res.status(400).json({ success: false, message: 'Format tanggal tidak valid (YYYY-MM-DD)' });
  }

  const jenisList = String(q.jenis || '').split(',').filter(Boolean);
  const isPengirimanOnly = jenisList.length === 1 && jenisList[0] === 'pengiriman';
  // Format lebar dipakai jika ada kemungkinan baris retur (retur-only, campuran, atau tanpa filter jenis)
  const useReturCols = !isPengirimanOnly;

  try {
    const { where, params } = buildWhere(user, q);
    const r = await query(
      `SELECT no_resi, ekspedisi, jenis, username, toko, scan_date, scan_time, produk_retur, kondisi_retur, keterangan_retur, sku_retur
         FROM scans ${where}
        ORDER BY scan_date DESC, scan_time DESC`,
      params
    );
    const scans = r.rows;

    const rekap = [];
    const temp = {};
    for (const s of scans) {
      const key = s.ekspedisi || 'Lainnya';
      temp[key] = (temp[key] || 0) + 1;
    }
    const sorted = Object.entries(temp).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sorted) rekap.push([k, v]);

    const filterInfo = [];
    if (q.date) filterInfo.push(`Tanggal: ${q.date}`);
    if (q.ekspedisi) {
      const names = q.ekspedisi.split(',').filter(Boolean).map(expName).join(', ');
      filterInfo.push(`Ekspedisi: ${names}`);
    }
    if (q.jenis) {
      const names = q.jenis.split(',').filter(Boolean)
        .map(j => (j === 'pengiriman' ? 'Pengiriman' : j === 'retur' ? 'Retur' : j)).join(', ');
      filterInfo.push(`Jenis: ${names}`);
    }
    if (user.role === 'admin' && q.user_id) {
      const uR = await query('SELECT username FROM users WHERE id = $1', [parseInt(q.user_id, 10) || 0]);
      const uname = uR.rows.length ? uR.rows[0].username : q.user_id;
      filterInfo.push(`Operator: ${uname}`);
    }
    const filterStr = filterInfo.join(' | ') || 'Semua Data';

if (format === 'xlsx') {
      const buf = buildXlsx(scans, rekap, useReturCols);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="scanchecker_${nowStamp()}.xlsx"`);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(buf);
    }

    if (format === 'csv') {
      const isReturOnly = useReturCols;
      const csvHeader = isReturOnly
        ? ['No', 'No Resi', 'Ekspedisi', 'SKU', 'Produk', 'Kondisi', 'Operator', 'Toko', 'Tanggal', 'Waktu']
        : ['No', 'No Resi', 'Ekspedisi', 'Operator', 'Toko', 'Tanggal', 'Waktu'];
      const lines = [];
      lines.push('\uFEFFsep=,');
      lines.push(csvHeader.join(','));
      let no = 1;
      for (const s of scans) {
        if (isReturOnly) {
          const kondisi = s.kondisi_retur === 'sesuai' ? 'Sesuai' : (s.kondisi_retur ? 'Tidak Sesuai' : '');
          const csvRow = [no++, s.no_resi, s.ekspedisi, s.sku_retur || '', s.produk_retur || '', kondisi || '', s.username, s.toko, s.scan_date, String(s.scan_time || '').slice(0, 5)]
            .map(v => {
              const str = String(v);
              return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
            }).join(',');
          lines.push(csvRow);
        } else {
          const csvRow = [no++, s.no_resi, s.ekspedisi, s.username, s.toko, s.scan_date, String(s.scan_time || '').slice(0, 5)]
            .map(v => {
              const str = String(v);
              return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
            }).join(',');
          lines.push(csvRow);
        }
      }
lines.push(`total = ${scans.length}`);
      const body = lines.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="scanchecker_export_${nowStamp()}.csv"`);
      res.setHeader('Content-Length', String(Buffer.byteLength(body, 'utf8')));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(Buffer.from(body, 'utf8'));
    }

if (format === 'pdf') {
      const buf = buildPdf(scans, rekap, {
        filterStr,
        total: scans.length,
        printedAt: nowId(),
        printedBy: user.nama || user.username,
        role: user.role,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="scanchecker_export_${nowStamp()}.pdf"`);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(buf);
    }

    // print / save-as-pdf
    const isReturOnly = useReturCols;
    const printCols = isReturOnly
      ? ['#', 'No Resi', 'Ekspedisi', 'SKU', 'Produk', 'Kondisi', 'Operator', 'Tanggal', 'Waktu']
      : ['#', 'No Resi', 'Ekspedisi', 'Operator', 'Tanggal', 'Waktu'];
    let rowsHtml = '';
    let no = 1;
    for (const s of scans) {
      if (isReturOnly) {
        const kondisi = s.kondisi_retur === 'sesuai' ? 'Sesuai' : (s.kondisi_retur ? 'Tidak Sesuai' : '');
        rowsHtml += `<tr><td>${no++}</td><td><b>${escXml(s.no_resi)}</b></td><td>${escXml(s.ekspedisi)}</td>`
          + `<td>${escXml(s.sku_retur || '')}</td><td>${escXml(s.produk_retur || '')}</td><td>${escXml(kondisi)}</td><td>${escXml(s.username)}</td><td>${escXml(fmtDateShort(s.scan_date))}</td>`
          + `<td>${escXml(String(s.scan_time || '').slice(0, 5))}</td></tr>`;
      } else {
        rowsHtml += `<tr><td>${no++}</td><td><b>${escXml(s.no_resi)}</b></td><td>${escXml(s.ekspedisi)}</td>`
          + `<td>${escXml(s.username)}</td><td>${escXml(fmtDateShort(s.scan_date))}</td>`
          + `<td>${escXml(String(s.scan_time || '').slice(0, 5))}</td></tr>`;
      }
    }
    const rekapHtml = rekap.map(([name, cnt]) =>
      `<tr><td>${escXml(name)}</td><td style="text-align:center">${cnt}</td></tr>`).join('');
    const expFilterStr = q.ekspedisi ? q.ekspedisi.split(',').filter(Boolean).map(expName).join(', ') : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cetak Laporan RankSports</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:20px;padding-top:58px}
        .export-bar{position:fixed;top:0;left:0;right:0;z-index:99;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:#fff;border-bottom:2px solid #C8102E;box-shadow:0 2px 8px rgba(0,0,0,.15)}
        .export-bar .sk-hint{font-size:11px;color:#555}
        .export-bar button{border:0;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;color:#fff}
        .export-bar .sk-dl{background:#C8102E}
        .export-bar .sk-pr{background:#8E1B2E}
        .export-bar .sk-close{background:#6b7280}
        .head{text-align:center;border-bottom:3px solid #C8102E;padding-bottom:10px;margin-bottom:14px}
        .head h1{margin:0;font-size:20px;color:#C8102E}
        .head .sub{color:#555;font-size:11px;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;font-size:11px}
        th{background:#8E1B2E;color:#fff;font-weight:bold}
        tr:nth-child(even){background:#faf0f1}
        .total td{background:#F7DADD;font-weight:bold}
        .section{margin-top:18px;font-size:14px;font-weight:bold;color:#C8102E;border-bottom:2px solid #C8102E;padding-bottom:4px}
        .sigwrap{display:flex;gap:60px;justify-content:space-between;margin:36px 20px 0}
        .sig{flex:1;text-align:center}
        .sig-title{font-weight:bold;color:#C8102E;font-size:12px;padding-bottom:4px;border-bottom:1px solid #ccc;margin-bottom:14px}
        .sig-name{font-size:12px;font-weight:bold}
        .sig-space{height:60px}
        .sig-caption{font-size:10px;color:#555;border-top:1px solid #666;padding-top:6px;width:90%;margin:0 auto}
        .footer{text-align:center;margin-top:22px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px}
        @media print{ body{margin:0;padding:0} .export-bar{display:none!important} }
      </style></head>${preview ? '<body>' : '<body onload="setTimeout(function(){window.print()},700)">'}
      <div class="export-bar">
        <span class="sk-hint">Pratinjau laporan</span>
        <button class="sk-dl" onclick="savePdfViaBlob()">Simpan PDF (file)</button>
        <button class="sk-pr" onclick="setTimeout(function(){window.print()},300)">Cetak</button>
        <button class="sk-close" onclick="skClose()">Tutup</button>
      </div>
      <div class="head">
        <h1>RANK SPORTS — Data Scan &amp; Retur</h1>
        <div class="sub">${escXml(filterStr)} &nbsp;|&nbsp; Total: ${scans.length} resi &nbsp;|&nbsp; Dicetak: ${nowId()} oleh ${escXml(user.nama)}</div>
      </div>
      <table>
        <thead><tr>${printCols.map((c) => `<th>${escXml(c)}</th>`).join('')}</tr></thead>
        <tbody>
        ${rowsHtml}
        <tr class="total"><td colspan="${printCols.length}">total = ${scans.length}</td></tr>
        </tbody>
      </table>
      <div class="section">Rekap Per Ekspedisi</div>
      <table>
        <thead><tr><th>Ekspedisi</th><th>Jumlah Resi</th></tr></thead>
        <tbody>
        ${rekapHtml}
        <tr class="total"><td>TOTAL</td><td style="text-align:center">${scans.length}</td></tr>
        </tbody>
      </table>
      <div class="sigwrap">
        <div class="sig">
          <div class="sig-title">Pengirim</div>
          <div class="sig-name">RankSports${expFilterStr ? ' — ' + escXml(expFilterStr) : ''}</div>
          <div class="sig-space">&nbsp;</div>
          <div class="sig-caption">( Tanda Tangan )</div>
        </div>
        <div class="sig">
          <div class="sig-title">Penerima</div>
          <div class="sig-name">${expFilterStr ? 'Ekspedisi ' + escXml(expFilterStr) : 'Ekspedisi'}</div>
          <div class="sig-space">&nbsp;</div>
          <div class="sig-caption">( Tanda Tangan )</div>
        </div>
      </div>
<div class="footer">Dibuat oleh Muhammad Irfandi &copy; ${new Date().getFullYear()} ScanChecker v2.0</div>
      <script>
      function skClose() {
        // Jika laporan dibuka di tab/popup baru -> cukup tutup tab itu (app tetap terbuka).
        if (window.opener) { try { window.close(); } catch (e) {} return; }
        // Jika laporan membuka menggantikan halaman app (mode app/PWA) -> kembali ke halaman sebelumnya.
        if (window.history.length > 1) { window.history.back(); return; }
        try { window.close(); } catch (e) {}
        window.location.href = '/';
      }
      function savePdfViaBlob() {
        var u = location.href;
        u = u.indexOf('format=print') >= 0
          ? u.replace('format=print', 'format=pdf')
          : u + (u.indexOf('?') >= 0 ? '&' : '?') + 'format=pdf';
        var b = document.querySelector('.sk-dl');
        if (b) { b.disabled = true; b.textContent = 'Memproses...'; }
        fetch(u, { credentials: 'include' }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        }).then(function (blob) {
          if (!blob || !blob.size) throw new Error('empty');
          var f = new File([blob], 'scanchecker_export.pdf', { type: 'application/pdf' });
          if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) {
            return navigator.share({ files: [f], title: f.name }).catch(function (e) {
              if (!e || e.name !== 'AbortError') throw e;
            });
          }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = f.name;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { a.remove(); }, 3000);
        }).catch(function (e) {
          alert(e && e.message ? ('Gagal membuat PDF: ' + e.message) : 'Gagal membuat PDF. Coba tombol Cetak.');
        }).then(function () {
          if (b) { b.disabled = false; b.textContent = 'Simpan PDF (file)'; }
        });
      }
      </script>
      </body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    console.error('export error', e);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
}

export { buildPdf, buildXlsx, buildZip };
