# EasyCV User Guide

[简体中文](../用户使用手册.md) | [繁體中文](./zh-TW.md) | [日本語](./ja.md) | [English](./en.md)

This guide primarily describes **version 1.1.3 distributed through the Chrome Web Store**. On 2026-11-08, the store package's runtime files were found to match the current repository except for the manifest and localized extension descriptions; the repository's `manifest.json` still says 1.1.2. Other builds can behave differently even when they have the same version number. Check the version installed in your browser's extensions page. If you use 1.1.1, also read [Older version](#older-version).

## What EasyCV does

EasyCV helps with some restrictions on text selection, copying, pasting and the context menu on regular web pages. It offers a global switch, separate copy and paste controls, Force Mode, auto-enable rules and site exclusions. Results depend on the website: the extension cannot guarantee success on every site or recognize text in images or scans.

## Installation and language

1. Open the [EasyCV listing in the Chrome Web Store](https://chromewebstore.google.com/detail/bnbmgiidicjdbnmkmdnjeelhijnlhnjb) and follow the installation prompts. You can also install it from the store in a compatible version of Edge; follow the browser's prompts.
2. Find EasyCV in the browser's extensions menu and pin it to the toolbar if useful. Refresh regular pages that were already open when you installed it.
3. The interface follows the browser's language and supports English, Simplified Chinese, Traditional Chinese and Japanese. Unsupported languages fall back to English. After changing the browser language, restart as prompted and reopen the extension page.

To load the repository source, enable developer mode at `chrome://extensions/` in Chrome or `edge://extensions/` in Edge, choose “Load unpacked”, and select the folder containing `manifest.json`. Loading source is not a store installation or an upgrade test.

## Getting started

1. Click the EasyCV icon and read the data notice. Page features and legacy-data migration start only after you select “I agree”. “Not now” closes the window so you can decide later.
2. Open a regular web page and click the icon to see its state. The main button controls the global switch; under “Advanced Options” you can adjust “Unlock Copy”, “Unlock Paste” and “Force Mode” separately. These switches affect multiple pages; site rules and exclusions also affect the current page.
3. Return to the page, select text, and actually copy and paste it into your destination. An enabled status describes the switches; it does not guarantee that copying succeeds.
4. “Help” opens the built-in quick guide. “Check Copy Status” reads the state only; it does not read or write the clipboard or test an actual copy.

## Site rules and exclusions

- **Auto-enable rules:** Open “Settings → Auto-Unlock Sites”, enter a domain, choose copy and/or paste, and select “Add”. Rules in the list can be edited, saved or deleted. A plain domain such as `example.com` matches that domain; `*.example.com` matches subdomains, not the root domain. The rule overrides the site's copy and paste defaults, but cannot override the global switch or an exclusion. You can also use “Add to Auto-Enable” on the current page.
- **Site exclusions:** If the extension affects a site's normal features, open “Settings → Site Exclusions”, enter the domain and select “Add”. Excluding `example.com` also covers its subdomains. Exclusions take precedence over auto-enable rules and Force Mode. The default list contains `accounts.google.com`, `login.live.com` and `appleid.apple.com`; you can remove them.
- **Force Mode:** Try it under “Advanced Options” if normal mode does not help. It may affect page interactions; if problems occur, turn it off, or exclude the site and refresh the page.

## Data and permissions

Settings and manually configured site rules may be synchronized through your browser account, including the domains you enter. Activation counts and minimal diagnostics are stored on the device; counts are not successful-copy counts. Local activation counting is enabled by default and can be turned off in “Settings → Advanced”. Legacy data may be migrated into a local backup after consent. The [privacy policy](../../PRIVACY.md#easycv-privacy-policy) explains the details, differences for 1.1.1 and limits on deletion.

Version 1.1.3 uses `storage` for settings and data, `contextMenus` for context-menu actions, and the `<all_urls>` website access scope to match rules and provide the core features on regular pages. It does not request clipboard read or write permissions. Website access does not make protected browser pages available.

Under “Settings → Advanced” you can export or import configuration. The export contains settings and manual site rules, but not legacy visit history or diagnostics; it can contain domains, so keep it secure. “Clear All Data” clears the extension's settings, rules, counts, diagnostics and legacy backups on this device, as well as its synchronized storage and consent record. Copies on other devices and in the browser's cloud remain subject to its synchronization behavior. Export any configuration you need to keep first.

## Frequently asked questions

**Copy or paste still does not work?** Confirm that you agreed to the data notice; check the global and relevant feature switches, site exclusions and the browser's site-access settings, then refresh and retry. Try Force Mode if needed. Protected pages such as browser pages and the Chrome Web Store are unsupported, and the extension cannot resolve every site's restrictions or extract text from images and scans.

**A website behaves incorrectly after enabling EasyCV?** Turn off Force Mode or add the site to Site Exclusions, then refresh. An exclusion covers the specified domain and its subdomains.

**Formatting changes when I copy?** The result depends on the website and destination application; EasyCV does not guarantee preservation of formatting.

**What do the statistics mean?** They count local activation operations, not successful copies or a success rate. Turning counting off does not erase existing counts.

**How do I uninstall?** Find EasyCV in your browser's extensions page, select “Remove” and confirm. Synced data and copies on other devices remain subject to the browser's own behavior.

## Older version

Version 1.1.1 offers Simplified Chinese and English, and its data handling and permissions differ from 1.1.3. It may store legacy site interactions, statistics and error details in browser sync storage. Its feedback button can put the current page address, browser information and time into a GitHub URL; GitHub may receive them when the link is opened, even without submission. Avoid that button on sensitive pages and use the Issues link below directly. The [privacy policy](../../PRIVACY.md#version-111) describes legacy data and migration after upgrading.

## Get help

- [Report a problem or suggestion](https://github.com/fenghuashao/EasyCV/issues): include the extension and browser versions, steps and actual result; supply website details and screenshots only as needed. Remove accounts, tokens, private content and sensitive URL parameters before submitting.
- In 1.1.3, the popup's “Feedback” opens a GitHub issue draft with the extension version and a blank template. It does not submit automatically or attach the current page address.
- [Changelog](../changelog/en.md) · [Source repository](https://github.com/fenghuashao/EasyCV)

Follow applicable laws and site terms, and respect content owners' rights.
