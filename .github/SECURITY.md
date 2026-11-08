# Security policy

## Reporting a vulnerability

Do not publish exploit details, sensitive page content, tokens or personal data in public issues or pull requests.

If the repository's [Security advisories page](https://github.com/fenghuashao/EasyCV/security/advisories) offers **Report a vulnerability**, use that private channel. Private vulnerability reporting was disabled when checked on 2026-11-08; this policy does not enable it. If the button is unavailable, open a minimal [issue](https://github.com/fenghuashao/EasyCV/issues/new) titled **Security contact request**, with no vulnerability details, to ask the maintainer to arrange a private channel.

Once a private channel is available, provide the affected version and installation source, browser and operating system, expected security boundary, impact, and a minimal reproduction using synthetic data. Test only on systems and pages you are authorized to use.

## Version information

Reports should identify the exact installed version or source commit. The source manifest and store package can differ; see the [distribution comparison](../docs/reports/2026-11/对外文档核对记录-2026-11-08.md). Historical acceptance reports do not establish that a current vulnerability is fixed. Older releases have no guaranteed backport schedule.

## Scope

Relevant reports include extension-origin access, message validation, page injection boundaries, settings import/export, unexpected data disclosure and dependency or packaging behavior. Ordinary website compatibility problems belong in the [bug report form](https://github.com/fenghuashao/EasyCV/issues/new?template=bug_report.yml). Data-handling disclosures are maintained in the [privacy policy](../PRIVACY.md).
