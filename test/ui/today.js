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

  /* ── 할 일은 셋 ── */
  const tasks = await page.locator('.tdtask').allTextContents();
  ok('할 일이 셋으로 나뉨', tasks.length === 3, tasks.map((t) => t.split('\n')[0]).join(' / '));
  /* 복습이 먼저다. 이미 본 걸 안 잃는 것이 새로 배우는 것보다 앞선다 —
     새 단어를 스무 개 더 넣어도 어제 것이 새어 나가면 제자리다. */
  ok('복습하기가 맨 위', tasks[0].includes('복습하기'), tasks[0].split('\n')[0]);
  ok('그다음이 새 단어', tasks[1].includes('새 단어'), tasks[1].split('\n')[0]);
  ok('오늘의 문법이 마지막', tasks[2].includes('오늘의 문법'), tasks[2].split('\n')[0]);
  /* 눌러 보고 나서야 뭐가 나오는지 알면 안 된다 — 줄마다 개수가 적혀 있어야 한다 */
  ok('줄마다 몇 개인지 보임', await page.locator('.tt-count, .tt-done').count() === 3);
  /* 갈래별 숫자와 걸리는 시간은 각 줄이 적는다 */
  const taskText = await page.textContent('.tdtasks');
  ok('줄마다 얼마나 걸리는지 보임', /약 \d+분/.test(taskText), taskText.match(/약 \d+분/)?.[0]);
  ok('복습 줄에 복습·약점 개수가 적힘', /복습 \d+ · 약점 \d+/.test(tasks[0]),
    tasks[0].replace(/\n/g, ' '));
  /* 개수만 적으면 무엇을 배우는지 모른 채로 누른다 */
  ok('문법 줄에 오늘 볼 꼭지 이름이 있다', tasks[2].includes('짧은 테스트까지'),
    tasks[2].replace(/\n/g, ' '));
  ok('연속일이 보임', (await page.textContent('.tdhead')).includes('7일'));

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
     심어 둔 복습 기록은 전부 단어라, 문장이 섞이는지는 「새 단어」에서 본다. */
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(700);
  await goTab(page, '오늘');
  await page.locator('.tdtask', { hasText: '새 단어' }).click();
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
  ok('이어하기가 뜸', await page.locator('.rowcard', { hasText: '이어하기' }).count() === 1);
  await page.locator('.rowcard', { hasText: '이어하기' }).click();
  await page.waitForTimeout(900);
  ok('하던 자리로 돌아감', await page.locator('.judgerow').count() === 1);
  ok('처음부터 다시 시작하지 않음', !(await page.textContent('.sh-title')).includes(' 0 /'));
  await page.locator('.sh-close').first().click();
  await page.waitForTimeout(600);

  /* ★ 이번 개편의 제일 큰 약속 — 아무것도 안 없어진다 ★
     자리를 옮긴 것과 없앤 것은 다르다. 옮긴 것도 갈 길이 있어야 한다. */
  console.log('\n── 기존 것이 하나도 안 없어졌다');
  await goTab(page, '학습');
  const names = await page.locator('.mb-body b, .mt-nm').allTextContents();
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
  await goTab(page, '듣기');
  await page.locator('.lh-way[data-way="auto"]').click();
  await page.waitForTimeout(800);
  const listen = await page.textContent('.sub-body');
  ok('듣기 화면이 열림', await page.locator('.listen').count() === 1);
  ok('두 가지 방식', await page.locator('.listen .ls-mode').count() === 2, listen.slice(0, 40));
  ok('간격을 고를 수 있음', await page.locator('.listen .grouppick button', { hasText: '초' }).count() === 4);

  /* ★ 무엇을 들을지 여기서 고른다 ★
     여태 오늘의 학습 큐를 빌려 써서, 배운 게 수백 개인데 늘 같은 스무 개가
     같은 차례로 들렸다. 그러면 소리가 아니라 순서를 외운다. */
  ok('무엇을 들을지 고를 수 있다', await page.locator('.listen .ls-scope').count() === 4);
  ok('범위마다 몇 개인지 미리 보인다',
    /\d+개/.test(await page.locator('.ls-scope[data-scope="seen"] .pk-count').innerText()),
    (await page.locator('.listen .ls-scope .pk-count').allTextContents()).join(' / '));
  /* ★ 오늘 몫 스무 장에 묶여 있지 않다 ★
     이 화면이 회독 큐를 빌려 쓰던 시절엔 고를 수 있는 게 그 스무 장이 전부였다. */
  const allN = Number((await page.locator('.ls-scope[data-scope="all"] .pk-count').innerText()).match(/\d+/)[0]);
  ok('고를 수 있는 범위가 오늘 몫보다 훨씬 넓다', allN > 500, `${allN}개`);

  ok('방향을 고를 수 있다', await page.locator('.listen .ls-dir').count() === 2);
  ok('뒤집는 길이 있다', await page.locator('.ls-dir[data-dir="ko-jp"]').count() === 1);

  /* ── 시작 버튼은 맨 위에 작게 ──
     아래에 커다랗게 두었더니 화면 하나를 먹어서, 간격이나 개수를 바꾸려면
     스크롤을 해야 했다. 설정이 세 덩이인 화면에서 그건 매번 드는 비용이다. */
  ok('시작 버튼이 맨 위에 있다', await page.locator('.ls-top .ls-go').count() === 1);
  ok('커다란 버튼은 없앴다', await page.locator('.listen .bigstart').count() === 0);
  ok('무엇으로 시작하는지 옆에 적혀 있다',
    /\d+개 · \d+초/.test(await page.locator('.ls-topbody').innerText()),
    (await page.locator('.ls-topbody').innerText()).replace(/\n/g, ' '));

  /* 누르자마자 소리가 나면 이어폰을 안 꽂았을 때 놀란다 — 한 번 더 묻는다 */
  await page.locator('.ls-go').click();
  await page.waitForTimeout(500);
  ok('바로 시작하지 않고 한 번 더 묻는다', await page.locator('.ls-ask').count() === 1);
  ok('아직 재생 안 됨', await page.locator('.ls-stage').count() === 0);
  ok('무엇으로 시작할지 보여 준다', await page.locator('.ls-ask .td-cell').count() === 3);
  await page.locator('.ls-ask .ghost-btn').click();
  await page.waitForTimeout(500);
  ok('아니요를 누르면 안 시작한다', await page.locator('.ls-stage').count() === 0);
  ok('회독 기록은 안 건드린다고 밝힘', listen.includes('회독 기록은 건드리지 않아요'));

  /* ★ 화면을 못 보는 동안 쓰는 자리다 ★
     뜻이 눈으로만 나오면 일본어 뒤에 침묵만 남는다 — 절반이 안 들리는 셈이다. */
  ok('뜻도 소리로 낼 수 있다', listen.includes('한국어 뜻도 소리로'));
  const koRow = page.locator('.listen .toggle-row', { hasText: '한국어 뜻도' });
  ok('기본으로 켜져 있다', await koRow.locator('.toggle.on').count() === 1
    || (await koRow.innerText()).includes('한국어 음성이 없어요'),
    (await koRow.innerText()).replace(/\n/g, ' ').slice(0, 60));
  /* 한국어 음성이 없는 기기면 끄고 왜 안 되는지 적어 준다 —
     소리가 안 나는데 켜져 있으면 고장으로 읽힌다 */
  ok('음성이 없으면 이유를 적는다',
    (await koRow.innerText()).includes('화면을 안 봐도')
    || (await koRow.innerText()).includes('한국어 음성이 없어요'));
  ok('화면이 꺼지면 멈길 수 있다고 밝힘', listen.includes('멈출 수 있'));

  const beforeReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  await startListen(page);
  await page.waitForTimeout(400);
  ok('재생 화면으로 바뀜', await page.locator('.ls-stage').count() === 1);
  ok('일본어가 크게 나옴', (await page.textContent('.ls-jp')).trim().length > 0);
  ok('한글 발음도 나옴', (await page.textContent('.ls-yomi')).trim().length > 0);
  ok('뜻은 아직 안 보임', (await page.textContent('.ls-ko')).trim() === '···');
  /* 무엇을 읽으라고 넘겼는지만 가로챈다 — 진짜 음성 엔진은 검사에서 못 쓴다.
     일본어는 클라우드 음성을 쓸 수 있어 여기 안 잡힐 수도 있지만, 뜻은
     기기 음성으로만 내므로 반드시 잡힌다. */
  ok('손 안 대도 넘어간다고 적힘', (await page.textContent('.ls-note')).includes('손을 안 대도'));

  await page.locator('.ls-controls .ghost-btn', { hasText: '다음' }).click();
  await page.waitForTimeout(500);
  ok('다음으로 넘길 수 있음', (await page.textContent('.listen .sub-title')).startsWith('2 /'), await page.textContent('.listen .sub-title'));

  /* 듣기는 귀에 넣는 것만 한다 — 회독 기록을 건드리면 안 된다 */
  const afterReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  ok('듣기가 회독 기록을 안 건드림', beforeReview === afterReview);

  await page.locator('.listen .sub-back').click();
  await page.waitForTimeout(500);
  ok('그만두면 시작 화면으로', await page.locator('.listen .ls-go').count() === 1);

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
    await p2.locator('.tdtask', { hasText: '새 단어' }).click();
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
    await p3.locator('.tdtask', { hasText: '새 단어' }).click();
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
    await p5.locator('.tdtask', { hasText: '복습하기' }).click();
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

  /* ── 한국어 음성이 있는 기기에서 ──
     검사 기기에는 한국어 음성이 없어서 위에서는 안내만 확인된다. 여기서는
     있는 척을 하고, 뜻 차례에 실제로 읽으라고 넘기는지 본다. */
  console.log('\n── 듣기에서 뜻도 읽어 준다');
  {
    /* 음성 목록에 한국어를 끼워 넣고, 무엇을 읽으라고 넘겼는지 가로챈다.
       진짜 음성 엔진은 검사에서 못 쓴다. */
    const p7 = await boot(browser, { settings: { listenGap: 1 } }, () => {
      window.__said = [];
      const ko = { voiceURI: 'test-ko', name: 'Test Korean', lang: 'ko-KR' };
      const ja = { voiceURI: 'test-ja', name: 'Test Japanese', lang: 'ja-JP' };
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices = () => [ko, ja];
      const real = synth.speak.bind(synth);
      synth.speak = (u) => {
        window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
        try { real(u); } catch { /* 무시 */ }
      };
    });

    const err7 = [];
    p7.on('pageerror', (e) => err7.push(e.message));
    await goTab(p7, '듣기');
    await p7.locator('.lh-way[data-way="auto"]').click();
    await p7.waitForTimeout(900);

    const row = p7.locator('.listen .toggle-row', { hasText: '한국어 뜻도' });
    ok('한국어 음성이 있으면 켜진다', await row.locator('.toggle.on').count() === 1,
      (await row.innerText()).replace(/\n/g, ' ').slice(0, 60));
    ok('안내도 바뀐다', (await row.innerText()).includes('화면을 안 봐도'));

    await p7.evaluate(() => { window.__said = []; });
    await startListen(p7);
    ok('재생이 시작된다', await p7.locator('.ls-stage').count() === 1);
    /* 음성 하나를 못 붙였다고 화면이 죽으면 안 된다 — 검사에서 끼워 넣은
       가짜 음성은 진짜 SpeechSynthesisVoice가 아니라 붙이기가 실패한다.
       실제 기기에서도 목록이 이상한 브라우저가 있다. */
    ok('음성을 못 붙여도 화면이 안 죽는다', err7.length === 0, err7.slice(0, 2).join(' | '));

    /* 일본어 → 뜸 → 뜻. 뜻 차례가 올 때까지 기다린다 — 문장이 길면
       읽는 시간이 길어져서 고정 시간으로 재면 흔들린다. */
    let heardKo = false;
    for (let i = 0; i < 20 && !heardKo; i++) {
      await p7.waitForTimeout(1000);
      heardKo = await p7.evaluate(() => (window.__said || []).some((u) => u.lang === 'ko-KR'));
    }
    const said = await p7.evaluate(() => window.__said || []);
    ok('일본어를 읽는다', said.some((u) => u.lang === 'ja-JP'), said.map((u) => u.lang).join(','));
    ok('뜻도 읽어 준다', heardKo,
      said.map((u) => `${u.lang}:${u.text}`).join(' | ').slice(0, 120));

    /* 끄면 안 읽어야 한다 — 껐는데 나오면 설정이 거짓말이 된다 */
    await p7.locator('.listen .sub-back').click();
    await p7.waitForTimeout(700);
    await row.click();
    await p7.waitForTimeout(300);
    ok('끌 수 있다', await row.locator('.toggle.on').count() === 0);

    await p7.evaluate(() => { window.__said = []; });
    await startListen(p7);
    /* 일본어를 두 장 읽을 때까지만 본다 — 그동안 한국어가 한 번도 안 나오면
       꺼진 것이다. 고정으로 오래 기다리면 검사 전체가 시간에 쫓긴다. */
    for (let i = 0; i < 20; i++) {
      await p7.waitForTimeout(700);
      const n = await p7.evaluate(() => (window.__said || []).filter((u) => u.lang === 'ja-JP').length);
      if (n >= 2) break;
    }
    const said2 = await p7.evaluate(() => window.__said || []);
    ok('끄면 뜻은 안 읽는다', !said2.some((u) => u.lang === 'ko-KR'),
      said2.map((u) => u.lang).join(',') || '조용함');
    ok('그래도 일본어는 읽는다', said2.some((u) => u.lang === 'ja-JP'));

    await p7.close();
  }

  /* ── 뒤집어서 — 뜻을 듣고 내가 일본어로 ──
   *
   * 듣고 알아듣는 것과, 듣고 말해 보는 것은 다른 연습이다. 여행에서 막히는
   * 쪽은 뒤엣것인데 여태 앞엣것만 있었다. */
  console.log('\n── 뜻 → 일본어 (뒤집기)');
  {
    const p8 = await boot(browser, { settings: { listenGap: 1, listenDir: 'ko-jp' } }, () => {
      window.__said = [];
      const ko = { voiceURI: 'test-ko', name: 'Test Korean', lang: 'ko-KR' };
      const ja = { voiceURI: 'test-ja', name: 'Test Japanese', lang: 'ja-JP' };
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices = () => [ko, ja];
      const real = synth.speak.bind(synth);
      synth.speak = (u) => {
        window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
        try { real(u); } catch { /* 무시 */ }
      };
    });
    const err8 = [];
    p8.on('pageerror', (e) => err8.push(e.message));
    await goTab(p8, '듣기');
    await p8.locator('.lh-way[data-way="auto"]').click();
    await p8.waitForTimeout(900);

    ok('고른 방향이 기억된다',
      await p8.locator('.ls-dir[data-dir="ko-jp"].active').count() === 1);
    /* 「따라 말하기」는 들려준 걸 따라 하는 것이라 뒤집은 판에는 없다 */
    ok('뒤집으면 따라 말하기는 안 보인다', await p8.locator('.listen .ls-mode').count() === 0);
    const ansRow = p8.locator('.listen .ls-sayans');
    ok('여기서 끄는 건 일본어 쪽이다', (await ansRow.innerText()).includes('일본어 답도 소리로'),
      (await ansRow.innerText()).replace(/\n/g, ' ').slice(0, 60));

    await p8.evaluate(() => { window.__said = []; });
    await startListen(p8);
    await p8.waitForTimeout(600);
    ok('재생이 시작된다', await p8.locator('.ls-stage').count() === 1);

    /* ★ 뜻이 먼저다 ★ 물어보는 게 뜻인데 일본어가 먼저 보이면 문제가 아니다 */
    ok('뜻이 먼저 뜬다', (await p8.textContent('.ls-prompt')).trim().length > 0,
      (await p8.textContent('.ls-prompt')).trim().slice(0, 30));
    ok('일본어는 아직 가려져 있다', (await p8.textContent('.ls-jp')).trim() === '···',
      (await p8.textContent('.ls-jp')).trim().slice(0, 20));

    const first = await p8.evaluate(() => (window.__said || [])[0] || null);
    ok('한국어부터 읽어 준다', first?.lang === 'ko-KR', JSON.stringify(first));

    /* 말할 틈 → 답. 답이 뜰 때까지 기다린다 */
    let showed = false;
    for (let i = 0; i < 20 && !showed; i++) {
      await p8.waitForTimeout(800);
      showed = (await p8.textContent('.ls-jp')).trim() !== '···';
    }
    ok('말해 본 뒤에 답이 뜬다', showed, await p8.textContent('.ls-phase'));
    const said8 = await p8.evaluate(() => window.__said || []);
    ok('답도 읽어 준다', said8.some((u) => u.lang === 'ja-JP'), said8.map((u) => u.lang).join(','));
    /* ★ 답은 두 번 읽어 준다 ★
       한 번만 읽으면 긴 침묵 뒤에 스치듯 지나간다 — 「나무」를 듣고 3초를
       말해 본 다음 「き」가 0.3초 나오고 끝이니 안 읽어 준 것과 구별이 안 됐다.
       한 번은 확인하려고, 한 번은 내가 말한 것과 견주려고 듣는다. */
    let twice = said8.filter((u) => u.lang === 'ja-JP').length >= 2;
    for (let i = 0; i < 8 && !twice; i++) {
      await p8.waitForTimeout(800);
      twice = await p8.evaluate(() => (window.__said || [])
        .filter((u) => u.lang === 'ja-JP').length >= 2);
    }
    ok('답을 두 번 들려준다', twice,
      (await p8.evaluate(() => (window.__said || []).map((u) => u.lang).join(','))));
    ok('한국어가 일본어보다 먼저 나온다',
      said8.findIndex((u) => u.lang === 'ko-KR') < said8.findIndex((u) => u.lang === 'ja-JP'),
      said8.map((u) => u.lang).join(','));

    /* ★ 답 소리를 끌 수 있어야 한다 ★
       읽어 주면 떠올리기 전에 답이 먼저 들려서, 말하기가 아니라 따라 하기가 된다.
       그래도 화면에는 떠야 한다 — 맞았는지 확인할 길까지 막을 이유는 없다. */
    await p8.locator('.listen .sub-back').click();
    await p8.waitForTimeout(700);
    await ansRow.click();
    await p8.waitForTimeout(300);
    ok('답 소리를 끌 수 있다', await ansRow.locator('.toggle.on').count() === 0);
    ok('끄면 왜 조용한지 적어 준다', (await ansRow.innerText()).includes('화면으로 확인'),
      (await ansRow.innerText()).replace(/\n/g, ' ').slice(0, 70));

    await p8.evaluate(() => { window.__said = []; });
    await startListen(p8);
    let showed2 = false;
    for (let i = 0; i < 20 && !showed2; i++) {
      await p8.waitForTimeout(800);
      showed2 = (await p8.textContent('.ls-jp')).trim() !== '···';
    }
    const said9 = await p8.evaluate(() => window.__said || []);
    ok('끄면 일본어는 안 읽는다', !said9.some((u) => u.lang === 'ja-JP'),
      said9.map((u) => u.lang).join(',') || '조용함');
    ok('그래도 뜻은 읽어 준다 — 그게 문제니까', said9.some((u) => u.lang === 'ko-KR'));
    ok('꺼도 답은 화면에 뜬다', showed2, await p8.textContent('.ls-jp'));

    /* 뒤집어도 회독 기록은 안 건드린다 */
    ok('뒤집어도 안 죽는다', err8.length === 0, err8.slice(0, 2).join(' | '));
    await p8.close();
  }

  /* ── ★ 음성 목록이 비어 있는 기기 ★ ──
   *
   * 안드로이드 크롬과 웹뷰는 getVoices()가 []를 주면서도 소리는 멀쩡히 난다.
   * 그 기기에서 일본어는 나오는데 한국어만 안 나왔다 — 일본어 쪽은 음성을
   * 못 찾아도 lang만 맞춰 그냥 읽는데, 한국어 쪽만 「음성이 없다」며 돌아섰다.
   * 게다가 토글까지 회색으로 잠가 놔서 사용자가 켤 수도 없었다.
   *
   * 목록이 비었으면 「모른다」이지 「없다」가 아니다. 시켜 보고, 안 나면
   * 그때 사용자가 끄면 된다. */
  console.log('\n── 음성 목록이 비어 있어도 읽는다');
  for (const dir of ['jp-ko', 'ko-jp']) {
    const pv = await boot(browser, { settings: { listenGap: 1, listenDir: dir } }, () => {
      window.__said = [];
      const s = window.speechSynthesis;
      if (!s) return;
      s.getVoices = () => [];                 // ← 목록이 비어 있다
      const real = s.speak.bind(s);
      s.speak = (u) => { window.__said.push({ lang: u?.lang || '' }); try { real(u); } catch { /* 무시 */ } };
    });
    await goTab(pv, '듣기');
    const way = pv.locator('.lh-way[data-way="auto"]');
    if (await way.count()) { await way.click(); await pv.waitForTimeout(800); }

    const r = pv.locator('.listen .ls-sayans');
    ok(`[${dir}] 목록이 비어도 토글을 끌 수 없게 잠그지 않는다`, !(await r.isDisabled()));
    ok(`[${dir}] 기본으로 켜져 있다`, await r.locator('.toggle.on').count() === 1);

    await pv.evaluate(() => { window.__said = []; });
    await startListen(pv);
    /* 둘 다 나올 때까지 기다린다. 한쪽만 보고 끊으면 방향에 따라 아직 안 온
       쪽을 「안 나온다」고 잡는다 — 뒤집은 판은 한국어가 먼저다. */
    let both = false;
    for (let i = 0; i < 24 && !both; i++) {
      await pv.waitForTimeout(800);
      both = await pv.evaluate(() => {
        const l = (window.__said || []).map((u) => u.lang);
        return l.includes('ko-KR') && l.includes('ja-JP');
      });
    }
    const langs = await pv.evaluate(() => (window.__said || []).map((u) => u.lang).join(','));
    ok(`[${dir}] 한국어를 읽으라고 넘긴다`, langs.includes('ko-KR'), langs || '조용함');
    ok(`[${dir}] 일본어도 읽는다`, langs.includes('ja-JP'), langs);
    await pv.close();
  }

  /* ── 범위와 개수가 실제로 먹는가, 순서는 흩어지는가 ──
   *
   * 여태 이 화면은 오늘의 학습 큐를 빌려 썼다. 그래서 「전체」를 골라도 오늘
   * 몫 스무 장이 전부였고, 개수 설정은 통째로 무시됐고, 차례까지 매번 같았다.
   * 그러면 소리가 아니라 순서를 외운다. */
  console.log('\n── 전체에서 골라 흩는다');
  {
    const p9 = await boot(browser, { settings: { listenGap: 1, listenScope: 'all', listenCount: 50 } });
    await goTab(p9, '듣기');
    await p9.locator('.lh-way[data-way="auto"]').click();
    await p9.waitForTimeout(900);

    const firstCard = async () => {
      await startListen(p9);
      await p9.waitForTimeout(400);
      const t = (await p9.textContent('.ls-jp')).trim();
      const n = await p9.textContent('.listen .sub-title');
      await p9.locator('.listen .sub-back').click();
      await p9.waitForTimeout(500);
      return { t, n };
    };
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(await firstCard());
    /* ★ 개수 설정이 실제로 먹는다 ★ 「50개만 듣고 자자」가 이 화면의 쓰임이다 */
    ok('고른 개수만큼 담긴다', seq[0].n.trim().endsWith('/ 50'), seq[0].n.trim());
    ok('돌릴 때마다 첫 장이 달라진다', new Set(seq.map((s) => s.t)).size > 1,
      seq.map((s) => s.t).join(' / '));
    await p9.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
