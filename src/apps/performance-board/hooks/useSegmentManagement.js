// src/apps/performance-board/hooks/useSegmentManagement.js
// セグメント管理フック

import { useState, useMemo, useCallback } from 'react';

/**
 * セグメント管理フック
 * @param {object} options
 * @param {object} options.currentAggConfig - 現在の集計設定
 * @param {array} options.systemFields - システムフィールド配列
 * @param {function} options.setIsFilterApplying - フィルター適用中フラグ設定関数
 * @returns {object} セグメント管理関連の状態と関数
 */
export const useSegmentManagement = ({
  currentAggConfig,
  systemFields,
  setIsFilterApplying,
}) => {
  // 追加セグメント（動的に追加する集計軸）
  const [additionalSegments, setAdditionalSegments] = useState([]);

  // groupByFields（配列）または groupByField（後方互換）をサポート
  const baseGroupByFields = useMemo(() => {
    return currentAggConfig.groupByFields || (currentAggConfig.groupByField ? [currentAggConfig.groupByField] : []);
  }, [currentAggConfig.groupByFields, currentAggConfig.groupByField]);

  // 追加セグメントを結合（重複を除外）
  const groupByFields = useMemo(() => {
    const combined = [...baseGroupByFields];
    additionalSegments.forEach(seg => {
      if (!combined.includes(seg)) {
        combined.push(seg);
      }
    });
    return combined;
  }, [baseGroupByFields, additionalSegments]);

  // セグメント追加用に利用可能なフィールド（文字列型のsystemFieldsから、既に選択されているものを除外）
  const availableSegmentFields = useMemo(() => {
    const allSelectedFields = [...baseGroupByFields, ...additionalSegments];
    return systemFields
      .filter(f => f.type === 'string' && !allSelectedFields.includes(f.id))
      .map(f => ({ id: f.id, label: f.label }));
  }, [systemFields, baseGroupByFields, additionalSegments]);

  // セグメント追加ハンドラ（読み込み画面を表示）
  const handleAddSegment = useCallback((fieldId) => {
    if (fieldId && !additionalSegments.includes(fieldId)) {
      if (setIsFilterApplying) {
        setIsFilterApplying(true);
      }
      // 次のフレームでセグメントを追加（UIの更新を先に行うため）
      setTimeout(() => {
        setAdditionalSegments(prev => [...prev, fieldId]);
        // 再集計完了後にローディングを解除
        requestAnimationFrame(() => {
          if (setIsFilterApplying) {
            setIsFilterApplying(false);
          }
        });
      }, 50);
    }
    // ドロップダウンの閉じる処理はDataTableToolbar側で行われる
  }, [additionalSegments, setIsFilterApplying]);

  // セグメント削除ハンドラ（読み込み画面を表示）
  const handleRemoveSegment = useCallback((fieldId) => {
    if (setIsFilterApplying) {
      setIsFilterApplying(true);
    }
    // 次のフレームでセグメントを削除（UIの更新を先に行うため）
    setTimeout(() => {
      setAdditionalSegments(prev => prev.filter(s => s !== fieldId));
      // 再集計完了後にローディングを解除
      requestAnimationFrame(() => {
        if (setIsFilterApplying) {
          setIsFilterApplying(false);
        }
      });
    }, 50);
  }, [setIsFilterApplying]);

  return {
    // State
    additionalSegments,
    setAdditionalSegments,

    // Computed values
    baseGroupByFields,
    groupByFields,
    availableSegmentFields,

    // Handlers
    handleAddSegment,
    handleRemoveSegment,
  };
};

export default useSegmentManagement;
