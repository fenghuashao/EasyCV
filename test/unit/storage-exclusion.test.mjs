/**
 * 站点排除列表（DEBT-08）单元测试
 * 覆盖：默认敏感域名种子、用户清空语义、增删去重、
 * isDomainExcluded 的精确/子域后缀匹配与相似域名不误伤
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

/** chrome.storage 的内存实现（与 smoke.test.mjs 同款） */
function createChromeMock(initialStore = {}) {
  const store = { ...initialStore };
  const area = {
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const key of list) {
        if (key in store) result[key] = store[key];
      }
      return result;
    },
    set: async (data) => Object.assign(store, data),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    },
    clear: async () => {
      for (const key of Object.keys(store)) delete store[key];
    }
  };
  return {
    storage: { sync: area, local: area, onChanged: { addListener: () => {} } },
    _store: store
  };
}

test('getExcludedList 在键缺席时回落到默认敏感域名（R5：账号页不应承受 injector 暴露面）', async () => {
  const chrome = createChromeMock({});
  const StorageUtils = loadStorageUtils({ chrome });

  const list = await StorageUtils.getExcludedList();
  assert.ok(list.includes('accounts.google.com'));
  assert.ok(list.length >= 1);
});

test('getExcludedList 尊重用户清空（空数组不回落默认值）', async () => {
  const chrome = createChromeMock({ excluded_list: [] });
  const StorageUtils = loadStorageUtils({ chrome });

  assert.deepEqual(await StorageUtils.getExcludedList(), []);
});

test('getExcludedList 损坏的非数组值必须报告失败以阻止未知排除状态启用', async () => {
  const chrome = createChromeMock({ excluded_list: 'not-an-array' });
  const StorageUtils = loadStorageUtils({ chrome });

  await assert.rejects(StorageUtils.getExcludedList());
});

test('addToExcludedList 按域名去重', async () => {
  const chrome = createChromeMock({ excluded_list: [] });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.addToExcludedList('bilibili.com');
  await StorageUtils.addToExcludedList('bilibili.com');

  assert.deepEqual(await StorageUtils.getExcludedList(), ['bilibili.com']);
});

test('removeFromExcludedList 移除已存在域名，对不存在域名静默', async () => {
  const chrome = createChromeMock({ excluded_list: ['bilibili.com'] });
  const StorageUtils = loadStorageUtils({ chrome });

  await StorageUtils.removeFromExcludedList('bilibili.com');
  await StorageUtils.removeFromExcludedList('not-exists.com');

  assert.deepEqual(await StorageUtils.getExcludedList(), []);
});

test('isDomainExcluded 精确匹配命中', () => {
  const StorageUtils = loadStorageUtils();
  assert.equal(StorageUtils.isDomainExcluded('accounts.google.com', ['accounts.google.com']), true);
});

test('isDomainExcluded 子域后缀匹配命中（排除主域即覆盖子域）', () => {
  const StorageUtils = loadStorageUtils();
  assert.equal(StorageUtils.isDomainExcluded('www.bilibili.com', ['bilibili.com']), true);
  assert.equal(StorageUtils.isDomainExcluded('space.bilibili.com', ['bilibili.com']), true);
});

test('isDomainExcluded 不误伤相似域名（按点分段，非裸后缀）', () => {
  const StorageUtils = loadStorageUtils();
  assert.equal(StorageUtils.isDomainExcluded('notgoogle.com', ['google.com']), false);
  assert.equal(StorageUtils.isDomainExcluded('evil-accounts.google.com.eo.cn', ['accounts.google.com']), false);
});

test('isDomainExcluded 大小写归一', () => {
  const StorageUtils = loadStorageUtils();
  assert.equal(StorageUtils.isDomainExcluded('WWW.Bilibili.COM', ['bilibili.com']), true);
  assert.equal(StorageUtils.isDomainExcluded('www.bilibili.com', ['BILIBILI.COM']), true);
});

test('isDomainExcluded 对空主机名与非法列表返回 false', () => {
  const StorageUtils = loadStorageUtils();
  assert.equal(StorageUtils.isDomainExcluded('', ['bilibili.com']), false);
  assert.equal(StorageUtils.isDomainExcluded('www.bilibili.com', null), false);
  assert.equal(StorageUtils.isDomainExcluded('www.bilibili.com', []), false);
});
