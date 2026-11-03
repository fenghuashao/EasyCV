// Investigation only: load unchanged product methods with in-memory Chrome/DOM doubles.
// No browser, network, real profile, or product-storage access.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runInjector } from '../../../test/unit/helpers/injector-harness.mjs';
import { createCopyPasteManager } from '../../../test/unit/helpers/content-harness.mjs';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(evidence, '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const clone = x => structuredClone(x);
const quiet = { log() {}, error() {}, warn() {}, debug() {} };
const results = [];
function area(store, failWrite = false) {
  return {
    async get(keys) { return clone(Object.fromEntries((Array.isArray(keys) ? keys : [keys])
      .filter(k => k in store).map(k => [k, store[k]]))); },
    async set(value) { if (failWrite) throw new Error('synthetic sync write failure'); Object.assign(store, clone(value)); },
    async clear() { for (const key of Object.keys(store)) delete store[key]; },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]; }
  };
}
function loadStorage(sync = {}, local = {}, failWrite = false) {
  let listener;
  const chrome = { storage: { sync: area(sync, failWrite), local: area(local),
    onChanged: { addListener(fn) { listener = fn; } } } };
  const StorageUtils = vm.runInNewContext(read('utils/storage-utils.js') + '\nStorageUtils;', { chrome, console: quiet });
  return { StorageUtils, sync, local, chrome, changed: changes => listener(changes, 'sync') };
}
function loadBackground(h) {
  let installed;
  const chrome = { ...h.chrome,
    runtime: { onInstalled: { addListener(fn) { installed = fn; } } },
    tabs: { onUpdated: { addListener() {} } } };
  const source = read('background/service-worker.js')
    .replace(/^importScripts\([^\n]+\);/m, '')
    .replace('const backgroundManager = new BackgroundManager();', '');
  const classes = vm.runInNewContext(source + '\n({StateManager, BackgroundManager});', {
    StorageUtils: h.StorageUtils, chrome, console: quiet, navigator: { userAgent: 'synthetic-audit-agent' }
  });
  return { ...classes, installed };
}
async function stateFor(h) {
  const { StateManager, BackgroundManager } = loadBackground(h);
  const state = Object.assign(Object.create(StateManager.prototype), {
    stateCache: new Map(), initialized: true, cacheHitCount: 0, listeners: new Set()
  });
  await state.preloadStates();
  const background = Object.assign(Object.create(BackgroundManager.prototype), { stateManager: state });
  return { state, background };
}
function loadAuto(stateManager, StorageUtils) {
  const Auto = vm.runInNewContext(read('background/auto-enable-manager.js') + '\nAutoEnableManager;', {
    StorageUtils, console: quiet, MessageUtils: { MESSAGE_TYPES: { STATE_UPDATED: 'state_updated' },
      async sendToContent() {} }
  });
  return new Auto(stateManager);
}
function loadOptions(StorageUtils) {
  const elements = new Map();
  const document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { checked: true, value: '', setAttribute() {},
        classList: { add() {}, remove() {} } });
      return elements.get(id);
    } };
  const Options = vm.runInNewContext(read('options/options.js') + '\nOptionsManager;', {
    StorageUtils, console: quiet, document, window: {}, I18nUtils: { t: key => key }, setTimeout() {}
  });
  return Object.assign(Object.create(Options.prototype), {
    settings: {}, whitelist: [], excludedList: [], showNotification() {}, renderWhitelist() {},
    renderExcludedList() {}, updateFormValues() {}
  });
}
async function probe(id, fn) {
  const observations = await fn();
  results.push({ id, reproduction: 'PASS', productFinding: 'FAIL', observations });
}

