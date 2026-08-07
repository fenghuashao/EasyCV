/**
 * injector 健壮性回归测试（node:test，零依赖）
 * 防止 DEBT-03 R1 修复回退：道客巴巴实测页面会篡改全局 Map
 * （构造可用但 .has/.set 抛 TypeError），修复前该异常穿透进页面自身的
 * addEventListener 调用栈，炸断页面脚本块。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInjector } from './helpers/injector-harness.mjs';

// 道客巴巴实测形态：构造可用，但实例方法缺失（.has/.set 为 undefined，调用即 TypeError）
function TamperedMap() {}

test('页面篡改 Map 时，注册吞没路径不向页面抛异常', () => {
  const { registrations, EventTarget } = runInjector({ Map: TamperedMap });

  const target = new EventTarget();
  const restrictiveListener = function (e) { e.preventDefault(); };

  assert.doesNotThrow(() => {
    EventTarget.prototype.addEventListener.call(target, 'copy', restrictiveListener);
  });
  // 吞没决策仍然生效：限制性监听器不应进入原始注册通道
  assert.equal(registrations.length, 0);
});

test('Map 构造本身抛错时，injector 加载与拦截路径均不抛异常', () => {
  function ThrowingMap() { throw new TypeError('Map is disabled by page'); }

  const { registrations, EventTarget } = runInjector({ Map: ThrowingMap });

  assert.doesNotThrow(() => {
    EventTarget.prototype.addEventListener.call(
      new EventTarget(), 'copy', function (e) { e.preventDefault(); }
    );
  });
  assert.equal(registrations.length, 0);
});

test('非限制性监听器在 Map 被篡改时仍正常注册', () => {
  const { registrations, EventTarget } = runInjector({ Map: TamperedMap });

  const benign = function (e) { console.log(e.type); };
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'copy', benign);

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].args[1], benign);
});

test('isRestrictiveListener 检查出错时 fail-open（不吞）且告警只刷一次', () => {
  const { registrations, warnings, EventTarget } = runInjector({ Map: TamperedMap });

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
  assert.equal(registrations.length, 2);
  // 计数日志：只告警首次，避免刷屏
  assert.equal(
    warnings.filter(w => w.includes('failing open')).length,
    1
  );
});
