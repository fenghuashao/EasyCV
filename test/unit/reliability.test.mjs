import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadStorage, loadBackground, stateFor, loadAuto, loadOptions, read } from './helpers/reliability-harness.mjs';
import { runInjector } from './helpers/injector-harness.mjs';
import { createCopyPasteManager } from './helpers/content-harness.mjs';

test('F01 failed sync write rejects and never reports local fallback as saved', async () => {
  const h = loadStorage({ force_mode: false }, {}, true);
  await assert.rejects(h.StorageUtils.setForceMode(true));
  assert.equal(h.sync.force_mode, false);
  assert.equal(h.local.force_mode, undefined);
});
test('F02 editing a rule without saving preserves its persisted value', async () => {
  const rule = { domain: 'example.com', copyEnabled: true, pasteEnabled: false };
  const h = loadStorage({ auto_enable_list: [rule] });
  const options = loadOptions(h.StorageUtils);
  options.whitelist = [rule];
  await options.editWhitelistDomain(rule.domain);
  assert.deepEqual(h.sync.auto_enable_list, [rule]);
});
test('F03 legacy and mixed lists normalize on the background read path without rewriting storage', async () => {
  const original = ['example.com', { domain: 'other.example', copyEnabled: false, pasteEnabled: true, custom: 7 }];
  const h = loadStorage({ auto_enable_list: original });
  const { state } = await stateFor(h);
  const match = await loadAuto(state, h.StorageUtils).getDomainConfig('example.com');
  assert.equal(match.copyEnabled, true);
  assert.deepEqual(h.sync.auto_enable_list, original);
});
test('F04 wildcard is subdomain-only, boundary-safe and exact rules win', async () => {
  const h = loadStorage({ auto_enable_list: [
    { domain: '*.example.com', copyEnabled: true, pasteEnabled: true },
    { domain: 'sub.example.com', copyEnabled: false, pasteEnabled: true }
  ] });
  const { state } = await stateFor(h);
  const auto = loadAuto(state, h.StorageUtils);
  assert.equal(await auto.getDomainConfig('notexample.com'), null);
  assert.equal(await auto.getDomainConfig('example.com'), null);
  assert.equal((await auto.getDomainConfig('sub.example.com')).copyEnabled, false);
});
test('F05 automatic site visit never writes global defaults', async () => {
  const h = loadStorage(); let writes = 0;
  const auto = loadAuto({ addStateListener() {}, async getPluginState() { return { userSettings: {} }; },
    async updatePluginState() { writes++; } }, h.StorageUtils);
  await auto.applyAutoEnableConfig(12, { domain: 'example.com', copyEnabled: true, pasteEnabled: false });
  assert.equal(writes, 0);
});
test('F06 failed status lookup returns a failure, never enabled success', async () => {
  const { BackgroundManager } = loadBackground(loadStorage());
  const bg = Object.assign(Object.create(BackgroundManager.prototype), {
    stateManager: { async getPluginState() { throw Error('synthetic'); } }
  });
  const result = await bg.handleGetStatus({ domain: 'accounts.google.com' });
  assert.equal(result.success, false);
  assert.notEqual(result.data?.enabled, true);
});
test('F07 diagnostics contain only fixed non-sensitive fields and live in local', async () => {
  const h = loadStorage(); const { background } = await stateFor(h);
  await background.handleReportError({ url: 'https://example.com/?secret=synthetic', stack: 'private', message: 'private' },
    { tab: { url: 'https://example.com/?secret=synthetic' } });
  assert.equal(h.sync.errorReports, undefined);
  assert.equal(h.local.errorReports.length, 1);
  assert.doesNotMatch(JSON.stringify(h.local.errorReports), /secret|example.com|private|userAgent|sender/);
});
test('F08 malformed import changes neither settings nor rules', async () => {
  const before = { force_mode: true, auto_enable_list: ['example.com'], user_settings: { copyEnabled: false } };
  const h = loadStorage(structuredClone(before));
  await loadOptions(h.StorageUtils).handleFileImport({ text: async () => JSON.stringify({ settings: { copyEnabled: true }, whitelist: { bad: true } }) });
  assert.deepEqual(h.sync, before);
});
test('F09 concurrent settings updates merge rather than lose unrelated fields', async () => {
  const h = loadStorage({ user_settings: { copyEnabled: true, pasteEnabled: true, custom: 'keep' } });
  await Promise.all([h.StorageUtils.updateUserSettings({ copyEnabled: false }), h.StorageUtils.updateUserSettings({ pasteEnabled: false })]);
  assert.equal(h.sync.user_settings.copyEnabled, false);
  assert.equal(h.sync.user_settings.pasteEnabled, false);
  assert.equal(h.sync.user_settings.custom, 'keep');
});
test('F10 deleted storage keys normalize to safe defaults in background cache', async () => {
  const h = loadStorage({ auto_enable_list: [], user_settings: {} });
  const { state } = await stateFor(h); state.setupStorageListener();
  delete h.sync.auto_enable_list; delete h.sync.user_settings;
  h.changed({ auto_enable_list: { oldValue: [] }, user_settings: { oldValue: {} } });
  const status = await state.getPluginState('accounts.google.com');
  assert.equal(status.excluded, true);
});
test('F11 copy-disabled injector preserves copy preventDefault but neutralizes paste', () => {
  const h = runInjector({ copyEnabled: false, pasteEnabled: true });
  h.Event.prototype.preventDefault.call({ type: 'copy' });
  h.Event.prototype.preventDefault.call({ type: 'paste' });
  assert.deepEqual(h.eventMethodCalls.preventDefault.map(x => x.type), ['copy']);
});
test('F12 ordinary page is not restricted and analysis never saves visited domains', async () => {
  const body = { oncontextmenu: null, getAttribute() { return null; } };
  const DOMUtils = vm.runInNewContext(read('utils/dom-utils.js') + '\nDOMUtils;', {
    document: { body }, window: { getComputedStyle() { return { userSelect: 'auto' }; } }
  });
  assert.equal(DOMUtils.detectSelectionRestrictions().contextMenu, false);
  const h = loadStorage({ user_settings: { enableStatistics: false } });
  const { background } = await stateFor(h);
  await background.handlePageAnalyzed({ restrictions: { copy: true }, domain: 'example.com' }, {});
  assert.equal(h.sync.statistics, undefined);
  assert.equal(h.local.statistics, undefined);
});
test('site settings apply per-domain while global off and exclusions dominate', async () => {
  const h = loadStorage({ plugin_enabled: true, user_settings: { copyEnabled: false, pasteEnabled: false },
    auto_enable_list: [{ domain: 'example.com', copyEnabled: true, pasteEnabled: false }] });
  const { background } = await stateFor(h);
  assert.equal((await background.handleGetStatus({ domain: 'example.com' })).data.copyEnabled, true);
  assert.equal((await background.handleGetStatus({ domain: 'elsewhere.com' })).data.copyEnabled, false);
  assert.equal((await background.handleGetStatus({ domain: 'accounts.google.com' })).data.enabled, false);
  h.sync.plugin_enabled = false;
  assert.equal((await background.handleGetStatus({ domain: 'example.com' })).data.enabled, false);
});
test('privacy migration is idempotent, preserves history locally and removes sync copies only after verified write', async () => {
  const h = loadStorage({ statistics: { totalActivations: 5, sitesUnlocked: ['old.example'] },
    interaction_history: { 'old.example': 123 }, errorReports: [{ url: 'https://private.example', error: 'secret' }] });
  await h.StorageUtils.migratePrivateData();
  await h.StorageUtils.migratePrivateData();
  assert.equal(h.sync.statistics, undefined);
  assert.equal(h.sync.interaction_history, undefined);
  assert.equal(h.sync.errorReports, undefined);
  assert.equal(h.local.statistics.totalActivations, 5);
  assert.match(JSON.stringify(h.local.legacy_private_backup), /old.example/);
  assert.doesNotMatch(JSON.stringify(h.local), /private.example|secret/);
});
test('migration local write failure preserves original sync data', async () => {
  const h = loadStorage({ statistics: { totalActivations: 5 } });
  h.chrome.storage.local.set = async () => { throw Error('disk full'); };
  await assert.rejects(h.StorageUtils.migratePrivateData());
  assert.equal(h.sync.statistics.totalActivations, 5);
});
test('atomic imported settings preserve excluded list when absent and reject unsafe domains', async () => {
  const h = loadStorage({ excluded_list: [], user_settings: { custom: 'keep' } });
  await h.StorageUtils.importConfiguration({ settings: { copyEnabled: false }, whitelist: ['legacy.example'] });
  assert.deepEqual(h.sync.excluded_list, []);
  assert.equal(h.sync.user_settings.custom, 'keep');
  const before = structuredClone(h.sync);
  await assert.rejects(h.StorageUtils.importConfiguration({ settings: {}, whitelist: [{ domain: '<img src=x>', copyEnabled: true, pasteEnabled: true }] }));
  assert.deepEqual(h.sync, before);
});
test('failed rule replacement and parallel additions preserve original/latest rules', async () => {
  const h = loadStorage({ auto_enable_list: ['original.example'] });
  await Promise.all([h.StorageUtils.addToAutoEnableList('one.example'), h.StorageUtils.addToAutoEnableList('two.example')]);
  assert.equal(h.sync.auto_enable_list.length, 3);
  await assert.rejects(h.StorageUtils.replaceAutoEnableRule('original.example', { domain: 'one.example', copyEnabled: true, pasteEnabled: true }));
  assert.equal(h.sync.auto_enable_list.length, 3);
});

