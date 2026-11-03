import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStorage } from './helpers/reliability-harness.mjs';
import { createCopyPasteManager } from './helpers/content-harness.mjs';

const source = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');

test('Options reads authoritative switches and unrelated saves preserve them', async () => {
  const store = { plugin_enabled: true, force_mode: true,
    user_settings: { enabled: false, forceMode: false, copyEnabled: false, detectionDelay: 1700 } };
  const area = { get: async keys => Object.fromEntries(keys.map(k => [k, store[k]])),
    set: async values => Object.assign(store, values) };
  const StorageUtils = new Function('chrome', `${source('utils/storage-utils.js')};return StorageUtils;`)(
    { storage: { sync: area, local: area } });
  const settings = await StorageUtils.getPluginSettings();
  assert.equal(settings.forceMode, true);
  assert.equal(settings.enabled, true);
  await StorageUtils.setPluginSettings({ ...settings, showNotifications: false });
  assert.equal(store.force_mode, true);
  assert.equal(store.plugin_enabled, true);
  assert.equal(store.user_settings.copyEnabled, false);
  assert.equal(store.user_settings.detectionDelay, 1700);
  store.force_mode = false;
  store.user_settings.forceMode = true;
  assert.equal((await StorageUtils.getPluginSettings()).forceMode, false);
});

function contentReceiver(status) {
  let receiver;
  const MessageUtils = new Function('chrome', `${source('utils/message-utils.js')};return MessageUtils;`)(
    { runtime: { onMessage: { addListener: fn => { receiver = fn; } } } });
  const requests = [];
  MessageUtils.sendToBackground = async (type, data) => {
    requests.push({ type, data });
    return { success: true, data: status };
  };
  const { CopyPasteManager } = createCopyPasteManager({ messageUtils: MessageUtils });
  // Skip the constructor's unrelated DOM/bootstrap work; exercise the real
  // validated runtime listener, queue, state loading and state application.
  const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
    isEnabled: true, copyEnabled: false, pasteEnabled: false, forceMode: false,
    stateUpdateQueue: [], isProcessingQueue: false, maxRetryCount: 0,
    stateLoadTimeout: 1000, stateListeners: new Set(), debugMode: false
  });
  const applied = [];
  manager.applyCurrentState = async () => applied.push({ enabled: manager.isEnabled,
    copy: manager.copyEnabled, paste: manager.pasteEnabled, force: manager.forceMode });
  manager.setupMessageListeners();
  const send = message => new Promise(resolve => {
    if (!receiver(message, {}, resolve)) resolve({ success: false, error: 'not accepted' });
  });
  return { manager, requests, applied, send, MessageUtils };
}

for (const type of ['state_updated', 'copy_status_changed', 'paste_status_changed']) {
  test(`${type} reaches the content script and reapplies authoritative page state`, async () => {
    const h = contentReceiver({ enabled: true, copyEnabled: true, pasteEnabled: true, forceMode: false });
    const result = await h.send({ type, data: { enabled: true, newState: { pluginEnabled: true } } });
    assert.equal(result.success, true);
    assert.equal(h.manager.copyEnabled, true);
    assert.equal(h.manager.pasteEnabled, true);
    assert.ok(h.applied.length > 0);
    assert.equal(h.requests[0].data.domain, 'example.com');
  });
}

test('user_settings change updates existing tabs without navigation', async () => {
  const h = contentReceiver({ enabled: true, copyEnabled: true, pasteEnabled: true, forceMode: true });
  await h.send({ type: 'update_status', data: { changes: {
    user_settings: { newValue: { copyEnabled: true, pasteEnabled: true } }
  } } });
  assert.equal(h.manager.pasteEnabled, true);
  assert.equal(h.manager.forceMode, true);
  assert.equal(h.applied.length, 1);
});

test('global switch notifications cannot wake an excluded page', async () => {
  const h = contentReceiver({ enabled: false, copyEnabled: true, pasteEnabled: true, forceMode: true });
  h.manager.isEnabled = false;
  await h.send({ type: 'update_status', data: { changes: { plugin_enabled: { newValue: true } } } });
  assert.equal(h.manager.isEnabled, false);
  await h.send({ type: 'toggle_plugin', data: { enabled: true } });
  await h.send({ type: 'enable_force_mode', data: {} });
  assert.equal(h.manager.isEnabled, false);
});

test('both child switches disabled do not activate the main-world injector', async () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
    isEnabled: true, copyEnabled: false, pasteEnabled: false
  });
  let action;
  manager.enableCopyPaste = () => { action = 'enable'; };
  manager.disableCopyPaste = () => { action = 'disable'; };
  await manager.applyCurrentState();
  assert.equal(action, 'disable');
});

test('disable restores saved inline attributes after repeat processing', async () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
    originalStyles: new Map(), originalHandlers: new Map(), pendingElements: new Set(),
    observer: null, processingTimer: null, debugMode: false
  });
  const attributes = new Map([['onpaste', 'return false']]);
  const element = { isConnected: true, onpaste: null,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value), removeEventListener() {} };
  manager.rememberOriginalHandler(element, 'paste');
  attributes.delete('onpaste');
  manager.rememberOriginalHandler(element, 'paste');
  await manager.disableCopyPaste();
  assert.equal(attributes.get('onpaste'), 'return false');
  assert.equal(manager.originalHandlers.size, 0);
});

test('queued element work cannot unlock a page after it is excluded', () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
    isEnabled: false, copyEnabled: true, pasteEnabled: true, processedElements: new WeakSet()
  });
  manager.saveOriginalStyles = () => { throw new Error('must not touch excluded DOM'); };
  manager.processElement({});
});

test('auto-enable sends a validated state notification and invalidates cached domain misses', async () => {
  const messages = [];
  const chrome = { tabs: { sendMessage: async (tabId, message) => messages.push(message),
    get: async () => ({}) } };
  const MessageUtils = new Function('chrome', `${source('utils/message-utils.js')};return MessageUtils;`)(chrome);
  const AutoEnableManager = new Function('chrome', 'MessageUtils', 'StorageUtils',
    `${source('background/auto-enable-manager.js')};return AutoEnableManager;`)(chrome, MessageUtils, {
      STORAGE_KEYS: { AUTO_ENABLE_LIST: 'auto_enable_list' },
      matchAutoEnableRule: (domain, list) => loadStorage().StorageUtils.matchAutoEnableRule(domain, list)
    });
  const listeners = [];
  const state = { autoEnableList: [], userSettings: { copyEnabled: false, pasteEnabled: false } };
  const manager = new AutoEnableManager({ getPluginState: async () => state,
    updatePluginState: async updates => Object.assign(state, updates),
    addStateListener: fn => listeners.push(fn) });
  assert.equal(await manager.getDomainConfig('example.com'), null);
  state.autoEnableList = [{ domain: 'example.com', copyEnabled: false, pasteEnabled: true }];
  for (const listener of listeners) listener({ changes: { auto_enable_list: { newValue: state.autoEnableList } } });
  assert.deepEqual(JSON.parse(JSON.stringify(await manager.getDomainConfig('example.com'))), state.autoEnableList[0]);
  await manager.applyAutoEnableConfig(12, state.autoEnableList[0]);
  assert.ok(messages.length > 0);
  for (const message of messages) assert.equal(MessageUtils.isValidMessage(message), true);
  assert.equal(state.userSettings.copyEnabled, false);
  assert.equal(state.userSettings.pasteEnabled, false);
});
