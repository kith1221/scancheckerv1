<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'Method not allowed', null, 405);

$input = json_decode(file_get_contents('php://input'), true);

// Delete all scans
if (!empty($input['delete_all'])) {
    try {
        $db = getDB();
        $db->exec("DELETE FROM scans");
        jsonResponse(true, 'Semua data scan berhasil dihapus');
    } catch (PDOException $e) {
        jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
    }
}

$id = (int)($input['id'] ?? 0);
if ($id <= 0) jsonResponse(false, 'ID tidak valid');

try {
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM scans WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $affected = $stmt->rowCount();

    if ($affected > 0) {
        jsonResponse(true, 'Data berhasil dihapus');
    } else {
        jsonResponse(false, 'Data tidak ditemukan');
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
