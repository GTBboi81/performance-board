import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const defaultConfigPath = join(projectRoot, 'demo', 'pb_config.demo.json');
const defaultOutputDir = join(projectRoot, 'demo', 'cache');
const generatedAt = '2026-09-07T00:00:00+09:00';

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function buildSourceRows(sourceId) {
  const agents = [
    ['担当者A', 'チーム North', 1800],
    ['担当者B', 'チーム North', 1700],
    ['担当者C', 'チーム Central', 1750],
    ['担当者D', 'チーム Central', 1650],
    ['担当者E', 'チーム South', 1600],
  ];
  if (sourceId === 'targets') {
    return agents.map(([agent, team, target]) => [agent, team, target]);
  }
  if (sourceId !== 'calls') return [];

  const random = mulberry32(20260907);
  const start = new Date(Date.UTC(2026, 6, 1));
  const rows = [];
  for (let dayOffset = 0; dayOffset < 62; dayOffset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + dayOffset);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    for (const [agent, team] of agents) {
      const calls = 55 + Math.floor(random() * 61);
      const connections = Math.max(12, Math.floor(calls * (0.3 + random() * 0.18)));
      const meetings = Math.max(1, Math.floor(connections * (0.07 + random() * 0.1)));
      const talkMinutes = connections * (4 + Math.floor(random() * 5));
      rows.push([formatDate(date), agent, team, calls, connections, meetings, talkMinutes]);
    }
  }
  return rows;
}

export async function buildDemoCache({ configPath = defaultConfigPath, outputDir = defaultOutputDir } = {}) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (!config?.dashboards || !config.activeId) {
    throw new Error('Demo config must contain dashboards and activeId');
  }

  await mkdir(outputDir, { recursive: true });
  const outputFiles = [];
  for (const [boardId, board] of Object.entries(config.dashboards)) {
    const sourceCache = {};
    for (const source of board.dataSources || []) {
      sourceCache[source.id] = {
        columns: source.headers || [],
        rows: buildSourceRows(source.id),
      };
    }
    const payload = {
      meta: {
        boardId,
        boardName: board.name || '',
        generatedAt,
        sources: Object.fromEntries(
          Object.entries(sourceCache).map(([sourceId, source]) => [sourceId, { rowCount: source.rows.length }]),
        ),
      },
      sourceCache,
    };
    const outputPath = join(outputDir, `board_${boardId}.json.gz`);
    await writeFile(outputPath, gzipSync(JSON.stringify(payload), { mtime: 0 }));
    outputFiles.push(outputPath);
  }
  return outputFiles;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildDemoCache().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
