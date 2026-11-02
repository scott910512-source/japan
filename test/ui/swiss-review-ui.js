/* 독일어 반복 학습 — 진짜 화면에서.
 *
 *   · 허브에 복습 카드: 오늘 몇 개, 단계별 개수, 복습 시작 / 미리 복습하기
 *   · 복습을 풀면 기억 기록이 바뀐다 — 맞히면 단계가 오르고 틀리면 오늘 다시
 *   · 굳은 낱말은 보기 없이 직접 쓴다(움라우트 없이 써도 맞다, 한 글자 오타는 거의 맞았어요)
 *   · 복습 탭에 「독일어 복습」 줄이 뜨고 누르면 바로 복습이 열린다
 *   · 일본어 회독 기록은 하나도 안 건드린다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';
import { SWISS_ITEMS, lessonById, tokensOf } from '../../src/data/swiss.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const DAY = 86400000;
const L1 = lessonById('u1l1'); const L2 = lessonById('u1l2');
const BY = new Map(SWISS_ITEMS.map((i) => [i.id, i]));
const progressDone = (agoL1 = 5, agoL2 = 2, weak = [L1.items[0].id]) => ({
  lessons: { [L1.id]: { stars: 2, last: 2, tries: 1, at: Date.now() - agoL1 * DAY }, [L2.id]: { stars: 1, last: 1, tries: 1, at: Date.now() - agoL2 * DAY } },
  xp: 30, weak,
});
const hardMem = () => Object.fromEntries(L1.items.map((it) => [it.id, {
  ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -9)), level: 4, due: addDays(today, -1), rounds: 5, streak: 3,
}]));

async function boot(browser, swiss) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((swiss) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (swiss) localStorage.setItem('jp_manabu_swiss_v1', JSON.stringify(swiss)); else localStorage.removeItem('jp_manabu_swiss_v1');
  }, swiss);
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
const swissOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || 'null'));
const jpReview = (page) => page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
const countOf = async (page) => (await page.locator('.swl-count').innerText()).replace(/\s/g, '');
const noUmlaut = (t) => t.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

/* 문제 하나를 푼다. 맞게 또는 일부러 틀리게. 푼 낱말 id를 돌려준다(짝 맞추기는 null) */
async function solveOne(page, { wrong = false } = {}) {
  if (await page.locator('.swl-match').count()) {
    const ids = await page.locator('.swl-mleft').evaluateAll((els) => els.map((e) => e.dataset.id));
    for (const id of ids) {
      await page.locator(`.swl-mleft[data-id="${id}"]`).click();
      await page.locator(`.swl-mright[data-id="${id}"]`).click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1000);
    return { id: null, type: 'match', ids };
  }
  const prompt = page.locator('.swl-prompt');
  const id = await prompt.getAttribute('data-item');
  const type = await prompt.getAttribute('data-type');
  const item = BY.get(id);
  if (type === 'build') {
    if (wrong) await page.locator('.swl-bank .swl-tok:not([disabled])').first().click();
    else {
      for (const t of tokensOf(item)) {
        await page.locator('.swl-bank .swl-tok:not([disabled])').filter({ hasText: new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click();
      }
    }
  } else if (type === 'write' || type === 'dictate') {
    await page.locator('.swl-input').fill(wrong ? 'zzzzzzzz' : (type === 'write' ? noUmlaut(item.de) : item.de));
  } else {
    const opts = await page.locator('.qopt').evaluateAll((els) => els.map((e) => e.dataset.id));
    const pick = wrong ? opts.find((o) => o !== id) : id;
    await page.locator(`.qopt[data-id="${pick}"]`).click();
  }
  await page.locator('.swl-check').click();
  await page.waitForTimeout(150);
  const verdict = (await page.locator('.swl-feedback').getAttribute('class')).includes('ok') ? 'ok' : 'no';
  await page.locator('.swl-next').click();
  await page.waitForTimeout(150);
  return { id, type, verdict };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 허브 — 복습 카드 ]');
  const page = await boot(browser, progressDone());
  page.on('pageerror', (e) => errors.push(e.message));
  const jpBefore = await jpReview(page);
  await openMenu(page, '독일어');
  await page.waitForTimeout(600);
  const due0 = L1.items.length + L2.items.length;
  ok('★ 복습 카드가 있다 ★', await page.locator('.swh-review').count() === 1);
  ok('★ 옛 진도(기억 칸이 없던 것)도 오늘 복습이 센다 ★', Number(await page.locator('.swh-review').getAttribute('data-due')) === due0, `${due0}개`);
  ok('오늘 몇 개인지 적힌다', (await page.locator('.swh-rdue').innerText()).includes(`오늘 ${due0}개`));
  ok('단계별 개수가 보인다(익히는 중이 전부)', Number(await page.locator('.swh-rstages [data-stage="learning"] b').innerText()) === due0);
  ok('아직 안 배운 것도 센다', Number(await page.locator('.swh-rstages [data-stage="unseen"] b').innerText()) === SWISS_ITEMS.length - due0);
  ok('★ 복습 시작 버튼 ★', (await page.locator('.swh-rstart').innerText()) === '복습 시작' && await page.locator('.swh-rstart').isEnabled());

  console.log('\n[ 복습 풀기 — 맞히면 오르고 틀리면 오늘 다시 ]');
  await page.locator('.swh-rstart').click();
  await page.waitForTimeout(700);
  const total = Number((await countOf(page)).split('/')[1]);
  ok('★ 한 묶음은 열두 낱말과 짝 맞추기 ★', total === 13, `${total}문제`);
  const seen = []; let wrongId = null;
  /* 약점 주머니의 낱말(L1.items[0])은 옛 진도를 채울 때 이미 한 번 틀린 것으로 적히니 틀림 횟수가 하나 더 많다 */
  /* 첫 문제는 일부러 틀린다 — 틀린 문제는 뒤에 다시 붙는다 */
  const first = await solveOne(page, { wrong: true });
  wrongId = first.id; seen.push(first);
  ok('틀린 문제는 뒤에 다시 붙는다', Number((await countOf(page)).split('/')[1]) === total + 1);
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.swl-finish').count()) break;
    seen.push(await solveOne(page));
  }
  ok('끝나면 복습 끝 화면', (await page.locator('.swl-finish').innerText()).includes('복습 끝'));
  ok('★ 「더 복습하기」 버튼 ★', (await page.locator('.swl-again').innerText()) === '더 복습하기');
  const itemIds = [...new Set(seen.map((s) => s.id).filter(Boolean))];
  await page.locator('.swl-again').click();
  await page.waitForTimeout(800);
  const afterOne = await swissOf(page);
  const goodId = itemIds.find((id) => id !== wrongId);
  ok('★ 틀린 낱말은 「몰라요」 — 오늘 다시 나온다 ★', afterOne.mem[wrongId].box === 1 && afterOne.mem[wrongId].due === today && afterOne.mem[wrongId].level === 0, `box ${afterOne.mem[wrongId].box}`);
  ok('★ 첫 대답이 맞은 낱말은 단계가 오른다 ★', afterOne.mem[goodId].level >= 2 && afterOne.mem[goodId].box === 3, `level ${afterOne.mem[goodId].level}`);
  ok('★ 한 낱말은 한 번만 센다(틀린 뒤 다시 맞혀도 두 번 안 쌓인다) ★', afterOne.mem[wrongId].rounds === 2 && afterOne.mem[wrongId].wrongCount === (wrongId === L1.items[0].id ? 2 : 1), `rounds ${afterOne.mem[wrongId].rounds} · 틀림 ${afterOne.mem[wrongId].wrongCount}`);
  ok('복습 경험치가 쌓였다', afterOne.xp > 30 && afterOne.xp <= 30 + 12, `${afterOne.xp}`);
  ok('★ 일본어 회독 기록은 그대로 ★', await jpReview(page) === jpBefore);
  ok('「더 복습하기」가 다음 묶음을 연다', await page.locator('.swl-count').count() === 1);

  console.log('\n[ 다음 묶음 — 마저 풀고 마치면 허브가 바뀐다 ]');
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.swl-finish').count()) break;
    await solveOne(page);
  }
  await page.locator('.swl-done').click();
  await page.waitForTimeout(700);
  ok('허브로 돌아온다', await page.locator('.swh-review').count() === 1);
  const dueAfter = Number(await page.locator('.swh-review').getAttribute('data-due'));
  ok('★ 오늘 복습이 줄었다 ★', dueAfter < due0, `${due0} → ${dueAfter}`);
  ok('★ 일본어 회독 기록은 그대로(복습을 다 풀고도) ★', await jpReview(page) === jpBefore);
  await page.close();

  console.log('\n[ 굳은 낱말 — 보기 없이 직접 쓴다 ]');
  const hard = await boot(browser, { ...progressDone(), mem: hardMem() });
  hard.on('pageerror', (e) => errors.push(e.message));
  await openMenu(hard, '독일어');
  await hard.waitForTimeout(500);
  ok('굳은 낱말 단계가 보인다', Number(await hard.locator('.swh-rstages [data-stage="mastered"] b').innerText()) === L1.items.length);
  await hard.locator('.swh-rstart').click();
  await hard.waitForTimeout(700);
  const kinds = new Set(); let typedOk = 0; let sawClose = false; let sawSpecial = false; let optsOnTyping = 0;
  for (let i = 0; i < 30 && !(await hard.locator('.swl-finish').count()); i++) {
    const t = await hard.locator('.swl-prompt').getAttribute('data-type').catch(() => null);
    if (t) kinds.add(t);
    if ((t === 'write' || t === 'dictate') && await hard.locator('.qopt').count() > 0) optsOnTyping += 1;
    if (t === 'write' && !sawSpecial) {
      sawSpecial = true;
      ok('★ ä ö ü ß 입력 도우미가 있다 ★', (await hard.locator('.swl-sp').allTextContents()).join('') === 'äöüß');
      await hard.locator('.swl-sp').nth(2).click();
      ok('도우미를 누르면 글자가 들어간다', (await hard.locator('.swl-input').inputValue()) === 'ü');
      await hard.locator('.swl-input').fill('');
    }
    if (t === 'write' && !sawClose) {
      const id = await hard.locator('.swl-prompt').getAttribute('data-item');
      const de = BY.get(id).de;
      if (de.length >= 5) {                      // 한 글자 빠뜨린 오타
        sawClose = true;
        await hard.locator('.swl-input').fill(noUmlaut(de).slice(0, -1));
        await hard.locator('.swl-check').click();
        await hard.waitForTimeout(150);
        ok('★ 한 글자 오타는 「거의 맞았어요」로 맞게 쳐 준다 ★', (await hard.locator('.swl-feedback').getAttribute('class')).includes('ok') && (await hard.locator('.swl-note').innerText()).includes('거의 맞았어요'));
        ok('정답 철자를 보여 준다', (await hard.locator('.swl-fde').innerText()).includes(de));
        await hard.locator('.swl-next').click();
        await hard.waitForTimeout(150);
        continue;
      }
    }
    const r = await solveOne(hard);
    if ((r.type === 'write' || r.type === 'dictate') && r.verdict === 'ok') typedOk += 1;
  }
  ok('★ 보기 없이 쓰는 문제(쓰기·받아쓰기)가 나온다 ★', kinds.has('write') || kinds.has('dictate'), [...kinds].join());
  ok('★ 움라우트 없이 써도 맞게 쳐 준다 ★', typedOk > 0, `${typedOk}개`);
  ok('★ 쓰기·받아쓰기 문제에는 보기 버튼이 하나도 없다 ★', optsOnTyping === 0);
  await hard.close();

  console.log('\n[ 독일어는 독일어 안에서만 복습한다 ]');
  const tab = await boot(browser, progressDone());
  tab.on('pageerror', (e) => errors.push(e.message));
  await goTab(tab, '복습');
  await tab.waitForTimeout(900);
  ok('★ 일본어 복습 화면에 독일어 줄이 없다(독일어는 단독 구성) ★', await tab.locator('.rv-row[data-row="swiss"]').count() === 0);
  await tab.close();

  console.log('\n[ 아직 안 배운 사람 ]');
  const fresh = await boot(browser, null);
  fresh.on('pageerror', (e) => errors.push(e.message));
  await goTab(fresh, '복습');
  await fresh.waitForTimeout(700);
  ok('복습 화면에 독일어 줄이 없다', await fresh.locator('.rv-row[data-row="swiss"]').count() === 0);
  await openMenu(fresh, '독일어');
  await fresh.waitForTimeout(500);
  ok('★ 복습 시작이 막혀 있고 이유를 알려 준다 ★', await fresh.locator('.swh-rstart').isDisabled() && (await fresh.locator('.swh-rdue').innerText()).includes('레슨을 끝내면'));
  ok('기존 코스는 그대로(여행 회화 단원 아홉)', await fresh.locator('.swh-track[data-track="travel"] .swh-unit').count() === 9);
  await fresh.close();

  console.log('\n[ 오늘 복습을 다 한 사람 — 미리 복습 ]');
  /* 약점 주머니도 비워서 — 약점이 있으면 그건 오늘 다시 나오는 게 맞다 */
  const done = await boot(browser, progressDone(0, 0, []));
  done.on('pageerror', (e) => errors.push(e.message));
  await openMenu(done, '독일어');
  await done.waitForTimeout(500);
  ok('오늘 복습은 다 했어요', (await done.locator('.swh-rdue').innerText()).includes('다 했어요') && await done.locator('.swh-review').getAttribute('data-due') === '0');
  ok('★ 「미리 복습하기」로 바뀐다 ★', (await done.locator('.swh-rstart').innerText()) === '미리 복습하기');
  await done.locator('.swh-rstart').click();
  await done.waitForTimeout(700);
  ok('★ 미리 복습도 문제가 나온다 ★', await done.locator('.swl-count').count() === 1);
  await done.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
