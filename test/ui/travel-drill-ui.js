/* 숫자 귀 훈련 — 진짜 화면에서.
 *
 *   허브에 「숫자 귀 훈련」 카드와 금액·시각·섞어서 버튼이 있고 손가락 크기다
 *   한 판은 열 문제 — 소리만 듣고(글자 없음) 숫자 보기 셋에서 고른다
 *   끝까지 맞히면 만점으로 적히고, 「한 번 더」는 값이 새로 만들어진 판이다
 *   틀리면 뒤에 다시 나오고 만점은 안 된다
 *   ★ 판은 끝나는 순간 한 번 적힌다 — 「한 번 더」로 이어 풀어도 안 사라진다 ★
 *   ★ 레슨 별과 일본어 회독 기록은 하나도 안 건드린다 ★ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, seed = null) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((seedData) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.removeItem('jp_manabu_travel_v1');
    if (seedData) localStorage.setItem('jp_manabu_travel_v1', JSON.stringify(seedData));
  }, seed);
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

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_travel_v1') || 'null'));
const review = (page) => page.evaluate(() => localStorage.getItem('jp_manabu_review_v1') || '');

/* 한 판을 푼다 — data-item이 정답 id다. wrongAt이면 그 번째 문제에서 일부러 한 번 틀린다 */
async function playRound(page, { wrongAt = -1, peekAt = -1 } = {}) {
  const asked = [];
  let peeked = null;
  let wrongOnce = false;
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.swl-finish').count()) break;
    const prompt = page.locator('.swl-prompt');
    const id = await prompt.getAttribute('data-item');
    const text = await prompt.innerText();
    const labels = await page.locator('.swl-opts .qopt .qo-body b').allInnerTexts();
    asked.push({ id, hasJa: /[一-鿿ぁ-ゖァ-ヺ]/.test(text), labels, type: await prompt.getAttribute('data-type') });
    if (peeked && i === peekAt + 1) {
      peeked.nextHidden = await page.locator('.swl-peekbox').count() === 0 && await page.locator('.swl-peek').count() === 1;
    }
    if (i === peekAt) {
      await page.locator('.swl-peek').click();
      await page.waitForTimeout(150);
      peeked = { text: await page.locator('.swl-peekbox').innerText(), id, btnGone: await page.locator('.swl-peek').count() === 0 };
    }
    let pickId = id;
    if (i === wrongAt && !wrongOnce) {
      const opts = page.locator('.swl-opts .qopt');
      for (let k = 0; k < await opts.count(); k++) {
        const oid = await opts.nth(k).getAttribute('data-id');
        if (oid !== id) { pickId = oid; wrongOnce = true; break; }
      }
    }
    await page.locator(`.swl-opts .qopt[data-id="${pickId}"]`).click();
    await page.locator('.swl-check').click();
    await page.waitForTimeout(150);
    await page.locator('.swl-next').click();
    await page.waitForTimeout(150);
  }
  asked.peeked = peeked;
  return asked;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await boot(browser);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const reviewBefore = await review(page);

  console.log('\n[ 허브의 숫자 귀 훈련 ]');
  await openMenu(page, '여행 일본어');
  ok('카드가 있다', await page.locator('.tr-drill').count() === 1);
  ok('버튼 다섯 — 금액 · 시각 · 날짜 · 인원·층 · 섞어서', (await page.locator('.tr-drillgo').allInnerTexts()).join() === '금액,시각,날짜,인원·층,섞어서', (await page.locator('.tr-drillgo').allInnerTexts()).join());
  const heights = await Promise.all((await page.locator('.tr-drillgo').all()).map((b) => b.boundingBox()));
  ok('버튼이 손가락 크기', heights.every((b) => b && b.height >= 43.5), heights.map((b) => Math.round(b?.height)).join('/'));

  console.log('\n[ 금액 한 판 — 전부 맞히기 ]');
  await page.locator('.tr-drillgo[data-kind="yen"]').click();
  await page.waitForTimeout(600);
  ok('문제 화면', await page.locator('.swl-prompt').count() === 1);
  ok('안내가 숫자 훈련', (await page.locator('.swl-ask').innerText()).includes('숫자'));
  const r1 = await playRound(page);
  ok('열 문제', r1.length === 10, `${r1.length}`);
  ok('★ 듣기 문제는 글자(일본어)를 안 보여 준다 ★', r1.every((q) => !q.hasJa && q.type === 'hear'));
  ok('보기는 전부 「○엔입니다.」 숫자', r1.every((q) => q.labels.length === 3 && q.labels.every((l) => /^[\d,]+엔입니다\.$/.test(l.trim()))), r1[0].labels.join(' / '));
  ok('보기 숫자가 서로 다르다', r1.every((q) => new Set(q.labels).size === 3));
  ok('끝났다 — 한 판 끝', await page.locator('.swl-finish').count() === 1 && (await page.locator('.swl-finish .navtitle').innerText()).includes('한 판 끝'));
  ok('별 셋 (하나도 안 틀림)', await page.locator('.swl-stars').getAttribute('data-stars') === '3');

  let st = await saved(page);
  ok('★ 판이 끝나는 순간 적힌다 — 「그만」을 안 눌러도 ★', st?.drill?.rounds === 1 && st.drill.perfect === 1 && st.xp === 10, JSON.stringify(st?.drill) + ` xp ${st?.xp}`);
  ok('레슨 기록은 비어 있다', Object.keys(st?.lessons || {}).length === 0);

  console.log('\n[ 「한 번 더」 — 새 값 · 일부러 한 번 틀리기 ]');
  await page.locator('.swl-finish .ghost-btn').click();
  await page.waitForTimeout(500);
  ok('새 판이 시작된다', await page.locator('.swl-prompt').count() === 1 && await page.locator('.swl-finish').count() === 0);
  const r2 = await playRound(page, { wrongAt: 2 });
  const ids1 = new Set(r1.map((q) => q.id));
  ok('★ 앞 판과 같은 값이 안 돌아온다 ★', r2.filter((q) => ids1.has(q.id)).length === 0, `${r2.filter((q) => ids1.has(q.id)).length}개 겹침`);
  ok('틀린 문제는 뒤에 다시 나온다 — 열한 번째', r2.length === 11, `${r2.length}`);
  ok('별 둘 이하 (한 번 틀림)', Number(await page.locator('.swl-stars').getAttribute('data-stars')) <= 2);
  st = await saved(page);
  ok('★ 이어 푼 둘째 판도 적힌다 — 판 2 · 만점 1 ★', st?.drill?.rounds === 2 && st.drill.perfect === 1 && st.xp === 15, JSON.stringify(st?.drill) + ` xp ${st?.xp}`);

  console.log('\n[ 그만 → 허브 ]');
  await page.locator('.swl-done').click();
  await page.waitForTimeout(500);
  const note = await page.locator('.tr-drill .swh-ubody span').innerText();
  ok('허브에 판 수가 보인다', note.includes('2판') && note.includes('1판 만점'), note);
  st = await saved(page);
  ok('레슨 별·약점은 그대로', Object.keys(st.lessons).length === 0 && st.weak.length === 0);
  ok('★ 일본어 회독 기록은 그대로 ★', (await review(page)) === reviewBefore);

  console.log('\n[ 시각 · 섞어서 ]');
  await page.locator('.tr-drillgo[data-kind="time"]').click();
  await page.waitForTimeout(500);
  const r3 = await playRound(page);
  ok('시각 보기는 「N시 …」 모양', r3.length === 10 && r3.every((q) => q.labels.length === 3 && q.labels.every((l) => /^((오전|오후) )?\d{1,2}시( \d{1,2}분)?입니다\.$/.test(l.trim()))), r3[0].labels.join(' / '));
  ok('시각에도 글자가 없다', r3.every((q) => !q.hasJa));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(400);
  // The product draws ten random types; an unseeded draw can legitimately contain
  // only two types. Fix the random stream here so the coverage assertion tests
  // all categories rather than occasionally failing by chance.
  await page.evaluate(() => {
    let seed = 42;
    Math.random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.locator('.tr-drillgo[data-kind="mix"]').click();
  await page.waitForTimeout(500);
  const r4 = await playRound(page);
  const kinds = new Set(r4.map((q) => q.id.split(':')[1]));
  ok('섞어서에는 금액·시각·날짜·인원이 고루 나온다', kinds.size >= 3, [...kinds].join());
  await page.locator('.swl-done').click();
  await page.waitForTimeout(400);

  console.log('\n[ 날짜 · 인원·층 ]');
  await page.locator('.tr-drillgo[data-kind="date"]').click();
  await page.waitForTimeout(500);
  const r6 = await playRound(page);
  ok('날짜 보기는 「N월 N일입니다.」', r6.length === 10 && r6.every((q) => q.labels.length === 3 && q.labels.every((l) => /^\d{1,2}월 \d{1,2}일입니다\.$/.test(l.trim()))), r6[0].labels.join(' / '));
  ok('날짜에도 글자가 없다', r6.every((q) => !q.hasJa));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(400);
  await page.locator('.tr-drillgo[data-kind="count"]').click();
  await page.waitForTimeout(500);
  const r7 = await playRound(page);
  ok('인원·층 보기는 「N명/개/층입니다.」', r7.length === 10 && r7.every((q) => q.labels.length === 3 && q.labels.every((l) => /^\d{1,2}(명|개|층)입니다\.$/.test(l.trim()))), r7[0].labels.join(' / '));
  ok('★ 같은 수의 다른 세는 말이 방해 보기로 섞인다 (2명 ↔ 2개) ★', r7.some((q) => new Set(q.labels.map((l) => l.replace(/\D*(\d+).*/, '$1'))).size < 3), r7.map((q) => q.labels.join('/')).slice(0, 3).join(' | '));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(400);
  st = await saved(page);
  ok('여섯 판 — 판 6', st.drill.rounds === 6, JSON.stringify(st.drill));

  console.log('\n[ 글자 보기 — 소리가 안 나는 기기에서도 풀리게 ]');
  await page.locator('.tr-drillgo[data-kind="yen"]').click();
  await page.waitForTimeout(500);
  ok('처음엔 글자가 가려져 있다', await page.locator('.swl-peekbox').count() === 0 && await page.locator('.swl-peek').count() === 1);
  const r5 = await playRound(page, { peekAt: 0 });
  ok('★ 누르면 일본어와 읽기가 펼쳐진다 ★', r5.peeked && /円です|円になります/.test(r5.peeked.text) && /えん/.test(r5.peeked.text) && r5.peeked.btnGone, r5.peeked?.text.replace(/\n/g, ' / '));
  ok('★ 글자를 본 문제는 뒤에 한 번 더 나온다 — 열한 문제 ★', r5.length === 11, `${r5.length}`);
  ok('그 한 번 더는 같은 문제다', r5.filter((q) => q.id === r5.peeked.id).length === 2);
  ok('★ 다음 문제에서는 다시 가려진다 ★', r5.peeked?.nextHidden === true, String(r5.peeked?.nextHidden));
  ok('★ 틀린 게 아니라서 별은 그대로 셋 ★', await page.locator('.swl-stars').getAttribute('data-stars') === '3');
  st = await saved(page);
  ok('만점 판으로 적힌다', st.drill.rounds === 7 && st.drill.perfect === 6, JSON.stringify(st.drill));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(300);

  console.log('\n[ 틀린 줄 다시 — 앞 판은 「한 번 더」 전에 정산된다 ]');
  {
    const A = 'tr-ht-004'; const B = 'tr-ht-003';
    const p2 = await boot(browser, { lessons: {}, xp: 0, weak: [A, B, 'gone-1'], drill: { rounds: 0, perfect: 0 } });
    p2.on('pageerror', (e) => errors.push(e.message));
    await openMenu(p2, '여행 일본어');
    ok('★ 자료에 없는 옛 id(gone-1)는 세지 않는다 — 「2줄」 ★', (await p2.locator('.tr-weak').innerText()).includes('2줄'), await p2.locator('.tr-weak').innerText());
    await p2.locator('.tr-weak').click();
    await p2.waitForTimeout(500);
    /* 두 문제: A는 바로 맞히고, B는 일부러 한 번 틀린다 */
    const seen = [];
    let wrongB = false;
    for (let i = 0; i < 8; i++) {
      if (await p2.locator('.swl-finish').count()) break;
      const id = await p2.locator('.swl-prompt').getAttribute('data-item');
      seen.push(id);
      let pickId = id;
      if (id === B && !wrongB) {
        const opts = p2.locator('.swl-opts .qopt');
        for (let k = 0; k < await opts.count(); k++) {
          const oid = await opts.nth(k).getAttribute('data-id');
          if (oid !== id) { pickId = oid; wrongB = true; break; }
        }
      }
      await p2.locator(`.swl-opts .qopt[data-id="${pickId}"]`).click();
      await p2.locator('.swl-check').click();
      await p2.waitForTimeout(120);
      await p2.locator('.swl-next').click();
      await p2.waitForTimeout(120);
    }
    ok('문제는 약점 두 줄 + 틀린 한 줄의 다시 — 셋', seen.length === 3 && new Set(seen).size === 2, seen.join(' '));
    const mid = await saved(p2);
    ok('★ 판이 끝나는 순간 정산된다 — 한 번도 안 틀린 A만 빠지고 B는 남는다 ★', mid.weak.join() === B, JSON.stringify(mid.weak));
    await p2.locator('.swl-finish .ghost-btn').click();
    await p2.waitForTimeout(500);
    ok('★ 「한 번 더」는 남은 약점(B)만으로 새 판이 된다 ★', await p2.locator('.swl-prompt').getAttribute('data-item') === B && (await p2.locator('.swl-count').innerText()).includes('1 / 1'), await p2.locator('.swl-count').innerText());
    await p2.locator(`.swl-opts .qopt[data-id="${B}"]`).click();
    await p2.locator('.swl-check').click();
    await p2.waitForTimeout(120);
    await p2.locator('.swl-next').click();
    await p2.waitForTimeout(300);
    const end = await saved(p2);
    ok('둘째 판에서 맞히면 약점이 비고 버튼도 사라진다', end.weak.length === 0);
    await p2.locator('.swl-finish .ghost-btn').click();
    await p2.waitForTimeout(500);
    ok('약점이 비었으면 「한 번 더」는 문제를 안 내고 허브로 나간다', await p2.locator('.swl-finish').count() === 0 && await p2.locator('.tr-weak').count() === 0 && await p2.locator('.tr-drill').count() === 1);
    await p2.close();
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
