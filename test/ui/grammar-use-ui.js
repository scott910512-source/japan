/* 외운 단어로 문법 활용 — 오늘의 퀘스트 줄 · 초기 진단 · 새로고침 이어하기 · 반복 학습(3/3 · 2/3 · 0~1) · 단어 잊음 · 키보드 · 다음 퀘스트
 * (screens/GrammarUse.jsx · lib/grammarUse.js) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { todayKey, addDays } from '../../src/lib/review.js';
import { allFacets } from './_seed.js';
import { openMenu, goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const st = allFacets({ lastSeen: addDays(today, -9), seenAt: 1, level: 2, box: 3, rounds: 3, streak: 1, wrongCount: 0, vagueCount: 0, due: addDays(today, 40) });
const REVIEW = Object.fromEntries(ALL_WORDS.filter((w) => !w.grammar && w.level === 'N5').slice(0, 500).map((w) => [w.id, st]));
const TEN = Array.from({ length: 10 }, (_, i) => addDays(today, -(i + 1)));
/* 반복 학습 시기: 초기 진단 끝 + 열흘 */
const REPEAT_GU = { place: { day: TEN[9], res: {} }, g: {}, days: TEN };

async function boot(browser, { gu = null, quests = {}, autoTTS = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([r, g, q, d, tts]) => {
    window.__spoken = [];
    if (localStorage.getItem('qa_seeded')) return;
    localStorage.setItem('qa_seeded', '1');
    localStorage.setItem('jp_manabu_guest_v1', '1');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: tts, levels: ['N5'], goalsV: 4 }));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
    localStorage.setItem('jp_manabu_progress_v1', JSON.stringify({ grammarUse: g, quests: { day: d, sentenceSkip: true, ...q } }));
  }, [REVIEW, gu, quests, today, autoTTS]);
  await ctx.addInitScript(() => { window.__spoken = []; window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); }; });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  return { page, ctx };
}
const runOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_grammar_use_run_v1') || 'null'));
const cur = async (page) => { const r = await runOf(page); return { r, q: r?.stages?.[r.stage]?.qs?.[r.at] }; };
const phase = (page) => page.locator('.gu').getAttribute('data-phase');

