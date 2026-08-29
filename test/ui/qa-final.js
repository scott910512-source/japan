import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], consoleErrs = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });

  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok('첫 화면이 3초 안에 뜸', Date.now() - t0 < 3000, `${Date.now() - t0}ms`);

  await p.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.goals = { fresh: 50, review: 50, weak: 50 }; localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await p.waitForTimeout(900);
  const t1 = Date.now();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  /* 다 뜬 다음에 끊는다. 끊고 나서 불러오면 서비스워커가 아직 자리를 안
     잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이걸로 죽었다. */
  await p.context().setOffline(true);
  const off = p.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  ok('인터넷이 끊겨도 쓸 수 있음', await off.count() > 0 || await p.locator('.tabbar').count() > 0);
  if (await off.count()) { await off.click(); await p.waitForTimeout(700); }
  ok('끊긴 채로 시작이 3초 안', Date.now() - t1 < 3000, `${Date.now() - t1}ms`);

  // 모든 탭을 돌며 깨지는 곳이 없는지
  for (const tab of ['오늘', '학습', '복습', '기록', '더보기']) {
    await p.locator('.tabbar .tab', { hasText: tab }).click();
    await p.waitForTimeout(700);
    const txt = (await p.textContent('.screen.active').catch(() => '')) || '';
    ok(`${tab} 탭이 내용을 그림`, txt.trim().length > 20, `${txt.trim().length}자`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`${tab} 탭이 가로로 안 넘침`, !wide);
  }

  // 홈의 메뉴를 모두 열어 본다
  await goTab(p, '오늘');
  await p.waitForTimeout(600);
  await goTab(p, '학습');
  const menus = await p.locator('.menutile').count();
  ok('홈에 메뉴가 있음', menus > 0, `${menus}개`);
  for (let i = 0; i < menus; i++) {
    const card = p.locator('.menutile').nth(i);
    const label = (await card.textContent()).trim().slice(0, 12);
    if (await card.isDisabled()) { ok(`아직 안 여는 메뉴는 잠김 · ${label}`, true); continue; }
    await card.click();
    await p.waitForTimeout(800);
    const shown = (await p.textContent('body')).trim().length;
    ok(`메뉴 열림 · ${label}`, shown > 100, `${shown}자`);
    const back = p.locator('.subscreen .sub-back, .subscreen .sh-close').first();
    if (await back.count()) { await back.click(); await p.waitForTimeout(600); }
    if (await p.locator('.menutile').count() === 0) {
      await goTab(p, '오늘'); await p.waitForTimeout(600);
    }
  }

  // 접근성: 아이콘만 있는 버튼에 이름이 있는지
  await goTab(p, '오늘');
  await p.waitForTimeout(500);
  const nameless = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.screen.active button, .tabbar button').forEach((el) => {
      const text = (el.textContent || '').trim();
      const label = el.getAttribute('aria-label') || el.getAttribute('title');
      if (!text && !label) out.push(el.className || el.outerHTML.slice(0, 40));
    });
    return out;
  });
  ok('이름 없는 버튼이 없음', nameless.length === 0, nameless.slice(0, 3).join(' | '));

  // 탭 순회가 가능한지
  const focusable = await p.evaluate(() => document.querySelectorAll('.screen.active a, .screen.active button, .screen.active input, .tabbar button').length);
  ok('키보드로 짚을 요소가 있음', focusable > 5, `${focusable}개`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  const realConsole = consoleErrs.filter((t) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(t));
  ok('콘솔 에러 없음(오프라인 자원 제외)', realConsole.length === 0, realConsole.slice(0, 2).join(' | '));

  await b.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
