/* 상급 학습자 시뮬레이터.
 *
 * 몇 주째 매일 쓰는 사람 N명(기본 150)을 흉내 낸다. 복습 기록이 1,000~3,000개, 밀린 복습, 약점 장부, 오답노트,
 * N3 코스 진행(레슨 완료 · 테스트 점수 · N3 오답)이 이미 쌓여 있다. 규모가 커졌을 때의 막힘 · 느림 · 오류를 본다.
 *
 *   node tools/sim/advanced.mjs [사람 수] [동시에 돌릴 수]
 *   APP_URL=…  OUT=/경로/results.json  SHOTS=/경로  RESUME=1  ONLY=3,7
 *
 * 초보(beginners · explore), 중급(intermediate)과 같은 틀이다. 상급에서만 더 보는 것:
 *   밀린 복습 · 오답노트 다시 시험 · N3 허브의 여러 길 · 쭉 퀴즈에서 한자/문법이 나오는지 ·
 *   목표 레벨 바꾸기(오늘 화면 줄 이름이 따라가는지) · 저장 용량과 메모리 · 화면 뜨는 시간 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';
import { spreadGoal } from '../../src/lib/daily.js';
import { recordMistake } from '../../src/lib/mistakes.js';
import { LESSON_ORDER } from '../../src/lib/n3.js';
import { VOCAB_LESSONS } from '../../src/data/n3/vocab.js';
import { KANJI_LESSONS } from '../../src/data/n3/kanji.js';
import { goTab, openMenu, openMore } from '../../test/ui/_nav.js';
import { GRAMMAR_QUESTIONS } from '../../src/data/n3/grammar.js';
import { READING_QUESTIONS } from '../../src/data/n3/reading.js';
import { LISTENING_QUESTIONS } from '../../src/data/n3/listening.js';
import { EXAM_QUESTIONS } from '../../src/data/n3/exam.js';
import { vocabWordById } from '../../src/data/n3/vocab.js';
import { kanjiByChar } from '../../src/data/n3/kanji.js';

const BASE = process.env.APP_URL || 'http://localhost:8934/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const N = Number(process.argv[2] || 150);
const PAR = Number(process.argv[3] || 6);
const OUT = process.env.OUT || '/tmp/sim-advanced.json';
const SHOTS = process.env.SHOTS || null;
const today = todayKey();

const DEVICES = [
  { id: 'phone-s', w: 360, h: 640, touch: true },
  { id: 'phone', w: 390, h: 844, touch: true },
  { id: 'phone-l', w: 430, h: 932, touch: true },
  { id: 'tablet', w: 768, h: 1024, touch: true },
  { id: 'desktop', w: 1280, h: 800, touch: false },
];
const STYLES = [
  { id: 'diligent', acc: 0.9, cards: 12, stream: 14, exam: 10, n3: 2, tour: 5 },
  { id: 'average', acc: 0.75, cards: 8, stream: 9, exam: 8, n3: 1, tour: 4 },
  { id: 'guesser', acc: 0.35, cards: 6, stream: 7, exam: 6, n3: 1, tour: 3 },
  { id: 'impatient', acc: 0.6, cards: 3, stream: 4, exam: 3, n3: 1, tour: 2 },
  { id: 'explorer', acc: 0.75, cards: 5, stream: 6, exam: 5, n3: 2, tour: 5 },
];
const TIERS = [
  { id: 'a1', n5: [534, 534], n4: [300, 613], n3: [200, 600], lessons: [4, 12], goal: 'N3', levels: ['N5', 'N4', 'N3'] },
  { id: 'a2', n5: [534, 534], n4: [613, 613], n3: [700, 1300], lessons: [10, 25], goal: 'N3', levels: ['N5', 'N4', 'N3'] },
  { id: 'a3', n5: [534, 534], n4: [613, 613], n3: [1300, 1607], lessons: [20, 40], goal: 'N3', levels: ['N3'] },
];
const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
function persona(i) {
  const r = rng(i + 301);
  const dev = DEVICES[i % DEVICES.length];
  const style = STYLES[Math.floor(i / DEVICES.length) % STYLES.length];
  const tier = TIERS[Math.floor(r() * TIERS.length)];
  return { id: i + 1, dev, style, tier, amount: [20, 40, 40][Math.floor(r() * 3)], keyboard: !dev.touch, r: rng(i * 17 + 3), seedR: rng(i * 53 + 11) };
}

/* 몇 주 쓴 사람의 저장 상태 — 복습 기록 · 약점 장부 · 오답노트 · N3 진도 · 일별 활동 · 연속일 */
function seedAll(p) {
  const r = p.seedR; const review = {}; const weakIdsList = [];
  const pick = (lv, [lo, hi]) => {
    const list = ALL_WORDS.filter((w) => w.level === lv);
    const n = Math.min(list.length, Math.round(lo + r() * (hi - lo)));
    for (const w of list.slice(0, n)) {
      const x = r();
      if (x < 0.1) {
        let st; for (let k = 0; k < 3; k++) st = applyVerdict(st, VERDICT.UNKNOWN, addDays(today, -(8 - k * 2) - Math.floor(r() * 2)));
        review[w.id] = st; weakIdsList.push(w.id);
      } else if (x < 0.42) {
        /* 밀린 복습 — 복습일이 며칠씩 지난 것이 많다 */
        review[w.id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -(10 + Math.floor(r() * 40)))), due: addDays(today, -Math.floor(r() * 12)) };
      } else review[w.id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -(2 + Math.floor(r() * 30)))), due: addDays(today, 1 + Math.floor(r() * 40)) };
    }
  };
  pick('N5', p.tier.n5); pick('N4', p.tier.n4); pick('N3', p.tier.n3);

  /* N3 코스 진행: 레슨 완료 + 그 안의 단어·한자 회독 기록 */
  const n3 = { v: 1, lessons: {}, skip: {}, days: {}, q: {}, wrong: {}, tests: {}, exams: [], summary: null };
  const k = Math.round(p.tier.lessons[0] + r() * (p.tier.lessons[1] - p.tier.lessons[0]));
  for (const track of ['grammar', 'vocab', 'kanji', 'reading', 'listening']) {
    const ids = (LESSON_ORDER[track] || []).slice(0, Math.max(1, Math.round(k * (track === 'grammar' ? 1.2 : track === 'vocab' ? 0.8 : 0.6))));
    for (const id of ids) n3.lessons[id] = { done: true, at: Date.now() - 86400000 * Math.floor(r() * 30), score: 70 + Math.floor(r() * 30), tries: 1 + Math.floor(r() * 3) };
    if (track === 'reading' || track === 'listening') for (const id of ids) n3.tests[id] = { best: 0.6 + r() * 0.4, last: 0.5 + r() * 0.5, tries: 1 + Math.floor(r() * 3), right: 3, total: 4, at: Date.now() - 86400000 * 5 };
  }
  for (const l of VOCAB_LESSONS.filter((x) => n3.lessons[x.id])) for (const w of l.words) review[w.id] ||= { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, 7) };
  /* 문법 레슨을 끝내면 실제 앱은 그 레슨 id로 복습 기록을 남긴다(N3Course finishLesson). 이게 없으면 쭉 퀴즈에 문법이 0으로 나온다 */
  for (const id of Object.keys(n3.lessons).filter((x) => (LESSON_ORDER.grammar || []).includes(x))) review[id] ||= { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -4)), due: addDays(today, 9) };
  for (const l of KANJI_LESSONS.filter((x) => n3.lessons[x.id])) for (const kk of l.kanji) review[kk.id] ||= { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -4)), due: addDays(today, 9) };
  /* N3 오답 노트 — 어휘 문제를 틀린 것 */
  const vwords = VOCAB_LESSONS.flatMap((l) => l.words).slice(0, 400);
  for (let i = 0; i < 12 + Math.floor(r() * 10); i++) { const w = vwords[Math.floor(r() * vwords.length)]; n3.wrong[`vq:${w.id}:ko`] = { c: 1 + Math.floor(r() * 3), at: Date.now() - 86400000 * Math.floor(r() * 20), cat: 'vocab', ref: w.id, ok: false }; }

  /* 약점 장부 · 오답노트(새 방식) */
  const weak = {};
  for (const id of weakIdsList.slice(0, 40)) weak[id] = { quizWrong: 1 + Math.floor(r() * 4), quizRight: Math.floor(r() * 2), listen: 0, stuck: 0, forgot: Math.floor(r() * 2), fastDays: null, at: Date.now() - 86400000 * Math.floor(r() * 10) };
  let mistakes = {};
  const sample = ALL_WORDS.filter((w) => w.level === 'N5' || w.level === 'N4').slice(0, 300);
  for (let i = 0; i < 18 + Math.floor(r() * 20); i++) {
    const w = sample[Math.floor(r() * sample.length)];
    mistakes = recordMistake(mistakes, { id: `quiz:${w.id}:jp-ko`, source: 'quiz', ref: w.id, kind: '단어', prompt: w.kanji, correct: w.mean, chosen: '(오답)', ok: false }, addDays(today, -Math.floor(r() * 15)));
  }
  /* 일별 활동 · 연속일 */
  const stats = {}; const days = 25 + Math.floor(r() * 35);
  for (let d = days; d >= 1; d--) { const st = 8 + Math.floor(r() * 40); const kn = Math.round(st * 0.7); stats[addDays(today, -d)] = { studied: st, known: kn, vague: Math.round(st * 0.15), unknown: st - kn - Math.round(st * 0.15) }; }
  const streak = { count: Math.min(days, 8 + Math.floor(r() * 50)), lastDate: addDays(today, -1) };
  return { review, progress: { n3, weak, mistakes }, stats, streak };
}

