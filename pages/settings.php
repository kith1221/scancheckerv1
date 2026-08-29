<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', 'Pengaturan');

$user = currentUser();
$db = getDB();

// Get all settings for current user
$stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE user_id = ?");
$stmt->execute([$user['id']]);
$settingsRaw = $stmt->fetchAll();
$settings = [];
foreach ($settingsRaw as $s) $settings[$s['setting_key']] = $s['setting_value'];

$darkMode     = $settings['dark_mode'] ?? '1';
$namaToko     = $settings['nama_toko'] ?? $user['toko'];
$notifDuplikat = $settings['notif_duplikat'] ?? '1';
$activeExp    = json_decode($settings['ekspedisi_aktif'] ?? '[]', true);
$courierPatterns = json_decode($settings['courier_patterns'] ?? '{}', true);
if (!is_array($courierPatterns)) $courierPatterns = [];

$allExpeditions = [
    'JNT'      => 'J&T Express',
    'JNTC'     => 'J&T Cargo',
    'JNE'      => 'JNE Express',
    'SICEPAT'  => 'SiCepat',
    'POS'      => 'Pos Indonesia',
    'NINJA'    => 'Ninja Xpress',
    'ANTERAJA' => 'AnterAja',
    'SPX'      => 'Shopee Express',
    'LAZADA'   => 'Lazada Logistics',
];

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'save_profile') {
        $namaToko = trim($_POST['nama_toko'] ?? '');
        if ($namaToko) {
            $db->prepare("UPDATE users SET toko = ? WHERE id = ?")->execute([$namaToko, $user['id']]);
            $_SESSION['toko'] = $namaToko;
            // Save setting
            $db->prepare("INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=?")->execute([$user['id'], 'nama_toko', $namaToko, $namaToko]);
            $msg = 'Profil berhasil disimpan.';
        }
    }

    if ($action === 'change_password') {
        $oldPw = $_POST['old_password'] ?? '';
        $newPw = $_POST['new_password'] ?? '';
        $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $dbPw = $stmt->fetchColumn();
        if (password_verify($oldPw, $dbPw) && strlen($newPw) >= 6) {
            $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([password_hash($newPw, PASSWORD_DEFAULT), $user['id']]);
            $msg = 'Password berhasil diubah.';
        } else {
            $msg = 'Password lama salah atau password baru terlalu pendek.';
        }
    }

    if ($action === 'save_expedition') {
        $selected = $_POST['expeditions'] ?? [];
        $json = json_encode(array_values($selected));
        $db->prepare("INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=?")->execute([$user['id'], 'ekspedisi_aktif', $json, $json]);
        $activeExp = $selected;
        $msg = 'Ekspedisi aktif disimpan.';
    }

    if ($action === 'save_courier_patterns') {
        $patterns = [];
        foreach ($allExpeditions as $code => $name) {
            $raw = $_POST['pattern_' . $code] ?? '';
            // split by newline, trim, drop empties
            $lines = array_values(array_filter(array_map('trim', explode("\n", str_replace(["\r\n","\r"], "\n", $raw))), 'strlen'));
            if (!empty($lines)) $patterns[$code] = $lines;
        }
        $json = json_encode($patterns);
        $db->prepare("INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=?")->execute([$user['id'], 'courier_patterns', $json, $json]);
        $msg = 'Pola resi ekspedisi disimpan.';
    }

    if ($action === 'save_notif') {
        $val = $_POST['notif_duplikat'] ?? '0';
        $db->prepare("INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=?")->execute([$user['id'], 'notif_duplikat', $val, $val]);
        $notifDuplikat = $val;
        $msg = 'Notifikasi disimpan.';
    }
}

include __DIR__ . '/../includes/header.php';
?>

