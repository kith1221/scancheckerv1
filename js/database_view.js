// ============================================
// ScanChecker — Database View Page JS
// ============================================

const APP_URL_DB = window.location.origin + '/scan_checker';
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};
const PER_PAGE = 20;

document.addEventListener('DOMContentLoaded', () => {
    // Parse initial URL params
    const params = new URLSearchParams(window.location.search);
    const dateInput = document.getElementById('filterDate');
    const ekspedisiInput = document.getElementById('filterEkspedisi');
    const jenisInput = document.getElementById('filterJenis');

    if (dateInput && params.get('date')) dateInput.value = params.get('date');
    else if (dateInput) dateInput.value = getTodayInputValue();

    if (ekspedisiInput && params.get('ekspedisi')) ekspedisiInput.value = params.get('ekspedisi');
    if (jenisInput && params.get('jenis')) jenisInput.value = params.get('jenis');

    loadData();
});

async function loadData(page = 1) {
    currentPage = page;
    showTableLoading();

    const date     = document.getElementById('filterDate')?.value || '';
    const search   = document.getElementById('filterSearch')?.value || '';
    const eksp     = document.getElementById('filterEkspedisi')?.value || '';
    const jenis    = document.getElementById('filterJenis')?.value || '';

    currentFilters = { date, search, ekspedisi: eksp, jenis, page, per_page: PER_PAGE };

    const params = new URLSearchParams({ ...currentFilters });
    const res = await apiFetch(`${APP_URL_DB}/api/scan_list.php?${params}`);

    if (res.success) {
        renderTable(res.data.scans || []);
        renderPagination(res.data.total || 0, page);
        document.getElementById('totalResult').textContent = res.data.total || 0;
        const footer = document.getElementById('totalResultFooter');
        if (footer) footer.textContent = res.data.total || 0;
    } else {
        showToast(res.message || 'Gagal memuat data', 'error');
    }
}

function showTableLoading() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
        ${Array(5).fill(0).map(() => `
            <tr>
                <td><div class="skeleton skeleton-line" style="width:80px"></div></td>
                <td><div class="skeleton skeleton-line long"></div></td>
                <td><div class="skeleton skeleton-line short"></div></td>
                <td><div class="skeleton skeleton-line short"></div></td>
                <td><div class="skeleton skeleton-line short"></div></td>
                <td><div class="skeleton skeleton-line" style="width:60px"></div></td>
            </tr>
        `).join('')}
    `;
}

function renderTable(scans) {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;

    if (scans.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="empty-state" style="padding:24px">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <p>Tidak ada data ditemukan</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    let no = (currentPage - 1) * PER_PAGE + 1;
    tbody.innerHTML = scans.map(s => `
        <tr>
            <td style="color:var(--text-muted)">${no++}</td>
            <td style="font-weight:600;font-family:monospace;font-size:0.85rem">${escHtml(s.no_resi)}</td>
            <td>${courierBadge(s.ekspedisi_kode)}</td>
            <td><span class="badge ${s.jenis === 'retur' ? 'badge-warning' : 'badge-success'}">${s.jenis === 'retur' ? 'Retur' : 'Barang'}</span></td>
            <td style="color:var(--text-secondary);font-size:0.8rem">${escHtml(s.username)}</td>
            <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${formatDate(s.scan_date)}<br><small>${formatTime(s.scan_time)}</small></td>
            <td>
                ${isAdminView() ? `<button class="btn btn-sm btn-danger" onclick="deleteRow(${s.id})" title="Hapus">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>` : '-'}
            </td>
        </tr>
    `).join('');
}

function renderPagination(total, current) {
    totalPages = Math.ceil(total / PER_PAGE);
    const container = document.getElementById('pagination');
    if (!container) return;

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="loadData(${current - 1})" ${current <= 1 ? 'disabled' : ''}>&#8249;</button>`;

    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= current - range && i <= current + range)) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadData(${i})">${i}</button>`;
        } else if (i === current - range - 1 || i === current + range + 1) {
            html += `<span style="color:var(--text-muted);padding:0 4px">…</span>`;
        }
    }

    html += `<button class="page-btn" onclick="loadData(${current + 1})" ${current >= totalPages ? 'disabled' : ''}>&#8250;</button>`;
    container.innerHTML = html;
}

function isAdminView() {
    // Setiap user yang sudah login boleh menghapus data scan.
    return true;
}

function filterData() {
    loadData(1);
}

function resetFilter() {
    document.getElementById('filterDate').value = getTodayInputValue();
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterEkspedisi').value = '';
    document.getElementById('filterJenis').value = '';
    loadData(1);
}

async function deleteRow(id) {
    confirmDialog('Hapus data scan ini?', async () => {
        const res = await apiFetch(`${APP_URL_DB}/api/scan_delete.php`, {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        if (res.success) {
            showToast('Data berhasil dihapus', 'success');
            loadData(currentPage);
        } else {
            showToast(res.message || 'Gagal menghapus', 'error');
        }
    });
}

function exportCSV() {
    const params = new URLSearchParams({ ...currentFilters, format: 'csv' });
    window.open(`${APP_URL_DB}/api/export.php?${params}`, '_blank');
}

function exportXlsx() {
    const params = new URLSearchParams({ ...currentFilters, format: 'xlsx' });
    window.open(`${APP_URL_DB}/api/export.php?${params}`, '_blank');
}

function printData() {
    const params = new URLSearchParams({ ...currentFilters, format: 'print', per_page: 9999 });
    window.open(`${APP_URL_DB}/api/export.php?${params}`, '_blank');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
