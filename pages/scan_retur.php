<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', 'Scan Retur');

$user = currentUser();
$db = getDB();

$stmt = $db->prepare("SELECT setting_value FROM settings WHERE user_id = ? AND setting_key = 'ekspedisi_aktif'");
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$activeExp = $row ? json_decode($row['setting_value'], true) : [];

include __DIR__ . '/../includes/header.php';
?>

<input type="hidden" id="activeExpeditions" value='<?= htmlspecialchars(json_encode($activeExp), ENT_QUOTES) ?>'>
<input type="hidden" id="scanJenis" value="retur">

<div class="page-container">

    <!-- Retur Badge -->
    <div style="display:flex;justify-content:center;margin-bottom:var(--space-md);animation:fadeInUp 0.3s ease">
        <span class="badge badge-warning" style="font-size:0.85rem;padding:6px 18px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.22"/></svg>
            Mode RETUR Aktif
        </span>
    </div>

    <!-- Date -->
    <div class="scan-date" id="scanDate"><?= date('d-m-Y') ?></div>

    <!-- Resi Input -->
    <div class="scan-input-row" style="animation:fadeInUp 0.3s ease 0.05s both">
        <input type="text" id="resiInput" class="form-input" 
               placeholder="Masukkan atau scan no. resi retur..." 
               autocomplete="off" autocorrect="off" autocapitalize="characters"
               style="font-size:1rem;font-family:monospace;border-color:var(--warning)">
        <button class="btn-qr-scan" id="btnQrScan" onclick="openQRScanner()" title="Scan QR/Barcode" 
                style="border-color:var(--warning);color:var(--warning)" aria-label="Scan QR">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
        </button>
    </div>

    <!-- Courier Preview -->
    <div id="courierPreview" class="courier-detected" style="display:none;margin-bottom:var(--space-md)"></div>

    <!-- Stats Row -->
    <div class="scan-stats-row" style="animation:fadeInUp 0.35s ease 0.08s both;border-color:rgba(245,158,11,0.3)">
        <div>
            <span class="scan-total-label">Total retur hari ini : </span>
            <span class="scan-total-count" id="totalCount" style="color:var(--warning)">0</span>
        </div>
        <button class="btn-icon-round" id="btnToggleList" onclick="toggleListVisibility()" title="Sembunyikan daftar" aria-label="Toggle list">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
    </div>

    <!-- Headers -->
    <div style="display:flex;justify-content:space-between;padding:0 var(--space-sm);margin-bottom:var(--space-xs);animation:fadeInUp 0.38s ease 0.1s both">
        <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">No Resi</span>
        <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">Waktu</span>
    </div>

    <!-- Scan List -->
    <div id="scanList" style="animation:fadeInUp 0.4s ease 0.12s both">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    </div>

    <!-- Active Expeditions -->
    <div style="margin-top:var(--space-xl);animation:fadeInUp 0.45s ease 0.15s both">
        <div class="expedition-section-title">Retur per Ekspedisi</div>
        <div class="expedition-scroll" id="expeditionCards"></div>
    </div>
</div>

<!-- QR Modal -->
<div class="modal-overlay" id="qrModal">
    <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Scan Barcode / QR Retur</div>
        <div class="qr-frame" id="qr-reader"></div>
        <p style="text-align:center;font-size:0.8rem;color:var(--text-muted);margin-top:var(--space-md)">Arahkan kamera ke barcode 1D atau QR Code pada label resi retur</p>
        <button class="btn btn-ghost btn-block" style="margin-top:var(--space-md)" onclick="closeQRScanner()">Batal</button>
    </div>
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
<script src="<?= APP_URL ?>/js/scan.js?v=2.0.3"></script>
<script>
document.body.dataset.role = '<?= $user['role'] ?>';
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
