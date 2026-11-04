/* 로그인 없이 먼저 써 보기 — 처음 온 사람이 가입부터 요구받지 않는다 (진짜 화면에서).
 *
 *   · 한 번도 로그인한 적 없는 기기의 관문에 「로그인 없이 먼저 써 보기」가 있다
 *   · 누르면 온보딩 → 오늘 화면으로 들어간다
 *   · 첫날(복습 없음)에는 왜 카드가 적은지 이유가 적힌다
 *   · 새로고침해도 관문으로 돌아가지 않는다(기기에 기억)
 *   · 전에 로그인한 적 있는 기기에는 이 버튼이 없다(그 사람은 계정 기록을 이어 가야 한다)
 *   · 설정에서 나중에 로그인할 자리가 있다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMore } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function fresh(browser, { signedInOnce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route(/supabase\.co/, (route) => route.abort('failed'));   // 서버에 닿지 못하는 자리 — 관문이 뜬다
  if (signedInOnce) await page.addInitScript(() => localStorage.setItem('jp_manabu_signed_in_v1', '1'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.gate').waitFor({ timeout: 15000 });
  return { page, ctx };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 처음 온 사람 ]');
  const { page, ctx } = await fresh(browser);
  page.on('pageerror', (e) => errors.push(e.message));
  ok('★ 관문에 「로그인 없이 먼저 써 보기」가 있다 ★', await page.locator('.gate-guest-btn').count() === 1);
  ok('기록이 이 기기에 저장된다고 알린다', (await page.locator('.gate-guest').innerText()).includes('이 기기'));
  ok('이어 가기 버튼(.gate-offline)은 따로 안 뜬다', await page.locator('.gate-offline').count() === 0);
  await page.locator('.gate-guest-btn').click();
  await page.waitForTimeout(1500);
  ok('관문이 사라지고 온보딩이 뜬다', await page.locator('.gate').count() === 0 && await page.locator('.onboarding').count() === 1);

  /* 온보딩: 목적 → 가나 → 분량(가볍게) → 사용법 */
  for (let k = 0; k < 4; k++) {
    if (!(await page.locator('.onboarding:not(.done)').count())) break;
    const c = page.locator('.ob-slide.active .ob-choice');
    if (await c.count()) await c.nth(k === 1 ? 1 : 0).click();
    await page.locator('.ob-next').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  await page.locator('.tabbar').waitFor({ timeout: 10000 });
  ok('오늘 화면이 열린다', await page.locator('.bigcta').count() === 1);
  ok('★ 첫날은 카드가 적은 이유가 적힌다 ★', (await page.locator('.td-firstnote').innerText().catch(() => '')).includes('복습할 카드가 없어서'));
  ok('머리 밑 줄은 「시작 전」', (await page.locator('.hg-pct').innerText()).includes('시작 전'));

  console.log('\n[ 새로고침해도 ]');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  ok('★ 관문으로 돌아가지 않는다 ★', await page.locator('.gate').count() === 0 && await page.locator('.tabbar').count() === 1);

  console.log('\n[ 설정에서 나중에 로그인 ]');
  await openMore(page, 'account');
  ok('설정에 로그인 입력칸이 있다', await page.locator('input[type="email"], input[autocomplete="email"]').count() >= 1);
  await ctx.close();

  console.log('\n[ 전에 로그인한 적 있는 기기 ]');
  const second = await fresh(browser, { signedInOnce: true });
  ok('★ 이 버튼은 안 뜬다(계정 기록을 이어 가야 한다) ★', await second.page.locator('.gate-guest-btn').count() === 0);
  await second.ctx.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