test('two extension pages write through one worker queue; content-page mutation is rejected', async () => {
  const h = loadStorage({ user_settings: { copyEnabled: true, pasteEnabled: true } });
  let handler;
  const { BackgroundManager } = loadBackground(h, { MESSAGE_TYPES: { STORAGE_MUTATION: 'storage_mutation' },
    addMessageListener(fn) { handler = fn; } });
  Object.create(BackgroundManager.prototype).setupMessageHandlers();
  const sender = { id: 'synthetic-extension', url: 'chrome-extension://synthetic-extension/options/options.html' };
  let messages = 0;
  const page = () => vm.runInNewContext(read('utils/storage-utils.js') + '\nStorageUtils;', {
    window: {}, chrome: { runtime: { sendMessage: message => { messages++; return handler(message, sender).catch(() => ({ success: false })); } } }
  });
  await Promise.all([page().updateUserSettings({ copyEnabled: false }), page().updateUserSettings({ pasteEnabled: false })]);
  assert.equal(messages, 2);
  assert.equal(h.sync.user_settings.copyEnabled, false);
  assert.equal(h.sync.user_settings.pasteEnabled, false);
  await assert.rejects(handler({ type: 'storage_mutation', data: { operation: 'clear' } },
    { id: sender.id, url: 'https://example.com' }));
  assert.ok(h.sync.user_settings);
  h.chrome.storage.sync.set = async () => { throw Error('quota'); };
  await assert.rejects(page().setForceMode(true));
});

