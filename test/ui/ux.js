/* 실제로 쓰는 길을 따라 걸어 본다 — 나갔다 오면 진도가 남는가, 되돌리기는 되는가. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, startStudy, openReview } from './_nav.js';

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
    s.onboarded = true; s.autoTTS = false; s.speakOnJudge = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
};

const head = (page) => page.textContent('.sh-title');
/* 회독 기록을 그대로 읽는다 — 화면이 뭐라 하든 실제로 남은 게 이것이다 */
const review = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
/* 판정은 답을 보고 나서 한다. 앞면이면 먼저 뒤집는다 — 사람이 하는 순서다. */
const judge = async (page, label) => {
  if (await page.locator('.judgerow').count() === 0) {
    await page.locator('.studycard').first().click();
    await page.waitForTimeout(200);
  }
  await page.locator('.judgerow button', { hasText: label }).click();
  await page.waitForTimeout(450);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);

  // ── 회독을 하다가 다른 탭에 갔다 오면 ──
  await startStudy(page);
  await page.waitForTimeout(1200);

  /* ── ★ 답을 보기 전에는 판정이 없다 ★ ──
   *
   * 자기평가의 기준은 「정답을 보고 이해했는지」가 아니라 「답을 보기 전에
   * 떠올렸는지」다. 그런데 판정 버튼이 앞면에서도 눌렸다.
   *
   * 처음 고칠 때 hidden 속성으로 숨겼는데 안 숨었다 — .judgerow에 display: grid가
   * 걸려 있어서 작성자 스타일이 브라우저 기본 [hidden]을 이긴다. 두 줄이 같이
   * 떠서 앞면에서도 판정이 눌렸고, 검사는 그대로 통과했다. 그래서 「버튼이
   * 아예 없다」를 못 박아 둔다 — 숨긴 척하는 것과 없는 것은 다르다.
   *
   * 이 검사는 판정 전에 와야 한다. 되돌리기 뒤에는 같은 방문으로 돌아가서
   * 답이 그대로 펼쳐져 있고, 그건 고장이 아니다. */
  ok('★ 앞면에는 판정 버튼이 아예 없다 ★',
    await page.locator('.judgerow').count() === 0
    && await page.locator('.judgerow button').count() === 0);
  ok('앞면에는 「답 보기」가 있다', await page.locator('.revealrow .sc-reveal').count() === 1);
  /* 못 떠올린 사람에게도 답은 보여 준다 — 답을 못 본 채로 다음 카드로 가면
     그 카드는 그냥 틀린 채로 지나간 것이다 */
  ok('「모르겠어요」도 있다', await page.locator('.revealrow .sc-miss').count() === 1);

  /* 앞면에서 숫자키를 쳐도 기록이 새지 않는다 — 판정이 아니라 뒤집기로 쓰인다 */
  const leak0 = Object.keys(await review(page)).length;
  await page.keyboard.press('3');
  await page.waitForTimeout(500);
  ok('★ 앞면에서 숫자키로 판정이 안 된다 ★',
    Object.keys(await review(page)).length === leak0,
    `${leak0} → ${Object.keys(await review(page)).length}`);
  ok('숫자키는 뒤집기로 쓰인다', await page.locator('.judgerow').count() === 1);

  const first = await page.textContent('.sc-front, .studycard');
  await judge(page, '알아요');
  await judge(page, '몰라요');
  const after2 = await head(page);
  ok('두 장 하면 진도가 오름', after2.includes('2 /'), after2);

  await goTab(page, '오늘');
  await page.waitForTimeout(800);
  /* .judgerow는 앞면에서도 0이라 이제 「나갔나」를 못 가린다 — 카드로 본다 */
  ok('탭으로 회독을 나감', await page.locator('.studycard').count() === 0);
  const home = await page.textContent('.screen.active');
  ok('홈에서 이어하기를 안내함', /이어|남은|계속/.test(home), home.replace(/\s+/g, ' ').slice(0, 70));

  await startStudy(page);
  await page.waitForTimeout(1200);
  const back = await head(page);
  ok('돌아오면 진도가 그대로', back === after2, `${back} vs ${after2}`);
  ok('처음 카드로 안 되돌아감', (await page.textContent('.studycard')) !== first);

  // ── 새로고침해도 이어진다 ──
  /* 다시 불러오기 전에는 잠깐 연결을 돌려놓는다. 끊긴 채로 불러오면
     서비스워커가 자리를 안 잡았을 때 아무것도 안 뜬다. */
  await page.context().setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.context().setOffline(true);
  const off2 = page.locator('.gate-offline'); if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
  await startStudy(page);
  await page.waitForTimeout(1300);
  ok('앱을 다시 켜도 이어짐', (await head(page)) === after2, await head(page));

  // ── 되돌리기 ──
  const before = await head(page);
  await judge(page, '알아요');
  const undo = page.locator('.sh-undo');
  ok('한 장 하면 되돌리기가 열림', !(await undo.isDisabled()));
  await undo.click();
  await page.waitForTimeout(500);
  ok('되돌리면 진도가 하나 줄어듦', (await head(page)) === before, `${await head(page)} vs ${before}`);

  // ── 뜻 보기 → 판정 ──
  await page.locator('.studycard').click();
  await page.waitForTimeout(400);
  const backface = await page.textContent('.studycard');
  ok('탭하면 뜻이 보임', (await page.locator('.sc-back').count()) === 1, backface.replace(/\s+/g, ' ').slice(0, 40));
  ok('뜻을 보고도 판정할 수 있음', await page.locator('.judgerow button').count() === 3);

  // ── 취약 단어 ──
  /* 복습은 탭에서 내려와 밀어 넣는 화면이 됐다 — .screen.active가 아니라
     .sub-body 안에 산다. 화면 자체는 그대로다. */
  await openReview(page);
  await page.waitForTimeout(800);
  const rv = await page.textContent('.sub-body');
  /* 「졸업」과 「완료」가 같은 상태를 다르게 부르고 있었다 — 「익숙함」으로 모았다 */
  ok('복습 화면에 기억 수준이 있음', rv.includes('익숙함') && rv.includes('학습 중'),
    rv.replace(/\s+/g, ' ').slice(0, 80));
  ok('취약 단어 입구가 있음', rv.includes('취약'));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
