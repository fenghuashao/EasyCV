/**
 * R3 回归：allowDefaultHandler 仅对 contextmenu 阻断传播（防双菜单取舍，
 * 见 docs/测试报告-真实站点回归-2026-08.md R3）；其余事件必须放行到站点
 * 目标阶段处理器——全量阻断曾误伤 B站快捷键等正常交互。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopyPasteManager } from './helpers/content-harness.mjs';

function fakeEvent(type) {
  let propagationStopped = false;
  return {
    type,
    stopPropagation() { propagationStopped = true; },
    get propagationStopped() { return propagationStopped; }
  };
}

test('allowDefaultHandler 对 contextmenu 阻断传播', () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const manager = new CopyPasteManager();

  const event = fakeEvent('contextmenu');
  assert.equal(manager.allowDefaultHandler(event), true);
  assert.equal(event.propagationStopped, true);
});

test('allowDefaultHandler 对其余事件放行传播', () => {
  const { CopyPasteManager } = createCopyPasteManager();
  const manager = new CopyPasteManager();

  for (const type of ['selectstart', 'dragstart', 'copy', 'paste', 'mousedown', 'keydown']) {
    const event = fakeEvent(type);
    assert.equal(manager.allowDefaultHandler(event), true);
    assert.equal(event.propagationStopped, false, `${type} 不应被阻断传播`);
  }
});
