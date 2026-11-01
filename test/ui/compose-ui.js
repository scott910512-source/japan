/* 문장 만들기 — 진짜 화면에서.
 *
 *   조립  조각을 순서대로 눌러 만든다 → 한 번에=알아요, 고쳐서=애매해요(복습 기록)
 *   빈칸  답이 하나인 자료에서 고른다 — 복습 기록은 안 건드린다(문장 카드가 아니다)
 *   쓰기  뜻을 보고 직접 쓴다 → 맞음=알아요, 틀림=몰라요. 다른 말로 맞게 쓰면 AI가 봐 준다
 *   내 문장  내가 만든 문장을 AI가 고친다(키가 있을 때)
 * AI는 흉내 낸다(route) — 이 검사는 인터넷 없이 돈다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { chunksOf } from '../../src/data/allChunks.js';
import { normalizeJp } from '../../src/lib/jptext.js';
import { applyVerdict, VERDICT, addDays, todayKey, BOX } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const CARDS = allSentenceCards();
const byId = new Map(CARDS.map((c) => [c.id, c]));
/* 조각이 있고 쓰기에 알맞은 길이의 문장 14개를 「본 것」으로 */
const usable = CARDS.filter((c) => chunksOf(c.id) && normalizeJp(c.kanji).length >= 8 && normalizeJp(c.kanji).length <= 32).slice(0, 14);
const known = () => ({ ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) });
const seeded = Object.fromEntries(usable.map((c) => [c.id, known()]));

