<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

/**
 * pb_config.json を読み込む（共有ロック付き）。
 *
 * @return array|null 解析済み連想配列、ファイル不在・解析失敗時は null
 */
function pb_loadConfig() {
    $configPath = __DIR__ . '/../pb_config.json';
    if (!file_exists($configPath)) return null;

    $fp = fopen($configPath, 'r');
    if (!$fp) return null;

    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return json_decode($content, true);
}

/**
 * 指定ボードIDのボード設定を返す。
 *
 * @param string $boardId
 * @return array|null ボード設定連想配列、存在しない場合は null
 */
function pb_loadBoardConfig($boardId) {
    $config = pb_loadConfig();
    if (!$config) return null;

    $boards = $config['dashboards'] ?? [];
    return $boards[$boardId] ?? null;
}

/**
 * 全ボードIDの配列を返す。
 *
 * @return string[]
 */
function pb_loadAllBoardIds() {
    $config = pb_loadConfig();
    if (!$config) return [];

    $boards = $config['dashboards'] ?? [];
    return array_keys($boards);
}
