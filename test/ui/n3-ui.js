/* 「한 권으로 끝내는 N3」 — 진짜 화면에서.
 *
 *   학습 탭 첫 칸에서 들어가지고, 메인에 진도·준비도·오늘 학습량·연속일이 뜬다
 *   오늘의 N3가 어휘 → 한자 → 문법 → 독해 순서로 짜인다
 *   어휘: 카드(표기·읽기·뜻·예문·🔊) → 문제 → 맞히면 회독 기록에 「알아요」로 적힌다(SRS 등록)
 *   문법: 설명 → 예문 → 비교 → 회화 → 문제 → 복습 → 레슨 완료가 진도에 적힌다
 *   틀리면 정답만이 아니라 「왜 틀렸나」가 한국어로 뜨고, 오답노트에 쌓인다
 *   새로고침해도 단계 완료·진도·숙련도가 남는다
 *   진단 테스트를 다 맞히면 Chapter 0 꼭지가 SKIP이 된다
 *   뒤로가기가 코스만 닫는다 · 375px에서 가로로 안 넘친다
 *   ★ 기존 회독 기록·설정을 안 건드린다 ★ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { GRAMMAR_QUESTIONS } from '../../src/data/n3/grammar.js';
import { READING_QUESTIONS } from '../../src/data/n3/reading.js';
import { LISTENING_QUESTIONS } from '../../src/data/n3/listening.js';
import { EXAM_QUESTIONS } from '../../src/data/n3/exam.js';
import { vocabWordById } from '../../src/data/n3/vocab.js';
import { kanjiByChar } from '../../src/data/n3/kanji.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 문제 id로 정답을 안다 — 화면에 답을 적어 두지 않으니 자료에서 다시 만든다 */
const FIXED = new Map([...GRAMMAR_QUESTIONS, ...READING_QUESTIONS, ...LISTENING_QUESTIONS, ...EXAM_QUESTIONS].map((q) => [q.id, q.answer]));
function answerOf(qid) {
  if (FIXED.has(qid)) return FIXED.get(qid);
  if (qid.startsWith('vq:')) {
    const [, wid, type] = qid.split(':'); const w = vocabWordById(wid);
    return type === 'ko' ? w.mean : type === 'jp' ? w.kanji : w.kana;
  }
  if (qid.startsWith('kq:')) { const [, ch, n] = qid.split(':'); return kanjiByChar(ch).words[Number(n)][1]; }
  return null;
}

/* 문제를 끝까지 푼다. wrongAt에 든 번째(0부터)는 일부러 틀린다. */
async function solve(page, { wrongAt = [], max = 40 } = {}) {
  const seen = [];
  for (let i = 0; i < max; i += 1) {
    const runner = page.locator('.n3-quiz');
    if (!(await runner.count())) break;
    const qid = await runner.getAttribute('data-qid');
    if (seen.at(-1) === qid) { await page.waitForTimeout(200); continue; }
    seen.push(qid);
    const ans = answerOf(qid);
    const opts = runner.locator('.qopt');
    const n = await opts.count();
    let target = null;
    for (let j = 0; j < n; j += 1) {
      const opt = await opts.nth(j).getAttribute('data-opt');
      const isAns = opt === ans;
      if (wrongAt.includes(seen.length - 1) ? !isAns : isAns) { target = opts.nth(j); break; }
    }
    await (target || opts.first()).click();
    await page.waitForTimeout(350);
    const next = page.locator('.n3-next');
    if (await next.count()) { await next.click(); await page.waitForTimeout(300); }
    else await page.waitForTimeout(300);
  }
  return seen;
}


/* 레슨의 단계 버튼을 누르고 실제로 다음 단계가 뜰 때까지 기다린다 —
   정해진 시간만 기다리면 느린 기기(검사가 몰린 CI)에서 같은 단계를 두 번 누른다 */
async function nextStep(page, root, n = 1) {
  for (let i = 0; i < n; i += 1) {
    const cur = await page.locator(root).getAttribute('data-step');
    await page.locator(`${root} .submit-btn`).last().click();
    await page.waitForFunction(([sel, c]) => document.querySelector(sel)?.dataset.step !== c, [root, cur], { timeout: 10000 });
  }
}

