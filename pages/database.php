<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', 'Database');

$user = currentUser();

include __DIR__ . '/../includes/header.php';
?>

<div class="page-container">

    <!-- Filter Bar -->
    <div style="animation:fadeInUp 0.3s ease">
        <div class="section-title" style="margin-bottom:var(--space-sm)">
            <span class="section-title-accent"></span>
            Filter Data
        </div>

        <div class="filter-bar">
            <!-- Search -->
            <div class="search-input-wrapper" style="min-width:100%">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="filterSearch" class="form-input" placeholder="Cari no. resi..." 
                       oninput="clearTimeout(window._st);window._st=setTimeout(()=>filterData(),600)">
            </div>

            <input type="date" id="filterDate" class="form-input" 
                   value="<?= date('Y-m-d') ?>"
                   onchange="filterData()" style="flex:1;min-width:130px">

            <select id="filterEkspedisi" class="form-select" onchange="filterData()" style="flex:1;min-width:120px">
                <option value="">Semua Ekspedisi</option>
                <option value="JNT">J&T Express</option>
                <option value="JNTC">J&T Cargo</option>
                <option value="JNE">JNE Express</option>
                <option value="SICEPAT">SiCepat</option>
                <option value="POS">Pos Indonesia</option>
                <option value="NINJA">Ninja Xpress</option>
                <option value="ANTERAJA">AnterAja</option>
                <option value="SPX">Shopee Express</option>
                <option value="OTHER">Lainnya</option>
            </select>

            <select id="filterJenis" class="form-select" onchange="filterData()" style="flex:1;min-width:100px">
                <option value="">Semua Jenis</option>
                <option value="barang">Barang</option>
                <option value="retur">Retur</option>
            </select>
        </div>

        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md)">
            <button class="btn btn-ghost btn-sm" onclick="resetFilter()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.22"/></svg>
                Reset
            </button>
            <button class="btn btn-outline btn-sm" onclick="exportCSV()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
            </button>
            <button class="btn btn-outline btn-sm" onclick="exportXlsx()" style="color:#0e8388;border-color:#0e8388">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export Excel
            </button>
            <button class="btn btn-ghost btn-sm" onclick="printData()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Cetak
            </button>
        </div>
    </div>

    <!-- Results summary -->
    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-sm)">
        Total: <strong id="totalResult" style="color:var(--text-primary)">-</strong> data
    </div>

    <!-- Table -->
    <div class="table-wrapper" style="animation:fadeInUp 0.4s ease 0.1s both">
        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>No Resi</th>
                    <th>Ekspedisi</th>
                    <th>Jenis</th>
                    <th>Operator</th>
                    <th>Tgl / Waktu</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody id="dataTableBody">
                <!-- Loaded by JS -->
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="6" style="text-align:right;font-weight:bold;color:var(--text-primary)">
                        Total Data
                    </td>
                    <td id="totalResultFooter" style="text-align:center;font-weight:bold;color:#0e8388">-</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" id="pagination"></div>
</div>

<!-- Confirm Modal -->
<div class="modal-overlay" id="confirmModal">
    <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title" id="confirmMessage">Konfirmasi</div>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-lg)">
            <button class="btn btn-ghost btn-block" id="confirmCancel">Batal</button>
            <button class="btn btn-danger btn-block" id="confirmOk">Hapus</button>
        </div>
    </div>
</div>

<script src="<?= APP_URL ?>/js/courier.js?v=2.0.2"></script>
<script src="<?= APP_URL ?>/js/database_view.js?v=2.0.5"></script>
<script>
document.body.dataset.role = '<?= $user['role'] ?>';
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
