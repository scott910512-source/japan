/* 학습 탭 체험 시뮬레이터 (2차).
 *
 * beginners.mjs와 같은 50명이 이어서 한다. 이미 온보딩을 하고 오늘의 학습 카드를 몇 장 넘긴 사람들이고,
 * 이번에는 오늘 퀘스트가 아니라 「학습」 탭의 여러 기능을 직접 써 본다.
 *
 *   node tools/sim/explore.mjs [사람 수] [동시에 돌릴 수]
 *   APP_URL=…  OUT=/경로/explore.json  SHOTS=/경로  RESUME=1  ONLY=3,7
 *
 * 사람마다 보는 기능 수가 다르다(탐험형은 전부, 성급형은 셋). 기능 목록을 사람 번호만큼 돌려서 시작해,
 * 50명이 모든 기능을 고르게 거치게 한다.
 *
 * 기능마다 하는 일: 열기 → 화면 살피기(오류 · 가로 넘침 · 작은 버튼 · 이름 없는 버튼 · 빈 화면)
 *   → 눌러 보기(문제가 있으면 풀기, 카드가 있으면 뒤집기, 버튼 · 줄 누르기, 🔊) → 되돌아오기.
 * 지우기 · 초기화 · 로그아웃 같은 위험한 버튼은 누르지 않는다. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from '../../test/ui/_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8934/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const N = Number(process.argv[2] || 50);
const PAR = Number(process.argv[3] || 5);
const OUT = process.env.OUT || '/tmp/sim-explore.json';
const SHOTS = process.env.SHOTS || null;

const FEATURES = ['N3 학습하기', '기출 단어', '단어', '문법', '한자', '문장', '듣기', '여행 일본어', '영상', '완전기초', '독일어'];

const DEVICES = [
  { id: 'phone-s', w: 360, h: 640, touch: true },
  { id: 'phone', w: 390, h: 844, touch: true },
  { id: 'phone-l', w: 430, h: 932, touch: true },
  { id: 'tablet', w: 768, h: 1024, touch: true },
  { id: 'desktop', w: 1280, h: 800, touch: false },
];
const STYLES = [
  { id: 'diligent', acc: 0.85, cards: 6, tour: 8, acts: 5 },
  { id: 'average', acc: 0.6, cards: 6, tour: 6, acts: 4 },
  { id: 'guesser', acc: 0.3, cards: 5, tour: 5, acts: 4 },
  { id: 'impatient', acc: 0.5, cards: 3, tour: 3, acts: 2 },
  { id: 'explorer', acc: 0.6, cards: 4, tour: 99, acts: 4 },
];
const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
function persona(i) {
  const r = rng(i + 7);
  const dev = DEVICES[i % DEVICES.length];
  const style = STYLES[Math.floor(i / DEVICES.length) % STYLES.length];
  const kana = r() < 0.5; const purpose = Math.floor(r() * 3); const amount = Math.floor(r() * 3);
  return { id: i + 1, dev, style, kana, purpose, amount, keyboard: !dev.touch, r: rng(i * 31 + 5) };
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

const DANGER = /삭제|초기화|로그아웃|지우기|비우기|전체 삭제|탈퇴|복원|백업|내보내기|가져오기/;

async function run(browser, p) {
  const rep = { id: p.id, device: p.dev.id, style: p.style.id, features: [], issues: [], metrics: {} };
  const ctx = await browser.newContext({ viewport: { width: p.dev.w, height: p.dev.h }, hasTouch: p.dev.touch, isMobile: p.dev.touch && p.dev.w < 600 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  let cur = 'boot';
  const issue = (kind, where, detail) => { rep.issues.push({ kind, where, detail: String(detail).slice(0, kind === "stuck" ? 900 : 240) }); };
  page.on('pageerror', (e) => issue('pageerror', cur, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource|net::ERR/i.test(m.text())) issue('console', cur, m.text()); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/e${p.id}-${name}.png` }).catch(() => {}); };

  const audit = async (where) => {
    const a = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const small = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 30 || r.width < 30; })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).toString().trim().slice(0, 24));
      const nameless = [...document.querySelectorAll('button')].filter(vis).filter((el) => !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')).map((el) => el.className.toString().slice(0, 30));
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...new Set(small)].slice(0, 6), nameless: [...new Set(nameless)].slice(0, 4), boundary: /화면을 불러오지 못했어요/.test(document.body.innerText), len: document.body.innerText.trim().length };
    });
    if (a.over > 2) issue('overflow', where, `가로로 ${a.over}px 넘침`);
    if (a.small.length) issue('small-tap', where, a.small.join(' · '));
    if (a.nameless.length) issue('no-label', where, a.nameless.join(' · '));
    if (a.boundary) issue('load-fail', where, '「화면을 불러오지 못했어요」');
    return a;
  };

  /* ── 앞 이야기: 1차와 같은 사람 — 온보딩을 하고 오늘 카드를 몇 장 넘겼다 ── */
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('jp_manabu_signed_in_v1', '1'));
    await waitCached(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    const off = page.locator('.gate-offline');
    await off.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
    await page.locator('.onboarding, .tabbar').first().waitFor({ timeout: 20000 });
    const slides = await page.locator('.ob-slide').count();
    for (let k = 0; k < slides + 1; k++) {
      if (!(await page.locator('.onboarding:not(.done)').count())) break;
      const idx = k === 0 ? p.purpose : k === 1 ? (p.kana ? 0 : 1) : k === 2 ? p.amount : 0;
      const c = page.locator('.ob-slide.active .ob-choice');
      if (await c.count()) await c.nth(Math.min(idx, (await c.count()) - 1)).click();
      const next = page.locator('.ob-next');
      if (!(await next.count()) || (await next.isDisabled().catch(() => false))) break;
      await next.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(450);
    }
    await page.locator('.tabbar').waitFor({ timeout: 8000 });
    // 오늘 학습 카드 몇 장
    cur = 'today-study';
    const cta = page.locator('.bigcta');
    if (await cta.count()) {
      await cta.click(); await page.waitForTimeout(900);
      const intro = page.locator('.study.intro .bigstart'); if (await intro.count()) { await intro.click(); await page.waitForTimeout(700); }
      for (let i = 0; i < p.style.cards; i++) {
        const card = page.locator('.studycard').first();
        if (!(await card.count())) break;
        await card.click().catch(() => {}); await page.waitForTimeout(200);
        const know = p.r() < p.style.acc;
        const btn = page.locator(know ? '.judge.known' : '.judge.unknown').first();
        if (!(await btn.count())) break;
        await btn.click().catch(() => {}); await page.waitForTimeout(300);
      }
      const doneBtn = page.locator('.finish .submit-btn, .finish .bigstart').first();
      if (await doneBtn.count()) await doneBtn.click().catch(() => {}); else await page.locator('.sh-close, .sub-back, .si-back').first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch (e) { issue('stuck', 'prelude', e.message.split('\n')[0]); }
  const reviewKeys = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length).catch(() => 0);
  rep.metrics.reviewBefore = await reviewKeys();

  /* ── 학습 탭 체험 ── */
  const start = p.id % FEATURES.length;
  const order = Array.from({ length: FEATURES.length }, (_, k) => FEATURES[(start + k) % FEATURES.length]);
  const todo = order.slice(0, Math.min(order.length, p.style.tour));

  for (const name of todo) {
    cur = name;
    const f = { name, ok: false, ms: 0, acts: 0, answered: 0, flipped: 0, spoke: 0, empty: false, len: 0, deadEnd: false, notes: [] };
    const t0 = Date.now();
    try {
      await openMenu(page, name);
      await page.waitForTimeout(600);
      f.ms = Date.now() - t0;
      const a = await audit(`open:${name}`);
      f.len = a.len;
      if (a.len < 80) { f.empty = true; issue('empty', `open:${name}`, `화면 글자가 ${a.len}자뿐`); }
      if (a.boundary) throw new Error('불러오기 실패');
      await shot(`f-${name.replace(/\s/g, '')}`);

      /* 눌러 보기 */
      for (let k = 0; k < p.style.acts; k++) {
        const q = page.locator('.qoptions .qopt:not([disabled]), .n3-opts .qopt:not([disabled])');
        const card = page.locator('.studycard');
        let did = false;
        if (await q.count()) {
          await q.nth(Math.floor(p.r() * (await q.count()))).click().catch(() => {});
          f.answered += 1; did = true; await page.waitForTimeout(500);
          const nx = page.locator('.qnext .submit-btn, .swl-next, .n3-next, .cmp-next, .st-next').first();
          if (await nx.count()) await nx.click().catch(() => {});
        } else if (await card.count()) {
          await card.first().click().catch(() => {}); f.flipped += 1; did = true; await page.waitForTimeout(250);
          const j = page.locator('.judge.known, .judge.vague, .judge.unknown');
          if (await j.count()) await j.nth(Math.floor(p.r() * (await j.count()))).click().catch(() => {});
        } else {
          /* 열린 화면 안의 보이는 버튼 아무거나(뒤로·위험한 것 제외) — 화면마다 클래스가 달라서 이게 제일 사람 같다 */
          const cand = page.locator('.subscreen.open button:visible, .screen.active button:visible').filter({ hasNotText: DANGER });
          const n = await cand.count();
          if (n) {
            const idxs = [];
            for (let q2 = 0; q2 < Math.min(n, 40); q2++) idxs.push(q2);
            const usable = [];
            for (const q2 of idxs) {
              const el = cand.nth(q2);
              const cls = (await el.getAttribute('class').catch(() => '')) || '';
              const lab = ((await el.getAttribute('aria-label').catch(() => '')) || '') + ((await el.innerText().catch(() => '')) || '');
              if (/sub-back|sh-close|inner-back|moreback|si-back|tab\b|뒤로|그만두기/.test(cls + lab)) continue;
              usable.push(q2);
            }
            if (usable.length) { await cand.nth(usable[Math.floor(p.r() * usable.length)]).click({ timeout: 2500 }).catch(() => {}); did = true; }
          }
        }
        if (did) f.acts += 1;
        await page.waitForTimeout(400);
        const bad = await page.locator('body').innerText();
        if (/화면을 불러오지 못했어요/.test(bad)) { issue('load-fail', `act:${name}`, `${name} 안에서 불러오기 실패`); break; }
        if (k === 0) await audit(`act:${name}`);
        const spk = page.locator('.spk:visible, .qc-speak:visible, .sc-speak:visible').first();
        if (!f.spoke && (await spk.count())) { await spk.click({ timeout: 1500 }).catch(() => {}); f.spoke += 1; }
      }
      f.ok = true;
    } catch (e) {
      f.notes.push(String(e.message).split('\n')[0].slice(0, 120));
      issue('stuck', `feature:${name}`, e.message.split('\n').filter((l) => /locator|waiting|intercept|resolved|element|action|visible|enabled|stable|scroll/.test(l)).slice(0, 10).join(' / ').replace(/\u001b\[[0-9;]*m/g, ''));
      await shot(`stuck-${name.replace(/\s/g, '')}`);
    }
    /* 되돌아오기 — 막다른 길인지 */
    try {
      /* 「화면을 탭하면 닫혀요」 같은 전체 화면 덮개는 아무 데나 누르면 닫힌다 — 사람도 그렇게 한다 */
      for (let k = 0; k < 3; k++) {
        if (/탭하면 닫혀요|눌러서 닫기/.test(await page.locator('body').innerText().catch(() => ''))) { await page.mouse.click(p.dev.w / 2, p.dev.h / 2); await page.waitForTimeout(400); }
      }
      for (let k = 0; k < 6; k++) {
        const b = page.locator('.sh-close:visible, .subscreen.open .sub-back:visible, .study .si-back:visible, .moreback:visible, .inner-back:visible, .sub-back:visible').first();
        if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(350); }
      }
      await page.locator('.tabbar .tab[data-tab="study"]').click({ timeout: 3000 });
      await page.waitForTimeout(400);
      if (!(await page.locator('.menutile').count())) { f.deadEnd = true; issue('dead-end', name, '뒤로 가도 학습 탭으로 돌아오지 못한다'); }
    } catch (e) { f.deadEnd = true; issue('dead-end', name, '탭으로 돌아오지 못한다'); }
    rep.features.push(f);
  }
  cur = 'end';
  rep.metrics.reviewAfter = await reviewKeys();
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
  const save = () => { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, n: N, features: FEATURES, results: [...results].sort((a, b) => a.id - b.id) }, null, 1)); };
  let next = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (next < todo.length) {
      const p = todo[next++];
      try { results.push(await run(browser, p)); }
      catch (e) { results.push({ id: p.id, device: p.dev.id, style: p.style.id, features: [], issues: [{ kind: 'crash', where: 'sim', detail: String(e.message).slice(0, 200) }], metrics: {} }); }
      save();
      console.log(`  ${results.length}/${N} 끝 — #${p.id} ${p.dev.id}/${p.style.id}  ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }));
  await browser.close();
  save();
  console.log(`\n저장: ${OUT}`);
})();