const initScript = `
  window.__said = [];
  (() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices = () => [{ voiceURI: 'ja', name: 'Kyoko', lang: 'ja-JP' }, { voiceURI: 'ko', name: 'Yuna', lang: 'ko-KR' }];
    Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', { configurable: true, get() { return this.__voice || null; }, set(v) { this.__voice = v; } });
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
      setTimeout(() => { try { u.onstart?.(); } catch {} }, 10);
      setTimeout(() => { try { u.onend?.(); } catch {} }, 120);
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
    /* 기존 기록 — 이 두 장은 코스가 안 건드려야 한다 */
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify({
      'n5-0001': { box: 3, streak: 2, level: 2, due: '2099-01-01', lastSeen: '2026-01-01', seenAt: 1, rounds: 2, wrongCount: 0, vagueCount: 0 },
      'n5-0002': { box: 1, streak: 0, level: 0, due: '2026-01-02', lastSeen: '2026-01-01', seenAt: 1, rounds: 1, wrongCount: 1, vagueCount: 0 },
    }));
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

const review = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
const n3of = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').n3 || null);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const { page, errors } = await boot(browser);

  console.log('── 들어가기 · 메인');
  await page.locator('.tabbar .tab', { hasText: '학습' }).click();
  await page.waitForTimeout(500);
  const first = page.locator('.menugroup').first().locator('.menutile').first();
  ok('★ 학습 탭 배우기 첫 칸이 「한 권으로 끝내는 N3」 ★', (await first.innerText()).includes('한 권으로 끝내는 N3'));
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor({ timeout: 8000 });
  ok('메인 제목 JLPT N3 MASTER', (await page.locator('.n3-head').innerText()).includes('JLPT N3 MASTER'));
  const sum = page.locator('.n3-sum');
  ok('전체 진도 0% · 준비도 0%에서 시작', (await sum.getAttribute('data-progress')) === '0' && (await sum.getAttribute('data-readiness')) === '0');
  ok('어휘·한자·문법·독해·청해 막대 다섯', await page.locator('.n3-sum .n3-bar').count() === 5);
  ok('오늘 학습량 · 연속 학습일 · 이번 주', await page.locator('.n3-cell').count() === 3);
  ok('핵심 버튼: 오늘의 N3 · 전체 과정 · 복습 · 실전 테스트', (await page.locator('.n3-cta').innerText()).includes('오늘의 N3 시작') && await page.locator('.n3-tile').count() === 3);
  ok('375px에서 가로로 안 넘친다 (메인)', !(await overflow(page)));

  console.log('\n── 오늘의 N3 — 순서');
  await page.locator('.n3-cta').click();
  await page.locator('.n3-today').waitFor();
  const kinds = await page.locator('.n3-steprow').evaluateAll((els) => els.map((e) => e.dataset.step));
  ok('★ 어휘 → 한자 → 문법 → 독해 ★ (첫날은 복습 없음)', kinds.join(',') === 'vocab,kanji,grammar,reading', kinds.join(','));
  const reviewBefore = await review(page);

  console.log('\n── 어휘 단계: 카드 → 문제 → 회독 기록');
  await page.locator('.n3-runnext').click();
  await page.locator('.n3-vocab').waitFor();
  ok('새 단어 여덟 장', await page.locator('.n3-word').count() === 8);
  const card = page.locator('.n3-word').first();
  ok('카드에 표기·읽기·뜻·예문·🔊', await card.locator('.n3-wkanji').count() === 1 && await card.locator('.n3-wmean').count() === 1 && await card.locator('.n3-wex').count() === 1 && await card.locator('.spk').count() >= 1);
  ok('숙련도 배지가 NEW', (await card.locator('.n3-mast').innerText()) === 'NEW');
  await page.evaluate(() => { window.__said = []; });
  await card.locator('.spk').first().click();
  await page.waitForTimeout(300);
  const said = await page.evaluate(() => window.__said);
  ok('🔊는 읽기(가나)를 ja-JP로 넘긴다', said.length >= 1 && said[0].lang === 'ja-JP' && !/[一-鿿]/.test(said[0].text), JSON.stringify(said[0]));
  ok('회독으로 더 외우기 길이 있다', (await page.locator('.n3-vocab .ghost-btn').innerText()).includes('회독'));
  await page.locator('.n3-toquiz').click();
  await page.locator('.n3-quiz').waitFor();
  ok('보기 셋', await page.locator('.n3-quiz .qopt').count() === 3);
  const vq = await solve(page, { wrongAt: [1] });
  ok('여덟 문제를 풀었다', vq.length === 8, `${vq.length}`);
  ok('★ 틀린 문제에 「왜 틀렸나」 ★', await page.locator('.n3-finish .n3-wrongcard').count() === 1 && (await page.locator('.n3-finish .n3-wrow.no').innerText()).length > 8);
  await page.locator('.n3-done').click();
  await page.locator('.n3-today').waitFor();
  const r1 = await review(page);
  const wordIds = vq.map((q) => q.split(':')[1]);
  ok('★ 맞힌 단어는 회독 기록에 「알아요」(box 3)로, 틀린 건 「몰라요」로 — SRS 등록 ★',
    wordIds.filter((id, i) => i !== 1).every((id) => r1[id]?.box === 3 && r1[id]?.due) && r1[wordIds[1]]?.box === 1, `${wordIds.length}개`);
  ok('★ 기존 기록은 그대로 ★', JSON.stringify(r1['n5-0001']) === JSON.stringify(reviewBefore['n5-0001']) && JSON.stringify(r1['n5-0002']) === JSON.stringify(reviewBefore['n5-0002']));
  ok('어휘 단계가 완료로', (await page.locator('.n3-steprow[data-step="vocab"]').getAttribute('data-done')) === '1');
  const n3a = await n3of(page);
  ok('오늘 푼 문제 8 · 오답 노트 1', n3a?.days && Object.values(n3a.days)[0].answered === 8 && Object.keys(n3a.wrong).length === 1);

  console.log('\n── 한자 단계');
  await page.locator('.n3-runnext').click();
  await page.locator('.n3-kanjilesson').waitFor();
  ok('새 한자 넉 자, 한국 한자·훈음이 있다', await page.locator('.n3-kanji').count() === 4 && (await page.locator('.n3-kanji').first().locator('.n3-khk').innerText()).includes('한국 한자'));
  ok('음독·훈독·부수·단어 🔊', await page.locator('.n3-kanji').first().locator('.n3-kword .spk').count() >= 2);
  await page.locator('.n3-toquiz').click();
  await page.locator('.n3-quiz').waitFor();
  const kq = await solve(page);
  ok('한자 네 문제', kq.length === 4 && kq.every((id) => id.startsWith('kq:')));
  await page.locator('.n3-done').click();
  await page.locator('.n3-today').waitFor();
  const r2 = await review(page);
  ok('한자가 k:漢 id로 회독 기록에', kq.every((id) => r2[`k:${id.split(':')[1]}`]?.box === 3));

  console.log('\n── 문법 단계: 설명 → 예문 → 비교 → 회화 → 문제 → 복습');
  await page.locator('.n3-runnext').click();
  await page.locator('.n3-grammar').waitFor();
  const lessonId = await page.locator('.n3-grammar').getAttribute('data-lesson');
  ok('첫 문법은 は / が', lessonId === 'g:wa-ga' && (await page.locator('.n3-grammar .sub-title').innerText()).includes('は / が'));
  ok('단계 여섯: 설명·예문·비교·회화·문제·복습', await page.locator('.n3-stepdot').count() === 6);
  ok('설명에 의미·구조·왜', await page.locator('.n3-gmeaning').count() === 1 && await page.locator('.n3-gstruct').count() === 1 && await page.locator('.n3-gwhy').count() === 1);
  await nextStep(page, '.n3-grammar');
  ok('예문에 🔊', await page.locator('.n3-ex .spk').count() >= 2);
  await nextStep(page, '.n3-grammar');
  ok('비교 카드', await page.locator('.n3-cmp').count() >= 1);
  await nextStep(page, '.n3-grammar');
  ok('회화 두 줄', await page.locator('.n3-dline').count() >= 2);
  await nextStep(page, '.n3-grammar');
  await page.locator('.n3-quiz').waitFor();
  const gq = await solve(page);
  ok('문법 문제를 다 풀었다', gq.length >= 3 && gq.every((id) => id.startsWith('q:wa-ga')));
  await page.locator('.n3-done').click();
  await page.locator('.n3-recap').waitFor();
  ok('복습 단계 — 한 줄 정리와 판정', (await page.locator('.n3-recap').innerText()).includes('알아요'));
  await page.locator('.n3-finish-btn').click();
  await page.locator('.n3-today').waitFor();
  const n3b = await n3of(page);
  const r3 = await review(page);
  ok('★ 레슨 완료가 진도에, 문법 숙련도가 회독 기록에 ★', n3b.lessons['g:wa-ga']?.done === true && r3['g:wa-ga']?.box === 3);

  console.log('\n── 독해 단계: 지문 → 구조 → 문법 → 어휘 → 문제');
  await page.locator('.n3-runnext').click();
  await page.locator('.n3-reading').waitFor();
  ok('지문 문장마다 🔊, 뜻은 숨김', await page.locator('.n3-psent .spk').count() >= 2 && await page.locator('.n3-pko').count() === 0);
  await page.locator('.n3-toggleko').click(); await page.waitForTimeout(150);
  ok('뜻 보기', await page.locator('.n3-pko').count() >= 2);
  await nextStep(page, '.n3-reading', 4);
  await page.locator('.n3-quiz').waitFor();
  const rq = await solve(page);
  ok('독해 문제', rq.length >= 1 && rq.every((id) => id.startsWith('rq:')));
  await page.locator('.n3-done').click();
  await page.locator('.n3-today').waitFor();
  ok('★ 오늘의 N3 네 단계 완료 ★', await page.locator('.n3-daydone').count() === 1);
  const n3c = await n3of(page);
  ok('독해 결과가 시험 기록에', n3c.tests['r:1']?.total >= 1 && n3c.lessons['r:1']?.done);

  console.log('\n── 새로고침 후에도 남는다');
  await page.context().setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off2 = page.locator('.gate-offline');
  await off2.waitFor({ timeout: 5000 }).catch(() => {});
  if (await off2.count()) { await off2.click(); await page.waitForTimeout(800); }
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor({ timeout: 8000 });
  const sum2 = page.locator('.n3-sum');
  ok('★ 진도·준비도가 0보다 크게 남아 있다 ★', Number(await sum2.getAttribute('data-progress')) > 0 && Number(await sum2.getAttribute('data-readiness')) > 0, `${await sum2.getAttribute('data-progress')}% / ${await sum2.getAttribute('data-readiness')}%`);
  ok('오늘 푼 문제 수가 남아 있다', Number((await page.locator('.n3-cell').first().locator('b').innerText())) >= 16);
  ok('주요 버튼이 「완료 · 다시 보기」', (await page.locator('.n3-cta').getAttribute('data-state')) === 'done');
  ok('약점 버튼에 오답이 반영', (await page.locator('.n3-weakbtn').innerText()).length > 10);

  console.log('\n── 홈의 「오늘의 N3」 줄');
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(400);
  await page.locator('.tabbar .tab', { hasText: '오늘' }).click(); await page.waitForTimeout(500);
  const row = page.locator('.tdtask', { hasText: '오늘의 N3' });
  ok('홈에 오늘의 N3 줄이 있고 다 했다고 적힌다', await row.count() === 1 && (await row.innerText()).includes('다 했어요'));

  console.log('\n── 전체 과정 · 진단으로 건너뛰기');
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor();
  await page.locator('.n3-tile', { hasText: '전체 과정' }).click();
  await page.locator('.n3-curriculum').waitFor();
  ok('Chapter 0~7 여덟', await page.locator('.n3-chapter').count() === 8);
  await page.locator('.n3-chapter[data-chapter="ch0"] .n3-chhead').click(); await page.waitForTimeout(200);
  ok('Chapter 0에 열다섯 꼭지, 첫 꼭지는 완료', await page.locator('.n3-chapter[data-chapter="ch0"] .n3-lrow').count() === 15 && await page.locator('.n3-lrow[data-lesson="g:wa-ga"].done').count() === 1);
  await page.locator('.n3-testbtn[data-test="t:ch0"]').click();
  await page.locator('.n3-test').waitFor();
  const dq = await solve(page);
  ok('진단 열다섯 문제', dq.length === 15);
  await page.locator('.n3-done').click();
  await page.locator('.n3-curriculum').waitFor();
  await page.waitForTimeout(300);
  if (!(await page.locator('.n3-chapter[data-chapter="ch0"].open').count())) { await page.locator('.n3-chapter[data-chapter="ch0"] .n3-chhead').click(); await page.locator('.n3-chapter[data-chapter="ch0"].open').waitFor(); }
  ok('★ 다 맞힌 꼭지는 SKIP ★', await page.locator('.n3-chapter[data-chapter="ch0"] .n3-mast', { hasText: 'SKIP' }).count() >= 13);
  const n3d = await n3of(page);
  ok('건너뛴 꼭지가 기록에', Object.keys(n3d.skip).length >= 13 && n3d.tests['t:ch0']?.total === 15);

  console.log('\n── Chapter 2 레슨을 골라서 · 틀린 문제 → 오답노트 → 약점');
  await page.locator('.n3-chapter[data-chapter="ch2"] .n3-chhead').click();
  await page.locator('.n3-chapter[data-chapter="ch2"].open').waitFor();
  ok('Chapter 2는 뜻으로 묶여 있다', await page.locator('.n3-chapter[data-chapter="ch2"] .n3-group').count() === 15);
  await page.locator('.n3-group[data-group="guess"] .n3-ghead').click();
  await page.locator('.n3-lrow[data-lesson="g:souda-yousu"]').waitFor();
  await page.locator('.n3-lrow[data-lesson="g:souda-yousu"]').click();
  await page.locator('.n3-grammar').waitFor();
  await nextStep(page, '.n3-grammar', 4);
  await page.locator('.n3-quiz').waitFor();
  await solve(page, { wrongAt: [0, 1] });
  await page.locator('.n3-done').click();
  await page.locator('.n3-recap').waitFor();
  ok('틀린 것을 「다시 볼 것」으로', await page.locator('.n3-recapq').count() === 2);
  await page.locator('.n3-finish-btn').click();
  await page.locator('.n3-curriculum').waitFor();
  const r4 = await review(page);
  ok('반만 맞히면 「애매해요」로 적힌다', r4['g:souda-yousu']?.box === 2);
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(300);
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor();
  await page.locator('.n3-wrongbtn').click();
  await page.locator('.n3-wrong').waitFor();
  ok('★ 최근 약점에 そうだ(양태) — 두 번 틀림 ★', (await page.locator('.n3-pattern').first().innerText()).includes('そうだ'));
  ok('오답노트 문법 갈래에 둘', (await page.locator('.n3-cats .chip[data-cat="grammar"]').innerText()).includes('2'));
  await page.locator('.n3-cats .chip[data-cat="grammar"]').click(); await page.waitForTimeout(150);
  ok('틀린 문제와 정답 설명', await page.locator('.n3-wrong .n3-wrongcard').count() === 2);
  await page.locator('.n3-weakgo').click();
  await page.locator('.n3-reviewrun[data-kind="weak"]').waitFor();
  ok('약점만 공부하기 — 그 꼭지 문제로 판이 짜인다', await page.locator('.n3-quiz').count() === 1);
  await solve(page);
  await page.locator('.n3-done').click();
  await page.waitForTimeout(300);

  console.log('\n── 뒤로가기 · 넘침 · 오류');
  await page.goBack(); await page.waitForTimeout(500);
  ok('브라우저 뒤로가기가 코스만 닫는다', await page.locator('.subscreen.open').count() === 0 && await page.locator('.tabbar').count() === 1);
  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200) || '없음');
  ok('가로 넘침 없음', !(await overflow(page)));

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); console.log(`\n통과 ${pass} / 실패 ${fail + 1}`); process.exit(1); });
