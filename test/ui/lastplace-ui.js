/* 오랜만에 돌아와도 있던 자리에서 잇는다 — 진짜 화면에서.
 * 앱을 다시 띄웠을 때(저장된 자리가 6시간 안·같은 날이면) 홈이 아니라 그 탭·화면이 열린다. 낡았으면 홈이다.
 * 새로고침 대신 저장된 자리를 심고 새로 부팅한다(오프라인 새로고침은 서비스워커 사정을 타서 이 검사의 일이 아니다). */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function boot(browser, nav) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([nav, day]) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, [nav, today()]);
  /* 새로고침으로 앱이 떠날 때 지금 자리(홈)를 적어서 심어 둔 자리를 덮는다 — 그래서 문서가 새로 뜨기 직전에, 한 번만 심는다 */
  if (nav) await page.addInitScript(([nav, day]) => { if (!sessionStorage.getItem('__nav_seeded')) { sessionStorage.setItem('__nav_seeded', '1'); localStorage.setItem('jp_nav_v1', JSON.stringify({ ...nav, day: nav.day || day, at: nav.at ?? Date.now() })); } }, [nav, today()]);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  return page;
}
const activeTab = (page) => page.evaluate(() => document.querySelector('.tabbar .tab.active')?.dataset.tab || null);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 저장된 자리가 없으면 홈 ]');
  let page = await boot(browser, null);
  page.on('pageerror', (e) => errors.push(e.message));
  ok('처음 열면 홈이다', (await activeTab(page)) === 'home');
  await page.close();

  console.log('\n[ 학습 탭에 있다가 앱이 다시 뜨면 ]');
  page = await boot(browser, { tab: 'study', sub: null, parent: null });
  ok('★ 홈이 아니라 학습 탭이 열린다 ★', (await activeTab(page)) === 'study', await activeTab(page));
  await page.close();

  console.log('\n[ 단어 시험 화면에 있었으면 ]');
  page = await boot(browser, { tab: 'study', sub: 'quiz', parent: null });
  ok('★ 그 화면(단어 시험)이 열린다 ★', (await page.locator('.subscreen.open .sub-title').innerText().catch(() => '')).includes('단어 시험'));
  await page.close();

  console.log('\n[ 오래됐으면 홈 ]');
  page = await boot(browser, { tab: 'study', sub: 'quiz', parent: null, at: Date.now() - 7 * 3600 * 1000 });
  ok('★ 7시간 전 자리는 쓰지 않는다(홈) ★', (await activeTab(page)) === 'home' && await page.locator('.subscreen.open').count() === 0);
  await page.close();
  page = await boot(browser, { tab: 'study', sub: 'quiz', parent: null, day: '2020-01-01' });
  ok('★ 다른 날 자리는 쓰지 않는다(홈) ★', (await activeTab(page)) === 'home');
  await page.close();

  console.log('\n[ 쓰는 중에 적힌다 ]');
  page = await boot(browser, null);
  await goTab(page, '학습');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_nav_v1') || 'null'));
  ok('★ 학습 탭으로 가면 자리가 적힌다 ★', saved?.tab === 'study', JSON.stringify(saved)?.slice(0, 80));
  await page.close();

  console.log('\n[ 모르는 화면이 적혀 있어도 안 죽는다 ]');
  page = await boot(browser, { tab: 'study', sub: '없는화면', parent: null });
  ok('흰 화면이 아니다', (await page.locator('body').innerText()).trim().length > 20 && (await activeTab(page)) === 'study');
  await page.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