await probe('F01_SYNC_FALLBACK_LOST_ON_READ', async () => {
  const h = loadStorage({ force_mode: false }, {}, true);
  await h.StorageUtils.setForceMode(true);
  const actual = await h.StorageUtils.getForceMode();
  assert.equal(h.local.force_mode, true);
  assert.equal(actual, false);
  return { requested: true, localFallback: h.local.force_mode, subsequentRead: actual };
});
await probe('F02_EDIT_DELETES_RULE_BEFORE_SAVE', async () => {
  const original = [{ domain: 'example.com', copyEnabled: true, pasteEnabled: false }];
  const h = loadStorage({ auto_enable_list: clone(original) });
  const options = loadOptions(h.StorageUtils);
  options.whitelist = clone(original);
  await options.editWhitelistDomain('example.com');
  assert.equal(h.sync.auto_enable_list.length, 0);
  return { before: original, persistedAfterClickEditWithoutSave: h.sync.auto_enable_list };
});
await probe('F03_LEGACY_LIST_NOT_NORMALIZED_BY_BACKGROUND', async () => {
  const h = loadStorage({ auto_enable_list: ['example.com'], user_settings: { copyEnabled: false, pasteEnabled: false } });
  const { state } = await stateFor(h);
  const auto = loadAuto(state, h.StorageUtils);
  const utilityResult = await h.StorageUtils.getAutoEnableList();
  const actual = await auto.getDomainConfig('example.com');
  assert.equal(utilityResult[0].domain, 'example.com');
  assert.equal(actual, null);
  return { utilityResult, actualBackgroundMatch: actual, rawCache: state.stateCache.get('autoEnableList') };
});
await probe('F04_WILDCARD_MATCHES_UNRELATED_DOMAIN', async () => {
  const h = loadStorage({ auto_enable_list: [{ domain: '*.example.com', copyEnabled: true, pasteEnabled: true }] });
  const { state } = await stateFor(h);
  const actual = await loadAuto(state, h.StorageUtils).getDomainConfig('notexample.com');
  assert.equal(actual.domain, '*.example.com');
  return { visitedDomain: 'notexample.com', incorrectlyMatched: actual.domain, entryRoute: 'stored/imported wildcard rule' };
});
await probe('F05_SITE_RULE_WRITES_GLOBAL_SETTINGS', async () => {
  const h = loadStorage();
  const state = { userSettings: { copyEnabled: false, pasteEnabled: false } };
  let updates;
  const manager = loadAuto({ addStateListener() {}, async getPluginState() { return state; },
    async updatePluginState(value) { updates = value; Object.assign(state, value); } }, h.StorageUtils);
  await manager.applyAutoEnableConfig(123, { domain: 'example.com', copyEnabled: true, pasteEnabled: true });
  assert.equal(updates.userSettings.copyEnabled, true);
  return { updatesSentToGlobalStateManager: updates, tabIdUsedOnlyForNotification: 123 };
});
await probe('F06_ERROR_RETURNS_SUCCESS_AND_ENABLED', async () => {
  const h = loadStorage();
  const { BackgroundManager } = loadBackground(h);
  const manager = Object.assign(Object.create(BackgroundManager.prototype), {
    stateManager: { async getPluginState() { throw new Error('synthetic storage failure'); } }
  });
  const response = await manager.handleGetStatus({ domain: 'accounts.google.com' });
  assert.equal(response.success, true);
  assert.equal(response.data.enabled, true);
  return { domain: 'accounts.google.com', response, scope: 'error path, not normal exclusion behavior' };
});
await probe('F07_DIAGNOSTICS_WRITE_FULL_URL_TO_SYNC', async () => {
  const h = loadStorage();
  const { background } = await stateFor(h);
  const url = 'https://example.com/private?synthetic-secret=test#fragment';
  await background.handleReportError({ message: 'synthetic error', url }, { tab: { id: 123, url } });
  assert.equal(h.sync.errorReports[0].url, url);
  assert.equal(h.sync.errorReports[0].sender.tab.url, url);
  assert.equal(h.local.errorReports, undefined);
  return { storageArea: 'sync', savedFields: Object.keys(h.sync.errorReports[0]),
    fullSyntheticUrlStoredTwice: true, externalDeveloperUploadObserved: false };
});
await probe('F08_MALFORMED_IMPORT_PERSISTS_INVALID_LIST', async () => {
  const h = loadStorage({ auto_enable_list: [{ domain: 'example.com', copyEnabled: true, pasteEnabled: true }] });
  const options = loadOptions(h.StorageUtils);
  await options.handleFileImport({ text: async () => JSON.stringify({ settings: {}, whitelist: { bad: true } }) });
  assert.equal(Array.isArray(h.sync.auto_enable_list), false);
  const { state } = await stateFor(h);
  let message;
  try { await state.getPluginState('example.com'); } catch (error) { message = error.message; }
  assert.match(message, /find is not a function/);
  return { persistedList: h.sync.auto_enable_list, laterDomainLookupError: message };
});
await probe('F09_CONCURRENT_SETTINGS_WRITES_LOSE_A_FIELD', async () => {
  const h = loadStorage({ user_settings: { copyEnabled: true, pasteEnabled: true } });
  await Promise.all([h.StorageUtils.updateUserSettings({ copyEnabled: false }),
    h.StorageUtils.updateUserSettings({ pasteEnabled: false })]);
  assert.equal(h.sync.user_settings.copyEnabled, true);
  assert.equal(h.sync.user_settings.pasteEnabled, false);
  return { requested: { copyEnabled: false, pasteEnabled: false }, actual: h.sync.user_settings,
    scenario: 'overlapping Options/storage utility writes; not proof of frequency in a browser' };
});
await probe('F10_CLEAR_LEAVES_INVALID_BACKGROUND_CACHE', async () => {
  const h = loadStorage({ plugin_enabled: true, force_mode: false, auto_enable_list: [], user_settings: {} });
  const { state } = await stateFor(h);
  state.setupStorageListener();
  h.changed({ auto_enable_list: { oldValue: [] }, user_settings: { oldValue: {} } });
  let message;
  try { await state.getPluginState('example.com'); } catch (error) { message = error.message; }
  assert.match(message, /find/);
  return { simulatedEvent: 'sync.clear removes keys', domainLookupError: message };
});

