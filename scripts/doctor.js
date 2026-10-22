import { chromium } from 'playwright';
import sharp from 'sharp';

let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.FIDELITY_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 320, height: 200 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><title>Fidelity doctor</title><body style="margin:0;background:#fff">Browser ready</body>');
  const bytes = await page.screenshot({ scale: 'css' });
  const image = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (image.info.width !== 320 || image.info.height !== 200 || image.info.channels !== 4) throw Error('Screenshot decode returned unexpected dimensions');
  console.log(JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, node: process.version, executable: process.execPath, chromium: browser.version(), sharp: sharp.versions.sharp, screenshot: { width: image.info.width, height: image.info.height } }, null, 2));
} catch (error) {
  console.error(`Doctor failed: ${error.message}\nInstall dependencies with npm ci and the browser with npm run setup, then retry npm run doctor.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
