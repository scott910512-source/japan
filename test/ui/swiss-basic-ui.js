/* 독일어 기초 단어 갈래 — 진짜 화면에서.
 *
 *   · 같은 독일어 메뉴 안에 「처음 시작 — 기초 단어」가 맨 위에, 「여행 회화」가 그 아래에
 *   · 처음엔 기초 첫 레슨이 열려 있고 큰 버튼이 거기를 가리킨다. 여행 회화 첫 레슨도 막히지 않는다
 *   · 기초 레슨을 끝까지 풀면 진도가 저장되고 기초 둘째 레슨만 열린다(여행은 그대로 잠금)
 *   · 색깔 레슨: 뜻을 보고 고르는 문제에는 색 칸이, 소리만 듣는 문제에는 그림이 없다(정답이 안 드러난다)
 *   · 직접 쓰기: 관사를 빼고 쓰면 「거의 맞았어요 — 관사까지」, 맞게 쳐 준다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { SWISS_ITEMS, tokensOf } from '../../src/data/swiss.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const BY = new Map(SWISS_ITEMS.map((i) => [i.id, i]));
const today = todayKey();

async function boot(browser, swiss) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((sw) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (sw) localStorage.setItem('jp_manabu_swiss_v1', JSON.stringify(sw)); else localStorage.removeItem('jp_manabu_swiss_v1');
  }, swiss);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error(`앱이 안 열렸어요 — 화면: ${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}`);
  return page;
}
const swissOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || 'null'));

/* 문제 하나를 맞게 푼다. 풀기 전에 그림·색 칸이 있는지도 적어 둔다 */
async function solveOne(page, log) {
  if (await page.locator('.swl-match').count()) {
    const ids = await page.locator('.swl-mleft').evaluateAll((els) => els.map((e) => e.dataset.id));
    for (const id of ids) {
      await page.locator(`.swl-mleft[data-id="${id}"]`).click();
      await page.locator(`.swl-mright[data-id="${id}"]`).click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1000);
    return;
  }
  const prompt = page.locator('.swl-prompt');
  const id = await prompt.getAttribute('data-item');
  const type = await prompt.getAttribute('data-type');
  const item = BY.get(id);
  log.push({ type, pic: await page.locator('.swl-prompt .swl-pic').count(), id });
  if (type === 'build') {
    for (const t of tokensOf(item)) {
      await page.locator('.swl-bank .swl-tok:not([disabled])').filter({ hasText: new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click();
    }
  } else {
    await page.locator(`.qopt[data-id="${id}"]`).click();
  }
  await page.locator('.swl-check').click();
  await page.waitForTimeout(150);
  await page.locator('.swl-next').click();
  await page.waitForTimeout(150);
}

async function playLesson(page, log) {
  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('.swl-finish').count()) return true;
    if (await page.locator('.swl-prompt, .swl-match').count() === 0) { await page.waitForTimeout(250); continue; }
    await solveOne(page, log);
  }
  return Boolean(await page.locator('.swl-finish').count());
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 허브 — 갈래 둘 ]');
  const page = await boot(browser, null);
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page, '독일어');
  const order = await page.locator('.swh-track').evaluateAll((els) => els.map((e) => e.dataset.track));
  ok('★ 같은 메뉴 안에 기초 단어가 먼저, 여행 회화가 그다음 ★', order.join() === 'basic,travel', order.join());
  ok('기초 단어 제목에 「초등학생 수준」', (await page.locator('.swh-track[data-track="basic"] .swh-tlabel').innerText()).includes('초등학생'));
  ok('기초 단원이 열둘 넘게', await page.locator('.swh-track[data-track="basic"] .swh-unit').count() >= 12);
  ok('기초 첫 레슨은 열려 있다', await page.locator('.swh-lesson[data-lesson="b1l1"].open').count() === 1);
  ok('★ 여행 회화 첫 레슨도 안 막힌다 ★', await page.locator('.swh-lesson[data-lesson="u1l1"].open').count() === 1);
  ok('큰 버튼이 기초 첫 레슨을 가리킨다', (await page.locator('.swh-next').innerText()).includes('0 ~ 5'));
  ok('그림 카드: 동물 미리 보기에 이모지가 보인다', await (async () => {
    await page.locator('.swh-unit[data-unit="b4"] .swh-peek').click();
    await page.waitForTimeout(300);
    return (await page.locator('.sw-card[data-item="b-hund"] .sw-pic').innerText()).includes('🐶');
  })());
  ok('카드: 명사는 관사까지 한 덩어리로', (await page.locator('.sw-card[data-item="b-hund"] .sw-word').innerText()).trim() === 'der Hund');

  console.log('\n[ 기초 레슨 하나를 끝까지 ]');
  await page.locator('.swh-lesson[data-lesson="b1l1"]').click();
  await page.waitForTimeout(600);
  const log1 = [];
  ok('끝까지 간다', await playLesson(page, log1), `${log1.length}문제`);
  await page.locator('.swl-done').click();
  await page.waitForTimeout(500);
  const saved = await swissOf(page);
  ok('★ 진도와 기억이 저장된다 ★', saved?.lessons?.b1l1?.stars >= 1 && Object.keys(saved.mem || {}).filter((k) => k.startsWith('b-')).length === 6, JSON.stringify(Object.keys(saved?.mem || {})));
  ok('기초 둘째 레슨이 열린다', await page.locator('.swh-lesson[data-lesson="b1l2"].open').count() === 1);
  ok('여행 둘째 레슨은 아직 잠겨 있다', await page.locator('.swh-lesson[data-lesson="u1l2"].locked').count() === 1);
  ok('큰 버튼이 이어서 기초 둘째 레슨', (await page.locator('.swh-next').innerText()).includes('6 ~ 10'));
  await page.close();

  console.log('\n[ 색깔 레슨 — 색 칸은 뜻을 보는 문제에만 ]');
  const pre = { lessons: {}, xp: 40, weak: [] };
  for (const id of ['b1l1', 'b1l2', 'b2l1', 'b2l2']) pre.lessons[id] = { stars: 3, last: 3, tries: 1, at: Date.now() - 3 * 86400000 };
  const p2 = await boot(browser, pre);
  p2.on('pageerror', (e) => errors.push(e.message));
  await openMenu(p2, '독일어');
  await p2.locator('.swh-lesson[data-lesson="b3l1"]').click();
  await p2.waitForTimeout(600);
  const log2 = [];
  ok('끝까지 간다', await playLesson(p2, log2), `${log2.length}문제`);
  const sw = log2.filter((l) => l.type === 'choose-sw');
  const listen = log2.filter((l) => l.type === 'listen' || l.type === 'choose-ko');
  ok('★ 뜻을 보고 고르는 문제에는 색 칸이 있다 ★', sw.length > 0 && sw.every((l) => l.pic === 1), `${sw.length}개`);
  ok('★ 듣거나 독일어를 보는 문제에는 그림이 없다(정답이 안 드러난다) ★', listen.every((l) => l.pic === 0), `${listen.length}개`);
  await p2.close();

  console.log('\n[ 직접 쓰기 — 관사를 빼도 거의 맞았어요 ]');
  const hard = { lessons: { b4l1: { stars: 3, last: 3, tries: 1, at: Date.now() - 20 * 86400000 } }, xp: 10, weak: [], mem: {} };
  for (const id of ['b-hund', 'b-katze', 'b-vogel', 'b-fisch', 'b-pferd', 'b-kuh']) {
    hard.mem[id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -15)), level: 4, due: addDays(today, -1), rounds: 5, streak: 3 };
  }
  const p3 = await boot(browser, hard);
  p3.on('pageerror', (e) => errors.push(e.message));
  await openMenu(p3, '독일어');
  await p3.locator('.swh-rstart').click();
  await p3.waitForTimeout(600);
  let sawArticle = false; let wrongNoArticle = 0;
  for (let i = 0; i < 12 && !sawArticle; i += 1) {
    if (await p3.locator('.swl-match').count() || await p3.locator('.swl-finish').count()) break;
    const prompt = p3.locator('.swl-prompt');
    const id = await prompt.getAttribute('data-item');
    const type = await prompt.getAttribute('data-type');
    if (type === 'write' || type === 'dictate') {
      const bare = BY.get(id).de.replace(/^(der|die|das) /, '');
      await p3.locator('.swl-input').fill(bare);
      await p3.locator('.swl-check').click();
      await p3.waitForTimeout(250);
      const fb = await p3.locator('.swl-feedback').getAttribute('class');
      if (!fb.includes('ok')) wrongNoArticle += 1;
      sawArticle = (await p3.locator('.swl-note').innerText().catch(() => '')).includes('관사');
      await p3.locator('.swl-next').click();
      await p3.waitForTimeout(200);
    } else {
      await solveOne(p3, []);
    }
  }
  ok('★ 관사를 빼고 쓰면 맞게 쳐 주고 「관사까지」를 알려 준다 ★', sawArticle && wrongNoArticle === 0);
  await p3.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
