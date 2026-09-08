# 実績ボード（performance-board）デザイン書

最終更新: 2026-07-22（グループ帯・密度プリセット機能を削除。ヘッダー高さ単一実体・設定ポップアップのパッチ方式は維持）
バージョン連動: `version.json`

このドキュメントは **performance-board の UI を今後刷新していくためのベースライン**。現状のデザインパターンを棚卸しし、刷新時に守るべき原則・トークン・コンポーネント仕様をまとめる。

---

## 1. 目的と位置づけ

- **対象範囲**: `glass-dashboard/src/apps/performance-board/` 配下のみ
- **他アプリとの関係**: デザイントークン（色・余白・フォント）は analytics と共通の Tailwind デフォルトに揃える。performance-board 固有の拡張はこの文書に記載
- **読者**: 実装担当（Claude / 人間）/ レビュアー
- **運用**: UI 刷新の都度このドキュメントを更新し、`version.json` に変更を記録する

---

## 2. デザイン原則（5つ）

| # | 原則 | 具体 |
|---|------|------|
| 1 | **ダッシュボード第一** | 最初の1画面で KPI → 集計 → 明細の順に視線誘導。装飾より情報密度 |
| 2 | **静かな UI** | 装飾アニメは 200ms 以内。グラデーションや影は控えめ。データが主役 |
| 3 | **ダーク／ライト等価** | どちらのテーマでも同等のコントラスト・情報量。片方を劣後させない |
| 4 | **非エンジニアが使える** | 設定項目には補助テキストと例。破壊的操作は必ず確認ダイアログ |
| 5 | **実機で動くことがすべて** | ビルド通過・コードレビュー合格は完了条件ではない。ブラウザで実際に触って動いた状態のみ完了 |

---

## 3. カラーシステム（デザイントークン）

Tailwind デフォルトパレットを使用。`tailwind.config.js` は `darkMode: 'class'`。

### 3.1 セマンティックカラー

| 役割 | dark | light | 用途 |
|------|------|-------|------|
| Primary / Accent | `indigo-500` / `indigo-400` | `indigo-600` / `indigo-700` | 主要アクション、フォーカス、選択状態 |
| Success / OK | `emerald-400` | `emerald-700` | 正常・完了・patch 種別 |
| Warning / Perf | `amber-400` | `amber-700` | 注意・パフォーマンス関連 |
| Danger / Destructive | `rose-400` | `rose-700` | エラー・削除・major 種別 |
| Info / Refactor | `sky-400` | `sky-700` | 情報・リファクタ種別 |
| Muted | `slate-400` / `gray-400` | `gray-500` / `gray-600` | 説明文、補助情報 |

### 3.2 サーフェス（面）

| 階層 | dark | light |
|------|------|-------|
| 背景ベース | `slate-900` | `white` / `gray-50` |
| カード（glass） | `slate-800/95` + `border-white/10` | `white/95` + `border-gray-200` |
| カード内セクション | `white/5` + `border-white/10` | `gray-50` + `border-gray-200` |
| オーバーレイ背景 | `black/60` | `black/30` |
| ホバー表面 | `white/10` | `gray-100` |

### 3.3 テキスト

| 強度 | dark | light |
|------|------|-------|
| 第一テキスト | `text-white` | `text-gray-900` |
| 第二テキスト | `text-white/80` | `text-gray-700` |
| 補助テキスト | `text-white/60` | `text-gray-500` |
| 無効・プレースホルダ | `text-white/40` | `text-gray-400` |

### 3.4 カテゴリ別（バージョン履歴・バッジ等）

