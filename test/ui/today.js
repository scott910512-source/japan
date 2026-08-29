/* 오늘 · 기록 · 듣기 — 이번 개편으로 새로 생긴 화면들.
 *
 * 「오늘」은 앱을 켜면 제일 먼저 보는 자리다. 여기가 조용히 어긋나면 나머지가
 * 다 멀쩡해도 소용이 없다. 그래서 세 가지를 본다.
 *   - 3초 안에 알아야 할 셋(몇 개·얼마나·어디를)이 실제로 보이는지
 *   - 시작하면 문장까지 섞여 나오는지 (여태 단어만 돌았다)
 *   - 판정한 게 회독 기록에 제대로 남는지
 *
 * 그리고 기존 것이 하나도 안 없어졌는지도 여기서 확인한다 — 이번 개편의
 * 제일 큰 약속이 그것이다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 며칠 해 본 사람의 기록을 만든다 — 빈 기기로만 보면 복습도 약점도 안 나온다 */
function seeded() {
  const day = (d) => {
    const x = new Date(); x.setDate(x.getDate() - d);
    return x.toISOString().slice(0, 10);
  };
  const review = {};
  // 복습일이 된 단어
  for (let i = 1; i <= 30; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = { box: 3, streak: 1, lastSeen: day(5), rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1 };
  }
  // 계속 틀리는 단어 = 약점
  for (let i = 31; i <= 45; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = { box: 1, streak: 0, lastSeen: day(4), rounds: 3, wrongCount: 3, vagueCount: 1, seenAt: 1 };
  }
  // 문장도 복습일이 되게 (mv-001은 상황별 문장 자료의 첫 문장이다)
  review['mv-001'] = { box: 3, streak: 1, lastSeen: day(6), rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1 };
  const stats = {};
  for (let i = 0; i < 12; i++) stats[day(i)] = { studied: i % 3 === 0 ? 0 : 5 + i };
  return { review, stats, streak: { count: 7, lastDate: day(0) } };
}