test('worker state updates and direct options updates share the same serialization queue', async () => {
  const h = loadStorage({ user_settings: { copyEnabled: true, pasteEnabled: true } });
  const { state } = await stateFor(h);
  await Promise.all([state.updatePluginState({ copyEnabled: false }, 'copy'),
    h.StorageUtils.updateUserSettings({ pasteEnabled: false })]);
  assert.equal(h.sync.user_settings.copyEnabled, false);
  assert.equal(h.sync.user_settings.pasteEnabled, false);
});

test('failed write does not poison the next queued write', async () => {
  const h = loadStorage(); const set = h.chrome.storage.sync.set; let first = true;
  h.chrome.storage.sync.set = data => { if (first) { first = false; throw Error('quota'); } return set(data); };
  await assert.rejects(h.StorageUtils.updateUserSettings({ copyEnabled: false }));
  await h.StorageUtils.updateUserSettings({ pasteEnabled: false });
  assert.equal(h.sync.user_settings.copyEnabled, true);
  assert.equal(h.sync.user_settings.pasteEnabled, false);
});

test('local fallback is readable only for missing sync keys; restore is explicit and preserves original', async () => {
  const local = { force_mode: true, auto_enable_list: ['local.example'] };
  const h = loadStorage({ force_mode: false }, structuredClone(local));
  assert.equal(await h.StorageUtils.getForceMode(), false);
  assert.equal((await h.StorageUtils.getAutoEnableList())[0].domain, 'local.example');
  assert.equal(h.sync.auto_enable_list, undefined);
  await h.StorageUtils.restoreLocalSettings();
  assert.equal(h.sync.force_mode, true);
  assert.deepEqual(h.local, local);
  h.chrome.storage.sync.get = async () => { throw Error('sync unavailable'); };
  await assert.rejects(h.StorageUtils.getForceMode());
});

