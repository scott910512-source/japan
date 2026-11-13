/* 퀘스트 시험을 풀다 새로고침해도 그 자리에서 잇는다 — 진짜 화면에서.
 *
 * 오늘 랜덤 테스트를 3번까지 풀고 새로고침하면 일반 「단어 시험」 설정 화면이 떴고, 퀘스트로 다시 들어가면 1번부터였다.
 *   · 새로고침해도 같은 시험의 같은 문항에서 잇는다(낸 답 · 점수도 그대로)
 *   · 끝까지 풀고 결과를 보다 새로고침하면 결과 화면이 그대로 뜬다(활동 · 오늘 몫을 두 번 적지 않는다)
 *   · 시험을 스스로 닫으면 풀던 자리를 지운다 — 다시 들어가면 새 시험이다
 *   · 약점 퀴즈도 같다 */
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
/* 외웠고 복습 차례는 아직인 낱말 12개 — 오늘 랜덤 테스트가 선다(오늘 배정된 새 낱말까지 섞여 서른 문제 남짓) */
const known = Object.fromEntries(N5.slice(0, 12).map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -2)), due: addDays(today, 6) }]));
/* 약한 낱말 12개 — 약점 퀴즈가 선다 */
const weak = Object.fromEntries(N5.slice(20, 32).map((w) => [w.id, { box: 1, streak: 0, lastSeen: addDays(today, -4), rounds: 3, wrongCount: 3, vagueCount: 1, seenAt: 1, due: addDays(today, 5) }]));

