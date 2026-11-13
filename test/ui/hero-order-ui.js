/* 오늘 화면의 큰 버튼은 퀘스트 줄과 같은 순서를 따른다 — 진짜 화면에서.
 *
 * 큰 버튼은 「복습이 남았으면 복습, 아니면 새로 배우기」만 알았고, 하던 판이 있으면 무조건 「이어하기」였다.
 * 그래서 퀘스트 줄은 「쭉 퀴즈」 차례를 가리키는데 큰 버튼은 열어만 본 새 단어 판을 내밀었다.
 *   · 큰 버튼은 아직 안 마친 첫 퀘스트를 연다
 *   · 다른 차례의 하던 판은 큰 버튼 밑에 작게 남는다(길은 남기되 순서를 어지럽히지 않는다)
 *   · 큰 버튼으로 들어간 쭉 퀴즈는 설정 화면 없이 바로 첫 문제가 나온다
 *   · 풀 수 없는 쭉 퀴즈(외운 것이 너무 적다)는 줄도 안 서고 큰 버튼도 그리로 안 보낸다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5');
/* 외웠고 복습 차례는 아직인 낱말 — 복습 미션도 약점 퀴즈도 없고, 쭉 퀴즈가 첫 차례가 된다 */
const known = (n) => Object.fromEntries(N5.slice(0, n).map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -2)), due: addDays(today, 6) }]));

async function boot(browser, review) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  /* 서버는 가로챈다 — 손님으로 쓴다(밖으로 안 나간다) */
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"x"}' }));
  await ctx.addInitScript(({ rv, day }) => {
    if (localStorage.getItem('qa_seeded')) return;
    localStorage.setItem('qa_seeded', '1');
    localStorage.setItem('jp_manabu_guest_v1', '1');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3 }));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    localStorage.setItem('jp_manabu_progress_v1', JSON.stringify({ quests: { day, sentenceSkip: true } }));
  }, { rv: review, day: today });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar, .gate').first().waitFor({ timeout: 30000 });
  if (await page.locator('.gate-guest-btn').count()) await page.locator('.gate-guest-btn').click();
  await page.locator('.bigcta').waitFor({ timeout: 30000 });
  return { ctx, page };
}
const home = async (page) => { await page.locator('.tabbar .tab[data-tab="home"]').click(); await page.waitForTimeout(600); };
const cta = async (page) => ({ step: await page.locator('.bigcta').getAttribute('data-step'), text: (await page.locator('.bigcta').innerText()).replace(/\s+/g, ' ') });

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 쭉 퀴즈가 첫 차례인 날 ]');
  {
    const { ctx, page } = await boot(browser, known(12));
    page.on('pageerror', (e) => errors.push(e.message));
    const rows = await page.locator('.tdq-row b, .tdq-row .tdq-title').allInnerTexts().catch(() => []);
    ok('퀘스트 줄의 첫 줄이 쭉 퀴즈다', (await page.locator('.tdq-row').first().innerText()).includes('쭉 퀴즈'), rows.join(','));
    let c = await cta(page);
    ok('★ 큰 버튼도 쭉 퀴즈를 가리킨다(새로 배우기가 아니다) ★', c.step === 'stream' && c.text.includes('쭉 퀴즈') && c.text.includes('오늘 학습 시작'), c.text);

    /* 새 단어 판을 열어 한 장만 보고 나온다 — 뒤 차례의 판이 「하던 판」으로 남는다 */
    await page.locator('.tdq-row', { hasText: '새로 배우기' }).click();
    await page.waitForTimeout(800);
    { const go = page.locator('.study.intro .bigstart'); if (await go.count()) { await go.click(); await page.waitForTimeout(800); } }
    { const card = page.locator('.studycard'); if (await card.count()) { await card.click(); await page.locator('.judgerow').waitFor({ timeout: 5000 }).catch(() => {}); } }
    { const k = page.locator('.judgerow button', { hasText: '알아요' }); if (await k.count()) { await k.click(); await page.waitForTimeout(700); } }
    await page.locator('.sh-close').first().click();
    await page.waitForTimeout(600);
    await home(page);
    c = await cta(page);
    ok('★ 하던 새 단어 판이 있어도 큰 버튼은 「다음: 쭉 퀴즈」다 ★', c.step === 'stream' && c.text.includes('다음: 쭉 퀴즈') && !c.text.includes('이어하기'), c.text);
    const other = page.locator('.td-resume-other');
    ok('★ 하던 판은 큰 버튼 밑에 작게 남는다 ★', await other.count() === 1 && (await other.innerText()).includes('하던 판 이어하기'), (await other.innerText().catch(() => '')).replace(/\s+/g, ' '));
    ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await page.locator('.bigcta').click();
    await page.waitForTimeout(1200);
    ok('★ 큰 버튼을 누르면 쭉 퀴즈가 설정 화면 없이 바로 첫 문제로 열린다 ★', await page.locator('.st-run').count() === 1 && await page.locator('.st-intro').count() === 0);
    await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click();
    await page.waitForTimeout(600);
    await home(page);
    await page.locator('.td-resume-other').click();
    await page.waitForTimeout(900);
    ok('작은 줄을 누르면 하던 새 단어 판으로 돌아간다', await page.locator('.studycard').count() === 1 && !(await page.textContent('.sh-title')).includes(' 0 /'));
    await ctx.close();
  }

  console.log('\n[ 메뉴에서 연 쭉 퀴즈는 전처럼 설정부터 ]');
  {
    const { ctx, page } = await boot(browser, known(12));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('.tabbar .tab[data-tab="me"]').click(); await page.waitForTimeout(500);
    await page.locator('.me-row[data-row="quiz"]').click(); await page.waitForTimeout(700);
    await page.locator('.pr-row[data-menu="stream"]').click(); await page.waitForTimeout(900);
    ok('설정 화면(한 번에 몇 문제)이 나오고 저절로 시작하지 않는다', await page.locator('.st-intro').count() === 1 && await page.locator('.st-run').count() === 0 && await page.locator('.st-batch .chip').count() === 4);
    await ctx.close();
  }

  console.log('\n[ 외운 것이 너무 적은 날 — 쭉 퀴즈를 풀 수 없다 ]');
  {
    const { ctx, page } = await boot(browser, known(2));
    page.on('pageerror', (e) => errors.push(e.message));
    ok('★ 풀 수 없는 쭉 퀴즈는 퀘스트 줄에 안 선다 ★', await page.locator('.tdq-row', { hasText: '쭉 퀴즈' }).count() === 0);
    const c = await cta(page);
    ok('★ 큰 버튼은 풀 수 있는 첫 차례(새로 배우기)를 가리킨다 ★', c.step === 'fresh' && c.text.includes('새로 배우기'), c.text);
    await page.locator('.bigcta').click();
    await page.waitForTimeout(900);
    ok('누르면 새 단어 판이 열린다', await page.locator('.study').count() === 1 && await page.locator('.st-intro').count() === 0);
    await ctx.close();
  }

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('CRASH', err); process.exit(1); });
