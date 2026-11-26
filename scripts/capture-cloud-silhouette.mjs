/* Optional visual QA tool; Playwright is not a website dependency.
 * PLAYWRIGHT_MODULE may point to an external Playwright installation.
 * CHROME_PATH may select an installed Chrome instead of bundled Chromium.
 * BASE_URL defaults to the running dev server. Reduce motion freezes the volume.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const loadModule = createRequire(import.meta.url);
const { chromium } = loadModule(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const output = path.resolve(process.argv[2] || "/tmp/cloud-silhouette.png");
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    args: ["--enable-webgl", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.BASE_URL || "http://localhost:3000");
    await page.waitForSelector('[data-cloud-ready="true"]');
    await page.getByRole("button", { name: "Silhouette", exact: true }).click();
    await page.waitForFunction(
      () =>
        Number(document.querySelector("canvas")?.dataset.cloudViewHeight) > 0,
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const canvas = page.locator("canvas");
    await canvas.screenshot({ path: output });
    const viewHeight = Number(
      await canvas.getAttribute("data-cloud-view-height"),
    );
    if (errors.length) throw new Error(errors.join("\n"));
    fs.writeFileSync(
      output + ".json",
      JSON.stringify({ viewHeight, errors }, null, 2),
    );
    console.log(JSON.stringify({ output, viewHeight }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