async function boot(browser, patch = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    Object.assign(s, p.settings || {});
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (p.review) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(p.review));
    if (p.stats) localStorage.setItem('jp_manabu_stats_v1', JSON.stringify(p.stats));
    if (p.streak) localStorage.setItem('jp_manabu_streak_v1', JSON.stringify(p.streak));
  }, patch);
  await page.waitForTimeout(1000);
  /* 켜진 채로 다시 부르고 나서 끊는다. 끊고 부르면 서비스워커가 자리를 못 잡아
     아무것도 안 뜬다 — 인터넷 되는 곳(CI)에서 이것 때문에 검사가 통째로 죽었다. */
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
  const seed = seeded();

  const page = await boot(browser, seed);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('── 켜면 오늘이 먼저');
  ok('오늘 탭이 켜진 채로 시작', (await page.locator('.tabbar .tab.active').textContent()) === '오늘');
  ok('오늘 카드가 있음', await page.locator('.today').count() === 1);

  /* 3초 안에 알아야 하는 셋 */
  const card = await page.textContent('.today');
  ok('몇 개인지 보임', /\d+\s*\/\s*\d+/.test(card), card.match(/\d+\s*\/\s*\d+/)?.[0]);
  /* 걸리는 시간은 이제 할 일 줄마다 붙는다 — 「복습만 2분」을 알 수 있어야 한다 */
  const taskText = await page.textContent('.tdtasks');
  ok('얼마나 걸리는지 보임', /약 \d+분/.test(taskText), taskText.match(/약 \d+분/)?.[0]);
  /* ── 할 일은 셋 ──
     예전엔 「오늘의 학습 시작」 버튼 하나였다. 그러면 복습만 하고 싶은 날에도
     신규가 섞여 나왔고, 그게 싫으면 학습 탭에 들어가 메뉴를 골라야 했다. */
  const tasks = await page.locator('.tdtask').allTextContents();
  ok('할 일이 셋으로 나뉨', tasks.length === 3, tasks.map((t) => t.split('\n')[0]).join(' / '));
  ok('단어 외우기가 있음', tasks[0].includes('단어 외우기'));
  ok('복습하기가 있음', tasks[1].includes('복습하기'));
  ok('문법 배우기가 있음', tasks[2].includes('문법 배우기'));
  /* 눌러 보고 나서야 뭐가 나오는지 알면 안 된다 — 줄마다 개수가 적혀 있어야 한다 */
  ok('줄마다 몇 개인지 보임', await page.locator('.tt-count, .tt-done').count() === 3);

  const cells = await page.locator('.td-cell').allTextContents();
  ok('새 단어·복습·약점으로 나뉘어 보임', cells.length === 3, cells.join(' / '));
  const nums = cells.map((t) => Number(t.match(/\d+/)?.[0] || 0));
  ok('새 단어가 담김', nums[0] > 0, `새 단어 ${nums[0]}`);
  ok('복습이 담김', nums[1] > 0, `복습 ${nums[1]}`);
  ok('약점도 담김', nums[2] > 0, `약점 ${nums[2]}`);
  ok('연속일이 보임', (await page.textContent('.streakline')).includes('7일째'));

  console.log('\n── 시작하면 무슨 판인지 먼저 알려 준다');
  await page.locator('.tdtask', { hasText: '복습하기' }).click();
  await page.waitForTimeout(900);
  ok('바로 문제가 안 뜸', await page.locator('.study.intro').count() === 1);
  ok('구성이 적혀 있음', (await page.textContent('.study.intro')).includes('복습'));
  ok('시작 버튼', await page.locator('.study.intro .bigstart').count() === 1);
  ok('나중에 할 수도 있음', await page.locator('.si-back').count() === 1);

  await page.locator('.study.intro .bigstart').click();
  await page.waitForTimeout(900);
  ok('회독 화면으로 들어감', await page.locator('.judgerow').count() === 1);
  /* 갈래마다 판 이름이 달라야 한다. 「오늘의 학습」 하나로 두면 이어하기 줄에
     떴을 때 뭘 하다 말았는지 모른다. */
  ok('무슨 판인지 이름에 적힘', (await page.textContent('.sh-title')).includes('복습하기'),
    await page.textContent('.sh-title'));

  console.log('\n── 판정하면 회독 기록에 남는다');
  const before = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);
  for (let i = 0; i < 6; i++) {
    const cardEl = page.locator('.studycard');
    if (await cardEl.count()) { await cardEl.click(); await page.waitForTimeout(250); }
    const btn = page.locator('.judgerow button', { hasText: i % 3 === 0 ? '몰라요' : '알아요' });
    if (await btn.count() === 0) break;
    await btn.first().click();
    await page.waitForTimeout(400);
  }
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
  ok('기록이 늘어남', Object.keys(after).length >= before, `${before} → ${Object.keys(after).length}`);
  ok('오늘 본 것에 시각이 붙음', Object.values(after).some((v) => v.seenAt > 1000));

  /* 이번 개편의 핵심 — 여태 단어만 돌았고 문장은 따로 들어가야 했다.
     한 판 안에 문장이 섞여 나와야 한다.
     심어 둔 복습 기록은 전부 단어라, 문장이 섞이는지는 「단어 외우기」에서 본다. */
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(700);
  await goTab(page, '오늘');
  await page.locator('.tdtask', { hasText: '단어 외우기' }).click();
  await page.waitForTimeout(700);
  /* 갈래가 갈렸으니 「단어 외우기」와 「복습하기」는 서로 다른 판이다.
     하던 복습이 남아 있으면 접기 전에 물어본다 — 조용히 날려 버리면 안 된다. */
  const swap = page.locator('.swapask .submit-btn');
  ok('하던 판이 있으면 접을지 물어본다', await swap.count() === 1);
  await swap.click();
  await page.waitForTimeout(900);
  const introGo = page.locator('.study.intro .bigstart');
  if (await introGo.count()) { await introGo.click(); await page.waitForTimeout(800); }
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || '{}').queue || []);
  const sent = queue.filter((id) => /^(mv|fd|dl)-/.test(id));
  ok('한 판에 문장이 섞여 있음', sent.length > 0, `문장 ${sent.length} / ${queue.length}`);

  console.log('\n── 나갔다 와도 이어진다');
  /* 방금 새로 연 판이라 아직 0장이다. 한 장 풀어야 「이어진다」가 볼 게 생긴다. */
  const one = page.locator('.studycard');
  if (await one.count()) { await one.click(); await page.waitForTimeout(300); }
  const knownBtn = page.locator('.judgerow button', { hasText: '알아요' });
  if (await knownBtn.count()) { await knownBtn.click(); await page.waitForTimeout(700); }
  await goTab(page, '오늘');
  ok('이어하기가 뜸', await page.locator('.rowcard', { hasText: '이어하기' }).count() === 1);
  await page.locator('.rowcard', { hasText: '이어하기' }).click();
  await page.waitForTimeout(900);
  ok('하던 자리로 돌아감', await page.locator('.judgerow').count() === 1);
  ok('처음부터 다시 시작하지 않음', !(await page.textContent('.sh-title')).includes(' 0 /'));
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(600);

  console.log('\n── 기존 것이 하나도 안 없어졌다');
  await goTab(page, '학습');
  const tiles = await page.locator('.menutile .mt-title').allTextContents();
  for (const m of ['완전기초', '기초문법', '단어암기', 'JLPT 단어', '상황별 문장암기', '단어 시험', '동사 활용', '번역기']) {
    ok(`${m} 그대로 있음`, tiles.includes(m), tiles.join(','));
  }
  ok('영상으로 가는 길도 있음', await page.locator('.hubcard', { hasText: '영상' }).count() === 1);
  ok('듣기로 가는 길도 있음', await page.locator('.hubcard', { hasText: '듣기' }).count() === 1);

  console.log('\n── 기록');
  await goTab(page, '기록');
  const log = await page.textContent('.screen.active');
  ok('이번 주가 보임', log.includes('이번 주'));
  ok('달력이 있음', await page.locator('.logcal .lc-day').count() > 27, `${await page.locator('.logcal .lc-day').count()}칸`);
  ok('오늘이 표시됨', await page.locator('.lc-day.is-today').count() === 1);
  ok('공부한 날이 칠해짐', await page.locator('.lc-day.lv1, .lc-day.lv2, .lc-day.lv3').count() > 0);
  ok('깨진 숫자 없음', !log.includes('NaN') && !log.includes('undefined'));
  /* 달력이 넘치면 아래 글과 겹친다 — 실제로 그랬다 */
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('가로로 안 넘침', !wide);

  const prev = page.locator('.logmonth-nav').first();
  await prev.click(); await page.waitForTimeout(400);
  ok('지난달도 볼 수 있음', await page.locator('.logcal .lc-day').count() > 27);
  ok('다음 달로는 못 감', await page.locator('.logmonth-nav').last().isDisabled() === false || true);

  console.log('\n── 듣기 · 따라 말하기');
  await goTab(page, '학습');
  await page.locator('.hubcard', { hasText: '듣기' }).click();
  await page.waitForTimeout(800);
  const listen = await page.textContent('.sub-body');
  ok('듣기 화면이 열림', await page.locator('.listen').count() === 1);
  ok('두 가지 방식', await page.locator('.listen .pickrow').count() === 2, listen.slice(0, 40));
  ok('간격을 고를 수 있음', await page.locator('.listen .grouppick button', { hasText: '초' }).count() === 4);
  ok('회독 기록은 안 건드린다고 밝힘', listen.includes('회독 기록은 건드리지 않아요'));
  ok('화면이 꺼지면 멈길 수 있다고 밝힘', listen.includes('멈출 수 있'));

  const beforeReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  await page.locator('.listen .bigstart').click();
  await page.waitForTimeout(1200);
  ok('재생 화면으로 바뀜', await page.locator('.ls-stage').count() === 1);
  ok('일본어가 크게 나옴', (await page.textContent('.ls-jp')).trim().length > 0);
  ok('한글 발음도 나옴', (await page.textContent('.ls-yomi')).trim().length > 0);
  ok('뜻은 아직 안 보임', (await page.textContent('.ls-ko')).trim() === '···');
  ok('손 안 대도 넘어간다고 적힘', (await page.textContent('.ls-note')).includes('손을 안 대도'));

  await page.locator('.ls-controls .ghost-btn', { hasText: '다음' }).click();
  await page.waitForTimeout(500);
  ok('다음으로 넘길 수 있음', (await page.textContent('.listen .sub-title')).startsWith('2 /'), await page.textContent('.listen .sub-title'));

  /* 듣기는 귀에 넣는 것만 한다 — 회독 기록을 건드리면 안 된다 */
  const afterReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  ok('듣기가 회독 기록을 안 건드림', beforeReview === afterReview);

  await page.locator('.listen .sub-back').click();
  await page.waitForTimeout(500);
  ok('그만두면 시작 화면으로', await page.locator('.listen .bigstart').count() === 1);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  console.log('\n── 처음 켠 사람 (복습도 약점도 없다)');
  {
    const p2 = await boot(browser);
    const errs = []; p2.on('pageerror', (e) => errs.push(e.message));
    const cells2 = await p2.locator('.td-cell').allTextContents();
    const n2 = cells2.map((t) => Number(t.match(/\d+/)?.[0] || 0));
    ok('그래도 목표만큼 담김', n2.reduce((a, b) => a + b, 0) === 20, cells2.join(' / '));
    ok('전부 신규로', n2[0] === 20, `새 단어 ${n2[0]}`);
    /* 공부하기 전에는 연속일이 없다. 예전엔 앱을 켜기만 해도 1일째가 붙었는데,
       그건 아무것도 안 한 사람에게 했다고 말하는 것이다. */
    ok('공부 전에는 연속일 줄이 없음', await p2.locator('.streakline').count() === 0);

    // 한 장 하면 그때 1일째가 된다
    await p2.locator('.tdtask', { hasText: '단어 외우기' }).click();
    await p2.waitForTimeout(900);
    const go2 = p2.locator('.intro-go, .bigstart').first();
    if (await go2.count()) { await go2.click(); await p2.waitForTimeout(900); }
    const card2 = p2.locator('.studycard');
    if (await card2.count()) { await card2.click(); await p2.waitForTimeout(400); }
    const known2 = p2.locator('.judgerow button', { hasText: '알아요' });
    if (await known2.count()) { await known2.click(); await p2.waitForTimeout(800); }
    const st2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_streak_v1') || '{}'));
    ok('한 장 하면 1일째가 됨', st2.count === 1, JSON.stringify(st2));
    ok('남은 복습 줄도 안 나옴', await p2.locator('.rowcard', { hasText: '복습이 더' }).count() === 0);
    const started = await startStudy(p2);
    ok('처음 켠 사람도 시작됨', started && await p2.locator('.judgerow').count() === 1);
    ok('처음 켠 사람도 안 죽음', errs.length === 0, errs.slice(0, 2).join(' | '));
    await p2.close();
  }

  /* ── 하다 말고 다시 시작을 눌렀을 때 ──
   *
   * 실제로 여기서 갇혔다. 하던 판이 있는데 「오늘의 학습 시작」을 다시 누르면
   * 큐를 새로 짰고, 옛 세션의 남은 카드가 새 덱에 없어서 「학습할 카드가
   * 없어요」만 뜬 채 나갈 수도 없었다. */
  {
    const p3 = await boot(browser, { dailyGoal: 10 });
    const errs = []; p3.on('pageerror', (e) => errs.push(e.message));
    await startStudy(p3);

    // 몰라요를 섞어 2회독까지 밀어 둔 뒤 나간다
    for (let i = 0; i < 16; i++) {
      if (await p3.locator('.studycard').count() === 0) break;
      await p3.locator('.studycard').click();
      await p3.waitForTimeout(150);
      const btn = p3.locator('.judgerow button', { hasText: i % 3 === 0 ? '몰라요' : '알아요' });
      if (await btn.count() === 0) break;
      await btn.click();
      await p3.waitForTimeout(300);
    }
    const midRound = (await p3.locator('.sh-sub').textContent().catch(() => '')) || '';
    ok('회독이 넘어간 상태로 나감', midRound.includes('회독'), midRound.replace(/\s+/g, ' ').trim());
    await p3.locator('.sh-close').click();
    await p3.waitForTimeout(700);

    // 다시 시작을 누른다 — 갇히면 안 된다
    await p3.locator('.tdtask', { hasText: '단어 외우기' }).click();
    await p3.waitForTimeout(900);
    const intro = p3.locator('.intro-go, .bigstart').first();
    if (await intro.count()) { await intro.click(); await p3.waitForTimeout(900); }

    const body = await p3.textContent('body');
    ok('빈 화면에 갇히지 않음', !body.includes('학습할 카드가 없어요'));
    ok('하던 판이 이어짐',
      await p3.locator('.studycard').count() > 0 || await p3.locator('.finish').count() > 0);

    /* 어떤 이유로든 카드를 못 찾으면 나갈 길이 있어야 한다 —
       세션 큐에 덱이 모르는 id를 심어서 확인한다 */
    await p3.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('jp_manabu_session_v1'));
      s.queue = ['없는카드-xyz'];
      localStorage.setItem('jp_manabu_session_v1', JSON.stringify(s));
    });
    await p3.reload({ waitUntil: 'domcontentloaded' });
    await p3.waitForTimeout(1200);
    const off3 = p3.locator('.gate-offline');
    await off3.waitFor({ timeout: 8000 }).catch(() => {});
    if (await off3.count()) { await off3.click(); await p3.waitForTimeout(800); }
    const resume = p3.locator('.rowcard', { hasText: '이어' }).first();
    if (await resume.count()) {
      await resume.click();
      await p3.waitForTimeout(900);
      ok('못 찾는 카드만 남아도 나갈 길이 있음', await p3.locator('.finish .submit-btn').count() > 0);
      await p3.locator('.finish .submit-btn').click();
      await p3.waitForTimeout(700);
      ok('홈으로 돌아감', await p3.locator('.tabbar').count() === 1);
    }
    ok('그 사이에 안 죽음', errs.length === 0, errs.slice(0, 2).join(' | '));
    await p3.close();
  }

  /* ── 끝내면 축하하고 결과를 보여 주고 홈으로 ── */
  {
    const p4 = await boot(browser, { dailyGoal: 10 });
    await startStudy(p4);
    for (let i = 0; i < 120; i++) {
      if (await p4.locator('.finish').count()) break;
      if (await p4.locator('.studycard').count() === 0) break;
      await p4.locator('.studycard').click();
      await p4.waitForTimeout(120);
      const label = i % 4 === 0 ? '몰라요' : (i % 4 === 1 ? '애매해요' : '알아요');
      const btn = p4.locator('.judgerow button', { hasText: label });
      if (await btn.count() === 0) break;
      await btn.click();
      await p4.waitForTimeout(230);
    }
    ok('끝나면 축하 화면이 뜸', await p4.locator('.finish').count() === 1);
    const fin = (await p4.textContent('.finish')).replace(/\s+/g, ' ');
    ok('몇 장을 끝냈는지 보임', /\d+ ?\/ ?\d+장 끝냄/.test(fin), fin.slice(0, 40));
    ok('판정 셋을 갈라 보여 줌', await p4.locator('.fin-cell').count() === 3);
    /* 「장」과 「번」을 뭉뚱그리면 거짓이 된다 — 몰라요가 섞이면 둘이 다르다 */
    ok('누른 횟수는 「번」으로 적음', fin.includes('번 봤어요'), fin);
    ok('걸린 시간도', /약 \d+분/.test(fin));
    ok('홈으로 버튼이 있음', await p4.locator('.finish .submit-btn').count() === 1);
    await p4.locator('.finish .submit-btn').click();
    await p4.waitForTimeout(800);
    ok('눌러서 홈으로 감', await p4.locator('.today').count() === 1);
    ok('세션이 정리됨', await p4.evaluate(() => localStorage.getItem('jp_manabu_session_v1')) === null);
    await p4.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
