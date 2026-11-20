/* 읽어 주는 때 — 설정 → 학습 설정 「읽어 주는 때: 문제 나올 때 · 답 낸 뒤」 (settings.ttsWhen)
 *   · 문제 나올 때(기본): 일→한 시험은 문제가 뜨자마자 읽는다, 회독 카드는 나오면 읽는다
 *   · 답 낸 뒤: 답을 고르기 전에는 안 읽고, 고르면(카드는 뒤집으면) 그때 읽는다
 *   · 듣기 단계는 소리가 문제라 「답 낸 뒤」여도 처음에 읽는다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu, openMore, goTab } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';
import { allFacets } from './_seed.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const N5 = (allWords.ALL_WORDS || allWords.default).filter((w) => String(w.level).toUpperCase() === 'N5' && !w.grammar);
/* 복습 차례가 된 낱말 열두 개 — 네 칸이 고르고 연속 정답 0이라 회독은 「읽기」 단계(글자를 보고 뜻) */
const review = Object.fromEntries(N5.slice(0, 12).map((w) => [w.id, allFacets({ ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1), streak: 0 })]));

async function boot(browser, ttsWhen, rv = review, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.addInitScript(({ rv, when, ex }) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('jp_manabu_guest_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: true, ...(when ? { ttsWhen: when } : {}), ...ex, goalsV: 3, goals: { fresh: 5, review: 8, weak: 2 }, quizDirV: 1, quizDir: 'jp-ko', quizType: 'choice', quizCount: 10 }));
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    }
    window._spoken = [];
    const synth = window.speechSynthesis;
    if (synth) { synth.speak = (u) => { if (u.text.trim()) window._spoken.push(u.text); setTimeout(() => u.onend?.({}), 40); }; synth.cancel = () => {}; }
  }, { rv, when: ttsWhen, ex: extra });
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  return { page, ctx };
}
const spoken = (page) => page.evaluate(() => window._spoken.length);
async function openQuiz(page) {
  await openMenu(page, '단어 시험');
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  await page.locator('.quizhead').waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
}
async function openStudy(page) {
  await goTab(page, '오늘');
  await page.locator('.bigcta').first().click();
  await page.waitForTimeout(1000);
  if (await page.locator('.study.intro').count()) { await page.locator('.study .bigstart').first().click(); await page.waitForTimeout(700); }
  await page.locator('.studycard').waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  console.log('\n[ 설정 — 읽어 주는 때 ]');
  {
    const { page, ctx } = await boot(browser, null);
    await openMore(page, 'study');
    const row = page.locator('.set-ttswhen:visible');
    ok('★ 학습 설정에 「읽어 주는 때」 — 문제 나올 때 · 답 낸 뒤 ★', await row.count() === 1 && await row.locator('button').count() === 2, await row.innerText().catch(() => ''));
    ok('기본은 「문제 나올 때」', (await row.locator('[data-when="start"]').getAttribute('aria-pressed')) === 'true');
    await row.locator('[data-when="end"]').click(); await page.waitForTimeout(300);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')));
    ok('★ 「답 낸 뒤」를 고르면 설정에 남는다 ★', st.ttsWhen === 'end' && (await row.locator('[data-when="end"]').getAttribute('aria-pressed')) === 'true');
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  console.log('\n[ 문제 나올 때(기본) ]');
  {
    const { page, ctx } = await boot(browser, null);
    await openQuiz(page);
    ok('★ 일→한 시험: 문제가 뜨면 바로 읽는다 ★', await spoken(page) >= 1, `${await spoken(page)}번`);
    await ctx.close();
  }
  {
    const { page, ctx } = await boot(browser, null);
    await openStudy(page);
    ok('★ 회독 카드: 나오면 바로 읽는다 ★', await spoken(page) >= 1, `${await spoken(page)}번`);
    await ctx.close();
  }

  console.log('\n[ 답 낸 뒤 ]');
  {
    const { page, ctx } = await boot(browser, 'end');
    await openQuiz(page);
    const n0 = await spoken(page);
    ok('★ 일→한 시험: 답을 고르기 전에는 안 읽는다 ★', n0 === 0, `${n0}번`);
    await page.locator('.qoptions .qopt').first().click();
    await page.waitForTimeout(700);
    ok('★ 답을 고르면 그때 읽는다 ★', await spoken(page) >= 1, `${await spoken(page)}번`);
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }
  {
    const { page, ctx } = await boot(browser, 'end');
    await openStudy(page);
    const step = await page.locator('.sc-step').innerText().catch(() => '');
    const n0 = await spoken(page);
    ok('★ 회독 카드: 앞면에서는 안 읽는다 ★', step.includes('듣기') || n0 === 0, `${step} · ${n0}번`);
    await page.locator('.studycard').click(); await page.waitForTimeout(700);
    ok('★ 뒤집어 답을 보면 그때 읽는다 ★', await spoken(page) > n0, `${n0} → ${await spoken(page)}`);
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  console.log('\n[ 듣기 칸 — 회독이 듣기로 묻고 듣기 칸에 적는다 ]');
  {
    const lv = (n) => ({ lv: n, due: addDays(today, -1), on: null });
    const base = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -9)), level: 0, due: addDays(today, -1), streak: 2 };
    const rv = Object.fromEntries(N5.filter((w) => /[\u3400-\u9fff]/.test(w.kanji || '')).slice(0, 6).map((w) => [w.id, { ...base, fx: { mean: lv(2), read: lv(2), prod: lv(2), listen: lv(0) } }]));
    const { page, ctx } = await boot(browser, null, rv);
    await openStudy(page);
    ok('★ 듣기 칸이 가장 약하면 「듣기」 단계로 묻는다 ★', (await page.locator('.sc-step').innerText()).includes('듣기'), await page.locator('.sc-step').innerText());
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1')));
    await page.locator('.studycard').click(); await page.waitForTimeout(300);
    await page.locator('.judgerow .judge.known').click(); await page.waitForTimeout(600);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1')));
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]?.fx) !== JSON.stringify(before[k]?.fx));
    const f = changed.length ? after[changed[0]].fx : null;
    ok('★ 알아요 → 듣기 칸만 오른다(뜻은 그대로) ★', f && f.listen.lv === 1 && f.mean.lv === 2, JSON.stringify(f));
    await ctx.close();
  }
  {
    const lv = (n) => ({ lv: n, due: addDays(today, -1), on: null });
    const base = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -9)), level: 0, due: addDays(today, -1), streak: 2 };
    const rv = Object.fromEntries(N5.filter((w) => /[\u3400-\u9fff]/.test(w.kanji || '')).slice(0, 6).map((w) => [w.id, { ...base, fx: { mean: lv(2), read: lv(2), prod: lv(2), listen: lv(0) } }]));
    const { page, ctx } = await boot(browser, null, rv, { autoTTS: false });
    await openStudy(page);
    ok('★ 눈으로만이면 듣기 칸은 미루고 다른 칸을 묻는다 ★', !(await page.locator('.sc-step').innerText()).includes('듣기'), await page.locator('.sc-step').innerText());
    await ctx.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
