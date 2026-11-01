/* 쭉 퀴즈 — 진짜 화면에서.
 *
 *   · 학습 → 실전 연습이 허브(쭉 퀴즈 · 상황 대화)를 연다, 뒤로 가면 허브로 돌아온다
 *   · 외운 게 부족하면 시작을 막는다 — 보기를 못 만든다
 *   · 풀면 점수·연속이 오르고, 맞히면 알아요 · 틀리면 몰라요가 복습 기록에 들어간다
 *   · 그만하기 → 평가(정답률·종류별·다시 볼 것) → 계속 풀기 / 나가기
 *   · 목표 레벨을 바꾸면 그 급수를 넘는 단어는 안 나온다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, openSettings, openMore } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey, BOX } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const known = (ago = 5) => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -ago));
const n5 = ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 12);
const n3 = ALL_WORDS.filter((w) => w.level === 'N3').slice(0, 12);
const seededReview = Object.fromEntries([...n5, ...n3].map((w) => [w.id, { ...known(), due: addDays(today, -1) }]));

async function boot(browser, { review = {}, settings = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  /* 기존 검사(menu2-ui)가 쓰는 시작 방법 — 첫 로드로 서비스워커를 깔고, 심은 뒤 한 번 더 불러 온 다음,
     오프라인으로 돌려 로그인 관문의 「이 기기 기록으로 계속하기」로 들어간다. 오프라인으로 새로고침하면
     서비스워커가 준비되기 전의 느린 러너에서 화면이 안 뜬다(CI에서 그랬다). */
  await page.evaluate(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error(`앱이 안 열렸어요 — 화면: ${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}`);
  return page;
}
const reviewOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
const countsOf = async (page) => Object.fromEntries(await page.locator('.st-count').evaluateAll((els) => els.map((e) => [e.dataset.kind, Number(e.querySelector('b').textContent)])));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 허브와 뒤로가기 ]');
  const page = await boot(browser, { review: seededReview });
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '학습');
  await page.locator('.menutile[data-menu="rpg"]').click();
  await page.waitForTimeout(700);
  ok('실전 연습이 허브를 연다', await page.locator('.drillhub').count() === 1);
  ok('허브에 쭉 퀴즈 · 문장 만들기 · 상황 대화', (await page.locator('.drillhub .pr-row b').allTextContents()).join() === '쭉 퀴즈,문장 만들기,상황 대화');
  ok('★ 목표 레벨이 N3로 보인다(기본) ★', (await page.locator('.dh-goal b').innerText()) === 'N3');
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);
  ok('쭉 퀴즈 소개 화면', await page.locator('.st-intro').count() === 1);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  ok('★ 뒤로 가면 허브로 돌아온다 ★', await page.locator('.drillhub').count() === 1);
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);

  console.log('\n[ 소개 — 외운 것 ]');
  const c = await countsOf(page);
  ok('★ 목표 N3: 본 단어 24개가 다 든다 ★', c.word === 24, JSON.stringify(c));
  ok('시작할 수 있다', await page.locator('.st-start').isEnabled());

  console.log('\n[ 풀기 — 점수와 복습 기록 ]');
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);
  ok('문제가 뜬다', await page.locator('.st-q').count() === 1);
  ok('점수 0 / 0', (await page.locator('.st-score').innerText()).replace(/\s/g, '') === '0/0');

  const before = await reviewOf(page);
  const results = [];
  for (let i = 0; i < 8; i++) {
    const run = page.locator('.st-run');
    if (!(await run.count())) break;
    const id = await run.getAttribute('data-id');
    const mode = await run.getAttribute('data-mode');
    if (mode === 'typing') {
      /* 직접 쓰기는 일부러 틀린 답으로 — 결과를 알 수 있게 */
      await page.locator('.st-input').fill('ㅋㅋㅋ');
      await page.locator('.st-submit').click();
    } else {
      await page.locator('.st-opt').first().click();
    }
    await page.waitForTimeout(250);
    const right = (await page.locator('.st-opt.correct.wrong, .st-opt.wrong').count()) === 0 && mode !== 'typing';
    const gotWrong = await page.locator('.st-next, .st-close').count() > 0;
    results.push({ id, ok: !gotWrong });
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click();
    else await page.waitForTimeout(1000);          // 맞히면 저절로 넘어간다
    await page.waitForTimeout(250);
  }
  const after = await reviewOf(page);
  /* ★ 복습 기록에는 한 낱말의 「첫 대답」만 들어간다 ★
     한 판에서 같은 낱말을 다시 만날 수 있다(틀리면 곧 다시 나온다). 틀린 뒤 맞혔다고 몰라요가
     지워지면 안 되고, 두 번 틀렸다고 두 번 쌓여도 안 된다 — 그래서 기록 검사는 첫 대답으로 한다. */
  const firstOf = new Map();
  for (const r of results) if (!firstOf.has(r.id)) firstOf.set(r.id, r.ok);
  const wrongs = [...firstOf].filter(([, v]) => !v).map(([id]) => ({ id }));
  const rights = [...firstOf].filter(([, v]) => v).map(([id]) => ({ id }));
  const rightAnswers = results.filter((r) => r.ok).length;
  const wrongAnyIds = new Set(results.filter((r) => !r.ok).map((r) => r.id));
  ok('여러 문제를 풀었다', results.length >= 6, `${results.length}문제 · 낱말 ${firstOf.size}개 · 맞힘 ${rightAnswers}`);
  ok('★ 첫 대답이 틀린 것은 「몰라요」 — 오늘 복습으로 올라온다 ★',
    wrongs.length > 0 && wrongs.every((r) => after[r.id]?.box === BOX.UNKNOWN && after[r.id]?.due === today),
    wrongs.slice(0, 2).map((r) => `${r.id}:${after[r.id]?.box}`).join(' '));
  ok('★ 첫 대답이 맞은 것은 「알아요」로 들어간다(rounds가 오른다) ★',
    rights.length === 0 || rights.every((r) => (after[r.id]?.rounds || 0) > (before[r.id]?.rounds || 0) && after[r.id]?.box === BOX.KNOWN),
    rights.slice(0, 2).map((r) => `${r.id}:${after[r.id]?.rounds}`).join(' '));
  ok('★ 같은 판에서 다시 만나도 기록은 한 번만(rounds가 한 번만 오른다) ★',
    [...firstOf.keys()].every((id) => (after[id]?.rounds || 0) === (before[id]?.rounds || 0) + 1),
    [...firstOf.keys()].slice(0, 3).map((id) => `${id}:${(before[id]?.rounds || 0)}→${after[id]?.rounds}`).join(' '));
  const scoreTxt = (await page.locator('.st-score').innerText()).replace(/\s/g, '');
  ok('점수가 푼 수와 맞는다', scoreTxt === `${rightAnswers}/${results.length}`, scoreTxt);

  console.log('\n[ 평가 ]');
  await page.locator('.st-stop').click();
  await page.waitForTimeout(600);
  ok('평가 화면', await page.locator('.st-sum').count() === 1);
  const pct = Number((await page.locator('.qs-num').innerText()).replace(/[^\d]/g, ''));
  ok('정답률이 맞다', pct === Math.round((rightAnswers / results.length) * 100), `${pct}%`);
  ok('종류별 줄이 있다', await page.locator('.st-kindrow').count() >= 1);
  const missedIds = await page.locator('.st-missed .qwrow').evaluateAll((els) => els.map((e) => e.dataset.id));
  ok('★ 다시 볼 것 = 한 번이라도 틀린 낱말 ★', new Set(missedIds).size === wrongAnyIds.size, `${missedIds.length}개`);
  await page.locator('.st-again').click();
  await page.waitForTimeout(700);
  ok('계속 풀기: 새 판(점수 0)', (await page.locator('.st-score').innerText()).replace(/\s/g, '') === '0/0');
  await page.locator('.st-stop').click();
  await page.waitForTimeout(400);
  ok('푼 게 없으면 「푼 문제가 없어요」', (await page.textContent('.st-sum')).includes('푼 문제가 없어요'));
  await page.locator('.subscreen .qnext .submit-btn').click();
  await page.waitForTimeout(600);
  ok('나가기 → 허브', await page.locator('.drillhub').count() === 1);

  console.log('\n[ 목표 레벨 ]');
  await openSettings(page);
  await openMore(page, 'study');
  const goalBtns = await page.locator('.grouppick[data-set="goalLevel"] button').allTextContents();
  ok('고를 수 있는 급수는 N5·N4·N3', goalBtns.join() === 'N5,N4,N3', goalBtns.join());
  ok('지금은 N3', (await page.locator('.grouppick[data-set="goalLevel"] button.active').innerText()) === 'N3');
  await page.locator('.grouppick[data-set="goalLevel"] button', { hasText: 'N4' }).click();
  await page.waitForTimeout(400);
  ok('★ 목표가 기기에 저장된다 ★', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).goalLevel) === 'N4');
  await openMenu(page, '쭉 퀴즈');
  await page.waitForTimeout(700);
  const c4 = await countsOf(page);
  ok('★ 목표 N4: N3 단어(12개)는 안 나온다 ★', c4.word === 12, JSON.stringify(c4));
  ok('허브·소개에 목표가 보인다', (await page.textContent('.st-intro')).includes('N4'));
  await page.close();

  console.log('\n[ 외운 게 없을 때 ]');
  const empty = await boot(browser, {});
  empty.on('pageerror', (e) => errors.push(e.message));
  await openMenu(empty, '쭉 퀴즈');
  await empty.waitForTimeout(700);
  ok('★ 시작이 막혀 있고 이유를 알려 준다 ★', await empty.locator('.st-start').isDisabled() && (await empty.textContent('.st-intro')).includes('아직 외운 것이 적어요'));
  await empty.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
