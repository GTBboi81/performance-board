import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDemoCache } from '../scripts/build-demo-cache.mjs';

let outputDir;

afterEach(async () => {
  if (outputDir) await rm(outputDir, { recursive: true, force: true });
  outputDir = undefined;
});

describe('demo cache builder', () => {
  it('writes non-empty gzip caches whose columns match the demo source headers', async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'performance-board-demo-'));
    const [outputPath] = await buildDemoCache({ outputDir });
    const payload = JSON.parse(gunzipSync(await readFile(outputPath)).toString('utf8'));
    const config = JSON.parse(await readFile('demo/pb_config.demo.json', 'utf8'));
    const board = config.dashboards[config.activeId];

    expect(payload).toMatchObject({
      meta: { boardId: config.activeId, boardName: board.name },
    });
    for (const source of board.dataSources) {
      expect(payload.sourceCache[source.id].columns).toEqual(source.headers);
      expect(payload.sourceCache[source.id].rows.length).toBeGreaterThan(0);
    }
  });
});