test('invalid local recovery and prototype-polluting import never alter sync', async () => {
  const h = loadStorage({ force_mode: false }, { force_mode: 'bad' });
  await assert.rejects(h.StorageUtils.restoreLocalSettings());
  await assert.rejects(h.StorageUtils.importConfiguration(JSON.parse('{"settings":{"__proto__":{"enabled":true}},"whitelist":[]}')));
  assert.deepEqual(h.sync, { force_mode: false });
});

test('exported local recovery format can restore only its keys through the validated importer', async () => {
  const h = loadStorage({ excluded_list: ['keep.example'], user_settings: { custom: 2 } });
  await h.StorageUtils.importConfiguration({ schemaVersion: 1, kind: 'easycv-local-recovery',
    configuration: { force_mode: true, auto_enable_list: ['recover.example'] } });
  assert.equal(h.sync.force_mode, true);
  assert.deepEqual(h.sync.excluded_list, ['keep.example']);
  assert.equal(h.sync.user_settings.custom, 2);
  await assert.rejects(h.StorageUtils.importConfiguration({ schemaVersion: 2, settings: {}, whitelist: [] }));
  const exported = await h.StorageUtils.exportSettings();
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.whitelist[0].domain, 'recover.example');
});

test('valid import preserves future fields, normalizes domains, and reports sync failure', async () => {
  const h = loadStorage({ user_settings: { previous: 7 } });
  await h.StorageUtils.importConfiguration({ settings: { future: { version: 2 } },
    whitelist: [{ domain: ' Sub.Example.com ', copyEnabled: false, pasteEnabled: false, future: 3 }] });
  assert.equal(h.sync.user_settings.previous, 7);
  assert.equal(h.sync.user_settings.future.version, 2);
  assert.equal(h.sync.auto_enable_list[0].domain, 'sub.example.com');
  assert.equal(h.sync.auto_enable_list[0].future, 3);
  const before = structuredClone(h.sync);
  h.chrome.storage.sync.set = async () => { throw Error('quota'); };
  await assert.rejects(h.StorageUtils.importConfiguration({ settings: {}, whitelist: [] }));
  assert.deepEqual(h.sync, before);
});

test('failed save keeps the options rule draft and original; cancel performs no storage write', async () => {
  const rule = { domain: 'original.example', copyEnabled: true, pasteEnabled: false };
  const h = loadStorage({ auto_enable_list: [rule] }, {}, true);
  const options = loadOptions(h.StorageUtils); options.whitelist = [rule];
  await options.editWhitelistDomain(rule.domain);
  await options.addWhitelistDomain('renamed.example');
  assert.equal(options.editingDomain, rule.domain);
  assert.deepEqual(h.sync.auto_enable_list, [rule]);
  options.cancelRuleEdit();
  assert.equal(options.editingDomain, null);
  assert.deepEqual(h.sync.auto_enable_list, [rule]);
});

