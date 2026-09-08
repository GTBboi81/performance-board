import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { combineSourceData } from '../src/apps/performance-board/hooks/dataProcessing';
import { normalizeConfigSourceTypes, normalizeDataSourceTypes } from '../src/apps/performance-board/AnalyticsSettings';

async function readSourceTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readSourceTree(path);
    if (/\.(js|jsx)$/.test(entry.name)) return [{ path, text: await readFile(path, 'utf8') }];
    return [];
  }));
  return files.flat();
}

async function readPublicPhpFiles() {
  const entries = await readdir('public', { withFileTypes: true });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.php'))
    .map(async (entry) => ({ path: join('public', entry.name), text: await readFile(join('public', entry.name), 'utf8') })));
}

describe('Phase 9 Supabase removal', () => {
  it('offers only the three supported data-source types', async () => {
    const source = await readFile('src/apps/performance-board/components/settings/ConnectionTab.jsx', 'utf8');
    const options = [...source.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);

    expect(options).toContain('spreadsheet');
    expect(options).toContain('salesforce');
    expect(options).toContain('salesforce-soql');
    expect(options).not.toContain('supabase');
    expect(source).not.toMatch(/supabase/i);
  });

  it('removes Supabase imports and source branches from the application source tree', async () => {
    const sourceFiles = [...await readSourceTree('src'), ...await readPublicPhpFiles()];
    const matches = sourceFiles.filter(({ text }) => /supabase/i.test(text));

    expect(matches.map(({ path }) => path)).toEqual([]);
  });

  it('retains the generic first-source fallback when date/key integration yields no rows', () => {
    const rows = combineSourceData(
      { calls: [['', '担当者A', '12']] },
      {
        dataSources: [{
          id: 'calls',
          headers: ['日付', '担当者', '架電数'],
          dateColumnIndex: 0,
          keyColumnIndex: 1,
        }],
        dateSettings: { type: 'auto' },
        mainKey: { sourceId: 'calls' },
        systemFields: [],
        mapping: {},
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: '担当者A',
      col_0_日付: '',
      col_1_担当者: '担当者A',
      col_2_架電数: '12',
    });
  });

  it('names the fallback after its first-source behavior rather than Supabase', async () => {
    const source = await readFile('src/apps/performance-board/hooks/dataProcessing.js', 'utf8');

    expect(source).toContain('buildRowsFromFirstSource');
    expect(source).not.toContain('supabaseFallback');
    expect(source).not.toContain('enhanceRowsWithSupabaseColumns');
  });

  it('normalizes imported unsupported source types to spreadsheet', () => {
    expect(normalizeDataSourceTypes([
      { id: 'legacy', sourceType: 'supabase' },
      { id: 'report', sourceType: 'salesforce' },
    ])).toEqual([
      { id: 'legacy', sourceType: 'spreadsheet' },
      { id: 'report', sourceType: 'salesforce' },
    ]);
  });

  it('normalizes unsupported source types while loading settings', () => {
    expect(normalizeConfigSourceTypes({
      id: 'demo',
      dataSources: [{ id: 'legacy', sourceType: 'supabase' }],
    })).toMatchObject({
      dataSources: [{ id: 'legacy', sourceType: 'spreadsheet' }],
    });
  });
});
