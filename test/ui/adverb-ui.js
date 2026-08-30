/* 부사 빈칸 채우기 — 화면에서.
 *
 * 이 화면의 값은 「왜 틀렸는지」에 있다. 정답만 알려 주면 다음에 또 틀린다 —
 * 부사는 뜻을 아는데 자리를 몰라서 틀리는 것이라 더 그렇다.
 *
 * 그리고 여기서 틀린 부사는 회독 저장소로 가야 한다. 거기까지 안 이어지면
 * 이건 앱에 붙은 기능이 아니라 얹힌 딴 연습이다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, settings);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

const readReview = (page) => page.evaluate(
  () => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'),
);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 묶음 고르기 ]');
  await goTab(page, '학습');
  ok('학습 메뉴에 부사 연습이 있다',
    await page.locator('.menutile', { hasText: '부사 연습' }).count() === 1);

  await openMenu(page, '부사 연습');
  ok('묶음이 여럿 보인다', await page.locator('.av-set').count() >= 5,
    `${await page.locator('.av-set').count()}개`);
  ok('왜 부사를 따로 연습하는지 적혀 있다',
    (await page.locator('.av-intro').first().innerText()).includes('부정'));

  const first = page.locator('.av-set').first();
  ok('묶음마다 문제 수가 보인다', (await first.innerText()).includes('문제'),
    (await first.innerText()).replace(/\n/g, ' '));

  console.log('\n[ 빈칸을 채운다 ]');
  await first.click();
  await page.waitForTimeout(700);

  ok('빈칸이 눈에 보인다', await page.locator('.av-blank').count() === 1);
  ok('처음엔 물음표', (await page.locator('.av-blank').innerText()) === '？');
  ok('한국어 뜻이 같이 보인다', (await page.locator('.av-ko').innerText()).length > 0);
  ok('보기가 셋', await page.locator('.qopt').count() === 3);
  /* 소리를 먼저 들려주면 답을 불러 주는 셈이다 */
  ok('맞히기 전에는 소리 버튼이 없다', await page.locator('.av-say').count() === 0);
  ok('무엇을 배우는 판인지 먼저 적는다',
    (await page.locator('.av-intro').innerText()).length > 10);

  /* ── 일부러 틀려 본다 — 여기가 이 화면의 본론이다 ── */
  console.log('\n[ 틀렸을 때 ]');
  const before = Object.keys(await readReview(page)).length;

  /* 정답이 아닌 보기를 고른다. 어느 게 정답인지는 화면이 알려 주지 않으니
     문제마다 첫 보기를 한 번씩 눌러 보고, 틀린 게 나오면 거기서 멈춘다.
     한 문제에서 여러 보기를 연달아 누르면 안 된다 — 맞히면 0.9초 뒤에
     저절로 넘어가는데, 그 사이에 다음 보기를 누르면 엉킨다. */
  let wrongPicked = false;
  for (let q = 0; q < 4 && !wrongPicked; q++) {
    if (await page.locator('.qopt').count() === 0) break;
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(600);
    if (await page.locator('.av-why').count()) { wrongPicked = true; break; }
    await page.waitForTimeout(900);   // 맞혔다 — 다음 문제로 넘어가기를 기다린다
  }
  ok('틀리면 설명이 뜬다', wrongPicked);

  if (wrongPicked) {
    const why = await page.locator('.av-why').innerText();
    /* ★ 정답만 알려 주면 다음에 또 틀린다 ★ */
    ok('내가 고른 게 왜 틀렸는지 적혀 있다', (await page.locator('.av-wrong').count()) === 1,
      why.replace(/\n/g, ' ').slice(0, 90));
    ok('답이 뭔지도 알려 준다', (await page.locator('.av-right').innerText()).includes('답은'));
    ok('빈칸이 내가 고른 걸로 채워진다',
      (await page.locator('.av-blank.no').count()) === 1);
    ok('정답 보기에 표시가 붙는다', await page.locator('.qopt.correct').count() === 1);

    /* 틀렸을 때는 자동으로 안 넘어간다 — 설명을 읽을 시간을 준다 */
    const stayed = await page.locator('.av-why').count();
    await page.waitForTimeout(1600);
    ok('틀리면 저절로 안 넘어간다', await page.locator('.av-why').count() === stayed);

    await page.locator('.av-why .submit-btn').click();
    await page.waitForTimeout(600);
    ok('눌러야 다음으로 간다', await page.locator('.av-why').count() === 0);
  }

  /* ── 끝까지 풀고 결과 ── */
  console.log('\n[ 끝까지 ]');
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.finish').count()) break;
    if (await page.locator('.av-why .submit-btn').count()) {
      await page.locator('.av-why .submit-btn').click();
      await page.waitForTimeout(500);
      continue;
    }
    if (await page.locator('.qopt').count() === 0) break;
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(1100);
  }
  ok('끝나면 결과가 뜬다', await page.locator('.finish').count() === 1);
  const fin = await page.locator('.finish').innerText();
  ok('몇 개 맞혔는지 보인다', /\d+\s*\/\s*\d+개 맞힘/.test(fin), fin.replace(/\n/g, ' ').slice(0, 70));

  /* ★ 틀린 부사가 회독으로 간다 ★ */
  const after = await readReview(page);
  const added = Object.keys(after).length - before;
  ok('틀린 부사가 회독 저장소로 간다', added >= 1, `${before} → ${Object.keys(after).length}`);
  const marked = Object.entries(after).filter(([, st]) => st.box === 1);
  ok('「몰라요」로 들어간다', marked.length >= 1, JSON.stringify(marked[0]?.[1] || {}));
  ok('오늘의 학습으로 간다고 말해 준다',
    fin.includes('약점') || !fin.includes('틀린 것'), fin.replace(/\n/g, ' ').slice(0, 80));

  if (fin.includes('틀린 것만 다시')) {
    await page.locator('.finish .submit-btn').click();
    await page.waitForTimeout(700);
    ok('틀린 것만 다시 돌 수 있다',
      (await page.locator('.sh-title').innerText()).includes('틀린 것만'),
      await page.locator('.sh-title').innerText());
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
