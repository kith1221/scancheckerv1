// ============================================
// ScanChecker (Vercel) - shared frontend helpers
// ============================================

const API = '/api';

function todayString() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayInputValue() {
  return todayString();
}

function getTodayDisplay() {
  const s = todayString().split('-');
  return `${s[2]}/${s[1]}/${s[0]}`;
}

function formatDayMonth(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = String(dateStr).split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

async function api(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(API + path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok && !data) {
    throw new Error('Terjadi kesalahan komunikasi dengan server.');
  }
  return data;
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) { alert(msg); return; }
  const colors = { success: '#C8102E', error: '#e11d48', warning: '#f59e0b', info: '#3b82f6' };
  const el = document.createElement('div');
  el.style.cssText = `background:${colors[type]||colors.info};color:#fff;padding:10px 16px;border-radius:10px;margin:6px 0;box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:.85rem;animation:fadeInUp .3s ease`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 3000);
}

// ============================================
// Pratinjau data sebelum export (modal + pilihan format)
// ============================================
let _exportPreview = null;

function closeExportPreview() {
  if (!_exportPreview) return;
  _exportPreview.ov.remove();
  _exportPreview = null;
}

function _expBtn(label, opts) {
  const b = document.createElement('button');
  b.textContent = label;
  Object.assign(b.style, {
    background: opts.color, color: '#fff', border: '0', borderRadius: '8px',
    padding: '9px 16px', fontWeight: '700', fontSize: '.85rem', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  });
  return b;
}

// p: URLSearchParams (tanpa format). baseName: nama file tanpa ekstensi.
async function openExportPreview(p, baseName) {
  const qp = new URLSearchParams(p);
  qp.set('format', 'print');
  qp.set('preview', '1');
  closeExportPreview();
  let html;
  try {
    const r = await fetch('/api/export?' + qp.toString(), { credentials: 'include' });
    if (!r.ok) throw new Error('status ' + r.status);
    html = await r.text();
  } catch (e) {
    showToast('Gagal memuat pratinjau', 'error');
    return;
  }

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;flex-direction:column;';

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:#fff;color:#111;box-shadow:0 2px 12px rgba(0,0,0,.3);';
  const t = document.createElement('div');
  t.style.cssText = 'font-weight:700;font-size:.95rem;color:#C8102E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  t.textContent = 'Pratinjau Data — periksa dulu, lalu pilih format';
  const close = _expBtn('Tutup', { color: '#6b7280' });
  bar.appendChild(t);
  bar.appendChild(close);
  close.onclick = () => closeExportPreview();

  const fr = document.createElement('iframe');
  fr.style.cssText = 'flex:1;width:100%;border:0;background:#fff;';
  fr.dataset.box = '';
  fr.srcdoc = html;

  const foot = document.createElement('div');
  foot.style.cssText = 'background:#fff;padding:10px 14px;box-shadow:0 -2px 12px rgba(0,0,0,.15);display:flex;gap:10px;justify-content:center;flex-wrap:wrap;';

  const mk = (label, color, fmt, ext) => {
    const b = _expBtn(label, { color });
    b.onclick = () => {
      const q = new URLSearchParams(p);
      q.set('format', fmt);
      saveAsFile('/api/export?' + q.toString(), baseName + '.' + ext);
      closeExportPreview();
    };
    return b;
  };
  foot.appendChild(mk('Export PDF', '#C8102E', 'pdf', 'pdf'));
  foot.appendChild(mk('Export Excel', '#1d7a3c', 'xlsx', 'xlsx'));
  foot.appendChild(mk('Export CSV', '#2563eb', 'csv', 'csv'));

  ov.appendChild(bar);
  ov.appendChild(fr);
  ov.appendChild(foot);
  document.body.appendChild(ov);
  _exportPreview = { ov };
}

// Buka halaman laporan/cetak; fallback ke tab yang sama jika popup diblokir (mode app).
function openPrint(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) window.location.href = url;
}

// Deteksi mode app terpasang (PWA standalone)
function isStandaloneApp() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
}

// Simpan file export (PDF/Excel/CSV) dengan aman di PWA & browser:
// ambil sebagai blob -> Share sheet "Save to Files" (standalone/mobile) -> fallback <a download>.
async function saveAsFile(url, fallbackName) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) { showToast('Gagal mengambil file (' + r.status + ')', 'error'); return false; }
    const blob = await r.blob();
    if (blob.size === 0) { showToast('File kosong (0 byte) — coba lagi', 'error'); return false; }
    let fname = fallbackName || 'scanchecker_export';
    const cd = r.headers.get('Content-Disposition');
    const mm = cd && cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    if (mm) { const v = decodeURIComponent(mm[1].replace(/"/g, '')).trim(); if (v) fname = v; }
    const file = new File([blob], fname, { type: blob.type || 'application/octet-stream' });
    const preferShare = isStandaloneApp() || /Android|iPhone|iPod/i.test(navigator.userAgent);
    if (preferShare && navigator.canShare && navigator.share) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fname });
          return true;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return true; // user batal
      }
    }
    const a = document.createElement('a');
    const u = URL.createObjectURL(blob);
    a.href = u;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 4000);
    showToast('File siap diunduh: ' + fname, 'success');
    return true;
  } catch (e) {
    showToast('Gagal mengunduh file', 'error');
    return false;
  }
}

async function isAuthenticated() {
  try {
    const d = await api('/me');
    return d.success ? d.data : null;
  } catch (e) {
    return null;
  }
}

// Guard bfcache: saat "back" memulihkan halaman dari cache browser, sesi dicek ulang.
// Jika sesi sudah dicabut (mis. logout), langsung arahkan ke login.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    isAuthenticated().then((u) => {
      if (!u && !location.pathname.endsWith('/login.html')) window.location.href = '/login.html';
    }).catch(() => {});
  }
});
