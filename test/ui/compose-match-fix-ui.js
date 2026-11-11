/* 문장 만들기 · 짝 맞추기 — 되돌릴 수 없던 세 가지.
 *
 *   1. 쓰기: AI 확인을 기다리는 중에 「다음 문장」을 눌렀다 → 늦게 온 답이 새 문장 칸에 붙는다
 *   2. 짝 맞추기: 마지막 짝을 맞히고 0.5초 안에 Esc → 다른 판을 시작했다 → 지난 판의 「다음 판」이 새 판을 덮는다
 *   3. 조립: Esc가 아무 일도 안 한다(나가는 길이 연결 안 돼 있었다)
 * AI는 흉내 낸다(route). */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { chunksOf } from '../../src/data/allChunks.js';
import { normalizeJp } from '../../src/lib/jptext.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const CARDS = allSentenceCards();
const usable = CARDS.filter((c) => chunksOf(c.id) && normalizeJp(c.kanji).length >= 8 && normalizeJp(c.kanji).length <= 32).slice(0, 14);
const known = () => ({ ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) });
const seeded = Object.fromEntries(usable.map((c) => [c.id, known()]));
const words = Object.fromEntries(ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 30).map((w) => [w.id, { box: 3, lastSeen: '2026-01-01', due: '2026-01-02', rounds: 1, level: 1 }]));
const tab = (page, id) => page.locator(`.cmp-tabs [data-mode="${id}"]`).click().then(() => page.waitForTimeout(500));

