/* 콘텐츠 보안 정책(CSP) — 배포 빌드에 들어갔고, 앱의 주요 화면이 정책 위반 없이 돈다 (보안 감사 추가 B)
 *   · index.html에 CSP meta가 있다(script-src 'self')
 *   · 오늘 · 학습 · 회독 · 단어 시험 · 쭉 퀴즈 · 문법 활용 · 영상 · 내 학습 · 설정을 돌아도 위반(securitypolicyviolation) 0건
 *   · 인라인 스크립트는 실제로 막힌다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, openMore } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { todayKey, addDays } from '../../src/lib/review.js';
import { allFacets } from './_seed.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const st = allFacets({ lastSeen: addDays(today, -9), seenAt: 1, level: 2, box: 3, rounds: 3, streak: 1, wrongCount: 0, vagueCount: 0, due: addDays(today, -1) });
const REVIEW = Object.fromEntries(ALL_WORDS.filter((w) => !w.grammar && w.level === 'N5').slice(0, 120).map((w) => [w.id, st]));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.addInitScript(([r, d]) => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    if (localStorage.getItem('qa_seeded')) return;
    localStorage.setItem('qa_seeded', '1');
    localStorage.setItem('jp_manabu_guest_v1', '1');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, levels: ['N5'], goalsV: 4 }));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
    localStorage.setItem('jp_manabu_progress_v1', JSON.stringify({ quests: { day: d, sentenceSkip: true } }));
  }, [REVIEW, today]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const consoleCsp = []; page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) consoleCsp.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);

  console.log('\n[ CSP가 들어 있다 ]');
  const meta = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  ok('★ index.html에 CSP — 스크립트는 이 앱 파일만 ★', meta.includes("script-src 'self'") && meta.includes("object-src 'none'") && !meta.includes('unsafe-eval'), meta.slice(0, 80));
  const inlineRan = await page.evaluate(() => new Promise((res) => {
    window.__inline = false;
    const s = document.createElement('script'); s.textContent = 'window.__inline = true';
    document.head.appendChild(s);
    setTimeout(() => res(window.__inline), 100);
  }));
  ok('★ 끼워 넣은 인라인 스크립트는 실행되지 않는다 ★', inlineRan === false);
  await page.evaluate(() => { window.__csp = []; });
  consoleCsp.length = 0;   // 방금 위반은 일부러 낸 것

  console.log('\n[ 주요 화면을 돌아도 위반 0건 ]');
  const seen = [];
  const visit = async (label, fn) => {
    /* 화면마다 처음부터 — 앞 화면(풀던 시험)이 다시 열리지 않게 지운다 */
    seen.push(...await page.evaluate(() => window.__csp));
    await page.evaluate(() => { localStorage.removeItem('jp_nav_v1'); localStorage.removeItem('jp_quiz_keep_v1'); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);
    try { await fn(); ok(`${label} 화면 열림`, true); } catch (e) { ok(`${label} 화면 열림`, false, e.message.split('\n')[0]); }
    await page.waitForTimeout(700);
  };
  await visit('회독', async () => {
    await goTab(page, '오늘');
    await page.locator('.bigcta').first().click(); await page.waitForTimeout(900);
    if (await page.locator('.study.intro').count()) await page.locator('.study .bigstart').first().click();
    await page.locator('.studycard').waitFor({ timeout: 10000 });
    await page.locator('.studycard').click();
  });
  await visit('단어 시험', async () => {
    await openMenu(page, '단어 시험');
    const start = page.locator('button', { hasText: '시험 시작' }).first();
    if (await start.count()) await start.click();
    await page.locator('.qoptions .qopt').first().click({ timeout: 10000 });
  });
  await visit('문법 활용', async () => {
    await openMenu(page, '문법');
    await page.locator('.gm-tabs [data-tab="use"]').click();
  });
  await visit('영상', async () => { await openMenu(page, '영상'); });
  await visit('내 학습', async () => { await goTab(page, '내 학습'); });
  await visit('설정', async () => { await openMore(page, 'study'); await openMore(page, 'voice'); });
  const v = [...seen, ...await page.evaluate(() => window.__csp)];
  ok('★ CSP 위반 0건 ★', v.length === 0 && consoleCsp.length === 0, [...v, ...consoleCsp].slice(0, 3).join(' | '));
  ok('JS 오류 없음', errors.length === 0, errors[0]);

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
