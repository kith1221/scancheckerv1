<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', 'Tentang');
include __DIR__ . '/../includes/header.php';
?>

<div class="page-container">

    <!-- App Logo -->
    <div style="text-align:center;padding:var(--space-xl) 0;animation:fadeInUp 0.3s ease">
        <div style="width:80px;height:80px;border-radius:var(--radius-xl);background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md);box-shadow:var(--shadow-glow);animation:logoFloat 3s ease-in-out infinite">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
        </div>
        <div style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--primary-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">ScanChecker</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Versi 2.0.0</div>
        <div class="badge badge-primary" style="margin-top:var(--space-sm)">Sistem Scan &amp; Tracking Paket Ekspedisi</div>
    </div>

    <!-- Features -->
    <div class="card" style="margin-bottom:var(--space-md);animation:fadeInUp 0.35s ease 0.05s both">
        <div class="section-title" style="margin-bottom:var(--space-md)"><span class="section-title-accent"></span>Fitur</div>
        <?php
        $features = [
            ['📦', 'Scan Barang & Retur', 'Input manual atau kamera QR/Barcode'],
            ['🚚', '8 Ekspedisi', 'J&T, JNE, SiCepat, Pos, Ninja, AnterAja, SPX & lainnya'],
            ['🔍', 'Auto-deteksi Ekspedisi', 'Deteksi otomatis dari prefix nomor resi'],
            ['📊', 'Statistik Real-time', 'Counter per ekspedisi, total hari ini & bulan ini'],
            ['💾', 'Export Data', 'Export ke CSV & cetak PDF'],
            ['👥', 'Multi-user', 'Role Admin & Operator dengan akses berbeda'],
            ['🌙', 'Dark / Light Mode', 'Tema gelap dan terang yang bisa disesuaikan'],
            ['🔔', 'Notifikasi Duplikat', 'Peringatan jika resi sudah pernah discan'],
        ];
        foreach ($features as $f):
        ?>
        <div style="display:flex;align-items:flex-start;gap:var(--space-sm);margin-bottom:var(--space-sm);padding-bottom:var(--space-sm);border-bottom:1px solid var(--border)">
            <span style="font-size:1.2rem;flex-shrink:0"><?= $f[0] ?></span>
            <div>
                <div style="font-weight:600;font-size:0.85rem"><?= $f[1] ?></div>
                <div style="font-size:0.75rem;color:var(--text-muted)"><?= $f[2] ?></div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Tech Stack -->
    <div class="card" style="animation:fadeInUp 0.4s ease 0.1s both">
        <div class="section-title" style="margin-bottom:var(--space-md)"><span class="section-title-accent"></span>Teknologi</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)">
            <?php foreach (['PHP 7.4+', 'MySQL', 'Vanilla JS', 'CSS Custom', 'html5-qrcode', 'PWA Ready'] as $tech): ?>
            <span class="badge badge-muted" style="font-size:0.8rem"><?= $tech ?></span>
            <?php endforeach; ?>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-md);text-align:center">
            &copy; <?= date('Y') ?> ScanChecker v2.0 &mdash; Built with ❤️
        </div>
    </div>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>
