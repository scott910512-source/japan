/* 주관식을 맞혔을 때 — 맞았다는 표시와 설명이 뜨고, 직접 넘긴다
 *
 * 객관식은 맞은 보기에 표시가 뜨지만, 주관식은 맞혀도 아무 말 없이 0.75초 뒤에 다음 문제로 넘어가서
 * 맞았는지조차 알 수 없었다.
 *   · 맞히면 「맞았어요」와 그 낱말(표기 · 읽는 법 · 뜻), 예문이 뜬다
 *   · 알아서 넘어가지 않는다 — 「다음 문제」를 눌러 넘긴다
 *   · 틀렸을 때는 전과 같다(정답은 ○○) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const WORDS = allWords.ALL_WORDS || allWords.default;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('jp_manabu_guest_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3, quizDirV: 1, quizDir: 'ko-jp', quizType: 'typing', quizCount: 20, levels: ['N5'] }));
    }
    window.speechSynthesis.speak = () => {};
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await openMenu(page, '단어 시험');
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  await page.locator('.qtyping input').waitFor({ timeout: 15000 });

  /* 뜻이 하나뿐인 낱말이 나올 때까지 틀리게 넘긴다(같은 뜻의 낱말이 여럿이면 어느 것을 묻는지 모른다) */
  let word = null; let wrongSeen = false;
  for (let k = 0; k < 18 && !word; k += 1) {
    const prompt = norm(await page.locator('.qc-prompt').innerText());
    const cands = WORDS.filter((w) => norm(w.mean) === prompt && w.kana);
    if (cands.length === 1) { word = cands[0]; break; }
    await page.locator('.qtyping input').fill('ㅋ');
    await page.locator('.qtyping .submit-btn').click();
    await page.waitForTimeout(350);
    if (!wrongSeen) {
      wrongSeen = true;
      ok('틀렸을 때는 전과 같다(정답은 ○○ · 다음 문제)', (await page.locator('.qverdict.wrong').innerText()).includes('정답은') && await page.locator('.qnext .submit-btn').count() === 1);
    }
    await page.locator('.qnext .submit-btn').click();
    await page.waitForTimeout(350);
  }
  ok('뜻이 하나뿐인 낱말을 만났다', Boolean(word), word ? `${word.mean} → ${word.kana}` : '');
  if (word) {
    console.log('\n[ 주관식을 맞히면 ]');
    const head = await page.locator('.quizhead .sh-title').innerText();
    await page.locator('.qtyping input').fill(word.kana);
    await page.locator('.qtyping .submit-btn').click();
    await page.waitForTimeout(500);
    const v = norm(await page.locator('.qverdict.correct').innerText().catch(() => ''));
    ok('★ 「맞았어요」가 뜬다 ★', v.includes('맞았어요'), v.slice(0, 80));
    ok('★ 그 낱말의 표기 · 읽는 법 · 뜻이 같이 보인다 ★', v.includes(word.kanji || word.kana) && v.includes(word.kana) && v.includes(norm(word.mean)), v.slice(0, 120));
    if (word.example) ok('★ 예문과 해석이 보인다 ★', v.includes(norm(word.example)) && v.includes(norm(word.exampleKo)), v.slice(-80));
    await page.waitForTimeout(1800);
    ok('★ 알아서 넘어가지 않는다(읽을 시간이 있다) ★', await page.locator('.quizhead .sh-title').innerText() === head && await page.locator('.qverdict.correct').count() === 1, `${head} → ${await page.locator('.quizhead .sh-title').innerText()}`);
    ok('★ 「다음 문제」 단추가 있다 ★', await page.locator('.qnext .submit-btn').count() === 1);
    ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.qnext .submit-btn').click();
    await page.waitForTimeout(500);
    ok('★ 누르면 다음 문제로 넘어간다 ★', await page.locator('.quizhead .sh-title').innerText() !== head && await page.locator('.qverdict').count() === 0);
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
