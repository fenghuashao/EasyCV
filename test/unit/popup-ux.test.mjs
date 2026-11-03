import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCopyPasteManager } from './helpers/content-harness.mjs';

const source = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const RealStorageUtils = new Function('chrome', `${source('utils/storage-utils.js')};return StorageUtils;`)({});
const RealMessageUtils = new Function('chrome', `${source('utils/message-utils.js')};return MessageUtils;`)({});

function popup({ url = 'https://example.com/article?token=private#secret',
  settings = { enabled: true }, excluded = [], response } = {}) {
  const elements = new Map();
  for (const id of ['statusIndicator', 'statusText', 'currentUrl', 'refreshBtn', 'testCopyBtn',
    'addToAutoBtn', 'addToAutoBtnText', 'helpPanel', 'helpBtn']) {
    elements.set(id, { textContent: '', className: '', style: {}, disabled: false, hidden: true,
      attributes: {}, classList: { toggle() {} },
      setAttribute(name, value) { this.attributes[name] = value; }, scrollIntoView() {} });
  }
  const messages = [];
  const opened = [];
  const notifications = [];
  const chrome = { runtime: { getManifest: () => ({ version: '1.1.2' }) },
    tabs: { create: options => opened.push(options) } };
  const storage = { getPluginSettings: async () => settings, getExcludedList: async () => excluded,
    isDomainExcluded: RealStorageUtils.isDomainExcluded.bind(RealStorageUtils),
    getAutoEnableConfig: async () => null, getInteractionHistory: async () => ({}) };
  const Factory = new Function('document', 'window', 'chrome', 'MessageUtils', 'StorageUtils',
    'I18nUtils', 'NotificationUtils', 'console', 'navigator', `${source('popup/popup.js')};return PopupManager;`);
  const PopupManager = Factory({ getElementById: id => elements.get(id), addEventListener() {} },
    {}, chrome, { MESSAGE_TYPES: RealMessageUtils.MESSAGE_TYPES, sendToContentScript: async (tabId, request) => {
      messages.push(request);
      return response;
    } }, storage, { t: (key, substitutions) => `${key}${substitutions ? `:${substitutions}` : ''}` },
    { show: (text, kind) => notifications.push({ text, kind }) },
    { log() {}, warn() {}, error() {} }, { userAgent: 'private-browser-details' });
  const manager = new PopupManager();
  manager.currentTab = { id: 1, url };
  return { manager, elements, notifications, messages, opened, storage };
}

async function pageResponse(overrides = {}) {
  const { CopyPasteManager } = createCopyPasteManager();
  const content = Object.assign(Object.create(CopyPasteManager.prototype), {
    isEnabled: true, copyEnabled: true, pasteEnabled: true, forceMode: false,
    detectRestrictions: () => ({ userSelect: false, contextMenu: true }), ...overrides
  });
  return content.handleGetPageStatus({});
}

for (const type of ['GET_PAGE_STATUS', 'TEST_COPY', 'REFRESH_DETECTION']) {
  test(`${type} traverses the real message validator and content receiver`, async () => {
    let receiver;
    const MessageUtils = new Function('chrome', `${source('utils/message-utils.js')};return MessageUtils;`)(
      { runtime: { onMessage: { addListener: fn => { receiver = fn; } } } });
    const { CopyPasteManager } = createCopyPasteManager({ messageUtils: MessageUtils });
    const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
      isEnabled: false, copyEnabled: false, pasteEnabled: true, forceMode: false,
      detectRestrictions: () => ({ userSelect: false })
    });
    manager.setupMessageListeners();
    const response = await new Promise(resolve => {
      if (!receiver({ type, data: {}, timestamp: Date.now() }, {}, resolve)) resolve({ success: false });
    });
    assert.equal(response.success, true);
    if (type === 'GET_PAGE_STATUS') assert.equal(response.status.isEnabled, false);
    if (type === 'TEST_COPY') assert.equal(response.canCopy, false);
  });
}

test('Popup renders the real content-script status envelope, including a first auto-enabled visit', async () => {
  const h = popup({ response: await pageResponse() });
  h.storage.getAutoEnableConfig = async () => ({ domain: 'example.com' });
  await h.manager.updatePageStatus();
  assert.equal(h.elements.get('statusText').textContent, 'status_active');
  assert.equal(h.elements.get('currentUrl').textContent, 'example.com');
});

