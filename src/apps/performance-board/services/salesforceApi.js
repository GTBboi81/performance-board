// src/apps/performance-board/services/salesforceApi.js
// Salesforce連携APIサービス（Analytics専用PHPプロキシ経由）
// テナント別SF認証に対応。tenantId未指定時はsf_config.phpにフォールバック。

const SF_PROXY = './sf_proxy.php';
const SF_CRED = './api/analytics/sf_credentials.php';

// 現在選択中のテナントID（モジュールレベルで保持）
let _currentTenantId = '';

export const SALESFORCE_DEMO_MESSAGE = 'デモ環境では Salesforce 連携を実行できません';

const liveSalesforceApi = {
  /**
   * テナントIDを設定
   */
  setTenantId(tenantId) {
    _currentTenantId = tenantId || '';
  },

  /**
   * 現在のテナントIDを取得
   */
  getTenantId() {
    return _currentTenantId;
  },

  /**
   * GETリクエスト用: tenantIdをクエリパラメータに追加
   */
  _buildUrl(action, extraParams = '') {
    let url = `${SF_PROXY}?action=${action}`;
    if (_currentTenantId) {
      url += `&tenantId=${encodeURIComponent(_currentTenantId)}`;
    }
    if (extraParams) {
      url += `&${extraParams}`;
    }
    return url;
  },

  /**
   * POSTリクエスト用: bodyにtenantIdを追加
   */
  _addTenantToBody(body) {
    if (_currentTenantId) {
      return { ...body, tenantId: _currentTenantId };
    }
    return body;
  },

  // ========== SF操作API ==========

  /**
   * 接続テスト
   */
  async testConnection() {
    const res = await fetch(this._buildUrl('testConnection'));
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '接続テストに失敗しました');
    }
    return data;
  },

  /**
   * オブジェクトのフィールドメタデータ取得
   */
  async describeObject(objectName) {
    const res = await fetch(this._buildUrl('describeObject', `object=${encodeURIComponent(objectName)}`));
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'オブジェクト情報の取得に失敗しました');
    }
    return data;
  },

  /**
   * Upsertレコード送信（バッチ対応・進捗コールバック付き）
   */
  async upsertRecords(objectName, externalIdField, records, onProgress) {
    const BATCH_SIZE = 200;
    const totalRecords = records.length;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let allErrorDetails = [];

    const batches = [];
    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      batches.push(records.slice(i, i + BATCH_SIZE));
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      if (onProgress) {
        onProgress({
          current: batchIdx * BATCH_SIZE + batch.length,
          total: totalRecords,
          batchIndex: batchIdx,
          totalBatches: batches.length,
        });
      }

      const res = await fetch(this._buildUrl('upsertRecords'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._addTenantToBody({
          objectName,
          externalIdField,
          records: batch,
        })),
      });

      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Upsertに失敗しました');
      }

      totalCreated += data.result.created;
      totalUpdated += data.result.updated;
      totalErrors += data.result.errors;
      if (data.result.errorDetails) {
        allErrorDetails = allErrorDetails.concat(data.result.errorDetails);
      }
    }

    return {
      totalRecords,
      created: totalCreated,
      updated: totalUpdated,
      errors: totalErrors,
      errorDetails: allErrorDetails.slice(0, 50),
    };
  },

  /**
   * SOQLクエリ実行（SFからデータ取得）
   */
  async queryRecords(objectName, fields, options = {}) {
    const res = await fetch(this._buildUrl('queryRecords'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._addTenantToBody({
        objectName,
        fields,
        whereClause: options.whereClause || '',
        orderBy: options.orderBy || '',
        limitCount: options.limitCount || 2000,
      })),
    });

    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'クエリの実行に失敗しました');
    }
    return data;
  },

  /**
   * SOQL検索でレコードIDを解決（リレーション経由突合）
   */
  async resolveRecordIds(objectName, lookupRelField, lookupValues, additionalWhere = '', extraFields = []) {
    if (!lookupValues || lookupValues.length === 0) return { idMap: Object.create(null), duplicates: Object.create(null), metadata: Object.create(null) };

    const seen = Object.create(null);
    const uniqueOriginal = [];
    for (const v of lookupValues) {
      if (v == null || v === '') continue;
      const key = String(v).toLowerCase();
      if (!(key in seen)) {
        seen[key] = true;
        uniqueOriginal.push(String(v));
      }
    }
    if (uniqueOriginal.length === 0) return { idMap: Object.create(null), duplicates: Object.create(null), metadata: Object.create(null) };

    const CHUNK_SIZE = 200;
    const idMap = Object.create(null);
    const duplicates = Object.create(null);
    const metadata = Object.create(null);
    const relFieldParts = lookupRelField.split('.');
    const extraFieldParts = extraFields.map(f => ({ field: f, parts: f.split('.') }));

    for (let i = 0; i < uniqueOriginal.length; i += CHUNK_SIZE) {
      const chunk = uniqueOriginal.slice(i, i + CHUNK_SIZE);
      const inClause = chunk.map(v => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ');
      let whereClause = `${lookupRelField} IN (${inClause})`;
      if (additionalWhere) {
        whereClause = `(${whereClause}) AND (${additionalWhere})`;
      }

      const selectFields = [...new Set(['Id', lookupRelField, ...extraFields])];
      const data = await this.queryRecords(objectName, selectFields, {
        whereClause,
        limitCount: 2000,
      });

      if (data.totalSize >= 2000) {
        throw new Error(`突合結果が2000件以上あります（チャンク${Math.floor(i / CHUNK_SIZE) + 1}）。対象月や条件を絞ってください。`);
      }

      if (data.records) {
        for (const rec of data.records) {
          let val = rec;
          for (const part of relFieldParts) {
            val = val?.[part];
          }
          if (val != null) {
            const key = String(val).toLowerCase();
            if (key in duplicates) {
              duplicates[key].push(rec.Id);
            } else if (key in idMap) {
              duplicates[key] = [idMap[key], rec.Id];
              delete idMap[key];
            } else {
              idMap[key] = rec.Id;
            }
            if (extraFieldParts.length > 0) {
              const meta = {};
              for (const { field, parts } of extraFieldParts) {
                let v = rec;
                for (const p of parts) { v = v?.[p]; }
                meta[field] = v ?? null;
              }
              metadata[rec.Id] = meta;
            }
          }
        }
      }
    }

    return { idMap, duplicates, metadata };
  },

  // ========== GlobalValueSet API ==========

  /**
   * GlobalValueSet一覧取得
   */
  async listGlobalValueSets() {
    const res = await fetch(this._buildUrl('listGlobalValueSets'));
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'グローバル選択リストの取得に失敗しました');
    }
    return data;
  },

  /**
   * GlobalValueSet詳細取得
   */
  async getGlobalValueSet(id) {
    const res = await fetch(this._buildUrl('getGlobalValueSet', `id=${encodeURIComponent(id)}`));
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '選択リスト値の取得に失敗しました');
    }
    return data;
  },

  /**
   * GlobalValueSet更新
   */
  async updateGlobalValueSet(id, values, options = {}) {
    const body = { id, values };
    if (options.chatworkRoomId) {
      body.chatworkRoomId = options.chatworkRoomId;
    }
    const res = await fetch(this._buildUrl('updateGlobalValueSet'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._addTenantToBody(body)),
    });
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '選択リストの更新に失敗しました');
    }
    return data;
  },

  // ========== テナント認証情報管理API ==========

  /**
   * テナント一覧取得（機密フィールドはマスク済み）
   */
  async loadCredentials() {
    const res = await fetch(`${SF_CRED}?action=load`);
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'テナント情報の取得に失敗しました');
    }
    return data.data;
  },

  /**
   * テナント認証情報を保存
   */
  async saveCredentials(tenantId, loginInfo) {
    const res = await fetch(SF_CRED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', tenantId, loginInfo }),
    });
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '保存に失敗しました');
    }
    return data;
  },

  /**
   * テナント認証情報を削除
   */
  async deleteCredentials(tenantId) {
    const res = await fetch(SF_CRED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', tenantId }),
    });
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '削除に失敗しました');
    }
    return data;
  },

  /**
   * 接続テスト（任意の認証情報で）
   */
  async testCredentials(tenantId, loginInfo) {
    const res = await fetch(SF_CRED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', tenantId, loginInfo }),
    });
    const data = await res.json();
    if (data.status !== 'success') {
      throw new Error(data.message || '接続テストに失敗しました');
    }
    return data;
  },
};

const localOnlyMethods = new Set(['setTenantId', 'getTenantId', '_buildUrl', '_addTenantToBody']);

// ポートフォリオではSF接続情報・実データを扱わない。UIは残しつつ、
// 実行系メソッドをネットワークへ到達する前に一律で停止する。
const salesforceApi = new Proxy(liveSalesforceApi, {
  get(target, property) {
    const value = target[property];
    if (typeof value !== 'function') return value;
    if (localOnlyMethods.has(property)) return value.bind(target);
    return async () => {
      throw new Error(SALESFORCE_DEMO_MESSAGE);
    };
  },
});

export default salesforceApi;
