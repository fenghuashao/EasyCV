/**
 * 产品内数据说明确认状态单元测试
 * 覆盖：未确认时返回空、确认后记录版本、确认状态只写入本机而不写入同步存储。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadStorageUtils(globals = {}) {
  const source = fs.readFileSync(path.join(rootDir, 'utils/storage-utils.js'), 'utf8');
  const factory = new Function(...Object.keys(globals), `${source}\nreturn StorageUtils;`);
  return factory(...Object.values(globals));
}

function createChromeMock({ sync = {}, local = {} } = {}) {
  const areas = { sync: { ...sync }, local: { ...local } };
  const makeArea = name => ({
    get: async keys => {
      const list = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const key of list) if (key in areas[name]) result[key] = areas[name][key];
      return result;
    },
    set: async data => Object.assign(areas[name], data),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete areas[name][key]; },
    clear: async () => { for (const key of Object.keys(areas[name])) delete areas[name][key]; }
  });
  return { chrome: { storage: { sync: makeArea('sync'), local: makeArea('local'), onChanged: { addListener: () => {} } } }, areas };
}

test('未确认时数据说明确认状态为空', async () => {
  const { chrome } = createChromeMock();
  const StorageUtils = loadStorageUtils({ chrome });
  assert.equal(await StorageUtils.getPrivacyNoticeAck(), null);
});

test('确认后记录当前说明版本', async () => {
  const { chrome } = createChromeMock();
  const StorageUtils = loadStorageUtils({ chrome });
  await StorageUtils.acknowledgePrivacyNotice();
  assert.equal(await StorageUtils.getPrivacyNoticeAck(), StorageUtils.PRIVACY_NOTICE_VERSION);
});

test('确认状态只保存在本机，不写入同步存储', async () => {
  const { chrome, areas } = createChromeMock();
  const StorageUtils = loadStorageUtils({ chrome });
  await StorageUtils.acknowledgePrivacyNotice();
  assert.equal('privacy_notice_ack' in areas.local, true);
  assert.equal('privacy_notice_ack' in areas.sync, false, '确认状态不得进入同步存储');
});

test('确认版本变化后需要重新确认', async () => {
  const { chrome } = createChromeMock({ local: { privacy_notice_ack: '2026-11-03' } });
  const StorageUtils = loadStorageUtils({ chrome });
  assert.notEqual(await StorageUtils.getPrivacyNoticeAck(), StorageUtils.PRIVACY_NOTICE_VERSION);
  assert.equal(await StorageUtils.hasPrivacyConsent(), false, '此前的“我已了解”不能视作明确同意');
});

test('本机存储读取失败时不视作同意', async () => {
  const { chrome } = createChromeMock();
  chrome.storage.local.get = async () => { throw new Error('storage unavailable'); };
  const StorageUtils = loadStorageUtils({ chrome });
  assert.equal(await StorageUtils.hasPrivacyConsent(), false);
});

test('同意未成功保存时不视作成功', async () => {
  const { chrome } = createChromeMock();
  chrome.storage.local.set = async () => { throw new Error('storage unavailable'); };
  const StorageUtils = loadStorageUtils({ chrome });
  await assert.rejects(StorageUtils.acknowledgePrivacyNotice(), /storage unavailable/);
  assert.equal(await StorageUtils.hasPrivacyConsent(), false);
});