test('whitelist delegate binds once and HTML escaping protects attributes as well as text', () => {
  const options = loadOptions(loadStorage().StorageUtils); let bindings = 0;
  const container = { addEventListener() { bindings++; } };
  options.setupWhitelistEventListeners(container); options.setupWhitelistEventListeners(container);
  assert.equal(bindings, 1);
  assert.equal(options.escapeHTML('<x a="b">&\''), '&lt;x a=&quot;b&quot;&gt;&amp;&#39;');
});

test('disabled statistics never write counters, and stale daily counts reset on read', async () => {
  const h = loadStorage({ user_settings: { enableStatistics: false } },
    { statistics: { totalActivations: 10, todayUsage: 9, lastUsedDate: 'old date' } });
  await h.StorageUtils.recordActivation();
  assert.equal(h.local.statistics.totalActivations, 10);
  assert.equal((await h.StorageUtils.getStatistics()).todayUsage, 0);
});

test('migration verification failure and sync removal failure preserve source for retry', async () => {
  const h = loadStorage({ interaction_history: { 'old.example': 1 } });
  const getLocal = h.chrome.storage.local.get;
  h.chrome.storage.local.get = async () => ({});
  await assert.rejects(h.StorageUtils.migratePrivateData());
  assert.ok(h.sync.interaction_history);
  h.chrome.storage.local.get = getLocal;
  const remove = h.chrome.storage.sync.remove;
  h.chrome.storage.sync.remove = async () => { throw Error('offline'); };
  await assert.rejects(h.StorageUtils.migratePrivateData());
  assert.ok(h.sync.interaction_history);
  h.chrome.storage.sync.remove = remove;
  await h.StorageUtils.migratePrivateData();
  assert.equal(h.sync.interaction_history, undefined);
  assert.equal(h.local.legacy_private_backup.sync_interaction_history['old.example'], 1);
});

test('malformed legacy diagnostics are sanitized and repeat migration stays stable', async () => {
  const h = loadStorage({}, { errorReports: [null, { unknownSecret: 'sensitive' }, { stack: 'private' }] });
  await h.StorageUtils.migratePrivateData();
  const before = structuredClone(h.local);
  await h.StorageUtils.migratePrivateData();
  assert.deepEqual(h.local, before);
  assert.doesNotMatch(JSON.stringify(h.local), /sensitive|private|stack/);
});

test('content fails closed after known-enabled state and can recover on a later status refresh', async () => {
  let response = { success: false };
  const { CopyPasteManager } = createCopyPasteManager({ messageUtils: {
    MESSAGE_TYPES: { GET_STATUS: 'get_status' }, sendToBackground: async () => response
  } });
  let stops = 0;
  const manager = Object.assign(Object.create(CopyPasteManager.prototype), {
    maxRetryCount: 0, stateLoadTimeout: 10, lastKnownState: { isEnabled: true, copyEnabled: true, pasteEnabled: true },
    isEnabled: true, copyEnabled: true, pasteEnabled: true, disableCopyPaste: async () => { stops++; }, debugLog() {}
  });
  await manager.loadSettingsWithRetry();
  assert.equal(manager.stateKnown, false); assert.equal(manager.isEnabled, false); assert.ok(stops > 0);
  assert.equal((await manager.handleGetPageStatus()).success, false);
  response = { success: true, data: { enabled: true, copyEnabled: false, pasteEnabled: true, forceMode: false } };
  await manager.loadSettingsWithRetry();
  assert.equal(manager.stateKnown, true); assert.equal(manager.isEnabled, true); assert.equal(manager.copyEnabled, false);
  response.data.enabled = 'invalid';
  await manager.loadSettingsWithRetry();
  assert.equal(manager.stateKnown, false); assert.equal(manager.isEnabled, false);
});