<div class="page-container">

    <?php if ($msg): ?>
    <div class="alert alert-success" style="margin-bottom:var(--space-md);animation:slideInDown 0.3s ease"><?= htmlspecialchars($msg) ?></div>
    <?php endif; ?>

    <!-- Profile Section -->
    <div class="settings-section" style="animation:fadeInUp 0.3s ease">
        <div class="settings-section-title">Profil</div>
        <form method="POST" class="card">
            <input type="hidden" name="action" value="save_profile">
            <div class="form-group">
                <label class="form-label">Nama Toko / Gudang</label>
                <input type="text" name="nama_toko" class="form-input" value="<?= htmlspecialchars($namaToko) ?>" placeholder="Nama toko" required>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-sm)">
                Nama: <?= htmlspecialchars($user['nama']) ?> &bull; Role: <?= ucfirst($user['role']) ?>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Simpan Profil</button>
        </form>
    </div>

    <!-- Change Password -->
    <div class="settings-section" style="animation:fadeInUp 0.35s ease 0.05s both">
        <div class="settings-section-title">Keamanan</div>
        <form method="POST" class="card">
            <input type="hidden" name="action" value="change_password">
            <div class="form-group">
                <label class="form-label">Password Lama</label>
                <input type="password" name="old_password" class="form-input" placeholder="Password saat ini" required autocomplete="current-password">
            </div>
            <div class="form-group">
                <label class="form-label">Password Baru</label>
                <input type="password" name="new_password" class="form-input" placeholder="Min. 6 karakter" required autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-outline btn-sm">Ubah Password</button>
        </form>
    </div>

    <!-- Ekspedisi Aktif -->
    <div class="settings-section" style="animation:fadeInUp 0.4s ease 0.1s both">
        <div class="settings-section-title">Ekspedisi Aktif</div>
        <form method="POST" class="card">
            <input type="hidden" name="action" value="save_expedition">
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-md)">Pilih ekspedisi yang ditampilkan di halaman scan:</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-md)">
                <?php foreach ($allExpeditions as $code => $name): ?>
                <label class="settings-item" style="cursor:pointer;padding:10px var(--space-sm)">
                    <div>
                        <div class="settings-item-label"><?= $name ?></div>
                        <div class="settings-item-sub"><?= $code ?></div>
                    </div>
                    <input type="checkbox" name="expeditions[]" value="<?= $code ?>"
                           <?= in_array($code, $activeExp) ? 'checked' : '' ?>
                           style="width:18px;height:18px;accent-color:var(--primary)">
                </label>
                <?php endforeach; ?>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Simpan Ekspedisi</button>
        </form>
    </div>

    <!-- Pola Resi Ekspedisi -->
    <div class="settings-section" style="animation:fadeInUp 0.42s ease 0.12s both">
        <div class="settings-section-title">Pola / Sampel Resi Ekspedisi</div>
        <form method="POST" class="card">
            <input type="hidden" name="action" value="save_courier_patterns">
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-md)">
                Tulis pola nomor resi tiap ekspedisi dalam bentuk <b>regex</b> (satu pola per baris).
                Resi yang cocok dengan pola akan otomatis masuk ke ekspedisi tersebut.
                Biarkan kosong untuk memakai pola bawaan.
            </p>
            <?php foreach ($allExpeditions as $code => $name): ?>
            <div class="form-group">
                <label class="form-label" style="font-size:0.85rem"><?= htmlspecialchars($name) ?> <span style="color:var(--text-muted)">(<?= $code ?>)</span></label>
                <textarea name="pattern_<?= $code ?>" class="form-input" rows="3" placeholder="^JP\d{10}
^JT\d{10}"
style="font-family:monospace;font-size:0.82rem;resize:vertical"><?= trim(htmlspecialchars(implode("\n", $courierPatterns[$code] ?? []))) ?></textarea>
            </div>
            <?php endforeach; ?>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:var(--space-sm)">
                Tes pola Anda di halaman scan: ketik/skan nomor resi, ekspedisi akan terdeteksi otomatis.
            </p>
            <button type="submit" class="btn btn-primary btn-sm">Simpan Pola Resi</button>
        </form>
    </div>

    <!-- Notifikasi -->
    <div class="settings-section" style="animation:fadeInUp 0.45s ease 0.15s both">
        <div class="settings-section-title">Notifikasi</div>
        <form method="POST" class="card">
            <input type="hidden" name="action" value="save_notif">
            <div class="settings-item" style="border:none;padding:0;margin-bottom:var(--space-md)">
                <div>
                    <div class="settings-item-label">Peringatan Duplikat Resi</div>
                    <div class="settings-item-sub">Notifikasi jika resi sudah pernah discan hari ini</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" name="notif_duplikat" value="1" <?= $notifDuplikat === '1' ? 'checked' : '' ?> onchange="this.form.submit()">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </form>
    </div>

    <!-- Tampilan -->
    <div class="settings-section" style="animation:fadeInUp 0.5s ease 0.2s both">
        <div class="settings-section-title">Tampilan</div>
        <div class="card">
            <div class="settings-item" style="border:none;padding:0">
                <div>
                    <div class="settings-item-label">Mode Gelap</div>
                    <div class="settings-item-sub">Tampilan gelap lebih nyaman di malam hari</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="darkModeSwitch" <?= $darkMode === '1' ? 'checked' : '' ?> onchange="toggleDarkMode()">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
    </div>

    <?php if (isAdmin()): ?>
    <!-- Danger Zone -->
    <div class="settings-section" style="animation:fadeInUp 0.55s ease 0.25s both">
        <div class="settings-section-title" style="color:var(--danger)">Zona Berbahaya</div>
        <div class="card" style="border-color:rgba(239,68,68,0.3)">
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:var(--space-md)">
                Hapus semua data scan. Tindakan ini tidak dapat dibatalkan.
            </p>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteAll()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Hapus Semua Data Scan
            </button>
        </div>
    </div>
    <?php endif; ?>
</div>

<script>
function confirmDeleteAll() {
    if (confirm('⚠️ PERINGATAN: Ini akan menghapus SEMUA data scan secara permanen. Lanjutkan?')) {
        if (confirm('Apakah Anda yakin? Data tidak bisa dikembalikan!')) {
            fetch('<?= APP_URL ?>/api/scan_delete.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delete_all: true })
            }).then(r => r.json()).then(res => {
                if (res.success) { showToast('Semua data berhasil dihapus', 'success'); }
                else { showToast(res.message, 'error'); }
            });
        }
    }
}
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
