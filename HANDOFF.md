# 引き継ぎメモ

## 現在の公開方針

- 公開先: `https://kyoheitsudapf.com/performance-board/`
- 目的: 登録不要のゲストモードでダミーデータを閲覧できるポートフォリオ
- Salesforce: UIのみを残し、接続・認証情報の保存・実行は行わない。サーバー側のSF用エンドポイントはリポジトリから削除済み
- cron: 静的gzipキャッシュを使うため不要

## 本番で保持するファイル

通常デプロイでは以下を上書きしない設定です。

- `config.json`
- `performance_board/pb_config.json`
- `performance_board/cache/`
- `sessions/`
- `sf_config.php`

デモ設定を更新する場合は、`demo/pb_config.demo.json` を `performance_board/pb_config.json` へ、`demo/cache/board_*.json.gz` を `performance_board/cache/` へ直接配置します。

## デプロイ

接続情報は `.ftp-deploy.json` に置きます。このファイルは追跡対象外なので、`.ftp-deploy.json.example` をコピーして値を埋めてください。

```powershell
npm test
npm run build
node "<ftp-deploy プラグイン>/scripts/ftp-deploy.mjs" deploy conoha
```

`--allow-secrets` は付けないでください。このフラグは ftp-deploy の認証ファイル自動除外（`sf_config.php` 等）を無効化するため、過去に本番へ `sf_config.php` や SF 用エンドポイントを送ってしまった原因になっています。

`.ftp-deploy.json` の `ignoreGlobs` は、設定・セッション・デモキャッシュを保護するため削除しません。

## ローカル確認

```powershell
npm run build
php -S 127.0.0.1:8090 -t dist
```

ブラウザ確認を行う場合は、ゲストログイン、キャッシュ表示、フィルター操作、設定の閲覧、保存不可、Salesforce操作のデモメッセージを確認します。
