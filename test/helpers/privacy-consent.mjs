/** Accept the in-product notice in a disposable browser test profile. */
export async function acceptPrivacyConsent(context, extensionOrigin, beforeAccept) {
  const page = await context.newPage();
  try {
    await page.goto(`${extensionOrigin}/popup/popup.html`);
    const notice = page.locator('#privacyNotice');
    if (!await notice.count()) return; // Historical builds predate the notice.
    await page.waitForSelector('#privacyNotice:not([hidden]), .popup-main:not([hidden])');
    if (await notice.isVisible()) {
      if (beforeAccept) await beforeAccept(page);
      await page.locator('#privacyNoticeAckBtn').click();
      await page.waitForSelector('.popup-main:not([hidden])');
    }
  } finally {
    await page.close();
  }
}
