// Load real product methods with in-memory Chrome/DOM doubles.
// No browser, network, real profile, or product-storage access.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(evidence, '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const clone = x => structuredClone(x);
const quiet = { log() {}, error() {}, warn() {}, debug() {} };
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
function loadBackground(h, MessageUtils = {}) {
  let installed;
  const chrome = { ...h.chrome,
    runtime: { id: 'synthetic-extension', getURL: name => 'chrome-extension://synthetic-extension/' + name, onInstalled: { addListener(fn) { installed = fn; } } },
    tabs: { onUpdated: { addListener() {} } } };
  const source = read('background/service-worker.js')
    .replace(/^importScripts\([^\n]+\);/m, '')
    .replace('const backgroundManager = new BackgroundManager();', '');
  const classes = vm.runInNewContext(source + '\n({StateManager, BackgroundManager});', {
    StorageUtils: h.StorageUtils, MessageUtils, chrome, console: quiet, navigator: { userAgent: 'synthetic-audit-agent' }
  });
  return { ...classes, installed };
}
async function stateFor(h) {
  const { StateManager, BackgroundManager } = loadBackground(h);
  const state = Object.assign(Object.create(StateManager.prototype), {
    stateCache: new Map(), initialized: true, cacheHitCount: 0, listeners: new Set(), pendingOperations: new Map(), storageAccessCount: 0, monitoringManager: { recordPerformance() {}, logStateChange() {} }
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
    elements, settings: {}, whitelist: [], excludedList: [], showNotification() {}, renderWhitelist() {},
    renderExcludedList() {}, updateFormValues() {}
  });
}

export { loadStorage, loadBackground, stateFor, loadAuto, loadOptions, read, quiet };
