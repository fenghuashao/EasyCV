# Tests and fixtures

Run commands from the repository root with Node.js 22 or later. CI uses Node.js 24 on Ubuntu.

## Checks without a browser

```sh
npm ci
npm run lint
npm test
npm run docs:check
npm run package:quick
```

The unit suite uses Node.js's test runner and synthetic fixtures. `lint` checks syntax. Quick packaging builds in an ignored temporary directory and writes a ZIP plus a verification receipt; it does not publish anything.

## Controlled browser fixture

```sh
npm run build
npm run test:serve
```

Open [copy-paste.html](http://127.0.0.1:8931/test/fixtures/copy-paste.html) in the browser where the unpacked extension is loaded from `dist`. The fixture covers selection, clipboard restrictions, dynamic content, Shadow DOM and SPA behavior. Accept the data notice, record the settings used, and compare with the extension disabled. Check actual mouse/keyboard and clipboard behavior separately from script assertions.

The fixture moved from the repository root's `test-page.html` to `test/fixtures/copy-paste.html`. Old reports retain the URLs used when they ran.

## Browser automation

`npm run test:e2e` builds the extension and runs `test/e2e-extension.mjs` against the local fixture. Start the static server separately. The browser scripts require a separately installed Playwright module and an extension-capable Chromium executable:

- `PLAYWRIGHT_PATH`: absolute path to the Playwright module, resolvable by Node.js `require`.
- `CHROMIUM_PATH`: absolute path to a compatible Chromium executable.
- `TEST_PAGE_URL`: optional fixture URL; the default is the local URL above.

The current fallback paths in several scripts target a Windows installation. Set the environment variables for your own machine; these scripts are not included in CI and are not claimed to work on every browser or OS without setup. Playwright and browser downloads are intentionally not project dependencies.

| Path | Purpose |
| --- | --- |
| `test/unit` | Node.js regression tests and harnesses |
| `test/fixtures` | Controlled test pages |
| `test/helpers` | Shared browser-test helpers |
| `test/e2e-extension.mjs` | Main controlled-page browser regression |
| `test/*-regression.mjs` | Permission, state, privacy, language and popup browser checks |
| `test/real-sites` | Separately configured real-site investigations and historical output |

Never commit browser profiles, login state or private page data. The ignored `test/real-sites/.profile/` directory may be created by the real-site scripts; unit tests and documentation checks do not require it.

For acceptance scope, see the [test plan](../docs/testing/测试计划.md), [test cases](../docs/testing/测试用例.md) and [historical reports](../docs/reports/README.md). A passing unit suite or package check does not establish native browser, store upgrade or real-site acceptance.
