/* 공부하다 물어보기 — 화면에서.
 *
 * 이 검사가 지키는 건 두 가지다.
 *
 *   1. 답을 알아내는 통로가 되면 안 된다. 「궁금해요」는 카드를 먼저 뒤집는다 —
 *      뒤집고 나서 곁가지를 묻는 건 그냥 공부지만, 안 뒤집고 물으면 시험 점수가
 *      실력을 안 재게 된다.
 *   2. 창이 열려 있을 때 판정 키가 살아 있으면 안 된다. 질문을 치다가 3을 누르면
 *      「알아요」로 넘어가 버린다.
 *
 * AI는 실제로 안 부른다. 부르면 검사가 요금을 쓰고 인터넷 사정에 따라 흔들린다.
 * 대신 그 자리에 가짜 답을 놓고, 앱이 그걸 어떻게 다루는지 본다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const ANSWER = {
  answer: '食べている는 食べる의 진행형이에요. 지금 먹는 중이라는 뜻입니다.',
  items: [
    { jp: '食べている', kana: 'たべている', ko: '먹고 있다', note: '지금 먹는 중' },
    { jp: '食べてる', kana: 'たべてる', ko: '먹고 있어', note: '회화에서 줄인 말' },
  ],
};

async function boot(browser, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, settings);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

/* AI 자리에 가짜 답을 놓는다. 몇 번 불렸는지도 센다 —
   같은 걸 두 번 물었을 때 요금이 두 번 나가는지 보려면 그 숫자가 필요하다. */
async function stubAI(page, body = ANSWER) {
  const calls = { n: 0 };
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    calls.n += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }],
      }),
    });
  });
  return calls;
}

