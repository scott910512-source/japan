/* 초보 학습자 시뮬레이터.
 *
 * 처음 일본어를 공부하는 사람 N명(기본 50)이 앱을 처음 켜서 하루 공부를 하는 것을 흉내 낸다.
 * 사람마다 기기 · 가나를 읽는지 · 하루 분량 · 공부 스타일(성실 · 보통 · 찍기 · 성급 · 탐험)이 다르다.
 *
 *   node tools/sim/beginners.mjs [사람 수] [동시에 돌릴 수]
 *   APP_URL=http://localhost:8934/japan/  OUT=/경로/results.json
 *
 * 각 사람의 하루:
 *   1 온보딩(목적 · 가나 · 분량)    2 오늘 화면 살피기       3 오늘 학습 카드 넘기기
 *   4 단어 시험                      5 쭉 퀴즈 열어 보기      6 메뉴 둘러보기
 *   7 새로고침해도 기록이 남는지
 * 매 단계 화면 오류 · 콘솔 오류 · 가로 넘침 · 작은 버튼 · 막힘을 모은다.
 *
 * ★ 「알고 푸는」 사람은 자료에서 정답을 찾아 누른다 ★
 * 그런데 앱이 그걸 오답으로 채점하면 앱의 잘못이다(뜻이 겹치는 낱말, 자료 오류).
 * 그런 경우를 따로 센다(knownButWrong).
 *
 * 실제 가입 · 서버 동기화는 검사 환경에서 못 쓴다. 로그인 관문은 「이 기기 기록으로 계속하기」로 지난다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { goTab, openMenu } from '../../test/ui/_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8934/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const N = Number(process.argv[2] || 50);
const PAR = Number(process.argv[3] || 5);
const OUT = process.env.OUT || '/tmp/sim-results.json';
const SHOTS = process.env.SHOTS || null;

/* ── 사람 만들기 (같은 번호면 늘 같은 사람) ── */
const DEVICES = [
  { id: 'phone-s', w: 360, h: 640, touch: true },
  { id: 'phone', w: 390, h: 844, touch: true },
  { id: 'phone-l', w: 430, h: 932, touch: true },
  { id: 'tablet', w: 768, h: 1024, touch: true },
  { id: 'desktop', w: 1280, h: 800, touch: false },
];
const STYLES = [
  { id: 'diligent', acc: 0.85, cards: 14, exam: 10, tour: 3 },
  { id: 'average', acc: 0.6, cards: 10, exam: 8, tour: 3 },
  { id: 'guesser', acc: 0.3, cards: 8, exam: 8, tour: 2 },
  { id: 'impatient', acc: 0.5, cards: 3, exam: 3, tour: 1 },
  { id: 'explorer', acc: 0.6, cards: 5, exam: 4, tour: 99 },
];
const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
function persona(i) {
  const r = rng(i + 7);
  const dev = DEVICES[i % DEVICES.length];
  const style = STYLES[Math.floor(i / DEVICES.length) % STYLES.length];
  return {
    id: i + 1, dev, style,
    kana: r() < 0.5,                       // 히라가나를 읽을 수 있다
    purpose: Math.floor(r() * 3),          // 온보딩 목적 셋 중 하나
    amount: Math.floor(r() * 3),           // 하루 분량 셋 중 하나
    keyboard: !dev.touch,
    r,
  };
}

/* ── 자료에서 정답 찾기 ── */
const byKanji = new Map(); const byKana = new Map(); const byMean = new Map();
for (const w of ALL_WORDS) {
  if (!byKanji.has(w.kanji)) byKanji.set(w.kanji, w);
  if (!byKana.has(w.kana)) byKana.set(w.kana, w);
  if (!byMean.has(w.mean)) byMean.set(w.mean, w);
}

/* 서비스워커가 앱 파일을 다 캐시할 때까지 기다린다 — 안 기다리고 오프라인으로 돌리면 느리게 불러오는 화면이 비어 버린다.
   (사람이 비행기 모드로 들어가기 전에 한 번 열어 본 상태를 흉내 낸다) */
async function waitCached(page) {
  await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(async () => { try { let t = 0; for (const k of await caches.keys()) t += (await (await caches.open(k)).keys()).length; return t; } catch { return 0; } }).catch(() => 0);
    if (n >= 150) return n;
    await page.waitForTimeout(500);
  }
  return 0;
}

