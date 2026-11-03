/* Render the repo-native SVG at installation sizes. Original Gon art is embedded
   only while rendering; no generated face or bitmap retouching is involved.
   Run: node tools/render-hunter-icons.mjs (CHROMIUM may select your browser). */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('src/assets/hunter/hxh-gon-icon.svg', root), 'utf8');
const art = readFileSync(new URL('src/assets/hunter/characters/gon.png', root)).toString('base64');
const svg = source.replace('href="characters/gon.png"', `href="data:image/png;base64,${art}"`);
const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = process.env.CHROMIUM || (existsSync(edge) ? edge : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  let full;
  for (const size of [32, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:#0b292e}img{display:block}</style><img id="icon" width="${size}" height="${size}" src="${url}">`);
    await page.locator('#icon').evaluate((img) => img.decode());
    const png = await page.locator('#icon').screenshot({ type: 'png' });
    writeFileSync(new URL(`public/icons/hxh-gon-${size}.png`, root), png);
    if (size === 512) full = png;
  }
  writeFileSync(new URL('public/icons/hxh-gon-maskable-512.png', root), full);
  // Standalone favicon SVGs cannot fetch external images. Embed the rendered icon.
  const standalone = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>H×H · Gon</title><image width="512" height="512" href="data:image/png;base64,${full.toString('base64')}"/></svg>\n`;
  writeFileSync(new URL('public/icons/hxh-gon.svg', root), standalone);
  writeFileSync(new URL('public/icons/icon.svg', root), standalone);
  console.log('Saved H×H / Gon icons:', fileURLToPath(new URL('public/icons/', root)));
} finally { await browser.close(); }
