<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();
requireAdmin();

define('PAGE_TITLE', 'Kelola Pengguna');
$user = currentUser();
$db = getDB();

$msg = '';
$msgType = 'success';

// Handle create / update / delete
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'create') {
        $uname = trim($_POST['username'] ?? '');
        $nama  = trim($_POST['nama'] ?? '');
        $pw    = $_POST['password'] ?? '';
        $role  = in_array($_POST['role'] ?? '', ['admin','operator']) ? $_POST['role'] : 'operator';
        $toko  = trim($_POST['toko'] ?? 'Toko Utama');

        if ($uname && $nama && strlen($pw) >= 6) {
            try {
                $stmt = $db->prepare("INSERT INTO users (username, password, nama, role, toko) VALUES (?,?,?,?,?)");
                $stmt->execute([$uname, password_hash($pw, PASSWORD_DEFAULT), $nama, $role, $toko]);
                $newId = $db->lastInsertId();
                // Create default settings
                $db->prepare("INSERT IGNORE INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?)")->execute([$newId, 'dark_mode', '1']);
                $db->prepare("INSERT IGNORE INTO settings (user_id, setting_key, setting_value) VALUES (?,?,?)")->execute([$newId, 'ekspedisi_aktif', '["JNT","JNTC","JNE","SICEPAT","POS","NINJA","ANTERAJA","SPX","LAZADA"]']);
                $msg = 'Pengguna berhasil ditambahkan.';
            } catch (PDOException $e) {
                $msg = 'Username sudah ada.'; $msgType = 'danger';
            }
        } else {
            $msg = 'Lengkapi semua field. Password minimal 6 karakter.'; $msgType = 'warning';
        }
    }

    if ($action === 'toggle') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id !== $user['id']) {
            $stmt = $db->prepare("UPDATE users SET active = NOT active WHERE id = ?");
            $stmt->execute([$id]);
            $msg = 'Status pengguna diperbarui.';
        }
    }

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id !== $user['id'] && $id > 0) {
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
            $msg = 'Pengguna berhasil dihapus.';
        } else {
            $msg = 'Tidak dapat menghapus akun sendiri.'; $msgType = 'danger';
        }
    }

    if ($action === 'reset_password') {
        $id = (int)($_POST['id'] ?? 0);
        $pw = $_POST['new_password'] ?? '';
        if ($id > 0 && strlen($pw) >= 6) {
            $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([password_hash($pw, PASSWORD_DEFAULT), $id]);
            $msg = 'Password berhasil direset.';
        } else {
            $msg = 'Password minimal 6 karakter.'; $msgType = 'warning';
        }
    }
}

$users = $db->query("SELECT u.*, (SELECT COUNT(*) FROM scans WHERE user_id = u.id) as total_scans, u.last_login FROM users u ORDER BY u.role, u.nama")->fetchAll();

include __DIR__ . '/../includes/header.php';
?>

