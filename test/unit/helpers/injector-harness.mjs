/**
 * injector 测试桩：以 new Function 参数遮蔽全局（Map/window/document/...），
 * 用最小 DOM 桩运行 injector IIFE，返回桩对象便于断言。
 * document.readyState='loading' 使 initializeInjector 不执行，把测试面收窄到拦截路径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const injectorSource = fs.readFileSync(path.join(rootDir, 'content/injector.js'), 'utf8');

export function runInjector({ Map: MapImpl = Map, copyEnabled = true, pasteEnabled = true, nodes = [] } = {}) {
  const registrations = [];
  const removals = [];
  const observers = [];
  const styles = [];
  const warnings = [];
  const eventMethodCalls = { preventDefault: [], stopPropagation: [], stopImmediatePropagation: [] };

  const sandboxConsole = {
    log: () => {},
    debug: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => warnings.push(args.map(String).join(' '))
  };

  function EventTarget() {}
  EventTarget.prototype.addEventListener = function (...args) {
    registrations.push({ target: this, args });
  };
  EventTarget.prototype.removeEventListener = function (...args) { removals.push({ target: this, args }); };

  function Event() {}
  Event.prototype.preventDefault = function () { eventMethodCalls.preventDefault.push(this); };
  Event.prototype.stopPropagation = function () { eventMethodCalls.stopPropagation.push(this); };
  Event.prototype.stopImmediatePropagation = function () { eventMethodCalls.stopImmediatePropagation.push(this); };

  function Element() {}
  Element.prototype.attachShadow = function () { return {}; };

  function MutationObserver(callback) { this.callback = callback; observers.push(this); }
  MutationObserver.prototype.observe = function () {};
  MutationObserver.prototype.disconnect = function () { this.disconnected = true; };

  const window = {
    location: { href: 'https://example.com/' },
    postMessage() {},
    addEventListener(type, listener) { if (type === 'message') this.receiveMessage = listener; }
  };
  const document = {
    querySelectorAll: selector => selector.startsWith('style') ? styles : nodes,
    querySelector: () => null,
    createElement: () => ({ setAttribute() {}, remove() { const i = styles.indexOf(this); if (i >= 0) styles.splice(i, 1); } }),
    head: { appendChild(style) { styles.push(style); } },
    body: {},
    readyState: 'loading',
    documentElement: { dataset: { easycvCopyEnabled: copyEnabled ? '1' : '0', easycvPasteEnabled: pasteEnabled ? '1' : '0' } },
    addEventListener: () => {}
  };

  const factory = new Function(
    'window', 'document', 'EventTarget', 'Event', 'Element',
    'MutationObserver', 'Node', 'CSSStyleSheet', 'Map', 'console',
    injectorSource
  );
  factory(
    window, document, EventTarget, Event, Element,
    MutationObserver, { ELEMENT_NODE: 1 }, function () { this.replaceSync = () => {}; }, MapImpl, sandboxConsole
  );

  return { registrations, removals, observers, styles, warnings, eventMethodCalls, EventTarget, Event, Element, window, document };
}
