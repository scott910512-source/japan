/* 기출 단어 — 진짜 화면에서.
 *
 *   학습 탭 「기출 단어」로 들어간다
 *   205줄이 많이 나온 순서로 뜨고, 맨 앞은 세 번 나온 것들이다
 *   연도별로 보면 열여섯 해가 최근부터 나온다
 *   「기출 순서대로 시작」을 누르면 회독 판이 열린다
 *   ★ 홈의 새 단어가 기출부터 나온다 ★ — 이 기능의 요지다
 *   진도 막대가 판정한 만큼 움직인다 · 375px에서 가로로 안 넘친다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openListen, openMenu } from './_nav.js';
import { KIJU_LIST } from '../../src/lib/kiju.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log('\n── 학습 탭에서 들어간다');
  await openMenu(page, '기출 단어');
  await page.locator('.kj-list').waitFor({ timeout: 8000 });
  ok('기출 화면이 열린다', await page.locator('.kj-head').count() === 1);
  ok('머리에 몇 개인지 적힌다', (await page.locator('.kj-lead').innerText()).includes('205'),
    (await page.locator('.kj-lead').innerText()).replace(/\s+/g, ' ').slice(0, 60));

  const rows = page.locator('.kj-row');
  ok('205줄', await rows.count() === 205, `${await rows.count()}줄`);

  console.log('\n── 많이 나온 것이 맨 앞');
  const three = KIJU_LIST.filter((e) => e.y.length === 3).map((e) => e.w);
  const head6 = [];
  for (let i = 0; i < 6; i++) head6.push((await rows.nth(i).locator('.kj-w').innerText()).split('\n')[0]);
  ok('★ 세 번 나온 여섯 개가 맨 앞 ★', head6.every((w) => three.includes(w)), head6.join(' '));
  ok('첫 줄에 3회 표시', (await rows.first().locator('.kj-y b').innerText()).includes('3'));
  ok('첫 줄에 나온 해가 적힌다', /\d{4}/.test(await rows.first().locator('.kj-y').innerText()),
    (await rows.first().locator('.kj-y').innerText()).replace(/\s+/g, ' '));
  ok('한 번만 나온 줄에는 횟수 표시가 없다', await rows.nth(40).locator('.kj-y b').count() === 0);
  ok('두 번 이상 나온 줄에 표시(.hot)', await page.locator('.kj-row.hot').count() === 36,
    `${await page.locator('.kj-row.hot').count()}줄`);

  console.log('\n── 연도별');
  await page.locator('.kj-tabs button', { hasText: '연도별' }).click();
  await page.waitForTimeout(300);
  ok('열여섯 해', await page.locator('.kj-year').count() === 16, `${await page.locator('.kj-year').count()}해`);
  const firstYear = await page.locator('.kj-year .section-label').first().innerText();
  ok('최근 해가 먼저', firstYear.includes('2025'), firstYear.replace(/\s+/g, ' '));
  ok('2020년에 취소 까닭이 적힌다',
    (await page.locator('.kj-year', { hasText: '2020' }).first().innerText()).includes('취소'));
  await page.locator('.kj-tabs button', { hasText: '출제 순' }).click();
  await page.waitForTimeout(300);

  console.log('\n── 시작하면 회독 판이 열린다');
  ok('가로 넘침 없음', !(await overflow(page)));
  await page.locator('.bigstart').click();
  await page.waitForTimeout(900);
  ok('카드가 뜬다', await page.locator('.studycard').count() === 1);
  const cardWord = (await page.locator('.studycard').innerText()).replace(/\s+/g, ' ');
  ok('★ 첫 카드가 기출 목록에 있는 낱말 ★',
    KIJU_LIST.some((e) => cardWord.includes(e.w) || cardWord.includes(e.ko.split(',')[0].trim())),
    cardWord.slice(0, 40));

  // 한 장 판정하고 나오면 진도가 움직여 있어야 한다
  await page.locator('.studycard').click(); await page.waitForTimeout(200);
  await page.locator('.judgerow button', { hasText: '알아요' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.sh-close').click(); await page.waitForTimeout(700);

  await openMenu(page, '기출 단어');
  await page.locator('.kj-head').waitFor({ timeout: 8000 });
  const nums = await page.locator('.kj-nums').innerText();
  ok('★ 판정한 만큼 진도에 적힌다 ★', !nums.includes('205 아직'), nums.replace(/\s+/g, ' '));
  ok('본 줄에 표시가 남는다', await page.locator('.kj-row[data-mark="seen"], .kj-row[data-mark="done"]').count() >= 1);

  console.log('\n── 두 번 이상 나온 것만');
  await page.locator('.kj-top').click();
  await page.waitForTimeout(900);
  ok('그 판도 열린다', await page.locator('.studycard').count() === 1);
  await page.locator('.sh-close').click(); await page.waitForTimeout(700);

  console.log('\n── ★ 홈의 새 단어가 기출부터 ★');
  const p2 = await boot(browser);
  await goTab(p2, '홈');
  const freshRow = p2.locator('.tdlist .tdtask', { hasText: '새로 배우기' });
  await freshRow.waitFor({ timeout: 8000 });
  await freshRow.click(); await page2Swap(p2);
  await p2.locator('.study.intro .bigstart').click(); await p2.waitForTimeout(900);

  /* 첫 카드를 짚지 않는다 — 판에는 문장도 섞이고 순서는 판정 결과에 따라
     달라진다. 「새로 배우는 단어가 기출인가」가 물음이니 단어 카드만 모은다. */
  const seen = [];
  for (let i = 0; i < 10 && await p2.locator('.studycard').count(); i++) {
    const card = p2.locator('.studycard');
    if ((await card.getAttribute('data-kind')) === 'word') {
      seen.push((await card.innerText()).replace(/\s+/g, ' '));
    }
    await card.click(); await p2.waitForTimeout(160);
    const judge = p2.locator('.judgerow button', { hasText: '알아요' });
    if (!(await judge.count())) break;
    await judge.first().click(); await p2.waitForTimeout(400);
  }
  const isKiju = (t) => KIJU_LIST.some((e) => t.includes(e.w) || t.includes(e.k));
  ok('단어 카드가 몇 장 나왔다', seen.length >= 3, `${seen.length}장`);
  ok('★ 새로 배우는 단어가 전부 기출 ★', seen.length >= 3 && seen.every(isKiju),
    seen.filter((t) => !isKiju(t)).join(' | ').slice(0, 80) || seen.map((t) => t.slice(0, 12)).join(' / '));

  console.log('\n── ★ 기출만 자동 듣기 ★');
  /* 손이 안 비는 시간에 귀로 시험 범위를 한 바퀴 돈다. 기출 화면과 같은
     205개가 후보여야 한다 — 레벨로 잘리면 두 화면의 숫자가 어긋난다. */
  /* p2는 아직 회독 판 안이라 탭바가 없다(집중 모드). 새 자리에서 연다. */
  const p3 = await boot(browser);
  await openListen(p3, 'auto');
  await p3.locator('.ls-scope[data-scope="kiju"]').waitFor({ timeout: 8000 });
  const kn = Number((await p3.locator('.ls-scope[data-scope="kiju"] .pk-count').innerText()).match(/\d+/)[0]);
  ok('듣기 범위에 기출 205개', kn === 205, `${kn}개`);
  await p3.locator('.ls-scope[data-scope="kiju"]').click();
  await p3.waitForTimeout(300);
  ok('고른 범위가 켜진다', (await p3.locator('.ls-scope[data-scope="kiju"]').getAttribute('class')).includes('active'));

  await p3.locator('.ls-go').click(); await p3.waitForTimeout(400);
  await p3.locator('.ls-ask .submit-btn').click(); await p3.waitForTimeout(1500);
  const spoken = (await p3.textContent('.ls-jp')).trim();
  ok('★ 나오는 낱말이 기출 ★', KIJU_LIST.some((e) => spoken.includes(e.w)), spoken.slice(0, 30));

  /* 다시 켜도 그 범위가 남는다 — 매번 고르게 하면 귀로 듣는 자리가 아니다.
     같은 자리를 새로고침해서 본다. 새 페이지를 열어서 보면 앞 페이지의 앱이
     아직 살아 있어 같은 저장소에 제 상태를 덮어쓴다 — 앱이 아니라 검사가
     만든 상황이다. */
  await p3.reload({ waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(1500);
  const off3 = p3.locator('.gate-offline');
  await off3.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off3.count()) { await off3.click(); await p3.waitForTimeout(800); }
  await openListen(p3, 'auto');
  await p3.locator('.ls-scope[data-scope="kiju"]').waitFor({ timeout: 8000 });
  ok('다시 켜도 기출 범위가 기억된다',
    (await p3.locator('.ls-scope[data-scope="kiju"]').getAttribute('class')).includes('active'));

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200) || '없음');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); console.log(`\n통과 ${pass} / 실패 ${fail + 1}`); process.exit(1); });

/* 하던 판이 있으면 접을지 묻는다. 검사에서는 접고 간다. */
async function page2Swap(p) {
  await p.waitForTimeout(700);
  const swap = p.locator('.swapask .submit-btn');
  if (await swap.count()) { await swap.click(); await p.waitForTimeout(700); }
}
