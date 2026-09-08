<?php

function app_start_session(string $sessionPath, string $cookiePath): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $sessionLifetime = 60 * 60 * 24 * 30;
    if (!is_dir($sessionPath)) {
        @mkdir($sessionPath, 0700, true);
    }
    if (is_dir($sessionPath) && is_writable($sessionPath)) {
        ini_set('session.save_path', $sessionPath);
    }
    ini_set('session.gc_maxlifetime', (string) $sessionLifetime);
    session_set_cookie_params([
        'lifetime' => $sessionLifetime,
        'path' => $cookiePath,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function app_read_json_file(string $path): ?array
{
    if (!file_exists($path)) {
        return null;
    }

    $fp = fopen($path, 'r');
    if (!$fp) {
        return null;
    }

    try {
        if (!flock($fp, LOCK_SH)) {
            return null;
        }
        $content = stream_get_contents($fp);
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }

    $decoded = json_decode($content ?: '', true);
    return is_array($decoded) ? $decoded : null;
}

function app_role_permissions(array $config, string $roleId): array
{
    $permissions = $config['roles'][$roleId]['permissions'] ?? [];
    return is_array($permissions) ? $permissions : [];
}

function app_has_any_permission(array $permissions, array $permissionIds): bool
{
    if (($permissions['*'] ?? false) === true) {
        return true;
    }
    foreach ($permissionIds as $permissionId) {
        if (($permissions[$permissionId] ?? false) === true) {
            return true;
        }
    }
    return false;
}
