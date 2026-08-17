import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e ? '— ' + e : ''); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1000);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }

  await page.locator('.menutile', { hasText: '단어 시험' }).first().click();
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '시험 시작' }).first().click().catch(async () => {
    await page.locator('.submit-btn').first().click();
  });
  await page.waitForTimeout(800);

  ok('시험이 시작됨', await page.locator('.qoptions').count() === 1);

  // 헤더가 하나뿐이어야 한다 — 뒤로가기 화살표가 위아래로 겹치면 안 된다
  const appHeader = await page.locator('.sub-header').first().isVisible().catch(() => false);
  ok('시험 중에는 앱 헤더가 접힘', appHeader === false);
  ok('뒤로가기는 하나만', await page.locator('.sub-back:visible, .sh-close:visible').count() === 1);

  // 정답을 고르면 버튼 없이 저절로 넘어간다
  const idxOf = async () => (await page.locator('.sh-title').first().textContent()).trim();
  const before = await idxOf();
  // 1번 보기를 눌러 보고, 그 보기에 정답 표시가 붙었는지로 맞았는지 판단한다.
  const answer = async () => {
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(450);
    return ((await page.locator('.qopt').first().getAttribute('class')) || '').includes('correct');
  };
  const firstWasRight = await answer();

  if (firstWasRight) {
    ok('정답이면 다음 버튼이 없음', await page.locator('.qnext').count() === 0);
    await page.waitForTimeout(1100);
    ok('정답이면 저절로 다음 문제', (await idxOf()) !== before, `${before} → ${await idxOf()}`);
  } else {
    ok('틀리면 설명이 정답 보기 안에 붙음', await page.locator('.qopt.correct .qo-why').count() === 1);
    ok('틀리면 아래 상자는 안 뜸', await page.locator('.qverdict').count() === 0);
    const btn = page.locator('.qnext .submit-btn');
    ok('틀리면 다음 버튼이 있음', await btn.count() === 1);
    const box = await btn.boundingBox();
    ok('다음 버튼이 화면 안에 있음', box && box.y + box.height <= 900, box ? `y=${Math.round(box.y + box.height)}` : 'none');
    await page.waitForTimeout(1200);
    ok('틀리면 저절로 안 넘어감', (await idxOf()) === before, await idxOf());
    await btn.click();
    await page.waitForTimeout(500);
    ok('눌러야 다음 문제', (await idxOf()) !== before, `${before} → ${await idxOf()}`);
  }

  // 나머지 문항을 돌며 두 흐름을 모두 본다
  let sawRight = firstWasRight, sawWrong = !firstWasRight;
  for (let i = 0; i < 19 && (!sawRight || !sawWrong); i++) {
    if (await page.locator('.qoptions').count() === 0) break;
    const at = await idxOf();
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(450);
    const right = (await page.locator('.qopt').first().getAttribute('class') || '').includes('correct');
    if (right) {
      if (!sawRight) {
        ok('정답이면 다음 버튼이 없음', await page.locator('.qnext').count() === 0);
        await page.waitForTimeout(1100);
        ok('정답이면 저절로 다음 문제', (await idxOf()) !== at, `${at} → ${await idxOf()}`);
        sawRight = true;
      } else { await page.waitForTimeout(1000); }
    } else {
      if (!sawWrong) {
        ok('틀리면 설명이 정답 보기 안에 붙음', await page.locator('.qopt.correct .qo-why').count() === 1);
        ok('틀리면 아래 상자는 안 뜸', await page.locator('.qverdict').count() === 0);
        const box = await page.locator('.qnext .submit-btn').boundingBox();
        ok('다음 버튼이 화면 안에 있음', box && box.y + box.height <= 900, box ? `y=${Math.round(box.y + box.height)}` : 'none');
        ok('틀리면 저절로 안 넘어감', (await idxOf()) === at, await idxOf());
        sawWrong = true;
      }
      await page.locator('.qnext .submit-btn').click();
      await page.waitForTimeout(400);
    }
  }
  ok('맞은 흐름·틀린 흐름 둘 다 확인', sawRight && sawWrong, `정답 ${sawRight} / 오답 ${sawWrong}`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
