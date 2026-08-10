/**
 * content.js 测试桩：与 injector-harness 同款 new Function 沙箱。
 * document.readyState='loading' 使文件末尾的自动实例化不触发；
 * setTimeout 桩永不触发回调，把 initializeManager 冻结在状态加载的重试等待点——
 * 实例字段（allowDefaultHandler 等）可用，后台初始化链不产生副作用与悬挂定时器。
 *
 * 可通过 messageUtils 注入自定义后台应答（如 GET_STATUS 返回排除态），
 * 用于驱动 handleUpdateStatus 等真实消息路径（DEBT-08 排除列表）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const contentSource = fs.readFileSync(path.join(rootDir, 'content/content.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(rootDir, 'utils/storage-utils.js'), 'utf8');

export function createCopyPasteManager({ messageUtils } = {}) {
  const warnings = [];
  const sandboxConsole = {
    log: () => {},
    debug: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => warnings.push(args.map(String).join(' '))
  };

  const window = {
    location: { href: 'https://example.com/', hostname: 'example.com' },
    addEventListener: () => {},
    // disableCopyPaste 的启停协议经 postMessage 通知 main world injector，桩为无操作
    postMessage: () => {}
  };
  const document = {
    readyState: 'loading',
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const MessageUtils = messageUtils || {
    MESSAGE_TYPES: { GET_STATUS: 'GET_STATUS' },
    sendToBackground: () => Promise.resolve({ success: false })
  };
  // 加载真实 StorageUtils：handleUpdateStatus 依赖其 STORAGE_KEYS 常量（静态属性不触达 chrome）
  const StorageUtils = new Function('chrome', `${storageSource}\nreturn StorageUtils;`)({});

  const factory = new Function(
    'window', 'document', 'location', 'console', 'chrome',
    'MessageUtils', 'StorageUtils', 'setTimeout', 'clearTimeout',
    `${contentSource}\nreturn CopyPasteManager;`
  );
  const CopyPasteManager = factory(
    window, document, window.location, sandboxConsole, {},
    MessageUtils, StorageUtils, () => 0, () => {}
  );

  return { CopyPasteManager, warnings };
}
