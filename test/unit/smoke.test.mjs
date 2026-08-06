/**
 * 单元冒烟测试（node:test，零依赖）
 * 覆盖 storage-utils / message-utils / i18n-utils 的纯逻辑部分；
 * 浏览器 API 以内存 mock 替代
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 以源码注入方式加载未做模块导出的浏览器脚本类 */
function loadBrowserClass(relativePath, className, globals = {}) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  const factory = new Function(
    ...Object.keys(globals),
    `${source}\nreturn ${className};`
  );
  return factory(...Object.values(globals));
}

/** chrome.storage 的内存实现（仅覆盖测试用到的面） */
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
  const chrome = {
    storage: {
      sync: area,
      local: area,
      onChanged: { addListener: () => {} }
    },
    _store: store
  };
  return chrome;
}

// ===== MessageUtils =====

const MessageUtils = loadBrowserClass('utils/message-utils.js', 'MessageUtils');

test('MESSAGE_TYPES 取值唯一（重复值会让白名单校验张冠李戴）', () => {
  const values = Object.values(MessageUtils.MESSAGE_TYPES);
  assert.equal(new Set(values).size, values.length);
});

test('isValidMessage 接受全部已注册类型（含反馈与监控消息）', () => {
  for (const type of Object.values(MessageUtils.MESSAGE_TYPES)) {
    assert.ok(MessageUtils.isValidMessage({ type }), `类型应通过白名单: ${type}`);
  }
});

test('isValidMessage 拒绝未知类型与畸形消息', () => {
  assert.equal(MessageUtils.isValidMessage({ type: 'NOT_REGISTERED' }), false);
  assert.equal(MessageUtils.isValidMessage({}), false);
  assert.equal(MessageUtils.isValidMessage(null), false);
  assert.equal(MessageUtils.isValidMessage('toggle_plugin'), false);
});

// ===== StorageUtils =====

test('getAutoEnableList 将旧版字符串数组转换为配置对象', async () => {
  const chrome = createChromeMock({ auto_enable_list: ['example.com'] });
  const StorageUtils = loadBrowserClass('utils/storage-utils.js', 'StorageUtils', { chrome });

  const list = await StorageUtils.getAutoEnableList();
  assert.deepEqual(list, [{ domain: 'example.com', copyEnabled: true, pasteEnabled: true }]);
});

test('addToAutoEnableList 按域名去重且保留功能开关', async () => {
  const chrome = createChromeMock({ auto_enable_list: [] });
  const StorageUtils = loadBrowserClass('utils/storage-utils.js', 'StorageUtils', { chrome });

  await StorageUtils.addToAutoEnableList('example.com', true, false);
  await StorageUtils.addToAutoEnableList('example.com');

  const list = await StorageUtils.getAutoEnableList();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], { domain: 'example.com', copyEnabled: true, pasteEnabled: false });
});

test('setPluginSettings 仅持久化白名单内的用户设置键', async () => {
  const chrome = createChromeMock({});
  const StorageUtils = loadBrowserClass('utils/storage-utils.js', 'StorageUtils', { chrome });

  await StorageUtils.setPluginSettings({
    copyEnabled: false,
    autoAddToWhitelist: true,
    hackerKey: 'should-not-persist'
  });

  const settings = await StorageUtils.getUserSettings();
  assert.equal(settings.copyEnabled, false);
  assert.equal(settings.autoAddToWhitelist, true);
  assert.equal('hackerKey' in settings, false);
});

// ===== I18nUtils =====

test('t() 在 chrome.i18n 不可用时返回兜底文案', () => {
  const I18nUtils = loadBrowserClass('utils/i18n-utils.js', 'I18nUtils');
  assert.equal(I18nUtils.t('main_unlock', undefined, '一键解锁'), '一键解锁');
  assert.equal(I18nUtils.t('missing_key'), 'missing_key');
});

test('t() 优先返回 chrome.i18n 消息并替换占位符', () => {
  const I18nUtils = loadBrowserClass('utils/i18n-utils.js', 'I18nUtils', {
    chrome: { i18n: { getMessage: (key, sub) => (key === 'added_to_auto_list' ? `已将 ${sub} 添加` : '') } }
  });
  assert.equal(I18nUtils.t('added_to_auto_list', 'example.com', 'fallback'), '已将 example.com 添加');
  assert.equal(I18nUtils.t('unknown', undefined, '兜底'), '兜底');
});
