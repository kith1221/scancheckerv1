<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', APP_NAME);

// Get active expeditions setting
$user = currentUser();
$db = getDB();
$stmt = $db->prepare("SELECT setting_value FROM settings WHERE user_id = ? AND setting_key = 'ekspedisi_aktif'");
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$activeExp = $row ? json_decode($row['setting_value'], true) : [];
$activeExpJson = json_encode($activeExp);

include __DIR__ . '/../includes/header.php';
?>

<div class="page-container page-enter">

    <!-- Welcome Text -->
    <div style="margin-bottom:var(--space-lg);animation:fadeInUp 0.3s ease">
        <div style="font-size:0.8rem;color:var(--text-muted)">Selamat datang,</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)"><?= htmlspecialchars($user['nama']) ?></div>
        <div style="font-size:0.75rem;color:var(--text-muted)"><?= htmlspecialchars($user['toko']) ?></div>
    </div>

    <!-- Carousel -->
    <div class="carousel-container" style="animation:fadeInUp 0.35s ease 0.05s both">
        <div class="carousel-track" id="carouselTrack">
            <!-- Slide 1: Scan Barang -->
            <div class="carousel-slide">
                <a href="<?= APP_URL ?>/pages/scan_barang.php" class="carousel-card" style="text-decoration:none">
                    <svg class="carousel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <div class="carousel-label">Scan Barang</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Scan paket masuk</div>
                </a>
            </div>
            <!-- Slide 2: Scan Retur -->
            <div class="carousel-slide">
                <a href="<?= APP_URL ?>/pages/scan_retur.php" class="carousel-card" style="text-decoration:none">
                    <svg class="carousel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="2"/><circle cx="16" cy="16" r="6"/><polyline points="14 14 16 16 14 18"/><line x1="10" y1="16" x2="16" y2="16"/>
                    </svg>
                    <div class="carousel-label">Scan Retur</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Scan paket retur</div>
                </a>
            </div>
            <!-- Slide 3: Cek Status -->
            <div class="carousel-slide">
                <a href="<?= APP_URL ?>/pages/database.php" class="carousel-card" style="text-decoration:none">
                    <svg class="carousel-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                    </svg>
                    <div class="carousel-label">Database</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Lihat semua data</div>
                </a>
            </div>
        </div>

        <!-- Touch swipe hint -->
        <div class="swipe-hint" style="position:absolute;bottom:var(--space-sm);right:var(--space-sm)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
    </div>

    <!-- Carousel Dots -->
    <div class="carousel-dots" id="carouselDots">
        <div class="carousel-dot active" onclick="goToSlide(0)" id="dot-0"></div>
        <div class="carousel-dot" onclick="goToSlide(1)" id="dot-1"></div>
        <div class="carousel-dot" onclick="goToSlide(2)" id="dot-2"></div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-row" style="animation:fadeInUp 0.4s ease 0.1s both">
        <div class="stat-card">
            <div class="stat-value" id="statTodayBarang">-</div>
            <div class="stat-label">Barang Hari Ini</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="statTodayRetur">-</div>
            <div class="stat-label">Retur Hari Ini</div>
        </div>
    </div>

    <!-- Total Stats (semua data user) -->
    <div class="stats-row" style="animation:fadeInUp 0.45s ease 0.15s both;margin-top:var(--space-sm)">
        <div class="stat-card">
            <div class="stat-value" id="statTotalBarang">-</div>
            <div class="stat-label">Total Barang</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="statTotalRetur">-</div>
            <div class="stat-label">Total Retur</div>
        </div>
    </div>

    <!-- Menu Grid -->
    <div style="animation:fadeInUp 0.45s ease 0.15s both">
        <div class="section-title" style="margin-bottom:var(--space-sm)">
            <span class="section-title-accent"></span>
            Menu
        </div>
        <div class="menu-grid">
            <a href="<?= APP_URL ?>/pages/database.php" class="menu-item" id="menuDatabase">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                </div>
                <span class="menu-label">Database</span>
            </a>
            <a href="<?= APP_URL ?>/pages/settings.php" class="menu-item" id="menuSettings">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                <span class="menu-label">Pengaturan</span>
            </a>
            <a href="<?= APP_URL ?>/pages/feedback.php" class="menu-item" id="menuFeedback">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span class="menu-label">Feedback</span>
            </a>
            <?php if (isAdmin()): ?>
            <a href="<?= APP_URL ?>/pages/users.php" class="menu-item" id="menuUsers">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span class="menu-label">Pengguna</span>
            </a>
            <?php else: ?>
            <a href="<?= APP_URL ?>/pages/about.php" class="menu-item" id="menuAbout">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <span class="menu-label">Tentang</span>
            </a>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/pages/about.php" class="menu-item" id="menuAbout2">
                <div class="menu-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <span class="menu-label">Tentang</span>
            </a>
        </div>
    </div>
</div>

<script>
// Carousel
let currentSlide = 0;
const total = 3;
let startX = 0;

const track = document.getElementById('carouselTrack');

function goToSlide(n) {
    currentSlide = Math.max(0, Math.min(total - 1, n));
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

// Touch swipe
track.parentElement.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
track.parentElement.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goToSlide(currentSlide + (diff > 0 ? 1 : -1));
});

// Auto rotate carousel
setInterval(() => { goToSlide((currentSlide + 1) % total); }, 5000);

// Load stats
fetch('<?= APP_URL ?>/api/stats.php')
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            document.getElementById('statTodayBarang').textContent = res.data.today_barang ?? 0;
            document.getElementById('statTodayRetur').textContent  = res.data.today_retur ?? 0;
            document.getElementById('statTotalBarang').textContent = res.data.total_barang ?? 0;
            document.getElementById('statTotalRetur').textContent  = res.data.total_retur ?? 0;
        }
    }).catch(() => {});
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
