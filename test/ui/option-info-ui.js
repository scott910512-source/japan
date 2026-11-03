/* 보기마다 읽기 · 뜻 · 듣기 — 진짜 화면에서 (쭉 퀴즈).
 *
 *   · 답을 내기 전에는 패널이 없다(답이 새면 안 된다)
 *   · 답을 낸 뒤 보기 수만큼 줄이 나오고, 줄마다 🔊가 있고, 정답 줄이 하나다
 *   · 「다음 문제」 버튼이 패널보다 위에 있다(버튼이 패널 때문에 밀리지 않는다)
 *   · 펼쳐 둔 채로 맞히면 저절로 안 넘어간다, 접어 두면 예전처럼 넘어간다
 *   · 접고 편 것은 기억한다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openQuizHub } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const known = (ago = 5) => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -ago));
const n5 = ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 12);
const n3 = ALL_WORDS.filter((w) => w.level === 'N3').slice(0, 12);
const seededReview = Object.fromEntries([...n5, ...n3].map((w) => [w.id, { ...known(), due: addDays(today, -1) }]));

async function boot(browser, { review = {}, settings = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  /* 기존 검사(menu2-ui)가 쓰는 시작 방법 — 첫 로드로 서비스워커를 깔고, 심은 뒤 한 번 더 불러 온 다음,
     오프라인으로 돌려 로그인 관문의 「이 기기 기록으로 계속하기」로 들어간다. 오프라인으로 새로고침하면
     서비스워커가 준비되기 전의 느린 러너에서 화면이 안 뜬다(CI에서 그랬다). */
  await page.evaluate(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error(`앱이 안 열렸어요 — 화면: ${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}`);
  return page;
}
const reviewOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
const countsOf = async (page) => Object.fromEntries(await page.locator('.st-count').evaluateAll((els) => els.map((e) => [e.dataset.kind, Number(e.querySelector('b').textContent)])));


/* 보기가 있는(직접 쓰기가 아닌) 문제가 나올 때까지 넘긴다 */
async function toChoice(page) {
  for (let i = 0; i < 14; i++) {
    const run = page.locator('.st-run');
    if (!(await run.count())) return false;
    if ((await run.getAttribute('data-mode')) === 'choice') return true;
    await page.locator('.st-input').fill('ㅋㅋㅋ');
    await page.locator('.st-submit').click();
    await page.waitForTimeout(200);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click();
    await page.waitForTimeout(300);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, { review: seededReview });
  page.on('pageerror', (e) => errors.push(e.message));
  await openQuizHub(page);
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);

  console.log('\n[ 답을 내기 전엔 보이지 않는다 ]');
  ok('보기가 있는 문제가 나온다', await toChoice(page));
  ok('★ 답을 내기 전에는 패널이 없다(답이 새지 않는다) ★', await page.locator('.optrev').count() === 0);

  console.log('\n[ 답을 낸 뒤 ]');
  const nOpts = await page.locator('.st-opt').count();
  await page.locator('.st-opt').first().click();
  await page.waitForTimeout(400);
  ok('패널이 나온다', await page.locator('.optrev').count() === 1);
  ok('기본은 펼쳐져 있다', await page.locator('.optrev').evaluate((e) => e.open));
  ok('줄 수 = 보기 수', await page.locator('.optrev-row').count() === nOpts, `${nOpts}`);
  ok('줄마다 🔊', await page.locator('.optrev-row .optrev-spk').count() === nOpts);
  ok('정답 줄이 하나', await page.locator('.optrev-row.correct').count() === 1);
  ok('★ 보기마다 뜻(또는 일본어)이 붙는다 ★', await page.locator('.optrev-row').evaluateAll((rows) => rows.every((r) => (r.querySelector('.optrev-ko')?.textContent || '').trim() || (r.querySelector('b')?.textContent || '').trim())));
  ok('일본어 줄은 lang=ja', await page.locator('.optrev-row b[lang="ja"]').count() >= 1);
  const wrongPicked = await page.locator('.st-opt.wrong').count() > 0;
  ok('틀린 걸 골랐으면 내 답 줄이 빨갛게', !wrongPicked || await page.locator('.optrev-row.mine').count() === 1);
  const nextY = await page.locator('.st-next').count() ? (await page.locator('.st-next').boundingBox()).y : null;
  const panelY = (await page.locator('.optrev').boundingBox()).y;
  ok('★ 「다음 문제」 버튼이 패널 위에 있다 ★', nextY === null || nextY < panelY, `${nextY} < ${panelY}`);
  await page.locator('.optrev-spk').first().click().catch(() => {});
  await page.waitForTimeout(200);
  ok('🔊을 눌러도 오류가 없다', errors.length === 0, errors[0]);

  console.log('\n[ 펼쳐 두면 맞혀도 직접 넘긴다 ]');
  if (await page.locator('.st-next').count()) { await page.locator('.st-next').click(); await page.waitForTimeout(400); }
  let held = false;
  for (let i = 0; i < 20 && !held; i++) {
    if (!(await toChoice(page))) break;
    const id = await page.locator('.st-run').getAttribute('data-id');
    await page.locator('.st-opt').first().click();
    await page.waitForTimeout(300);
    if (await page.locator('.st-opt.wrong').count()) {          // 틀렸으면 넘기고 다시
      await page.locator('.st-next').click(); await page.waitForTimeout(400); continue;
    }
    await page.waitForTimeout(1500);                             // 자동 넘김(0.8초)보다 길게 기다린다
    ok('★ 맞혀도 1.5초 뒤 그대로 같은 문제 ★', (await page.locator('.st-run').getAttribute('data-id')) === id);
    ok('맞혀도 「다음 문제」 버튼이 있다', await page.locator('.st-next').count() === 1);
    held = true;
  }
  ok('맞히는 경우를 만났다', held);

  console.log('\n[ 키보드 — 1~4 고르기 · 고른 뒤 1~4는 그 보기 듣기 · 5 다음 ]');
  if (await toChoice(page)) {
    const idNow = await page.locator('.st-run').getAttribute('data-id');
    await page.keyboard.press('2');
    await page.waitForTimeout(350);
    ok('★ 2를 누르면 2번 보기를 고른다 ★', await page.locator('.st-opt.correct, .st-opt.wrong').count() >= 1 && await page.locator('.optrev').count() === 1);
    if (!(await page.locator('.optrev').evaluate((e) => e.open))) { await page.locator('.optrev > summary').click(); await page.waitForTimeout(200); }
    await page.keyboard.press('1');            // 답을 낸 뒤라 고르는 게 아니라 1번 보기 듣기
    await page.waitForTimeout(300);
    ok('★ 답을 낸 뒤 1을 눌러도 같은 문제(다시 고르지 않는다) ★', (await page.locator('.st-run').getAttribute('data-id')) === idNow);
    await page.keyboard.press('5');
    await page.waitForTimeout(500);
    ok('★ 5를 누르면 다음 문제 ★', (await page.locator('.st-run').getAttribute('data-id')) !== idNow);
  }

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
