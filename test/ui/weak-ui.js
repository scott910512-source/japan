/* 약점 장부 — 실제 앱에서.
 *
 * ★ 이 검사가 있는 이유 ★
 *
 * 1. 시험을 끝까지 풀면 결과 화면이 떠야 한다.
 *
 *    여기까지 가 본 검사가 없었다. quiz-flow는 두 흐름(맞음·틀림)만 보고
 *    나오게 되어 있어서 끝까지 안 갔고, 그 사이에 결과 화면을 그리는 쪽이
 *    없는 변수를 보고 있었다(QuizRun이 onActivity를 안 받는데 결과 화면에
 *    넘겼다). 스무 문항을 다 풀면 거기서 터졌다 — 쓰는 사람에게는 「시험
 *    끝나니까 튕긴다」로 보인다. 끝까지 가는 검사가 없으면 또 그렇게 된다.
 *
 * 2. 시험에서 맞고 틀린 것이 약점 장부에 쌓여야 한다.
 *
 *    시험은 회독 진도를 일부러 안 올린다 — 시험 때문에 복습 간격이 흔들리면
 *    시험을 마음 편히 못 본다. 그 대가로 시험에서 열 번 틀린 낱말이 「약점
 *    0」이었다. 장부가 그 빈자리를 채운다.
 *
 * 3. 복습 탭이 「왜 약한지」를 말해야 한다. 숫자만으로는 다음에 할 일이
 *    안 정해진다.
 *
 * 4. 듣기가 바퀴마다 순서를 섞어야 한다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, openListen } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
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
    s.onboarded = true;
    s.autoTTS = false;
    // 열 문항이면 끝까지 가도 한참 안 걸린다 — 끝까지 가는 게 이 검사의 일이다
    s.quizCount = 10;
    s.levels = [];
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }

  const ledger = () => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}');
    return p.weak || {};
  });
  const review = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));

  console.log('\n[ 시험을 끝까지 ]');
  {
    const reviewBefore = JSON.stringify(await review());

    await openMenu(page, '단어 시험');
    await page.waitForTimeout(700);
    await page.locator('.submit-btn').first().click();
    await page.waitForTimeout(800);
    ok('시험이 시작됨', await page.locator('.qoptions').count() === 1);

    /* 끝까지 푼다. 늘 첫 보기를 눌러서 맞기도 하고 틀리기도 한다 —
       맞으면 저절로 넘어가고 틀리면 다음 버튼을 눌러야 한다. */
    let steps = 0;
    while (steps < 40 && await page.locator('.quizscore').count() === 0) {
      steps += 1;
      if (await page.locator('.qoptions').count()) {
        await page.locator('.qopt').first().click();
        await page.waitForTimeout(420);
      }
      const nextBtn = page.locator('.qnext .submit-btn');
      if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(350); }
      else await page.waitForTimeout(900);
    }

    /* ★ 여기가 터지던 자리다 ★
       결과 화면이 없는 변수를 보고 있어서, 마지막 문항을 넘기는 순간 화면이
       통째로 하얘졌다. 「시험 끝나니까 튕긴다」의 정체다. */
    ok('★ 결과 화면이 뜬다 ★', await page.locator('.quizscore').count() === 1, `${steps}걸음`);
    ok('점수가 적혀 있다', /\d/.test(await page.locator('.qs-num').innerText().catch(() => '')),
      (await page.locator('.qs-num').innerText().catch(() => '')).replace(/\s+/g, ''));
    ok('★ 끝까지 풀어도 JS 에러가 없다 ★', errors.length === 0, errors.slice(0, 2).join(' | '));

    console.log('\n[ 시험 성적이 약점 장부에 쌓인다 ]');
    const book = await ledger();
    const rows = Object.values(book);
    ok('장부에 줄이 생겼다', rows.length > 0, `${rows.length}줄`);
    const graded = rows.filter((r) => (r.quizWrong || 0) + (r.quizRight || 0) > 0);
    ok('맞고 틀린 것이 세어졌다', graded.length > 0, `${graded.length}개 낱말`);
    const total = graded.reduce((s, r) => s + (r.quizWrong || 0) + (r.quizRight || 0), 0);
    ok('열 문항을 풀었으니 열 번쯤 적혔다', total >= 8 && total <= 10, `${total}번`);
    ok('한 문항이 두 번 안 세어진다', rows.every((r) => (r.quizWrong || 0) + (r.quizRight || 0) <= 1),
      rows.map((r) => (r.quizWrong || 0) + (r.quizRight || 0)).join(','));

    /* ★ 복습 간격은 안 건드린다 ★
       이 장부를 따로 둔 이유가 이것이다. 시험을 봐도 복습일이 안 밀려야
       시험을 마음 편히 본다. */
    ok('★ 시험을 봐도 회독 기록은 그대로다 ★', JSON.stringify(await review()) === reviewBefore);
  }

  console.log('\n[ 복습 탭의 약점 장부 ]');
  {
    /* 약점 낱말을 손으로 심는다. 시험 열 문항으로는 문턱(3)을 못 넘는
       낱말이 많아서, 「왜 약한지」가 뜨는 모양을 보려면 심어야 한다. */
    const ids = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}');
      const picked = Object.keys(p.weak || {}).slice(0, 2);
      const rv = JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}');
      p.weak = p.weak || {};
      // 하나는 시험에서만 틀린 낱말, 하나는 외웠다가 하루 만에 무너진 낱말
      if (picked[0]) {
        rv[picked[0]] = { box: 3, streak: 1, level: 1, due: '2026-01-02', promotedOn: '2026-01-01', lastSeen: '2026-01-01', seenAt: 1, rounds: 1, wrongCount: 0, vagueCount: 0, selfKnown: false };
        p.weak[picked[0]] = { quizWrong: 4, quizRight: 0, listen: 12, forgot: 0, fastDays: null, at: 10 };
      }
      if (picked[1]) {
        rv[picked[1]] = { box: 1, streak: 0, level: 0, due: '2026-01-02', promotedOn: '2026-01-01', lastSeen: '2026-01-02', seenAt: 2, rounds: 2, wrongCount: 1, vagueCount: 0, selfKnown: false };
        p.weak[picked[1]] = { quizWrong: 1, quizRight: 0, listen: 3, forgot: 2, fastDays: 1, at: 20 };
      }
      localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(p));
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
      return picked;
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const off2 = page.locator('.gate-offline');
    if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
    await goTab(page, '복습');
    await page.waitForTimeout(600);

    const card = page.locator('.wb-card');
    ok('약점 장부가 복습 탭에 뜬다', await card.count() === 1, `심은 낱말 ${ids.length}개`);
    const txt = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ');
    ok('시험 오답 수를 말한다', txt.includes('시험 오답'), txt.slice(0, 90));
    ok('외웠다가 틀린 횟수를 말한다', txt.includes('외웠다가'));

    /* ★ 금방 잊어버리는 낱말을 따로 말한다 ★
       틀린 횟수가 한 번이어도 어제 외운 게 오늘 무너졌으면 제일 위험하다.
       횟수로는 안 나오는 말이라 따로 적는다. */
    ok('★ 금방 잊는 낱말을 짚어 준다 ★', await page.locator('.wb-fast').count() > 0,
      await page.locator('.wb-fast').first().innerText().catch(() => '없음'));
    ok('왜 약한지가 낱말마다 붙는다', await page.locator('.wb-row .wb-why').count() > 0);
    ok('약한 것부터 외우러 가는 길이 있다', await page.locator('.wb-start').count() === 1,
      await page.locator('.wb-start').innerText().catch(() => ''));

    // 제일 약한 것이 맨 위 — 금방 잊은 낱말이 시험 네 번 틀린 낱말보다 위다
    const firstRow = await page.locator('.wb-row').first().getAttribute('data-weak');
    ok('제일 약한 것이 맨 위다', firstRow === ids[1], `${firstRow} (심은 둘째가 더 약함)`);
  }

  console.log('\n[ 듣기 — 바퀴마다 순서 섞기 ]');
  {
    await openListen(page, '자동 듣기');
    await page.waitForTimeout(700);

    /* ★ 방향도 섞을 수 있다 ★
       한 방향으로만 돌면 그 방향에만 익는다. 그리고 방향이 고정이면 다음
       장이 어느 쪽으로 올지 알고 듣는다. */
    ok('방향에 랜덤이 있다', await page.locator('.ls-dir[data-dir="mix"]').count() === 1);
    await page.locator('.ls-dir[data-dir="mix"]').click();
    await page.waitForTimeout(350);
    ok('고르면 켜진다',
      ((await page.locator('.ls-dir[data-dir="mix"]').getAttribute('class')) || '').includes('active'));
    ok('기기에 남는다',
      await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').listenDir) === 'mix');
    /* 랜덤은 두 방향이 다 나오니, 두 방향의 소리 칸이 다 있어야 한다 */
    ok('일본어 답 소리 칸이 있다', await page.locator('.ls-sayans').count() === 1);
    ok('한국어 뜻 소리 칸도 같이 있다', await page.locator('.ls-sayko').count() === 1);
    await page.locator('.ls-dir[data-dir="jp-ko"]').click();
    await page.waitForTimeout(350);
    ok('일본어 → 뜻으로 돌아오면 일본어 답 칸은 빠진다',
      await page.locator('.ls-sayans').count() === 0);

    /* ★ 한 줄에 한 옵션이 아니다 ★
       옵션 하나가 한 줄을 먹던 화면이다. 여기는 고르고 바로 시작하는
       자리라, 고르는 품이 듣는 시간보다 길면 안 쓰게 된다. */
    const opts = await page.locator('.ls-opts .toggle-pill').all();
    ok('켜고 끄는 칸이 두 개씩 놓인다', opts.length >= 4, `${opts.length}개`);
    const xs = [];
    for (const o of opts) { const b2 = await o.boundingBox(); xs.push(Math.round(b2.x)); }
    ok('★ 한 줄에 두 개가 나란히 선다 ★', new Set(xs).size === 2, [...new Set(xs)].join(' / '));
    ok('방향도 한 줄에 셋', new Set(await Promise.all(
      (await page.locator('.ls-dir').all()).map(async (e) => Math.round((await e.boundingBox()).y)),
    )).size === 1);

    const row = page.locator('.ls-reshuffle');
    ok('바퀴마다 섞는 칸이 있다', await row.count() === 1);
    ok('기본은 켜져 있다 — 차례를 외우는 걸 막는 게 기본이어야 한다',
      await row.getAttribute('aria-pressed') === 'true');

    await row.click();
    await page.waitForTimeout(300);
    ok('끌 수 있다', await row.getAttribute('aria-pressed') === 'false');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').listenReshuffle);
    ok('끈 것이 기기에 남는다', saved === false, String(saved));
    await row.click();
    await page.waitForTimeout(300);
    ok('다시 켤 수 있다', await row.getAttribute('aria-pressed') === 'true');

    /* 반복을 끄면 섞을 일이 없다 — 한 바퀴만 도는 판에 「바퀴마다」는 거짓말이다 */
    const loop = page.locator('.ls-loop');
    await loop.click();
    await page.waitForTimeout(300);
    ok('반복을 끄면 이 칸이 사라진다', await page.locator('.ls-reshuffle').count() === 0);
    await loop.click();
    await page.waitForTimeout(300);
    ok('반복을 켜면 돌아온다', await page.locator('.ls-reshuffle').count() === 1);
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
