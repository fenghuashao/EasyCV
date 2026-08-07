/**
 * injector 健壮性回归测试（node:test，零依赖）
 * 防止 DEBT-03 R1 修复回退：道客巴巴实测页面会篡改全局 Map
 * （构造可用但 .has/.set 抛 TypeError），修复前该异常穿透进页面自身的
 * addEventListener 调用栈，炸断页面脚本块。
 *
 * 注入方式：以 new Function 参数遮蔽全局（Map/window/document/...），
 * 用最小 DOM 桩运行 injector IIFE，再直接调用被重写的原型方法触发拦截路径。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const injectorSource = fs.readFileSync(path.join(rootDir, 'content/injector.js'), 'utf8');

/** 以参数遮蔽全局的方式运行 injector，返回桩对象便于断言 */
function runInjector({ Map: MapImpl }) {
  const recordings = [];
  const warnings = [];

  const sandboxConsole = {
    log: () => {},
    debug: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => warnings.push(args.map(String).join(' '))
  };

  function EventTarget() {}
  EventTarget.prototype.addEventListener = function (...args) {
    recordings.push({ target: this, args });
  };
  EventTarget.prototype.removeEventListener = function () {};

  function Event() {}
  Event.prototype.preventDefault = function () {};
  Event.prototype.stopPropagation = function () {};
  Event.prototype.stopImmediatePropagation = function () {};

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
    readyState: 'loading', // 跳过 initializeInjector，把测试面收窄到拦截路径
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

  return { recordings, warnings, EventTarget, window };
}

// 道客巴巴实测形态：构造可用，但实例方法缺失（.has/.set 为 undefined，调用即 TypeError）
function TamperedMap() {}

test('页面篡改 Map 时，注册吞没路径不向页面抛异常', () => {
  const { recordings, EventTarget } = runInjector({ Map: TamperedMap });

  const target = new EventTarget();
  const restrictiveListener = function (e) { e.preventDefault(); };

  assert.doesNotThrow(() => {
    EventTarget.prototype.addEventListener.call(target, 'copy', restrictiveListener);
  });
  // 吞没决策仍然生效：限制性监听器不应进入原始注册通道
  assert.equal(recordings.length, 0);
});

test('Map 构造本身抛错时，injector 加载与拦截路径均不抛异常', () => {
  function ThrowingMap() { throw new TypeError('Map is disabled by page'); }

  const { recordings, EventTarget } = runInjector({ Map: ThrowingMap });

  assert.doesNotThrow(() => {
    EventTarget.prototype.addEventListener.call(
      new EventTarget(), 'copy', function (e) { e.preventDefault(); }
    );
  });
  assert.equal(recordings.length, 0);
});

test('非限制性监听器在 Map 被篡改时仍正常注册', () => {
  const { recordings, EventTarget } = runInjector({ Map: TamperedMap });

  const benign = function (e) { console.log(e.type); };
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'copy', benign);

  assert.equal(recordings.length, 1);
  assert.equal(recordings[0].args[1], benign);
});

test('isRestrictiveListener 检查出错时 fail-open（不吞）且告警只刷一次', () => {
  const { recordings, warnings, EventTarget } = runInjector({ Map: TamperedMap });

  const makeThrowingListener = () => {
    const fn = function () {};
    Object.defineProperty(fn, 'toString', {
      value: () => { throw new Error('tampered toString'); }
    });
    return fn;
  };

  EventTarget.prototype.addEventListener.call(new EventTarget(), 'copy', makeThrowingListener());
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'copy', makeThrowingListener());

  // fail-open：两个监听器都进入原始注册通道
  assert.equal(recordings.length, 2);
  // 计数日志：只告警首次，避免刷屏
  assert.equal(
    warnings.filter(w => w.includes('failing open')).length,
    1
  );
});