/* 지금 문제를 맞게(또는 틀리게) 푼다 — 정답은 기기에 적힌 세트에서 읽는다 */
async function answer(page, right = true) {
  const { q } = await cur(page);
  if (q.kind === 'choice' || q.kind === 'pick') {
    const opt = right ? q.answer : q.options.find((o) => o !== q.answer && !q.accepted.includes(o));
    await page.locator(`.gu-opt[data-opt="${opt}"]`).click();
  } else if (q.kind === 'type') {
    await page.locator('.gu-input').fill(right ? q.answer : 'あああ');
    await page.locator('.gu-input').press('Enter');
  } else if (q.kind === 'order') {
    /* 인정 답 첫째를 조각 순서로 */
    const target = right ? q.accepted[0] : [...q.pieces].reverse().join('');
    const used = []; let rest = target;
    while (rest.length) {
      const i = q.pieces.findIndex((p, k) => !used.includes(k) && rest.startsWith(p));
      if (i < 0) break; used.push(i); rest = rest.slice(q.pieces[i].length);
    }
    const order = right ? used : q.pieces.map((_, k) => q.pieces.length - 1 - k);
    for (const i of order) await page.locator('.gu-pool .gu-chip', { hasText: q.pieces[i] }).first().click();
    await page.locator('.gu-submit').click();
  }
  await page.locator('.gu-fb').waitFor({ timeout: 5000 });
}
const nextQ = async (page) => { await page.locator('.gu-next').click(); await page.waitForTimeout(150); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  console.log('\n[ 오늘의 퀘스트 줄 · 초기 진단 · 새로고침 이어하기 ]');
  {
    const { page, ctx } = await boot(browser);
    const titles = await page.locator('.tdq-row').allInnerTexts();
    const iFresh = titles.findIndex((t) => t.includes('새로 배우기'));
    const iGram = titles.findIndex((t) => t.includes('외운 단어로 문법 활용'));
    ok('★ 홈에 「외운 단어로 문법 활용」 줄 · 새로 배우기 다음 ★', iGram >= 0 && (iFresh < 0 || iGram > iFresh), titles.map((t) => t.split('\n')[1] || t).join(' | '));
    ok('첫날은 「초기 진단」이라고 적힌다', titles[iGram]?.includes('초기 진단'));
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu').waitFor();
    ok('시작 화면 — 문항 수와 어떤 단어로 만들었는지(규칙표 · 정답 없음)', (await phase(page)) === 'intro' && (await page.locator('.gu-intro').innerText()).includes('외운 단어') && await page.locator('.gu-fb, .gu-tip').count() === 0);
    await page.locator('.gu-start').click();
    const { q: q0 } = await cur(page);
    ok('진단 중에는 문법 이름 · 해석이 답을 알려 주지 않는다(조사 문제)', !(await page.locator('.gu-kind').innerText()).includes('·') && (q0.showKo || await page.locator('.gu-ko').count() === 0));
    /* ★ 숫자 키로 고르고 Enter로 다음 ★ */
    const idx = q0.options.indexOf(q0.answer);
    await page.keyboard.press(String(idx + 1));
    await page.locator('.gu-fb').waitFor({ timeout: 4000 });
    ok('★ 숫자 키로 보기를 고른다 ★', (await page.locator('.gu-fb').innerText()).includes('맞았어요'));
    ok('해설: 정답 · 왜 · 헷갈리는 곳 · 같은 문법 예문', await page.locator('.gu-fb .gu-right').count() === 1 && await page.locator('.gu-fb .gu-tip').count() === 1 && await page.locator('.gu-fb .gu-ex').count() === 1);
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    await answer(page, false);
    ok('틀리면 내 답과 키르아의 설명', await page.locator('.gu-fb .gu-mine').count() === 1 && await page.locator('.gu-fb [data-guide="killua"]').count() === 1);
    const before = await cur(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 }); await page.waitForTimeout(800);
    if (!(await page.locator('.gu').count())) await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu').waitFor();
    const after = await cur(page);
    ok('★ 새로고침해도 같은 문제 · 같은 제출 상태(해설이 그대로) ★', after.q.qid === before.q.qid && after.r.at === before.r.at && await page.locator('.gu-fb .gu-mine').count() === 1, `${before.q.qid} → ${after.q.qid}`);
    for (let i = 0; i < 40 && (await phase(page)) === 'q'; i += 1) {
      if (!(await page.locator('.gu-fb').count())) await answer(page, true);
      await nextQ(page);
    }
    ok('초기 진단을 마치면 결과', (await phase(page)) === 'done' && (await page.locator('.gu-result').innerText()).includes('초기 진단'));
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1')));
    ok('★ 진단 결과는 출발점(통과 아님) · 오늘 퀘스트 완료 ★', prog.grammarUse?.place?.day === prog.quests.day && Object.values(prog.grammarUse.g || {}).every((r) => !r.pass?.length) && prog.quests.grammarSetIds?.length === 1);
    const nextBtn = page.locator('.gu-nextquest');
    ok('「다음: ○○」로 남은 퀘스트를 잇는다', await nextBtn.count() === 1, await nextBtn.innerText().catch(() => ''));
    await page.locator('.gu-home').click(); await page.waitForTimeout(600);
    ok('홈 줄이 1 / 1', (await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).innerText()).includes('1'));
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  console.log('\n[ 반복 학습 — 3/3 빠른 통과 → 다음 문법으로 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU });
    const row = await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).innerText();
    ok('줄에 「오늘의 문법 · です」 · 「기초 확인 3문제」', row.includes('오늘의 문법') && row.includes('기초 확인 3문제'), row.replace(/\s+/g, ' '));
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu-start').click();
    const { r } = await cur(page);
    ok('진단 3문제 · 유형 둘 이상', r.stages[0].qs.length === 3 && new Set(r.stages[0].qs.map((q) => q.kind)).size >= 2, r.stages[0].qs.map((q) => q.kind).join(','));
    for (let i = 0; i < 3; i += 1) { await answer(page, true); await nextQ(page); }
    ok('★ 3/3 → 바로 결과(설명 · 연습 없음) ★', (await phase(page)) === 'done' && await page.locator('.gu-result[data-quick="1"]').count() === 1, (await page.locator('.gu-result').innerText()).slice(0, 60));
    ok('「다른 문장에서도 정확하게 사용했어요」', (await page.locator('.gu-result').innerText()).includes('다른 문장에서도'));
    const g1 = r.gid;
    await page.locator('.gu-nextgrammar').click(); await page.waitForTimeout(300);
    const r2 = (await cur(page)).r;
    ok('★ 「다음 문법으로」 → 다음 문법의 진단 ★', (await phase(page)) === 'intro' && r2.gid && r2.gid !== g1, `${g1} → ${r2.gid}`);
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  console.log('\n[ 반복 학습 — 2/3 → 틀린 곳만 · 추가 확인 2 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU });
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu-start').click();
    await answer(page, false); await nextQ(page);
    await answer(page, true); await nextQ(page);
    await answer(page, true); await nextQ(page);
    ok('★ 2/3 → 키르아가 틀린 곳만 짚는다 ★', (await phase(page)) === 'between' && await page.locator('.gu-between[data-intro="fix"] .gu-fix').count() === 1);
    await page.locator('.gu-start').click();
    const { r } = await cur(page);
    ok('추가 확인 2문제(새 문장)', r.stages[1].name === 'follow' && r.stages[1].qs.length === 2 && r.stages[1].qs.every((q) => !r.stages[0].qs.some((d) => d.full === q.full)));
    ok('진행 표시가 「추가 확인 1 / 2」', (await page.locator('.gu-count').innerText()).includes('추가 확인 1 / 2'));
    await answer(page, true); await nextQ(page); await answer(page, true); await nextQ(page);
    ok('★ 둘 다 맞히면 통과 ★', await page.locator('.gu-result[data-passed="1"]').count() === 1);
    await ctx.close();
  }

  console.log('\n[ 반복 학습 — 0~1/3 → 윙의 설명 · 연습 5 · 끝 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU });
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu-start').click();
    for (let i = 0; i < 3; i += 1) { await answer(page, false); await nextQ(page); }
    ok('★ 0/3 → 윙의 원리 설명(즈시의 질문) ★', (await phase(page)) === 'between' && await page.locator('.gu-between [data-guide="wing"]').count() === 1);
    await page.locator('.gu-start').click();
    const { r } = await cur(page);
    ok('기본 연습 5문제', r.stages[1].name === 'practice' && r.stages[1].qs.length === 5);
    for (let i = 0; i < 5; i += 1) { await answer(page, i % 2 === 0); await nextQ(page); }
    ok('★ 연습이 끝나면 세트도 끝(더 늘지 않는다) · 다시 연습은 내가 고른다 ★', (await phase(page)) === 'done' && await page.locator('.gu-retry').count() === 1);
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1')));
    ok('복습 대상으로 기록 · 오답노트에 문항이 남는다', Object.values(prog.grammarUse.g).some((x) => x.fail?.length) && Object.keys(prog.mistakes || {}).some((k) => k.startsWith('grammaruse:')));
    await ctx.close();
  }

  console.log('\n[ 단어 뜻이 기억 안 나요 — 문법 채점에서 빼고 그 단어만 몰라요 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU });
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu-start').click();
    const { q } = await cur(page);
    await page.locator('.gu-wordbtn').click();
    const w = q.words.find((x) => x.id);
    const others = q.words.filter((x) => x.id && x.id !== w.id).map((x) => x.id);
    const rvBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1')));
    await page.locator('.gu-word', { hasText: w.kanji }).locator('.gu-forgot').click();
    await page.waitForTimeout(400);
    const { q: q2 } = await cur(page);
    const rv = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1')));
    ok('★ 같은 문법의 다른 문장으로 바뀐다(문항 수 그대로) ★', q2.qid !== q.qid && q2.gid === q.gid);
    ok('★ 그 단어의 뜻 칸만 몰라요 · 다른 단어는 그대로 ★', rv[w.id]?.box === 1 && rv[w.id]?.fx?.mean?.lv === 0 && others.every((id) => JSON.stringify(rv[id]) === JSON.stringify(rvBefore[id])));
    await ctx.close();
  }

  console.log('\n[ 문법 메뉴 「활용」 탭 — 같은 화면 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU });
    await openMenu(page, '문법');
    await page.locator('.gm-tabs [data-tab="use"]').click(); await page.waitForTimeout(300);
    ok('24개 문법 목록과 상태', await page.locator('.gu-row').count() === 24);
    await page.locator('.gu-row[data-gid="o"]').click();
    await page.locator('.gu').waitFor();
    ok('★ 고른 문법(を)으로 같은 세트 화면이 열린다 ★', (await page.locator('.gu').getAttribute('data-gid')) === 'o');
    await ctx.close();
  }

  console.log('\n[ 소리 켬 · 눈으로만 — 문법 활용 퀴즈 안에서 바로 ]');
  {
    const { page, ctx } = await boot(browser, { gu: REPEAT_GU, autoTTS: true });
    await page.locator('.tdq-row', { hasText: '외운 단어로 문법 활용' }).click();
    await page.locator('.gu-start').click();
    const tg = page.locator('.gu-head .soundtoggle');
    ok('★ 퀴즈 머리에 「소리 켬」 단추 ★', await tg.count() === 1 && (await tg.getAttribute('data-sound')) === 'on');
    const { q } = await cur(page);
    const pre = await page.evaluate(() => window.__spoken.slice());
    ok('답을 내기 전에는 정답 문장을 읽지 않는다', !pre.some((t) => t.includes(q.answer) && (t === q.full || t === q.fullKana)), pre.join(' | '));
    await answer(page, true); await page.waitForTimeout(400);
    const said = await page.evaluate(() => window.__spoken.slice());
    ok('★ 소리 켬 — 답을 내면 완성 문장을 읽어 준다 ★', said.length >= 1, said.join(' | ') || q.full);
    await tg.click(); await page.waitForTimeout(300);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')));
    ok('★ 누르면 「눈으로만」 · 설정에 남는다 ★', (await tg.getAttribute('data-sound')) === 'off' && st.autoTTS === false);
    await nextQ(page);
    await page.evaluate(() => { window.__spoken = []; });
    await answer(page, true); await page.waitForTimeout(400);
    ok('눈으로만 — 답을 내도 알아서 읽지 않는다', (await page.evaluate(() => window.__spoken.length)) === 0);
    await page.locator('.gu-fb .gu-say').click(); await page.waitForTimeout(300);
    ok('🔊를 누르면 그때는 읽는다', (await page.evaluate(() => window.__spoken.length)) >= 1);
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  console.log('\n[ 문법 지도 — 내 학습 화면 · 문법 메뉴 활용 탭 ]');
  {
    const gu = { ...REPEAT_GU, place: { day: TEN[9], res: { desu: 1, wa: 0 } }, g: { o: { pass: [TEN[5], TEN[2], TEN[0]], fail: [], quick: [], qs: [] }, de: { pass: [TEN[3]], fail: [TEN[1]], quick: [], qs: [] }, masu: { pass: [TEN[1]], fail: [], quick: [], qs: [] } } };
    const { page, ctx } = await boot(browser, { gu });
    await goTab(page, '내 학습');
    const map = page.locator('.gmap');
    await map.waitFor({ timeout: 10000 });
    ok('★ 「문법 지도」 — 24개 문법이 이름 붙은 칸으로 ★', await map.locator('.gmap-cell').count() === 24);
    const cls = async (gid) => map.locator(`.gmap-cell[data-gid="${gid}"]`).getAttribute('class');
    ok('확인 3일 = 진한 색(익숙함)', (await cls('o')).includes('s-done'), await cls('o'));
    ok('확인 1일 = 옅은 색', (await cls('masu')).includes('s-round2'), await cls('masu'));
    ok('나중에 틀림 = 약점(빨강)', (await cls('de')).includes('s-weak'), await cls('de'));
    ok('진단에서 틀림 = 약점(먼저 볼 곳)', (await cls('wa')).includes('s-weak'));
    ok('진단만 맞음 = 가장 옅은 색', (await cls('desu')).includes('s-round1'));
    ok('안 본 문법 = 빈칸', (await cls('tekara')).includes('s-fresh'));
    ok('단어 지도와 겹치지 않는다(.wmap 하나)', await page.locator('.wmap').count() === 1);
    ok('문법 카드 N5 · N4 · N3 탭도 있다', await map.locator('.gmap-tabs [data-tab="N5"]').count() === 1 && await map.locator('.gmap-tabs [data-tab="N3"]').count() === 1);
    await map.locator('.gmap-tabs [data-tab="N5"]').click();
    ok('문법 카드 칸(단어 지도 모양)', await map.locator('.gmap-cards .wm-cell').count() > 50, String(await map.locator('.gmap-cards .wm-cell').count()));
    await map.locator('.gmap-tabs [data-tab="use"]').click();
    await map.locator('.gmap-cell[data-gid="de"]').click();
    ok('칸을 누르면 이름 · 상태', (await map.locator('.gmap-pick').innerText()).includes('복습 대상'));
    await map.locator('.gmap-go').click();
    await page.locator('.gu').waitFor({ timeout: 8000 });
    ok('★ 「이 문법 연습」 → 그 문법(で) 세트 ★', (await page.locator('.gu').getAttribute('data-gid')) === 'de');
    await openMenu(page, '문법');
    await page.locator('.gm-tabs [data-tab="use"]').click(); await page.waitForTimeout(300);
    ok('문법 메뉴 「활용」 탭 머리에도 같은 지도(활용만)', await page.locator('.gmap-use .gmap-cell').count() === 24 && await page.locator('.gmap-use .gmap-tabs').count() === 0);
    ok('JS 오류 없음', page.errors.length === 0, page.errors[0]);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
