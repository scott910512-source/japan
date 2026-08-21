/* 암기(회독) 흐름을 실제 화면에서 끝까지 돌린다.
   판정 → 회독 넘어가기 → 되돌리기 → 이어하기 → 기록 저장까지. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const boot = async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false; s.dailyGoal = 50; // 세션 중간 동작을 보려면 넉넉해야 한다
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
};

const review = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);

  // 학습 탭 → 회독 시작
  await startStudy(page);
  await page.waitForTimeout(900);
  ok('회독 화면 진입', await page.locator('.sh-bar').count() > 0);

  const head = async () => (await page.textContent('.sh-title')).trim();
  const word = async () => (await page.textContent('.sc-main').catch(() => '')).trim();
  const before = await head();
  ok('진행 표시가 있음', /\d+\s*\/\s*\d+/.test(before), before);

  // 뜻 확인 → 판정
  const first = await word();
  await page.locator('.studycard').first().click().catch(() => {});
  await page.waitForTimeout(300);

  const known = page.locator('.judge.known');
  const vague = page.locator('.judge.vague');
  const unknown = page.locator('.judge.unknown');
  ok('세 가지 판정 버튼', await known.count() === 1 && await vague.count() === 1 && await unknown.count() === 1);

  await known.click();
  await page.waitForTimeout(500);
  ok('알아요 → 다음 단어', (await head()) !== before, `${before} → ${await head()}`);
  ok('알아요가 기록됨', Object.values(await review(page)).some((s) => s.box === 3 && s.streak === 1));

  // 되돌리기
  const at2 = await head();
  const undo = page.locator('button', { hasText: '되돌리기' });
  if (await undo.count()) {
    await undo.first().click();
    await page.waitForTimeout(500);
    ok('되돌리면 이전 단어로', (await head()) === before, `${at2} → ${await head()}`);
    ok('되돌리면 같은 단어', (await word()) === first, await word());
    await page.locator('.studycard').first().click().catch(() => {});
    await page.waitForTimeout(250);
    await known.click();
    await page.waitForTimeout(450);
  } else ok('되돌리기 버튼이 있음', false);

  // 몰라요는 같은 회독에서 다시 나와야 한다
  await page.locator('.studycard').first().click().catch(() => {});
  await page.waitForTimeout(250);
  await unknown.click();
  await page.waitForTimeout(500);
  ok('몰라요가 기록됨', Object.values(await review(page)).some((s) => s.box === 1 && s.wrongCount >= 1));

  // 몰라요는 이번 회독 큐 끝에 한 번 더 들어가야 한다
  const sess = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || '{}'));
  const wrongId = Object.entries(await review(page)).find(([, s]) => s.box === 1)?.[0];
  ok('몰라요는 이번 회독에 다시 들어감', sess.queue?.includes(wrongId), `큐 ${sess.queue?.length}장, 재삽입 ${JSON.stringify(sess.reinserted)}`);
  ok('한 번만 다시 넣음', sess.queue?.filter((x) => x === wrongId).length === 1);

  // 25장을 돌려 진행이 계속되는지 본다
  for (let i = 0; i < 25; i++) {
    if (await page.locator('.studycard').count() === 0) break;
    if (await known.count() === 0) break;
    await page.locator('.studycard').first().click().catch(() => {});
    await page.waitForTimeout(160);
    await known.click();
    await page.waitForTimeout(260);
  }

  const rec = await review(page);
  ok('여러 단어의 기록이 쌓임', Object.keys(rec).length >= 10, `${Object.keys(rec).length}개`);
  ok('기록에 날짜가 남음', Object.values(rec).every((s) => typeof s.lastSeen === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastSeen)));
  ok('상자 값이 규칙 안에 있음', Object.values(rec).every((s) => [0, 1, 2, 3].includes(s.box)));
  ok('연속 횟수가 음수가 아님', Object.values(rec).every((s) => s.streak >= 0));

  // 나갔다 들어오면 이어진다
  const mid = await head();
  await page.locator('.sh-close, .sub-back').first().click();
  await page.waitForTimeout(600);
  await startStudy(page);
  await page.waitForTimeout(900);
  const resumed = await head();
  ok('나갔다 와도 진도가 이어짐', resumed !== '1 / 1' && /\d+\s*\/\s*\d+/.test(resumed), `${mid} → ${resumed}`);

  // 새로고침해도 기록이 남는다
  const beforeReload = Object.keys(await review(page)).length;
  /* 다시 불러오기 전에는 잠깐 연결을 돌려놓는다. 끊긴 채로 불러오면
     서비스워커가 자리를 안 잡았을 때 아무것도 안 뜬다. */
  await page.context().setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off2 = page.locator('.gate-offline');
  if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
  ok('새로고침해도 기록이 남음', Object.keys(await review(page)).length === beforeReload, `${beforeReload}개`);

  // 복습 탭이 기록을 읽는다
  await page.locator('.tabbar .tab', { hasText: '복습' }).click();
  await page.waitForTimeout(700);
  const body = await page.textContent('body');
  ok('복습 탭이 열림', body.length > 50);
  ok('복습 탭에 숫자가 보임', /\d/.test(body));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