for (const [overrides, expected] of [
  [{ copyEnabled: false }, 'status_partial'],
  [{ copyEnabled: false, pasteEnabled: false }, 'status_inactive'],
  [{ isEnabled: false }, 'status_inactive']
]) {
  test(`Page switches ${JSON.stringify(overrides)} render ${expected}`, async () => {
    const h = popup({ response: await pageResponse(overrides) });
    await h.manager.updatePageStatus();
    assert.equal(h.elements.get('statusText').textContent, expected);
  });
}

for (const url of ['chrome://settings/', 'about:blank', 'https://chromewebstore.google.com/detail/example']) {
  test(`Unsupported page ${url} gives an explanation without messaging a content script`, async () => {
    const h = popup({ url });
    await h.manager.updatePageStatus();
    await h.manager.updateAutoEnableButton();
    assert.equal(h.elements.get('statusText').textContent, 'status_unsupported');
    assert.equal(h.elements.get('testCopyBtn').disabled, true);
    assert.equal(h.elements.get('addToAutoBtn').disabled, true);
    assert.equal(h.messages.length, 0);
  });
}

test('Excluded sites explain the exclusion and cannot be added to auto-enable from Popup', async () => {
  const h = popup({ excluded: ['example.com'] });
  await h.manager.updatePageStatus();
  await h.manager.updateAutoEnableButton();
  assert.equal(h.elements.get('statusText').textContent, 'status_excluded');
  assert.equal(h.elements.get('addToAutoBtn').disabled, true);
});

test('A missing content script prompts a page refresh instead of claiming inactivity or success', async () => {
  const h = popup({ response: { success: false, degraded: true } });
  await h.manager.updatePageStatus();
  assert.equal(h.elements.get('statusText').textContent, 'status_page_unavailable');
  assert.equal(h.elements.get('testCopyBtn').disabled, true);
});

test('The global off switch is explained without querying page activation', async () => {
  const h = popup({ settings: { enabled: false }, response: await pageResponse() });
  await h.manager.updatePageStatus();
  assert.equal(h.elements.get('statusText').textContent, 'status_plugin_disabled');
  assert.equal(h.messages.length, 0);
});

test('A successful message with copying disabled is not reported as a successful copy', async () => {
  const h = popup({ response: { success: true, canCopy: false } });
  await h.manager.handleTestCopy();
  assert.equal(h.notifications[0].text, 'copy_check_disabled');
  assert.equal(h.notifications[0].kind, 'info');
});

test('An enabled copy switch asks for a real manual copy instead of claiming clipboard success', async () => {
  const h = popup({ response: { success: true, canCopy: true } });
  await h.manager.handleTestCopy();
  assert.equal(h.notifications[0].text, 'copy_check_enabled');
  assert.equal(h.notifications[0].kind, 'info');
});

test('A message without a boolean copy state cannot produce an enabled-state notification', async () => {
  const h = popup({ response: { success: true } });
  await h.manager.handleTestCopy();
  assert.equal(h.notifications[0].text, 'test_copy_failed');
  assert.equal(h.notifications[0].kind, 'error');
});

test('Help opens locally and can be collapsed without opening a placeholder website', () => {
  const h = popup();
  h.manager.handleHelp();
  assert.equal(h.elements.get('helpPanel').hidden, false);
  assert.equal(h.elements.get('helpBtn').attributes['aria-expanded'], 'true');
  h.manager.handleHelp();
  assert.equal(h.elements.get('helpPanel').hidden, true);
  assert.equal(h.opened.length, 0);
});

test('Feedback opens the real issue draft without sending browsing URLs or browser details', () => {
  const h = popup();
  h.manager.openFeedbackPage();
  const url = new URL(h.opened[0].url);
  assert.equal(`${url.origin}${url.pathname}`, 'https://github.com/fenghuashao/EasyCV/issues/new');
  assert.equal(url.searchParams.get('body').includes('private'), false);
  assert.equal(url.searchParams.get('body').includes('example.com'), false);
  assert.equal(url.searchParams.get('body').includes('1.1.2'), true);
});

for (const [statistics, expected] of [[{}, '—'], [{ totalAttempts: 5, successfulAttempts: 2 }, '—']]) {
  test(`Success-rate display stays unmeasured even with legacy counters: ${JSON.stringify(statistics)}`, async () => {
    const h = popup();
    h.elements.set('successRate', { textContent: '' });
    h.storage.getStatistics = async () => statistics;
    await h.manager.loadStatistics();
    assert.equal(h.elements.get('successRate').textContent, expected);
  });
}
