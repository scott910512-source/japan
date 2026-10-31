/* 메뉴 정리 2단계 — 오늘·복습·내 학습의 역할이 겹치지 않는가.
 *
 *   오늘     N3 줄이 한 곳에만 (이어서 공부하기). 「오늘」 목록에 같은 줄이 또 있으면 안 된다
 *   복습     기억 단계 안내가 있고, 이름이 내 학습 막대와 같은 말(rounds.js STAGES)이다
 *   내 학습  「계정과 동기화」「기록 백업」이 설정을 거치지 않고 그 묶음으로 바로 열린다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';
import { STAGES } from '../../src/lib/rounds.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 오늘 — N3 줄은 한 곳 ]');
  await goTab(page, '오늘');
  ok('이어서 공부하기에 N3 줄이 하나', await page.locator('.hm-n3').count() === 1);
  ok('★ 「오늘」 목록에는 N3 줄이 없다 ★', await page.locator('.tdlist .tdtask', { hasText: '오늘의 N3' }).count() === 0);
  ok('N3 진도 한 줄(머리 밑)은 보기만 하는 요약으로 남는다', await page.locator('.hm-goal').count() === 1);
  ok('오늘의 문법·복습 줄은 그대로', await page.locator('.tdlist .tdtask', { hasText: '오늘의 문법' }).count() === 1);

  console.log('\n[ 복습 — 기억 단계 안내 ]');
  await goTab(page, '복습');
  const stages = page.locator('.rv-stages');
  ok('기억 단계 안내가 있다', await stages.count() === 1);
  ok('처음엔 접혀 있다(복습 목록을 밀어내지 않는다)', !(await stages.evaluate((el) => el.open)));
  await stages.locator('summary').click();
  await page.waitForTimeout(300);
  const shown = await page.locator('.rv-stagelist li b').allTextContents();
  const want = STAGES.filter((s) => s.id !== 'self').map((s) => s.label);
  ok('★ 단계 이름이 rounds.js 하나와 같다 ★', shown.join() === want.join(), shown.join(' / '));
  ok('복습 간격 안내도 그대로', (await page.textContent('.screen.active')).includes('1 · 3 · 7 · 30 · 90일'));
  await stages.locator('.rv-me').click();
  await page.waitForTimeout(500);
  ok('「내 학습에서 보기」가 내 학습 탭을 연다', await page.locator('.tabbar .tab.active[data-tab="me"]').count() === 1);
  ok('기억 수준 막대가 거기 있다', await page.locator('.roundstat').count() === 1);

  console.log('\n[ 내 학습 — 계정·백업 바로가기 ]');
  ok('설정은 별도 줄로 있다', await page.locator('.me-settings').count() === 1);
  ok('계정과 동기화 줄', await page.locator('.me-account').count() === 1);
  ok('기록 백업 줄', await page.locator('.me-backup').count() === 1);

  await page.locator('.me-account').click();
  await page.waitForTimeout(700);
  ok('★ 계정 줄: 설정 목록을 거치지 않고 계정 묶음이 열린다 ★',
    await page.locator('.moregroup').count() === 0 && (await page.textContent('.subscreen')).includes('계정'),
    (await page.locator('.moreback').count() ? '묶음 안' : '목록'));
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  ok('뒤로 가면 내 학습', await page.locator('.me-settings').count() === 1);

  await page.locator('.me-backup').click();
  await page.waitForTimeout(700);
  ok('★ 백업 줄: 백업 묶음이 바로 열린다 ★',
    await page.locator('.moregroup').count() === 0 && /백업|내려받기|복원/.test(await page.textContent('.subscreen')));
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);

  await page.locator('.me-settings').click();
  await page.waitForTimeout(600);
  ok('설정 줄은 여전히 여섯 묶음 목록', await page.locator('.moregroup').count() === 6,
    `${await page.locator('.moregroup').count()}개`);

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
