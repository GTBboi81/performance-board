<?php
// public/save_config.php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/auth_session.php';

function config_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function config_is_password_hash(string $value): bool
{
    return $value !== '' && (password_get_info($value)['algo'] ?? 0) !== 0;
}

function preserve_passwords_and_hash(array &$incoming, array $existing): void
{
    foreach (['accounts', 'roles'] as $group) {
        if (!isset($incoming[$group]) || !is_array($incoming[$group])) {
            continue;
        }
        foreach ($incoming[$group] as $id => &$entry) {
            if (!is_array($entry)) {
                continue;
            }
            $existingPassword = (string) ($existing[$group][$id]['password'] ?? '');
            if (!array_key_exists('password', $entry) && $existingPassword !== '') {
                $entry['password'] = $existingPassword;
            } elseif (isset($entry['password']) && $entry['password'] !== '' && !config_is_password_hash((string) $entry['password'])) {
                $entry['password'] = password_hash((string) $entry['password'], PASSWORD_BCRYPT);
            }
            unset($entry['hasPassword']);
        }
        unset($entry);
    }
}

$configPath = __DIR__ . '/config.json';
$cookiePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
$sessionPath = __DIR__ . '/sessions';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    app_start_session($sessionPath, $cookiePath);
    $userId = (string) ($_SESSION['userId'] ?? '');
    if ($userId === '') {
        config_error(401, 'Authentication required');
    }

    $incoming = json_decode(file_get_contents('php://input'), true);
    if (!is_array($incoming)) {
        config_error(400, 'Invalid JSON');
    }

    $fp = fopen($configPath, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) {
        if ($fp) {
            fclose($fp);
        }
        config_error(500, 'Failed to write file');
    }

    try {
        rewind($fp);
        $existing = json_decode(stream_get_contents($fp) ?: '', true);
        if (!is_array($existing)) {
            config_error(500, 'Invalid server config');
        }
        $account = $existing['accounts'][$userId] ?? null;
        $roleId = is_array($account) ? (string) ($account['roleId'] ?? $account['role'] ?? '') : '';
        $permissions = app_role_permissions($existing, $roleId);
        $isAdmin = ($permissions['*'] ?? false) === true;
        $canSaveBoard = app_has_any_permission($permissions, [
            'performance-board.dashboard.create',
            'performance-board.dashboard.delete',
            'analytics.dashboard.create',
            'analytics.dashboard.delete',
        ]);
        if (!is_array($account) || (!$isAdmin && !$canSaveBoard)) {
            config_error(403, 'Permission denied');
        }

        if (!$isAdmin) {
            foreach (['accounts', 'roles', 'globalSettings'] as $protectedKey) {
                if (array_key_exists($protectedKey, $existing)) {
                    $incoming[$protectedKey] = $existing[$protectedKey];
                } else {
                    unset($incoming[$protectedKey]);
                }
            }
        } else {
            preserve_passwords_and_hash($incoming, $existing);
        }

        $encoded = json_encode($incoming, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            config_error(400, 'Invalid config');
        }
        ftruncate($fp, 0);
        rewind($fp);
        $written = fwrite($fp, $encoded);
        $flushed = fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        if ($written === false || !$flushed) {
            config_error(500, 'Failed to write file');
        }

        $stillExists = isset($incoming['accounts'][$userId]) && is_array($incoming['accounts'][$userId]);
        if (!$stillExists) {
            $_SESSION = [];
            session_destroy();
        }
        echo json_encode(['status' => 'success', 'message' => 'Config saved', 'loggedOut' => !$stillExists]);
    } catch (Throwable $e) {
        if (is_resource($fp)) {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
        error_log('save_config.php: ' . $e->getMessage());
        config_error(500, 'Failed to write file');
    }
    exit;
}

$config = app_read_json_file($configPath);
if ($config === null) {
    echo json_encode(['status' => 'empty']);
    exit;
}

app_start_session($sessionPath, $cookiePath);
$sessionUserId = (string) ($_SESSION['userId'] ?? '');
$account = $config['accounts'][$sessionUserId] ?? null;
if (!is_array($account)) {
    echo json_encode(['globalSettings' => $config['globalSettings'] ?? new stdClass()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$roleId = (string) ($account['roleId'] ?? $account['role'] ?? '');
$permissions = app_role_permissions($config, $roleId);

foreach (['accounts', 'roles'] as $group) {
    if (!isset($config[$group]) || !is_array($config[$group])) {
        continue;
    }
    foreach ($config[$group] as &$entry) {
        if (!is_array($entry)) {
            continue;
        }
        $entry['hasPassword'] = !empty($entry['password']);
        unset($entry['password']);
    }
    unset($entry);
}

if (!app_has_any_permission($permissions, [])) {
    echo json_encode([
        'globalSettings' => $config['globalSettings'] ?? new stdClass(),
        'roles' => $config['roles'] ?? new stdClass(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
