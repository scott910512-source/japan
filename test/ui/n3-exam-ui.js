/* N3 코스 — 청해와 모의고사.
 *
 *   청해: 스크립트는 답을 고르기 전에 안 보인다 · 줄을 이어 읽는다(겹치지 않게) ·
 *         속도 0.75/1/1.25 · 문제 → 다시 듣기 → 스크립트 → 분석 → 섀도잉 → 완료
 *   모의고사: 문자·어휘 → 문법(배열·글의 문법 포함) → 독해 → 청해 → 영역별 결과가 저장된다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { GRAMMAR_QUESTIONS } from '../../src/data/n3/grammar.js';
import { READING_QUESTIONS } from '../../src/data/n3/reading.js';
import { LISTENING_QUESTIONS, LISTENING_ITEMS } from '../../src/data/n3/listening.js';
import { EXAM_QUESTIONS } from '../../src/data/n3/exam.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const FIXED = new Map([...GRAMMAR_QUESTIONS, ...READING_QUESTIONS, ...LISTENING_QUESTIONS, ...EXAM_QUESTIONS].map((q) => [q.id, q.answer]));

/* 실전 모드는 고르면 바로 넘어간다 — 「다음」이 없다 */
async function solveExam(page, { max = 80, wrongEvery = 0, sec = null, passage = null } = {}) {
  const seen = [];
  for (let i = 0; i < max; i += 1) {
    /* 영역·지문이 바뀌면 이 판은 끝난 것 — 다음 영역 문제를 여기서 먹지 않는다 */
    if (sec && (await page.locator('.n3-exam').getAttribute('data-sec')) !== sec) break;
    if (passage && (await page.locator('.n3-reading').count()) && (await page.locator('.n3-reading').getAttribute('data-passage')) !== passage) break;
    const runner = page.locator('.n3-quiz');
    if (!(await runner.count())) { await page.waitForTimeout(200); if (!(await runner.count())) break; }
    const qid = await runner.getAttribute('data-qid');
    if (!qid || seen.at(-1) === qid) { await page.waitForTimeout(150); continue; }
    seen.push(qid);
    const ans = FIXED.get(qid);
    const opts = runner.locator('.qopt');
    const n = await opts.count();
    const wrong = wrongEvery && seen.length % wrongEvery === 0;
    let target = null;
    for (let j = 0; j < n; j += 1) {
      const opt = await opts.nth(j).getAttribute('data-opt');
      if (wrong ? opt !== ans : opt === ans) { target = opts.nth(j); break; }
    }
    await (target || opts.first()).click();
    await page.waitForTimeout(450);
    const next = page.locator('.n3-next');
    if (await next.count()) { await next.click(); await page.waitForTimeout(250); }
  }
  return seen;
}

