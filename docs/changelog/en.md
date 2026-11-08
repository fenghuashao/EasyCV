# EasyCV Changelog

[简体中文](../../CHANGELOG.md) | [繁體中文](./zh-TW.md) | [日本語](./ja.md) | [English](./en.md)

This is a user-facing summary. The [Simplified Chinese changelog](../../CHANGELOG.md) retains more detailed engineering and test history.

## 1.1.3 — store update 2026-11-04

- Adds an in-product data notice and requires consent before page features or legacy-data migration begin.
- Supports English, Simplified Chinese, Traditional Chinese and Japanese; unsupported browser languages fall back to English.
- Shows page state more accurately and adds a built-in help panel. “Check Copy Status” checks settings, not the clipboard or actual copy success.
- Adds site-rule editing with save and cancel, stronger settings import validation, local recovery and migration notices, and clearer save errors. Exclusions and the global switch take priority over auto-enable rules.
- Keeps activation counts and minimal diagnostics on the device instead of adding domain-based visit records; historical data is handled as described in the [privacy policy](../../PRIVACY.md#easycv-privacy-policy).
- Opens a GitHub issue draft for feedback without automatically including the current page address or submitting the issue.
- Improves restoration of page handlers and styles after disabling features, and stops page intervention when the extension cannot confirm the state.

The store package was checked on 2026-11-08. Its runtime files match the repository except for the manifest and localized extension descriptions; the repository manifest still says 1.1.2. Store version status does not by itself establish that a particular installation has upgraded.

## 1.1.2 — local candidate, 2026-11-01 and 2026-11-03

- Removed the unused `scripting` and redundant `activeTab` permissions from the candidate; kept `storage`, `contextMenus` and `<all_urls>`.
- Fixed synchronization of popup switches with existing pages, site rules on first visit, and Force Mode persistence. Restored page handlers and styles when features are turned off.
- The 1.1.2 entries describe local candidate packages and their tests, not proof of a 1.1.2 store release or a same-ID upgrade.

## 1.1.1 — 2026-08-31

- Connected the About page to the repository, issue tracker and user documentation, and made the repository and Wiki public.
- Reduced debug logging, corrected the version shown in exported settings, and made the popup check and display the current page promptly.
- Updated real-site regression infrastructure and replaced older results that had been affected by the test environment.

## 1.1.0 — 2026-08-10

- Added site exclusions, including editable default exclusions for common account sign-in domains; exclusions cover subdomains and are included in settings export and import.
- Updated the popup and auto-enable management, added English and Simplified Chinese localization, and improved support for Shadow DOM and single-page navigation.
- Narrowed event interception to reduce interference with normal page interactions, fixed historical message, state restoration and storage problems, and added state icons and project checks.

For installation, limitations and data handling, see the [user guide](../user-guide/en.md) and [privacy policy](../../PRIVACY.md#easycv-privacy-policy).
