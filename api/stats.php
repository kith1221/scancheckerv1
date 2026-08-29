<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$user = currentUser();
$today = date('Y-m-d');
$thisMonth = date('Y-m');

try {
    $db = getDB();
    $uid = $user['id'];
    $isAdmin = $user['role'] === 'admin';

    $userFilter = $isAdmin ? '' : 'AND user_id = :uid';
    $params = $isAdmin ? [] : [':uid' => $uid];

    // Today totals
    $todayBarang = $db->prepare("SELECT COUNT(*) FROM scans WHERE scan_date = :d AND jenis = 'barang' $userFilter");
    $todayBarang->execute(array_merge([':d' => $today], $params));

    $todayRetur = $db->prepare("SELECT COUNT(*) FROM scans WHERE scan_date = :d AND jenis = 'retur' $userFilter");
    $todayRetur->execute(array_merge([':d' => $today], $params));

    // Month totals
    $monthBarang = $db->prepare("SELECT COUNT(*) FROM scans WHERE DATE_FORMAT(scan_date,'%Y-%m') = :m AND jenis = 'barang' $userFilter");
    $monthBarang->execute(array_merge([':m' => $thisMonth], $params));

    $monthRetur = $db->prepare("SELECT COUNT(*) FROM scans WHERE DATE_FORMAT(scan_date,'%Y-%m') = :m AND jenis = 'retur' $userFilter");
    $monthRetur->execute(array_merge([':m' => $thisMonth], $params));

    // All-time totals
    $totalBarang = $db->prepare("SELECT COUNT(*) FROM scans WHERE jenis = 'barang' $userFilter");
    $totalBarang->execute($params);

    $totalRetur = $db->prepare("SELECT COUNT(*) FROM scans WHERE jenis = 'retur' $userFilter");
    $totalRetur->execute($params);

    // Last 7 days chart data
    $chartData = [];
    for ($i = 6; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $stmt = $db->prepare("SELECT COUNT(*) FROM scans WHERE scan_date = :d $userFilter");
        $stmt->execute(array_merge([':d' => $d], $params));
        $chartData[] = [
            'date'  => date('d/m', strtotime($d)),
            'count' => (int)$stmt->fetchColumn(),
        ];
    }

    // Per expedition today
    $expStmt = $db->prepare("SELECT ekspedisi_kode, ekspedisi, COUNT(*) as cnt FROM scans WHERE scan_date = :d $userFilter GROUP BY ekspedisi_kode, ekspedisi ORDER BY cnt DESC");
    $expStmt->execute(array_merge([':d' => $today], $params));
    $byExpedition = $expStmt->fetchAll();

    jsonResponse(true, '', [
        'today_barang'   => (int)$todayBarang->fetchColumn(),
        'today_retur'    => (int)$todayRetur->fetchColumn(),
        'month_barang'   => (int)$monthBarang->fetchColumn(),
        'month_retur'    => (int)$monthRetur->fetchColumn(),
        'total_barang'   => (int)$totalBarang->fetchColumn(),
        'total_retur'    => (int)$totalRetur->fetchColumn(),
        'chart_7days'    => $chartData,
        'by_expedition'  => $byExpedition,
    ]);

} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
