import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const languages = { en: 'en', zh_CN: 'zh-CN', ja: 'ja', zh_TW: 'zh-TW' };
const catalogs = Object.fromEntries(Object.keys(languages).map(locale =>
  [locale, JSON.parse(read(`_locales/${locale}/messages.json`))]));
const tokens = message => [...message.matchAll(/\$([a-z0-9_]+)\$/gi)].map(m => m[1].toLowerCase()).sort();
const substitutions = entry => Object.fromEntries(Object.entries(entry.placeholders || {})
  .map(([key, value]) => [key, value.content]));

test('English is the native Chrome fallback; only the four approved locales ship', () => {
  assert.equal(JSON.parse(read('manifest.json')).default_locale, 'en');
  assert.deepEqual(fs.readdirSync(path.join(root, '_locales')).sort(), Object.keys(languages).sort());
});

for (const [locale, catalog] of Object.entries(catalogs)) {
  test(`${locale}: complete messages, matching placeholders and valid language metadata`, () => {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(catalogs.en).sort());
    assert.equal(catalog.ui_language.message, languages[locale]);
    assert.ok(catalog.extension_name.message.length <= 75);
    assert.ok(catalog.extension_description.message.length <= 132);
    for (const [key, entry] of Object.entries(catalog)) {
      assert.ok(typeof entry.message === 'string' && entry.message.trim(), `${locale}:${key} empty`);
      assert.ok(!entry.message.includes('\uFFFD'), `${locale}:${key} encoding damage`);
      assert.deepEqual(tokens(entry.message), tokens(catalogs.en[key].message), `${locale}:${key} tokens`);
      assert.deepEqual(substitutions(entry), substitutions(catalogs.en[key]), `${locale}:${key} substitutions`);
      for (const token of tokens(entry.message)) assert.ok(entry.placeholders?.[token], `${key}:${token}`);
    }
  });
}

test('All static HTML/JS/manifest message references exist in the English fallback', () => {
  const scan = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? scan(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  const files = ['manifest.json', ...['popup', 'options', 'background', 'utils', 'content'].flatMap(scan)];
  for (const file of files.filter(name => /\.(js|html|json)$/.test(name))) {
    const text = read(file);
    const refs = [
      ...text.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g),
      ...text.matchAll(/(?:I18nUtils\.t|chrome\.i18n\.getMessage)\(\s*['"]([^'"]+)['"]/g),
      ...text.matchAll(/__MSG_(\w+)__/g)
    ];
    for (const [, key] of refs) assert.ok(catalogs.en[key], `${file}: missing ${key}`);
  }
});

function harness(messages) {
  const attributes = {};
  const document = { documentElement: {}, querySelectorAll: selector => selector === '[data-i18n-aria-label]'
    ? [{ getAttribute: () => 'close_notification', setAttribute: (key, value) => { attributes[key] = value; } }]
    : [] };
  const chrome = { i18n: { getMessage: key => messages[key] || '', getUILanguage: () => 'ar' } };
  const I18nUtils = new Function('chrome', 'document', 'console', `${read('utils/i18n-utils.js')};return I18nUtils;`)(
    chrome, document, { warn() {} });
  return { I18nUtils, document, attributes };
}

test('Document language and accessible labels follow the resolved catalog, not unsupported browser locale', () => {
  for (const catalog of Object.values(catalogs)) {
    const h = harness(Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, value.message])));
    h.I18nUtils.applyToPage();
    assert.equal(h.document.documentElement.lang, catalog.ui_language.message);
    assert.equal(h.document.documentElement.dir, 'ltr');
    assert.equal(h.attributes['aria-label'], catalog.close_notification.message);
  }
});

test('Missing language metadata falls back to English without erasing an existing accessible label', () => {
  const h = harness({});
  h.attributes['aria-label'] = 'Close notification';
  h.I18nUtils.applyToPage();
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.attributes['aria-label'], 'Close notification');
});
