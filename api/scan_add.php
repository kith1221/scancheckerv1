<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'Method not allowed', null, 405);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonResponse(false, 'Invalid JSON', null, 400);

$no_resi      = trim($input['no_resi'] ?? '');
$ekspedisi    = trim($input['ekspedisi'] ?? 'Lainnya');
$ekspedisi_kode = strtoupper(trim($input['ekspedisi_kode'] ?? 'OTHER'));
$jenis        = in_array($input['jenis'] ?? '', ['barang','retur']) ? $input['jenis'] : 'barang';
$catatan      = trim($input['catatan'] ?? '');

if (strlen($no_resi) < 5) {
    jsonResponse(false, 'Nomor resi terlalu pendek (min. 5 karakter)');
}
if (strlen($no_resi) > 100) {
    jsonResponse(false, 'Nomor resi terlalu panjang (max. 100 karakter)');
}

$user = currentUser();

// Use the client-provided date so the stored scan matches the date shown on
// the scan page. Fall back to the server date when not provided/invalid.
$today = trim($input['scan_date'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $today)) {
    $today = date('Y-m-d');
}
$now = date('H:i:s');

try {
    $db = getDB();
    $stmt = $db->prepare("
        INSERT INTO scans 
            (no_resi, ekspedisi, ekspedisi_kode, jenis, user_id, username, toko, scan_date, scan_time, catatan)
        VALUES 
            (:no_resi, :ekspedisi, :ekspedisi_kode, :jenis, :user_id, :username, :toko, :scan_date, :scan_time, :catatan)
    ");

    $stmt->execute([
        ':no_resi'        => $no_resi,
        ':ekspedisi'      => $ekspedisi,
        ':ekspedisi_kode' => $ekspedisi_kode,
        ':jenis'          => $jenis,
        ':user_id'        => $user['id'],
        ':username'       => $user['username'],
        ':toko'           => $user['toko'],
        ':scan_date'      => $today,
        ':scan_time'      => $now,
        ':catatan'        => $catatan,
    ]);

    $id = $db->lastInsertId();
    jsonResponse(true, 'Scan berhasil disimpan', ['id' => $id, 'scan_time' => $now]);

} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
