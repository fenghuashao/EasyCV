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

export function runInjector({ Map: MapImpl = Map } = {}) {
  const registrations = [];
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
  EventTarget.prototype.removeEventListener = function () {};

  function Event() {}
  Event.prototype.preventDefault = function () { eventMethodCalls.preventDefault.push(this); };
  Event.prototype.stopPropagation = function () { eventMethodCalls.stopPropagation.push(this); };
  Event.prototype.stopImmediatePropagation = function () { eventMethodCalls.stopImmediatePropagation.push(this); };

  function Element() {}
  Element.prototype.attachShadow = function () { return {}; };

  function MutationObserver() {}
  MutationObserver.prototype.observe = function () {};
  MutationObserver.prototype.disconnect = function () {};

  const window = {
    location: { href: 'https://example.com/' },
    addEventListener: () => {}
  };
  const document = {
    readyState: 'loading',
    documentElement: { dataset: {} },
    addEventListener: () => {}
  };

  const factory = new Function(
    'window', 'document', 'EventTarget', 'Event', 'Element',
    'MutationObserver', 'Node', 'CSSStyleSheet', 'Map', 'console',
    injectorSource
  );
  factory(
    window, document, EventTarget, Event, Element,
    MutationObserver, { ELEMENT_NODE: 1 }, function () {}, MapImpl, sandboxConsole
  );

  return { registrations, warnings, eventMethodCalls, EventTarget, Event, Element, window, document };
}