for (const [copyEnabled, pasteEnabled] of [[true, true], [true, false], [false, true], [false, false]]) {
  test(`injector mode ${copyEnabled}/${pasteEnabled} scopes events, shortcuts and styles; off restores originals`, () => {
    const h = runInjector({ copyEnabled, pasteEnabled });
    h.window.easycvInjector.reinitialize();
    for (const type of ['copy', 'paste']) h.Event.prototype.preventDefault.call({ type });
    assert.deepEqual(h.eventMethodCalls.preventDefault.map(e => e.type),
      [!copyEnabled && 'copy', !pasteEnabled && 'paste'].filter(Boolean));
    assert.equal(h.styles.length, copyEnabled ? 1 : 0);
    h.Event.prototype.preventDefault.call({ type: 'keydown', ctrlKey: true, key: 's' });
    assert.equal(h.eventMethodCalls.preventDefault.at(-1).key, 's');
    const listener = event => event.preventDefault(); const target = new h.EventTarget();
    target.addEventListener('copy', listener); target.removeEventListener('copy', listener);
    assert.equal(h.registrations.at(-1).args[1], listener); assert.equal(h.removals.at(-1).args[1], listener);
    h.window.easycvInjector.restore();
    h.Event.prototype.preventDefault.call({ type: 'copy' }); h.Event.prototype.preventDefault.call({ type: 'paste' });
    assert.deepEqual(h.eventMethodCalls.preventDefault.slice(-2).map(e => e.type), ['copy', 'paste']);
    assert.equal(h.styles.length, 0);
  });
}

test('main-world dynamic attributes and document properties restore across repeated mode changes', () => {
  const attrs = new Map([['oncopy', 'return false'], ['onpaste', 'return false']]);
  const node = { nodeType: 1, getAttribute: name => attrs.get(name) ?? null, removeAttribute: name => attrs.delete(name),
    setAttribute: (name, value) => attrs.set(name, value) };
  const h = runInjector({ nodes: [node], copyEnabled: true, pasteEnabled: false });
  h.window.easycvInjector.reinitialize();
  assert.equal(attrs.has('oncopy'), false); assert.equal(attrs.has('onpaste'), true);
  const handler = () => false; h.document.oncontextmenu = handler;
  h.window.receiveMessage({ source: h.window, data: { type: 'EASYCV_ENABLE', copyEnabled: false, pasteEnabled: true } });
  assert.equal(h.document.oncontextmenu, handler);
  assert.equal(attrs.get('oncopy'), 'return false'); assert.equal(attrs.has('onpaste'), false);
  h.window.receiveMessage({ source: h.window, data: { type: 'EASYCV_DISABLE' } });
  assert.equal(attrs.get('onpaste'), 'return false');
  assert.equal(h.styles.length, 0);
  assert.ok(h.observers.every(observer => observer.disconnected));
});

test('locale keys stay aligned and every static UI message exists in both languages', () => {
  const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
  const en = JSON.parse(read('_locales/en/messages.json'));
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const file of ['options/options.js', 'options/options.html', 'popup/popup.js', 'popup/popup.html']) {
    for (const match of read(file).matchAll(/(?:data-i18n(?:-placeholder|-title)?="|I18nUtils\.t\(')([a-z_]+)["']/g)) {
      assert.ok(zh[match[1]]?.message, `${file}: missing zh ${match[1]}`);
      assert.ok(en[match[1]]?.message, `${file}: missing en ${match[1]}`);
    }
  }
});

test('main-world paste-only Shadow DOM protection does not inject copy styles', () => {
  const h = runInjector({ copyEnabled: false, pasteEnabled: true });
  const root = { adoptedStyleSheets: [], querySelectorAll: () => [], children: [] };
  h.document.documentElement.shadowRoot = root;
  h.window.easycvInjector.reinitialize();
  assert.equal(root.adoptedStyleSheets.length, 0);
  h.window.receiveMessage({ source: h.window, data: { type: 'EASYCV_ENABLE', copyEnabled: true, pasteEnabled: false } });
  assert.equal(root.adoptedStyleSheets.length, 1);
  h.window.easycvInjector.restore();
  assert.equal(root.adoptedStyleSheets.length, 0);
});
