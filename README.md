# EasyCV

![EasyCV icon](./icons/icon-default-128.png)

A browser extension that helps restore **text selection, copy, paste and context menus** on supported web pages. Results depend on the website.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/bnbmgiidicjdbnmkmdnjeelhijnlhnjb) · [User guides](#user-guides) · [Report a problem](https://github.com/fenghuashao/EasyCV/issues/new/choose) · [Contribute](./.github/CONTRIBUTING.md)

EasyCV 协助处理网页的文字选择、复制、粘贴和右键菜单限制，支持简体中文、繁體中文、日本語和 English。

## Features

- Global enable switch and separate copy and paste controls.
- Force Mode for pages that need additional restriction handling.
- Auto-enable rules and per-site exclusions.
- Interface language follows the browser, with English fallback.

Use the extension on content you are authorized to access. It cannot recognize text in images or scans, and behavior varies across websites and browser-protected pages. Read the [privacy policy](./PRIVACY.md#easycv-privacy-policy) for consent, synchronized settings and local data handling.

## User guides

| Language | User guide | Privacy policy | Changelog |
| --- | --- | --- | --- |
| English | [User guide](./docs/user-guide/en.md) | [Privacy policy](./PRIVACY.md#easycv-privacy-policy) | [Changelog](./docs/changelog/en.md) |
| 简体中文 | [使用手册](./docs/用户使用手册.md) | [隐私政策](./PRIVACY.md#easycv-隐私政策) | [更新日志](./CHANGELOG.md) |
| 繁體中文 | [使用手冊](./docs/user-guide/zh-TW.md) | [隱私權政策](./docs/privacy/zh-TW.md) | [更新紀錄](./docs/changelog/zh-TW.md) |
| 日本語 | [ユーザーガイド](./docs/user-guide/ja.md) | [プライバシーポリシー](./docs/privacy/ja.md) | [更新履歴](./docs/changelog/ja.md) |

**Version scope:** the user guides describe the store's **1.1.3** package checked on **2026-11-08**. The source manifest in this repository currently says **1.1.2**. Check the version installed in your browser; see the [distribution comparison](./docs/reports/2026-11/对外文档核对记录-2026-11-08.md) for details.

**版本范围：** 使用手册以 2026-11-08 核对的商店 1.1.3 包为准，源码 manifest 当前为 1.1.2。请按浏览器中实际安装的版本阅读说明。

## Build from source

Use Node.js 22 or later (`.nvmrc` selects 24), then run:

```sh
npm ci
npm run build
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist`. Accept the data notice and refresh your test page. A local build uses the source manifest version.

```sh
npm run lint        # JavaScript syntax
npm test            # Node.js tests
npm run docs:check  # Documentation links and references
npm run package:quick # Isolated development ZIP and verification receipt
```

See [Contributing](./.github/CONTRIBUTING.md) for the development workflow and [test/README](./test/README.md) for browser checks. Building or packaging locally does not submit a store release.

## Repository layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 entry points and permissions |
| `background/`, `content/` | Extension background logic and page scripts |
| `popup/`, `options/`, `utils/` | Interface and shared utilities |
| `_locales/`, `icons/` | Four language resources and extension icons |
| `scripts/` | Build, package, version and maintenance tools |
| `test/` | Unit tests, browser scripts and controlled fixtures |
| `docs/` | User guides, development, testing, release and historical records |
| `.github/` | Contribution policies, issue/PR templates, CI and dependency updates |

The runtime paths remain at the root so the manifest, browser loading and package checks share the same structure. Generated builds and archives are ignored by Git. Start with the [documentation index](./docs/README.md) for the full document map.

## Community and license

[Support](./.github/SUPPORT.md) · [Contributing](./.github/CONTRIBUTING.md) · [Code of conduct](./.github/CODE_OF_CONDUCT.md) · [Security policy](./.github/SECURITY.md)

Licensed under the [MIT License](./LICENSE).
