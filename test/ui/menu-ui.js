/* 학습 탭의 짜임새 — 화면에서.
 *
 * 열두 칸이 한 바둑판에 나란히 있었다. 「단어암기」 옆에 「단어 시험」이 있고
 * 그 옆에 「짝 맞추기」가 있으니, 무엇이 배우는 것이고 무엇이 확인하는
 * 것인지 눈으로 안 갈렸다. 칸이 늘 때마다 더 나빠지기만 했다.
 *
 * 여기서 세 가지를 본다.
 *   · 학습 · 퀴즈 · 기타로 갈려서 보이는가
 *   · JLPT가 단어암기 안에서 열리는가 — 따로 있던 게 사실은 같은 것이었다
 *   · 문법 안에 셋(기초 · 일상 · 문형)이 다 있는가 */
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

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 세 묶음으로 갈렸다 ]');
  await goTab(page, '학습');
  const labels = await page.locator('.menugroup .mg-label').allTextContents();
  ok('묶음이 셋', await page.locator('.menugroup').count() === 3,
    labels.map((t) => t.split('\n')[0]).join(' / '));
  /* 이 순서가 곧 한 카드가 지나가는 길이다 — 모른다 → 안다 → 샌다 */
  ok('배우기가 먼저', labels[0].includes('배우기'));
  ok('그다음 연습하기', labels[1].includes('연습하기'));
  ok('마지막이 반복하기', labels[2].includes('반복하기'));
  /* 이름만 적으면 「학습」과 「퀴즈」의 경계가 사람마다 다르게 읽힌다 */
  ok('왜 여기 있는지 한 줄로 적힌다',
    await page.locator('.menugroup .mg-sub').count() === 3,
    (await page.locator('.mg-sub').allTextContents()).join(' / '));

  const inGroup = async (n) => (await page.locator('.menugroup').nth(n)
    .locator('.mt-title').allTextContents());
  const learn = await inGroup(0);
  const practice = await inGroup(1);
  const repeat = await inGroup(2);
  ok('배우는 것은 배우기에', learn.includes('단어') && learn.includes('문법'), learn.join(','));
  ok('굴려 보는 것은 연습하기에',
    practice.includes('단어 시험') && practice.includes('부사 연습'), practice.join(','));
  ok('단어와 단어 시험이 서로 다른 묶음에',
    learn.includes('단어') && !learn.includes('단어 시험'));
  /* 회독은 이 앱의 뼈대다. 다른 연습에 묻히면 안 된다 */
  ok('회독과 약점은 반복하기에',
    repeat.includes('회독 학습') && repeat.includes('약점 복습'), repeat.join(','));
  /* 공부가 아닌 것은 학습 탭에 없다 */
  ok('번역기는 학습 탭에 없다',
    ![...learn, ...practice, ...repeat].includes('번역기'));

  console.log('\n[ JLPT는 단어암기 안으로 ]');
  /* 따로 둔 메뉴였는데 그건 다른 공부가 아니라 같은 단어를 다른 방식으로
     끊어 주는 것이었다 — 「거의 같은 것 아니냐」는 말이 맞았다 */
  ok('JLPT 단어 칸이 없다',
    await page.locator('.menutile', { hasText: 'JLPT' }).count() === 0);
  await openMenu(page, '단어');
  ok('끊는 방법이 둘', await page.locator('.wd-how button').count() === 2,
    (await page.locator('.wd-how button').allTextContents()).join(' / '));
  ok('처음엔 이어서 외우기', await page.locator('.wd-how button.active').innerText() === '이어서 외우기');
  ok('레벨을 고를 수 있다', await page.locator('.chiprow .chip').count() === 3);

  await page.locator('.wd-how button', { hasText: '세트로' }).click();
  await page.waitForTimeout(600);
  ok('세트로 끊으면 레벨 목록', await page.locator('.jl-level').count() === 5);
  await page.locator('.jl-level').first().click();
  await page.waitForTimeout(500);
  ok('세트가 보인다', await page.locator('.jl-set').count() > 3,
    `${await page.locator('.jl-set').count()}세트`);
  await page.locator('.wd-how button', { hasText: '이어서' }).click();
  await page.waitForTimeout(500);
  ok('돌아오면 원래 화면', await page.locator('.bigstart').count() === 1);

  console.log('\n[ 문법 안에 셋 ]');
  await openMenu(page, '문법');
  ok('갈래가 셋', await page.locator('.gm-tabs button').count() === 3,
    (await page.locator('.gm-tabs button').allTextContents()).join(' / '));
  ok('기초문법이 있다', await page.locator('.gm-tabs [data-tab="cards"]').count() === 1);
  ok('일상문법이 있다', await page.locator('.gm-tabs [data-tab="daily"]').count() === 1);
  ok('문형 연습이 있다', await page.locator('.gm-tabs [data-tab="pattern"]').count() === 1);
  /* 이름만 있으면 어느 걸 눌러야 할지 매번 셋 다 들어가 보게 된다 */
  ok('무엇이 다른지 적혀 있다', (await page.locator('.gm-note').innerText()).length > 4,
    await page.locator('.gm-note').innerText());

  console.log('\n[ 일상문법 ]');
  await page.locator('.gm-tabs [data-tab="daily"]').click();
  await page.waitForTimeout(600);
  ok('묶음이 여섯', await page.locator('.dg-set').count() === 6);
  const intro = await page.locator('.av-intro').first().innerText();
  /* ★ 규칙을 아는 것과 자리에 넣는 것은 다른 일이다 ★ */
  ok('왜 따로 연습하는지 적혀 있다', intro.includes('乗る') || intro.includes('電車'),
    intro.replace(/\n/g, ' ').slice(0, 70));
  ok('회독에 안 쌓인다고 밝힌다',
    (await page.textContent('.sub-body')).includes('회독에 안 쌓여요'));

  const reviewBefore = await page.evaluate(
    () => localStorage.getItem('jp_manabu_review_v1') || '{}',
  );

  await page.locator('.dg-set').first().click();
  await page.waitForTimeout(600);
  ok('빈칸이 뜬다', await page.locator('.av-blank').count() === 1);
  ok('보기가 셋', await page.locator('.qopt').count() === 3);
  ok('한국어 뜻이 같이 보인다', (await page.locator('.av-ko').innerText()).length > 0);

  /* 일부러 틀려 본다 — 왜 틀렸는지가 이 화면의 전부다 */
  let wrongPicked = false;
  for (let q = 0; q < 4 && !wrongPicked; q++) {
    if (await page.locator('.qopt').count() === 0) break;
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(600);
    if (await page.locator('.av-why').count()) { wrongPicked = true; break; }
    await page.waitForTimeout(900);
  }
  ok('틀리면 설명이 뜬다', wrongPicked);
  if (wrongPicked) {
    ok('내가 고른 게 왜 틀렸는지 적혀 있다', await page.locator('.av-wrong').count() === 1,
      (await page.locator('.av-why').innerText()).replace(/\n/g, ' ').slice(0, 80));
    ok('답이 뭔지도 알려 준다', (await page.locator('.av-right').innerText()).includes('답은'));
    const stayed = await page.locator('.av-why').count();
    await page.waitForTimeout(1600);
    ok('틀리면 저절로 안 넘어간다', await page.locator('.av-why').count() === stayed);
    await page.locator('.av-why .submit-btn').click();
    await page.waitForTimeout(500);
  }

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
  ok('몇 개 맞혔는지 보인다',
    /\d+\s*\/\s*\d+개 맞힘/.test(await page.locator('.finish').innerText()));

  /* ★ 조사는 회독 카드가 아니다 ★ 「を」를 카드로 만들 수는 없고, 억지로
     밀어 넣으면 오늘의 학습에 카드도 없는 항목이 뜬다 */
  const reviewAfter = await page.evaluate(
    () => localStorage.getItem('jp_manabu_review_v1') || '{}',
  );
  ok('일상문법은 회독을 안 건드린다', reviewBefore === reviewAfter);

  // 진도는 남는다
  const done = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').dailyGrammar || {},
  );
  ok('묶음 진도가 남는다', Object.keys(done).length === 1, JSON.stringify(done));
  ok('몇 개 맞혔는지 적힌다', typeof Object.values(done)[0]?.right === 'number');

  console.log('\n[ 설정에서도 같은 묶음 ]');
  /* 열린 화면을 닫고 나간다. 메뉴 화면은 탭 바를 덮는 통짜 화면이라
     뒤로 없이 탭을 누를 수 없다 — 앱이 그렇게 정한 대로 따라간다. */
  await page.locator('.finish .ghost-btn').click();
  await page.waitForTimeout(600);
  await page.locator('.subscreen.open .sub-back').first().click();
  await page.waitForTimeout(700);
  await goTab(page, '더보기');
  await page.waitForTimeout(700);
  ok('설정에도 묶음이 있다', await page.locator('.setgroup').count() === 3,
    (await page.locator('.sg-label').allTextContents()).join(' / '));
  /* 켜는 칸이 있는데 학습 탭에 없으면 켜도 아무 데도 안 뜨는 유령 칸이 된다 */
  ok('없어진 JLPT 칸은 설정에도 없다',
    await page.locator('.setgroup .set-title', { hasText: 'JLPT' }).count() === 0);

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
