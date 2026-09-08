import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesforceUnifiedImport from '../src/apps/performance-board/components/SalesforceUnifiedImport';
import ErrorActionModal from '../src/apps/performance-board/components/ErrorActionModal';
import salesforceApi, { SALESFORCE_DEMO_MESSAGE } from '../src/apps/performance-board/services/salesforceApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Salesforce demo mode', () => {
  it('blocks Salesforce API operations before any network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(salesforceApi.testConnection()).rejects.toThrow(SALESFORCE_DEMO_MESSAGE);
    await expect(salesforceApi.describeObject('Example__c')).rejects.toThrow(SALESFORCE_DEMO_MESSAGE);
    await expect(salesforceApi.upsertRecords('Example__c', 'Id', [])).rejects.toThrow(SALESFORCE_DEMO_MESSAGE);
    await expect(salesforceApi.saveCredentials('demo', {})).rejects.toThrow(SALESFORCE_DEMO_MESSAGE);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the demo message after an SF action is clicked without fetching', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(
      <SalesforceUnifiedImport
        config={{}}
        allDashboards={{}}
        sourceCacheByDashboard={{}}
        calculatedDataCache={{}}
        updateConfig={vi.fn()}
      />,
    );

    const describeButton = container.querySelector('svg.lucide-search')?.closest('button');
    expect(describeButton).not.toBeNull();
    await user.click(describeButton);

    await waitFor(() => expect(screen.getByText(new RegExp(SALESFORCE_DEMO_MESSAGE))).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses demo-oriented copy for a Salesforce authentication error', () => {
    render(
      <ErrorActionModal
        error={{ type: 'AUTH_FAIL', message: 'ignored in demo copy' }}
        theme="dark"
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(SALESFORCE_DEMO_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /設定を開く/ })).not.toBeInTheDocument();
  });
});
