import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', label, extra ? '— ' + extra : ''); }
  else { fail++; console.log('  ✗', label, extra ? '— ' + extra : ''); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest/i.test(m.text())) errors.push('console: ' + m.text()); });

  // 로그인 게이트를 오프라인 통행으로 통과한다 (이 기기에서 로그인한 적 있음 + 오프라인)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('jp_manabu_signed_in_v1', '1'));
  await page.waitForTimeout(1200); // 서비스워커 프리캐시
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
  // 온보딩이 뜨면 넘긴다
  for (let i = 0; i < 6; i++) {
    const skip = page.locator('button', { hasText: /건너뛰기|시작|다음|바로/ }).first();
    if (await skip.count() && await skip.isVisible()) { await skip.click().catch(() => {}); await page.waitForTimeout(300); }
    else break;
  }
  await page.waitForTimeout(600);

  /* JLPT 세트는 단어암기 안으로 들어갔다.
     따로 둔 메뉴였는데, 그건 다른 공부가 아니라 같은 단어를 다른 방식으로
     끊어 주는 것이었다 — 「단어암기와 JLPT 단어가 거의 같은 것 아니냐」는
     말이 나왔고, 실제로 그랬다. */
  await goTab(page, '학습');
  ok('JLPT 단어가 따로 있지 않다',
    await page.locator('.menutile', { hasText: 'JLPT 단어' }).count() === 0);
  const card = page.locator('.menutile', { hasText: '단어암기' });
  ok('단어암기로 들어간다', await card.count() > 0);
  await card.first().click();
  await page.waitForTimeout(600);
  ok('끊는 방법을 고를 수 있다', await page.locator('.wd-how button').count() === 2);
  await page.locator('.wd-how button', { hasText: '세트로' }).click();
  await page.waitForTimeout(500);

  // 레벨 목록
  const levels = await page.$$eval('.jl-level', (els) => els.map((e) => ({
    badge: e.querySelector('.jl-badge')?.textContent,
    sub: e.querySelector('.jl-sub')?.textContent,
    disabled: e.disabled,
  })));
  ok('레벨 5개 표시', levels.length === 5, levels.map((l) => l.badge).join(','));
  ok('N5 준비됨', levels[0].sub.includes('534개') && levels[0].sub.includes('6세트'), levels[0].sub);
  ok('N3 준비됨', levels[2].sub.includes('1206개') && levels[2].sub.includes('13세트'), levels[2].sub);
  ok('N2 준비 중 + 비활성', levels[3].disabled && levels[3].sub.includes('준비 중'));
  ok('N1 준비 중 + 비활성', levels[4].disabled);
  ok('연도별 미제공 사유 안내', (await page.textContent('body')).includes('연도별 기출로 나누지 않은 이유'));

  // N3 열기
  await page.locator('.jl-level').nth(2).click();
  await page.waitForTimeout(500);
  const sets = await page.$$eval('.jl-set', (els) => els.map((e) => ({
    title: e.querySelector('.jl-title')?.textContent,
    range: e.querySelector('.jl-sub')?.textContent,
    pct: e.querySelector('.jl-pct')?.textContent,
  })));
  ok('N3 세트 13개', sets.length === 13, `${sets.length}개`);
  ok('1세트 100개', sets[0].title.includes('1세트 · 100개'), sets[0].title);
  ok('마지막 세트 6개', sets[12].title.includes('13세트 · 6개'), sets[12].title);
  ok('세트별 단어 범위 표시', /…/.test(sets[0].range), sets[0].range);
  ok('진도 0/100 표시', sets[0].pct === '0/100', sets[0].pct);

  // 세트 시작 → 학습 화면 진입
  await page.locator('.jl-set').first().click();
  await page.waitForTimeout(900);
  const body = await page.textContent('body');
  ok('세트 시작 시 학습 화면 진입', /N3 1세트/.test(body), body.slice(0, 80).replace(/\s+/g, ' '));

  // 뒤로 → 레벨 재선택
  await goTab(page, '학습');
  const card2 = page.locator('.menutile', { hasText: '단어암기' });
  if (await card2.count()) {
    await card2.first().click();
    await page.waitForTimeout(500);
    await page.locator('.wd-how button', { hasText: '세트로' }).click();
    await page.waitForTimeout(400);
    await page.locator('.jl-level').first().click();
    await page.waitForTimeout(400);
    await page.locator('.inner-back').first().click();
    await page.waitForTimeout(400);
    ok('레벨 다시 고르기 동작', (await page.locator('.jl-level').count()) === 5);
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