async function boot(browser, { review = {}, settings = {}, ai = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const aiCalls = [];
  if (ai) {
    await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
      /* 모델 목록 조회(GET)는 답을 만드는 호출이 아니다 — 혼잡이 길어지면 다른 모델을 찾으려고 한 번 부른다 */
      if (route.request().method() === 'POST') aiCalls.push(JSON.parse(route.request().postData() || '{}'));
      if (ai.__delay) await new Promise((r) => setTimeout(r, ai.__delay));   // 느린 답 — 기다리는 동안 사람이 다른 걸 누른다
      /* ai.__status가 있으면 그 상태로 실패시킨다(키가 틀렸을 때 등) */
      if (ai.__status) { await route.fulfill({ status: ai.__status, contentType: 'application/json', body: JSON.stringify(ai.body) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ai) }] } }] }) });
    });
  }
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  /* 기존 검사(menu2-ui)가 쓰는 시작 방법 — 첫 로드로 서비스워커를 깔고, 심은 뒤 한 번 더 불러 온 다음,
     오프라인으로 돌려 로그인 관문의 「이 기기 기록으로 계속하기」로 들어간다. 오프라인으로 새로고침하면
     서비스워커가 준비되기 전의 느린 러너에서 화면이 안 뜬다(CI에서 그랬다). */
  await page.evaluate(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');   // 보기 상세는 접어 둔다 — 기존 흐름을 본다 (펼친 상태: option-info-*)
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.gate, .tabbar').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error(`앱이 안 열렸어요 — 화면: ${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}`);
  /* 로그인 관문은 오프라인으로 지나왔다. AI 검사는 그다음에 온라인으로 — 흉내 낸 AI 서버(route)는
     온라인이어야 불린다 */
  if (ai) await page.context().setOffline(false);
  return { page, aiCalls };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 1. 쓰기 — AI를 기다리다 다음 문장으로 넘어가도 늦은 답이 새 문장에 안 붙는다 ]');
  {
    const good = { __delay: 1500, verdict: 'good', corrected: '駅まで歩いて行きました。', kana: 'えきまであるいていきました。', reason: '자연스러워요.', natural: [{ jp: '駅まで歩いて行ったよ。', kana: 'えきまであるいていったよ。', ko: '역까지 걸어갔어', note: '반말' }] };
    const { page } = await boot(browser, { review: { ...seeded }, settings: { geminiKey: 'AIzaTEST' }, ai: good });
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '문장 만들기');
    await tab(page, 'write');
    const first = await page.locator('.cmp-write').getAttribute('data-id');
    await page.locator('.cmp-input').fill('ちがうぶんです');
    await page.locator('.cmp-submit').click();
    await page.waitForTimeout(300);
    await page.locator('.cmp-ai').click();
    await page.waitForTimeout(200);
    await page.locator('.cmp-next').click();                                     // AI가 아직 보는 중에 다음 문장
    await page.waitForTimeout(400);
    const second = await page.locator('.cmp-write').getAttribute('data-id');
    ok('다음 문장 차례가 되었다(AI 답은 아직 안 왔다)', await page.locator('.cmp-ai-result').count() === 0, `${first} → ${second}`);
    await page.waitForTimeout(2200);                                              // 늦은 답이 도착한다
    await page.locator('.cmp-input').fill('ちがうぶんです');
    await page.locator('.cmp-submit').click();
    await page.waitForTimeout(300);
    ok('★ 새 문장에 지난 문장의 AI 결과가 붙어 있지 않다 ★', await page.locator('.cmp-ai-result').count() === 0);
    ok('★ 새 문장에서도 AI 확인 버튼이 다시 나온다 ★', await page.locator('.cmp-ai').count() === 1 && await page.locator('.cmp-follow').count() === 0);
    await page.close();
  }

  console.log('\n[ 2. 짝 맞추기 — 판이 끝나자마자 Esc 후 다른 판을 열어도 지난 판이 안 끼어든다 ]');
  {
    const { page } = await boot(browser, { review: { ...words } });
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '짝 맞추기');
    await page.locator('.mt-pick').first().click();
    await page.waitForTimeout(600);
    const leftCount = await page.locator('.mt-col').first().locator('.mt-tile').count();
    for (let k = 0; k < leftCount; k++) {
      const left = page.locator('.mt-col').first().locator('.mt-tile:not(.gone)').first();
      const rights = page.locator('.mt-col').nth(1).locator('.mt-tile:not(.gone)');
      const rn = await rights.count();
      for (let j = 0; j < rn; j++) {
        await left.click();
        await rights.nth(j).click();
        if (k === leftCount - 1) break;                                           // 마지막 쌍은 오른쪽이 하나뿐 — 곧바로 다음 단계
        await page.waitForTimeout(160);
        const stillThere = await page.locator('.mt-col').first().locator('.mt-tile:not(.gone)').count();
        if (stillThere < leftCount - k) break;
        await page.waitForTimeout(450);
      }
    }
    await page.keyboard.press('Escape');                                          // 0.5초가 지나기 전에 그만두고
    await page.keyboard.press('2');                                               // 소리 판을 새로 연다
    await page.waitForTimeout(1200);                                              // 지난 판의 타이머가 울릴 시간
    const head = await page.locator('.mt-head').innerText();
    const soundTiles = await page.locator('.mt-sound').count();
    ok('★ 새 판은 아직 1판이다(지난 판이 2판으로 넘기지 않았다) ★', head.includes('1 / 4'), head.replace(/\s+/g, ' '));
    ok('★ 새 판이 소리 판 그대로다(글자 판으로 바뀌지 않았다) ★', soundTiles === 5, `소리 타일 ${soundTiles}개`);
    await page.close();
  }

  console.log('\n[ 3. 조립 — Esc로 나갈 수 있다 ]');
  {
    const { page } = await boot(browser, { review: { ...seeded } });
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '문장 만들기');
    await tab(page, 'build');
    ok('조립 화면이 열려 있다', await page.locator('.cmp-build').count() === 1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    ok('★ Esc를 누르면 조립 화면을 나간다 ★', await page.locator('.cmp-build').count() === 0, await page.locator('.compose').count() ? '문장 만들기 안에 그대로' : '나감');
    await page.close();
  }

  ok('화면 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