const lifecycleChecks = [];
await probe('F11_PARTIAL_SWITCHES_DO_NOT_GATE_MAIN_WORLD', async () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const content = Object.assign(Object.create(CopyPasteManager.prototype), {
    isEnabled: true, copyEnabled: false, pasteEnabled: true
  });
  let action;
  content.enableCopyPaste = () => { action = 'enable'; };
  content.disableCopyPaste = () => { action = 'disable'; };
  await content.applyCurrentState();
  assert.equal(action, 'enable');
  const injector = runInjector();
  injector.Event.prototype.preventDefault.call({ type: 'copy' });
  injector.Event.prototype.preventDefault.call({ type: 'paste' });
  assert.equal(injector.eventMethodCalls.preventDefault.length, 0);
  return { contentState: { copyEnabled: false, pasteEnabled: true }, contentAction: action,
    mainWorldNeutralizes: ['copy', 'paste'],
    boundary: 'two real methods under separate doubles plus source inspection of configuration-free injector bridge; browser effect NOT_RUN' };
});
await probe('F12_NORMAL_PAGE_RECORDED_WITH_STATISTICS_DISABLED', async () => {
  const body = { oncontextmenu: null, getAttribute() { return null; } };
  const DOMUtils = vm.runInNewContext(read('utils/dom-utils.js') + '\nDOMUtils;', {
    document: { body }, window: { getComputedStyle() { return { userSelect: 'auto' }; } }
  });
  const restrictions = DOMUtils.detectSelectionRestrictions();
  assert.equal(restrictions.contextMenu, true);
  const h = loadStorage({ plugin_enabled: false, user_settings: { enableStatistics: false } });
  const { background } = await stateFor(h);
  await background.handlePageAnalyzed({ restrictions, domain: 'example.com' }, {});
  assert.equal(h.sync.statistics.sitesUnlocked[0], 'example.com');
  return { ordinaryPageWithNoContextMenuHandler: true, incorrectlyDetected: restrictions,
    pluginEnabled: false, enableStatistics: false, storedInSync: h.sync.statistics,
    boundary: 'real detector and report handler with synthetic input; browser NOT_RUN' };
});
for (const excluded of [undefined, [], ['keep.example']]) {
  const old = { plugin_enabled: false, force_mode: true,
    user_settings: { copyEnabled: false, pasteEnabled: true, detectionDelay: 1900 },
    auto_enable_list: ['legacy.example'] };
  if (excluded !== undefined) old.excluded_list = excluded;
  const h = loadStorage(clone(old));
  await loadBackground(h).installed({ reason: 'update', previousVersion: '1.1.1' });
  for (const [key, value] of Object.entries(old)) assert.deepEqual(h.sync[key], value);
  if (excluded === undefined) assert.equal(h.sync.excluded_list.length, 3);
  lifecycleChecks.push({ excludedInput: excluded ?? 'missing', preservedExistingKeys: true,
    result: 'PASS', boundary: 'mocked lifecycle handler; NOT a same-ID browser upgrade' });
}
const output = { sourceHead: '9d378b5', environment: { node: process.version, platform: process.platform, arch: process.arch },
  browserOperated: false, productCodeModified: false, findings: results, lifecycleChecks };
fs.writeFileSync(path.join(evidence, 'local-probes.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`${results.length} current defects reproduced; ${lifecycleChecks.length} simulated update-handler checks passed. No browser used.`);
