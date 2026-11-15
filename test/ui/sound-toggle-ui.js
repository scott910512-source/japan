/* 소리 켬 · 눈으로만 — 학습 · 복습 · 시험 화면 안에서 바로 바꾼다
 *
 * 소리를 낼 수 없는 자리에서는 눈으로만 풀고, 듣기 단추를 눌렀을 때만 소리가 나야 한다.
 *   · 회독 화면 머리에 「소리 켬」 단추가 있다. 기본은 켬 — 카드가 나오면 읽어 준다
 *   · 누르면 「눈으로만」: 그 뒤 카드는 알아서 읽지 않고, 듣기만으로 맞히는 단계는 글자를 보고 떠올리는 단계로 바뀐다
 *   · 듣기 단추(🔊)를 누르면 그때는 소리가 난다
 *   · 설정에 남아서 시험 화면에서도 그대로다. 시험 화면에서도 바꿀 수 있다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const N5 = (allWords.ALL_WORDS || allWords.default).filter((w) => String(w.level).toUpperCase() === 'N5');
/* 복습 차례가 된 낱말 여덟 개 — 연속 정답 2번이라 「듣기」 단계(글자를 가리고 소리로만 맞히는 판)다 */
const review = Object.fromEntries(N5.slice(0, 8).map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1), streak: 2 }]));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.addInitScript(({ rv }) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('jp_manabu_guest_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, goalsV: 3, goals: { fresh: 5, review: 8, weak: 2 }, quizDirV: 1, quizDir: 'jp-ko', quizType: 'choice', quizCount: 10 }));
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    }
    /* 가짜 기기 음성 — 무엇을 읽었는지만 적는다(빈 발화는 소리 열기라 안 센다) */
    window._spoken = [];
    const synth = window.speechSynthesis;
    if (synth) { synth.speak = (u) => { if (u.text.trim()) window._spoken.push(u.text); setTimeout(() => u.onend?.({}), 40); }; synth.cancel = () => {}; }
  }, { rv: review });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  const spoken = () => page.evaluate(() => window._spoken.length);
  const setting = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).autoTTS);

  console.log('\n[ 회독 화면 — 기본은 소리 켬 ]');
  await goTab(page, '오늘');
  await page.locator('.bigcta').first().click();
  await page.waitForTimeout(1000);
  if (await page.locator('.study.intro').count()) { await page.locator('.study .bigstart').first().click(); await page.waitForTimeout(700); }
  await page.locator('.studycard').waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  ok('★ 머리에 「소리 켬」 단추가 있다 ★', await page.locator('.studyhead .soundtoggle[data-sound="on"]').count() === 1 && (await page.locator('.studyhead .soundtoggle').innerText()).includes('소리 켬'));
  ok('기본은 듣기 단계(글자를 가리고 소리로 맞힌다)', (await page.locator('.sc-step').innerText()).includes('듣기'), await page.locator('.sc-step').innerText());
  const n0 = await spoken();
  ok('★ 소리 켬: 카드가 나오면 알아서 읽어 준다 ★', n0 >= 1, `${n0}번`);
  ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 눈으로만 ]');
  await page.locator('.studyhead .soundtoggle').click();
  await page.waitForTimeout(500);
  ok('★ 누르면 「눈으로만」으로 바뀌고 설정에 남는다 ★', await page.locator('.studyhead .soundtoggle[data-sound="off"]').count() === 1 && (await page.locator('.studyhead .soundtoggle').innerText()).includes('눈으로만') && await setting() === false);
  ok('무엇이 바뀌었는지 알려 준다', (await page.locator('.toast').innerText().catch(() => '')).includes('듣기 단추를 눌러야만'));
  ok('★ 듣기 단계가 글자를 보고 떠올리는 단계로 바뀐다(눈으로 풀 수 있다) ★', (await page.locator('.sc-step').innerText()).includes('떠올리기') && (await page.locator('.studycard .sc-main').innerText()).trim().length > 0, await page.locator('.sc-step').innerText());
  const n1 = await spoken();
  /* 카드 세 장을 넘긴다 — 뒤집고 「알아요」 */
  for (let k = 0; k < 3; k += 1) {
    await page.locator('.studycard').click(); await page.waitForTimeout(200);
    await page.locator('.judgerow .judge.known').click(); await page.waitForTimeout(600);
  }
  ok('★ 카드를 넘겨도 알아서 읽지 않는다 ★', await spoken() === n1, `${n1} → ${await spoken()}`);
  await page.locator('.studycard .sc-speak').click();
  await page.waitForTimeout(400);
  ok('★ 듣기 단추를 누르면 그때는 소리가 난다 ★', await spoken() === n1 + 1, `${await spoken() - n1}번`);

  console.log('\n[ 다시 소리 켬 ]');
  await page.locator('.studyhead .soundtoggle').click();
  await page.waitForTimeout(500);
  ok('다시 누르면 「소리 켬」', await page.locator('.studyhead .soundtoggle[data-sound="on"]').count() === 1 && await setting() === true);
  const n2 = await spoken();
  await page.locator('.studycard').click(); await page.waitForTimeout(200);
  if (await page.locator('.judgerow .judge.known').count()) { await page.locator('.judgerow .judge.known').click(); await page.waitForTimeout(900); }
  ok('★ 켜면 다음 카드부터 다시 읽어 준다 ★', await spoken() > n2, `${n2} → ${await spoken()}`);
  await page.locator('.studyhead .soundtoggle').click();     // 끈 채로 시험 화면으로 간다
  await page.waitForTimeout(400);
  await page.locator('.study .sh-close').click();
  await page.waitForTimeout(600);

  console.log('\n[ 시험 화면에서도 그대로 · 거기서도 바꾼다 ]');
  await openMenu(page, '단어 시험');
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  await page.locator('.quizhead').waitFor({ timeout: 15000 });
  ok('★ 시험 머리에도 단추가 있고 끈 채 그대로다 ★', await page.locator('.quizhead .soundtoggle[data-sound="off"]').count() === 1);
  const n3 = await spoken();
  await page.locator('.qoptions .qopt').first().click();
  await page.waitForTimeout(1900);
  ok('★ 눈으로만: 문제도 답도 예문도 알아서 읽지 않는다 ★', await spoken() === n3, `${n3} → ${await spoken()}`);
  await page.locator('.quizhead .soundtoggle').click();
  await page.waitForTimeout(400);
  ok('시험 화면에서 켜면 설정이 바뀐다', await page.locator('.quizhead .soundtoggle[data-sound="on"]').count() === 1 && await setting() === true);
  ok('가로로 넘치지 않는다(시험)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
