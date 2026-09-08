import { combineSourceData } from '../hooks/dataProcessing';

self.onmessage = (event) => {
  const { finalDataMap, safeConfig, postedAt } = event.data;
  const receivedAt = Date.now();

  try {
    self.postMessage({
      type: 'progress',
      percentage: 15,
      stage: 'データ結合中...',
    });

    const computeStartedAt = performance.now();
    const rows = combineSourceData(finalDataMap, safeConfig);
    const computeMs = performance.now() - computeStartedAt;

    self.postMessage({
      type: 'progress',
      percentage: 90,
      stage: '結合結果を受信中...',
    });

    const outputSentAt = Date.now();
    self.postMessage({
      type: 'complete',
      rows,
      metrics: {
        inputTransitMs: Math.max(0, receivedAt - postedAt),
        computeMs,
        outputSentAt,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
