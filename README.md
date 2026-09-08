# performance-board

## 概要

架空のコールセンター実績を、ダッシュボード・フィルター・集計表で閲覧できるポートフォリオです。実データやSalesforce認証情報を使わず、事前生成したダミーデータだけで操作感を確認できます。

## デモ

https://kyoheitsudapf.com/performance-board/

ログイン画面の **「ゲストモードで見る」** を選ぶと、登録不要で閲覧を開始できます。ゲストはフィルター操作、表示切替、テーマ切替、設定画面の閲覧が可能です。サーバーへの保存、ダッシュボードの作成・削除、データ再取得はできません。

## 解決する課題

日々の活動実績を、担当者・チーム・期間ごとに見比べるには、表計算ファイルを開いて集計し直す手間がかかります。このアプリでは、指標カード、フィルター、集計表を一つの画面にまとめ、状況確認を短時間で行えるUIを示しています。

## 使用技術

- React 19 / Vite 7 / Tailwind CSS
- PHP 8.1 互換のエンドポイント / Apache
- Web Worker によるデータ結合・計算
- Vitest / Testing Library / ESLint / Prettier
- ConoHa WING / FTPS

## AIツールの利用

分離作業では Claude Code を補助的に利用しました。生成・提案された変更はそのまま採用せず、既存コードとの整合性を確認し、権限制御・デモ用データ・テスト・本番ビルドで検証しています。

## 検証結果

- Vitest: 40テスト成功（認証、権限、ゲスト導線、gzipキャッシュ、Salesforce実行停止を確認）
- PHP構文チェック: `login.php`、`save_config.php`、`save_pb_config.php`、`generate.php` が成功
- 本番ビルド: `npm run build` が成功
- 未認証の共通設定取得は `globalSettings` のみを返却。ゲストには `accounts` を返さない
- ボード読み書き（`cache_read.php` / `progress_read.php` / `generate.php` / `save_pb_config.php`）はセッション必須
- `cron_runner.php` は CLI 限定。HTTP 経由は 403
- Salesforce操作はデモ用メッセージを表示し、SF用リクエストを発行しない

## 制約・未対応

- Salesforceとの実接続は意図的に無効です。認証情報を扱うサーバー側エンドポイントは同梱していません（UIのみを残しています）。
- 掲載データは固定シードで生成したダミーデータです。
- ゲストモードは読み取り専用です。
- 認証はアプリ内のIDとパスワードのみで、多要素認証やログイン試行回数の制限は実装していません。

## 開発・デモ資産の更新

```bash
npm install
cp public/config.example.json public/config.json   # 初回のみ。アカウント定義
npm test
npm run build
node scripts/build-demo-cache.mjs
```

`public/config.json` はアカウント情報を持つため追跡対象外です。`public/config.example.json` をコピーし、`CHANGE_ME` を実際のパスワードに置き換えてください。初回ログイン成功時に bcrypt ハッシュへ自動移行します。

`demo/pb_config.demo.json` と `demo/cache/` は、保護のため通常のFTPSデプロイ対象から除外しています。デモ設定・キャッシュを更新する場合は、対象ファイルだけを本番の `performance_board/` 配下へ直接配置してください。

### ローカルでの動作確認

認証やデータ取得は PHP で動くため、`npm run dev` では確認できません。ビルドしてから PHP の内蔵サーバーで配信します。

```bash
npm run build
php -S 127.0.0.1:8090 -t dist
```

`dist/` には `public/` の内容が `.htaccess` を含めてコピーされるため、本番に近い構成で確認できます。

ゲストログインまで確認する場合は、サーバー側で保持している資産を `dist/` に置いてください。

```bash
cp public/config.json dist/config.json
cp demo/pb_config.demo.json dist/performance_board/pb_config.json
cp demo/cache/*.gz dist/performance_board/cache/
```

2点、本番と異なる挙動があります。

- `php -S` は `.htaccess` を解釈しないため、`config.json` などへのアクセス制限は再現されません。遮断の確認は本番で行ってください
- `php -S` はシングルスレッドのため、複数の同時リクエストを伴う確認には向きません

## ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照してください。
