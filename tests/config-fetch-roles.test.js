import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchServerConfig } from '../src/utils';
import { checkPermission } from '../src/hooks/usePermission';

const guestResponse = {
  globalSettings: { appName: '実績ボード', hiddenBoards: [] },
  roles: {
    admin: { permissions: { '*': true } },
    viewer: { permissions: { 'performance-board.view': true } },
    guest: { permissions: { 'performance-board.view': true } },
  },
};

const mockFetch = (body) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchServerConfig', () => {
  // save_config.php は非管理者に dashboards を返さない。
  // その応答から roles を落とすとボードが1件も表示できなくなる。
  it('keeps roles when the response carries no dashboards', async () => {
    mockFetch(guestResponse);
    const config = await fetchServerConfig();

    expect(config.roles).toEqual(guestResponse.roles);
    expect(config.globalSettings.appName).toBe('実績ボード');
  });

  it('lets a guest pass the board visibility check with that config', async () => {
    mockFetch(guestResponse);
    const config = await fetchServerConfig();
    const guest = { id: 'guest', roleId: 'guest', isGuest: true };

    expect(checkPermission(guest, config.roles, 'performance-board.view')).toBe(true);
  });

  it('falls back to the default roles when the response omits them', async () => {
    mockFetch({ globalSettings: { appName: 'X' } });
    const config = await fetchServerConfig();

    expect(config.roles).toBeDefined();
    expect(config.roles.admin.permissions['*']).toBe(true);
  });
});
