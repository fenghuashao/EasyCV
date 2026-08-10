/**
 * DEBT-08 content 侧回归：GET_STATUS 携带域名供 background 做排除裁决；
 * handleUpdateStatus 收到排除列表变更时重走全量状态加载（复用后台判定），
 * 其余键变更维持本地直写、不触发额外后台往返。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopyPasteManager } from './helpers/content-harness.mjs';

/** 记录 sendToBackground 调用并按固定状态应答的 MessageUtils mock */
function createRecordingMessageUtils(statusData) {
  const calls = [];
  return {
    calls,
    messageUtils: {
      MESSAGE_TYPES: { GET_STATUS: 'GET_STATUS', REPORT_ERROR: 'REPORT_ERROR' },
      addMessageListener: () => {},
      sendToBackground: (type, data) => {
        calls.push({ type, data });
        return Promise.resolve({ success: true, data: statusData });
      }
    }
  };
}

const DISABLED_STATE = { enabled: false, copyEnabled: true, pasteEnabled: true, forceMode: false };

test('GET_STATUS 携带当前页域名（background 排除裁决的输入）', () => {
  const mock = createRecordingMessageUtils(DISABLED_STATE);
  const { CopyPasteManager } = createCopyPasteManager({ messageUtils: mock.messageUtils });
  new CopyPasteManager();

  const statusCalls = mock.calls.filter(c => c.type === 'GET_STATUS');
  assert.ok(statusCalls.length >= 1, '构造时应发起 GET_STATUS');
  assert.equal(statusCalls[0].data.domain, 'example.com');
});

test('排除列表变更触发全量状态重载并覆盖本地启用态', async () => {
  const mock = createRecordingMessageUtils(DISABLED_STATE);
  const { CopyPasteManager } = createCopyPasteManager({ messageUtils: mock.messageUtils });
  const manager = new CopyPasteManager();
  mock.calls.length = 0;

  // 模拟本站此前处于启用态，随后被用户加入排除列表
  manager.isEnabled = true;
  await manager.handleUpdateStatus({
    changes: { excluded_list: { newValue: ['example.com'] } }
  });

  const statusCalls = mock.calls.filter(c => c.type === 'GET_STATUS');
  assert.equal(statusCalls.length, 1, '排除列表变更应重走一次 GET_STATUS');
  assert.equal(statusCalls[0].data.domain, 'example.com');
  assert.equal(manager.isEnabled, false, '后台返回排除态（enabled=false）应覆盖本地启用态');
});

test('非排除列表键变更不触发后台往返（维持本地直写路径）', async () => {
  const mock = createRecordingMessageUtils(DISABLED_STATE);
  const { CopyPasteManager } = createCopyPasteManager({ messageUtils: mock.messageUtils });
  const manager = new CopyPasteManager();
  mock.calls.length = 0;

  manager.isEnabled = true;
  await manager.handleUpdateStatus({
    changes: { plugin_enabled: { newValue: false } }
  });

  assert.equal(mock.calls.filter(c => c.type === 'GET_STATUS').length, 0);
  assert.equal(manager.isEnabled, false);
});
