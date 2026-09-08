import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardView from '../src/apps/performance-board/DashboardView';

describe('guest dashboard view', () => {
  it('does not expose the force-refresh action to a guest', () => {
    const onRefresh = vi.fn();
    render(
      <DashboardView
        glassClass=""
        allRows={[]}
        filteredRows={[]}
        config={{ id: 'demo', dataSources: [], filters: [], dataTables: [] }}
        filters={[]}
        activeFilters={{}}
        setActiveFilters={vi.fn()}
        systemFields={[]}
        calculations={[]}
        isLoading={false}
        isConnected
        error={null}
        onRefresh={onRefresh}
        onCancelFetch={vi.fn()}
        user={{ id: 'guest', roleId: 'guest', isGuest: true }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'データ再取得' })).not.toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
