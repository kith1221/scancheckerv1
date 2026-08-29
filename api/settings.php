<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'Method not allowed', null, 405);

$input = json_decode(file_get_contents('php://input'), true);
$key   = trim($input['key'] ?? '');
$value = $input['value'] ?? '';
$uid   = currentUser()['id'];

if (empty($key)) jsonResponse(false, 'Key diperlukan');

try {
    $db = getDB();
    $stmt = $db->prepare("
        INSERT INTO settings (user_id, setting_key, setting_value) 
        VALUES (:uid, :key, :val)
        ON DUPLICATE KEY UPDATE setting_value = :val2
    ");
    $stmt->execute([':uid' => $uid, ':key' => $key, ':val' => $value, ':val2' => $value]);
    jsonResponse(true, 'Setting disimpan');
} catch (PDOException $e) {
    jsonResponse(false, 'Database error', null, 500);
}
