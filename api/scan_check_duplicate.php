<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$resi = trim($_GET['resi'] ?? '');
$date = $_GET['date'] ?? date('Y-m-d');

if (empty($resi)) jsonResponse(false, 'Resi diperlukan');

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT id, scan_time, ekspedisi FROM scans WHERE no_resi = :resi AND scan_date = :date LIMIT 1");
    $stmt->execute([':resi' => $resi, ':date' => $date]);
    $row = $stmt->fetch();

    if ($row) {
        jsonResponse(true, 'Duplicate found', [
            'is_duplicate' => true,
            'scan_id'      => $row['id'],
            'scan_time'    => substr($row['scan_time'], 0, 5),
            'ekspedisi'    => $row['ekspedisi'],
        ]);
    } else {
        jsonResponse(true, 'Not duplicate', ['is_duplicate' => false]);
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error', null, 500);
}
