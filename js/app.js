// ============================================
// ScanChecker — Global App JS
// ============================================

const APP_URL = document.querySelector('meta[name="app-url"]')?.content || window.location.origin + '/scan_checker';

// ===== DARK MODE =====

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.dataset.theme === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.dataset.theme = newTheme;

    const label = document.getElementById('darkModeLabel');
    if (label) label.textContent = newTheme === 'dark' ? 'Mode Terang' : 'Mode Gelap';

    // Save to server
    fetch(`${APP_URL}/api/settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dark_mode', value: newTheme === 'dark' ? '1' : '0' })
    }).catch(() => {});
}

// ===== USER MENU =====

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    const overlay = document.getElementById('menuOverlay');
    if (!menu) return;
    menu.classList.toggle('open');
    overlay.classList.toggle('active');
}

function closeUserMenu() {
    const menu = document.getElementById('userMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// Close menu on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeUserMenu();
        closeModal();
    }
});

// ===== TOAST NOTIFICATIONS =====

let toastCounter = 0;

function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const id = `toast-${++toastCounter}`;
    const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ===== MODAL =====

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
    } else {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
    document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

// ===== LOADING =====

function showLoading(text = 'Memuat...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-box">
                <div class="spinner"></div>
                <div class="loading-text" id="loadingText">${text}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('loadingText').textContent = text;
    overlay.classList.add('show');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
}

// ===== API HELPER =====

async function apiFetch(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Koneksi gagal. Periksa server.' };
    }
}

// ===== FORMAT DATE/TIME =====

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5); // HH:MM
}

function todayString() {
    // Pakai tanggal LOKAL (bukan UTC) agar tidak bergeser saat jam-jam WIB
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayDisplay() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
}

function getTodayInputValue() {
    // Tanggal lokal untuk input type=date (format YYYY-MM-DD)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getCurrentTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// ===== CONFIRM DIALOG =====

function confirmDialog(message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        // Create inline
        if (confirm(message)) { onConfirm(); } else { if (onCancel) onCancel(); }
        return;
    }
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOk').onclick = () => { closeModal('confirmModal'); onConfirm(); };
    document.getElementById('confirmCancel').onclick = () => { closeModal('confirmModal'); if (onCancel) onCancel(); };
    openModal('confirmModal');
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    // Update dark mode label
    const label = document.getElementById('darkModeLabel');
    if (label) {
        const isDark = document.documentElement.dataset.theme === 'dark';
        label.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
    }

    // Page enter animation
    const main = document.getElementById('mainContent');
    if (main) main.classList.add('page-enter');

    // Service Worker registration (PWA)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`${APP_URL}/sw.js`).catch(() => {});
    }
});
