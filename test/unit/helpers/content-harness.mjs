/**
 * content.js 测试桩：与 injector-harness 同款 new Function 沙箱。
 * document.readyState='loading' 使文件末尾的自动实例化不触发；
 * setTimeout 桩永不触发回调，把 initializeManager 冻结在状态加载的重试等待点——
 * 实例字段（allowDefaultHandler 等）可用，后台初始化链不产生副作用与悬挂定时器。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const contentSource = fs.readFileSync(path.join(rootDir, 'content/content.js'), 'utf8');

export function createCopyPasteManager() {
  const warnings = [];
  const sandboxConsole = {
    log: () => {},
    debug: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => warnings.push(args.map(String).join(' '))
  };

  const window = {
    location: { href: 'https://example.com/' },
    addEventListener: () => {}
  };
  const document = {
    readyState: 'loading',
    addEventListener: () => {}
  };
  const MessageUtils = {
    MESSAGE_TYPES: { GET_STATUS: 'GET_STATUS' },
    sendToBackground: () => Promise.resolve({ success: false })
  };

  const factory = new Function(
    'window', 'document', 'location', 'console', 'chrome',
    'MessageUtils', 'setTimeout', 'clearTimeout',
    `${contentSource}\nreturn CopyPasteManager;`
  );
  const CopyPasteManager = factory(
    window, document, window.location, sandboxConsole, {},
    MessageUtils, () => 0, () => {}
  );

  return { CopyPasteManager, warnings };
}
