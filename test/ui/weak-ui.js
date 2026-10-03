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
    /* 시작 버튼은 .bigstart다 — .submit-btn으로 찾으면 30초를 기다리다 죽는다.
       quiz-flow가 이미 글자로 찾고 있어서 같은 방식을 쓴다. */
    await page.locator('button', { hasText: '시험 시작' }).first().click()
      .catch(async () => { await page.locator('.bigstart, .submit-btn').first().click(); });
    await page.waitForTimeout(900);
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

    /* ★ 켠 채로 새로 불러온 뒤에 끊는다 ★
       심어 둔 기록은 앱이 켜질 때 한 번만 읽히니 새로 불러와야 한다. 그런데
       끊긴 채로 불러오면 서비스워커가 아직 자리를 안 잡았을 때 아무것도 안
       뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에 탭바를 30초 기다리다
       죽었다. 맨 위에서 한 것과 같은 차례로 간다. */
    await page.context().setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.context().setOffline(true);
    const off2 = page.locator('.gate-offline');
    await off2.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
    await page.locator('.tabbar').waitFor({ timeout: 20000 });
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
    await openListen(page, 'auto');
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

  console.log('\n[ 홈이 아닌 자리에서는 새 버전으로 안 갈아끼운다 ]');
  {
    /* ★ 「처음 들어가면 한 번 홈으로 튕긴다」 ★
       갈아끼우기는 곧 새로고침이고, 이 앱은 주소가 없다 — 어느 탭에 있었든
       새로고침하면 홈이다. 여태 이 표시는 판정하는 자리만 세워서, 학습 탭을
       눌러 둔 사람은 그대로 튕겼다. 한 배포에 한 번씩 꼭 일어났다. */
    const busy = () => page.evaluate(() => (window.__jpBusy ? window.__jpBusy() : []));
    await page.locator('.subscreen.open .sub-back:visible, .sh-close:visible').first().click()
      .catch(() => {});
    await page.waitForTimeout(500);
    await goTab(page, '홈');
    await page.waitForTimeout(500);
    ok('★ 홈에서는 안 미룬다 — 안 그러면 영영 갱신이 안 된다 ★',
      (await busy()).length === 0, (await busy()).join() || '없음');

    for (const tab of ['학습', '복습', '내 학습']) {
      await goTab(page, tab);
      await page.waitForTimeout(400);
      ok(`★ ${tab} 탭에서는 미룬다 ★`, (await busy()).includes('tab'),
        (await busy()).join() || '없음');
    }

    await goTab(page, '홈');
    await page.waitForTimeout(400);
    ok('홈으로 돌아오면 표시가 내려간다', (await busy()).length === 0,
      (await busy()).join() || '없음');
  }

  console.log('\n[ ★ 듣다가 안 뗀 낱말이 장부에 쌓인다 ★ ]');
  {
    /* 여태 듣기만 해서는 약점이 0이었다. 들은 횟수는 「얼마나 만났나」지
       「되나 안 되나」가 아니라서 신호로 안 셌다 — 그래서 달리면서 한
       시간을 들어도 아무것도 안 남았다.
       세 바퀴째에도 「다 외웠어요」에 손이 안 간 낱말은 다르다. 그건 사람이
       직접 낸 신호다. 첫 바퀴와 둘째 바퀴는 넘긴다. */
    await page.evaluate(() => {
      const s2 = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
      s2.listenGap = 0; s2.listenCount = 10; s2.listenScope = 'kiju';
      s2.listenOrder = 'block'; s2.listenLoop = true; s2.listenSayKo = false;
      s2.listenDropped = []; s2.listenBeat = false;
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s2));
      const p2 = JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}');
      p2.weak = {};
      localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(p2));
    });
    /* ★ 켠 채로 새로 불러온 뒤에 끊는다 ★
       끊긴 채로 불러오면 서비스워커가 아직 자리를 안 잡았을 때 아무것도 안
       뜬다 — 인터넷이 되는 곳(CI)에서 탭바를 30초 기다리다 죽는다. 이 파일
       위쪽에서 한 번 겪고 고친 자리인데 새 묶음에 또 썼다. */
    await page.context().setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.context().setOffline(true);
    const off3 = page.locator('.gate-offline');
    await off3.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off3.count()) { await off3.click(); await page.waitForTimeout(700); }
    await page.locator('.tabbar').waitFor({ timeout: 20000 });
    await openListen(page, 'auto');
    await page.waitForTimeout(800);
    await page.locator('.ls-go').click();
    await page.waitForTimeout(400);
    await page.locator('.ls-ask .submit-btn').click();
    await page.waitForTimeout(900);

    const book = () => page.evaluate(() => {
      const w = (JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}')).weak || {};
      const v = Object.values(w);
      return {
        withStuck: v.filter((r) => (r.stuck || 0) > 0).length,
        maxStuck: Math.max(0, ...v.map((r) => r.stuck || 0)),
        maxListen: Math.max(0, ...v.map((r) => r.listen || 0)),
      };
    });

    /* 판을 세 장으로 줄인다 — 바퀴가 빨리 돈다. 검사가 1분을 기다리면
       아무도 안 돌린다. */
    for (let i = 0; i < 7; i++) {
      await page.locator('.ls-know').click();
      await page.waitForTimeout(320);
    }

    const first = await book();
    ok('★ 첫 바퀴에는 아직 안 쌓인다 ★', first.withStuck === 0, JSON.stringify(first));
    ok('그래도 들은 횟수는 세어진다', first.maxListen > 0, `${first.maxListen}번`);

    let bk = first;
    for (let i = 0; i < 24 && bk.maxStuck < 2; i++) {
      await page.waitForTimeout(2500);
      bk = await book();
    }
    ok('★ 세 바퀴째부터 쌓인다 ★', bk.maxStuck >= 1, JSON.stringify(bk));
    ok('남은 낱말에 다 쌓인다', bk.withStuck >= 2, `${bk.withStuck}개`);
    ok('바퀴 수가 들은 횟수보다 적다 — 앞 두 바퀴를 넘겼으니까',
      bk.maxStuck < bk.maxListen, `바퀴 ${bk.maxStuck} · 들은 ${bk.maxListen}`);

    /* 「다 외웠어요」를 누르면 그 낱말의 바퀴 수가 0이 된다. 안 그러면
       방금 외운 낱말이 약점 목록 맨 위에 그대로 남는다. */
    const was = bk.withStuck;
    await page.locator('.ls-know').click();
    await page.waitForTimeout(700);
    const now = await book();
    ok('★ 「다 외웠어요」를 누르면 그 낱말은 0으로 ★', now.withStuck === was - 1,
      `${was} → ${now.withStuck}`);
  }

  console.log('\n[ 달리기 박자 ]');
  {
    /* ★ 달릴 때 귀는 두 가지를 받는다 ★
       외우려는 일본어와 발을 맞출 박자다. 둘을 다른 앱으로 틀면 한쪽이
       다른 쪽을 끊는다(iOS가 특히 그렇다). 그래서 한 화면에서 같이 낸다. */
    /* 앞 묶음이 탭을 돌다 홈에서 끝난다 — 듣기 화면을 다시 연다 */
    await openListen(page, 'auto');
    await page.waitForTimeout(800);

    const beat = page.locator('.ls-beattoggle');
    ok('박자 칸이 있다', await beat.count() === 1);
    ok('기본은 꺼져 있다 — 달리는 사람만 쓰는 자리다',
      await beat.getAttribute('aria-pressed') === 'false');
    ok('꺼져 있으면 빠르기 칸도 없다', await page.locator('.ls-bpms').count() === 0);

    await beat.click();
    await page.waitForTimeout(300);
    ok('켜면 빠르기를 고를 수 있다', await page.locator('.ls-bpms button').count() === 3,
      (await page.locator('.ls-bpms button').allTextContents()).join(' · '));
    ok('달리기 피치 셋', (await page.locator('.ls-bpms button').allTextContents()).join(',') === '160,170,180');

    await page.locator('.ls-bpms button[data-bpm="180"]').click();
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => {
      const s2 = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
      return `${s2.listenBeat}/${s2.listenBpm}`;
    });
    ok('기기에 남는다', saved === 'true/180', saved);

    /* ★ 실제로 소리를 거는지, 그리고 고른 간격으로 거는지 ★
       화면에 칸만 있고 안 울리면 달리다가 알게 된다. 세는 것만으로는
       모자라서 예약한 시각을 그대로 적어 둔다 — 「멈췄다가 와다다다」는
       수가 아니라 간격이 말해 준다. */
    await page.evaluate(() => {
      window.__ticks = 0;
      window.__when = [];
      const P = (window.AudioContext || window.webkitAudioContext).prototype;
      const orig = P.createOscillator;
      P.createOscillator = function (...a) {
        window.__ticks += 1;
        const o = orig.apply(this, a);
        const st = o.start.bind(o);
        o.start = (t) => { window.__when.push(t); return st(t); };
        return o;
      };
    });
    await page.locator('.ls-go').click();
    await page.waitForTimeout(500);
    await page.locator('.ls-ask .submit-btn').click();
    await page.waitForTimeout(3000);
    const ticks = await page.evaluate(() => window.__ticks);
    ok('★ 재생하면 박자가 울린다 ★', ticks > 5, `${ticks}번`);

    /* ★ 박자가 고른가 ★
     *
     * 「좀 엇나가고, 멈췄다가 와다다다 나온다」 — 두 가지가 겹쳐 있었다.
     *
     *   · 듣기 화면이 박자 효과의 의존성에 run을 두고 있었다. run은 장이
     *     넘어갈 때마다 새 객체라, 몇 초마다 박자를 멈췄다 다시 켜는 셈이었다.
     *     그때마다 첫 박이 지금으로 당겨져서 박자가 통째로 어긋난다.
     *   · 멈출 때 타이머만 끄고 이미 예약해 둔 소리는 그대로 뒀다. 큐에
     *     1.5초치가 남아 있는데 다시 시작하면 새 예약이 겹쳐 쏟아진다.
     *
     * 수를 세는 것으로는 둘 다 못 잡는다. 간격을 재야 보인다. */
    const spacing = async () => page.evaluate(() => {
      const w = [...(window.__when || [])].sort((a, b) => a - b);
      const gaps = w.slice(1).map((t, i) => t - w[i]);
      return { n: w.length, gaps };
    });
    const sp = await spacing();
    const want = 60 / 180;
    const off2 = sp.gaps.filter((g) => Math.abs(g - want) > 0.005);
    ok('★ 간격이 고르다 — 엇나가지 않는다 ★', off2.length === 0,
      `${sp.n}박 · 어긋난 간격 ${off2.length}개 (있어야 할 간격 ${want.toFixed(4)}초)`);
    ok('겹쳐서 쏟아지지 않는다 — 아주 짧은 간격이 없다',
      sp.gaps.every((g) => g > want * 0.5),
      `제일 짧은 간격 ${Math.min(...sp.gaps).toFixed(4)}초`);

    /* 빠르기를 바꿔도 두 빠르기가 같이 나면 안 된다. 바꾸는 순간 걸어 둔
       옛 빠르기의 소리를 거둬들여야 한다. */
    await page.evaluate(() => { window.__when = []; });
    await page.locator('.ls-beat').click();   // 180 → 끄기
    await page.waitForTimeout(200);
    await page.locator('.ls-beat').click();   // 끄기 → 160
    await page.waitForTimeout(3000);
    const sp2 = await spacing();
    const want2 = 60 / 160;
    const off3 = sp2.gaps.filter((g) => Math.abs(g - want2) > 0.005);
    ok('★ 빠르기를 바꿔도 고르다 ★', sp2.n > 3 && off3.length === 0,
      `${sp2.n}박 · 어긋난 간격 ${off3.length}개 (160이면 ${want2.toFixed(4)}초)`);

    /* 달리는 중에는 화면을 못 본다 — 한 자리를 눌러 160 → 170 → 180 → 끄기 */
    const live = page.locator('.ls-beat');
    ok('재생 화면에 큰 버튼이 있다', await live.count() === 1,
      (await live.innerText()).trim());
    ok('지금 빠르기가 적혀 있다', /\d{3}/.test(await live.innerText()),
      (await live.innerText()).trim());
    const box = await live.boundingBox();
    ok('안 보고 눌러도 맞게 크다', box && box.height >= 44 && box.width > 200,
      box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
    /* 위에서 빠르기를 돌려 봤으니 지금 자리가 어디인지 모른다. 180으로
       맞춰 두고 이어 본다 — 검사가 앞 묶음의 끝 상태에 기대면, 앞을 한 줄
       고칠 때마다 뒤가 같이 깨진다. */
    for (let i = 0; i < 4; i++) {
      if ((await live.innerText()).includes('180')) break;
      await live.click();
      await page.waitForTimeout(250);
    }
    ok('180으로 맞춰 둔다', (await live.innerText()).includes('180'),
      (await live.innerText()).trim());

    await live.click();
    await page.waitForTimeout(300);
    ok('★ 눌러서 끌 수 있다 ★', (await live.innerText()).includes('꺼짐'),
      (await live.innerText()).trim());

    const before = await page.evaluate(() => window.__ticks);
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => window.__ticks);
    ok('끄면 더 안 울린다', after === before, `${after - before}번 더`);

    await live.click();
    await page.waitForTimeout(300);
    ok('다시 켜면 160부터', (await live.innerText()).includes('160'),
      (await live.innerText()).trim());

    /* 멈춤을 누르면 박자도 멈춘다 — 신발 끈 묶는 동안 박자만 계속 가면
       그게 더 급하다. */
    await page.locator('.ls-pause').click();
    await page.waitForTimeout(400);
    const p1 = await page.evaluate(() => window.__ticks);
    await page.waitForTimeout(1800);
    const p2 = await page.evaluate(() => window.__ticks);
    ok('★ 잠깐 멈춤에 박자도 멈춘다 ★', p2 === p1, `${p2 - p1}번 더`);
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