/* ── 자료에서 정답 찾기 ── */
const byKanji = new Map(); const byKana = new Map(); const byMean = new Map();
for (const w of ALL_WORDS) {
  if (!byKanji.has(w.kanji)) byKanji.set(w.kanji, w);
  if (!byKana.has(w.kana)) byKana.set(w.kana, w);
  if (!byMean.has(w.mean)) byMean.set(w.mean, w);
}
const lookup = (t) => byKanji.get(t) || byKana.get(t) || byMean.get(t) || null;
const FIXED = new Map([...GRAMMAR_QUESTIONS, ...READING_QUESTIONS, ...LISTENING_QUESTIONS, ...EXAM_QUESTIONS].map((q) => [q.id, q.answer]));
function n3Answer(qid) {
  if (FIXED.has(qid)) return FIXED.get(qid);
  if (qid.startsWith('vq:')) { const [, wid, type] = qid.split(':'); const w = vocabWordById(wid); if (!w) return null; return type === 'ko' ? w.mean : type === 'jp' ? w.kanji : w.kana; }
  if (qid.startsWith('kq:')) {
    const [, ch, n] = qid.split(':'); const k = kanjiByChar(ch); if (!k) return null;
    if (n === 'm') return k.mean; if (n === 's') return ch; return k.words[Number(n)]?.[1] ?? null;
  }
  return null;
}

