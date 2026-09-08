import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, copyFile, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';

let root;
let port;
let server;

const initialConfig = () => ({
  globalSettings: { appName: 'Demo Board', logoLight: '/light.svg' },
  dashboards: { board: { id: 'board', name: 'Board' } },
  activeId: 'board',
  accounts: {
    admin: { name: 'Admin', roleId: 'admin', password: 'admin-password' },
    editor: { name: 'Editor', roleId: 'editor', password: 'editor-password' },
    viewer: { name: 'Viewer', roleId: 'viewer', password: 'viewer-password' },
    guest: { name: 'Guest', roleId: 'guest' },
  },
  roles: {
    admin: { permissions: { '*': true } },
    editor: { permissions: { 'performance-board.dashboard.create': true } },
    viewer: { permissions: { 'performance-board.view': true } },
    guest: { permissions: { 'performance-board.view': true } },
  },
});

const url = (pathname) => `http://127.0.0.1:${port}${pathname}`;

const sessionCookie = (response) => {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';', 1)[0] : '';
};

const request = async (pathname, body, cookie = '') => {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return fetch(url(pathname), {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

const login = async (id, password) => {
  const response = await request('/login.php', { id, password });
  expect(response.status).toBe(200);
  return sessionCookie(response);
};

const getFreePort = () => new Promise((resolve) => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close(() => resolve(address.port));
  });
});

const runPhp = (file) => new Promise((resolve, reject) => {
  const process = spawn('php', [file], { stdio: 'ignore' });
  process.once('error', reject);
  process.once('close', resolve);
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(url('/save_config.php'));
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('PHP test server did not start');
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'performance-board-php-'));
  await mkdir(join(root, 'performance_board'), { recursive: true });
  await mkdir(join(root, 'performance_board', 'cache'), { recursive: true });
  await mkdir(join(root, 'performance_board', 'lib'), { recursive: true });
  await mkdir(join(root, 'sessions'), { recursive: true });
  await Promise.all([
    copyFile('public/auth_session.php', join(root, 'auth_session.php')),
    copyFile('public/login.php', join(root, 'login.php')),
    copyFile('public/save_config.php', join(root, 'save_config.php')),
    copyFile('public/performance_board/cache_read.php', join(root, 'performance_board/cache_read.php')),
    copyFile('public/performance_board/progress_read.php', join(root, 'performance_board/progress_read.php')),
    copyFile('public/performance_board/save_pb_config.php', join(root, 'performance_board/save_pb_config.php')),
    copyFile('public/performance_board/cron_runner.php', join(root, 'performance_board/cron_runner.php')),
    copyFile('public/performance_board/generate.php', join(root, 'performance_board/generate.php')),
    copyFile('public/performance_board/lib/config_reader.php', join(root, 'performance_board/lib/config_reader.php')),
  ]);
  port = await getFreePort();
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root], { stdio: 'ignore' });
  await waitForServer();
});

beforeEach(async () => {
  await writeFile(join(root, 'config.json'), JSON.stringify(initialConfig()));
  await writeFile(join(root, 'performance_board', 'pb_config.json'), JSON.stringify({ dashboards: {}, activeId: null }));
  await writeFile(join(root, 'performance_board', 'cache', 'board_board.json.gz'), gzipSync(JSON.stringify({ sourceCache: { calls: { rows: [[1]] } } })));
  await writeFile(join(root, 'performance_board', 'cache', 'board_board_progress.json'), JSON.stringify({ current: 1, total: 1, percentage: 100 }));
});

afterAll(async () => {
  server?.kill();
  await rm(root, { recursive: true, force: true });
});

