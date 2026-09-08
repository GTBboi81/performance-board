<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../auth_session.php';

function pb_config_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$configFile = __DIR__ . '/pb_config.json';

if ($method === 'GET') {
    $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
    $cookiePath = rtrim(dirname(dirname($scriptPath)), '/') . '/';
    app_start_session(__DIR__ . '/../sessions', $cookiePath);
    if ((string) ($_SESSION['userId'] ?? '') === '') {
        pb_config_error(401, 'Authentication required');
    }
    if (!file_exists($configFile)) {
        echo json_encode(['dashboards' => new stdClass(), 'activeId' => null]);
        exit;
    }
    $fp = fopen($configFile, 'r');
    if (!$fp || !flock($fp, LOCK_SH)) {
        if ($fp) {
            fclose($fp);
        }
        pb_config_error(500, 'Failed to read config');
    }
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    echo $content;
    exit;
}

if ($method !== 'POST') {
    pb_config_error(405, 'Method not allowed');
}

$referer = $_SERVER['HTTP_REFERER'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($referer && $host) {
    $parsed = parse_url($referer);
    $refererHost = ($parsed['host'] ?? '') . (isset($parsed['port']) ? ':' . $parsed['port'] : '');
    if ($refererHost !== $host) {
        pb_config_error(403, 'Forbidden');
    }
}

$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
$cookiePath = rtrim(dirname(dirname($scriptPath)), '/') . '/';
app_start_session(__DIR__ . '/../sessions', $cookiePath);
$config = app_read_json_file(__DIR__ . '/../config.json');
$userId = (string) ($_SESSION['userId'] ?? '');
$account = is_array($config) ? ($config['accounts'][$userId] ?? null) : null;
$roleId = is_array($account) ? (string) ($account['roleId'] ?? $account['role'] ?? '') : '';
$permissions = is_array($config) ? app_role_permissions($config, $roleId) : [];
if (!is_array($account) || !app_has_any_permission($permissions, [
    'performance-board.settings',
    'performance-board.dashboard.create',
    'performance-board.dashboard.delete',
    'analytics.dashboard.create',
    'analytics.dashboard.delete',
])) {
    pb_config_error(403, 'Permission denied');
}

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);
if (!is_array($data)) {
    pb_config_error(400, 'Invalid JSON');
}

$fp = fopen($configFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) {
    if ($fp) {
        fclose($fp);
    }
    pb_config_error(500, 'Failed to write config');
}
ftruncate($fp, 0);
rewind($fp);
$written = fwrite($fp, $rawData);
$flushed = fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);
if ($written === false || !$flushed) {
    pb_config_error(500, 'Failed to write config');
}
echo json_encode(['status' => 'success']);
