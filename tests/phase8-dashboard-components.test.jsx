import { readFile } from 'node:fs/promises';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChartEditor from '../src/apps/performance-board/components/settings/ChartEditor';
import ChartsTab from '../src/apps/performance-board/components/settings/ChartsTab';
import HeadingCard from '../src/apps/performance-board/components/HeadingCard';
import KpiSection from '../src/apps/performance-board/components/KpiSection';
import RankingCard from '../src/apps/performance-board/components/RankingCard';
import LayoutTab from '../src/apps/performance-board/components/settings/LayoutTab';
import { buildChartData } from '../src/apps/performance-board/components/ChartSection';
import { LAYOUT_ITEM_TYPES } from '../src/apps/performance-board/components/layoutItems';

const styleProps = {
  glassClass: 'glass',
  cardClass: 'card',
  inputClass: 'input',
  optionClass: 'option',
  textClass: 'text',
  textMutedClass: 'muted',
  labelXsClass: 'label',
  labelSmClass: 'label',
  theme: 'dark',
};

describe('Phase 8 dashboard components', () => {
  it('renders KPI rates from summaryData with two decimal places', () => {
    render(<KpiSection
      {...styleProps}
      section={{ id: 'rates', title: 'コンバージョン', fields: ['connectionRate', 'meetingRate'], width: 'full' }}
      allCards={[{ id: 'connectionRate', label: '接続率' }, { id: 'meetingRate', label: '商談化率' }]}
      calculations={[{ id: 'connectionRate', format: 'percent' }, { id: 'meetingRate', format: 'percent' }]}
      kpiValues={{ connectionRate: 38.8, meetingRate: 10.4 }}
    />);

    expect(screen.getByText('38.80')).toBeInTheDocument();
    expect(screen.getByText('10.40')).toBeInTheDocument();
    expect(screen.getAllByText('%')).toHaveLength(2);
  });

  it('aggregates source-backed rows for pie charts', () => {
    const chartData = buildChartData({
      chartConfig: { type: 'pie', xField: 'team', yFields: ['meetingCount'], aggregation: 'sum' },
      data: [
        { team: 'A', meetingCount: 3 },
        { team: 'A', meetingCount: 2 },
        { team: 'B', meetingCount: 5 },
      ],
      sourceCache: { calls: { rows: [['A', 3]] } },
      dataSources: [{ id: 'calls', headers: ['team', 'meetingCount'] }],
    });

    expect(chartData).toEqual([{ team: 'A', _count: 2, meetingCount: 5 }, { team: 'B', _count: 1, meetingCount: 5 }]);

    expect(buildChartData({
      chartConfig: { sourceId: 'calls', categoryColumnIndex: 0, valueColumnIndex: 1, xField: 'team', yFields: ['meetingCount'] },
      sourceCache: { calls: { rows: [['A', '3'], ['B', '5']] } },
      dataSources: [{ id: 'calls', headers: ['team', 'meetingCount'] }],
    })).toEqual([{ team: 'A', _count: 1, meetingCount: 3 }, { team: 'B', _count: 1, meetingCount: 5 }]);
  });

  it('places KPI sections, a pie chart, then tables in the demo layout', async () => {
    const config = JSON.parse(await readFile('demo/pb_config.demo.json', 'utf8'));
    const board = config.dashboards[config.activeId];

    expect(board.chartConfigs).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'pie', xField: 'team', yFields: ['meetingCount'] })]));
    expect(board.layoutOrder.map((item) => item.type)).toEqual(['kpiSection', 'kpiSection', 'chart', 'dataTable', 'dataTable', 'dataTable']);
  });

  it('creates, changes, and deletes a chart configuration through the settings controls', async () => {
    const user = userEvent.setup();
    const updateLocalConfig = vi.fn();
    const config = { chartConfigs: [], systemFields: [{ id: 'team', label: 'チーム', type: 'string' }], calculations: [{ id: 'meetingCount', label: '商談数' }] };
    const { rerender } = render(<ChartsTab {...styleProps} localConfig={config} updateLocalConfig={updateLocalConfig} />);
    await user.click(screen.getByRole('button', { name: 'グラフを追加' }));
    expect(updateLocalConfig).toHaveBeenCalledWith('chartConfigs', expect.arrayContaining([expect.objectContaining({ type: 'line' })]));

    const chart = { id: 'chart_1', title: '構成比', type: 'line', xField: 'team', yFields: ['meetingCount'], visible: true };
    rerender(<ChartEditor {...styleProps} chart={chart} fields={[...config.systemFields, { ...config.calculations[0], type: 'number' }]} onChange={updateLocalConfig} onDelete={updateLocalConfig} />);
    await user.selectOptions(screen.getByLabelText('グラフ種別'), 'pie');
    expect(updateLocalConfig).toHaveBeenCalledWith({ type: 'pie' });
    await user.click(screen.getByRole('button', { name: 'グラフを削除' }));
    expect(updateLocalConfig).toHaveBeenCalledTimes(3);
  });

  it('renders ranking and heading cards', () => {
    render(<><RankingCard {...styleProps} title="チーム別商談数" groupByField="team" valueField="meetingCount" data={[{ team: 'A', meetingCount: 8 }, { team: 'B', meetingCount: 5 }]} /><HeadingCard text="活動実績" subText="今月" /></>);
    expect(screen.getByText('チーム別商談数')).toBeInTheDocument();
    expect(screen.getByText('活動実績')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('recalculates arithmetic percent rankings from each group total', () => {
    const calculations = [{
      id: 'meetingRate',
      type: 'arithmetic',
      format: 'percent',
      terms: [{ field: 'meetingCount' }, { operator: '/', field: 'connectionCount' }],
    }];
    const data = [
      { agent: 'A', connectionCount: 100, meetingCount: 10, meetingRate: 99 },
      { agent: 'A', connectionCount: 300, meetingCount: 33, meetingRate: 99 },
      { agent: 'B', connectionCount: 100, meetingCount: 5, meetingRate: 99 },
      { agent: 'B', connectionCount: 49900, meetingCount: 5090, meetingRate: 99 },
      { agent: 'C', connectionCount: 100, meetingCount: 8, meetingRate: 99 },
      { agent: 'C', connectionCount: 4900, meetingCount: 533, meetingRate: 99 },
      { agent: 'D', connectionCount: 100, meetingCount: 7, meetingRate: 99 },
      { agent: 'D', connectionCount: 4900, meetingCount: 510, meetingRate: 99 },
      { agent: 'E', connectionCount: 100, meetingCount: 4, meetingRate: 99 },
      { agent: 'E', connectionCount: 4900, meetingCount: 493, meetingRate: 99 },
    ];

    render(<RankingCard
      {...styleProps}
      title="Rate ranking"
      groupByField="agent"
      valueField="meetingRate"
      data={data}
      calculations={calculations}
      systemFields={[
        { id: 'connectionCount', type: 'number' },
        { id: 'meetingCount', type: 'number' },
      ]}
    />);

    const ranking = within(screen.getByLabelText('Rate ranking'));
    expect(ranking.getAllByText(/^[ABCDE]$/).map((item) => item.textContent)).toEqual(['C', 'A', 'D', 'B', 'E']);
    expect(ranking.getAllByText(/^[0-9.]+%$/).map((item) => item.textContent)).toEqual(['10.82%', '10.75%', '10.34%', '10.19%', '9.94%']);
    expect(ranking.queryByText('198')).not.toBeInTheDocument();
  });

  it('honors configured aggregation methods for non-arithmetic rankings', () => {
    const data = [{ team: 'A', score: 2 }, { team: 'A', score: 5 }];
    render(<>
      <RankingCard {...styleProps} title="First ranking" groupByField="team" valueField="score" data={data} systemFields={[{ id: 'score', aggregationMethod: 'first' }]} />
      <RankingCard {...styleProps} title="Average ranking" groupByField="team" valueField="score" data={data} systemFields={[{ id: 'score', aggregationMethod: 'avg' }]} />
      <RankingCard {...styleProps} title="Maximum ranking" groupByField="team" valueField="score" data={data} systemFields={[{ id: 'score', aggregationMethod: 'max' }]} />
    </>);

    expect(within(screen.getByLabelText('First ranking')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Average ranking')).getByText('3.5')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Maximum ranking')).getByText('5')).toBeInTheDocument();
  });

  it('reorders layout entries and exposes only dashboard-supported types', async () => {
    const updateLocalConfig = vi.fn();
    const layoutOrder = [
      { id: 'layout_kpi', type: 'kpiSection', refId: 'section_activity', visible: true, width: 'full' },
      { id: 'layout_chart', type: 'chart', refId: 'chart_team', visible: true, width: 'full' },
    ];
    const { container } = render(<LayoutTab {...styleProps} localConfig={{ layoutOrder, sections: [{ id: 'section_activity', title: '活動実績' }], chartConfigs: [{ id: 'chart_team', title: 'チーム別' }] }} updateLocalConfig={updateLocalConfig} />);
    const [firstEntry, secondEntry] = container.querySelectorAll('[draggable="true"]');
    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('1') };
    fireEvent.dragStart(secondEntry, { dataTransfer });
    fireEvent.dragOver(firstEntry, { dataTransfer });
    fireEvent.drop(firstEntry, { dataTransfer });
    await waitFor(() => expect(updateLocalConfig).toHaveBeenCalledWith('layoutOrder', [layoutOrder[1], layoutOrder[0]]));

    const dashboardSource = await readFile('src/apps/performance-board/DashboardView.jsx', 'utf8');
    LAYOUT_ITEM_TYPES.forEach((type) => expect(dashboardSource).toContain(`case '${type}'`));
  });
});
