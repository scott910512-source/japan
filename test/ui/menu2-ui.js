/* 메뉴 정리 2단계 — 오늘·복습·내 학습의 역할이 겹치지 않는가.
 *
 *   오늘     N3 코스 입구는 학습 탭의 「N3 학습하기」 하나다 — 오늘 탭에는 입구가 없다
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
  await page.waitForTimeout(2800);
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

  console.log('\n[ 오늘 — N3 입구는 학습 탭 하나 ]');
  await goTab(page, '오늘');
  ok('★ 오늘 탭에는 N3 입구(이어서 공부하기 줄)가 없다 ★', await page.locator('.hm-n3').count() === 0 && await page.locator('.hm-cont').count() === 0);
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
  ok('복습 간격 안내도 그대로', (await page.textContent('.subscreen.open')).includes('1 · 3 · 7 · 30 · 90일'));
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  ok('복습을 닫으면 내 학습으로 돌아온다', await page.locator('.tabbar .tab.active[data-tab="me"]').count() === 1);
  ok('기억 수준 막대가 거기 있다', await page.locator('.roundstat').count() === 1);

  console.log('\n[ 설정은 하단 탭 ]');
  ok('★ 내 학습에는 설정·계정·백업 줄이 없다(탭으로 나갔다) ★',
    await page.locator('.me-settings, .me-account, .me-backup').count() === 0);
  await goTab(page, '설정');
  ok('★ 설정 탭이 활성이고 여섯 묶음 목록 ★', await page.locator('.tabbar .tab.active[data-tab="settings"]').count() === 1 && await page.locator('.moregroup').count() === 6,
    `${await page.locator('.moregroup').count()}개`);
  await page.locator('.moregroup', { hasText: '계정과 동기화' }).click();
  await page.waitForTimeout(500);
  ok('계정 묶음이 열린다', await page.locator('.moreback').count() === 1);
  await goTab(page, '학습');
  await goTab(page, '설정');
  ok('★ 탭을 다시 열면 묶음 목록으로 돌아온다 ★', await page.locator('.moregroup').count() === 6);

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
