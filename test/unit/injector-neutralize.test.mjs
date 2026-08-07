/**
 * injector 拦截名单拆分回归测试（DEBT-03 R2，node:test，零依赖）
 * 锁定两份名单的行为边界：
 *  - 注册吞没名单只保留纯限制向事件（selectstart/contextmenu/dragstart/copy/cut/paste）
 *  - 运行时中和名单在其上增加 mousedown/keydown/keyup，且 keydown/keyup 仅组合键时中和、
 *    mousedown 豁免输入域目标、mouseup 彻底退出
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInjector } from './helpers/injector-harness.mjs';

test('注册吞没名单收窄：keydown/mousedown/mouseup 不再被吞，copy/selectstart 仍吞没', () => {
  const { registrations, EventTarget } = runInjector();
  const restrictive = function (e) { e.preventDefault(); };

  EventTarget.prototype.addEventListener.call(new EventTarget(), 'keydown', restrictive);
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'mousedown', restrictive);
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'mouseup', restrictive);
  assert.equal(registrations.length, 3);

  EventTarget.prototype.addEventListener.call(new EventTarget(), 'copy', restrictive);
  EventTarget.prototype.addEventListener.call(new EventTarget(), 'selectstart', restrictive);
  assert.equal(registrations.length, 3);
});

test('keydown/keyup 仅组合键（ctrl/meta）时中和 preventDefault', () => {
  const { eventMethodCalls, Event } = runInjector();

  Event.prototype.preventDefault.call({ type: 'keydown', ctrlKey: true }); // 中和（Ctrl+C 封锁场景）
  Event.prototype.preventDefault.call({ type: 'keydown', metaKey: true }); // 中和
  Event.prototype.preventDefault.call({ type: 'keydown' });                // 放行（播放器空格/方向键）
  Event.prototype.preventDefault.call({ type: 'keyup' });                  // 放行
  Event.prototype.preventDefault.call({ type: 'keyup', ctrlKey: true });   // 中和

  assert.equal(eventMethodCalls.preventDefault.length, 2);
  assert.deepEqual(
    eventMethodCalls.preventDefault.map(e => `${e.type}:${Boolean(e.ctrlKey || e.metaKey)}`),
    ['keydown:false', 'keyup:false']
  );
});

test('mousedown 中和但豁免输入域目标（input/textarea/contenteditable）', () => {
  const { eventMethodCalls, Event } = runInjector();

  Event.prototype.preventDefault.call({ type: 'mousedown', target: { closest: () => null } }); // 中和
  Event.prototype.preventDefault.call({ type: 'mousedown', target: { closest: () => ({}) } }); // 输入域，放行
  Event.prototype.preventDefault.call({ type: 'mousedown', target: null });                    // 中和
  Event.prototype.preventDefault.call({ type: 'mousedown', target: {} });                      // 无 closest，中和

  assert.equal(eventMethodCalls.preventDefault.length, 1);
  // 唯一放行的应是输入域目标
  assert.ok(eventMethodCalls.preventDefault[0].target.closest());
});

test('contextmenu/copy 仍中和，mouseup 彻底退出中和名单', () => {
  const { eventMethodCalls, Event } = runInjector();

  Event.prototype.preventDefault.call({ type: 'contextmenu' }); // 中和
  Event.prototype.preventDefault.call({ type: 'copy' });        // 中和
  Event.prototype.preventDefault.call({ type: 'mouseup' });     // 放行

  assert.equal(eventMethodCalls.preventDefault.length, 1);
  assert.equal(eventMethodCalls.preventDefault[0].type, 'mouseup');
});

test('stopPropagation/stopImmediatePropagation 走同一中和门控', () => {
  const { eventMethodCalls, Event } = runInjector();

  Event.prototype.stopPropagation.call({ type: 'copy' });           // 中和
  Event.prototype.stopPropagation.call({ type: 'keydown' });        // 放行（无组合键）
  Event.prototype.stopImmediatePropagation.call({ type: 'paste' }); // 中和

  assert.equal(eventMethodCalls.stopPropagation.length, 1);
  assert.equal(eventMethodCalls.stopImmediatePropagation.length, 0);
});

test('中和判断零异常：target getter 抛错时 fail-open 放行', () => {
  const { eventMethodCalls, Event } = runInjector();

  const evil = { type: 'mousedown', get target() { throw new Error('tampered'); } };
  assert.doesNotThrow(() => Event.prototype.preventDefault.call(evil));
  assert.equal(eventMethodCalls.preventDefault.length, 1);
});
