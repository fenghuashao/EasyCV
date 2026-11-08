# Contributing to EasyCV

Bug reports, translations, documentation improvements and focused patches are welcome. You may write issues and pull requests in English, 简体中文, 繁體中文 or 日本語. Technical reference documents are currently mostly in Simplified Chinese.

## Before you start

- Search [existing issues](https://github.com/fenghuashao/EasyCV/issues) before opening a new one.
- For a larger feature or a change to permissions, storage or injection behavior, describe the proposal in an issue first.
- Read the [code of conduct](./CODE_OF_CONDUCT.md). Report suspected vulnerabilities through the [security policy](./SECURITY.md).

## Local development

Use Node.js 22 or later; `.nvmrc` selects Node.js 24, which is also used by CI. Run these commands from the repository root:

```sh
npm ci
npm run build
```

Open `chrome://extensions` in Chrome or `edge://extensions` in Edge, enable Developer mode, select **Load unpacked**, and choose the generated `dist` directory. Accept the extension's data notice before testing, then refresh your test page. Reload the extension and rebuild after changing source files.

The source manifest is currently 1.1.2. User guides describe the store's 1.1.3 package checked on 2026-11-08; see the [comparison record](../docs/reports/2026-11/对外文档核对记录-2026-11-08.md). State which build you used in every report.

## Checks

```sh
npm run lint
npm test
npm run docs:check
npm run build
```

`lint` checks JavaScript syntax; it is not a full style or security audit. `npm test` runs Node.js tests. CI runs these checks on Ubuntu with Node.js 24; it does not establish native browser or store acceptance.

For a manual test page, run `npm run test:serve`, then open [the copy/paste fixture](http://127.0.0.1:8931/test/fixtures/copy-paste.html). The [test directory guide](../test/README.md) explains the separate browser scripts and their environment requirements. Browser automation is optional for documentation-only changes.

## Keep patches focused

- Preserve the runtime paths declared by `manifest.json`; see the [repository layout](../docs/README.md).
- Follow the [coding conventions](../docs/development/代码规范文档.md). Add or update tests when behavior changes.
- Update the relevant architecture, API, testing or release document when its behavior changes.
- When user-facing behavior changes, check all four language resources and user guides. Keep privacy disclosures consistent with the actual data flow.
- Keep reports under `docs/reports` and raw verification output under `docs/evidence`. Reports describe their recorded date and build; do not rewrite historical results as current acceptance.
- Exclude generated builds, archives, browser profiles, cookies, tokens and personal browsing data from commits. Use synthetic examples and redact reports.

Use a descriptive pull request title, explain the problem and resulting behavior, and list checks actually run. Mention anything that remains unverified. Commit messages follow `type(scope): summary`, for example `docs(readme): clarify installation`.

Changes to version numbers, permissions, releases and Chrome Web Store submission require separate maintainer review. Local builds and passing CI do not publish the extension.

Contributions use the repository's [MIT license](../LICENSE).
