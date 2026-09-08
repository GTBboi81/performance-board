<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

// sf_config.phpの場所（public/直下にある）
$sfConfigPath = __DIR__ . '/../../sf_config.php';
if (file_exists($sfConfigPath)) {
    require_once $sfConfigPath;
}
// Fallback definitions
if (!defined('SF_USERNAME')) define('SF_USERNAME', '');
if (!defined('SF_PASSWORD')) define('SF_PASSWORD', '');
if (!defined('SF_SECURITY_TOKEN')) define('SF_SECURITY_TOKEN', '');
if (!defined('SF_LOGIN_URL')) define('SF_LOGIN_URL', 'https://login.salesforce.com');
if (!defined('SF_API_VERSION')) define('SF_API_VERSION', 'v57.0');

/**
 * テナントID（または null）に応じた認証情報を返す。
 * テナント指定時は api/analytics/sf_credentials.json を参照する。
 */
function pb_resolveAuth($tenantId = null) {
    if ($tenantId) {
        $credFile = __DIR__ . '/../../api/analytics/sf_credentials.json';
        if (file_exists($credFile)) {
            $creds = json_decode(file_get_contents($credFile), true);
            if (isset($creds[$tenantId])) {
                $t = $creds[$tenantId];
                return [
                    'username'   => $t['username']   ?? '',
                    'password'   => ($t['password'] ?? '') . ($t['securityToken'] ?? ''),
                    'loginUrl'   => $t['loginUrl']   ?? 'https://login.salesforce.com',
                    'apiVersion' => $t['apiVersion'] ?? SF_API_VERSION,
                ];
            }
        }
    }
    return [
        'username'   => SF_USERNAME,
        'password'   => SF_PASSWORD . SF_SECURITY_TOKEN,
        'loginUrl'   => SF_LOGIN_URL,
        'apiVersion' => SF_API_VERSION,
    ];
}

/**
 * SF SOAP ログイン。セッションをキャッシュし 7 時間内は再利用する。
 *
 * @param string|null $tenantId マルチテナント用テナントID（省略時はデフォルト認証情報）
 * @return array{sessionId: string, instance: string}
 * @throws \Exception 認証失敗時
 */
function pb_soapLogin($tenantId = null) {
    $auth     = pb_resolveAuth($tenantId);
    $cacheDir = __DIR__ . '/../cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }

    $safeId    = $tenantId ? preg_replace('/[^a-zA-Z0-9_-]/', '_', $tenantId) : 'default';
    $cacheFile = "$cacheDir/_sf_session_{$safeId}.json";

    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if ($cached && isset($cached['expires']) && time() < $cached['expires']) {
            return ['sessionId' => $cached['sessionId'], 'instance' => $cached['instance']];
        }
    }

    $envelope = '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <login xmlns="urn:partner.soap.sforce.com">
      <username>' . htmlspecialchars($auth['username'], ENT_XML1, 'UTF-8') . '</username>
      <password>' . htmlspecialchars($auth['password'], ENT_XML1, 'UTF-8') . '</password>
    </login>
  </soap:Body>
</soap:Envelope>';

    $ch = curl_init($auth['loginUrl'] . '/services/Soap/u/' . $auth['apiVersion']);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: login',
        ],
        CURLOPT_POSTFIELDS     => $envelope,
    ]);
    $response = curl_exec($ch);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        error_log("[PB sf_auth] cURL error: $curlErr");
        throw new \Exception('SF SOAP認証失敗（通信エラー）');
    }

    if (preg_match('/<sessionId>(.+?)<\/sessionId>/', $response, $m1) &&
        preg_match('/<serverUrl>(.+?)<\/serverUrl>/',  $response, $m2)) {
        preg_match('/https:\/\/([^\/]+)/', $m2[1], $m3);
        $data = [
            'sessionId' => $m1[1],
            'instance'  => $m3[1],
            'expires'   => time() + 25200, // 7時間
        ];
        $tmpFile = $cacheFile . '.tmp.' . getmypid();
        if (file_put_contents($tmpFile, json_encode($data), LOCK_EX) === false) {
            @unlink($tmpFile);
            error_log("[sf_auth] セッションキャッシュ一時ファイル書込失敗: $cacheFile");
        } elseif (!rename($tmpFile, $cacheFile)) {
            @unlink($tmpFile);
            error_log("[sf_auth] セッションキャッシュ置換失敗: $cacheFile");
        }
        return ['sessionId' => $data['sessionId'], 'instance' => $data['instance']];
    }

    error_log("[PB sf_auth] SOAP response did not contain sessionId. Response: " . substr($response, 0, 500));
    throw new \Exception('SF SOAP認証失敗');
}
