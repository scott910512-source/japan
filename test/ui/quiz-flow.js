import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';

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

  /* 시험 화면을 빠져나온다.
   *
   * 시험 중에는 앱 헤더가 접혀서 닫는 버튼이 .sub-back이 아니라 .sh-close다.
   * _nav의 goTab은 .subscreen.open .sub-back만 찾아 누르는데, 시험 중에는
   * 그게 안 보여서 아무것도 못 닫고 탭바를 누르려다 「element is not visible」로
   * 30초를 기다리다 죽는다. 실제로 그렇게 죽는 걸 보고 이 함수를 만들었다.
   * 그래서 보이는 쪽을 눌러 덮개를 걷고 나간다. */
  const leaveExam = async () => {
    for (let i = 0; i < 3; i++) {
      const close = page.locator('.sh-close:visible, .subscreen.open .sub-back:visible');
      if (!await close.count()) break;
      await close.first().click();
      await page.waitForTimeout(600);
      // 시험을 벗어났고 덮개도 걷혔으면 끝
      if (!await page.locator('.qoptions').count()
        && !await page.locator('.subscreen.open').count()) break;
    }
  };

  const startExam = async () => {
    await leaveExam();
    await openMenu(page, '단어 시험');
    await page.waitForTimeout(700);
    await page.locator('button', { hasText: '시험 시작' }).first().click().catch(async () => {
      await page.locator('.submit-btn').first().click();
    });
    await page.waitForTimeout(800);
  };
  await startExam();

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
  const playRest = async () => {
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
  };
  await playRest();

  /* ★ 한 판으로 안 되면 새 판을 잡는다 ★
   *
   * 이 검사는 늘 첫 보기를 누르고, 거기 정답 표시가 붙었는지로 맞았는지를
   * 안다. 보기 순서는 앱이 Math.random으로 섞으니 첫 보기가 정답일 확률은
   * 1/4이고, 스무 문제를 다 풀어도 한 번도 안 맞을 확률이 0.75^20 ≈ 0.3%
   * 남는다. 실제로 CI에서 한 번 그 0.3%가 나와 「정답 false / 오답 true」로
   * 깨졌다 — 앱은 멀쩡한데 검사만 운이 나빴다.
   *
   * 검사가 배포 관문이 된 뒤로 이건 그냥 흔들리는 검사가 아니다. 아무 이유
   * 없이 배포를 막고, 그런 실패가 몇 번 쌓이면 사람이 빨간 불을 그냥 넘기게
   * 된다 — 관문이 있으나 마나가 되는 가장 흔한 경로다.
   *
   * 그래서 못 본 흐름이 남으면 새 판을 잡아 이어 본다. 세 판이면 3e-8이라
   * 사실상 운에 안 기댄다. 판정 자체는 그대로다 — 두 흐름을 다 봐야 통과다. */
  for (let round = 0; round < 2 && (!sawRight || !sawWrong); round++) {
    await startExam();
    await playRest();
  }
  ok('맞은 흐름·틀린 흐름 둘 다 확인', sawRight && sawWrong, `정답 ${sawRight} / 오답 ${sawWrong}`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
