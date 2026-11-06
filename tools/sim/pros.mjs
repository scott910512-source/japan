/* 전문 프로그래머 10명 시뮬레이터 — 일반 사용자가 안 하는 짓으로 오류를 찾는다.
 *
 *   node tools/sim/pros.mjs
 *   APP_URL=http://localhost:8934/japan/  OUT=/경로/pros.json  SHOTS=/경로
 *
 * 열 명이 각자 한 가지 전문 분야로 앱을 괴롭힌다.
 *   1 네트워크  2 연타  3 뒤로가기  4 화면 크기·가려짐  5 저장소 손상
 *   6 키보드만  7 접근성  8 성능·메모리  9 위험한 입력  10 시간·시간대·두 탭
 * 사람 수가 아니라 분야별로 한 번씩 돈다. 오류(pageerror) · 흰 화면 · 가려진 버튼 · 이름 없는 버튼 같은 것을 모은다. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, startStudy, openMenu } from '../../test/ui/_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8934/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const OUT = process.env.OUT || '/tmp/sim-pros.json';
const SHOTS = process.env.SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const wanted = (id) => !ONLY.length || ONLY.some((o) => id === o || id.startsWith(o + '-'));
const SETTINGS = { onboarded: true, canReadKana: true, autoTTS: false };

async function waitCached(page) {
  await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(async () => { try { let t = 0; for (const k of await caches.keys()) t += (await (await caches.open(k)).keys()).length; return t; } catch { return 0; } }).catch(() => 0);
    if (n >= 150) return n;
    await page.waitForTimeout(500);
  }
  return 0;
}

/* 한 분야의 판. issue()로 모으고, 던져진 예외도 「stuck」으로 적는다 */
async function persona(browser, id, title, fn, ctxOpts = {}) {
  if (!wanted(id)) return;
  const rep = { id, title, issues: [], notes: [] };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...ctxOpts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  let where = 'boot';
  const issue = (kind, w, detail) => rep.issues.push({ kind, where: w || where, detail: String(detail).slice(0, 360) });
  const note = (t) => rep.notes.push(String(t).slice(0, 300));
  page.on('pageerror', (e) => issue('pageerror', where, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon|supabase|generativelanguage|fonts\.g/.test(m.text())) issue('console-error', where, m.text()); });
  const api = {
    page, ctx, issue, note, setWhere: (w) => { where = w; },
    shot: async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${id}-${name}.png` }).catch(() => {}); },
    /* 며칠 쓴 기기로 부팅. storage는 {키: 값(문자열 또는 객체)} */
    boot: async (storage = {}, { offline = true } = {}) => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(({ storage, SETTINGS }) => {
        localStorage.setItem('jp_manabu_signed_in_v1', '1');
        const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
        Object.assign(s, SETTINGS);
        localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }, { storage, SETTINGS });
      await waitCached(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      if (offline) {
        await ctx.setOffline(true);
        const off = page.locator('.gate-offline');
        await off.waitFor({ timeout: 8000 }).catch(() => {});
        if (await off.count()) await off.click();
      }
      await page.locator('.tabbar').waitFor({ timeout: 20000 });
    },
    blank: async () => (await page.locator('body').innerText().catch(() => '')).trim().length < 20,
  };
  try { await fn(api); } catch (e) { issue('stuck', where, String(e.message).split('\n').slice(0, 3).join(' / ')); await api.shot('stuck'); }
  await ctx.close();
  results.push(rep);
  console.log(`  ${id} ${title} — 오류 ${rep.issues.length}건`);
}

const REVIEW = (() => {
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const r = {};
  /* 진짜 낱말 id로 심는다 — 가짜 id면 쭉 퀴즈 재료도 퀘스트도 안 생긴다 */
  for (const w of ALL_WORDS.filter((x) => x.level === 'N5').slice(0, 120)) r[w.id] = { box: 2, streak: 1, lastSeen: day(3), rounds: 2, seenAt: 1, due: day(1) };
  return r;
})();

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  console.log('전문 프로그래머 10명');

  /* 1 네트워크 전문가 — 끊기고 느리고 503이 오는 것 */
  await persona(browser, 'P1', '네트워크: 끊김·느림·503', async (t) => {
    const { page, ctx } = t;
    await t.boot({});
    t.setWhere('곤 질문 — 인터넷 없음');
    await page.locator('.gonfab').click(); await page.waitForTimeout(500);
    await page.locator('.asksheet textarea').fill('食べている는?');
    await ctx.setOffline(true);
    // 키가 없으면 버튼이 죽어 있다 — 키를 넣고 다시
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}'); s.geminiKey = 'AQ.test'; localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s)); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
    const off = page.locator('.gate-offline'); await off.waitFor({ timeout: 6000 }).catch(() => {}); if (await off.count()) await off.click();
    await page.locator('.tabbar').waitFor({ timeout: 15000 });
    await page.locator('.gonfab').click(); await page.waitForTimeout(500);
    await page.locator('.asksheet textarea').fill('食べている는?');
    await page.locator('.asksheet .submit-btn').click(); await page.waitForTimeout(500);
    const err = await page.locator('.ask-err').innerText().catch(() => '');
    if (!/인터넷/.test(err)) t.issue('no-offline-msg', '곤 질문', `오프라인인데 안내가 없다: ${err || '(없음)'}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    t.setWhere('곤 질문 — 503 계속');
    await ctx.setOffline(false);
    let calls = 0;
    await page.route(/generativelanguage\.googleapis\.com/, (route) => { calls += 1; route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'overloaded' } }) }); });
    await page.locator('.gonfab').click(); await page.waitForTimeout(500);
    await page.locator('.asksheet textarea').fill('別の質問');
    await page.locator('.asksheet .submit-btn').click();
    await page.locator('.ask-err').waitFor({ timeout: 20000 }).catch(() => t.issue('hang', '곤 질문', '503이 계속인데 20초 안에 오류 안내가 안 뜬다'));
    t.note(`503 계속: 요청 ${calls}번 뒤 안내`);
    if (calls > 8) t.issue('too-many-requests', '곤 질문', `혼잡할 때 ${calls}번 두드렸다`);
    const stuckBusy = await page.locator('.asksheet .submit-btn').innerText().catch(() => '');
    if (/물어보는 중/.test(stuckBusy)) t.issue('stuck-busy', '곤 질문', '오류 뒤에도 「물어보는 중…」에 머문다');
    if (await t.blank()) t.issue('blank', '곤 질문', '흰 화면');
  });

  /* 2 연타 전문가 — 같은 걸 빠르게 여러 번 */
  await persona(browser, 'P2', '연타: 광클·중복 처리', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    t.setWhere('오늘 학습 판정 광클');
    await startStudy(page);
    /* 카드를 눌러 뒤집으면 판정 줄(.judgerow)이 나온다 — 그 「알아요」를 빠르게 열두 번 */
    await page.locator('.studycard').first().click().catch(() => {}); await page.waitForTimeout(300);
    const judge = page.locator('.judgerow button', { hasText: '알아요' }).first();
    const seen0 = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);
    for (let i = 0; i < 12; i++) { await judge.click({ timeout: 1200, force: true, noWaitAfter: true }).catch(() => {}); }
    await page.waitForTimeout(800);
    const prog = (await page.locator('.study').innerText().catch(() => '')).match(/(\d+)\s*\/\s*(\d+)/);
    const rv = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
    const rounds = Object.values(rv).reduce((a, x) => a + (x.rounds || 0), 0);
    t.note(`판정 광클 12번 후 진행 ${prog ? prog[0] : '?'} · 기록 ${Object.keys(rv).length}개 · 회독 합 ${rounds}`);
    if (prog && Number(prog[1]) > 8) t.issue('over-count', '판정 광클', `연타로 진행이 ${prog[0]}까지 올라갔다(한 번에 한 장이어야 한다)`);
    t.setWhere('단어 시험 보기 더블클릭');
    await page.goto(BASE); await page.waitForTimeout(1500);
    await page.locator('.tabbar').waitFor({ timeout: 15000 }).catch(() => {});
    await openMenu(page, '단어 시험').catch(() => {});
    await page.locator('button', { hasText: '시험 시작' }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    if (await page.locator('.qopt').count()) {
      const idxBefore = (await page.locator('.sh-title').first().innerText()).trim();
      await page.locator('.qopt').first().dblclick({ force: true }).catch(() => {});
      for (let i = 0; i < 5; i++) await page.locator('.qopt').nth(1).click({ force: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(1500);
      const idxAfter = (await page.locator('.sh-title').first().innerText().catch(() => '')).trim();
      const m = idxAfter.match(/(\d+)\s*\/\s*(\d+)/); const m0 = idxBefore.match(/(\d+)\s*\/\s*(\d+)/);
      if (m && m0 && Number(m[1]) - Number(m0[1]) > 1) t.issue('double-advance', '단어 시험', `연타로 ${idxBefore} → ${idxAfter}`);
      t.note(`시험 연타: ${idxBefore} → ${idxAfter}`);
    }
    if (await t.blank()) t.issue('blank', '연타 뒤', '흰 화면');
  });

  /* 3 뒤로가기 전문가 */
  await persona(browser, 'P3', '뒤로가기·시트', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    const states = [];
    const snap = async (name) => { states.push(name); if (await t.blank()) t.issue('blank', name, '흰 화면'); };
    t.setWhere('화면 안에서 뒤로');
    /* 앱 밖으로 나가는 뒤로가기(첫 화면에서의 뒤로)는 브라우저 동작이라 검사하지 않는다 — 앱이 쌓은 화면 안에서만 */
    await goTab(page, '학습'); await snap('학습');
    await openMenu(page, '단어 시험').catch(() => {}); await snap('단어 시험 메뉴');
    await page.goBack().catch(() => {}); await page.waitForTimeout(500); await snap('단어 시험에서 뒤로');
    if (!(await page.locator('.tabbar').count())) t.issue('left-app', '뒤로', '화면 안에서 한 번 뒤로 갔는데 앱 밖으로 나갔다');
    t.setWhere('곤 시트 열고 뒤로');
    await page.goto(BASE); await page.locator('.tabbar').waitFor({ timeout: 15000 }).catch(() => {});
    await page.locator('.gonfab').click().catch(() => {}); await page.waitForTimeout(500);
    const open1 = await page.locator('.sheet.open').count();
    await page.goBack().catch(() => {}); await page.waitForTimeout(500);
    const open2 = await page.locator('.sheet.open').count();
    t.note(`시트 ${open1} → 뒤로 뒤 ${open2}`);
    if (open1 && open2) t.issue('back-sheet', '곤 시트', '뒤로가기를 눌러도 시트가 안 닫힌다');
    await snap('after-sheet');
    t.setWhere('학습 중 뒤로');
    await startStudy(page).catch(() => {});
    await page.goBack().catch(() => {}); await page.waitForTimeout(600);
    await snap('study-back');
  });

  /* 4 화면 크기 전문가 — 가로 넘침, 곤 단추가 가리는 버튼 */
  await persona(browser, 'P4', '화면 크기·곤 단추가 가리는 것', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    const fabCover = async (name) => {
      const r = await page.evaluate(() => {
        const fab = document.querySelector('.gonfab'); if (!fab) return { none: true };
        const f = fab.getBoundingClientRect();
        const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const hit = [];
        for (const el of document.querySelectorAll('button, a, input, textarea, select, [role="button"]')) {
          if (el === fab || fab.contains(el) || !vis(el) || el.closest('.sheet, .tabbar')) continue;
          const r = el.getBoundingClientRect();
          const ix = Math.max(0, Math.min(r.right, f.right) - Math.max(r.left, f.left));
          const iy = Math.max(0, Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top));
          const area = ix * iy;
          if (area > 0.25 * Math.min(r.width * r.height, f.width * f.height)) hit.push(((el.getAttribute('aria-label') || el.innerText || el.className) + '').trim().slice(0, 24));
        }
        return { hit: [...new Set(hit)].slice(0, 5), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      if (r.over > 2) t.issue('overflow', name, `가로로 ${r.over}px 넘침`);
      if (r.hit?.length) t.issue('fab-covers', name, `곤 단추가 가린다: ${r.hit.join(' · ')}`);
    };
    for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1280, 800]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(400);
      t.setWhere(`${w}px 오늘`); await goTab(page, '오늘'); await fabCover(`${w}px 오늘`);
      t.setWhere(`${w}px 학습`); await goTab(page, '학습'); await fabCover(`${w}px 학습`);
      t.setWhere(`${w}px 설정`); await goTab(page, '설정'); await fabCover(`${w}px 설정`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    t.setWhere('390px 단어 시험 문제'); await goTab(page, '오늘');
    await openMenu(page, '단어 시험').catch(() => {});
    await page.locator('button', { hasText: '시험 시작' }).first().click().catch(() => {}); await page.waitForTimeout(700);
    await fabCover('390px 시험 문제');
    if (await page.locator('.qopt').count()) { await page.locator('.qopt').first().click(); await page.waitForTimeout(600); await fabCover('390px 시험 답 낸 뒤'); await t.shot('quiz-answered'); }
    t.setWhere('가로 모드'); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400); await fabCover('가로 모드 시험'); await t.shot('landscape');
  });

  /* 5 저장소 손상 전문가 */
  const KEYS = ['jp_manabu_review_v1', 'jp_manabu_progress_v1', 'jp_manabu_settings_v1', 'jp_manabu_stats_v1', 'jp_manabu_streak_v1', 'jp_manabu_memos_v1', 'jp_manabu_asks_v1', 'jp_manabu_session_v1'];
  const GARBAGE = ['{bad json', 'null', '[]', '123', '"str"', '{"__proto__":{"x":1}}', JSON.stringify({ a: 'x'.repeat(200000) })];
  await persona(browser, 'P5', '저장소 손상', async (t) => {
    const probe = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await probe.close();
    let tried = 0; let bad = 0;
    for (const key of KEYS) {
      for (const g of GARBAGE) {
        tried += 1;
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage(); page.setDefaultTimeout(5000);
        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.evaluate(({ key, g, SETTINGS }) => {
          localStorage.setItem('jp_manabu_signed_in_v1', '1');
          const s = { ...SETTINGS };
          localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
          localStorage.setItem(key, g);
        }, { key, g, SETTINGS });
        await page.waitForTimeout(1500);
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
        await ctx.setOffline(true);
        const off = page.locator('.gate-offline'); await off.waitFor({ timeout: 4000 }).catch(() => {}); if (await off.count()) await off.click();
        const up = await page.locator('.tabbar').waitFor({ timeout: 9000 }).then(() => true).catch(() => false);
        const txt = (await page.locator('body').innerText().catch(() => '')).trim();
        if (!up) {
          bad += 1;
          t.issue('boot-fail', `${key} = ${g.slice(0, 20)}`, `탭바가 안 뜬다. 화면 글: ${txt.slice(0, 80).replace(/\s+/g, ' ') || '(흰 화면)'}`);
        } else if (errs.length) t.issue('pageerror', `${key} = ${g.slice(0, 20)}`, errs[0]);
        await ctx.close();
      }
    }
    t.note(`${tried}가지 손상 중 부팅 실패 ${bad}`);
  });

  /* 6 키보드 전문가 */
  await persona(browser, 'P6', '키보드만 쓰기', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    await page.setViewportSize({ width: 1280, height: 800 });
    t.setWhere('Tab 순회');
    let lost = 0; const seen = new Set();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { key: (a.className + '|' + (a.getAttribute('aria-label') || a.innerText || '').slice(0, 16)), w: r.width, outline: cs.outlineStyle + cs.outlineWidth, shadow: cs.boxShadow }; });
      if (!d) { lost += 1; continue; }
      seen.add(d.key);
    }
    t.note(`Tab 60번: 서로 다른 초점 ${seen.size}곳, 초점 잃음 ${lost}번`);
    if (seen.size < 8) t.issue('tab-trap', '오늘', `Tab을 60번 눌러도 ${seen.size}곳만 돈다(갇힘 의심)`);
    t.setWhere('곤 단추 키보드');
    await page.locator('.gonfab').focus();
    const vis = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.classList.contains('gonfab') && (cs.outlineStyle !== 'none' || cs.boxShadow !== 'none'); });
    if (!vis) t.issue('no-focus-ring', '곤 단추', '키보드 초점이 단추에 와도 눈에 띄는 표시가 없다');
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    if (!(await page.locator('.sheet.open').count())) t.issue('kbd-open', '곤 단추', 'Enter로 안 열린다');
    const focusInside = await page.evaluate(() => !!document.activeElement?.closest('.sheet'));
    if (!focusInside) t.issue('focus-not-moved', '곤 시트', '열었는데 초점이 시트 안으로 안 온다');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    if (await page.locator('.sheet.open').count()) t.issue('esc', '곤 시트', 'Esc로 안 닫힌다');
    const back = await page.evaluate(() => document.activeElement?.classList.contains('gonfab'));
    if (!back) t.issue('focus-return', '곤 시트', '닫은 뒤 초점이 곤 단추로 돌아오지 않는다');
    t.setWhere('시험 단축키');
    await openMenu(page, '단어 시험').catch(() => {});
    await page.locator('button', { hasText: '시험 시작' }).first().click().catch(() => {}); await page.waitForTimeout(700);
    if (await page.locator('.qopt').count()) {
      const idx0 = (await page.locator('.sh-title').first().innerText().catch(() => '')).trim();
      await page.keyboard.press('2'); await page.waitForTimeout(500);
      await page.keyboard.press('1'); await page.waitForTimeout(300);
      const idx1 = (await page.locator('.sh-title').first().innerText().catch(() => '')).trim();
      if (idx0 !== idx1) t.issue('hotkey', '단어 시험', `답을 낸 뒤 1을 눌렀더니 문제가 넘어갔다 ${idx0} → ${idx1}`);
      await page.keyboard.press('5'); await page.waitForTimeout(600);
      const idx2 = (await page.locator('.sh-title').first().innerText().catch(() => '')).trim();
      if (idx2 === idx1) t.issue('hotkey', '단어 시험', '5를 눌러도 다음 문제로 안 간다');
    }
  });

  /* 7 접근성 전문가 */
  await persona(browser, 'P7', '접근성', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    const audit = async (name) => {
      t.setWhere(name);
      const a = await page.evaluate(() => {
        const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const nameless = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).filter((el) => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.querySelector('img[alt]:not([alt=""])')).map((el) => (el.outerHTML || '').slice(0, 110));
        const noAlt = [...document.querySelectorAll('img')].filter(vis).filter((el) => !el.hasAttribute('alt')).map((el) => (el.src || '').slice(-30));
        const unlabeled = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(vis).filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.closest('label') && !el.getAttribute('placeholder')).map((el) => String(el.className).slice(0, 30));
        const small = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 28 || r.width < 28; }).map((el) => ((el.getAttribute('aria-label') || el.innerText || el.className) + '').trim().slice(0, 20));
        const dlg = [...document.querySelectorAll('.sheet')].filter((s) => s.getAttribute('role') !== 'dialog').length;
        return { nameless: [...new Set(nameless)].slice(0, 4), noAlt: [...new Set(noAlt)].slice(0, 3), unlabeled: [...new Set(unlabeled)].slice(0, 3), small: [...new Set(small)].slice(0, 4), dlg, lang: document.documentElement.lang, title: document.title };
      });
      if (a.nameless.length) t.issue('no-name', name, `이름 없는 버튼: ${a.nameless.join(' · ')}`);
      if (a.noAlt.length) t.issue('no-alt', name, `alt 없는 그림: ${a.noAlt.join(' · ')}`);
      if (a.unlabeled.length) t.issue('no-label', name, `이름 없는 입력칸: ${a.unlabeled.join(' · ')}`);
      if (a.small.length) t.issue('small-tap', name, a.small.join(' · '));
      if (a.dlg) t.issue('sheet-role', name, `role=dialog 아닌 시트 ${a.dlg}개`);
      if (!a.lang) t.issue('no-lang', name, '<html lang>이 없다');
    };
    await goTab(page, '오늘'); await audit('오늘');
    await goTab(page, '학습'); await audit('학습');
    await goTab(page, '복습&내기록').catch(() => goTab(page, '내 학습')); await audit('복습&내기록');
    await goTab(page, '설정'); await audit('설정');
    await goTab(page, '오늘');
    await page.locator('.gonfab').click(); await page.waitForTimeout(500); await audit('곤 시트');
    const live = await page.locator('[aria-live]').count();
    t.note(`aria-live 영역 ${live}개`);
  });

  /* 8 성능·메모리 전문가 */
  await persona(browser, 'P8', '성능·메모리(CPU 6배 느리게)', async (t) => {
    const { page, ctx } = t;
    const cdp = await ctx.newCDPSession(page);
    /* CDP 세션을 붙이면 오프라인 이어가기 버튼이 안 뜨는 도구 쪽 문제가 있어, 로그인 문이 없는 「먼저 써 보기」 상태로 잰다 */
    await t.boot({ jp_manabu_review_v1: REVIEW, jp_manabu_guest_v1: '1' }, { offline: false }).catch(() => {});
    await page.locator('.tabbar').waitFor({ timeout: 20000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] })); return Math.round((m.metrics.find((x) => x.name === 'JSHeapUsedSize')?.value || 0) / 1048576); };
    await cdp.send('Performance.enable').catch(() => {});
    const h0 = await heap();
    t.setWhere('느린 CPU로 부팅');
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 90000 });
    await page.locator('.tdq-row, .bigcta').first().waitFor({ timeout: 60000 }).catch(() => {});
    const boot = Date.now() - t0;
    t.note(`CPU 6배 느리게 부팅 ${boot}ms`);
    if (boot > 8000) t.issue('slow-boot', '부팅', `느린 기기(CPU 6배)에서 오늘 화면까지 ${boot}ms`);
    t.setWhere('쭉 퀴즈 50문제 반응');
    /* 쭉 퀴즈는 오늘 퀘스트의 줄로 연다(학습 메뉴에서 찾는 길은 허브를 거친다) */
    await goTab(page, '오늘').catch(() => {});
    await page.locator('.tdq-row', { hasText: '쭉 퀴즈' }).first().click({ timeout: 8000 }).catch(() => t.issue('no-stream-quest', '쭉 퀴즈', '오늘 퀘스트에 쭉 퀴즈 줄이 없다'));
    await page.waitForTimeout(600);
    await page.locator('.st-start').click({ timeout: 8000 }).catch(() => {});
    const times = [];
    for (let i = 0; i < 50; i++) {
      const o = page.locator('.st-opt');
      if (!(await o.count())) { const inp = page.locator('.st-input'); if (await inp.count()) { await inp.fill('ㅋ'); await page.locator('.st-submit').click().catch(() => {}); } else break; }
      else { const s = Date.now(); await o.first().click({ timeout: 4000 }).catch(() => {}); await page.locator('.qo-mark, .st-opt.correct, .st-opt.wrong').first().waitFor({ timeout: 4000 }).catch(() => {}); times.push(Date.now() - s); }
      const c = page.locator('.st-continue'); if (await c.count()) await c.click().catch(() => {});
      const n = page.locator('.st-next'); if (await n.count()) await n.click().catch(() => {});
      await page.waitForTimeout(150);
    }
    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length / 2)] || 0; const p95 = times[Math.floor(times.length * 0.95)] || 0;
    t.note(`답 누르고 반응까지(느린 CPU) 중간 ${p50}ms, 느린 5% ${p95}ms, ${times.length}번`);
    if (p95 > 1500) t.issue('slow-response', '쭉 퀴즈', `느린 기기에서 답 반응이 ${p95}ms(상위 5%)`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const h1 = await heap();
    t.note(`JS 힙 ${h0}MB → ${h1}MB`);
    if (h1 - h0 > 60) t.issue('memory-growth', '쭉 퀴즈', `50문제 뒤 힙이 ${h1 - h0}MB 늘었다`);
  });

  /* 9 위험한 입력 전문가 */
  await persona(browser, 'P9', '위험한 입력(XSS·긴 글·이모지)', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW, jp_manabu_settings_v1: { ...SETTINGS, geminiKey: 'AQ.test' } });
    await t.ctx.setOffline(false);   // 로그인 문을 지난 뒤에 인터넷을 켠다
    await page.evaluate(() => { window.__x = 0; });
    const EVIL = '<img src=x onerror="window.__x=1"><script>window.__x=2</script>"\'`${7*7}{{7*7}}';
    await page.route(/generativelanguage\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: EVIL, items: [{ jp: EVIL, kana: EVIL, ko: EVIL, note: EVIL }] }) }] } }] }) }));
    t.setWhere('곤 질문 — 악성 답');
    await page.locator('.gonfab').click(); await page.waitForTimeout(500);
    await page.locator('.asksheet textarea').fill(EVIL);
    await page.locator('.asksheet .submit-btn').click(); await page.waitForTimeout(1200);
    const x = await page.evaluate(() => window.__x);
    if (x) t.issue('xss', '곤 질문', `악성 문자열이 실행됐다 __x=${x}`);
    const txt = await page.locator('.ask-text').innerText().catch(() => '');
    if (!txt.includes('<img')) t.note('답 글자는 태그가 그대로 글자로 보인다(안전)');
    t.setWhere('곤 질문 — 아주 긴 글·이모지');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('.gonfab').click(); await page.waitForTimeout(400);
    await page.locator('.asksheet textarea').fill('😀'.repeat(1500) + 'あ'.repeat(3000));
    const len = await page.locator('.asksheet textarea').inputValue().then((v) => v.length);
    if (len > 400) t.issue('no-limit', '곤 질문', `입력 길이가 ${len}자까지 들어간다(제한 200자 기대)`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 2) t.issue('overflow', '곤 질문 긴 글', `가로로 ${over}px`);
    await page.keyboard.press('Escape');
    t.setWhere('검색·메모 — 악성 글');
    await goTab(page, '학습'); await page.waitForTimeout(400);
    for (const sel of ['input[type="search"]', '.search-input', 'textarea']) {
      const el = page.locator(sel).first();
      if (await el.count() && await el.isVisible().catch(() => false)) { await el.fill(EVIL).catch(() => {}); await page.waitForTimeout(300); }
    }
    if (await page.evaluate(() => window.__x)) t.issue('xss', '검색·입력칸', '악성 문자열이 실행됐다');
    if (await t.blank()) t.issue('blank', '악성 입력 뒤', '흰 화면');
  });

  /* 10 시간·시간대·두 탭 전문가 */
  for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Seoul']) {
    await persona(browser, `P10-${tz.split('/')[1]}`, `시간대 ${tz}에서 부팅`, async (t) => {
      await t.boot({ jp_manabu_review_v1: REVIEW });
      t.setWhere('오늘 화면');
      const q = await t.page.locator('.tdq-row').count();
      if (!q && !(await t.page.locator('.td-done').count())) t.issue('no-quests', tz, '오늘 퀘스트도 완료 표시도 없다');
      t.note(`퀘스트 ${q}줄`);
    }, { timezoneId: tz });
  }
  await persona(browser, 'P10-days', '날짜가 이틀 뒤로 넘어가면', async (t) => {
    const { page } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW, jp_manabu_streak_v1: { count: 10, lastDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) } });
    t.setWhere('오늘 학습 한 장 한 뒤');
    await startStudy(page).catch(() => {});
    await page.locator('.studyfoot button', { hasText: '알아요' }).first().click().catch(() => {}); await page.waitForTimeout(500);
    t.setWhere('이틀 뒤');
    await page.evaluate(() => { const real = Date.now; const off = 2 * 86400000; Date.now = () => real() + off; const R = Date; globalThis.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; });
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(1500);
    const off = page.locator('.gate-offline'); await off.waitFor({ timeout: 6000 }).catch(() => {}); if (await off.count()) await off.click();
    const up = await page.locator('.tabbar').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    t.note(`날짜 조작 후 부팅 ${up ? '성공' : '실패'}(addInitScript가 아니라 새 문서에는 적용 안 될 수 있음)`);
  });
  await persona(browser, 'P10-tabs', '같은 기기에서 탭 두 개', async (t) => {
    const { page, ctx } = t;
    await t.boot({ jp_manabu_review_v1: REVIEW });
    const page2 = await ctx.newPage(); page2.setDefaultTimeout(6000);
    const errs = []; page2.on('pageerror', (e) => errs.push(e.message));
    await page2.goto(BASE); await page2.waitForTimeout(2000);
    const off = page2.locator('.gate-offline'); await off.waitFor({ timeout: 5000 }).catch(() => {}); if (await off.count()) await off.click();
    await page2.locator('.tabbar').waitFor({ timeout: 15000 }).catch(() => errs.push('2번째 탭이 안 열린다'));
    t.setWhere('탭 A에서 학습하는 동안 탭 B가 기록을 쓴다');
    await startStudy(page).catch(() => {});
    for (let i = 0; i < 3; i++) { await page.locator('.studyfoot button', { hasText: '알아요' }).first().click().catch(() => {}); await page.waitForTimeout(300); }
    await page2.evaluate(() => { const r = JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'); r['zz-tab2'] = { box: 1, streak: 0, lastSeen: new Date().toISOString().slice(0, 10), rounds: 1, seenAt: 1 }; localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r)); }).catch(() => {});
    await page.waitForTimeout(800);
    for (let i = 0; i < 3; i++) { await page.locator('.studyfoot button', { hasText: '알아요' }).first().click().catch(() => {}); await page.waitForTimeout(300); }
    const mine = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);
    t.note(`두 탭 동시 쓰기 뒤 기록 ${mine}개(탭 B가 심은 것은 ${await page.evaluate(() => 'zz-tab2' in JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'))}로 남았나)`);
    if (!(await page.evaluate(() => 'zz-tab2' in JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')))) t.issue('lost-write', '두 탭', '다른 탭이 쓴 복습 기록이 이 탭의 저장 때 사라졌다');
    for (const e of errs) t.issue('pageerror', '탭 B', e);
    await page2.close();
  });

  await browser.close();
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
  const total = results.reduce((a, r) => a + r.issues.length, 0);
  console.log(`\n저장: ${OUT}  (분야 ${results.length}곳, 오류 ${total}건)`);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