/* ── 한 사람 ── */
async function run(browser, p) {
  const rep = { id: p.id, device: p.dev.id, style: p.style.id, kana: p.kana, steps: [], issues: [], metrics: {} };
  const ctx = await browser.newContext({
    viewport: { width: p.dev.w, height: p.dev.h }, hasTouch: p.dev.touch, isMobile: p.dev.touch && p.dev.w < 600,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const issue = (kind, where, detail) => { rep.issues.push({ kind, where, detail: String(detail).slice(0, 240) }); };
  page.on('pageerror', (e) => issue('pageerror', 'runtime', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource|net::ERR/i.test(m.text())) issue('console', 'runtime', m.text()); });

  const step = async (name, fn) => {
    const t0 = Date.now();
    try { const out = await fn(); rep.steps.push({ name, ok: true, ms: Date.now() - t0, ...(out && typeof out === 'object' ? out : {}) }); }
    catch (e) { rep.steps.push({ name, ok: false, ms: Date.now() - t0, err: String(e.message).split('\n')[0].slice(0, 200) }); issue('stuck', name, e.message.split('\n').slice(0, 4).join(' / ')); await shot(`stuck-${name}`); }
  };
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/p${p.id}-${name}.png` }).catch(() => {}); };
  /* 화면이 가로로 넘치는지 · 눌러지지 않을 만큼 작은 버튼 · 이름 없는 버튼 */
  const audit = async (where) => {
    const a = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const small = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 30 || r.width < 30; })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24));
      const nameless = [...document.querySelectorAll('button')].filter(vis).filter((el) => !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'))
        .map((el) => el.className.toString().slice(0, 30));
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 6), nameless: [...new Set(nameless)].slice(0, 4), boundary: /화면을 불러오지 못했어요/.test(document.body.innerText) };
    });
    if (a.over > 2) issue('overflow', where, `가로로 ${a.over}px 넘침`);
    if (a.small.length) issue('small-tap', where, a.small.join(' · '));
    if (a.nameless.length) issue('no-label', where, a.nameless.join(' · '));
    if (a.boundary) issue('load-fail', where, '「화면을 불러오지 못했어요」');
  };

  /* 1 온보딩 — 처음 켰을 때의 화면부터 */
  await step('boot', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const wall = /로그인/.test(await page.locator('body').innerText()) && !(await page.locator('.tabbar').count());
    rep.metrics.loginWall = wall;
    await page.evaluate(() => localStorage.setItem('jp_manabu_signed_in_v1', '1'));
    rep.metrics.cached = await waitCached(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    const off = page.locator('.gate-offline');
    await off.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
    await page.locator('.onboarding, .tabbar').first().waitFor({ timeout: 20000 });
    return { loginWall: wall };
  });

  await step('onboarding', async () => {
    if (!(await page.locator('.onboarding').count())) throw new Error('온보딩이 안 뜸');
    await shot('onb1');
    const slides = await page.locator('.ob-slide').count();
    rep.metrics.onbSlides = slides;
    const pick = async (idx) => { const c = page.locator('.ob-slide.active .ob-choice'); if (await c.count()) await c.nth(Math.min(idx, (await c.count()) - 1)).click(); };
    for (let k = 0; k < slides + 1; k++) {
      if (!(await page.locator('.onboarding:not(.done)').count())) break;
      const idx = k === 0 ? p.purpose : k === 1 ? (p.kana ? 0 : 1) : k === 2 ? p.amount : 0;
      await pick(idx);
      await page.waitForTimeout(150);
      const next = page.locator('.ob-next');
      if (!(await next.count()) || (await next.isDisabled().catch(() => false))) { issue('onboarding-stuck', `slide ${k + 1}`, '선택해도 「다음」이 눌리지 않는다'); break; }
      await next.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(450);
    }
    if (await page.locator('.onboarding:not(.done)').count()) {
      const skip = page.locator('.ob-skip');
      if (await skip.count()) { await skip.click().catch(() => {}); await page.waitForTimeout(600); }
    }
    await page.locator('.tabbar').waitFor({ timeout: 8000 });
    await audit('onboarding-after');
  });

  /* 2 오늘 화면 */
  await step('today', async () => {
    await page.locator('.tabbar .tab[data-tab="home"]').click();
    await page.waitForTimeout(800);
    await shot('today');
    const info = await page.evaluate(() => ({
      cta: (document.querySelector('.bigcta')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      goal: (document.querySelector('.hm-goal')?.innerText || '').replace(/\s+/g, ' '),
      quests: [...document.querySelectorAll('.tdq-row')].map((e) => e.querySelector('b')?.textContent.trim()),
      hero: (document.querySelector('.tdhead')?.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
    }));
    rep.metrics.today = info;
    if (!info.cta) issue('no-cta', 'today', '오늘 화면에 시작 버튼이 없다');
    await audit('today');
    return info;
  });

  /* 3 오늘 학습 — 카드를 넘긴다 */
  await step('study', async () => {
    const cta = page.locator('.bigcta');
    if (!(await cta.count())) throw new Error('시작 버튼 없음');
    await cta.click();
    await page.waitForTimeout(900);
    const intro = page.locator('.study.intro .bigstart');
    if (await intro.count()) { await intro.click(); await page.waitForTimeout(700); }
    let seen = 0; let known = 0; let unknown = 0; let stall = 0;
    for (let i = 0; i < p.style.cards; i++) {
      const card = page.locator('.studycard').first();
      if (!(await card.count())) { if (++stall > 2) break; await page.waitForTimeout(500); continue; }
      if (i === 0) { await shot('study'); await audit('study-front'); }
      await card.click().catch(() => {});
      await page.waitForTimeout(250);
      const know = p.r() < p.style.acc;
      const btn = page.locator(know ? '.judge.known' : (p.r() < 0.5 ? '.judge.unknown' : '.judge.vague')).first();
      if (!(await btn.count())) { issue('no-judge', 'study', `카드를 뒤집어도 판정 버튼이 없다 (${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 90)})`); await shot('nojudge'); break; }
      await btn.click().catch(() => {});
      seen += 1; if (know) known += 1; else unknown += 1;
      await page.waitForTimeout(350);
    }
    rep.metrics.cardsSeen = seen;
    /* 다 끝났으면 결과 화면의 「오늘로」, 중간에 그만두면 닫기 */
    const doneBtn = page.locator('.finish .submit-btn, .finish .bigstart').first();
    if (await doneBtn.count()) { rep.metrics.finishedSession = true; await doneBtn.click().catch(() => {}); }
    else await page.locator('.sh-close, .sub-back, .si-back').first().click().catch(() => {});
    await page.waitForTimeout(600);
    return { seen, known, unknown };
  });

  /* 4 단어 시험 */
  await step('exam', async () => {
    await openMenu(page, '단어 시험');
    await page.waitForTimeout(800);
    const start = page.locator('button', { hasText: '시험 시작' }).first();
    if (await start.count()) await start.click(); else await page.locator('.submit-btn').first().click();
    await page.waitForTimeout(900);
    if (!(await page.locator('.qoptions').count())) throw new Error('시험 문제가 안 뜸');
    await audit('exam-q');
    let answered = 0; let right = 0; let knownButWrong = 0; let unknownLookups = 0; let stalls = 0;
    for (let i = 0; i < p.style.exam; i++) {
      if (!(await page.locator('.qoptions .qopt').count())) { if (++stalls > 2) break; await page.waitForTimeout(600); continue; }
      const prompt = (await page.locator('.qc-prompt').innerText().catch(() => '')).trim();
      const opts = await page.locator('.qoptions .qopt .qo-body b').allInnerTexts();
      /* 알고 푼다 — 자료에서 정답을 찾는다 */
      const w = byKanji.get(prompt) || byKana.get(prompt) || byMean.get(prompt);
      let want = -1;
      if (w) want = opts.findIndex((o) => o.trim() === w.mean || o.trim() === w.kanji);
      if (want < 0) unknownLookups += 1;
      const knows = want >= 0 && p.r() < p.style.acc;
      const pickIdx = knows ? want : Math.floor(p.r() * opts.length);
      if (p.keyboard && p.r() < 0.5) await page.keyboard.press(String(pickIdx + 1)); else await page.locator('.qoptions .qopt').nth(pickIdx).click();
      await page.waitForTimeout(450);
      const ok = ((await page.locator('.qoptions .qopt').nth(pickIdx).getAttribute('class')) || '').includes('correct');
      answered += 1; if (ok) right += 1;
      if (knows && !ok) { knownButWrong += 1; issue('data', 'exam', `정답을 눌렀는데 오답 처리: 「${prompt}」→ ${opts[pickIdx]}`); }
      if (i === 0) { await shot('exam'); await audit('exam-answered'); }
      /* 다음으로 — 틀리면 버튼, 맞으면 저절로(펼친 칸이면 버튼) */
      const nextBtn = page.locator('.qnext .submit-btn');
      if (await nextBtn.count()) await nextBtn.click().catch(() => {});
      else await page.waitForTimeout(1100);
      await page.waitForTimeout(250);
    }
    rep.metrics.exam = { answered, right, knownButWrong, unknownLookups };
    await page.locator('.sh-close, .sub-back').first().click().catch(() => {});
    await page.waitForTimeout(500);
    return { answered, right, knownButWrong, unknownLookups };
  });

  /* 5 쭉 퀴즈 — 초보는 외운 게 적어서 막힐 수 있다 */
  await step('stream', async () => {
    await page.locator('.sh-close').first().click({ timeout: 1500 }).catch(() => {});
    await openMenu(page, '쭉 퀴즈');
    await page.waitForTimeout(500);
    const blocked = await page.locator('.st-start').isDisabled().catch(() => true);
    const few = await page.locator('.st-few').innerText().catch(() => '');
    const counts = await page.locator('.st-count').allInnerTexts().catch(() => []);
    rep.metrics.stream = { blocked, few: few.replace(/\s+/g, ' ').slice(0, 90), counts: counts.map((c) => c.replace(/\s+/g, ' ')).join(',') };
    await shot('stream');
    if (blocked) issue('blocked', 'stream', '쭉 퀴즈를 시작할 수 없다(외운 것이 적음)');
    return { blocked };
  });

  /* 6 메뉴 둘러보기 */
  await step('tour', async () => {
    for (let k = 0; k < 3; k++) { const b = page.locator('.subscreen.open .sub-back, .sh-close').first(); if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(400); } }
    await page.locator('.tabbar .tab[data-tab="study"]').click();
    await page.waitForTimeout(700);
    await audit('study-tab');
    const tiles = await page.locator('.menutile').allInnerTexts();
    rep.metrics.studyTiles = tiles.length;
    let visited = 0; const bad = [];
    const total = Math.min(tiles.length, p.style.tour);
    const order = tiles.map((t, i) => i).sort(() => p.r() - 0.5).slice(0, total);
    for (const idx of order) {
      const label = tiles[idx].replace(/\s+/g, ' ').slice(0, 20);
      await page.locator('.tabbar .tab[data-tab="study"]').click().catch(() => {});
      await page.waitForTimeout(350);
      await page.locator('.menutile').nth(idx).click().catch(() => {});
      await page.waitForTimeout(900);
      const txt = await page.locator('body').innerText();
      if (/화면을 불러오지 못했어요/.test(txt)) bad.push(label);
      await audit(`menu:${label}`);
      visited += 1;
      for (let k = 0; k < 3; k++) { const b = page.locator('.subscreen.open .sub-back, .sh-close, .study .si-back').first(); if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(300); } }
    }
    for (const t of ['me', 'settings']) { await page.locator(`.tabbar .tab[data-tab="${t}"]`).click().catch(() => {}); await page.waitForTimeout(600); await audit(`tab:${t}`); }
    return { visited, bad: bad.join(',') };
  });

  /* 7 새로고침해도 기록이 남는지 */
  await step('persist', async () => {
    const before = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);
    await ctx.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await ctx.setOffline(true);
    const off = page.locator('.gate-offline');
    await off.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
    await page.locator('.tabbar').waitFor({ timeout: 15000 });
    const after = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);
    rep.metrics.persist = { before, after };
    if (after < before) issue('data-loss', 'persist', `새로고침 뒤 기록이 줄었다 ${before} → ${after}`);
    return { before, after };
  });

  await ctx.close();
  return rep;
}

/* ── 돌리기 ── */
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const only = (process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const people = Array.from({ length: N }, (_, i) => persona(i)).filter((p) => !only.length || only.includes(p.id));
  /* 한 명 끝날 때마다 저장한다 — 중간에 멈춰도 RESUME=1로 이어서 돌린다 */
  let results = [];
  if (process.env.RESUME && existsSync(OUT)) { try { results = JSON.parse(readFileSync(OUT, 'utf8')).results || []; } catch { results = []; } }
  const doneIds = new Set(results.map((r) => r.id));
  const todo = people.filter((p) => !doneIds.has(p.id));
  const save = () => { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, n: N, results: [...results].sort((a, b) => a.id - b.id) }, null, 1)); };
  let next = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (next < todo.length) {
      const p = todo[next++];
      try { results.push(await run(browser, p)); }
      catch (e) { results.push({ id: p.id, device: p.dev.id, style: p.style.id, steps: [], issues: [{ kind: 'crash', where: 'sim', detail: String(e.message).slice(0, 200) }], metrics: {} }); }
      save();
      console.log(`  ${results.length}/${N} 끝 — #${p.id} ${p.dev.id}/${p.style.id}  ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }));
  await browser.close();
  save();
  console.log(`\n저장: ${OUT}`);
})();
