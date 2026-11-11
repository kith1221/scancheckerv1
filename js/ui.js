// ============================================
// ScanChecker (Vercel) - shared UI helpers
// Auth gate, user menu, dark mode, modal, confirm
// ============================================

// Gate: redirect to login if not authenticated, then populate user badge/menu.
async function initApp() {
  const user = await isAuthenticated();
  if (!user) { window.location.href = '/login.html'; return null; }
  window.__user = user;
  setupUserMenu(user);
  return user;
}

function setupUserMenu(user) {
  const badge = document.getElementById('userBadge');
  if (badge) {
    badge.querySelector('.user-avatar').textContent = (user.nama || '?').charAt(0).toUpperCase();
    badge.querySelector('.user-name').textContent = user.nama || user.username || '';
    badge.querySelector('.user-role').textContent = user.role === 'admin' ? 'Admin' : 'Operator';
  }
  const role = document.getElementById('menuUsersWrap');
  if (role) role.style.display = user.role === 'admin' ? '' : 'none';

  const repoDoc = document.getElementById('menuReportsWrap');
  if (repoDoc) repoDoc.style.display = user.role === 'admin' ? '' : 'none';

  // Scripts dimuat di akhir <body>, DOM sudah ter-parse; jalankan setup langsung
  const menu = document.getElementById('userMenu');
  if (menu) {
    const overlay = document.getElementById('menuOverlay');
    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      if (overlay) overlay.classList.toggle('active', open);
    };
    const toggleUserMenu = (e) => setOpen(!menu.classList.contains('open'));
    if (badge) badge.addEventListener('click', toggleUserMenu);
    if (overlay) overlay.addEventListener('click', () => setOpen(false));

    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) {
      darkToggle.addEventListener('click', toggleDarkMode);
      const mark = darkToggle.querySelector('#darkModeMark');
      if (mark && !mark.innerHTML) mark.innerHTML = ICON_MOON;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/account', { method: 'POST', body: { action: 'logout' } }).catch(() => {});
      window.location.replace('/login.html');
    });
  }
}

const ICON_SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
const ICON_MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

async function applyDarkMode() {
  try {
    const d = await api('/settings');
    if (d.success) {
      // Default = mode terang; gelap hanya jika setting dark_mode = '1'.
      const dark = d.data.dark_mode === '1';
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      document.body.classList.toggle('dark-mode', dark);
      document.body.classList.toggle('light-mode', !dark);
      syncDarkLabel(dark);
    }
  } catch (e) { /* default light */ }
}

async function toggleDarkMode() {
  const body = document.body;
  const isDark = body.classList.toggle('dark-mode');
  body.classList.toggle('light-mode', !isDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  syncDarkLabel(isDark);
  await api('/settings', { method: 'POST', body: { key: 'dark_mode', value: isDark ? '1' : '0' } }).catch(() => {});
}

function syncDarkLabel(dark) {
  const lab = document.getElementById('darkModeLabel');
  if (lab) lab.textContent = dark ? 'Mode Terang' : 'Mode Gelap';
  const sw = document.getElementById('darkModeSwitch');
  if (sw) sw.classList.toggle('on', dark);
}

// ---- Modal helpers ----
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

function confirmDialog(message, onOk) {
  const m = document.getElementById('confirmModal');
  if (!m) { if (window.confirm(message)) onOk(); return; }
  document.getElementById('confirmMessage').textContent = message;
  m.classList.add('open');
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const cleanup = () => {
    m.classList.remove('open');
    ok.removeEventListener('click', okHandler);
    cancel.removeEventListener('click', cancelHandler);
  };
  const okHandler = () => { cleanup(); onOk(); };
  const cancelHandler = () => cleanup();
  ok.addEventListener('click', okHandler);
  cancel.addEventListener('click', cancelHandler);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const s = String(dateStr).split('T')[0].split('-');
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : dateStr;
}
function formatTime(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}
