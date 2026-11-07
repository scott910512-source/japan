/* 퀴즈에서 「잘 모르겠어요」 · 뜻 칸에 문제 글자를 친 경우 · 곤에게 묻는 중에 글이 끊기지 않기.
 *
 *   · 찍어서 맞히면 통계가 틀어진다 — 모르면 「잘 모르겠어요」를 눌러 몰라요로 남긴다(정답을 바로 보여 준다)
 *   · 뜻을 한국어로 쓰는 칸에 문제의 한자를 그대로 쳐서 낸 것은 틀린 게 아니다 — 채점하지 않고 안내한다
 *   · 곤에게 물어보는 창에서 글을 치는 중에 퀴즈가 저절로 넘어가도, 글이 퀴즈 칸으로 새지 않는다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5').slice(0, 40);
const review = Object.fromEntries(N5.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) }]));

async function boot(browser, { settings = {}, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ settings, rv }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_stream_batch', '0');
    const s = { onboarded: true, canReadKana: true, autoTTS: false, geminiKey: 'AQ.test-not-a-real-key', ...settings };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
  }, { settings, rv: review });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const reviewOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
async function startWordQuiz(page) {
  await openMenu(page, '단어 시험');
  await page.waitForTimeout(700);
  const st = page.locator('button', { hasText: '시험 시작' }).first();
  if (await st.count()) await st.click(); else await page.locator('.submit-btn').first().click();
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 단어 시험(고르기) — 잘 모르겠어요 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await startWordQuiz(page);
    ok('시험이 시작되고 「잘 모르겠어요」 버튼이 있다', await page.locator('.qoptions').count() === 1 && await page.locator('.qz-dunno').count() === 1);
    await page.locator('.qz-dunno').click();
    await page.waitForTimeout(400);
    ok('★ 누르면 정답이 바로 보이고 내가 고른 오답 표시는 없다 ★', await page.locator('.qopt.correct').count() === 1 && await page.locator('.qopt.wrong').count() === 0);
    ok('「다음 문제」 버튼이 있다(맞은 게 아니라 저절로 안 넘어간다)', await page.locator('.qnext .submit-btn').count() === 1);
    await page.waitForTimeout(1500);
    ok('★ 1.5초 뒤에도 그 문제 그대로 ★', await page.locator('.qopt.correct').count() === 1);
    ok('답을 낸 뒤에는 「잘 모르겠어요」가 없다', await page.locator('.qz-dunno').count() === 0);
    /* 끝까지 풀면 틀린 목록에 그 낱말이 있다 */
    let steps = 0;
    while (steps < 60 && await page.locator('.quizscore').count() === 0) {
      steps += 1;
      if (await page.locator('.qoptions').count() && await page.locator('.qz-dunno').count()) { await page.locator('.qopt').nth(steps % 3).click(); await page.waitForTimeout(260); }
      const nb = page.locator('.qnext .submit-btn');
      if (await nb.count()) { await nb.click(); await page.waitForTimeout(220); } else await page.waitForTimeout(700);
    }
    ok('결과 화면에 틀린 단어 목록이 있다(잘 모르겠어요도 틀린 것으로 센다)', await page.locator('.qwrow').count() >= 1);
    await page.close();
  }

  console.log('\n[ 단어 시험(직접 입력) — 문제 글자를 그대로 친 경우 ]');
  {
    const page = await boot(browser, { settings: { quizType: 'typing', quizDir: 'jp-ko' } });
    page.on('pageerror', (e) => errors.push(e.message));
    await startWordQuiz(page);
    ok('직접 입력 문제다', await page.locator('.qtyping input').count() === 1);
    const prompt = (await page.locator('.qc-prompt').innerText()).trim();
    await page.locator('.qtyping input').fill(prompt);
    await page.locator('.qtyping .submit-btn').click();
    await page.waitForTimeout(500);
    ok('★ 문제 글자를 그대로 쳐도 틀렸다고 하지 않는다 ★', await page.locator('.qverdict.wrong, .qverdict').count() === 0 && await page.locator('.qtyping input:not([disabled])').count() === 1);
    ok('★ 무엇을 쓰는 칸인지 알려 준다 ★', (await page.locator('.toast, [role="status"]').allInnerTexts().catch(() => [])).join(' ').includes('뜻을 한국어로'), (await page.locator('body').innerText()).includes('뜻을 한국어로') ? '안내 보임' : '안내 없음');
    await page.locator('.qz-dunno').click();
    await page.waitForTimeout(400);
    ok('직접 입력에서도 「잘 모르겠어요」로 정답을 본다', await page.locator('.qverdict.wrong').count() === 1);
    await page.close();
  }

  console.log('\n[ 쭉 퀴즈 — 잘 모르겠어요는 「몰라요」로 남는다 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '쭉 퀴즈');
    await page.waitForTimeout(900);
    if (await page.locator('.st-start').count()) { await page.locator('.st-start').click(); await page.waitForTimeout(700); }
    ok('쭉 퀴즈에 「잘 모르겠어요」가 있다', await page.locator('.st-dunno').count() === 1);
    const id = await page.locator('.st-run').getAttribute('data-id');
    const before = (await reviewOf(page))[id];
    await page.locator('.st-dunno').click();
    await page.waitForTimeout(500);
    ok('★ 정답이 보이고 틀린 것으로 세어진다 ★', await page.locator('.st-opt.correct, .st-explain').count() >= 1);
    await page.waitForTimeout(1500);
    ok('★ 저절로 안 넘어간다 ★', (await page.locator('.st-run').getAttribute('data-id')) === id);
    const after = (await reviewOf(page))[id];
    ok('★ 복습 기록이 「몰라요」(틀림)로 올라간다 ★', after && (after.wrongCount || 0) > ((before && before.wrongCount) || 0), JSON.stringify(after)?.slice(0, 90));
    await page.close();
  }

  console.log('\n[ 곤에게 물어보는 중에 퀴즈가 넘어가도 글이 안 끊긴다 ]');
  {
    const page = await boot(browser, { touch: true, settings: { quizType: 'typing', quizDir: 'ko-jp' } });
    page.on('pageerror', (e) => errors.push(e.message));
    await startWordQuiz(page);
    const prompt = (await page.locator('.qc-prompt').innerText()).trim();
    const w = WORDS.find((x) => x.mean === prompt) || WORDS.find((x) => String(x.mean).split(/[;/]/).map((m) => m.trim()).includes(prompt));
    ok('시험 문제에서 정답 낱말을 찾았다', Boolean(w), prompt);
    const head0 = (await page.locator('.sh-title').first().innerText()).trim();
    await page.locator('.qtyping input').fill(w.kana);
    await page.locator('.qtyping .submit-btn').click();      // 맞히면 0.8초 뒤 저절로 다음 문제(터치 기기)
    await page.waitForTimeout(150);
    await page.locator('.gonfab').click();
    await page.waitForTimeout(450);                          // 질문 창 초점이 자리 잡을 시간
    const ta = page.locator('.asksheet textarea');
    ok('질문 창이 열렸다', await ta.count() === 1);
    await ta.click();
    const text = 'ここがつづくかどうかをためしています';
    await ta.pressSequentially(text, { delay: 120 });       // 약 2초 — 그 사이 저절로 넘어갈 시간이 지난다
    await page.waitForTimeout(600);
    ok('★ 치던 글이 끝까지 질문 칸에 들어갔다(끊기지 않았다) ★', (await ta.inputValue()) === text, (await ta.inputValue()).slice(0, 30));
    ok('★ 질문 칸이 계속 초점을 갖고 있다 ★', await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'));
    ok('★ 묻는 동안 문제가 저절로 안 넘어갔다 ★', (await page.locator('.sh-title').first().innerText()).trim() === head0);
    await page.close();
  }

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
