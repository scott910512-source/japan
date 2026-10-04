/* 뒤로가기와 시트 — 시트가 떠 있으면 시트만 닫힌다.
 *
 * 문법의 「시제」 시트, 자동 듣기의 「시작 전 묻기」 시트가 떠 있을 때 폰
 * 뒤로가기를 누르면 화면이 통째로 나갔다. 배경을 누르면 시트만 닫히는데
 * 뒤로가기는 화면을 닫으니, 같은 「닫기」가 두 결과를 냈다.
 *
 * 그리고 전체 점검에서 나온 모양 몇 가지도 같이 본다 — 안쪽 헤더가 겹치지
 * 않는가, 작은 버튼이 손가락만큼 커졌는가. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openListen, openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const TOUCH = 44;

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    const rev = {};
    for (let i = 1; i <= 12; i++) {
      rev[`n5-${String(i).padStart(4, '0')}`] = { box: 1, streak: 0, lastSeen: '2026-09-20', rounds: 2, wrongCount: 4, vagueCount: 1 };
    }
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rev));
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

const size = async (loc) => {
  const b = await loc.first().boundingBox();
  return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : 'none';
};
const fits = async (loc) => {
  const b = await loc.first().boundingBox();
  return Boolean(b) && b.width >= TOUCH - 0.5 && b.height >= TOUCH - 0.5;
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await boot(browser);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 문법 시트 — 뒤로가기는 시트만 닫는다 ]');
  {
    await openMenu(page, '문법');
    await page.locator('.gram-card').first().click();
    await page.waitForTimeout(700);
    ok('시트가 떴다', await page.locator('.sheet.open').count() === 1);
    await page.goBack();
    await page.waitForTimeout(900);
    ok('★ 뒤로가기 한 번 — 시트만 닫힌다 ★', await page.locator('.sheet.open').count() === 0);
    ok('★ 문법 화면은 그대로 ★', await page.locator('.subscreen.open').count() === 1);
    await page.goBack();
    await page.waitForTimeout(900);
    ok('한 번 더 — 문법 화면이 닫힌다', await page.locator('.subscreen.open').count() === 0);
    ok('앱 안에 있다', await page.locator('.tabbar').count() === 1);
  }

  console.log('\n[ 듣기의 시작 전 묻기 시트도 같다 ]');
  {
    await goTab(page, '홈');
    await openListen(page, 'auto');
    await page.locator('.ls-go').click();
    await page.waitForTimeout(500);
    ok('묻는 시트가 떴다', await page.locator('.sheet.open').count() === 1);
    await page.goBack();
    await page.waitForTimeout(900);
    ok('★ 시트만 닫히고 듣기 설정은 남는다 ★',
      await page.locator('.sheet.open').count() === 0 && await page.locator('.ls-go').count() === 1);
    /* 배경을 눌러 닫는 길도 그대로다 — 뒤로가기 자리가 하나 남아도 다음
       뒤로가기가 헛돌지 않는지는 navhistory 규칙이 지킨다 */
    await page.locator('.ls-go').click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    ok('Esc로도 시트만 닫힌다', await page.locator('.sheet.open').count() === 0 && await page.locator('.ls-go').count() === 1);
    await page.goBack();
    await page.waitForTimeout(900);
    ok('그 뒤 뒤로가기 한 번에 듣기가 닫힌다', await page.locator('.subscreen.open').count() === 0);
  }

  console.log('\n[ 안쪽 헤더는 한 줄만 ]');
  {
    await goTab(page, '홈');
    await openMenu(page, '문장');
    /* 「꼭 필요한 문장만」은 상황 목록에 있다 — 들어가기 전에 잰다 */
    ok('「꼭 필요한 문장만」이 손가락만큼', await fits(page.locator('.starfilter')), await size(page.locator('.starfilter')));
    await page.locator('.menucard').first().click();
    await page.waitForTimeout(600);
    ok('바깥 헤더 하나', await page.locator('.subscreen.open .sub-header:not(.inline)').count() === 1);
    ok('★ 안쪽 「뒤로」는 안쪽 줄 모양 ★', await page.locator('.subscreen.open .sub-header.inline .sub-back').count() === 1);
    ok('문장 목록의 소리·눈 버튼이 손가락만큼', await fits(page.locator('.iconbtn')), await size(page.locator('.iconbtn')));
    await page.locator('.subscreen.open .sub-header.inline .sub-back').click();
    await page.waitForTimeout(400);
    await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click();
    await page.waitForTimeout(400);

    await openMenu(page, '완전기초');
    ok('「퀴즈 ›」가 손가락만큼 높다', (await page.locator('.kr-quiz').first().boundingBox())?.height >= TOUCH - 0.5,
      await size(page.locator('.kr-quiz')));
    await page.locator('.kr-quiz').first().click();
    await page.waitForTimeout(500);
    ok('あ행 퀴즈의 「뒤로」도 안쪽 줄', await page.locator('.subscreen.open .sub-header.inline .sub-back').count() === 1);
    await page.locator('.subscreen.open .sub-header.inline .sub-back').click();
    await page.waitForTimeout(300);
    await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click();
    await page.waitForTimeout(300);
  }

  console.log('\n[ 손가락보다 작던 버튼들 ]');
  {
    await openMenu(page, '기출 단어');
    ok('묶음 점이 손가락만큼 높다', (await page.locator('.kg-dots button.kg-dot').first().boundingBox())?.height >= TOUCH - 0.5,
      await size(page.locator('.kg-dots button.kg-dot')));
    await page.locator('.subscreen.open .sub-back').first().click();
    await page.waitForTimeout(300);

    await openMenu(page, '단어');
    ok('상단 탭(이어서 외우기 · 세트로)이 손가락만큼', await fits(page.locator('.segment button')), await size(page.locator('.segment button')));
    ok('레벨 칩이 손가락만큼 높다', (await page.locator('.chip').first().boundingBox())?.height >= TOUCH - 0.5, await size(page.locator('.chip')));
    await page.locator('.bigstart').click();
    await page.waitForTimeout(900);
    ok('회독 카드의 닫기', await fits(page.locator('.sh-close')), await size(page.locator('.sh-close')));
    ok('회독 카드의 소리', await fits(page.locator('.sc-speak')), await size(page.locator('.sc-speak')));
    ok('「히라가나 보기」 높이', (await page.locator('.sc-peek').first().boundingBox())?.height >= TOUCH - 0.5, await size(page.locator('.sc-peek')));
    const foot = await page.locator('.studyfoot button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    ok('★ 아래 도구 줄이 한 줄 — 「천천히 듣/기」로 안 꺾인다 ★', foot.length === 4 && foot.every((h) => h < 60), foot.map(Math.round).join('·'));
    await page.locator('.sh-close').click();
    await page.waitForTimeout(400);
  }

  console.log('\n[ 복습 탭 — 까닭이 숫자 중간에서 안 꺾인다 ]');
  {
    await goTab(page, '복습');
    const rows = page.locator('.wb-reason');
    const n = await rows.count();
    ok('까닭 덩어리가 있다', n > 0, `${n}`);
    /* 조각(「 · 」와 글)이 상자를 둘로 낼 수는 있다 — 줄이 다른지만 본다 */
    const tall = await rows.evaluateAll((els) => els.filter((e) => new Set([...e.getClientRects()].map((r) => Math.round(r.top))).size > 1).length);
    ok('★ 한 덩어리가 두 줄에 걸치지 않는다 ★', tall === 0, `${tall}개 걸침`);
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
