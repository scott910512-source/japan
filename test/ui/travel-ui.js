/* 여행 일본어 코스 — 진짜 화면에서.
 *
 *   학습 탭 「콘텐츠」에 「여행 일본어」가 있고 들어가진다
 *   허브에 자료의 단원·레슨이 다 있고 전부 열려 있다(잠금 없음)
 *   레슨에 들어가면 직원 문제는 소리만(글자 없음), 내 문제는 뜻을 보고 고른다
 *   답을 알고 끝까지 풀면 별·XP가 저장소에 적히고 허브에 ★가 붙는다
 *   틀리면 뒤에 다시 나온다
 *   「자동 듣기」 버튼이 범위를 「여행 일본어」로 바꿔 듣기를 연다
 *   ★ 일본어 회독 기록은 하나도 안 건드린다 ★ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { TRAVEL_ITEMS, TRAVEL_LESSONS, TRAVEL_UNITS } from '../../src/data/travel.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const byId = new Map(TRAVEL_ITEMS.map((it) => [it.id, it]));

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.removeItem('jp_manabu_travel_v1');
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

const reviewSnapshot = (page) => page.evaluate(() => localStorage.getItem('jp_manabu_review_v1') || '');

/* 문제 하나를 푼다. 답은 자료에서 안다 — data-item이 정답 id다. wrongFirst면 일부러 틀린다 */
async function solve(page, { wrongFirst = false } = {}) {
  const prompt = page.locator('.swl-prompt');
  const id = await prompt.getAttribute('data-item');
  const type = await prompt.getAttribute('data-type');
  const opts = page.locator('.swl-opts .qopt');
  const n = await opts.count();
  let pickId = id;
  if (wrongFirst) {
    for (let i = 0; i < n; i++) {
      const oid = await opts.nth(i).getAttribute('data-id');
      if (oid !== id) { pickId = oid; break; }
    }
  }
  await page.locator(`.swl-opts .qopt[data-id="${pickId}"]`).click();
  await page.locator('.swl-check').click();
  await page.waitForTimeout(250);
  const fb = await page.locator('.swl-feedback').getAttribute('class');
  await page.locator('.swl-next').click();
  await page.waitForTimeout(250);
  return { id, type, good: (fb || '').includes('ok') };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await boot(browser);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const reviewBefore = await reviewSnapshot(page);

  console.log('\n[ 학습 탭 → 여행 일본어 ]');
  await openMenu(page, '여행 일본어');
  ok('헤더', (await page.locator('.subscreen.open .sub-title').first().innerText()).includes('여행 일본어'));
  ok('단원이 자료만큼', await page.locator('.tr-unit').count() === TRAVEL_UNITS.length, `${await page.locator('.tr-unit').count()}`);
  ok('레슨이 자료만큼', await page.locator('.swh-lesson').count() === TRAVEL_LESSONS.length);
  ok('★ 레슨이 전부 열려 있다 — 잠금 없음 ★', await page.locator('.swh-lesson:disabled').count() === 0);
  ok('처음엔 「시작하기」', (await page.locator('.tr-next').innerText()).includes('시작하기'));
  const nb = await page.locator('.tr-next').boundingBox();
  const ib = await page.locator('.tr-next svg').first().boundingBox();
  ok('★ 큰 버튼 안 아이콘이 글자 크기다 — 버튼을 채우지 않는다 ★', ib && ib.width <= 24 && ib.height <= 24 && nb.height < 70, `${Math.round(ib?.width)}px · 버튼 높이 ${Math.round(nb.height)}`);

  console.log('\n[ 문장 미리 보기 ]');
  await page.locator('.tr-unit[data-unit="hotel"] .swh-peek').click();
  await page.waitForTimeout(300);
  const lines = page.locator('.tr-unit[data-unit="hotel"] .tr-line');
  ok('호텔 단원의 줄이 펼쳐진다', await lines.count() >= 25, `${await lines.count()}`);
  ok('직원 줄과 내 줄에 표가 붙는다', await page.locator('.tr-line[data-who="staff"] .tr-who.staff').count() > 0
    && await page.locator('.tr-line[data-who="me"] .tr-who.me').count() > 0);
  ok('줄마다 소리 버튼이 손가락만큼', (await page.locator('.tr-line .tr-spk').first().boundingBox())?.height >= 43.5);

  console.log('\n[ 레슨 — 호텔 체크인부터 (차례와 상관없이) ]');
  await page.locator('.swh-lesson[data-lesson="hotel-1"]').click();
  await page.waitForTimeout(600);
  ok('레슨 화면', await page.locator('.swl-prompt').count() === 1);
  const seenTypes = new Set();
  let hearHidden = true;
  let wrongId = null;
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.swl-finish').count()) break;
    const type = await page.locator('.swl-prompt').getAttribute('data-type');
    seenTypes.add(type);
    if (type === 'hear') {
      /* 소리만 — 글자(일본어)가 화면에 없어야 한다 */
      const txt = await page.locator('.swl-prompt').innerText();
      if (/[一-鿿ぁ-ゖァ-ヺ]/.test(txt)) hearHidden = false;
    }
    const r = await solve(page, { wrongFirst: wrongId == null && i === 0 });
    if (!r.good) wrongId = r.id;
  }
  ok('듣기(hear)·말하기(say) 문제가 다 나온다', seenTypes.has('hear') && seenTypes.has('say'), [...seenTypes].join(','));
  ok('★ 듣기 문제는 글자를 안 보여 준다 ★', hearHidden);
  ok('일부러 틀린 문제가 있었다', Boolean(wrongId));
  ok('끝났다 — 별이 뜬다', await page.locator('.swl-finish').count() === 1);
  const stars = Number(await page.locator('.swl-stars').getAttribute('data-stars'));
  ok('한 번 틀렸으니 별 둘', stars === 2, `${stars}`);
  await page.locator('.swl-done').click();
  await page.waitForTimeout(500);

  console.log('\n[ 저장 ]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_travel_v1') || 'null'));
  ok('★ 진도가 기기에 적힌다 ★', saved?.lessons?.['hotel-1']?.stars === 2 && saved.xp === 10, JSON.stringify(saved?.lessons));
  ok('틀린 줄이 약점에', Array.isArray(saved?.weak) && saved.weak.includes(wrongId));
  ok('허브에 ★가 붙는다', (await page.locator('.swh-lesson[data-lesson="hotel-1"]').innerText()).includes('★★'));
  ok('「이어서」는 안 한 것 중 첫째 — 공항', (await page.locator('.tr-next').innerText()).includes('공항'));
  ok('★ 일본어 회독 기록은 그대로 ★', (await reviewSnapshot(page)) === reviewBefore);

  console.log('\n[ 틀린 줄 다시 ]');
  const weakBtn = page.locator('.tr-weak');
  ok('★ 틀린 줄이 있으면 「다시」 버튼이 뜬다 ★', await weakBtn.count() === 1 && (await weakBtn.innerText()).includes('1줄'), await weakBtn.count() ? await weakBtn.innerText() : '없음');
  const wb = await weakBtn.boundingBox(); const lb = await page.locator('.tr-listen').boundingBox();
  ok('작은 버튼 둘이 한 줄에 · 손가락 크기 · 글자가 안 끊긴다', Math.abs(wb.y - lb.y) < 2 && wb.height >= 43.5 && wb.height < 60 && lb.height < 60, `${Math.round(wb.height)} / ${Math.round(lb.height)}`);
  const lessonsBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('jp_manabu_travel_v1')).lessons));
  await weakBtn.click();
  await page.waitForTimeout(600);
  ok('문제 한 개 — 틀렸던 그 줄', await page.locator('.swl-prompt').getAttribute('data-item') === wrongId);
  await solve(page);
  ok('끝났다', await page.locator('.swl-finish').count() === 1);
  await page.locator('.swl-done').click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_travel_v1')));
  ok('★ 맞히면 약점에서 빠진다 ★', Array.isArray(after.weak) && after.weak.length === 0, JSON.stringify(after.weak));
  ok('레슨 별·XP는 그대로', JSON.stringify(after.lessons) === lessonsBefore && after.xp === 10);
  ok('버튼이 사라진다', await page.locator('.tr-weak').count() === 0);

  console.log('\n[ 자동 듣기로 ]');
  await page.locator('.tr-listen').click();
  await page.waitForTimeout(900);
  ok('듣기 설정 화면이 열린다', await page.locator('.ls-go').count() === 1);
  ok('★ 범위가 「여행 일본어」로 되어 있다 ★', await page.locator('.ls-scope.active').getAttribute('data-scope') === 'tour');
  const cnt = Number((await page.locator('.ls-scope[data-scope="tour"] .pk-count').innerText()).replace(/\D/g, ''));
  ok('줄 수가 자료와 같다', cnt === TRAVEL_ITEMS.length, `${cnt}`);
  await page.locator('.ls-go').click();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').click();
  await page.waitForTimeout(900);
  ok('재생이 되고 첫 줄은 공항', await page.locator('.listen.play').count() === 1
    && (await page.locator('.ls-jp').innerText()).trim() === byId.get('tr-air-001').jp);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
