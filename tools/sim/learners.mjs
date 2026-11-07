/* 학습자 시뮬레이터 — 여러 기기에서 하루 흐름을 돌려 버그와 사용성을 찾는다.
 *
 *   node tools/sim/learners.mjs [사람 수] [동시에 돌릴 수]
 *   APP_URL=…  OUT=/경로/learners.json  ONLY=3,7  RESUME=1
 *
 * 사람은 아니고, 기기 12종 × 학습 습관 5종 × 학습 규모 4종을 섞은 자동 학습자다. 각자 저장 상태를 심어 놓고(처음 쓰는 사람부터
 * 몇 주 쓴 사람까지) 오늘 화면 → 오늘의 학습 한 판 → 약점 퀴즈 → 쭉 퀴즈 → 랜덤 테스트 → 곤에게 물어보기 → 설정을 눈으로 훑듯이 돈다.
 *
 * 「정상」은 기록하지 않는다. 남기는 것은 이상한 것뿐이다:
 *   stuck 눌러야 할 것이 안 눌린다 · pageerror/console 오류 · overflow 가로로 넘친다 · small-tap 누를 자리가 작다 ·
 *   fab-overlap 곤 단추가 눌러야 할 것을 가린다 · offscreen 핵심 버튼이 화면 밖에 있다 · covered 다른 것이 버튼을 덮는다 ·
 *   load-fail · blank 빈 화면 · slow 오래 걸린다 · flow 다음 단계 연결이 끊겼다 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8940/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const N = Number(process.argv[2] || 500);
const PAR = Number(process.argv[3] || 4);
const OUT = process.env.OUT || '/tmp/sim-learners.json';
const today = todayKey();

const DEVICES = [
  { id: 'iphone-se', w: 375, h: 667, touch: true },
  { id: 'iphone-14', w: 390, h: 844, touch: true },
  { id: 'iphone-pro-max', w: 430, h: 932, touch: true },
  { id: 'pixel-7', w: 412, h: 915, touch: true },
  { id: 'galaxy-s8', w: 360, h: 740, touch: true },
  { id: 'galaxy-fold-cover', w: 280, h: 653, touch: true },
  { id: 'phone-landscape', w: 844, h: 390, touch: true },
  { id: 'ipad-mini', w: 768, h: 1024, touch: true },
  { id: 'ipad-landscape', w: 1024, h: 768, touch: true },
  { id: 'laptop-1366', w: 1366, h: 768, touch: false },
  { id: 'desktop-1920', w: 1920, h: 1080, touch: false },
  { id: 'window-800', w: 800, h: 600, touch: false },
];
const STYLES = [
  { id: 'diligent', acc: 0.9, cards: 14, quiz: 6, dunno: 0.05 },
  { id: 'average', acc: 0.7, cards: 8, quiz: 5, dunno: 0.15 },
  { id: 'guesser', acc: 0.3, cards: 6, quiz: 6, dunno: 0.1 },
  { id: 'impatient', acc: 0.6, cards: 3, quiz: 3, dunno: 0.3 },
  { id: 'explorer', acc: 0.7, cards: 5, quiz: 4, dunno: 0.2 },
];
const TIERS = [
  { id: 'new', words: 0, due: 0, weak: 0, goal: 'N5' },
  { id: 'starter', words: 60, due: 20, weak: 6, goal: 'N5' },
  { id: 'mid', words: 300, due: 120, weak: 25, goal: 'N4' },
  { id: 'adv', words: 1200, due: 400, weak: 60, goal: 'N3' },
];
const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
function persona(i) {
  const r = rng(i + 101);
  return {
    id: i + 1,
    dev: DEVICES[i % DEVICES.length],
    style: STYLES[Math.floor(i / DEVICES.length) % STYLES.length],
    tier: TIERS[Math.floor(r() * TIERS.length)],
    light: r() < 0.3,
    r: rng(i * 17 + 3),
    seedR: rng(i * 53 + 11),
  };
}

function seedOf(p) {
  const r = p.seedR; const review = {};
  const list = ALL_WORDS.filter((w) => ['N5', 'N4', 'N3'].includes(w.level));
  const n = Math.min(list.length, p.tier.words);
  for (let k = 0; k < n; k++) {
    const w = list[k];
    if (k < p.tier.weak) {
      let st; for (let q = 0; q < 3; q++) st = applyVerdict(st, VERDICT.UNKNOWN, addDays(today, -(6 - q * 2)));
      review[w.id] = st;
    } else if (k < p.tier.weak + p.tier.due) {
      review[w.id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -(8 + Math.floor(r() * 20)))), due: addDays(today, -Math.floor(r() * 5)) };
    } else {
      review[w.id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -(2 + Math.floor(r() * 20)))), due: addDays(today, 1 + Math.floor(r() * 30)) };
    }
  }
  return review;
}

async function run(browser, p) {
  const rep = { id: p.id, device: p.dev.id, style: p.style.id, tier: p.tier.id, steps: [], issues: [], metrics: {} };
  const ctx = await browser.newContext({
    viewport: { width: p.dev.w, height: p.dev.h },
    hasTouch: p.dev.touch,
    isMobile: p.dev.touch && Math.min(p.dev.w, p.dev.h) < 600,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  let cur = 'boot';
  const issue = (kind, where, detail) => rep.issues.push({ kind, where, detail: String(detail).slice(0, 220) });
  page.on('pageerror', (e) => issue('pageerror', cur, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource|net::ERR|generativelanguage/i.test(m.text())) issue('console', cur, m.text()); });
  const step = async (name, fn) => {
    cur = name; const t0 = Date.now();
    try { await fn(); rep.steps.push({ name, ok: true, ms: Date.now() - t0 }); } catch (e) {
      const why = String(e.message).split('\n').filter((l) => /locator|waiting|intercept|resolved|visible|enabled|Timeout/.test(l)).slice(0, 4).join(' / ').replace(/\u001b\[[0-9;]*m/g, '');
      rep.steps.push({ name, ok: false, ms: Date.now() - t0 });
      issue('stuck', name, why || e.message);
    }
  };
  const kb = !p.dev.touch;

  /* 화면 하나를 살핀다 — 이상한 것만 적는다 */
  const audit = async (where, { primary = [] } = {}) => {
    const a = await page.evaluate((primarySel) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || '').toString().replace(/\s+/g, ' ').trim().slice(0, 20);
      /* 눈에 보이는 크기가 작아도 ::after로 44px 누르는 자리를 준 것(소리 단추 · 접기)은 작은 단추로 세지 않는다 */
      const widened = (el) => { try { const a = getComputedStyle(el, '::after'); return a.content !== 'none' && a.position === 'absolute' && parseFloat(a.top) <= -4; } catch { return false; } };
      const small = [...document.querySelectorAll('button, [role="button"], a[href]')].filter(vis).filter((el) => {
        const r = el.getBoundingClientRect(); return (r.height < 36 || r.width < 36) && !widened(el);
      }).map((el) => { const r = el.getBoundingClientRect(); return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
      const fab = document.querySelector('.gonfab');
      let fabHit = [];
      /* 질문 창이 위에 올라와 단추를 덮고 있으면 눈에 안 보이는 것이다 — 겹침으로 세지 않는다 */
      const fr0 = fab ? fab.getBoundingClientRect() : null;
      const fabTop = fr0 ? document.elementFromPoint(fr0.x + fr0.width / 2, fr0.y + fr0.height / 2) : null;
      if (fab && vis(fab) && (fabTop === fab || fab.contains(fabTop))) {
        const f = fab.getBoundingClientRect();
        fabHit = [...document.querySelectorAll('.qopt, .judge, .judgerow button, .submit-btn, .ghost-btn, .st-opt, input, textarea, .studycard, .tdq-row, .bigcta, .tab')]
          .filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return !(f.right <= r.left + 2 || r.right <= f.left + 2 || f.bottom <= r.top + 2 || r.bottom <= f.top + 2); })
          .map(label);
      }
      const prim = primarySel.map((sel) => {
        const el = document.querySelector(sel); if (!el || !vis(el)) return null;
        const r = el.getBoundingClientRect();
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1); const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
        const top = document.elementFromPoint(cx, cy);
        const inView = r.top >= 0 && r.bottom <= innerHeight + 1;
        return { sel, below: r.bottom > innerHeight + 1, covered: inView && top && !(top === el || el.contains(top) || top.contains(el)) ? label(top) : null };
      }).filter(Boolean);
      return {
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...new Set(small)].slice(0, 5), fabHit: [...new Set(fabHit)].slice(0, 4), prim,
        failed: /화면을 불러오지 못했어요/.test(document.body.innerText), blank: document.body.innerText.trim().length < 5,
      };
    }, primary).catch(() => ({ over: 0, small: [], fabHit: [], prim: [], failed: false, blank: false }));
    if (a.over > 2) issue('overflow', where, `가로로 ${a.over}px 넘침`);
    if (a.small.length) issue('small-tap', where, a.small.join(' · '));
    if (a.fabHit.length) issue('fab-overlap', where, `곤 단추가 가림: ${a.fabHit.join(' · ')}`);
    for (const x of a.prim) {
      if (x.below) issue('offscreen', where, `${x.sel} 가 화면 아래로 벗어남`);
      if (x.covered) issue('covered', where, `${x.sel} 위를 「${x.covered}」가 덮음`);
    }
    if (a.failed) issue('load-fail', where, '「화면을 불러오지 못했어요」');
    if (a.blank) issue('blank', where, '화면이 비었다');
  };
  const back = async () => {
    for (let k = 0; k < 4; k++) {
      if (await page.locator('.sheet.open').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
      const b = page.locator('.sh-close:visible, .subscreen.open .sub-back:visible, .study .si-back:visible, .sub-back:visible').first();
      if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); } else break;
    }
  };
  const home = async () => { await back(); await page.locator('.tabbar .tab[data-tab="home"]').click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(500); };

  /* 퀴즈 한 판을 몇 문제 푼다 — 고르기 · 직접 쓰기 · 잘 모르겠어요를 섞는다 */
  const quiz = async (rounds, where, sel) => {
    for (let k = 0; k < rounds; k++) {
      const dunno = page.locator(sel.dunno);
      const opts = page.locator(sel.opt);
      if (await dunno.count() && p.r() < p.style.dunno) { await dunno.first().click({ timeout: 2000 }).catch(() => {}); }
      else if (await opts.count()) {
        const n = await opts.count();
        const pick = p.r() < p.style.acc ? 0 : Math.floor(p.r() * n); // 0번은 정답일 수도 아닐 수도 — 무작위에 가깝게
        await opts.nth(pick % n).click({ timeout: 2000 }).catch(() => {});
      } else if (await page.locator(sel.input).count()) {
        await page.locator(sel.input).first().fill('ㅋㅋ').catch(() => {});
        await page.locator(sel.submit).first().click({ timeout: 2000 }).catch(() => {});
      } else break;
      await page.waitForTimeout(350);
      if (k === 0) await audit(where + '(답한 뒤)', { primary: [sel.next] });
      const nx = page.locator(sel.next);
      if (await nx.count()) await nx.first().click({ timeout: 2000 }).catch(() => {}); else await page.waitForTimeout(900);
      await page.waitForTimeout(200);
    }
  };

  /* ── 0 부팅 ── */
  await step('boot', async () => {
    const review = seedOf(p);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ review, patch }) => {
      localStorage.setItem('jp_manabu_guest_v1', '1');
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
      localStorage.setItem('jp_optrev_open', '0');
      const s = { onboarded: true, canReadKana: true, autoTTS: false, ...patch };
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    }, { review, patch: { goalLevel: p.tier.goal, ...(p.light ? { goals: { fresh: 5, review: 6, weak: 2 }, goalsV: 3 } : {}) } });
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 25000 });
    rep.metrics.bootMs = Date.now() - t0;
    if (rep.metrics.bootMs > 9000) issue('slow', 'boot', `오늘 화면까지 ${Math.round(rep.metrics.bootMs / 1000)}초`);
  });

  /* ── 1 오늘 화면 ── */
  await step('today', async () => {
    await page.locator('.tabbar .tab[data-tab="home"]').click(); await page.waitForTimeout(900);
    rep.metrics.rows = await page.locator('.tdq-row').count();
    await audit('today', { primary: ['.bigcta'] });
    if (p.tier.words > 30 && !rep.metrics.rows) issue('flow', 'today', '기록이 있는데 오늘 퀘스트가 한 줄도 없다');
  });

  /* ── 2 오늘의 학습 한 판 ── */
  await step('deck', async () => {
    const cta = page.locator('.bigcta').first();
    if (!(await cta.count())) return;
    await cta.click(); await page.waitForTimeout(1100);
    const intro = page.locator('.study.intro .bigstart');
    if (await intro.count()) { await audit('회독 소개', { primary: ['.study.intro .bigstart'] }); await intro.click(); await page.waitForTimeout(700); }
    if (!(await page.locator('.study').count())) { issue('flow', 'deck', '오늘의 학습을 눌렀는데 회독 화면이 안 열린다'); return; }
    await audit('회독', { primary: ['.studycard'] });
    let audited = false;
    for (let k = 0; k < p.style.cards; k++) {
      if (!(await page.locator('.studycard').count())) break;
      if (kb && p.r() < 0.5) { await page.keyboard.press('Space'); await page.waitForTimeout(150); } else await page.locator('.studycard').click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(200);
      const verdict = p.r() < p.style.acc ? '알아요' : (p.r() < 0.5 ? '애매해요' : '몰라요');
      const jb = page.locator('.judgerow button', { hasText: verdict }).first();
      if (!(await jb.count())) break;
      if (!audited) { audited = true; await audit('회독(판정 단추)', { primary: ['.judgerow button'] }); }
      await jb.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
    /* 곤에게 물어보기 — 학습 중에도 떠 있어야 하고, 치는 글이 끊기면 안 된다 */
    if (await page.locator('.gonfab').count() === 0 && await page.locator('.study').count()) issue('flow', '회독', '학습 중 곤 단추가 없다');
    else if (await page.locator('.gonfab').count()) {
      await page.locator('.gonfab').click({ timeout: 2500 }).catch(() => issue('stuck', '회독 곤 단추', '눌리지 않는다'));
      await page.waitForTimeout(700);
      const ta = page.locator('.sheet.open .asksheet textarea');
      if (await ta.count()) {
        await ta.click().catch(() => {});
        await ta.pressSequentially('ここをきいてみる', { delay: 60 }).catch(() => {});
        if ((await ta.inputValue().catch(() => '')) !== 'ここをきいてみる') issue('stuck', '곤에게 묻기', '치던 글이 끊겼다');
        await audit('곤 질문 창');
      } else issue('stuck', '곤 단추', '질문 창이 안 열린다');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    }
    await back();
    await page.waitForTimeout(500);
    if (!(await page.locator('.tabbar').count())) issue('flow', 'deck', '학습에서 나왔는데 탭바가 없다');
  });

  /* ── 3 약점 퀴즈 ── */
  await step('weakquiz', async () => {
    await home();
    const row = page.locator('.tdq-row', { hasText: '약점 퀴즈' }).first();
    if (!(await row.count())) { if (p.tier.weak > 3) issue('flow', 'weakquiz', '약한 낱말이 있는데 약점 퀴즈 줄이 없다'); return; }
    await row.click(); await page.waitForTimeout(1000);
    const st = page.locator('button', { hasText: '시험 시작' }).first();
    if (await st.count()) { await st.click(); await page.waitForTimeout(800); }
    if (!(await page.locator('.qoptions, .qtyping').count())) { issue('flow', 'weakquiz', '약점 퀴즈가 안 열린다'); return; }
    await audit('약점 퀴즈', { primary: ['.qz-dunno'] });
    await quiz(p.style.quiz, '약점 퀴즈', { opt: '.qopt:not([disabled])', dunno: '.qz-dunno', input: '.qtyping input', submit: '.qtyping .submit-btn', next: '.qnext .submit-btn' });
  });

  /* ── 4 쭉 퀴즈 ── */
  await step('stream', async () => {
    await home();
    const row = page.locator('.tdq-row', { hasText: '쭉 퀴즈' }).first();
    if (!(await row.count())) return;
    await row.click(); await page.waitForTimeout(1000);
    if (await page.locator('.st-start').count()) {
      if (await page.locator('.st-start:disabled').count()) return;      // 외운 게 모자란 사람은 못 연다 — 정상
      await page.locator('.st-start').click(); await page.waitForTimeout(700);
    }
    if (!(await page.locator('.st-run').count())) return;
    const head = (await page.locator('.st-score').innerText().catch(() => '')).replace(/\s+/g, '');
    if (!/^\d+\/\d+$|^\d+번째$/.test(head)) issue('usability', '쭉 퀴즈', `머리 줄이 진행 현황이 아니다: ${head}`);
    await audit('쭉 퀴즈', { primary: ['.st-dunno', '.st-stop'] });
    await quiz(p.style.quiz, '쭉 퀴즈', { opt: '.st-opt:not([disabled])', dunno: '.st-dunno', input: '.st-input', submit: '.st-submit', next: '.st-next' });
  });

  /* ── 5 랜덤 테스트 ── */
  await step('random', async () => {
    await home();
    const row = page.locator('.tdq-row', { hasText: '오늘 랜덤 테스트' }).first();
    if (!(await row.count())) return;
    await row.click(); await page.waitForTimeout(1000);
    if (!(await page.locator('.qoptions, .qtyping').count())) { issue('flow', 'random', '랜덤 테스트가 안 열린다'); return; }
    await audit('랜덤 테스트', { primary: ['.qz-dunno'] });
    await quiz(Math.min(p.style.quiz, 4), '랜덤 테스트', { opt: '.qopt:not([disabled])', dunno: '.qz-dunno', input: '.qtyping input', submit: '.qtyping .submit-btn', next: '.qnext .submit-btn' });
  });

  /* ── 6 단어 시험 · 짝 맞추기 · 문장 만들기 · 설정 ── */
  await step('tour', async () => {
    for (const tab of ['학습', '내 학습', '설정']) {
      await home();
      const t = page.locator('.tabbar .tab', { hasText: tab }).first();
      if (!(await t.count())) continue;
      await t.click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(700);
      await audit(`탭 ${tab}`);
    }
  });

  rep.metrics.issues = rep.issues.length;
  await ctx.close();
  return rep;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
  let results = [];
  if (process.env.RESUME && existsSync(OUT)) { try { results = JSON.parse(readFileSync(OUT, 'utf8')); } catch { results = []; } }
  const done = new Set(results.map((r) => r.id));
  const todo = Array.from({ length: N }, (_, i) => persona(i)).filter((p) => (!only || only.has(p.id)) && !done.has(p.id));
  let next = 0; let finished = 0;
  const worker = async () => {
    while (next < todo.length) {
      const p = todo[next++];
      let rep;
      try { rep = await Promise.race([run(browser, p), new Promise((_, rej) => setTimeout(() => rej(new Error('학습자 한 명이 3분을 넘김')), 180000))]); } catch (e) {
        rep = { id: p.id, device: p.dev.id, style: p.style.id, tier: p.tier.id, steps: [], metrics: {}, issues: [{ kind: 'stuck', where: 'run', detail: String(e.message).slice(0, 200) }] };
      }
      results.push(rep); finished += 1;
      if (finished % 10 === 0) { writeFileSync(OUT, JSON.stringify(results)); console.log(`${finished}/${todo.length} 완료 · 이상 ${results.reduce((n, r) => n + r.issues.length, 0)}건`); }
    }
  };
  await Promise.all(Array.from({ length: PAR }, worker));
  writeFileSync(OUT, JSON.stringify(results));
  await browser.close();
  console.log(`끝: ${results.length}명 · 이상 ${results.reduce((n, r) => n + r.issues.length, 0)}건 → ${OUT}`);
})();
