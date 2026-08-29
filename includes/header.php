<?php
// ============================================
// ScanChecker - HTML Header Include
// ============================================
if (!defined('PAGE_TITLE')) define('PAGE_TITLE', APP_NAME);
$user = currentUser();
$darkMode = '1'; // default dark

// Get dark mode setting from DB if logged in
if (isLoggedIn()) {
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE user_id = ? AND setting_key = 'dark_mode'");
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        if ($row) $darkMode = $row['setting_value'];
    } catch (Exception $e) { /* ignore */ }
}

$currentPage = basename($_SERVER['PHP_SELF'], '.php');
$bodyClass = $darkMode === '1' ? 'dark-mode' : 'light-mode';

// Load user-defined courier resi patterns (if any)
$courierPatternsJson = '{}';
if (isLoggedIn()) {
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE user_id = ? AND setting_key = 'courier_patterns'");
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        if ($row && $row['setting_value']) $courierPatternsJson = $row['setting_value'];
    } catch (Exception $e) { /* ignore */ }
}
?>
<!DOCTYPE html>
<html lang="id" data-theme="<?= $darkMode === '1' ? 'dark' : 'light' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="description" content="ScanChecker - Sistem Scan dan Tracking Paket Ekspedisi">
    <meta name="theme-color" content="#00C9A7">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title><?= htmlspecialchars(PAGE_TITLE) ?> | <?= APP_NAME ?></title>
    <link rel="manifest" href="<?= APP_URL ?>/manifest.json">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= APP_URL ?>/css/style.css">
    <link rel="stylesheet" href="<?= APP_URL ?>/css/animations.css">
    <link rel="icon" type="image/svg+xml" href="<?= APP_URL ?>/assets/icon.svg">
    <script>window.COURIER_PATTERNS_OVERRIDE = <?= $courierPatternsJson ?>;</script>
</head>
<body class="<?= $bodyClass ?>" data-dark="<?= $darkMode ?>">

<?php if (isLoggedIn()): ?>
<!-- ===== TOP NAVIGATION BAR ===== -->
<nav class="navbar" id="mainNavbar">
    <div class="navbar-left">
        <?php if ($currentPage !== 'dashboard'): ?>
        <button class="btn-icon" onclick="history.back()" aria-label="Kembali" id="btnBack">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <?php else: ?>
        <div class="navbar-brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <?php endif; ?>
    </div>
    
    <div class="navbar-center">
        <h1 class="navbar-title"><?= htmlspecialchars(PAGE_TITLE) ?></h1>
    </div>
    
    <div class="navbar-right">
        <div class="user-badge" onclick="toggleUserMenu()" id="userBadge">
            <div class="user-avatar"><?= strtoupper(substr($user['nama'], 0, 1)) ?></div>
            <div class="user-info">
                <span class="user-role"><?= $user['role'] === 'admin' ? 'Admin' : 'Operator' ?></span>
            </div>
        </div>
    </div>
</nav>

<!-- User dropdown menu -->
<div class="user-menu" id="userMenu">
    <div class="user-menu-header">
        <div class="user-avatar-lg"><?= strtoupper(substr($user['nama'], 0, 1)) ?></div>
        <div>
            <div class="user-menu-name"><?= htmlspecialchars($user['nama']) ?></div>
            <div class="user-menu-role"><?= htmlspecialchars($user['toko']) ?> &bull; <?= ucfirst($user['role']) ?></div>
        </div>
    </div>
    <div class="user-menu-divider"></div>
    <a href="<?= APP_URL ?>/pages/settings.php" class="user-menu-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        Pengaturan
    </a>
    <?php if ($user['role'] === 'admin'): ?>
    <a href="<?= APP_URL ?>/pages/users.php" class="user-menu-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Kelola Pengguna
    </a>
    <?php endif; ?>
    <button class="user-menu-item" onclick="toggleDarkMode()" id="darkModeToggle">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        <span id="darkModeLabel">Mode Terang</span>
    </button>
    <div class="user-menu-divider"></div>
    <a href="<?= APP_URL ?>/logout.php" class="user-menu-item danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Keluar
    </a>
</div>
<div class="overlay" id="menuOverlay" onclick="closeUserMenu()"></div>
<?php endif; ?>

<!-- Toast notification container -->
<div id="toastContainer" class="toast-container"></div>

<!-- Main content wrapper -->
<main class="main-content" id="mainContent">