| カテゴリ | dark bg/text | light bg/text |
|----------|--------------|---------------|
| feat | `bg-indigo-500/20 text-indigo-400` | `bg-indigo-100 text-indigo-700` |
| fix | `bg-rose-500/20 text-rose-400` | `bg-rose-100 text-rose-700` |
| perf | `bg-amber-500/20 text-amber-400` | `bg-amber-100 text-amber-700` |
| refactor | `bg-sky-500/20 text-sky-400` | `bg-sky-100 text-sky-700` |
| docs | `bg-gray-500/20 text-gray-400` | `bg-gray-100 text-gray-600` |
| chore | `bg-slate-500/20 text-slate-400` | `bg-slate-100 text-slate-600` |

---

## 4. タイポグラフィ

| 要素 | サイズ | ウェイト | 備考 |
|------|--------|----------|------|
| ページタイトル | `text-lg` / `text-xl` | `font-bold` | 画面冒頭の見出し |
| セクションタイトル | `text-base` | `font-bold` | カード内の見出し |
| KPI 数値（大） | `text-3xl` 〜 `text-5xl` | `font-extrabold` | 主要 KPI。数値はタブラー想定 |
| KPI 数値（小・サブ） | `text-base` 〜 `text-lg` | `font-bold` | サブメトリクス |
| ラベル | `text-xs` / `text-sm` | `font-medium` | 入力ラベル、KPIラベル |
| 補助テキスト | `text-xs` | `font-normal` | 単位、説明、日時 |
| バッジ | `text-[11px]` 〜 `text-xs` | `font-medium` / `font-mono` | ステータス・バージョン |
| コード・バージョン | `font-mono` | - | `v1.0.0` の表示等 |

行間: Tailwind デフォルト（`leading-normal`）。数値が詰まる箇所は `leading-tight`。

---

## 5. スペーシング・レイアウト

### 5.1 余白スケール（Tailwind）

| スケール | px | 用途 |
|----------|----|----|
| `p-1.5` | 6 | バッジ内 |
| `p-2` | 8 | ボタン内 |
| `p-3` | 12 | サブサイドバー内ブロック、カード内 |
| `p-4` | 16 | 標準カード内 |
| `p-5` | 20 | モーダル内 |
| `p-6` / `p-8` | 24 / 32 | ページ余白、大モーダル |
| `gap-1.5` / `gap-2` / `gap-4` | 6/8/16 | 行間、子要素間 |

### 5.2 角丸

| クラス | 用途 |
|--------|------|
| `rounded-md` | 小バッジ・ボタン |
| `rounded-lg` | 通常のボタン・入力 |
| `rounded-xl` | 内包カード |
| `rounded-2xl` | 最外カード・モーダル |
| `rounded-full` | ピル・アバター |

### 5.3 影

| クラス | 用途 |
|--------|------|
| `shadow-lg` | ライトモード標準カード |
| `shadow-xl` | ダークモード標準カード |
| `shadow-2xl` | モーダル |

### 5.4 ページレイアウト

```
<aside> サブサイドバー（w-48, h-screen, sticky top-0）
  ├ ボード一覧
  ├ タブ切替（アナリティクス / 設定 / SF連携）
  └ VersionBadge（最下部 border-t）
<main>（flex-1 px-6）
  ├ DashboardHeader（フィルターバー・ステータス）
  ├ KpiSection（KPIカード行）
  ├ ChartSection / RankingCard / HeadingCard
  ├ ComparisonTable / PivotTable / VendorPivotTable
  └ DataTable（sticky header、仮想スクロール想定）
```

モバイル: サブサイドバーは `hidden md:flex`。モバイル用トグル未実装（刷新時の課題）。

---

## 6. ダーク／ライトテーマ

### 6.1 切替方式

- Tailwind `darkMode: 'class'`（`tailwind.config.js`）
- `theme` prop（`'dark'` / `'light'`）を全コンポーネントに流し、内部で条件分岐
- `theme === 'dark'` を真理値に三項演算子で分岐する実装パターン（現状）

### 6.2 glassClass パターン（標準カード）

```js
const glassClass = theme === 'dark'
  ? 'bg-slate-800/95 border border-white/10 shadow-xl'
  : 'bg-white/95 border border-gray-200 shadow-lg';
```

