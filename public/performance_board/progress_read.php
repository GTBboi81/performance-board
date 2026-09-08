<?php
/**
 * 実績ボード — 進捗読み取り（ポーリング用）
 * GET /performance_board/progress_read.php?boardId=xxx
 */
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
require_once __DIR__ . '/../auth_session.php';

$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
$cookiePath = rtrim(dirname(dirname($scriptPath)), '/') . '/';
app_start_session(__DIR__ . '/../sessions', $cookiePath);
if ((string) ($_SESSION['userId'] ?? '') === '') {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Authentication required']);
    exit;
}

$boardId = $_GET['boardId'] ?? '';
if (!$boardId || !preg_match('/^[a-zA-Z0-9_-]+$/', $boardId)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'invalid boardId']);
    exit;
}

$safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
$file = __DIR__ . '/cache/board_' . $safeBoardId . '_progress.json';

if (!file_exists($file)) {
    // 進捗ファイルなし = 処理完了済み or 未開始
    echo json_encode([
        'status' => 'not_found',
        'boardId' => $boardId,
    ]);
    exit;
}

$content = @file_get_contents($file);
if ($content === false) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'failed to read progress']);
    exit;
}

$data = @json_decode($content, true);
if (!is_array($data)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'invalid progress data']);
    exit;
}

echo json_encode([
    'status' => 'ok',
    'progress' => $data,
]);