const openAsk = async (page) => {
  await page.locator('.studyfoot button', { hasText: '궁금해요' }).click();
  await page.waitForTimeout(500);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  /* ── 1. 키가 없는 사람 ── */
  console.log('\n[ 키를 안 넣었으면 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    ok('학습이 시작된다', await startStudy(page));

    ok('카드에 궁금해요 버튼이 있다',
      await page.locator('.studyfoot button', { hasText: '궁금해요' }).count() === 1);

    /* ★ 답을 알아내는 통로가 아니다 ★
       누르기 전에는 뒷면(뜻)이 안 보이고, 누르면 뒤집힌다. 이게 안 지켜지면
       「이거 뜻이 뭐야」로 물어서 답을 알아낼 수 있고, 그러면 회독 기록이
       실력을 안 재게 된다. */
    ok('물어보기 전에는 뜻이 가려져 있다', await page.locator('.sc-back').count() === 0);
    await openAsk(page);
    ok('물어보면 카드가 먼저 뒤집힌다 — 답을 알아내는 통로가 아니다',
      await page.locator('.sc-back').count() === 1);

    /* 닫힌 창은 화면 밖으로 밀려 있을 뿐 DOM에 남아 있다.
       isVisible()로는 열림/닫힘이 안 갈린다 — open 클래스로 본다. */
    ok('창이 열린다', await page.locator('.sheet.open .asksheet').count() === 1);
    ok('무슨 카드를 보고 있는지 붙어 있다', await page.locator('.ask-chip').count() === 1);
    ok('키가 없으면 어디서 넣는지 알려 준다',
      (await page.locator('.asksheet .set-note').innerText()).includes('설정'));
    ok('키가 없으면 물어보기 버튼이 죽어 있다',
      await page.locator('.asksheet .submit-btn').isDisabled());

    await page.close();
  }

  /* ── 2. 키가 있는 사람 ── */
  console.log('\n[ 물어본다 ]');
  {
    const page = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' });
    page.on('pageerror', (e) => errors.push(e.message));
    await startStudy(page);
    await openAsk(page);

    /* 비행기 모드 — 부르기 전에 왜 안 되는지 말해야 한다 */
    await page.locator('.asksheet textarea').fill('食べている는 뭐야?');
    await page.locator('.asksheet .submit-btn').click();
    await page.waitForTimeout(400);
    ok('인터넷이 없으면 그렇게 말해 준다',
      (await page.locator('.ask-err').innerText()).includes('인터넷'));

    // 이제 인터넷이 있다고 치고, AI 자리에 가짜 답을 놓는다
    await page.context().setOffline(false);
    const calls = await stubAI(page);

    await page.locator('.asksheet .submit-btn').click();
    await page.waitForTimeout(900);
    ok('답이 뜬다', (await page.locator('.ask-text').innerText()).includes('진행형'));
    ok('물어본 질문도 같이 보인다', (await page.locator('.ask-q').innerText()).includes('食べている'));
    ok('표현이 카드로 붙는다', await page.locator('.ask-item').count() === 2);
    ok('읽는 법이 보인다', (await page.locator('.ask-ikana').first().innerText()).includes('たべている'));
    ok('소리 듣기 버튼이 있다', await page.locator('.ask-say').count() === 2);
    /* AI는 틀린다. 안 적어 두면 여기서 본 걸 사전처럼 믿는다 */
    ok('AI가 답한 거라고 적혀 있다', (await page.locator('.ask-warn').innerText()).includes('AI'));
    ok('한 번 불렀다', calls.n === 1, `${calls.n}번`);

    /* ★ 창이 열려 있는 동안 판정 키가 죽어 있어야 한다 ★
       질문 치다가 3을 누르면 「알아요」로 넘어가 버린다. */
    const before = await page.locator('.sh-title').innerText();
    await page.locator('.ask-text').click();       // 초점을 글상자 밖으로
    await page.keyboard.press('3');
    await page.waitForTimeout(400);
    ok('창이 열려 있으면 판정 키가 안 먹는다',
      (await page.locator('.sh-title').innerText()) === before, before);
    ok('창도 그대로 열려 있다', await page.locator('.sheet.open .asksheet').count() === 1);

    /* 단어장으로 옮겨진다 — 물어보고 끝나면 아무것도 안 남는다 */
    await page.locator('.ask-add').first().click();
    await page.waitForTimeout(500);
    const custom = await page.evaluate(
      () => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'),
    );
    ok('물어본 표현을 단어장에 담을 수 있다',
      custom.some((w) => w.kanji === '食べている'), custom.map((w) => w.kanji).join(', ') || '없음');
    ok('담은 것도 회독이 아는 모양이다',
      custom.every((w) => w.id && w.kana && 'mean' in w));

    /* 같은 걸 두 번 물으면 요금이 두 번 나가면 안 된다 */
    await page.locator('.asksheet textarea').fill('  食べている는   뭐야?  ');
    await page.locator('.asksheet .submit-btn').click();
    await page.waitForTimeout(700);
    ok('같은 질문은 다시 안 부른다', calls.n === 1, `${calls.n}번`);
    ok('그래도 답은 보인다', (await page.locator('.ask-text').innerText()).includes('진행형'));

    /* 기기에 남는다 — 비행기 안에서 다시 봐야 한다 */
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem('jp_manabu_asks_v1') || '[]'),
    );
    ok('물어본 게 기기에 남는다', saved.length === 1 && saved[0].items.length === 2);

    /* Esc는 창만 닫는다 — 학습을 끝내면 안 된다 */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    ok('Esc를 누르면 창만 닫힌다', await page.locator('.sheet.open .asksheet').count() === 0);
    ok('학습은 그대로다', await page.locator('.judgerow').count() === 1);

    await page.close();
  }

  /* ── 3. AI가 이상한 걸 보내도 ── */
  console.log('\n[ 이상한 답이 와도 ]');
  {
    const page = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' });
    page.on('pageerror', (e) => errors.push(e.message));
    await startStudy(page);
    await page.context().setOffline(false);
    await openAsk(page);

    /* items가 통째로 빠진 답 — 화면이 죽으면 안 된다 */
    await stubAI(page, { answer: '잘 모르겠어요. 사전을 한 번 더 확인해 보세요.' });
    await page.locator('.asksheet textarea').fill('이건 뭐야?');
    await page.locator('.asksheet .submit-btn').click();
    await page.waitForTimeout(900);
    ok('표현이 없는 답도 뜬다', (await page.locator('.ask-text').innerText()).includes('모르겠'));
    ok('빈 표현 자리는 안 그린다', await page.locator('.ask-item').count() === 0);

    await page.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