async function boot(browser, { review = {}, settings = {}, ai = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const aiCalls = [];
  if (ai) {
    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      aiCalls.push(JSON.parse(route.request().postData() || '{}'));
      /* ai.__status가 있으면 그 상태로 실패시킨다(키가 틀렸을 때 등) */
      if (ai.__status) { await route.fulfill({ status: ai.__status, contentType: 'application/json', body: JSON.stringify(ai.body) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ai) }] } }] }) });
    });
  }
  await page.addInitScript(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review, settings });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  /* 로그인 관문은 오프라인으로 지나왔다. AI 검사는 그다음에 온라인으로 — 흉내 낸 AI 서버(route)는
     온라인이어야 불린다 */
  if (ai) await page.context().setOffline(false);
  return { page, aiCalls };
}
const reviewOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
const tab = (page, id) => page.locator(`.cmp-tabs [data-mode="${id}"]`).click().then(() => page.waitForTimeout(500));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  ok('시험용 문장이 충분하다', usable.length >= 12, `${usable.length}개`);

  console.log('\n[ 허브와 탭 ]');
  const { page } = await boot(browser, { review: seeded });
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page, '문장 만들기');
  await page.waitForTimeout(900);
  ok('★ 허브에서 문장 만들기가 열린다 ★', await page.locator('.compose').count() === 1);
  ok('네 갈래 탭: 조립 · 빈칸 · 쓰기 · 내 문장', (await page.locator('.cmp-tabs button').allTextContents()).join() === '조립,빈칸,쓰기,내 문장');
  ok('목표 레벨이 보인다', (await page.textContent('.cmp-note')).includes('N3'));

  console.log('\n[ 조립 — 한 번에 맞히면 알아요, 고쳐서 맞히면 애매해요 ]');
  const solve = async (wrongFirst) => {
    const id = await page.locator('.cmp-build').getAttribute('data-id');
    const chunks = chunksOf(id);
    if (wrongFirst) {
      /* 일부러 틀린 조각부터 — 첫 칸에 정답이 아닌 조각이 있으면 그걸 누른다 */
      const tiles = page.locator('.build-pool .build-tile');
      const n = await tiles.count();
      for (let i = 0; i < n; i++) {
        const t = (await tiles.nth(i).innerText()).trim();
        if (t !== chunks[0].trim()) { await tiles.nth(i).click(); break; }
      }
      await page.waitForTimeout(150);
      await page.locator('.build-reset').click().catch(() => {});
      await page.waitForTimeout(150);
    }
    for (const c of chunks) {
      const tile = page.locator('.build-pool .build-tile').filter({ hasText: c }).first();
      await tile.click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(300);
    return id;
  };
  const before = await reviewOf(page);
  const id1 = await solve(false);
  ok('조립이 끝나면 다음 문장 버튼', await page.locator('.cmp-next').count() === 1);
  let r = await reviewOf(page);
  ok('★ 한 번에 맞히면 「알아요」로 들어간다 ★', r[id1].box === BOX.KNOWN && r[id1].rounds === before[id1].rounds + 1, `box ${r[id1].box}`);
  await page.locator('.cmp-next').click();
  await page.waitForTimeout(500);
  const id2 = await solve(true);
  r = await reviewOf(page);
  ok('★ 고쳐서 맞히면 「애매해요」(오늘 다시 나온다) ★', r[id2].box === BOX.VAGUE && r[id2].due === today, `box ${r[id2].box}`);
  ok('점수가 오른다', (await page.locator('.cmp-score').innerText()).replace(/\s/g, '').startsWith('1/2'));
  const solvedOnce = await reviewOf(page);

  console.log('\n[ 빈칸 — 답이 하나, 복습 기록은 그대로 ]');
  await tab(page, 'blank');
  ok('빈칸 문제가 뜬다', await page.locator('.cmp-blank').count() === 1 && await page.locator('.cmp-hole').count() === 1);
  ok('보기가 셋', await page.locator('.cmp-opt').count() === 3);
  await page.locator('.cmp-opt').first().click();
  await page.waitForTimeout(400);
  const wrongShown = await page.locator('.cmp-opt.wrong').count() === 1;
  if (wrongShown) {
    ok('★ 틀리면 왜 틀렸는지가 뜬다 ★', (await page.locator('.cmp-opt.wrong .qo-why').innerText()).length > 4);
    ok('틀리면 저절로 안 넘어간다', await page.locator('.cmp-next').count() === 1);
  } else {
    ok('맞히면 저절로 넘어간다', true);
  }
  ok('★ 빈칸은 복습 기록을 안 건드린다 ★', JSON.stringify(await reviewOf(page)) === JSON.stringify(solvedOnce));

  console.log('\n[ 쓰기 — 맞으면 알아요, 틀리면 몰라요 ]');
  await tab(page, 'write');
  ok('한국어 뜻이 나온다', (await page.locator('.cmp-write .qc-prompt').innerText()).length > 1);
  const wid1 = await page.locator('.cmp-write').getAttribute('data-id');
  await page.locator('.cmp-input').fill(byId.get(wid1).kanji.replace(/[。！？]$/, ''));      // 마침표 없이
  await page.locator('.cmp-submit').click();
  await page.waitForTimeout(400);
  ok('★ 마침표가 없어도 맞다 ★', await page.locator('.cmp-ok').count() === 1);
  await page.waitForTimeout(1300);                                                            // 저절로 넘어간다
  let rr = await reviewOf(page);
  ok('★ 맞으면 「알아요」 ★', rr[wid1].box === BOX.KNOWN && rr[wid1].rounds === (solvedOnce[wid1]?.rounds ?? seeded[wid1].rounds) + 1, `box ${rr[wid1].box}`);
  const wid2 = await page.locator('.cmp-write').getAttribute('data-id');
  ok('다음 문장으로 넘어갔다', wid2 !== wid1);
  const preWrong = await reviewOf(page);
  await page.locator('.cmp-input').fill('ちがうぶんです');
  await page.locator('.cmp-submit').click();
  await page.waitForTimeout(400);
  ok('★ 틀리면 정답을 알려 준다 ★', (await page.locator('.cmp-result').innerText()).includes(byId.get(wid2).kanji));
  ok('키가 없으면 AI 버튼 대신 안내', await page.locator('.cmp-ai').count() === 0 && (await page.textContent('.compose')).includes('AI 키'));
  ok('틀린 직후엔 아직 기록이 안 바뀐다(다음을 눌러야 확정)', JSON.stringify((await reviewOf(page))[wid2]) === JSON.stringify(preWrong[wid2]));
  await page.locator('.cmp-next').click();
  await page.waitForTimeout(500);
  rr = await reviewOf(page);
  ok('★ 틀리면 「몰라요」 — 오늘 복습에 올라온다 ★', rr[wid2].box === BOX.UNKNOWN && rr[wid2].due === today, `box ${rr[wid2].box}`);

  console.log('\n[ 내 문장 — 키가 없을 때 ]');
  await tab(page, 'free');
  ok('★ 키가 없으면 무엇이 필요한지 알려 준다 ★', await page.locator('.cmp-nokey').count() === 1 && (await page.textContent('.cmp-nokey')).includes('AI 키'));
  ok('입력칸은 안 보인다(눌러도 못 부르니)', await page.locator('.cmp-mine').count() === 0);
  await page.close();

  console.log('\n[ AI 첨삭 — 다른 말로 맞게 쓴 경우 ]');
  const good = { verdict: 'good', corrected: '駅まで歩いて行きました。', kana: 'えきまであるいていきました。', reason: '자연스러워요.', natural: [{ jp: '駅まで歩いて行ったよ。', kana: 'えきまであるいていったよ。', ko: '역까지 걸어갔어.', note: '친구에게' }] };
  const withAi = await boot(browser, { review: seeded, settings: { geminiKey: 'AIzaTEST' }, ai: good });
  withAi.page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(withAi.page, '문장 만들기');
  await tab(withAi.page, 'write');
  const aid = await withAi.page.locator('.cmp-write').getAttribute('data-id');
  await withAi.page.locator('.cmp-input').fill('ちがうぶんです');
  await withAi.page.locator('.cmp-submit').click();
  await withAi.page.waitForTimeout(400);
  ok('★ 키가 있으면 AI 확인 버튼이 뜬다 ★', await withAi.page.locator('.cmp-ai').count() === 1);
  await withAi.page.locator('.cmp-ai').click();
  await withAi.page.waitForTimeout(900);
  ok('AI 결과가 뜬다(고친 문장 · 이유 · 이렇게도 말해요)', await withAi.page.locator('.cmp-ai-result[data-verdict="good"]').count() === 1
    && (await withAi.page.textContent('.cmp-ai-result')).includes('이렇게도 말해요'));
  ok('★ AI에 보낸 글에 내 문장과 뜻이 들어 있다 ★', withAi.aiCalls.length === 1 && JSON.stringify(withAi.aiCalls[0]).includes('ちがうぶんです') && JSON.stringify(withAi.aiCalls[0]).includes(byId.get(aid).mean.slice(0, 4)));
  ok('★ 시스템 지시에 「확실하지 않으면」과 회화가 있다 ★', JSON.stringify(withAi.aiCalls[0]).includes('확실하지 않으면') && JSON.stringify(withAi.aiCalls[0]).includes('회화'));
  await withAi.page.locator('.cmp-follow').click();
  await withAi.page.waitForTimeout(500);
  const ar = await reviewOf(withAi.page);
  ok('★ AI가 자연스럽다고 하면 「알아요」로 쳐 준다 ★', ar[aid].box === BOX.KNOWN && ar[aid].rounds === seeded[aid].rounds + 1, `box ${ar[aid].box}`);

  console.log('\n[ 내 문장 — 키가 있을 때 ]');
  await tab(withAi.page, 'free');
  ok('입력칸이 보인다', await withAi.page.locator('.cmp-mine').count() === 1);
  await withAi.page.locator('.cmp-ko').fill('역까지 걸어갔어요');
  await withAi.page.locator('.cmp-mine').fill('駅まで歩く行きました');
  await withAi.page.locator('.cmp-check').click();
  await withAi.page.waitForTimeout(900);
  ok('★ 고친 문장과 이유가 뜬다 ★', (await withAi.page.textContent('.cmp-ai-result')).includes('駅まで歩いて行きました。'));
  ok('보낸 글에 내가 쓴 문장이 있다', withAi.aiCalls.length === 2 && JSON.stringify(withAi.aiCalls[1]).includes('駅まで歩く行きました'));
  ok('★ 내 문장은 복습 기록을 안 건드린다 ★', JSON.stringify(await reviewOf(withAi.page)) === JSON.stringify(ar));
  await withAi.page.close();

  console.log('\n[ AI가 실패할 때 ]');
  const downBoot = await boot(browser, { review: seeded, settings: { geminiKey: 'bad' }, ai: { __status: 403, body: { error: { message: 'API key not valid' } } } });
  const down = downBoot.page;
  await openMenu(down, '문장 만들기');
  await tab(down, 'free');
  await down.locator('.cmp-mine').fill('私は学生です');
  await down.locator('.cmp-check').click();
  await down.waitForTimeout(900);
  ok('★ 실패하면 이유를 보여 주고 화면이 안 죽는다 ★', await down.locator('.cmp-aierr').count() === 1 && (await down.locator('.cmp-aierr').innerText()).includes('403'));
  await down.close();

  console.log('\n[ 본 문장이 없을 때 ]');
  const empty = await boot(browser, {});
  empty.page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(empty.page, '문장 만들기');
  ok('★ 조립: 안내가 뜬다 ★', (await empty.page.textContent('.cmp-empty')).includes('문장을 먼저 배워'));
  await tab(empty.page, 'write');
  ok('쓰기도 안내가 뜬다', await empty.page.locator('.cmp-empty').count() === 1);
  await empty.page.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
