<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

define('PAGE_TITLE', 'Feedback');

$user = currentUser();
$db = getDB();

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $judul = trim($_POST['judul'] ?? '');
    $pesan = trim($_POST['pesan'] ?? '');
    if ($judul && $pesan) {
        $db->prepare("INSERT INTO feedback (user_id, judul, pesan) VALUES (?,?,?)")->execute([$user['id'], $judul, $pesan]);
        $msg = 'Feedback berhasil dikirim. Terima kasih!';
    } else {
        $msg = 'Mohon lengkapi judul dan pesan.';
    }
}

// Get own feedbacks
$feedbacks = $db->prepare("SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
$feedbacks->execute([$user['id']]);
$feedbacks = $feedbacks->fetchAll();

include __DIR__ . '/../includes/header.php';
?>

<div class="page-container">

    <?php if ($msg): ?>
    <div class="alert alert-success" style="margin-bottom:var(--space-md)"><?= htmlspecialchars($msg) ?></div>
    <?php endif; ?>

    <!-- Send Feedback Form -->
    <div class="card" style="margin-bottom:var(--space-lg);animation:fadeInUp 0.3s ease">
        <div class="section-title" style="margin-bottom:var(--space-md)">
            <span class="section-title-accent"></span>
            Kirim Feedback
        </div>
        <form method="POST">
            <div class="form-group">
                <label class="form-label">Judul</label>
                <input type="text" name="judul" class="form-input" placeholder="Singkat dan jelas" required maxlength="200">
            </div>
            <div class="form-group">
                <label class="form-label">Pesan</label>
                <textarea name="pesan" class="form-input" rows="4" placeholder="Tulis saran, laporan bug, atau pertanyaan..." required style="resize:vertical"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Kirim Feedback
            </button>
        </form>
    </div>

    <!-- Feedback History -->
    <?php if ($feedbacks): ?>
    <div style="animation:fadeInUp 0.4s ease 0.1s both">
        <div class="section-title" style="margin-bottom:var(--space-sm)">
            <span class="section-title-accent"></span>
            Riwayat Feedback
        </div>
        <?php foreach ($feedbacks as $f): ?>
        <div class="card" style="margin-bottom:var(--space-sm)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div style="font-weight:600;font-size:0.88rem"><?= htmlspecialchars($f['judul']) ?></div>
                <span class="badge <?= $f['status'] === 'pending' ? 'badge-warning' : 'badge-success' ?>" style="flex-shrink:0;margin-left:8px">
                    <?= ucfirst($f['status']) ?>
                </span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5"><?= nl2br(htmlspecialchars($f['pesan'])) ?></div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px"><?= date('d/m/Y H:i', strtotime($f['created_at'])) ?></div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>