async function waitCached(page) {
  await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(async () => { try { let t = 0; for (const k of await caches.keys()) t += (await (await caches.open(k)).keys()).length; return t; } catch { return 0; } }).catch(() => 0);
    if (n >= 150) return n;
    await page.waitForTimeout(500);
  }
  return 0;
}
const DANGER = /삭제|초기화|로그아웃|지우기|비우기|전체 삭제|탈퇴|복원|가져오기|내보내기/;

async function run(browser, p) {
  const rep = { id: p.id, device: p.dev.id, style: p.style.id, tier: p.tier.id, steps: [], issues: [], metrics: {} };
  const ctx = await browser.newContext({ viewport: { width: p.dev.w, height: p.dev.h }, hasTouch: p.dev.touch, isMobile: p.dev.touch && p.dev.w < 600 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  let cur = 'boot';
  const issue = (kind, where, detail) => { rep.issues.push({ kind, where, detail: String(detail).slice(0, kind === 'stuck' ? 700 : 240) }); };
  page.on('pageerror', (e) => issue('pageerror', cur, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource|net::ERR/i.test(m.text())) issue('console', cur, m.text()); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/m${p.id}-${name}.png` }).catch(() => {}); };
  const step = async (name, fn) => {
    cur = name; const t0 = Date.now();
    try { const out = await fn(); rep.steps.push({ name, ok: true, ms: Date.now() - t0, ...(out && typeof out === 'object' ? out : {}) }); }
    catch (e) {
      const why = String(e.message).split('\n').filter((l) => /locator|waiting|intercept|resolved|element|visible|enabled|stable|Timeout|Error/.test(l)).slice(0, 8).join(' / ').replace(/\u001b\[[0-9;]*m/g, '');
      rep.steps.push({ name, ok: false, ms: Date.now() - t0, err: why.slice(0, 200) }); issue('stuck', name, why || e.message); await shot(`stuck-${name}`);
    }
  };
  const audit = async (where) => {
    const a = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const small = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 30 || r.width < 30; })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).toString().trim().slice(0, 24));
      const nameless = [...document.querySelectorAll('button')].filter(vis).filter((el) => !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')).map((el) => el.className.toString().slice(0, 30));
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 6), nameless: [...new Set(nameless)].slice(0, 4), boundary: /화면을 불러오지 못했어요/.test(document.body.innerText), len: document.body.innerText.trim().length };
    }).catch(() => ({ over: 0, small: [], nameless: [], boundary: false, len: 999 }));
    if (a.over > 2) issue('overflow', where, `가로로 ${a.over}px 넘침`);
    if (a.small.length) issue('small-tap', where, a.small.join(' · '));
    if (a.nameless.length) issue('no-label', where, a.nameless.join(' · '));
    if (a.boundary) issue('load-fail', where, '「화면을 불러오지 못했어요」');
    return a;
  };
  const closeAll = async () => {
    for (let k = 0; k < 5; k++) {
      /* 열린 시트(「하던 학습을 접을까요?」 같은 것)는 Esc로 닫는다 — 사람도 닫는다 */
      if (await page.locator('.sheet.open').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
      if (/탭하면 닫혀요/.test(await page.locator('body').innerText().catch(() => ''))) { await page.mouse.click(p.dev.w / 2, p.dev.h / 2); await page.waitForTimeout(300); }
      const b = page.locator('.sh-close:visible, .subscreen.open .sub-back:visible, .study .si-back:visible, .moreback:visible, .inner-back:visible, .sub-back:visible').first();
      if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); } else break;
    }
  };
  const touch = async (rounds, where) => {
    let acts = 0; let answered = 0;
    for (let k = 0; k < rounds; k++) {
      const q = page.locator('.qoptions .qopt:not([disabled]), .n3-opts .qopt:not([disabled])');
      if (await q.count()) { await q.nth(Math.floor(p.r() * (await q.count()))).click().catch(() => {}); answered += 1; acts += 1; await page.waitForTimeout(400); const nx = page.locator('.qnext .submit-btn, .n3-next, .cmp-next, .swl-next, .st-next').first(); if (await nx.count()) await nx.click().catch(() => {}); continue; }
      const cand = page.locator('.subscreen.open button:visible, .screen.active button:visible').filter({ hasNotText: DANGER });
      const n = await cand.count(); const usable = [];
      for (let q2 = 0; q2 < Math.min(n, 30); q2++) {
        const el = cand.nth(q2); const cls = (await el.getAttribute('class').catch(() => '')) || ''; const lab = ((await el.getAttribute('aria-label').catch(() => '')) || '') + ((await el.innerText().catch(() => '')) || '');
        if (/sub-back|sh-close|inner-back|moreback|si-back|\btab\b|뒤로|그만두기/.test(cls + lab)) continue; usable.push(q2);
      }
      if (usable.length) { await cand.nth(usable[Math.floor(p.r() * usable.length)]).click({ timeout: 2500 }).catch(() => {}); acts += 1; }
      await page.waitForTimeout(350);
      if (/화면을 불러오지 못했어요/.test(await page.locator('body').innerText())) { issue('load-fail', where, '불러오기 실패'); break; }
    }
    return { acts, answered };
  };
  const settingsOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}')).catch(() => ({}));
  const reviewCount = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length).catch(() => 0);
  const panelCheck = async (nOpts, where) => {
    const rows = await page.locator('.optrev-row').count();
    if (rows && rows !== nOpts) { rep.metrics.panelMismatch = (rep.metrics.panelMismatch || 0) + 1; issue('panel', where, `보기 ${nOpts}개인데 줄 ${rows}개`); }
    if (rows) rep.metrics.panelSeen = (rep.metrics.panelSeen || 0) + 1;
  };

  /* ── 0 부팅: 며칠 쓴 기기 ── */
  await step('boot', async () => {
    const seed = seedAll(p);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(({ seed, patch }) => {
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(seed.review));
      localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(seed.progress));
      localStorage.setItem('jp_manabu_stats_v1', JSON.stringify(seed.stats));
      localStorage.setItem('jp_manabu_streak_v1', JSON.stringify(seed.streak));
      const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
      Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false }, patch);
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    }, { seed, patch: { levels: p.tier.levels, goalLevel: p.tier.goal, goals: spreadGoal(p.amount) } });
    rep.metrics.seeded = Object.keys(seed.review).length;
    rep.metrics.storageKB = await page.evaluate(() => Math.round(Object.entries(localStorage).reduce((t, [k, v]) => t + k.length + v.length, 0) / 1024));
    await waitCached(page);
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    const off = page.locator('.gate-offline');
    await off.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off.count()) { await off.click(); }
    await page.locator('.tabbar').waitFor({ timeout: 20000 });
    await page.locator('.tdq-row, .bigcta, .td-done').first().waitFor({ timeout: 20000 }).catch(() => {});
    rep.metrics.bootToTodayMs = Date.now() - t0;
    rep.metrics.reviewBefore = await reviewCount();
  });

  /* ── 1 오늘 화면 ── */
  await step('today', async () => {
    await page.locator('.tabbar .tab[data-tab="home"]').click(); await page.waitForTimeout(900);
    await shot('today');
    const info = await page.evaluate(() => ({
      cta: (document.querySelector('.bigcta')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      goal: (document.querySelector('.hm-goal')?.innerText || '').replace(/\s+/g, ' '),
      quests: [...document.querySelectorAll('.tdq-row')].map((e) => `${e.querySelector('b')?.textContent.trim()}:${(e.querySelector('.tdq-count')?.innerText || '').replace(/\s+/g, '')}`),
      note: (document.querySelector('.td-firstnote')?.innerText || '').slice(0, 40),
    }));
    rep.metrics.today = info;
    if (!info.cta && !/오늘 학습 완료/.test(await page.locator('body').innerText())) issue('no-cta', 'today', '오늘 화면에 시작 버튼도 완료 표시도 없다');
    if (!info.quests.length) issue('no-quests', 'today', '복습 기록이 있는데 오늘 퀘스트가 한 줄도 없다');
    await audit('today');
    return { quests: info.quests.length };
  });

  /* ── 2 오늘 학습 카드 ── */
  await step('study', async () => {
    const cta = page.locator('.bigcta');
    if (!(await cta.count())) return { skipped: true };
    await cta.click(); await page.waitForTimeout(900);
    const intro = page.locator('.study.intro .bigstart'); if (await intro.count()) { await intro.click(); await page.waitForTimeout(700); }
    let seen = 0; let stall = 0;
    for (let i = 0; i < p.style.cards; i++) {
      const card = page.locator('.studycard').first();
      if (!(await card.count())) { if (++stall > 2) break; await page.waitForTimeout(400); continue; }
      if (i === 0) await audit('study-front');
      await card.click().catch(() => {}); await page.waitForTimeout(220);
      const know = p.r() < p.style.acc;
      const btn = page.locator(know ? '.judge.known' : (p.r() < 0.5 ? '.judge.unknown' : '.judge.vague')).first();
      if (!(await btn.count())) { issue('no-judge', 'study', '카드를 뒤집어도 판정 버튼이 없다'); await shot('nojudge'); break; }
      await btn.click().catch(() => {}); seen += 1; await page.waitForTimeout(300);
    }
    rep.metrics.cardsSeen = seen;
    const done = page.locator('.finish .submit-btn, .finish .bigstart').first();
    if (await done.count()) { rep.metrics.finishedSession = true; await done.click().catch(() => {}); } else await closeAll();
    await page.waitForTimeout(500);
    return { seen };
  });

  /* ── 2-2 복습 미션(밀린 복습이 많다) ── */
  await step('reviewmission', async () => {
    await goTab(page, '오늘'); await page.waitForTimeout(500);
    const row = page.locator('.tdq-row', { hasText: '복습 미션' });
    if (!(await row.count())) { rep.metrics.reviewMission = false; return { skipped: true }; }
    rep.metrics.reviewMission = true;
    await row.first().click(); await page.waitForTimeout(900);
    /* 하던 오늘 학습이 남아 있으면 「접고 새로 시작」을 묻는다 — 이 시트가 실제로 뜨는지도 기록한다 */
    const fold = page.locator('.sheet.open button', { hasText: '접고 새로 시작' });
    if (await fold.count()) { rep.metrics.foldSheet = true; await fold.first().click(); await page.waitForTimeout(900); }
    const intro = page.locator('.study.intro .bigstart'); if (await intro.count()) { await intro.click(); await page.waitForTimeout(700); }
    let seen = 0;
    for (let i = 0; i < Math.max(4, p.style.cards); i++) {
      const card = page.locator('.studycard').first(); if (!(await card.count())) break;
      await card.click().catch(() => {}); await page.waitForTimeout(200);
      const btn = page.locator(p.r() < p.style.acc ? '.judge.known' : '.judge.unknown').first();
      if (!(await btn.count())) { issue('no-judge', 'reviewmission', '카드를 뒤집어도 판정 버튼이 없다'); await shot('nojudge2'); break; }
      await btn.click().catch(() => {}); seen += 1; await page.waitForTimeout(260);
    }
    rep.metrics.reviewSeen = seen;
    const done = page.locator('.finish .submit-btn, .finish .bigstart').first();
    if (await done.count()) await done.click().catch(() => {}); else await closeAll();
    await page.waitForTimeout(400);
    return { seen };
  });

  /* ── 3 약점 퀴즈(퀘스트) ── */
  await step('weakquiz', async () => {
    await goTab(page, '오늘'); await page.waitForTimeout(500);
    const row = page.locator('.tdq-row', { hasText: '약점 퀴즈' });
    if (!(await row.count())) { rep.metrics.weakQuest = false; return { skipped: true }; }
    rep.metrics.weakQuest = true;
    await row.first().click(); await page.waitForTimeout(900);
    if (!(await page.locator('.qoptions').count())) { const st = page.locator('button', { hasText: /시험 시작|시작/ }).first(); if (await st.count()) { await st.click(); await page.waitForTimeout(800); } }
    let answered = 0; let kbw = 0;
    for (let i = 0; i < 5; i++) {
      if (!(await page.locator('.qoptions .qopt').count())) break;
      const prompt = (await page.locator('.qc-prompt').innerText().catch(() => '')).trim();
      const opts = await page.locator('.qoptions .qopt .qo-body b').allInnerTexts();
      const w = lookup(prompt); let want = -1;
      if (w) want = opts.findIndex((o) => o.trim() === w.mean || o.trim() === w.kanji);
      const knows = want >= 0 && p.r() < p.style.acc;
      const idx = knows ? want : Math.floor(p.r() * opts.length);
      await page.locator('.qoptions .qopt').nth(idx).click(); await page.waitForTimeout(450);
      const ok = ((await page.locator('.qoptions .qopt').nth(idx).getAttribute('class')) || '').includes('correct');
      if (knows && !ok) { kbw += 1; issue('data', 'weakquiz', `정답을 눌렀는데 오답: 「${prompt}」`); }
      answered += 1;
      if (i === 0) await panelCheck(opts.length, 'weakquiz');
      const nx = page.locator('.qnext .submit-btn'); if (await nx.count()) await nx.click().catch(() => {}); else await page.waitForTimeout(1100);
      await page.waitForTimeout(250);
    }
    const resultOk = await page.locator('.wk-result, .finish').count();
    rep.metrics.weakQuiz = { answered, kbw, resultShown: Boolean(resultOk) };
    if (answered >= 5 && !resultOk) issue('no-result', 'weakquiz', '약점 퀴즈를 끝냈는데 결과 화면이 없다');
    await closeAll();
    return { answered, kbw };
  });

  /* ── 4 쭉 퀴즈: 묶음 · 계속하기 · 오늘은 여기까지 ── */
  await step('stream', async () => {
    await closeAll(); await openMenu(page, '쭉 퀴즈'); await page.waitForTimeout(500);
    const blocked = await page.locator('.st-start').isDisabled().catch(() => true);
    if (blocked) { issue('blocked', 'stream', `쭉 퀴즈가 막혔다(${(await page.locator('.st-few').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 60)})`); return { blocked: true }; }
    const reachBatch = p.style.id === 'diligent';
    if (reachBatch) await page.locator('.st-batch .chip[data-n="10"]').click();
    await audit('stream-intro');
    await page.locator('.st-start').click(); await page.waitForTimeout(700);
    let answered = 0; let kbw = 0; let checkpoint = false; let kinds = {}; let lookupMiss = 0;
    const target = reachBatch ? 14 : p.style.stream;
    for (let guard = 0; guard < target + 12 && answered < target; guard++) {
      if (await page.locator('.st-checkpoint').count()) {
        checkpoint = true;
        if (reachBatch && !rep.metrics.continued) { rep.metrics.continued = true; rep.metrics.checkpoint = true; checkpoint = false; await page.locator('.st-continue').click(); await page.waitForTimeout(500); continue; }
        break;
      }
      const run = page.locator('.st-run'); if (!(await run.count())) break;
      const kind = await run.getAttribute('data-kind'); const mode = await run.getAttribute('data-mode');
      kinds[kind] = (kinds[kind] || 0) + 1;
      const prompt = (await page.locator('.qc-prompt').innerText().catch(() => '')).trim();
      const w = kind === 'word' ? lookup(prompt) : null;
      if (mode === 'typing') {
        const knows = Boolean(w) && p.r() < p.style.acc;
        const promptIsJp = /[぀-ヿ一-鿿]/.test(prompt);
        await page.locator('.st-input').fill(knows ? (promptIsJp ? w.mean.split(/[;,]/)[0] : w.kanji) : 'ㅋㅋ');
        await page.locator('.st-submit').click();
      } else {
        const opts = await page.locator('.st-opt .qo-body b').allInnerTexts();
        let want = -1;
        if (w) want = opts.findIndex((o) => o.trim() === w.mean || o.trim() === w.kanji);
        if (kind === 'word' && want < 0) lookupMiss += 1;
        const knows = want >= 0 && p.r() < p.style.acc;
        const idx = knows ? want : Math.floor(p.r() * opts.length);
        if (p.keyboard && p.r() < 0.5) await page.keyboard.press(String(idx + 1)); else await page.locator('.st-opt').nth(idx).click();
        await page.waitForTimeout(350);
        const ok = ((await page.locator('.st-opt').nth(idx).getAttribute('class')) || '').includes('correct');
        if (knows && !ok) { kbw += 1; issue('data', 'stream', `정답을 눌렀는데 오답: 「${prompt}」`); }
        if (answered === 0) await panelCheck(opts.length, 'stream');
        if (p.keyboard && answered === 1) { await page.keyboard.press('1'); await page.waitForTimeout(150); }   // 답을 낸 뒤 1: 그 보기 듣기
      }
      answered += 1; await page.waitForTimeout(300);
      if (p.keyboard && p.r() < 0.5 && (await page.locator('.st-next').count())) await page.keyboard.press('5');
      else if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click().catch(() => {}); }
      else if (await page.locator('.st-next').count()) await page.locator('.st-next').click().catch(() => {});
      else await page.waitForTimeout(1000);
      await page.waitForTimeout(250);
    }
    if (checkpoint) { rep.metrics.checkpoint = true; await page.locator('.st-enough').click().catch(() => {}); }
    else await page.locator('.st-stop').click().catch(() => {});
    await page.waitForTimeout(600);
    const sum = await page.locator('.st-sum').count();
    if (!sum) issue('no-result', 'stream', '쭉 퀴즈를 마쳤는데 평가 화면이 없다');
    rep.metrics.stream = { answered, kbw, checkpoint: Boolean(rep.metrics.checkpoint), kinds, lookupMiss, summary: Boolean(sum) };
    if (reachBatch && !rep.metrics.checkpoint) issue('batch', 'stream', '10문제 묶음인데 멈춰서 묻지 않았다');
    await shot('stream-sum');
    await closeAll();
    return { answered, kbw, checkpoint };
  });

  /* ── 5 단어 시험 ── */
  await step('exam', async () => {
    await closeAll(); await openMenu(page, '단어 시험'); await page.waitForTimeout(700);
    const scopeName = ['외운 것', '약점', '전체'][p.id % 3];
    const chip = page.locator('.chiprow .chip', { hasText: new RegExp(`^${scopeName}$`) }).first();
    if (await chip.count()) await chip.click().catch(() => {});
    rep.metrics.examScope = scopeName;
    const start = page.locator('button', { hasText: '시험 시작' }).first();
    if (await start.count()) await start.click(); else await page.locator('.submit-btn').first().click();
    await page.waitForTimeout(900);
    if (!(await page.locator('.qoptions').count())) {
      if (scopeName === '약점' && /출제할 단어가 없어요|없어요/.test(await page.locator('.toast').innerText().catch(() => ''))) { rep.metrics.examScopeEmpty = true; return { empty: true }; }
      throw new Error(`시험 문제가 안 뜸(${scopeName})`);
    }
    let answered = 0; let right = 0; let kbw = 0; let panelOpen = 0;
    for (let i = 0; i < p.style.exam; i++) {
      if (!(await page.locator('.qoptions .qopt').count())) break;
      const prompt = (await page.locator('.qc-prompt').innerText().catch(() => '')).trim();
      const opts = await page.locator('.qoptions .qopt .qo-body b').allInnerTexts();
      const w = lookup(prompt); let want = -1;
      if (w) want = opts.findIndex((o) => o.trim() === w.mean || o.trim() === w.kanji);
      const knows = want >= 0 && p.r() < p.style.acc;
      const idx = knows ? want : Math.floor(p.r() * opts.length);
      if (p.keyboard && p.r() < 0.5) await page.keyboard.press(String(idx + 1)); else await page.locator('.qoptions .qopt').nth(idx).click();
      await page.waitForTimeout(450);
      const ok = ((await page.locator('.qoptions .qopt').nth(idx).getAttribute('class')) || '').includes('correct');
      answered += 1; if (ok) right += 1;
      if (knows && !ok) { kbw += 1; issue('data', 'exam', `정답을 눌렀는데 오답: 「${prompt}」`); }
      if (i === 0) { await panelCheck(opts.length, 'exam'); if (ok && !(await page.locator('.qo-why .qo-replay').count()) && /example/.test('')) issue('example', 'exam', '예문 없음'); await audit('exam-answered'); }
      if (await page.locator('.optrev').count()) panelOpen += 1;
      const nx = page.locator('.qnext .submit-btn'); if (await nx.count()) { if (p.keyboard && p.r() < 0.5) await page.keyboard.press('5'); else await nx.click().catch(() => {}); } else await page.waitForTimeout(1100);
      await page.waitForTimeout(250);
    }
    rep.metrics.exam = { answered, right, kbw, panelOpen };
    await closeAll();
    return { answered, right, kbw };
  });

  /* ── 6 N3 학습하기 ── */
  await step('n3', async () => {
    await closeAll(); await openMenu(page, 'N3 학습하기');
    await page.locator('.n3-hub').waitFor({ timeout: 8000 });
    const hub = await page.evaluate(() => { const s = document.querySelector('.n3-sum'); return { progress: s?.dataset.progress, readiness: s?.dataset.readiness, begun: s?.dataset.begun }; });
    rep.metrics.n3hub = hub;
    await audit('n3-hub');
    let quizzes = 0; let answered = 0; let kbw = 0; let unknownQ = 0;
    await page.locator('.n3-cta').click(); await page.waitForTimeout(700);
    rep.metrics.n3steps = await page.locator('.n3-steprow').evaluateAll((els) => els.map((e) => e.dataset.step)).catch(() => []);
    for (let act = 0; act < 16 && quizzes < p.style.n3; act++) {
      if (await page.locator('.n3-quiz').count()) {
        let cap = 12;
        while ((await page.locator('.n3-quiz').count()) && cap-- > 0) {
          const qid = await page.locator('.n3-quiz').getAttribute('data-qid');
          const ans = n3Answer(qid); if (ans == null) unknownQ += 1;
          const opts = page.locator('.n3-quiz .qopt'); const n = await opts.count();
          let target = -1;
          for (let j = 0; j < n; j++) { if ((await opts.nth(j).getAttribute('data-opt')) === ans) target = j; }
          const knows = target >= 0 && p.r() < p.style.acc;
          await opts.nth(knows ? target : Math.floor(p.r() * n)).click(); await page.waitForTimeout(350);
          answered += 1;
          const ok = ((await opts.nth(knows ? target : 0).getAttribute('class')) || '').includes('correct');
          if (knows && !ok) { kbw += 1; issue('data', 'n3', `정답을 눌렀는데 오답: ${qid}`); }
          if (await page.locator('.n3-next').count()) { await panelCheck(n, `n3:${qid.split(':')[0]}`); await page.locator('.n3-next').click().catch(() => {}); }
          await page.waitForTimeout(250);
        }
        quizzes += 1;
        if (await page.locator('.n3-done').count()) await page.locator('.n3-done').click().catch(() => {});
        await page.waitForTimeout(500); continue;
      }
      if (await page.locator('.n3-toquiz').count()) { await page.locator('.n3-toquiz').click().catch(() => {}); await page.waitForTimeout(600); continue; }
      if (await page.locator('.n3-recap').count()) { await page.locator('.n3-finish-btn').click().catch(() => {}); await page.waitForTimeout(500); continue; }
      const stepBtn = page.locator('.n3-grammar .submit-btn, .n3-kanji .submit-btn, .n3-reading .submit-btn, .n3-vocab .submit-btn').last();
      if (await page.locator('.n3-runnext').count()) { await page.locator('.n3-runnext').click().catch(() => {}); await page.waitForTimeout(700); continue; }
      if (await stepBtn.count()) { await stepBtn.click().catch(() => {}); await page.waitForTimeout(450); continue; }
      break;
    }
    rep.metrics.n3 = { quizzes, answered, kbw, unknownQ };
    await shot('n3');
    /* 허브의 여러 길: 전체 과정 · 복습 · 실전 테스트 · 약점 · 오답노트 */
    const paths = {};
    for (const sel of ['.n3-tile:nth-child(1)', '.n3-tile:nth-child(2)', '.n3-tile:nth-child(3)', '.n3-weakbtn', '.n3-wrongbtn']) {
      await closeAll();
      if (!(await page.locator('.n3-hub').count())) { await openMenu(page, 'N3 학습하기'); await page.locator('.n3-hub').waitFor({ timeout: 6000 }).catch(() => {}); }
      const el = page.locator(sel).first(); if (!(await el.count())) { paths[sel] = 'none'; continue; }
      const t0p = Date.now();
      await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700);
      const a = await audit(`n3path:${sel}`);
      paths[sel] = { len: a.len, ms: Date.now() - t0p };
      if (a.len < 80) issue('empty', `n3path:${sel}`, `글자 ${a.len}자뿐`);
      await touch(2, `n3path:${sel}`);
    }
    rep.metrics.n3paths = paths;
    await closeAll();
    return { quizzes, answered, kbw };
  });

  /* ── 7 다른 퀴즈 맛보기 ── */
  const TASTE = ['문장 만들기', '동사 활용', '부사 연습', '짝 맞추기', '상황 대화'];
  const taste = TASTE.slice(Math.floor(p.r() * TASTE.length)).concat(TASTE).slice(0, Math.min(3, p.style.tour));
  for (const name of taste) {
    await step(`taste:${name}`, async () => {
      await closeAll(); await openMenu(page, name); await page.waitForTimeout(600);
      const a = await audit(`taste:${name}`);
      let acts = 0; let answered = 0;
      for (let k = 0; k < 6; k++) {
        const q = page.locator('.qoptions .qopt:not([disabled]), .n3-opts .qopt:not([disabled])');
        if (await q.count()) { await q.nth(Math.floor(p.r() * (await q.count()))).click().catch(() => {}); answered += 1; acts += 1; await page.waitForTimeout(450); const nx = page.locator('.qnext .submit-btn, .cmp-next, .rp-next, .mt-nextround, .swl-next').first(); if (await nx.count()) await nx.click().catch(() => {}); continue; }
        const cand = page.locator('.subscreen.open button:visible, .screen.active button:visible').filter({ hasNotText: DANGER });
        const n = await cand.count(); const usable = [];
        for (let q2 = 0; q2 < Math.min(n, 30); q2++) {
          const el = cand.nth(q2); const cls = (await el.getAttribute('class').catch(() => '')) || ''; const lab = ((await el.getAttribute('aria-label').catch(() => '')) || '') + ((await el.innerText().catch(() => '')) || '');
          if (/sub-back|sh-close|inner-back|moreback|si-back|\btab\b|뒤로|그만두기/.test(cls + lab)) continue; usable.push(q2);
        }
        if (usable.length) { await cand.nth(usable[Math.floor(p.r() * usable.length)]).click({ timeout: 2500 }).catch(() => {}); acts += 1; }
        await page.waitForTimeout(400);
        if (/화면을 불러오지 못했어요/.test(await page.locator('body').innerText())) { issue('load-fail', `taste:${name}`, '불러오기 실패'); break; }
      }
      if (a.len < 80) issue('empty', `taste:${name}`, `글자 ${a.len}자뿐`);
      await closeAll();
      return { acts, answered };
    });
  }

  /* ── 8 복습&내기록 ── */
  await step('me', async () => {
    await closeAll(); await goTab(page, '내 학습'); await page.waitForTimeout(500);
    await audit('me-tab');
    const rows = await page.locator('.me-row').evaluateAll((els) => els.map((e) => `${e.dataset.row}:${(e.innerText || '').replace(/\s+/g, ' ').slice(0, 30)}`));
    rep.metrics.meRows = rows;
    for (const row of ['review', 'wrong', 'weak']) {
      await goTab(page, '내 학습', 300);
      const el = page.locator(`.me-row[data-row="${row}"]`);
      if (!(await el.count())) { issue('missing', 'me', `${row} 줄이 없다`); continue; }
      await el.click(); await page.waitForTimeout(700);
      const a = await audit(`me:${row}`);
      if (a.len < 60) issue('empty', `me:${row}`, `글자 ${a.len}자뿐`);
      if (row === 'weak' && p.style.id !== 'impatient') { const q = page.locator('.wk-quiz'); if (await q.count() && !(await q.isDisabled())) { rep.metrics.weakQuizBtn = true; } }
      rep.metrics[`me_${row}`] = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 90);
      if (row !== 'weak' || p.style.id === 'explorer') await touch(2, `me:${row}`);
      await closeAll();
    }
  });

  /* ── 9 설정 ── */
  await step('settings', async () => {
    await closeAll();
    const before = await settingsOf();
    const groups = ['study', 'voice', 'account', 'backup', 'tools', 'about'];
    let opened = 0;
    for (const g of groups.slice(0, p.style.id === 'impatient' ? 2 : groups.length)) {
      await openMore(page, g).catch(() => {}); await page.waitForTimeout(400);
      await audit(`settings:${g}`); opened += 1;
      if (g === 'study') {
        const chips = page.locator('.moregroup-open .chip:visible, .screen.active .chip:visible');
        const cn = await chips.count();
        if (cn) { const el = chips.nth(Math.floor(p.r() * Math.min(cn, 6))); const t = ((await el.innerText().catch(() => '')) || '').trim(); if (!DANGER.test(t)) await el.click().catch(() => {}); await page.waitForTimeout(400); }
      }
    }
    /* 목표 레벨을 N4로 바꿨다가 되돌린다 — 오늘 화면 줄 이름이 따라가야 한다 */
    await openMore(page, 'study').catch(() => {}); await page.waitForTimeout(400);
    const btn = (lv) => page.locator('.screen.active .grouppick[data-set="goalLevel"] button', { hasText: new RegExp(`^${lv}$`) }).first();
    if (await btn('N4').count()) {
      await btn('N4').click(); await page.waitForTimeout(400);
      await goTab(page, '오늘'); await page.waitForTimeout(900);
      const labN4 = (await page.locator('.hg-lab').innerText().catch(() => '')).trim();
      rep.metrics.goalLabelN4 = labN4;
      if (labN4 !== 'JLPT N4') issue('goal-label', 'settings', `목표를 N4로 바꿨는데 줄 이름이 「${labN4}」`);
      await openMore(page, 'study').catch(() => {}); await page.waitForTimeout(400);
      await btn('N3').click().catch(() => {}); await page.waitForTimeout(400);
    } else issue('missing', 'settings', '목표 레벨 버튼이 없다');
    const after = await settingsOf();
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    rep.metrics.settingsChanged = changed;
    await goTab(page, '오늘');
    return { opened };
  });

  /* ── 10 새로고침해도 ── */
  await step('persist', async () => {
    const before = await reviewCount();
    await ctx.setOffline(false); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000); await ctx.setOffline(true);
    const off = page.locator('.gate-offline'); await off.waitFor({ timeout: 8000 }).catch(() => {}); if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
    await page.locator('.tabbar').waitFor({ timeout: 15000 });
    await page.waitForTimeout(3200);
    const after = await reviewCount();
    const goal = (await page.locator('.hm-goal').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const perf = await page.evaluate(() => ({ heapMB: Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576), storageKB: Math.round(Object.entries(localStorage).reduce((t, [k, v]) => t + k.length + v.length, 0) / 1024), nav: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0) })).catch(() => ({}));
    rep.metrics.perf = perf;
    rep.metrics.persist = { before, after, goalAfter: goal, reviewStart: rep.metrics.reviewBefore };
    if (after < before) issue('data-loss', 'persist', `새로고침 뒤 기록이 줄었다 ${before} → ${after}`);
    if (after <= (rep.metrics.reviewBefore || 0) && (rep.metrics.cardsSeen || 0) + (rep.metrics.stream?.answered || 0) > 5 && p.tier.id === 'n5') { /* N5는 새 단어가 늘어야 한다 */ }
    return { before, after };
  });

  await ctx.close();
  return rep;
}

/* ── 돌리기 (한 명씩 저장 · RESUME=1로 이어서) ── */
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const only = (process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const people = Array.from({ length: N }, (_, i) => persona(i)).filter((p) => !only.length || only.includes(p.id));
  let results = [];
  if (process.env.RESUME && existsSync(OUT)) { try { results = JSON.parse(readFileSync(OUT, 'utf8')).results || []; } catch { results = []; } }
  const doneIds = new Set(results.map((r) => r.id));
  const todo = people.filter((p) => !doneIds.has(p.id));
  const save = () => { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, n: N, results: [...results].sort((a, b) => a.id - b.id) }, null, 1)); };
  let next = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (next < todo.length) {
      const p = todo[next++];
      try { results.push(await run(browser, p)); }
      catch (e) { results.push({ id: p.id, device: p.dev.id, style: p.style.id, tier: p.tier.id, steps: [], issues: [{ kind: 'crash', where: 'sim', detail: String(e.message).slice(0, 200) }], metrics: {} }); }
      save();
      console.log(`  ${results.length}/${N} 끝 — #${p.id} ${p.dev.id}/${p.style.id}/${p.tier.id}  ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }));
  await browser.close();
  save();
  console.log(`\n저장: ${OUT}`);
})();
