<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$user      = currentUser();
$date      = $_GET['date'] ?? date('Y-m-d');
$search    = trim($_GET['search'] ?? '');
$ekspedisi = strtoupper(trim($_GET['ekspedisi'] ?? ''));
$jenis     = trim($_GET['jenis'] ?? '');
$page      = max(1, (int)($_GET['page'] ?? 1));
$perPage   = min(100, max(10, (int)($_GET['per_page'] ?? 20)));
$offset    = ($page - 1) * $perPage;

try {
    $db = getDB();

    // Build WHERE
    $where = ['1=1'];
    $params = [];

    if ($date) {
        $where[] = 's.scan_date = :date';
        $params[':date'] = $date;
    }
    if ($search) {
        $where[] = 's.no_resi LIKE :search';
        $params[':search'] = "%$search%";
    }
    if ($ekspedisi) {
        $where[] = 's.ekspedisi_kode = :ekspedisi';
        $params[':ekspedisi'] = $ekspedisi;
    }
    if ($jenis) {
        $where[] = 's.jenis = :jenis';
        $params[':jenis'] = $jenis;
    }

    // Restrict operator to their own data
    if ($user['role'] !== 'admin') {
        $where[] = 's.user_id = :uid';
        $params[':uid'] = $user['id'];
    }

    $whereStr = implode(' AND ', $where);

    // Count
    $countStmt = $db->prepare("SELECT COUNT(*) FROM scans s WHERE $whereStr");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Data
    $stmt = $db->prepare("
        SELECT s.id, s.no_resi, s.ekspedisi, s.ekspedisi_kode, s.jenis,
               s.username, s.toko, s.scan_date, s.scan_time, s.catatan
        FROM scans s
        WHERE $whereStr
        ORDER BY s.scan_date DESC, s.scan_time DESC
        LIMIT :limit OFFSET :offset
    ");
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $scans = $stmt->fetchAll();

    // Expedition counts (for today by default)
    $countDate = $date ?: date('Y-m-d');
    $expWhere = ['scan_date = :cd'];
    $expParams = [':cd' => $countDate];
    if ($jenis) { $expWhere[] = 'jenis = :jenis'; $expParams[':jenis'] = $jenis; }
    if ($user['role'] !== 'admin') { $expWhere[] = 'user_id = :uid'; $expParams[':uid'] = $user['id']; }
    $expWhereStr = implode(' AND ', $expWhere);

    $expStmt = $db->prepare("SELECT ekspedisi_kode, COUNT(*) as cnt FROM scans WHERE $expWhereStr GROUP BY ekspedisi_kode");
    $expStmt->execute($expParams);
    $counts = [];
    foreach ($expStmt->fetchAll() as $row) {
        $counts[$row['ekspedisi_kode']] = (int)$row['cnt'];
    }

    jsonResponse(true, '', ['scans' => $scans, 'total' => $total, 'counts' => $counts]);

} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
