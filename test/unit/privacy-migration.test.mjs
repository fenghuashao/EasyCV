/**
 * 隐私迁移单元测试
 * 覆盖：旧版 sync 私有数据先本机备份再移除、诊断脱敏、旧反馈草稿丢弃、
 * 设置与手工规则保留、失败时保留同步副本。
 * 回归点：chrome.storage 读取时按键名排序，写入值与读回值的 JSON 键序不同，
 * 校验若直接比较 JSON 字符串会误判失败，导致迁移永远无法完成。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadStorageUtils(globals = {}) {
  const source = fs.readFileSync(path.join(rootDir, 'utils/storage-utils.js'), 'utf8');
  const factory = new Function(
    ...Object.keys(globals),
    `${source}\nreturn StorageUtils;`
  );
  return factory(...Object.values(globals));
}

/** 对象按键名排序，模拟真实 Chrome 存储在读取时归一化键序的行为。 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
  }
  return value;
}

/** chrome.storage 的内存实现；sync 与 local 是彼此独立的区域。 */
function createChromeMock({ sync = {}, local = {} } = {}) {
  const areas = { sync: { ...sync }, local: { ...local } };
  const makeArea = name => ({
    get: async keys => {
      const list = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const key of list) if (key in areas[name]) result[key] = sortKeys(areas[name][key]);
      return result;
    },
    set: async data => Object.assign(areas[name], data),
    remove: async keys => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete areas[name][key];
    },
    clear: async () => {
      for (const key of Object.keys(areas[name])) delete areas[name][key];
    }
  });
  const chrome = {
    storage: { sync: makeArea('sync'), local: makeArea('local'), onChanged: { addListener: () => {} } },
    _areas: areas
  };
  return chrome;
}

const legacySync = () => ({
  statistics: { totalActivations: 42, todayUsage: 7, lastUsedDate: '2026-10-01', sitesUnlocked: 9,
    siteStats: { 'old.example.com': 5 } },
  interaction_history: { 'old.example.com': 1756684800000 },
  errorReports: [{ code: 'OLD_ERROR', module: 'content', timestamp: '2026-10-01T00:00:00Z', version: '1.1.2',
    detail: 'page text that must not survive', stack: 'stack that must not survive' }],
  userFeedback: [{ body: 'legacy feedback body' }]
});

test('canonicalJSON 与对象键序无关', () => {
  const chrome = createChromeMock();
  const StorageUtils = loadStorageUtils({ chrome });
  assert.equal(StorageUtils.canonicalJSON({ b: 1, a: 2 }), StorageUtils.canonicalJSON({ a: 2, b: 1 }));
  assert.equal(StorageUtils.canonicalJSON([{ b: 1, a: 2 }]), StorageUtils.canonicalJSON([{ a: 2, b: 1 }]));
  assert.notEqual(StorageUtils.canonicalJSON({ a: 1 }), StorageUtils.canonicalJSON({ a: 2 }));
});

test('旧版同步私有数据先备份到本机，校验通过后才移除同步副本', async () => {
  const chrome = createChromeMock({ sync: legacySync() });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.migratePrivateDataNow();

  const backup = chrome._areas.local.legacy_private_backup;
  assert.ok(backup, '本机备份必须存在');
  assert.deepEqual(backup.sync_statistics, legacySync().statistics);
  assert.deepEqual(backup.sync_interaction_history, legacySync().interaction_history);
  for (const key of ['statistics', 'interaction_history', 'errorReports', 'userFeedback']) {
    assert.equal(key in chrome._areas.sync, false, `${key} 必须从同步存储移除`);
  }
  assert.equal(await StorageUtils.hasPendingPrivacyMigration(), false);
});

test('本机统计只保留计数，不保留按站点的旧计数', async () => {
  const chrome = createChromeMock({ sync: legacySync() });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.migratePrivateDataNow();

  assert.deepEqual(Object.keys(chrome._areas.local.statistics).sort(),
    ['lastUsedDate', 'todayUsage', 'totalActivations']);
  assert.equal(chrome._areas.local.statistics.totalActivations, 42);
  assert.equal(chrome._areas.local.statistics.sitesUnlocked, undefined);
});

test('旧诊断被脱敏，旧反馈草稿内容被丢弃', async () => {
  const chrome = createChromeMock({ sync: legacySync() });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.migratePrivateDataNow();

  const reports = chrome._areas.local.errorReports;
  assert.ok(Array.isArray(reports));
  assert.ok(reports.length <= 10);
  for (const report of reports) {
    assert.deepEqual(Object.keys(report).sort().filter(key => !['code', 'module', 'timestamp', 'version'].includes(key)), []);
    assert.notEqual(report.code, 'OLD_ERROR');
  }
  assert.deepEqual(chrome._areas.local.userFeedback, []);
});

test('设置与手工规则在迁移中保留', async () => {
  const chrome = createChromeMock({ sync: {
    ...legacySync(),
    auto_enable_list: [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: true }],
    excluded_list: ['blocked.example.com'],
    user_settings: { theme: 'dark', copyEnabled: true, pasteEnabled: true }
  } });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.migratePrivateDataNow();

  assert.deepEqual(chrome._areas.sync.auto_enable_list,
    [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: true }]);
  assert.deepEqual(chrome._areas.sync.excluded_list, ['blocked.example.com']);
  assert.equal(chrome._areas.sync.user_settings.theme, 'dark');
});

test('本机写入失败时保留同步副本并报告失败，不静默丢弃', async () => {
  const chrome = createChromeMock({ sync: legacySync() });
  const originalSet = chrome.storage.local.set;
  chrome.storage.local.set = async () => { throw new Error('synthetic local write failure'); };
  const StorageUtils = loadStorageUtils({ chrome });

  await assert.rejects(StorageUtils.migratePrivateDataNow(), /synthetic local write failure/);

  chrome.storage.local.set = originalSet;
  assert.ok('statistics' in chrome._areas.sync, '同步副本必须保留以便重试');
  assert.ok('interaction_history' in chrome._areas.sync);
});

test('同步副本在迁移期间被改动时中止并保留数据', async () => {
  const chrome = createChromeMock({ sync: legacySync() });
  const StorageUtils = loadStorageUtils({ chrome });
  const originalGet = chrome.storage.sync.get;
  let calls = 0;
  chrome.storage.sync.get = async keys => {
    calls += 1;
    if (calls === 2) {
      // 模拟迁移期间同步副本被另一个写入覆盖
      chrome._areas.sync.statistics = { totalActivations: 99, todayUsage: 1, lastUsedDate: '2026-11-01' };
    }
    return originalGet(keys);
  };

  await assert.rejects(StorageUtils.migratePrivateDataNow(), /changed during migration/);
  assert.ok('statistics' in chrome._areas.sync, '同步副本必须保留以便重试');
});
