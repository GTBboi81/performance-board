import { combineSourceData } from '../hooks/dataProcessing';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const readHeapSize = () => {
  if (typeof performance === 'undefined' || !performance.memory) return null;
  return performance.memory.usedJSHeapSize;
};

const countInputRows = (finalDataMap) => Object.values(finalDataMap || {})
  .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);

const notify = (callback, value) => {
  if (typeof callback === 'function') callback(value);
};

const logMetrics = (metrics, onMetrics) => {
  console.info('[PB combine worker]', metrics);
  notify(onMetrics, metrics);
};

const createAbortError = () => {
  const error = new Error('データ結合をキャンセルしました。');
  error.name = 'AbortError';
  return error;
};

const runSynchronously = (finalDataMap, safeConfig, options, fallbackReason) => {
  const { onProgress, onMetrics } = options;
  const heapBefore = readHeapSize();
  const startedAt = now();

  notify(onProgress, { percentage: 15, stage: 'データ結合中...' });
  const rows = combineSourceData(finalDataMap, safeConfig);
  const computeMs = now() - startedAt;
  const heapAfter = readHeapSize();
  const metrics = {
    mode: 'sync-fallback',
    fallbackReason,
    inputRows: countInputRows(finalDataMap),
    outputRows: rows.length,
    inputPostMessageMs: 0,
    inputTransitMs: 0,
    computeMs,
    outputTransferMs: 0,
    totalMs: computeMs,
    mainHeapBeforeBytes: heapBefore,
    mainHeapAfterBytes: heapAfter,
    mainHeapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
  };

  notify(onProgress, { percentage: 100, stage: 'データ結合完了' });
  logMetrics(metrics, onMetrics);
  return rows;
};

/**
 * combineSourceDataをWorkerで実行する。Workerを起動できない環境では同期処理へ戻す。
 */
export const combineSourceDataInWorker = (finalDataMap, safeConfig, options = {}) => {
  const { signal, onProgress, onMetrics } = options;

  if (signal?.aborted) return Promise.reject(createAbortError());
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runSynchronously(finalDataMap, safeConfig, options, 'worker-unsupported'));
  }

  let worker;
  try {
    worker = new Worker(
      new URL('../workers/combineSourceDataWorker.js', import.meta.url),
      { type: 'module' }
    );
  } catch (error) {
    return Promise.resolve(runSynchronously(
      finalDataMap,
      safeConfig,
      options,
      `worker-construction-failed: ${error instanceof Error ? error.message : String(error)}`
    ));
  }

  return new Promise((resolve, reject) => {
    const totalStartedAt = now();
    const heapBefore = readHeapSize();
    const inputRows = countInputRows(finalDataMap);
    let inputPostMessageMs = 0;
    let settled = false;

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createAbortError());
    };

    const settleWithFallback = (fallbackReason) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(runSynchronously(finalDataMap, safeConfig, options, fallbackReason));
      } catch (fallbackError) {
        reject(fallbackError);
      }
    };

    const settleWithRows = (message) => {
      if (settled) return;
      settled = true;

      try {
        const heapAfter = readHeapSize();
        const metrics = {
          mode: 'worker',
          inputRows,
          outputRows: message.rows.length,
          inputPostMessageMs,
          inputTransitMs: message.metrics.inputTransitMs,
          computeMs: message.metrics.computeMs,
          outputTransferMs: Math.max(0, Date.now() - message.metrics.outputSentAt),
          totalMs: now() - totalStartedAt,
          mainHeapBeforeBytes: heapBefore,
          mainHeapAfterBytes: heapAfter,
          mainHeapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
        };

        notify(onProgress, { percentage: 100, stage: 'データ結合完了' });
        logMetrics(metrics, onMetrics);
        cleanup();
        resolve(message.rows);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }

    worker.onmessage = (event) => {
      if (settled) return;
      const message = event.data;
      if (message.type === 'progress') {
        notify(onProgress, {
          percentage: message.percentage,
          stage: message.stage,
        });
        return;
      }

      if (message.type === 'error') {
        settleWithFallback(
          `worker-runtime-error: ${message.message || 'unknown error'}`
        );
        return;
      }

      if (message.type !== 'complete') return;
      settleWithRows(message);
    };

    worker.onerror = (event) => {
      settleWithFallback(`worker-load-failed: ${event.message || 'unknown error'}`);
    };

    worker.onmessageerror = () => {
      settleWithFallback('worker-message-error');
    };

    notify(onProgress, { percentage: 5, stage: 'データ結合を準備中...' });
    const postStartedAt = now();
    try {
      worker.postMessage({ finalDataMap, safeConfig, postedAt: Date.now() });
      inputPostMessageMs = now() - postStartedAt;
    } catch (error) {
      settleWithFallback(
        `post-message-failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
};
