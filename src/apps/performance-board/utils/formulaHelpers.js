// src/apps/performance-board/utils/formulaHelpers.js
// 計算式表示用ヘルパー関数

/**
 * 計算式ヘルパーを生成するファクトリー関数
 */
export const createFormulaHelpers = ({ systemFields, calculations, config }) => {
  // フィールドIDからラベルを取得
  const getFieldLabel = (fieldId) => {
    if (!fieldId) return '?';
    const sf = systemFields.find(f => f.id === fieldId);
    if (sf) return sf.label || fieldId;
    const calc = calculations.find(c => c.id === fieldId);
    if (calc) return calc.label || fieldId;
    return fieldId;
  };

  // カラム名（API名）→ラベルの逆引きマップ
  const columnLabelMap = (() => {
    const map = {};
    // 1. 全データソースのfieldMetadata（API名→ラベル）
    (config.dataSources || []).forEach(ds => {
      if (ds.fieldMetadata) {
        Object.entries(ds.fieldMetadata).forEach(([apiName, label]) => {
          if (label && apiName !== label) map[apiName] = label;
        });
      }
    });
    // 2. mappingからカラム名→フィールドラベル
    if (config.mapping) {
      Object.entries(config.mapping).forEach(([fieldId, m]) => {
        if (m.columnName) {
          const sf = systemFields.find(f => f.id === fieldId);
          if (sf?.label) map[m.columnName] = sf.label;
        }
      });
    }
    // 3. systemFieldsのsourceField
    systemFields.forEach(f => {
      if (f.sourceField && f.label) map[f.sourceField] = f.label;
    });
    return map;
  })();

  // API名→ラベル変換
  const resolve = (apiName) => {
    if (!apiName) return '?';
    if (columnLabelMap[apiName]) return columnLabelMap[apiName];
    const sf = systemFields.find(f => f.id === apiName);
    if (sf) return sf.label || apiName;
    const calc = calculations.find(c => c.id === apiName);
    if (calc) return calc.label || apiName;
    return apiName;
  };

  // ヘッダーインデックスからラベルを取得
  const resolveHeaderIdx = (idx, headers) => {
    const i = parseInt(idx);
    if (isNaN(i) || !headers?.[i]) return null;
    return resolve(headers[i]);
  };

  // conditionType → 表示ラベル
  const conditionLabels = {
    equals: '=', notEquals: '≠', contains: '含む', notContains: '含まない',
    isEmpty: '空白', isNotEmpty: '空白以外',
    greaterThan: '>', lessThan: '<', greaterOrEqual: '>=', lessOrEqual: '<=',
    between: '範囲内',
    thisMonth: '当月', thisMonth2ndToEnd: '当月2日〜月末',
    thisMonth2ndToToday: '当月2日〜今日', thisMonth2ndToYesterday: '当月2日〜昨日',
    thisMonth1stToYesterday: '当月1日〜昨日',
    dateFilterRange: '日付フィルター範囲内',
    dateFilterStart: '日付フィルター開始以降', dateFilterEnd: '日付フィルター終了以前',
  };

  // フィルター条件を表示テキストに変換
  const formatFilterCondition = (col, conditionType, value) => {
    const opLabel = conditionLabels[conditionType] || conditionType || '=';
    // 値不要タイプ（空白、日付系）
    const noValTypes = ['isEmpty', 'isNotEmpty', 'thisMonth2ndToEnd', 'thisMonth2ndToToday', 'thisMonth2ndToYesterday', 'thisMonth', 'thisMonth1stToYesterday', 'dateFilterRange', 'dateFilterStart', 'dateFilterEnd'];
    if (noValTypes.includes(conditionType)) {
      return `${col}: ${opLabel}`;
    }
    return `${col} ${opLabel} ${value}`;
  };

  // --- リレーション指標の計算式情報 ---
  const getRelationFormulaInfo = (calc) => {
    const targetSource = config.dataSources?.find(ds => ds.id === calc.targetSourceId);
    const sourceName = targetSource?.name || '外部データ';
    const headers = targetSource?.headers || [];

    const aggLabel = { count: 'カウント', sum: '合計', lookup: '参照' }[calc.aggType] || 'カウント';
    const aggTarget = resolveHeaderIdx(calc.aggTargetIndex, headers);

    // サブ項目として表示
    const subFormulas = [];

    // 集計方法
    if (calc.aggType === 'count') {
      subFormulas.push({ label: '集計', formula: `${sourceName} の件数をカウント` });
    } else if (aggTarget) {
      subFormulas.push({ label: '集計', formula: `${sourceName}.${aggTarget} を${aggLabel}` });
    } else {
      subFormulas.push({ label: '集計', formula: `${sourceName} を${aggLabel}` });
    }

    // 日付参照（dateColumnIndexが設定されている = 日付フィルター範囲内で絞り込む）
    const dateCol = resolveHeaderIdx(calc.dateColumnIndex, headers);
    if (dateCol) {
      subFormulas.push({ label: '日付', formula: `${dateCol}（フィルター範囲内）` });
    }

    // 固定絞込み条件（filters）
    if (calc.filters?.length > 0) {
      calc.filters.forEach(f => {
        const col = f.columnName ? resolve(f.columnName) : resolveHeaderIdx(f.colIndex, headers) || '?';
        subFormulas.push({ label: '絞込', formula: formatFilterCondition(col, f.conditionType, f.value) });
      });
    }

    // conditions
    if (calc.conditions?.length > 0) {
      calc.conditions.forEach(c => {
        const col = c.columnName ? resolve(c.columnName) : resolve(c.field);
        subFormulas.push({ label: '絞込', formula: formatFilterCondition(col, c.conditionType || c.operator, c.value) });
      });
    }

    // 日付差フィルター
    if (calc.dateDiffFilter?.enabled) {
      const dd = calc.dateDiffFilter;
      const colA = dd.dateColumnAName ? resolve(dd.dateColumnAName) : '?';
      const colB = dd.useToday ? '今日' : (dd.dateColumnBName ? resolve(dd.dateColumnBName) : '?');
      const dir = dd.direction === 'over' ? '以上' : '以内';
      subFormulas.push({ label: '日付差', formula: `${colA} → ${colB} が ${dd.maxDays}日${dir}` });
    }

    return {
      type: 'calc',
      formula: `${sourceName} の${aggLabel}`,
      details: null,
      subFormulas
    };
  };

  // --- 四則演算の計算式（再帰的に展開） ---
  const getArithFormula = (calc) => {
    if (calc.terms?.length > 0) {
      return calc.terms.map((term, idx) => {
        const label = getFieldLabel(term.field);
        if (idx === 0) return label;
        const op = { '+': '+', '-': '-', '*': '×', '/': '÷' }[term.operator] || term.operator || '?';
        return `${op} ${label}`;
      }).join(' ');
    }
    if (calc.fieldA || calc.fieldB) {
      const a = getFieldLabel(calc.fieldA);
      const b = getFieldLabel(calc.fieldB);
      const op = { '+': '+', '-': '-', '*': '×', '/': '÷' }[calc.operator] || calc.operator || '?';
      return `${a} ${op} ${b}`;
    }
    return calc.label || calc.id;
  };

  // 単一フィールドの計算式テキスト（subFormulas用）
  const getSingleFieldFormula = (fieldId) => {
    const calc = calculations.find(c => c.id === fieldId);
    if (calc) {
      if (calc.type === 'relation') {
        const src = config.dataSources?.find(ds => ds.id === calc.targetSourceId);
        const name = src?.name || '外部データ';
        const agg = { count: 'カウント', sum: '合計', lookup: '参照' }[calc.aggType] || 'カウント';
        return `${name} の${agg}`;
      }
      return getArithFormula(calc);
    }
    const sf = systemFields.find(f => f.id === fieldId);
    if (sf) return sf.label || fieldId;
    return fieldId || '?';
  };

  // --- メイン: getFormulaInfo ---
  const getFormulaInfo = (cardId, isComposite = false, compositeCard = null) => {
    // 複合指標
    if (isComposite && compositeCard) {
      const mainField = [...systemFields, ...calculations].find(f => f.id === compositeCard.mainField);
      const subField = [...systemFields, ...calculations].find(f => f.id === compositeCard.subField);
      const subField2 = [...systemFields, ...calculations].find(f => f.id === compositeCard.subField2);
      const subFormulas = [];
      if (mainField) subFormulas.push({ label: `メイン: ${mainField.label}`, formula: getSingleFieldFormula(compositeCard.mainField) });
      if (subField) subFormulas.push({ label: `サブ1: ${subField.label}`, formula: getSingleFieldFormula(compositeCard.subField) });
      if (subField2) subFormulas.push({ label: `サブ2: ${subField2.label}`, formula: getSingleFieldFormula(compositeCard.subField2) });
      return {
        type: 'composite',
        formula: [mainField, subField, subField2].filter(Boolean).map(f => f.label).join(' + '),
        subFormulas
      };
    }

    const calc = calculations.find(c => c.id === cardId);
    if (calc) {
      // リレーション指標
      if (calc.type === 'relation') {
        return getRelationFormulaInfo(calc);
      }

      // 条件カウント
      if (calc.type === 'conditionalCount') {
        const detailParts = [];
        if (calc.conditions?.length > 0) {
          calc.conditions.forEach(c => {
            detailParts.push(`絞込: ${getFieldLabel(c.field)} ${c.operator} ${c.value}`);
          });
        }
        return { type: 'calc', formula: `条件カウント`, details: detailParts.length > 0 ? detailParts.join('\n') : null };
      }

      // 定数
      if (calc.type === 'constant') {
        return { type: 'calc', formula: `定数: ${calc.constantValue}`, details: null };
      }

      // 四則演算（terms / fieldA-fieldB）
      const formula = getArithFormula(calc);
      // 各項のサブ計算式を展開
      const subFormulas = [];
      const termFields = calc.terms
        ? calc.terms.map(t => t.field)
        : [calc.fieldA, calc.fieldB].filter(Boolean);
      termFields.forEach(fid => {
        const termCalc = calculations.find(c => c.id === fid);
        if (termCalc) {
          subFormulas.push({ label: getFieldLabel(fid), formula: getSingleFieldFormula(fid) });
        }
      });

      return {
        type: 'calc',
        formula,
        details: null,
        subFormulas: subFormulas.length > 0 ? subFormulas : undefined
      };
    }

    // システムフィールド
    const sysField = systemFields.find(f => f.id === cardId);
    if (sysField) {
      const source = config.dataSources?.find(ds => ds.id === sysField.sourceId);
      const sourceName = source?.name || 'メインデータ';
      return {
        type: 'system',
        formula: `${sourceName}.${sysField.label || cardId}`,
        details: sysField.type === 'number' ? '数値フィールド' : null
      };
    }

    return { type: 'system', formula: cardId || '?', details: null };
  };

  return { getFieldLabel, getSingleFieldFormula, getFormulaInfo };
};