const initScript = `
  window.__said = [];
  (() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices = () => [{ voiceURI: 'ja', name: 'Kyoko', lang: 'ja-JP' }];
    Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', { configurable: true, get() { return this.__voice || null; }, set(v) { this.__voice = v; } });
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '', rate: u?.rate, at: Date.now() });
      setTimeout(() => { try { u.onstart?.(); } catch {} }, 10);
      setTimeout(() => { try { u.onend?.(); } catch {} }, 150);
    };
    synth.cancel = () => {};
  })();
`;

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(initScript);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    sessionStorage.removeItem('jp_n3_view_v1');
  });
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return { page, errors };
}
const n3of = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').n3 || null);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const { page, errors } = await boot(browser);
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor({ timeout: 8000 });

  console.log('── 청해 레슨');
  await page.locator('.n3-tile', { hasText: '전체 과정' }).click();
  await page.locator('.n3-curriculum').waitFor();
  await page.locator('.n3-chapter[data-chapter="ch6"] .n3-chhead').click(); await page.waitForTimeout(200);
  await page.locator('.n3-group[data-group="ll1"] .n3-ghead').click(); await page.waitForTimeout(200);
  await page.locator('.n3-lrow[data-lesson="l:1"]').click();
  await page.locator('.n3-listening').waitFor();
  const item = LISTENING_ITEMS.find((l) => l.id === 'l:1');
  ok('★ 스크립트는 처음엔 안 보인다 ★', await page.locator('.n3-script').count() === 0 && await page.locator('.n3-dline').count() === 0);
  ok('속도 셋', await page.locator('.n3-speeds .chip').count() === 3);
  ok('듣기 전에는 문제로 못 간다', await page.locator('.n3-toq').isDisabled());
  await page.locator('.n3-speeds .chip[data-speed="0.75"]').click();
  await page.evaluate(() => { window.__said = []; });
  await page.locator('.n3-playbtn').click();
  await page.waitForTimeout(item.script.length * 600 + 800);
  const said = await page.evaluate(() => window.__said);
  ok('★ 줄을 차례로 이어 읽는다 — 겹치지 않고 하나씩 ★', said.length === item.script.length && said.every((s, i) => s.text === item.script[i].kana && s.lang === 'ja-JP'), `${said.length}줄`);
  ok('줄 사이가 떨어져 있다(앞 줄이 끝난 뒤)', said.every((s, i) => i === 0 || s.at - said[i - 1].at >= 150));
  ok('0.75배로 넘겼다', said.every((s) => s.rate < 0.8), `${said[0]?.rate}`);
  ok('다 들으면 문제로 갈 수 있다', !(await page.locator('.n3-toq').isDisabled()));
  await page.locator('.n3-toq').click();
  await page.locator('.n3-quiz').waitFor();
  ok('문제 하나, 보기 셋, 스크립트는 아직 숨김', await page.locator('.n3-quiz .qopt').count() === 3 && await page.locator('.n3-script').count() === 0);
  const ans = FIXED.get(await page.locator('.n3-quiz').getAttribute('data-qid'));
  await page.locator(`.n3-quiz .qopt[data-opt="${ans}"]`).click();
  await page.waitForTimeout(400);
  ok('맞히면 설명이 뜨고 「다시 듣기」로 넘어간다', (await page.locator('.n3-fb').innerText()).includes('정답') && (await page.locator('.n3-next').innerText()).includes('다시 듣기'));
  await page.locator('.n3-next').click();
  await page.waitForTimeout(400);
  ok('답을 고르면 다시 듣기 단계로', await page.locator('.n3-listening[data-step="2"]').count() === 1);
  await page.locator('.n3-listening .submit-btn').click(); await page.waitForTimeout(200);
  ok('★ 이제 스크립트가 보인다 — 줄마다 뜻·🔊 ★', await page.locator('.n3-script .n3-dline').count() === item.script.length && await page.locator('.n3-script .spk').count() === item.script.length);
  await page.locator('.n3-listening .submit-btn').click(); await page.waitForTimeout(200);
  ok('문장 분석', await page.locator('.n3-ana').count() >= 2);
  await page.locator('.n3-listening .submit-btn').click(); await page.waitForTimeout(200);
  ok('섀도잉 줄', await page.locator('.n3-shline').count() === item.shadow.length);
  await page.locator('.n3-finish-btn').click();
  await page.locator('.n3-curriculum').waitFor();
  const n3a = await n3of(page);
  ok('청해 결과가 기록되고 레슨 완료', n3a.tests['l:1']?.right === 1 && n3a.lessons['l:1']?.done);

  console.log('\n── 모의고사');
  await page.locator('.n3-chapter[data-chapter="ch7"] .n3-chhead').click(); await page.waitForTimeout(200);
  await page.locator('.n3-testbtn[data-test="exam"]').click();
  await page.locator('.n3-exam[data-sec="moji"]').waitFor();
  const moji = await solveExam(page, { wrongEvery: 5, sec: 'moji' });
  ok('문자·어휘 25문제', moji.length === 25, `${moji.length}`);
  await page.locator('.n3-exam[data-sec="bunpo"]').waitFor();
  const bunpo = await solveExam(page, { wrongEvery: 6, sec: 'bunpo' });
  ok('문법 22문제 — 배열(★)과 글의 문법이 섞여 있다', bunpo.length === 22 && bunpo.some((id) => id.startsWith('x:nar-')) && bunpo.some((id) => id.startsWith('x:bs-')), `${bunpo.length}`);
  await page.locator('.n3-exam[data-sec="dokkai"]').waitFor();
  let dq = 0;
  for (let p = 0; p < 4; p += 1) {
    await page.locator('.n3-reading').waitFor();
    const pid = await page.locator('.n3-reading').getAttribute('data-passage');
    ok(`독해 지문 ${p + 1} — 해설 없이 지문과 문제`, await page.locator('.n3-ptext').count() === 1 && await page.locator('.n3-ana').count() === 0);
    dq += (await solveExam(page, { passage: pid })).length;
    await page.waitForTimeout(300);
  }
  ok('독해 문제를 다 풀었다', dq >= 8, `${dq}`);
  await page.locator('.n3-exam[data-sec="chokai"]').waitFor();
  for (let i = 0; i < 6; i += 1) {
    await page.locator('.n3-listening').waitFor();
    const itemId = await page.locator('.n3-listening').getAttribute('data-item');
    const it = LISTENING_ITEMS.find((l) => l.id === itemId);
    await page.locator('.n3-playbtn').click();
    await page.waitForTimeout(it.script.length * 600 + 800);
    await page.locator('.n3-toq').click();
    await page.locator('.n3-quiz').waitFor();
    await solveExam(page);
    await page.waitForTimeout(300);
  }
  await page.locator('.n3-examresult').waitFor({ timeout: 10000 });
  const pct = Number(await page.locator('.n3-examresult').getAttribute('data-pct'));
  ok('★ 결과 — 영역별 막대 넷, 전체 정답률 ★', await page.locator('.n3-examresult .n3-bar').count() === 4 && pct > 50 && pct < 100, `${pct}%`);
  ok('틀린 문제 해설이 붙는다', await page.locator('.n3-examresult .n3-wrongcard').count() >= 5);
  await page.locator('.n3-done').click();
  await page.locator('.n3-curriculum').waitFor();
  const n3b = await n3of(page);
  ok('★ 모의고사 결과가 저장된다(영역별 · 문제별 정답률) ★', n3b.exams.length === 1 && n3b.exams[0].sections.moji.total === 25 && n3b.tests.exam?.total >= 55 && Object.keys(n3b.q).length >= 55);
  ok('실전에서 틀린 것도 오답노트로', Object.keys(n3b.wrong).length >= 5);
  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200) || '없음');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); console.log(`\n통과 ${pass} / 실패 ${fail + 1}`); process.exit(1); });
