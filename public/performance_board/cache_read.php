<?php
/**
 * キャッシュJSONをPHP経由で配信するプロキシ
 * cache/ディレクトリへの直接HTTPアクセスを遮断した代わりに、
 * このエンドポイント経由で board_*.json.gz を安全に配信する。
 */
set_time_limit(60);
ini_set('memory_limit', '256M');
date_default_timezone_set('Asia/Tokyo');

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../auth_session.php';

$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
$cookiePath = rtrim(dirname(dirname($scriptPath)), '/') . '/';
app_start_session(__DIR__ . '/../sessions', $cookiePath);
if ((string) ($_SESSION['userId'] ?? '') === '') {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Authentication required']);
    exit;
}

// boardId バリデーション（英数字・アンダースコア・ハイフンのみ）
$boardId = $_GET['boardId'] ?? '';
if (!$boardId || !preg_match('/^[a-zA-Z0-9_-]+$/', $boardId)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid boardId']);
    exit;
}

$safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
$file = __DIR__ . "/cache/board_{$safeBoardId}.json.gz";

if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Cache not found']);
    exit;
}

header('Content-Encoding: gzip');
header('Cache-Control: no-cache, must-revalidate');
readfile($file);
