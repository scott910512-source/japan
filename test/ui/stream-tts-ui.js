/* 쭉 퀴즈 자동 읽기 — 설정의 「자동 읽기」를 켜면 읽어 준다.
 *   · 일→한 문제(문제가 일본어)는 문제 글자를 바로 읽는다 — 답이 새지 않는다
 *   · 한→일 문제(문제가 한국어)는 답을 내기 전엔 읽지 않는다 — 정답이 소리로 샌다
 *   · 자동 읽기를 끄면 아무것도 안 읽는다
 *   · 틀린 단어의 정답 카드에는 예문 읽기(가나)가 보인다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openQuizHub } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const known = (ago = 5) => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -ago));
const words = ALL_WORDS.filter((w) => w.level === 'N5' && w.example && w.exampleKana).slice(0, 24);
const seeded = Object.fromEntries(words.map((w) => [w.id, { ...known(), due: addDays(today, -1) }]));

async function boot(browser, autoTTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ review, autoTTS }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_stream_batch', '0');   // 끝없이 — 스무 문제에서 끊기지 않게
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS, goalLevel: 'N5' });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review: seeded, autoTTS });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });
  await page.evaluate(() => {
    window._spoken = [];
    /* 읽은 순간의 문제 id와 「답을 낸 뒤인가」를 같이 적는다 — 나중에 지우거나 시간으로 어림하지 않고 문제별로 가린다 */
    window.speechSynthesis.speak = (u) => window._spoken.push({
      text: u.text,
      /* 같은 낱말이 방향만 바꿔 다시 나올 수 있어서 문제 글자까지 같이 본다 */
      qid: `${document.querySelector('.st-run')?.dataset.id || ''}|${document.querySelector('.st-q .qc-prompt')?.textContent || ''}`,
      answered: Boolean(document.querySelector('.st-opt.correct, .qverdict')),
    });
    window.speechSynthesis.cancel = () => {};
  });
  await openQuizHub(page);
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 자동 읽기 켬 ]');
  const page = await boot(browser, true);
  page.on('pageerror', (e) => errors.push(e.message));
  /* ★ 운에 맡기지 않는다 ★ 문제 방향과 방식은 무작위다. 예전엔 열네 문제 안에 세 가지가 다 나오기를 바랐고(백 번에 서너 번은 안 나왔다),
     읽은 기록을 지우는 때가 다음 문제의 읽기와 겹치기도 했다. 이제 문제마다 「답을 내기 전에 읽었나」를 기록에서 가리고,
     세 가지를 다 볼 때까지(넉넉히 60문제까지) 푼다. */
  const jpQs = new Set(); const koQs = new Set(); let sawKana = false;
  const spokenBefore = (qid) => page.evaluate((id) => window._spoken.some((x) => x.qid === id && !x.answered), qid);
  let sawJp = false; let sawKo = false; let koLeak = false;
  for (let i = 0; i < 60 && !(sawJp && sawKo && sawKana); i++) {
    const run = page.locator('.st-run');
    if (!(await run.count())) break;
    await page.waitForTimeout(500);
    const rawId = await run.getAttribute('data-id');
    const qid = `${rawId}|${await page.locator('.st-q .qc-prompt').textContent()}`;
    const kind = await page.locator('.st-q').innerText();
    const jpPrompt = /뜻을 고르세요/.test(kind);
    const koPrompt = /일본어로 뭘까요/.test(kind);
    if (jpPrompt && !jpQs.has(qid)) { jpQs.add(qid); if (await spokenBefore(qid)) sawJp = true; }
    if (koPrompt && !koQs.has(qid)) { koQs.add(qid); if (await spokenBefore(qid)) koLeak = true; else sawKo = true; }
    if ((await run.getAttribute('data-mode')) === 'typing') { await page.locator('.st-input').fill('ㅋㅋㅋ'); await page.locator('.st-submit').click(); }
    else await page.locator('.st-opt').last().click();
    await page.waitForTimeout(600);
    if (await page.locator('.ex-kana').count()) sawKana = true;
    const nextBtn = page.locator('.st-next');
    if (await nextBtn.count()) await nextBtn.click();
    else await page.waitForFunction((id) => `${document.querySelector('.st-run')?.dataset.id}|${document.querySelector('.st-q .qc-prompt')?.textContent}` !== id, qid, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  ok('★ 일→한 문제는 문제를 바로 읽는다 ★', sawJp, `일→한 ${jpQs.size}문제`);
  ok('★ 한→일 문제는 답을 내기 전에 읽지 않는다 ★', sawKo && !koLeak, `한→일 ${koQs.size}문제`);
  ok('★ 틀린 단어의 정답 카드에 예문 읽기(가나)가 있다 ★', sawKana);
  await page.close();

  console.log('\n[ 자동 읽기 끔 ]');
  const quiet = await boot(browser, false);
  await quiet.waitForTimeout(800);
  ok('아무것도 안 읽는다', (await quiet.evaluate(() => window._spoken.length)) === 0);
  await quiet.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
