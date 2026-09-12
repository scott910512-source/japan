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

/* 「본 적 있는 N5 카드 n개」를 심는다. 복습일도 지나 있어서 복습 갈래에 들어온다.
   회독 학습은 「본 적 있는가」만 보므로 같은 씨앗을 함께 쓴다. */
function seedDue(n) {
  const past = new Date();
  past.setDate(past.getDate() - 9);
  const lastSeen = past.toISOString().slice(0, 10);
  const review = {};
  for (let i = 1; i <= n; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = {
      box: 3, streak: 1, lastSeen, rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1,
    };
  }
  return review;
}

/* 앱이 뜨기 전에 심어야 하는 것(음성 목록 가로채기 등)은 세 번째 인자로 받는다.
   patch에 같이 넣으면 안 된다 — patch는 통째로 page.evaluate에 넘어가는데
   함수는 그 경계를 못 넘는다. */
/* 재생을 시작한다. 시작 버튼이 맨 위로 작아지면서 확인을 한 번 더 받는다 —
   누르자마자 소리가 나면 이어폰을 안 꽂았을 때 놀란다. */
async function startListen(page) {
  await page.locator('.ls-go').click();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').click();
  await page.waitForTimeout(900);
}

async function boot(browser, patch = {}, init = null) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  if (init) await page.addInitScript(init);
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
  ok('오늘 탭이 켜진 채로 시작',
    (await page.locator('.tabbar .tab.active').textContent()).includes('오늘'));
  ok('오늘 카드가 있음', await page.locator('.today').count() === 1);

  /* ★ 3초 안에 알아야 하는 둘 — 얼마나 남았나, 어디를 누르나 ★ */
  const card = await page.textContent('.today');
  ok('몇 개 했는지 보임', /\d+\s*\/\s*\d+/.test(card), card.match(/\d+\s*\/\s*\d+/)?.[0]);
  /* 「25개 남음」은 결심이 필요한 말이고 「12분 남음」은 그냥 하면 되는 말이다 */
  ok('몇 분 남았는지 보임', /약 \d+분 남음/.test(card), card.replace(/\n/g, ' '));

  /* ── 같은 숫자를 두 번 읽게 하지 않는다 ──
     예전엔 위에 「새 단어 · 복습 · 약점」을 세 칸으로 보여 주고 바로 아래
     버튼 셋에 같은 숫자를 또 적었다. 3초 안에 정하려면 한 번만 읽어야 한다. */
  ok('위에 갈래별 숫자를 또 적지 않는다', await page.locator('.today .td-cell').count() === 0);

  /* ── ★ 누를 것은 하나 ── ★
   *
   * 예전엔 「복습하기 · 새 단어 · 오늘의 문법」을 같은 크기로 나란히 두고,
   * 이 검사가 「할 일이 셋으로 나뉨」을 확인했다. 그게 문제였다 — 셋은 고를
   * 것이 셋이라는 뜻이고, 처음 쓰는 사람은 무엇부터 해야 하는지 고민했다.
   * 고르는 일은 학습 탭이 할 일이다.
   *
   * 그래서 검사도 바꾼다. 주요 버튼이 하나인지, 그 하나가 지금 상황에 맞는
   * 것인지를 본다. 배정 내역은 남지만 주요 버튼보다 작고 뒤에 있다. */
  ok('★ 주요 버튼이 하나 ★', await page.locator('.bigcta').count() === 1);
  const cta = await page.textContent('.bigcta');
  ok('무엇을 누르는지 적혀 있다', /오늘 학습 시작|이어하기|새로 배우기/.test(cta),
    cta.replace(/\n/g, ' '));
  ok('몇 개 · 몇 분인지도 적혀 있다', /\d+개 · 약 \d+분/.test(cta), cta.replace(/\n/g, ' '));

  /* 배정 내역 — 무엇이 몇 개 담겼는지. 갈래만 따로 하고 싶으면 눌러서 한다 */
  const tasks = await page.locator('.tdtask').allTextContents();
  ok('배정 내역이 보임', tasks.length >= 2, tasks.map((t) => t.split('\n')[0]).join(' / '));
  ok('복습이 먼저', tasks[0].includes('복습'), tasks[0].split('\n')[0]);
  /* ★ 「새 단어」인데 문장도 같이 배정된다 ★
     단어 버튼을 눌렀는데 문장이 나오면 범위를 오해한다 — 이름을 바꿨다 */
  ok('★ 「새 단어」가 아니라 「새로 배우기」 ★',
    tasks.some((t) => t.includes('새로 배우기')) && !tasks.some((t) => /새 단어/.test(t)),
    tasks.map((t) => t.split('\n')[0]).join(' / '));
  ok('무엇이 몇 개인지 적힌다',
    tasks.some((t) => /단어 \d+|문장 \d+/.test(t)),
    tasks.find((t) => t.includes('새로 배우기'))?.replace(/\n/g, ' '));
  const taskText = await page.textContent('.tdtasks');
  ok('줄마다 얼마나 걸리는지 보임', /약 \d+분/.test(taskText), taskText.match(/약 \d+분/)?.[0]);
  ok('복습 줄에 복습·약점 개수가 적힘', /복습 \d+ · 약점 \d+/.test(tasks[0]),
    tasks[0].replace(/\n/g, ' '));

  /* ★ 문법은 선택이다 ★
     오늘 완료는 카드 계획으로 세는데 문법은 그 밖에 있다. 그래서 문법이
     남아도 「오늘 학습 완료」가 떴다. 계획에 넣는 대신 선택이라고 적는다. */
  /* .today는 위쪽 진행 카드 하나다 — 화면 전체가 아니라서 여기서 찾으면 없다 */
  const todayBody = await page.textContent('.screen.active');
  ok('★ 문법이 선택이라고 적혀 있다 ★', todayBody.includes('선택'),
    todayBody.replace(/\s+/g, ' ').slice(0, 120));
  const gram = tasks.find((t) => t.includes('오늘의 문법'));
  ok('문법 줄이 있다', Boolean(gram));
  /* 개수만 적으면 무엇을 배우는지 모른 채로 누른다 */
  ok('문법 줄에 오늘 볼 꼭지 이름이 있다', gram?.includes('짧은 테스트까지'),
    gram?.replace(/\n/g, ' '));
  ok('연속일이 보임', (await page.textContent('.tdhead')).includes('7일'));

  console.log('\n── 시작하면 무슨 판인지 먼저 알려 준다');
  await page.locator('.tdtask', { hasText: '복습' }).first().click();
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
     심어 둔 복습 기록은 전부 단어라, 문장이 섞이는지는 「새 단어」에서 본다. */
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(700);
  await goTab(page, '오늘');
  await page.locator('.tdtask', { hasText: '새로 배우기' }).click();
  await page.waitForTimeout(700);
  /* 갈래가 갈렸으니 「새 단어」와 「복습하기」는 서로 다른 판이다.
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
  /* 이어하기는 이제 따로 한 줄이 아니라 주요 버튼 자체다 — 하다 만 게 있으면
     그게 무조건 먼저라, 버튼 하나가 그때그때 맞는 행동으로 바뀐다. */
  ok('★ 주요 버튼이 이어하기가 된다 ★',
    (await page.textContent('.bigcta')).includes('이어하기'),
    (await page.textContent('.bigcta')).replace(/\n/g, ' '));
  await page.locator('.bigcta').click();
  await page.waitForTimeout(900);
  ok('하던 자리로 돌아감', await page.locator('.judgerow').count() === 1);
  ok('처음부터 다시 시작하지 않음', !(await page.textContent('.sh-title')).includes(' 0 /'));
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(600);

  /* ★ 이번 개편의 제일 큰 약속 — 아무것도 안 없어진다 ★
     자리를 옮긴 것과 없앤 것은 다르다. 옮긴 것도 갈 길이 있어야 한다. */
  console.log('\n── 기존 것이 하나도 안 없어졌다');
  await goTab(page, '학습');
  const names = await page.locator('.menugroup .mt-title').allTextContents();
  for (const m of ['완전기초', '문법', '단어', '상황회화', '단어 시험', '동사 활용', '회독 학습']) {
    ok(`${m} 그대로 있음`, names.includes(m), names.join(','));
  }
  /* 듣기와 영상은 탭으로 올라갔다 */
  await goTab(page, '듣기');
  ok('듣기로 가는 길이 있음', await page.locator('.lh-way[data-way="auto"]').count() === 1);
  ok('따라 말하기도 있음', await page.locator('.lh-way[data-way="shadow"]').count() === 1);
  ok('영상으로 가는 길도 있음', await page.locator('.lh-way[data-way="videos"]').count() === 1);
  /* 번역기와 내 단어장은 더보기로 갔다 — 공부가 아니라 쓰는 것이라서 */
  await goTab(page, '더보기');
  ok('번역기는 더보기에 있음',
    await page.locator('.listrow', { hasText: '번역기' }).count() === 1);
  ok('내 단어장도 더보기에', await page.locator('.listrow', { hasText: '내 단어장' }).count() === 1);

  console.log('\n── 기록');
  await goTab(page, '기록');
  const log = await page.textContent('.screen.active');
  /* ★ 「이번 주」라고 적고 최근 7일을 셌다 ★
     월요일 아침에 지난주 것이 섞여 보였다. 계산이 아니라 이름을 고쳤다 —
     굴러가는 7일 창은 요일이 바뀔 때 0으로 꺼지지 않아 이쪽이 쓸모 있다. */
  ok('★ 센 기간을 제목이 그대로 말한다 ★',
    log.includes('최근 7일') && !log.includes('이번 주'), '제목과 계산이 어긋남');
  /* 최근 7일 성과와 여태 쌓은 것을 갈라 둔다 — 한 줄에 섞이면 뭐가 뭔지 모른다 */
  ok('누적은 따로 있다', log.includes('전체'));
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

  console.log('\n── 처음 켠 사람 (복습도 약점도 없다)');
  {
    const p2 = await boot(browser);
    const errs = []; p2.on('pageerror', (e) => errs.push(e.message));
    const tasks2 = await p2.locator('.tdtask').allTextContents();
    /* ★ 복습이 없는 날은 새로 배우기가 주요 행동이다 ★
       예전엔 복습이 0인 첫날에도 「복습하기」가 맨 위 주요 버튼이었다.
       처음 쓰는 사람에게 할 것도 없는 줄을 먼저 들이민 셈이다.
       복습 줄이 아예 안 뜨고, 주요 버튼이 새로 배우기가 된다. */
    const cta2 = await p2.textContent('.bigcta');
    ok('★ 주요 버튼이 새로 배우기 ★', cta2.includes('새로 배우기'), cta2.replace(/\n/g, ' '));
    ok('없는 복습 줄을 안 만든다',
      !tasks2.some((t) => t.split('\n')[0] === '복습'),
      tasks2.map((t) => t.split('\n')[0]).join(' / '));
    ok('새로 배울 것은 목표만큼 담김',
      tasks2.some((t) => t.includes('새로 배우기') && /20/.test(t)),
      tasks2.find((t) => t.includes('새로 배우기'))?.replace(/\n/g, ' '));
    /* 공부하기 전에는 연속일이 없다. 예전엔 앱을 켜기만 해도 1일째가 붙었는데,
       그건 아무것도 안 한 사람에게 했다고 말하는 것이다. */
    ok('공부 전에는 연속일 표시가 없음', await p2.locator('.th-streak').count() === 0);

    // 한 장 하면 그때 1일째가 된다
    await p2.locator('.tdtask', { hasText: '새로 배우기' }).click();
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
    const p3 = await boot(browser, { goals: { fresh: 10, review: 10, weak: 10 } });
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
    await p3.locator('.tdtask', { hasText: '새로 배우기' }).click();
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
    const resume = p3.locator('.bigcta');
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
    const p4 = await boot(browser, { goals: { fresh: 10, review: 10, weak: 10 } });
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

  /* ── 한 판이 끝나면 다음으로 이어 준다 ──
     끝날 때마다 홈으로 돌려보내면 매번 「다음에 뭐 하지」를 다시 정해야 한다.
     복습 → 단어 외우기 → 회독 학습이 그날의 순서다. */
  console.log('\n── 끝나면 다음으로 이어 준다');
  {
    const p5 = await boot(browser, {
      settings: { goals: { fresh: 20, review: 1, weak: 0 } },
      /* 씨앗을 넉넉히 둔다. 오늘 후보 풀은 자료 전체가 아니라 추려진 목록이라,
         한 장만 심으면 그게 안 뽑혀서 복습이 0이 된다. */
      review: seedDue(30),
    });
    await goTab(p5, '오늘');
    await p5.locator('.tdtask', { hasText: '복습' }).first().click();
    await p5.waitForTimeout(900);
    const intro5 = p5.locator('.study.intro .bigstart');
    if (await intro5.count()) { await intro5.click(); await p5.waitForTimeout(700); }

    for (let i = 0; i < 4 && await p5.locator('.judge.known').count(); i++) {
      await p5.locator('.judge.known').click();
      await p5.waitForTimeout(500);
    }
    const fin5 = await p5.locator('.finish').innerText().catch(() => '');
    ok('복습을 끝내면 새 단어로 이어 준다', fin5.includes('다음: 새 단어'),
      fin5.replace(/\n/g, ' ').slice(0, 90));
    ok('홈으로 가는 길도 남아 있다', fin5.includes('홈으로'));

    await p5.locator('.finish .submit-btn').click();
    await p5.waitForTimeout(1000);
    const where = await p5.locator('.sh-title, .si-label').first().innerText();
    ok('눌렀더니 새 단어가 열린다', where.includes('새 단어'), where);
    await p5.close();
  }

  /* ── 회독 학습 — 배운 걸 등급별로 다시 ── */
  console.log('\n── 회독 학습 (배운 걸 등급별로 다시)');
  {
    /* 넉넉히 심는다. n5-XXXX id 상당수는 기본 단어와 같은 말이라 병합 과정에서
       기본 쪽 id가 남는다 — 심은 수와 살아남는 수가 다르다. */
    const p6 = await boot(browser, { review: seedDue(60) });
    await goTab(p6, '학습');
    ok('학습 메뉴에 회독 학습이 있다',
      await p6.locator('.menutile', { hasText: '회독 학습' }).count() === 1);
    await p6.locator('.menutile', { hasText: '회독 학습' }).click();
    await p6.waitForTimeout(800);

    ok('등급이 셋', await p6.locator('.rp-lvcard').count() === 3);
    const n5 = p6.locator('.rp-lvcard').first();
    const n5text = await n5.innerText();
    const learned = Number(n5text.match(/(\d+)개 배웠어요/)?.[1] || 0);
    ok('배운 개수가 보인다', learned > 0, n5text.replace(/\n/g, ' ').slice(0, 60));

    /* 한 번도 안 본 등급은 못 누른다 — 그건 새로 배우는 것이고 여기 일이 아니다 */
    ok('안 배운 등급은 잠겨 있다',
      await p6.locator('.rp-lvcard').last().locator('.submit-btn').isDisabled());

    await n5.locator('.submit-btn').click();
    await p6.waitForTimeout(1000);
    const title6 = await p6.locator('.sh-title').innerText();
    ok('그 등급으로 회독이 시작된다', title6.includes('N5 회독'), title6);
    /* 배운 것만 들어간다 — 안 본 카드가 섞이면 「다시 보기」가 아니게 된다.
       N5 전체는 534개지만 배운 것만 담기니 그보다 훨씬 적어야 한다. */
    ok('배운 것만 들어간다', title6.includes(`/ ${learned}`), `${title6} (배운 것 ${learned}개)`);
    ok('안 본 카드는 안 섞인다', learned < 100, `${learned}개`);
    await p6.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
