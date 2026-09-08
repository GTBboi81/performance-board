import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { getCalculationWarnings } from '../src/apps/performance-board/utils/calculationWarnings';

const execFileAsync = promisify(execFile);

const readSource = (path) => readFile(path, 'utf8');

describe('Phase 7 demo calculations', () => {
  it('uses the calculator term format without undefined field references', async () => {
    const config = JSON.parse(await readSource('demo/pb_config.demo.json'));
    const board = config.dashboards[config.activeId];
    const calculations = Object.fromEntries(board.calculations.map((calc) => [calc.id, calc]));

    expect(calculations.connectionRate.terms).toEqual([
      { field: 'connectionCount' },
      { operator: '/', field: 'callCount' },
    ]);
    expect(calculations.meetingRate.terms).toEqual([
      { field: 'meetingCount' },
      { operator: '/', field: 'connectionCount' },
    ]);
    expect(getCalculationWarnings(board)).toEqual([]);
  });

  it('calculates the two demo rates with the PHP calculation engine', async () => {
    const config = JSON.parse(await readSource('demo/pb_config.demo.json'));
    const board = config.dashboards[config.activeId];
    const calculations = Object.fromEntries(board.calculations.map((calc) => [calc.id, calc]));
    const enginePath = Buffer.from(resolve('public/performance_board/lib/calc_engine.php')).toString('base64');
    const connectionRate = Buffer.from(JSON.stringify(calculations.connectionRate)).toString('base64');
    const meetingRate = Buffer.from(JSON.stringify(calculations.meetingRate)).toString('base64');
    const php = [
      `require base64_decode('${enginePath}');`,
      "$row = ['callCount' => 20, 'connectionCount' => 15, 'meetingCount' => 3];",
      `$connectionRate = json_decode(base64_decode('${connectionRate}'), true);`,
      `$meetingRate = json_decode(base64_decode('${meetingRate}'), true);`,
      'echo json_encode([pb_applyArithmetic($row, $connectionRate), pb_applyArithmetic($row, $meetingRate)]);',
    ].join(' ');

    const { stdout } = await execFileAsync('php', ['-r', php]);

    expect(JSON.parse(stdout)).toEqual([75, 20]);
  });
});

describe('Phase 7 layout contracts', () => {
  it('removes only the broken fixed service-logo references from the sidebar', async () => {
    const appSource = await readSource('src/App.jsx');

    expect(appSource).not.toContain('/service-logo-dark.png');
    expect(appSource).not.toContain('/service-logo-light.png');
  });

  it('keeps both 20-color pickers label-first and safely wrapped', async () => {
    const source = await readSource('src/apps/performance-board/components/settings/IndicatorTab.jsx');
    const palette = source.match(/const colorPalette = \[([\s\S]*?)\n  \];/);

    expect(palette?.[1].match(/\{ value:/g)).toHaveLength(20);
    expect(source).toContain('data-testid="system-field-color-picker"');
    expect(source).toContain('data-testid="calculation-color-picker"');
    expect(source.match(/flex max-w-full flex-wrap gap-1/g)).toHaveLength(2);
    expect(source.match(/block whitespace-nowrap text-\[10px\]/g)).toHaveLength(2);
  });

  it('gives the date filter two grid columns and keeps its complete date text beside the chevron', async () => {
    const [filterCard, dateDropdown] = await Promise.all([
      readSource('src/apps/performance-board/components/FilterCard.jsx'),
      readSource('src/apps/performance-board/components/DateRangeDropdown.jsx'),
    ]);

    expect(filterCard).toContain("isDateFilter ? 'col-span-2' : ''");
    expect(dateDropdown).toContain('whitespace-nowrap');
    expect(dateDropdown).not.toContain('<span className="truncate">');
    expect(dateDropdown).toContain('shrink-0');
  });

  it('uses the shared proportional form styles in the data-table subtab without monospace text', async () => {
    const source = await readSource('src/apps/performance-board/components/settings/AggregationTab.jsx');
    const dataTableSubtab = source.slice(
      source.indexOf("{dataTableSubTab === 'tables'"),
      source.indexOf("{dataTableSubTab === 'aggregation'"),
    );

    expect(dataTableSubtab).not.toContain('font-mono');
    expect(source).toContain('const lbl = `block text-xs font-medium ${labelSmClass}`;');
    expect(source).toContain('const inp = `${inputClass} rounded-lg px-3 py-2 text-sm h-auto outline-none transition-colors focus:border-indigo-500`;');
    expect(source).toContain('const sel = `${inputClass} rounded-lg px-3 py-2 text-sm h-auto outline-none cursor-pointer focus:border-indigo-500`;');
  });
});