### 6.3 刷新時の方針

- `theme === 'dark' ? A : B` の三項演算子が散在している。**CSS 変数 + `dark:` バリアント**に移行する（長期課題）
- トークンを `styles/tokens.css` に切り出し、`var(--surface-base)` のような参照へ変更

---

## 7. コンポーネントカタログ

### 7.1 現状実装済み

| コンポーネント | 役割 | パス |
|----------------|------|------|
| `DashboardHeader` | フィルター・更新・キャッシュ状態 | `components/DashboardHeader.jsx` |
| `KpiSection` / `KpiCard` | KPI 表示、式ツールチップ付き | `components/Kpi*.jsx` |
| `DataTable` + 子要素 | 明細テーブル、列色・エイリアス | `components/DataTable*.jsx` |
| `PivotTable` / `VendorPivotTable` | ピボット集計 | 同上 |
| `ComparisonTable` | 期間比較 | 同上 |
| `ChartSection` | recharts による折れ線・棒 | 同上 |
| `RankingCard` / `HeadingCard` | ランキング・見出しカード | 同上 |
| `MultiSelectDropdown` / `DateRangeDropdown` | フィルター UI | 同上 |
| `FilterCard` | フィルターカード（折りたたみ+適用中チップ表示） | `components/FilterCard.jsx` |
| `VersionBadge` / `VersionHistoryModal` | バージョン表示 | 同上 |
| `GlobalPicklistManager` | グローバルピックリスト管理 | 同上 |
| `SalesforceSync` / `SalesforceExportModal` / `SalesforceUnifiedImport` | SF連携 | 同上 |
| `components/settings/*` | 設定タブ群 | - |
| `components/shared/*` | サブ用途 | - |

※ `components/dashboard/`（`FilterDropdowns` 含む）は未参照のデッドコードだったため 2026-07 に削除済み。

### 7.2 命名規則

- 画面単位: `{機能名}View.jsx`（例: `DashboardView`）
- セクション: `{対象}Section.jsx`
- カード: `{対象}Card.jsx`
- テーブル: `{対象}Table.jsx`
- モーダル: `{対象}Modal.jsx`
- ドロップダウン: `{対象}Dropdown.jsx`
- タブ: `{対象}Tab.jsx`（`settings/` 配下）

### 7.3 DataTable 表示層の実体（2026-07 UI刷新で追加）

> グループ区切り（2段ヘッダーの色帯）と密度プリセット機能は実機確認の結果ユーザー判断で
> 2026-07 に削除済み（デッドコード化を避けるため機能ごと削除。`resolveDataTableDensity` と
> 設定ポップアップのパッチ方式は独立した改善のため維持）。

#### ヘッダー高さの単一実体（不変ルール）

`utils/dataTableHeaderLayout.js`（`getDefaultDataTableHeaderRowHeight` / `resolveDataTableDensity`）が
ヘッダー・合計行・データ行の高さ計算の**唯一の実体**。`DataTable.jsx`（描画・STICKY_H）と
`useDataTableLayout.js`（tableHeight）はすべてここを経由する。
**高さ計算を変える変更は必ずこのファイルを経由すること。** 独自計算を増やすと
仮想スクロールの可視範囲（`STICKY_H`）と実描画高が食い違い、スクロール時に行が欠ける。
優先順位はテーブル個別設定（`headerFontSize` 等 / 旧来の共通 `fontSize`） > 自動算出。

#### 設定ポップアップのパッチ方式

`DataTableSettingsPopup` は設定全体をコピーせず、**ユーザーが変更したフィールドだけの patch** を保持し、
ライブプレビュー（`onChange`）にも保存（`onSave`）にも patch のみを渡す。
保存先 `updateDataTableSettings` は部分マージ（`{...t, ...updates}`）のため、
ポップアップが触っていないフィールドを他の経路（ツールバー等）の並行変更ごと上書きしない。
**全量コピー方式に戻さないこと**（並行変更の巻き戻しバグが再発する）。