describe('PHP authentication and configuration permissions', () => {
  it('returns only global settings before authentication', async () => {
    const response = await request('/save_config.php');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ globalSettings: initialConfig().globalSettings });
  });

  it('creates a guest session without a password', async () => {
    const response = await request('/login.php', { action: 'guest' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, user: { id: 'guest', roleId: 'guest', isGuest: true } });
  });

  it('rejects a guest login when no guest account is configured', async () => {
    const config = initialConfig();
    delete config.accounts.guest;
    await writeFile(join(root, 'config.json'), JSON.stringify(config), 'utf8');
    const response = await request('/login.php', { action: 'guest' });
    expect(response.status).toBe(401);
  });

  it('migrates a successful plaintext login to a password hash and regenerates the session id', async () => {
    const before = await request('/login.php', { action: 'check' });
    const beforeCookie = sessionCookie(before);
    const after = await request('/login.php', { id: 'admin', password: 'admin-password' }, beforeCookie);
    expect(after.status).toBe(200);
    expect(sessionCookie(after)).not.toBe(beforeCookie);
    const saved = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
    expect(saved.accounts.admin.password).not.toBe('admin-password');
    expect(saved.accounts.admin.password.startsWith('$2')).toBe(true);
  });

  it('preserves protected fields for a non-admin editor with dashboard-create permission', async () => {
    const cookie = await login('editor', 'editor-password');
    const protectedFields = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
    const incoming = initialConfig();
    incoming.accounts = { attacker: { roleId: 'admin', password: 'attacker-password' } };
    incoming.roles = { admin: { permissions: { '*': true } } };
    incoming.globalSettings = { appName: 'Changed' };
    incoming.dashboards = { changed: { id: 'changed' } };
    const response = await request('/save_config.php', incoming, cookie);
    expect(response.status).toBe(200);
    const saved = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
    expect(saved.accounts).toEqual(protectedFields.accounts);
    expect(saved.roles).toEqual(protectedFields.roles);
    expect(saved.globalSettings).toEqual(protectedFields.globalSettings);
    expect(saved.dashboards).toEqual(incoming.dashboards);
  });

  it('rejects config saves without dashboard permissions', async () => {
    const cookie = await login('viewer', 'viewer-password');
    const response = await request('/save_config.php', initialConfig(), cookie);
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated board-config writes and accepts an administrator', async () => {
    const blocked = await request('/performance_board/save_pb_config.php', { dashboards: { blocked: {} }, activeId: 'blocked' });
    expect(blocked.status).toBe(403);
    expect(JSON.parse(await readFile(join(root, 'performance_board', 'pb_config.json'), 'utf8'))).toEqual({ dashboards: {}, activeId: null });

    const cookie = await login('admin', 'admin-password');
    const allowed = await request('/performance_board/save_pb_config.php', { dashboards: { allowed: {} }, activeId: 'allowed' }, cookie);
    expect(allowed.status).toBe(200);
    expect(JSON.parse(await readFile(join(root, 'performance_board', 'pb_config.json'), 'utf8'))).toEqual({ dashboards: { allowed: {} }, activeId: 'allowed' });
  });

  it('requires a session for board reads while allowing the guest session', async () => {
    expect((await request('/performance_board/cache_read.php?boardId=board')).status).toBe(401);
    expect((await request('/performance_board/progress_read.php?boardId=board')).status).toBe(401);
    expect((await request('/performance_board/save_pb_config.php')).status).toBe(401);

    const guest = await request('/login.php', { action: 'guest' });
    const cookie = sessionCookie(guest);
    expect((await request('/performance_board/cache_read.php?boardId=board', undefined, cookie)).status).toBe(200);
    expect(await (await request('/performance_board/cache_read.php?boardId=board', undefined, cookie)).json()).toMatchObject({ sourceCache: { calls: { rows: [[1]] } } });
    expect((await request('/performance_board/progress_read.php?boardId=board', undefined, cookie)).status).toBe(200);
    expect((await request('/performance_board/save_pb_config.php', undefined, cookie)).status).toBe(200);
  });

  it('limits a guest config response to global settings and roles', async () => {
    const guest = await request('/login.php', { action: 'guest' });
    const response = await request('/save_config.php', undefined, sessionCookie(guest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ globalSettings: initialConfig().globalSettings, roles: initialConfig().roles });
    expect(body.accounts).toBeUndefined();
    expect(body.dashboards).toBeUndefined();
  });

  it('keeps the password-sanitized full config response for an administrator', async () => {
    const cookie = await login('admin', 'admin-password');
    const response = await request('/save_config.php', undefined, cookie);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accounts.admin).toMatchObject({ name: 'Admin', hasPassword: true });
    expect(body.accounts.admin.password).toBeUndefined();
    expect(body.dashboards).toEqual(initialConfig().dashboards);
  });

  it('blocks cron over HTTP while preserving its CLI execution path', async () => {
    expect((await request('/performance_board/cron_runner.php')).status).toBe(403);
    expect(await runPhp(join(root, 'performance_board', 'cron_runner.php'))).toBe(0);
  });

  it('rejects unauthenticated board generation before loading any library', async () => {
    const response = await request('/performance_board/generate.php?boardId=board');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: 'error' });

    // 401 を返した時点で cache/ に進捗ファイルが作られていないこと
    await expect(readFile(join(root, 'performance_board', 'cache', 'board_board_progress.json'), 'utf8'))
      .resolves.not.toContain('"stage":"start"');

    // ガードがライブラリ読み込みより前に置かれていること
    const source = await readFile('public/performance_board/generate.php', 'utf8');
    expect(source.indexOf("_SESSION['userId']")).toBeLessThan(source.indexOf("require_once __DIR__ . '/lib/sf_auth.php'"));
  });

  it('contains Apache protections for the board config and cron runner', async () => {
    const htaccess = await readFile('public/performance_board/.htaccess', 'utf8');
    expect(htaccess).toContain('<Files "pb_config.json">');
    expect(htaccess).toContain('<Files "cron_runner.php">');
    expect(htaccess).toContain('Require all denied');
  });
});
