/* 회독 단계가 화면에서 실제로 달라지는가.
 *
 * lib 검사는 「streak 2면 듣기」까지만 본다. 화면이 그걸 안 쓰면 소용이 없다.
 * 여기서는 연속 정답 수를 손으로 심어 두고 카드가 정말 달라지는지 본다.
 *
 * 그리고 골라 들어간 판에서는 단계를 올리지 않아야 한다 — 「나는 한→일로만
 * 볼래」를 앱이 마음대로 바꾸면 안 된다. 그것도 여기서 지킨다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, startReview } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const day = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

/* 모든 카드에 같은 연속 정답 수를 심는다 — 그러면 오늘 판이 그 단계로만 채워진다.
   복습일이 지나 있어야 오늘 큐에 들어온다. */
function seedStreak(streak) {
  const review = {};
  for (let i = 1; i <= 120; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = {
      box: 3, streak, lastSeen: day(200), rounds: streak, wrongCount: 0, vagueCount: 0, seenAt: 1,
    };
  }
  return review;
}

async function boot(browser, review, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = true; s.canReadKana = true;
    Object.assign(s, p.settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(p.review));
  }, { review, settings });
  await page.waitForTimeout(1000);
  /* 켜진 채로 다시 부르고 나서 끊는다 — 끊고 부르면 서비스워커가 자리를 못 잡는다 */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

/* 이 검사는 카드마다 연속 정답 수를 심어 두고 그 단계가 화면에 나오는지 본다.
   심은 카드는 전부 복습일이 지난 것들이라 「복습하기」로 들어가야 만난다 —
   「단어 외우기」로 들어가면 안 심은 새 카드가 나와서 단계가 늘 0이 된다. */
const startToday = (page) => startReview(page);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  const CASES = [
    { streak: 0, label: '읽기', front: 'jp', kana: true },
    { streak: 1, label: '떠올리기', front: 'jp', kana: false },
    { streak: 2, label: '듣기', front: 'hidden' },
    { streak: 3, label: '한국어 → 일본어', front: 'ko' },
    { streak: 4, label: '소리 내어', front: 'jp', kana: false },
  ];

  for (const c of CASES) {
    const page = await boot(browser, seedStreak(c.streak));
    page.on('pageerror', (e) => errors.push(e.message));
    await startToday(page);

    ok(`${c.streak}번 맞힌 카드는 「${c.label}」`,
      (await page.textContent('.sc-step')) === c.label, await page.textContent('.sc-step').catch(() => '없음'));
    ok(`${c.label} — 무엇을 하라는지 적힘`, (await page.textContent('.sc-hint')).trim().length > 4);

    if (c.front === 'hidden') {
      /* 글자를 보여 주면 듣기가 아니라 읽기가 된다 */
      ok('듣기는 앞면 글자를 가림', await page.locator('.sc-hear').count() === 1);
      ok('가운데에 글자가 없음', (await page.textContent('.sc-hear')).trim() === '');
      /* 가운데를 버튼으로 두면 카드 탭을 먹어서 안 뒤집힌다 — 실제로 그랬다 */
      ok('다시 듣기는 모서리 버튼이 맡음', await page.locator('.sc-speak').count() === 1);
      ok('히라가나 보기 버튼도 없음', await page.locator('.sc-peek').count() === 0);
      await page.locator('.studycard').click();
      await page.waitForTimeout(400);
      ok('뒤집으면 글자가 나옴', await page.locator('.sc-hear').count() === 0);
      ok('뒤집으면 뜻도 나옴', (await page.textContent('.studycard')).trim().length > 6);
    } else if (c.front === 'ko') {
      /* 한국어를 보고 일본어를 떠올리는 게 회화에 제일 가깝다 */
      ok('앞면이 한국어', await page.locator('.sc-main.ko').count() === 1);
      const front = (await page.textContent('.sc-main')).trim();
      ok('앞면에 일본어가 없음', !/[ぁ-んァ-ン一-龯]/.test(front), front);
      await page.locator('.studycard').click();
      await page.waitForTimeout(400);
      ok('뒤집으면 일본어', /[ぁ-んァ-ン一-龯]/.test(await page.textContent('.studycard')));
    } else {
      ok('앞면이 일본어', /[ぁ-んァ-ン一-龯]/.test((await page.textContent('.sc-main')).trim()));
      ok('앞면이 한국어가 아님', await page.locator('.sc-main.ko').count() === 0);
      if (c.kana) {
        ok('읽기 단계는 읽는 법을 같이 보여 줌', await page.locator('.sc-kana').count() === 1);
      } else {
        ok('읽는 법은 숨기고 볼 수만 있게', await page.locator('.sc-kana').count() === 0 && await page.locator('.sc-peek').count() === 1);
      }
    }
    await page.close();
  }

  console.log('\n── 골라 들어간 판은 내 설정을 지킨다');
  {
    /* 「나는 한→일로만 볼래」를 앱이 마음대로 바꾸면 안 된다 */
    const page = await boot(browser, seedStreak(2), { direction: 'mean-kanji' });
    await openMenu(page, '단어암기');
    const go = page.locator('.subscreen .bigstart').first();
    await go.click();
    await page.waitForTimeout(1100);
    ok('회독 화면이 열림', await page.locator('.studycard').count() === 1);
    ok('단계 이름이 안 붙음', await page.locator('.sc-step').count() === 0);
    ok('앞면을 안 가림', await page.locator('.sc-hear').count() === 0);
    ok('내가 정한 방향(한→일) 그대로', await page.locator('.sc-main.ko').count() === 1);
    await page.close();
  }

  console.log('\n── 소리를 꺼 둔 사람에게 빈 화면을 주지 않는다');
  {
    const page = await boot(browser, seedStreak(2), { autoTTS: false });
    await startToday(page);
    ok('듣기 대신 떠올리기로', (await page.textContent('.sc-step')) === '떠올리기', await page.textContent('.sc-step'));
    ok('글자가 보임', await page.locator('.sc-hear').count() === 0);
    await page.close();
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
