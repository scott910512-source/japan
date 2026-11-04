/* 안 보이는 탭 속에 열려 있는 시트가 다른 탭을 가로막지 않는다 — 진짜 화면에서.
 *
 * 영상 탭에서 「영상 빼기」 시트를 열어 둔 채 학습 탭으로 옮기면, 그 시트가 투명한 채로 남아 터치를 받았다.
 * 학습 탭 아래쪽 칸(완전기초 · 독일어)을 눌러도 「삭제」 입력칸이 대신 눌렸다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu, goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});

  console.log('\n[ 영상 탭에 열린 시트를 두고 학습 탭으로 ]');
  await openMenu(page, '영상');
  await page.waitForTimeout(800);
  const made = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll('.screen.active .sheet')];
    sheets.forEach((s) => s.classList.add('open'));     // 「영상 빼기」 시트가 열린 상태를 만든다
    return sheets.length;
  });
  ok('영상 화면에 시트가 있다', made >= 1, `${made}개`);
  await goTab(page, '학습');
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => [...document.querySelectorAll('.screen:not(.active) .sheet.open')].map((s) => { const c = getComputedStyle(s); return { v: c.visibility, p: c.pointerEvents }; }));
  ok('안 보이는 화면의 열린 시트가 있다(조건 만들기)', st.length >= 1, `${st.length}개`);
  ok('★ 그 시트는 숨겨져 있고 터치를 안 받는다 ★', st.every((x) => x.v === 'hidden' && x.p === 'none'), JSON.stringify(st[0]));
  const hit = await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.menutile')].find((t) => t.textContent.includes('독일어'));
    if (!tile) return 'no-tile';
    tile.scrollIntoView({ block: 'center' });
    const r = tile.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return tile.contains(el) ? 'tile' : (el?.className || el?.tagName || 'none');
  });
  ok('★ 학습 탭의 칸을 누르면 그 칸이 눌린다(시트가 가로채지 않는다) ★', hit === 'tile', hit);
  await openMenu(page, '독일어');
  ok('독일어가 열린다', await page.locator('.swh-unit').count() > 0);

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
