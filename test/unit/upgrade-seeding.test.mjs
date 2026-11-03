/**
 * 安装与升级的默认配置播种单元测试
 * 覆盖：首次安装写入默认值；安装或升级时仅在配置键缺席时播种，
 * 绝不覆盖用户已有的站点规则、排除名单和设置。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStorage, loadBackground } from './helpers/reliability-harness.mjs';

const KEYS = ['plugin_enabled', 'force_mode', 'auto_enable_list', 'excluded_list', 'user_settings'];

test('首次安装写入默认配置', async () => {
  const h = loadStorage();
  await h.StorageUtils.acknowledgePrivacyNotice();
  const { installed } = loadBackground(h);
  await installed({ reason: 'install' });

  assert.equal(h.sync.plugin_enabled, true);
  assert.equal(h.sync.force_mode, false);
  assert.deepEqual(h.sync.auto_enable_list, []);
  assert.ok(h.sync.excluded_list.includes('accounts.google.com'));
  assert.equal(h.sync.user_settings.theme, 'auto');
});

test('升级时保留用户已有的规则、排除名单和设置', async () => {
  const h = loadStorage({
    plugin_enabled: false,
    force_mode: true,
    auto_enable_list: [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: false }],
    excluded_list: ['blocked.example.com'],
    user_settings: { theme: 'dark', copyEnabled: false, pasteEnabled: true }
  });
  await h.StorageUtils.acknowledgePrivacyNotice();
  const { installed } = loadBackground(h);
  await installed({ reason: 'update' });

  assert.equal(h.sync.plugin_enabled, false, '总开关不得被重置');
  assert.equal(h.sync.force_mode, true, '强力模式不得被重置');
  assert.deepEqual(h.sync.auto_enable_list,
    [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: false }], '站点规则不得被清空');
  assert.deepEqual(h.sync.excluded_list, ['blocked.example.com'], '排除名单不得被重置');
  assert.equal(h.sync.user_settings.theme, 'dark', '用户设置不得被重置');
  assert.equal(h.sync.user_settings.copyEnabled, false);
});

test('以 install 原因重新注册时同样不得覆盖已有配置', async () => {
  const h = loadStorage({
    auto_enable_list: [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: true }],
    excluded_list: ['blocked.example.com'],
    user_settings: { theme: 'dark' }
  });
  await h.StorageUtils.acknowledgePrivacyNotice();
  const { installed } = loadBackground(h);
  await installed({ reason: 'install' });

  assert.deepEqual(h.sync.auto_enable_list,
    [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: true }]);
  assert.deepEqual(h.sync.excluded_list, ['blocked.example.com']);
  assert.equal(h.sync.user_settings.theme, 'dark');
});

test('只播种缺席的配置键', async () => {
  const h = loadStorage({ excluded_list: ['blocked.example.com'] });
  await h.StorageUtils.acknowledgePrivacyNotice();
  const { installed } = loadBackground(h);
  await installed({ reason: 'update' });

  assert.deepEqual(h.sync.excluded_list, ['blocked.example.com'], '已有排除名单保持不变');
  assert.equal(h.sync.plugin_enabled, true, '缺席的总开关写入默认值');
  assert.equal(h.sync.force_mode, false);
  assert.deepEqual(h.sync.auto_enable_list, []);
  assert.ok(h.sync.user_settings, '缺席的设置写入默认值');
});

test('未同意时安装与升级不读取或覆盖用户规则', async () => {
  const h = loadStorage({ auto_enable_list: ['old.example'], statistics: { sitesUnlocked: ['old.example'] } });
  const before = structuredClone(h.sync);
  const { installed } = loadBackground(h);
  await installed({ reason: 'install' });
  await installed({ reason: 'update' });
  assert.deepEqual(h.sync, before);
});

test('其他安装原因不做任何写入', async () => {
  const h = loadStorage();
  const { installed } = loadBackground(h);
  await installed({ reason: 'chrome_update' });
  for (const key of KEYS) assert.equal(key in h.sync, false, `${key} 不应被写入`);
});
