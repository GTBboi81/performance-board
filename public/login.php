<?php
// public/login.php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/auth_session.php';

function login_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function is_password_hash_value(string $value): bool
{
    return $value !== '' && (password_get_info($value)['algo'] ?? 0) !== 0;
}

function password_matches(string $storedPassword, string $providedPassword): bool
{
    if (is_password_hash_value($storedPassword)) {
        return password_verify($providedPassword, $storedPassword);
    }
    return $storedPassword !== '' && hash_equals($storedPassword, $providedPassword);
}

function migrate_plaintext_password(string $configPath, string $accountId, string $roleId, bool $usesRolePassword, string $password): void
{
    $fp = fopen($configPath, 'c+');
    if (!$fp) {
        return;
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            return;
        }
        rewind($fp);
        $config = json_decode(stream_get_contents($fp) ?: '', true);
        if (!is_array($config)) {
            return;
        }

        if ($usesRolePassword) {
            $stored = (string) ($config['roles'][$roleId]['password'] ?? '');
            if ($stored !== '' && !is_password_hash_value($stored) && hash_equals($stored, $password)) {
                $config['roles'][$roleId]['password'] = password_hash($password, PASSWORD_BCRYPT);
            }
        } else {
            $stored = (string) ($config['accounts'][$accountId]['password'] ?? '');
            if ($stored !== '' && !is_password_hash_value($stored) && hash_equals($stored, $password)) {
                $config['accounts'][$accountId]['password'] = password_hash($password, PASSWORD_BCRYPT);
            }
        }

        $encoded = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded !== false) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, $encoded);
            fflush($fp);
        }
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }
}

function login_response(string $id, array $account, string $roleId, bool $isGuest = false): void
{
    echo json_encode([
        'ok' => true,
        'user' => [
            'id' => $id,
            'name' => $account['name'] ?? '',
            'roleId' => $roleId,
            'dashboardAccess' => $account['dashboardAccess'] ?? [],
            'isGuest' => $isGuest,
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    login_error(405, 'Method not allowed');
}

$request = json_decode(file_get_contents('php://input'), true);
if (!is_array($request)) {
    login_error(400, 'Invalid JSON');
}

$cookiePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
$sessionPath = __DIR__ . '/sessions';
$action = $request['action'] ?? '';

if ($action === 'logout') {
    app_start_session($sessionPath, $cookiePath);
    $_SESSION = [];
    session_destroy();
    echo json_encode(['ok' => true]);
    exit;
}

try {
    $configPath = __DIR__ . '/config.json';
    $config = app_read_json_file($configPath);
    if ($config === null) {
        throw new RuntimeException('config.json not found or invalid');
    }

    $accounts = $config['accounts'] ?? [];
    $roles = $config['roles'] ?? [];

    if ($action === 'check') {
        app_start_session($sessionPath, $cookiePath);
        $id = (string) ($_SESSION['userId'] ?? '');
        $account = $accounts[$id] ?? null;
        $roleId = is_array($account) ? (string) ($account['roleId'] ?? $account['role'] ?? '') : '';
        if (!is_array($account) || $roleId === '' || !isset($roles[$roleId])) {
            login_error(401, 'Authentication required');
        }
        login_response($id, $account, $roleId, $id === 'guest');
    }

    if ($action === 'guest') {
        $account = $accounts['guest'] ?? null;
        $roleId = is_array($account) ? (string) ($account['roleId'] ?? $account['role'] ?? '') : '';
        if (!is_array($account) || $roleId === '' || !isset($roles[$roleId])) {
            login_error(401, 'Guest access is unavailable');
        }
        app_start_session($sessionPath, $cookiePath);
        session_regenerate_id(true);
        $_SESSION['userId'] = 'guest';
        $_SESSION['roleId'] = $roleId;
        login_response('guest', $account, $roleId, true);
    }

    $id = (string) ($request['id'] ?? '');
    $password = (string) ($request['password'] ?? '');
    $account = $accounts[$id] ?? null;
    $roleId = is_array($account) ? (string) ($account['roleId'] ?? $account['role'] ?? '') : '';
    $usesRolePassword = is_array($account) && empty($account['password']) && !empty($account['sfSync']);
    $storedPassword = $usesRolePassword
        ? (string) ($roles[$roleId]['password'] ?? '')
        : (string) ($account['password'] ?? '');

    if (!is_array($account) || $roleId === '' || !isset($roles[$roleId]) || !password_matches($storedPassword, $password)) {
        login_error(401, 'IDまたはパスワードが間違っています');
    }

    app_start_session($sessionPath, $cookiePath);
    session_regenerate_id(true);
    $_SESSION['userId'] = $id;
    $_SESSION['roleId'] = $roleId;

    if (!is_password_hash_value($storedPassword)) {
        migrate_plaintext_password($configPath, $id, $roleId, $usesRolePassword, $password);
    }

    login_response($id, $account, $roleId);
} catch (Throwable $e) {
    error_log('login.php: ' . $e->getMessage());
    login_error(500, 'Failed to read config');
}
