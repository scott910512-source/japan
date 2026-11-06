/* 단어 시험의 보기 읽기 · 뜻 · 듣기 — 진짜 화면에서.
 *
 *   · 답을 낸 뒤 보기 수만큼 줄(일본어 · 읽기 · 뜻 · 🔊)이 나오고 정답 줄이 하나다
 *   · 「다음 문제」 버튼이 패널보다 위, 화면 안에 있다
 *   · 펼쳐 둔 채로 맞히면 저절로 안 넘어가고, 접으면 넘어간다 */
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
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
  /* 껍데기가 뜰 때까지 기다린다 — 안 기다리면 느린 기기에서 아직
     안 그려진 화면을 누르게 된다. 끝내 안 뜨면 뒤따르는 검사가
     제 말로 실패하는 쪽이 읽기 쉽다. */
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});

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

  await openMenu(page, '단어 시험');
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '시험 시작' }).first().click().catch(async () => {
    await page.locator('.submit-btn').first().click();
  });
  await page.waitForTimeout(800);
  ok('시험이 시작됨', await page.locator('.qoptions').count() === 1);
  ok('★ 답을 내기 전에는 오른쪽 읽기·뜻이 없다 ★', await page.locator('.optwrap .optaside, .optwrap .optspks').count() === 0);

  const idxOf = async () => (await page.locator('.sh-title').first().textContent()).trim();
  let tested = false; let held = false;
  for (let n = 0; n < 16 && !(tested && held); n++) {
    const before = await idxOf();
    const nOpts = await page.locator('.qopt').count();
    /* 늘 첫 보기만 누르면 정답 자리가 우연히 안 맞는 날 맞히는 경우를 못 만난다 — 보기를 돌려 가며 누른다 */
    const pick = n % nOpts;
    await page.locator('.qopt').nth(pick).click();
    await page.waitForTimeout(450);
    const right = ((await page.locator('.qopt').nth(pick).getAttribute('class')) || '').includes('correct');
    if (!tested) {
      tested = true;
      ok('★ 아래 큰 패널이 없다 ★', await page.locator('.optrev').count() === 0);
      ok('줄마다 🔊가 보기 줄 안에 있다', await page.locator('.optwrap .optspks .spk').count() === nOpts, `${nOpts}`);
      ok('★ 보기마다 일본어 · 읽기 · 뜻이 오른쪽에 붙는다 ★', await page.locator('.optwrap').evaluateAll((ws) => ws.every((w) => (w.querySelector('.optaside')?.textContent || '').trim().length > 0)));
      ok('★ 같은 줄: 🔊가 보기 단추 높이 안에 있다 ★', await page.locator('.optwrap').evaluateAll((ws) => ws.every((w) => { const b = w.querySelector('.qopt').getBoundingClientRect(); const k = w.querySelector('.optspks .spk').getBoundingClientRect(); return k.top >= b.top - 1 && k.bottom <= b.bottom + 1; })));
      ok('★ 정답 밑에 예문이 나오고 재생 버튼이 예문에 붙는다(맞혔을 때도) ★',
        await page.locator('.qopt.correct .qo-why .qw-jp .qo-replay').count() === 1 && (await page.locator('.qopt.correct .qo-why .qw-jp').innerText()).trim().length > 2);
      ok('정답 표시 옆 따로 떨어진 🔊는 없다', await page.locator('.qo-mark .qo-replay').count() === 0);
      await page.screenshot({ path: process.env.SHOT || '/tmp/optrev.png', fullPage: false });
      const btn = page.locator('.qnext .submit-btn');
      ok('「다음 문제」 버튼이 있다', await btn.count() === 1);
      const box = await btn.boundingBox();
      ok('★ 「다음 문제」가 화면 안에 있다 ★', box && box.y + box.height <= 900, box ? `y=${Math.round(box.y + box.height)}` : 'none');
    }
    if (right && !held) {
      held = true;
      await page.waitForTimeout(1800);
      ok('★ 보기 상세가 붙어 있으니 맞혀도 저절로 안 넘어간다 ★', (await idxOf()) === before, await idxOf());
      if (await page.locator('.qnext .submit-btn').count()) { await page.locator('.qnext .submit-btn').click(); await page.waitForTimeout(500); }
      continue;
    }
    if (await page.locator('.qnext .submit-btn').count()) { await page.locator('.qnext .submit-btn').click(); await page.waitForTimeout(500); }
    else await page.waitForTimeout(1200);
  }
  ok('맞히는 경우도 확인했다', held);
  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