---

## 8. モーダル・オーバーレイ（重要）

### 8.1 必須ルール

**すべての全画面モーダルは `createPortal(jsx, document.body)` を使う。** 例外なし。

**理由**: サブサイドバーは `position: sticky + overflow-y-auto` を持ち、CSS スタッキングコンテキストを作る。その内部でレンダリングされた `fixed inset-0 z-50` はコンテキスト外の要素（ダッシュボード本体）に負けて埋もれる。`document.body` 直下にポータル化しないと画面全体を覆えない。

### 8.2 モーダルのテンプレート

```jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const MyModal = ({ theme, onClose, children }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/60' : 'bg-black/30'}`} />
      <div
        className={`relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${
          theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
```

### 8.3 必須実装項目

| 項目 | 実装 |
|------|------|
| Portal化 | `createPortal(jsx, document.body)` |
| z-index | `z-[9999]`（`z-50` は不十分） |
| ESC で閉じる | `keydown` リスナー |
| 背景クリックで閉じる | オーバーレイ onClick = onClose |
| 中身クリックで閉じない | `e.stopPropagation()` |
| body スクロールロック | `document.body.style.overflow = 'hidden'` + cleanup |
| role/aria | `role="dialog" aria-modal="true"` |

### 8.4 ツールチップ・ポップオーバー

- 小さいフロート UI（KpiCard の式ツールチップ等）も **`createPortal` 推奨**。テーブル内やスクロール領域内で位置計算する場合は `getBoundingClientRect` + `window.scrollY/scrollX` でビューポート座標に変換
- クリック外で閉じる（`mousedown` で `contains` チェック）

---

## 9. アイコン

- ライブラリ: `lucide-react`
- サイズ基準: バッジ=12, ボタン=14〜16, セクションアイコン=18〜20, ヘッダー=24〜32
- `strokeWidth` はデフォルト（2）。強調時 2.5

よく使うアイコン:

| 用途 | アイコン |
|------|----------|
| 更新・再計算 | `RefreshCw` / `RotateCcw` / `Calculator` |
| キャッシュ・DB | `Database` / `HardDriveDownload` |
| フィルター | `Filter` / `ChevronDown` / `ChevronUp` |
| 保存 | `Bookmark` / `BookmarkCheck` |
| エラー | `AlertCircle` / `AlertTriangle` / `ShieldAlert` |
| 閉じる | `X` |
| 並び替え | `ArrowUp` / `ArrowDown` / `ArrowUpDown` |
| バージョン | `Tag` / `GitBranch` |
| モバイルサイドバー | `PanelLeft` |
| ローディング | `Loader2`（`animate-spin`） |

---

## 10. アクセシビリティ

| 項目 | 方針 |
|------|------|
| キーボード操作 | モーダル ESC / Tab 順序 / Enter確定 |
| タップ対象 | 最小 32px 正方形、主要CTAは 40px 以上 |
| コントラスト | 本文は WCAG AA（4.5:1）。dark / light 両方で検証 |
| フォーカスリング | ブラウザ既定を消さない。消す場合は独自 `focus-visible:ring-2` で代替 |
| ARIA | モーダル `role="dialog" aria-modal="true"`、`aria-label` で閉じるボタン等を明示 |
| 色に依存しない | ステータスは色＋テキスト/アイコン併記（例: feat / fix はラベルも表示） |

---

## 11. レスポンシブ

| ブレークポイント | Tailwind | 想定 |
|------------------|----------|------|
| デフォルト | `-` | モバイル（〜 640px） |
| md | `md:` | タブレット（768px〜） |
| lg | `lg:` | デスクトップ（1024px〜） |

現状の対応:

- サブサイドバー: `hidden md:flex`（モバイル非表示）
- ダッシュボード本体: モバイル対応は部分的。**刷新時にモバイル表示の設計が必要**
- `onToggleMobileSubSidebar` プロップが存在するが未配線

---

## 12. パフォーマンス方針

- 大量行テーブルは仮想スクロール（`react-window` 既に依存済み）
- 計算は Web Worker に逃す（Phase 5.2 予定）
- ステート更新は IndexedDB キャッシュ併用
- レンダリング最適化: `useMemo` / `useCallback` は計測後に投入。**先回りの最適化は禁止**

---

## 13. アニメーション

| 種類 | 指針 |
|------|------|
| トランジション | `transition-all duration-200` が標準。300ms 以上は情報遅延で避ける |
| スピナー | `Loader2` + `animate-spin` |
| フェード・スライド | 装飾的アニメは原則なし。モーダルは opacity transition のみ可 |
| バウンス・パルス | 通知バッジ等限定用途。データ要素には使わない |

---

## 14. 刷新ロードマップ（TODO）

現状の課題と刷新案。**実施する際は Plans.md に Phase としてタスク分解し、このドキュメントも同時更新する。**

| 区分 | 現状の課題 | 刷新案 |
|------|-----------|--------|
| テーマ切替 | `theme === 'dark' ? A : B` の三項演算子が全コンポーネントに散在 | CSS 変数 + Tailwind `dark:` バリアントへ統一 |
| モーダル統一 | 個別実装にバラつき。Portal 忘れで過去バグ発生 | `<Modal>` 共通コンポーネント化 + Storybook的カタログ |
| モバイル | サブサイドバーモバイル未対応、テーブル横スクロール UX 要改善 | bottom sheet / drawer 導入 |
| タイポ | サイズ指定が ad-hoc | `text-kpi-lg` 等セマンティッククラスに |
| カラー | 三項演算子に色名が直書き | `semantic-*` クラスで抽象化 |
| 密度 | KPI セクションが縦に長い | 折りたたみ / ダッシュボード密度切替 |
| フィルターバー | 横並びで幅を圧迫 | セグメント + ポップオーバー型に再構成 |
| 空状態 | `No data` 系の空状態 UI が不揃い | EmptyState コンポーネント化 |
| エラー表示 | エラー時の文言がまちまち | ErrorBoundary + 文言ガイドライン |

---

## 15. 実装時の必須チェックリスト

UI を追加・変更した時は以下を**実機で**確認してから完了報告する。

- [ ] ダーク／ライト両方で表示崩れなし
- [ ] モバイル幅（375px）で破綻しない or 許容範囲
- [ ] モーダル／ポップオーバーが画面全体を覆う（親スタッキングで埋もれない）
- [ ] ESC キー / 背景クリックでモーダルが閉じる
- [ ] モーダル open 時に body がスクロールロックされる
- [ ] Tab キーでフォーカス移動できる
- [ ] 破壊的操作（削除・上書き）は確認ダイアログ
- [ ] ローディング中は操作を抑止（disabled or overlay）
- [ ] エラー時の UI（文言・再試行）がある
- [ ] `npm run build` 成功
- [ ] ブラウザで実際に触って動作確認

ビルド成功とコードレビュー APPROVE は「完了」の十分条件ではない。**実際に触って動くこと**が唯一の完了条件。

---

## 16. 参考・関連ドキュメント

- `glass-dashboard/src/apps/performance-board/Plans.md` — 開発計画
- `glass-dashboard/src/apps/performance-board/version.json` — バージョン・変更履歴
- `glass-dashboard/src/apps/performance-board/CLAUDE.md`（将来作成予定）— アプリ固有の実装ルール
- `.claude/rules/analytics-ui.md` — 設定パネル UI ルール（performance-board も踏襲）
- `.claude/rules/pb-version-bump.md` — バージョン自動 bump ルール
- Tailwind CSS: https://tailwindcss.com/docs
- lucide-react: https://lucide.dev