async function boot(browser, review) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"x"}' }));
  await ctx.addInitScript(({ rv, day }) => {
    if (localStorage.getItem('qa_seeded')) return;
    localStorage.setItem('qa_seeded', '1');
    localStorage.setItem('jp_manabu_guest_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
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
/* 한 문항 푼다 — 고르는 문제는 첫 보기, 쓰는 문제는 아무 글 */
async function answerOne(page) {
  if (await page.locator('.qoptions').count()) { await page.locator('.qopt').first().click(); await page.waitForTimeout(260); }
  else if (await page.locator('.qtyping input').count()) { await page.locator('.qtyping input').fill('ㅋ'); await page.locator('.qtyping .submit-btn').click(); await page.waitForTimeout(260); }
  const nextBtn = page.locator('.qnext .submit-btn');
  if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(220); } else await page.waitForTimeout(1100);
}
const head = async (page) => (await page.locator('.quizhead .sh-title').innerText()).replace(/\s/g, '');
const prompt = async (page) => (await page.locator('.quizcard').innerText()).replace(/\s+/g, ' ').slice(0, 60);
const reload = async (page) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar, .gate, .quizhead, .quizscore').first().waitFor({ timeout: 30000 });
  if (await page.locator('.gate-guest-btn').count()) await page.locator('.gate-guest-btn').click();
  await page.waitForTimeout(1500);
};
const keep = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_quiz_keep_v1') || 'null'));
const quizzed = (page) => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('jp_manabu_stats_v1') || '{}')).reduce((n, d) => n + (d.quizzed || 0), 0));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 오늘 랜덤 테스트 — 풀다가 새로고침 ]');
  {
    const { ctx, page } = await boot(browser, known);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('.tdq-row', { hasText: '오늘 랜덤 테스트' }).click();
    await page.locator('.quizhead').waitFor({ timeout: 10000 });
    const total = Number((await head(page)).split('/')[1]);
    ok('첫 문항에서 시작한다', (await head(page)) === `1/${total}` && total >= 10, await head(page));
    await answerOne(page); await answerOne(page); await answerOne(page);
    ok('네 번째 문항까지 왔다', await head(page) === `4/${total}`, await head(page));
    const before = { head: await head(page), prompt: await prompt(page), score: (await page.locator('.qh-score').innerText()).trim() };
    const k0 = await keep(page);
    ok('풀던 자리가 기기에 적혀 있다', k0?.mode === 'random' && k0.run?.index === 3 && Object.keys(k0.run.answers).length === 3, `${k0?.mode} · ${k0?.run?.index}`);

    await reload(page);
    ok('★ 새로고침해도 일반 「단어 시험」 설정 화면으로 떨어지지 않는다 ★', await page.locator('.quizhead').count() === 1 && await page.locator('button', { hasText: '시험 시작' }).count() === 0);
    ok('★ 같은 문항에서 잇는다(4번째) ★', await head(page) === before.head, await head(page));
    ok('★ 같은 문제다 ★', await prompt(page) === before.prompt, `${before.prompt} → ${await prompt(page)}`);
    ok('★ 낸 답의 점수도 그대로다 ★', (await page.locator('.qh-score').innerText()).trim() === before.score, before.score);

    for (let i = 0; i < 80 && await page.locator('.quizscore').count() === 0; i += 1) await answerOne(page);
    ok('끝까지 풀면 랜덤 테스트 결과가 뜬다', await page.locator('.wk-result[data-flow="random"]').count() === 1);
    await page.waitForTimeout(400);
    const done = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').quests?.random);
    const q1 = await quizzed(page);
    ok('오늘 몫이 적혔다', done === 1 && q1 === total, `random ${done} · 푼 문항 ${q1}`);
    const score = (await page.locator('.quizscore').innerText()).replace(/\s+/g, ' ');

    await reload(page);
    ok('★ 결과를 보다 새로고침하면 결과 화면이 그대로 뜬다 ★', await page.locator('.wk-result[data-flow="random"]').count() === 1 && (await page.locator('.quizscore').innerText()).replace(/\s+/g, ' ') === score, score);
    ok('★ 활동 기록을 두 번 적지 않는다 ★', await quizzed(page) === q1, `${q1} → ${await quizzed(page)}`);
    await page.locator('.flow-done').click();
    await page.waitForTimeout(800);
    ok('★ 결과에서 나가면 풀던 자리를 지운다 ★', await keep(page) === null && await page.locator('.subscreen.open').count() === 0);
    await ctx.close();
  }

  console.log('\n[ 약점 퀴즈 — 풀다가 새로고침 · 스스로 닫기 ]');
  {
    const { ctx, page } = await boot(browser, weak);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('.tdq-row', { hasText: '약점 퀴즈' }).click();
    await page.locator('.quizhead').waitFor({ timeout: 10000 });
    await answerOne(page); await answerOne(page);
    const before = { head: await head(page), prompt: await prompt(page) };
    ok('세 번째 문항까지 왔다', before.head === '3/12', before.head);
    const doneIds = await page.evaluate(() => (JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').weakQuiz?.ids || []).length);

    await reload(page);
    ok('★ 약점 퀴즈도 같은 문항에서 잇는다 ★', await page.locator('.quizhead').count() === 1 && await head(page) === before.head && await prompt(page) === before.prompt, `${await head(page)} · ${await prompt(page)}`);
    await answerOne(page);
    const after = await page.evaluate(() => (JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').weakQuiz?.ids || []).length);
    ok('★ 이어서 푼 문항도 약점 퀴즈 오늘 몫에 적힌다(약점 퀴즈로 되살아났다) ★', after === doneIds + 1, `${doneIds} → ${after}`);

    await page.locator('.quizhead .sh-close').click();
    await page.waitForTimeout(800);
    ok('★ 시험을 스스로 닫으면 풀던 자리를 지운다 ★', await keep(page) === null);
    await page.locator('.tabbar .tab[data-tab="home"]').click();
    await page.waitForTimeout(500);
    await page.locator('.tdq-row', { hasText: '약점 퀴즈' }).click();
    await page.locator('.quizhead').waitFor({ timeout: 10000 });
    ok('다시 들어가면 새 시험이다(1번부터, 남은 낱말로)', (await head(page)).startsWith('1/') && Number((await head(page)).split('/')[1]) === 12 - after, await head(page));
    await ctx.close();
  }

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('CRASH', err); process.exit(1); });
