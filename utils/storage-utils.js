/** Existing setting keys, one background mutation queue, no silent sync/local fork. */
class StorageUtils {
  static STORAGE_KEYS = {
    PLUGIN_ENABLED: 'plugin_enabled', FORCE_MODE: 'force_mode', AUTO_ENABLE_LIST: 'auto_enable_list',
    EXCLUDED_LIST: 'excluded_list', USER_SETTINGS: 'user_settings', STATISTICS: 'statistics',
    LAST_UPDATE: 'last_update', INTERACTION_HISTORY: 'interaction_history'
  };
  static DEFAULT_SETTINGS = {
    pluginEnabled: true, forceMode: false, autoEnableList: [],
    excludedList: ['accounts.google.com', 'login.live.com', 'appleid.apple.com'],
    showNotifications: true, enableStatistics: true, theme: 'auto', copyEnabled: true, pasteEnabled: true
  };
  static CONFIG_KEYS = ['plugin_enabled', 'force_mode', 'user_settings', 'auto_enable_list', 'excluded_list'];
  static mutationHost = false;
  static mutationQueue = Promise.resolve();
  static configureMutationHost() { this.mutationHost = true; }

  static async get(keys) {
    const names = typeof keys === 'string' ? [keys] : keys;
    let sync;
    try { sync = await chrome.storage.sync.get(names); }
    catch (error) { throw new Error('Authoritative settings unavailable'); }
    const missing = names.filter(key => this.CONFIG_KEYS.includes(key) && !Object.hasOwn(sync, key));
    if (missing.length) {
      const local = await chrome.storage.local.get(missing);
      for (const key of missing) if (Object.hasOwn(local, key)) sync[key] = local[key];
    }
    return sync;
  }
  static async mutate(operation, data = {}) {
    if (!this.mutationHost && typeof window !== 'undefined' && chrome.runtime?.sendMessage) {
      const response = await chrome.runtime.sendMessage({ type: 'storage_mutation', data: { operation, data } });
      if (!response?.success) throw new Error('Settings could not be saved');
      return response.data;
    }
    const pending = this.mutationQueue.then(() => this.executeMutation(operation, data));
    this.mutationQueue = pending.catch(() => {});
    return pending;
  }
  static async executeMutation(operation, data) {
    if (operation === 'seedDefaults') {
      const existing = await this.get(this.CONFIG_KEYS);
      const defaults = {
        plugin_enabled: true,
        force_mode: false,
        auto_enable_list: [],
        excluded_list: this.DEFAULT_SETTINGS.excludedList,
        user_settings: this.DEFAULT_SETTINGS
      };
      const missing = Object.fromEntries(Object.entries(defaults).filter(([key]) => existing[key] === undefined));
      if (Object.keys(missing).length) await chrome.storage.sync.set(missing);
      return missing;
    }
    if (operation === 'clear') {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      return;
    }
    if (operation === 'remove') return chrome.storage.sync.remove(data);
    if (operation === 'privacy') return this.migratePrivateDataNow();
    if (operation === 'diagnostic') {
      await this.migratePrivateDataNow();
      const { errorReports = [] } = await chrome.storage.local.get(['errorReports']);
      const reports = Array.isArray(errorReports) ? errorReports : [];
      const entry = { code: 'CONTENT_OPERATION_FAILED', module: 'content', timestamp: new Date().toISOString(),
        version: chrome.runtime?.getManifest?.().version || 'unknown' };
      await chrome.storage.local.set({ errorReports: [...reports, entry].slice(-10) });
      return;
    }
    if (operation === 'activation') {
      if ((await this.getUserSettings()).enableStatistics === false) return;
      await this.migratePrivateDataNow();
      const stats = await this.getStatistics();
      const today = new Date().toDateString();
      await chrome.storage.local.set({ statistics: { totalActivations: stats.totalActivations + 1,
        todayUsage: stats.lastUsedDate === today ? stats.todayUsage + 1 : 1, lastUsedDate: today } });
      return;
    }
    let updates = {};
    if (operation === 'set') updates = data;
    else if (operation === 'settings' || operation === 'state') {
      this.validateSettings(data.userSettings || (operation === 'settings' ? data : {}));
      const settings = operation === 'settings' ? { ...data } : { ...data.userSettings };
      for (const key of ['copyEnabled', 'pasteEnabled']) if (Object.hasOwn(data, key)) settings[key] = data[key];
      const allowed = ['copyEnabled', 'pasteEnabled', 'showNotifications', 'enableStatistics', 'theme', 'autoDetect', 'debugMode', 'performanceMonitoring', 'autoAddToWhitelist', 'detectionDelay', 'maxRetries'];
      for (const key of Object.keys(settings)) if (!allowed.includes(key)) delete settings[key];
      delete settings.enabled; delete settings.forceMode; delete settings.pluginEnabled;
      if (Object.keys(settings).length) updates.user_settings = { ...await this.getUserSettings(), ...settings };
      if (Object.hasOwn(data, 'enabled')) updates.plugin_enabled = data.enabled;
      if (Object.hasOwn(data, 'pluginEnabled')) updates.plugin_enabled = data.pluginEnabled;
      if (Object.hasOwn(data, 'forceMode')) updates.force_mode = data.forceMode;
      if (Object.hasOwn(data, 'autoEnableList')) updates.auto_enable_list = data.autoEnableList;
    } else if (['addRule', 'replaceRule', 'removeRule'].includes(operation)) {
      const list = await this.getAutoEnableList();
      const oldDomain = this.normalizeDomain(data.originalDomain || data.domain, true);
      const index = list.findIndex(item => item.domain === oldDomain);
      if (operation === 'removeRule') updates.auto_enable_list = list.filter(item => item.domain !== oldDomain);
      else {
        const rule = this.normalizeAutoEnableList([data.rule])[0];
        if (operation === 'replaceRule' && index < 0) throw new Error('Rule changed; reload before editing');
        const duplicate = list.findIndex(item => item.domain === rule.domain);
        if (duplicate >= 0 && (operation === 'addRule' || duplicate !== index)) {
          if (operation === 'addRule') return list;
          throw new Error('Domain already exists');
        }
        if (operation === 'replaceRule') list[index] = { ...list[index], ...rule };
        else list.push(rule);
        updates.auto_enable_list = list;
      }
    } else if (operation === 'addExcluded' || operation === 'removeExcluded') {
      const list = await this.getExcludedList();
      const domain = this.normalizeDomain(data.domain);
      updates.excluded_list = operation === 'removeExcluded' ? list.filter(item => item !== domain) : [...new Set([...list, domain])];
    } else if (operation === 'import' || operation === 'restoreLocal') {
      if (operation === 'restoreLocal') {
        updates = this.validateConfigurationKeys(await chrome.storage.local.get(this.CONFIG_KEYS));
        if (updates.user_settings) updates.user_settings = { ...await this.getUserSettings(), ...updates.user_settings };
      } else if (data?.kind === 'easycv-local-recovery') {
        this.validateJSON(data);
        if (data.schemaVersion !== 1) throw new Error('Unsupported recovery schema');
        updates = this.validateConfigurationKeys(data.configuration);
        if (updates.user_settings) updates.user_settings = { ...await this.getUserSettings(), ...updates.user_settings };
      } else {
        this.validateJSON(data);
        if (data.schemaVersion !== undefined && data.schemaVersion !== 1) throw new Error('Unsupported settings schema');
        if (!data.settings || !Array.isArray(data.whitelist)) throw new Error('Invalid settings file');
        this.validateSettings(data.settings);
        const { enabled, pluginEnabled, forceMode, ...settings } = data.settings;
        updates.user_settings = { ...await this.getUserSettings(), ...settings };
        if (enabled !== undefined || pluginEnabled !== undefined) updates.plugin_enabled = enabled ?? pluginEnabled;
        if (forceMode !== undefined) updates.force_mode = forceMode;
        updates.auto_enable_list = this.normalizeAutoEnableList(data.whitelist);
        if (Object.hasOwn(data, 'excludedList')) updates.excluded_list = this.normalizeExcludedList(data.excludedList);
      }
    } else throw new Error('Unknown settings operation');
    updates = this.validateConfigurationKeys(updates);
    await chrome.storage.sync.set(updates);
    return updates;
  }
  static validateJSON(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid settings object');
    if (JSON.stringify(data).length > 1000000) throw new Error('Settings file is too large');
    const inspect = (value, depth = 0) => {
      if (depth > 20) throw new Error('Settings nesting is too deep');
      if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid settings key');
        inspect(item, depth + 1);
      }
    };
    inspect(data);
  }
  static validateSettings(settings) {
    this.validateJSON(settings);
    for (const key of ['enabled', 'pluginEnabled', 'forceMode', 'copyEnabled', 'pasteEnabled', 'showNotifications',
      'enableStatistics', 'autoDetect', 'debugMode', 'performanceMonitoring', 'autoAddToWhitelist']) {
      if (Object.hasOwn(settings, key) && typeof settings[key] !== 'boolean') throw new Error('Invalid setting: ' + key);
    }
    for (const [key, max] of [['detectionDelay', 60000], ['maxRetries', 100]]) {
      if (Object.hasOwn(settings, key) && (!Number.isInteger(settings[key]) || settings[key] < 0 || settings[key] > max)) throw new Error('Invalid setting: ' + key);
    }
    if (Object.hasOwn(settings, 'theme') && !['auto', 'light', 'dark'].includes(settings.theme)) throw new Error('Invalid theme');
  }
  static normalizeDomain(value, wildcard = false) {
    if (typeof value !== 'string') throw new Error('Invalid domain');
    const domain = value.trim().toLowerCase();
    const host = wildcard && domain.startsWith('*.') ? domain.slice(2) : domain;
    if (!host || host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('Invalid domain');
    return domain;
  }
  static normalizeAutoEnableList(list) {
    if (!Array.isArray(list) || list.length > 1000) throw new Error('Invalid site list');
    const seen = new Set();
    return list.map(value => {
      const item = typeof value === 'string' ? { domain: value, copyEnabled: true, pasteEnabled: true } : value;
      this.validateJSON(item);
      const domain = this.normalizeDomain(item.domain, true);
      if (seen.has(domain) || typeof item.copyEnabled !== 'boolean' || typeof item.pasteEnabled !== 'boolean') throw new Error('Invalid or duplicate site rule');
      seen.add(domain);
      return { ...item, domain };
    });
  }
  static normalizeExcludedList(list) {
    if (!Array.isArray(list) || list.length > 1000) throw new Error('Invalid excluded list');
    return [...new Set(list.map(domain => this.normalizeDomain(domain)))];
  }
  static validateConfigurationKeys(data) {
    this.validateJSON(data);
    const result = { ...data };
    for (const key of Object.keys(result)) if (!this.CONFIG_KEYS.includes(key)) throw new Error('Invalid configuration key');
    for (const key of ['plugin_enabled', 'force_mode']) if (Object.hasOwn(result, key) && typeof result[key] !== 'boolean') throw new Error('Invalid switch');
    if (Object.hasOwn(result, 'user_settings')) this.validateSettings(result.user_settings);
    if (Object.hasOwn(result, 'auto_enable_list')) result.auto_enable_list = this.normalizeAutoEnableList(result.auto_enable_list);
    if (Object.hasOwn(result, 'excluded_list')) result.excluded_list = this.normalizeExcludedList(result.excluded_list);
    return result;
  }
  static matchAutoEnableRule(domain, list) {
    const host = this.normalizeDomain(domain);
    const rules = this.normalizeAutoEnableList(list);
    return rules.find(item => item.domain === host) || rules.filter(item => item.domain.startsWith('*.') && host.endsWith('.' + item.domain.slice(2)))
      .sort((a, b) => b.domain.length - a.domain.length)[0] || null;
  }
  static isDomainExcluded(hostname, excludedList) {
    if (!hostname || !Array.isArray(excludedList)) return false;
    const host = String(hostname).toLowerCase();
    return excludedList.some(entry => { const domain = String(entry).toLowerCase(); return host === domain || host.endsWith('.' + domain); });
  }
  static set(data) { return this.mutate('set', data); }
  static remove(keys) { return this.mutate('remove', keys); }
  static clear() { return this.mutate('clear'); }
  static async getPluginEnabled() { return (await this.get('plugin_enabled')).plugin_enabled ?? true; }
  static setPluginEnabled(enabled) { return this.set({ plugin_enabled: enabled }); }
  static async getForceMode() { return (await this.get('force_mode')).force_mode ?? false; }
  static setForceMode(enabled) { return this.set({ force_mode: enabled }); }
  static async getAutoEnableList() { return this.normalizeAutoEnableList((await this.get('auto_enable_list')).auto_enable_list ?? []); }
  static setAutoEnableList(list) { return this.set({ auto_enable_list: list }); }
  static addToAutoEnableList(value, copyEnabled = true, pasteEnabled = true) {
    const rule = typeof value === 'string' ? { domain: value, copyEnabled, pasteEnabled } : value;
    return this.mutate('addRule', { domain: rule.domain, rule });
  }
  static replaceAutoEnableRule(originalDomain, rule) { return this.mutate('replaceRule', { originalDomain, rule }); }
  static removeFromAutoEnableList(domain) { return this.mutate('removeRule', { domain }); }
  static updateAutoEnableConfig(domain, copyEnabled, pasteEnabled) { return this.replaceAutoEnableRule(domain, { domain, copyEnabled, pasteEnabled }); }
  static async getAutoEnableConfig(domain) { return this.matchAutoEnableRule(domain, await this.getAutoEnableList()); }
  static async getExcludedList() { return this.normalizeExcludedList((await this.get('excluded_list')).excluded_list ?? this.DEFAULT_SETTINGS.excludedList); }
  static addToExcludedList(domain) { return this.mutate('addExcluded', { domain }); }
  static removeFromExcludedList(domain) { return this.mutate('removeExcluded', { domain }); }
  static setExcludedList(list) { return this.set({ excluded_list: list }); }
  static async getUserSettings() {
    const stored = (await this.get('user_settings')).user_settings ?? {};
    this.validateSettings(stored);
    return { ...this.DEFAULT_SETTINGS, ...stored };
  }
  static updateUserSettings(settings) { return this.mutate('settings', settings); }
  static async getPluginSettings() {
    const [enabled, forceMode, settings] = await Promise.all([this.getPluginEnabled(), this.getForceMode(), this.getUserSettings()]);
    return { ...settings, enabled, forceMode };
  }
  static setPluginSettings(settings) { return this.mutate('settings', settings); }
  static addStorageListener(callback) { chrome.storage.onChanged.addListener(callback); }
  static async exportSettings() {
    return { schemaVersion: 1, settings: await this.getPluginSettings(), whitelist: await this.getAutoEnableList(),
      excludedList: await this.getExcludedList(), version: chrome.runtime?.getManifest?.().version || 'unknown', exportDate: new Date().toISOString() };
  }
  static importConfiguration(data) { return this.mutate('import', data); }
  static importSettings(data) { return this.importConfiguration(data); }
  static async hasPendingPrivacyMigration() {
    const data = await chrome.storage.sync.get(['statistics', 'interaction_history', 'errorReports', 'userFeedback']);
    return Object.keys(data).length > 0;
  }
  static async getRecoveryData() { return chrome.storage.local.get(this.CONFIG_KEYS); }
  static restoreLocalSettings() { return this.mutate('restoreLocal'); }
  static async getStatistics() {
    const local = await chrome.storage.local.get(['statistics']);
    const statistics = local.statistics || {};
    const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return { totalActivations: count(statistics.totalActivations), todayUsage: statistics.lastUsedDate === new Date().toDateString() ? count(statistics.todayUsage) : 0,
      lastUsedDate: typeof statistics.lastUsedDate === 'string' ? statistics.lastUsedDate : null };
  }
  static recordActivation() { return this.mutate('activation'); }
  static recordDiagnostic() { return this.mutate('diagnostic'); }
  static migratePrivateData() { return this.mutate('privacy'); }
  /** An earlier acknowledgement was informational and is not consent. */
  static PRIVACY_NOTICE_VERSION = '2026-11-03-consent-v1';
  static async getPrivacyNoticeAck() {
    const { privacy_notice_ack } = await chrome.storage.local.get('privacy_notice_ack');
    return privacy_notice_ack ?? null;
  }
  static async acknowledgePrivacyNotice() {
    await chrome.storage.local.set({ privacy_notice_ack: this.PRIVACY_NOTICE_VERSION });
    return this.PRIVACY_NOTICE_VERSION;
  }
  static async hasPrivacyConsent() {
    try { return await this.getPrivacyNoticeAck() === this.PRIVACY_NOTICE_VERSION; }
    catch { return false; }
  }
  /**
   * Canonical JSON for equality checks. chrome.storage returns object keys in
   * sorted order, so a plain JSON.stringify comparison reports a false mismatch
   * between a value we built and the same value read back from storage.
   */
  static canonicalJSON(value) {
    if (Array.isArray(value)) return `[${value.map(item => this.canonicalJSON(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${this.canonicalJSON(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
  }
  static async migratePrivateDataNow() {
    const keys = ['statistics', 'interaction_history', 'errorReports', 'userFeedback'];
    const sync = await chrome.storage.sync.get(keys);
    const local = await chrome.storage.local.get([...keys, 'legacy_private_backup']);
    const present = keys.filter(key => Object.hasOwn(sync, key));
    const updates = {};
    const backup = { ...local.legacy_private_backup };
    for (const key of ['statistics', 'interaction_history']) {
      if (Object.hasOwn(sync, key)) backup['sync_' + key] = sync[key];
      if (Object.hasOwn(local, key) && (key === 'interaction_history' || (local.statistics?.sitesUnlocked || local.statistics?.siteStats))) backup['local_' + key] = local[key];
    }
    if (Object.keys(backup).length) updates.legacy_private_backup = backup;
    if (sync.statistics || local.statistics) {
      const old = local.statistics || sync.statistics;
      const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
      updates.statistics = { totalActivations: Math.max(count(local.statistics?.totalActivations), count(sync.statistics?.totalActivations)),
        todayUsage: count(old.todayUsage), lastUsedDate: typeof old.lastUsedDate === 'string' ? old.lastUsedDate : null };
    }
    // Never retain arbitrary payload fields, even in old local error records.
    if (Object.hasOwn(sync, 'errorReports') || Object.hasOwn(local, 'errorReports')) {
      const reports = [...(Array.isArray(sync.errorReports) ? sync.errorReports : []), ...(Array.isArray(local.errorReports) ? local.errorReports : [])];
      updates.errorReports = reports.slice(-10).map(report => {
        const entry = { code: report?.code === 'CONTENT_OPERATION_FAILED' ? report.code : 'LEGACY_ERROR', module: 'content' };
        if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(report?.timestamp)) entry.timestamp = report.timestamp;
        if (/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(report?.version)) entry.version = report.version;
        return entry;
      });
    }
    if (Object.hasOwn(sync, 'userFeedback') || Object.hasOwn(local, 'userFeedback')) updates.userFeedback = [];
    if (Object.keys(updates).length) {
      await chrome.storage.local.set(updates);
      const verified = await chrome.storage.local.get(Object.keys(updates));
      if (Object.keys(updates).some(key => this.canonicalJSON(verified[key]) !== this.canonicalJSON(updates[key]))) throw new Error('Local migration verification failed');
    }
    if (present.length) {
      const latest = await chrome.storage.sync.get(present);
      if (present.some(key => this.canonicalJSON(latest[key]) !== this.canonicalJSON(sync[key]))) throw new Error('Private data changed during migration; retry required');
      await chrome.storage.sync.remove(present);
    }
    if (Object.hasOwn(local, 'interaction_history')) await chrome.storage.local.remove('interaction_history');
  }
}