<div class="page-container">

    <?php if ($msg): ?>
    <div class="alert alert-<?= $msgType ?>" style="margin-bottom:var(--space-md);animation:slideInDown 0.3s ease">
        <?= htmlspecialchars($msg) ?>
    </div>
    <?php endif; ?>

    <!-- Add User Button -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
        <div class="section-title" style="margin-bottom:0">
            <span class="section-title-accent"></span>
            Daftar Pengguna
        </div>
        <button class="btn btn-primary btn-sm ripple-btn" onclick="openModal('addUserModal')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah
        </button>
    </div>

    <!-- User List -->
    <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        <?php foreach ($users as $u): ?>
        <div class="card" style="padding:var(--space-md);animation:fadeInUp 0.3s ease">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
                <div style="display:flex;align-items:center;gap:var(--space-sm)">
                    <div class="user-avatar" style="width:38px;height:38px;font-size:0.85rem">
                        <?= strtoupper(substr($u['nama'], 0, 1)) ?>
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:0.9rem"><?= htmlspecialchars($u['nama']) ?></div>
                        <div style="font-size:0.75rem;color:var(--text-muted)">@<?= htmlspecialchars($u['username']) ?></div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                    <span class="badge <?= $u['role'] === 'admin' ? 'badge-primary' : 'badge-info' ?>"><?= ucfirst($u['role']) ?></span>
                    <span class="badge <?= $u['active'] ? 'badge-success' : 'badge-danger' ?>"><?= $u['active'] ? 'Aktif' : 'Nonaktif' ?></span>
                </div>
            </div>

            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:var(--space-sm);display:flex;gap:var(--space-md)">
                <span>🏪 <?= htmlspecialchars($u['toko']) ?></span>
                <span>📦 <?= $u['total_scans'] ?> scan</span>
                <?php if ($u['last_login']): ?>
                <span>🕐 <?= date('d/m H:i', strtotime($u['last_login'])) ?></span>
                <?php endif; ?>
            </div>

            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <?php if ($u['id'] !== $user['id']): ?>
                <form method="POST" style="display:inline">
                    <input type="hidden" name="action" value="toggle">
                    <input type="hidden" name="id" value="<?= $u['id'] ?>">
                    <button class="btn btn-ghost btn-sm" type="submit">
                        <?= $u['active'] ? 'Nonaktifkan' : 'Aktifkan' ?>
                    </button>
                </form>
                <?php endif; ?>

                <button class="btn btn-outline btn-sm" onclick="openResetPw(<?= $u['id'] ?>, '<?= htmlspecialchars($u['nama']) ?>')">
                    Reset PW
                </button>

                <?php if ($u['id'] !== $user['id']): ?>
                <form method="POST" style="display:inline" onsubmit="return confirm('Hapus pengguna <?= htmlspecialchars($u['nama']) ?>?')">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="id" value="<?= $u['id'] ?>">
                    <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
                </form>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<!-- Add User Modal -->
<div class="modal-overlay" id="addUserModal">
    <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Tambah Pengguna</div>

        <form method="POST">
            <input type="hidden" name="action" value="create">

            <div class="form-group">
                <label class="form-label">Nama Lengkap</label>
                <input type="text" name="nama" class="form-input" placeholder="Nama pengguna" required>
            </div>
            <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" name="username" class="form-input" placeholder="Username unik" required autocomplete="off">
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" name="password" class="form-input" placeholder="Min. 6 karakter" required autocomplete="new-password">
            </div>
            <div class="form-group">
                <label class="form-label">Toko / Gudang</label>
                <input type="text" name="toko" class="form-input" placeholder="Nama toko" value="Toko Utama">
            </div>
            <div class="form-group">
                <label class="form-label">Role</label>
                <select name="role" class="form-select">
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
                <button type="button" class="btn btn-ghost btn-block" onclick="closeModal('addUserModal')">Batal</button>
                <button type="submit" class="btn btn-primary btn-block">Simpan</button>
            </div>
        </form>
    </div>
</div>

<!-- Reset Password Modal -->
<div class="modal-overlay" id="resetPwModal">
    <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Reset Password</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);text-align:center;margin-bottom:var(--space-md)" id="resetPwName"></div>

        <form method="POST">
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="id" id="resetPwId">
            <div class="form-group">
                <label class="form-label">Password Baru</label>
                <input type="password" name="new_password" class="form-input" placeholder="Min. 6 karakter" required autocomplete="new-password">
            </div>
            <div style="display:flex;gap:var(--space-sm)">
                <button type="button" class="btn btn-ghost btn-block" onclick="closeModal('resetPwModal')">Batal</button>
                <button type="submit" class="btn btn-primary btn-block">Reset</button>
            </div>
        </form>
    </div>
</div>

<script>
function openResetPw(id, nama) {
    document.getElementById('resetPwId').value = id;
    document.getElementById('resetPwName').textContent = 'Pengguna: ' + nama;
    openModal('resetPwModal');
}
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
