// src/apps/performance-board/permissions.js
// 実績ボードの権限定義
import { registerAppPermissions } from '../../apps';

export const appPermissions = {
  appId: 'performance-board',
  appName: '実績ボード',
  features: [
    {
      id: 'performance-board.view',
      name: '閲覧',
      description: '実績ボードの閲覧',
      defaultEnabled: true
    },
    {
      id: 'performance-board.settings',
      name: '設定タブ',
      description: '設定タブへのアクセス',
      defaultEnabled: false
    },
    {
      id: 'performance-board.dashboard.create',
      name: 'ダッシュボード作成',
      description: '新規ダッシュボードの作成・複製',
      defaultEnabled: false
    },
    {
      id: 'performance-board.dashboard.delete',
      name: 'ダッシュボード削除',
      description: 'ダッシュボードの削除',
      defaultEnabled: false
    },
    {
      id: 'performance-board.export',
      name: 'エクスポート',
      description: '設定のエクスポート/インポート',
      defaultEnabled: false
    },
    {
      id: 'performance-board.salesforce',
      name: 'Salesforce連携',
      description: 'Salesforceへのデータインポート',
      defaultEnabled: false
    }
  ]
};

// 起動時に権限定義を登録
registerAppPermissions('performance-board', appPermissions);
