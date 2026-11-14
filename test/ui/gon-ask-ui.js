/* 곤에게 물어보기(AI) — 어느 화면에서든 우측 하단의 곤 얼굴 단추로 질문 창을 연다. AI는 실제로 안 부르고 가짜 답을 놓는다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

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

async function boot(browser, settings = {}, storage = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([s, st]) => {
    for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, [settings, storage]);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  /* 껍데기가 뜰 때까지 기다린다 — 안 기다리면 느린 기기에서 아직
     안 그려진 화면을 누르게 된다. 끝내 안 뜨면 뒤따르는 검사가
     제 말로 실패하는 쪽이 읽기 쉽다. */
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

/* AI 자리에 가짜 답을 놓는다. 몇 번 불렸는지도 센다 —
   같은 걸 두 번 물었을 때 요금이 두 번 나가는지 보려면 그 숫자가 필요하다. */
async function stubAI(page, body = ANSWER) {
  const calls = { n: 0 };
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    calls.n += 1; calls.last = route.request().postData();
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



(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' });
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 곤 얼굴 단추 ]');
  await goTab(page, '오늘');
  await page.waitForTimeout(400);
  ok('★ 오늘 화면에도 떠 있는 단추가 없고, 머리에 곤 얼굴(AI)이 있다 ★', await page.locator('.gonfab').count() === 0 && await page.locator('.hunter-top-ask').count() === 1 && (await page.locator('.hunter-top-ask .hunter-app-ai').innerText()).trim() === 'AI');
  /* 상단 바가 있는 화면은 떠 있는 단추 대신 상단 곤 얼굴이 연다(아래 버튼을 안 가리게) */
  await goTab(page, '학습');
  await page.waitForTimeout(400);
  ok('★ 학습 탭에는 떠 있는 단추 대신 상단 곤 얼굴(AI)이 있다 ★', await page.locator('.gonfab').count() === 0 && await page.locator('.hunter-appbar .hunter-app-ask').count() === 1 && (await page.locator('.hunter-appbar .hunter-app-ask .hunter-app-ai').innerText()).trim() === 'AI');
  const hb = await page.locator('.hunter-appbar .hunter-app-ask').boundingBox();
  ok('상단 곤 얼굴도 누르는 자리가 44px다', hb.width >= 43.5 && hb.height >= 43.5, `${hb.width}x${hb.height}`);
  await page.locator('.hunter-appbar .hunter-app-ask').click();
  await page.waitForTimeout(500);
  ok('★ 상단 곤 얼굴을 누르면 같은 질문 창이 열린다 ★', await page.locator('.sheet.open .asksheet').count() === 1);
  await page.locator('.sheet.open .sheet-x').click();
  await page.waitForTimeout(500);
  await goTab(page, '오늘');
  await page.waitForTimeout(400);
  ok('곤 얼굴 그림이 있다', await page.locator('.hunter-top-ask img').count() === 1);
  const fab = await page.locator('.hunter-top-ask').boundingBox();
  ok('★ 머리 오른쪽 위에 있다 · 누르는 자리가 44px다 ★', fab && fab.y < 90 && fab.x + fab.width > page.viewportSize().width * 0.8 && fab.width >= 43.5 && fab.height >= 43.5, `${Math.round(fab.x)},${Math.round(fab.y)} ${fab.width}x${fab.height}`);
  /* 떠 있던 단추는 퀘스트 줄의 오른쪽(진행 숫자 · 화살표)을 가렸다 */
  const covered = await page.evaluate(() => {
    const f = document.querySelector('.hunter-top-ask').getBoundingClientRect();
    return [...document.querySelectorAll('.tdq-row, .bigcta')].some((e) => { const r = e.getBoundingClientRect(); return !(f.right <= r.left || r.right <= f.left || f.bottom <= r.top || r.bottom <= f.top); });
  });
  ok('★ 큰 버튼 · 퀘스트 줄을 가리지 않는다 ★', !covered);

  console.log('\n[ 눌러서 묻기 ]');
  await page.locator('.hunter-top-ask').click();
  await page.waitForTimeout(500);
  ok('질문 창이 열린다', await page.locator('.sheet.open .asksheet').count() === 1);
  ok('제목이 「곤에게 물어보기」 + AI 표시', (await page.locator('.asksheet h3').innerText()).includes('곤에게 물어보기') && (await page.locator('.asksheet .ask-aitag').innerText()).trim() === 'AI');
  ok('카드 없이도 묻는다(카드 칩이 없다)', await page.locator('.ask-chip').count() === 0);

  /* ★ 글을 치는 중에 뒤쪽 화면이 초점을 가져가려 해도 글상자에 남는다 ★ */
  await page.locator('.asksheet textarea').focus();
  await page.evaluate(() => { document.querySelector('.tabbar button, .tabbar .tab')?.focus(); });
  await page.waitForTimeout(150);
  ok('★ 뒤쪽 화면이 저절로 초점을 가져가도 질문 글상자에 남는다 ★', await page.evaluate(() => document.activeElement?.matches?.('.asksheet textarea')));

  await page.context().setOffline(false);
  const calls = await stubAI(page);
  await page.locator('.asksheet textarea').fill('食べている는 언제 써?');
  await page.locator('.asksheet .submit-btn').click();
  await page.waitForTimeout(900);
  ok('답이 뜬다', (await page.locator('.ask-text').innerText()).includes('진행형'));
  /* ★ 답이 온 뒤 다시 누르지 않고 바로 다음 질문을 친다 ★ (잠갔다 풀면서 초점이 빠지던 것 · 초점이 단추로 튀던 것) */
  await page.keyboard.type('next');
  ok('★ 답이 온 뒤에도 초점이 글상자에 있고, 글상자는 비워져 다음 질문이 바로 들어간다 ★', (await page.locator('.asksheet textarea').inputValue()) === 'next', await page.locator('.asksheet textarea').inputValue());
  await page.locator('.asksheet textarea').fill('');
  ok('★ 답은 곤이 알려 준다 ★', (await page.locator('.ask-ans .hunter-tutor').getAttribute('data-guide')) === 'gon');
  ok('AI가 답한 거라고 적혀 있다', (await page.locator('.ask-warn').innerText()).includes('AI'));
  ok('한 번 불렀다', calls.n === 1, `${calls.n}번`);
  ok('카드 정보 없이 질문만 보냈다', !JSON.stringify(calls.last || {}).includes('[지금 보는 카드]'));

  console.log('\n[ 닫기 ]');
  await page.locator('.sheet.open .sheet-x').click();
  await page.waitForTimeout(600);
  ok('✕로 닫힌다', await page.locator('.sheet.open .asksheet').count() === 0);

  console.log('\n[ 바로 묻기 — 한자 설명 · 외우는 법 추천 ]');
  {
    await page.locator('.hunter-top-ask').click();
    await page.waitForTimeout(500);
    ok('글상자 밑에 「한자 설명」 · 「외우는 법 추천」이 있다', (await page.locator('.ask-presets .ask-preset').allInnerTexts()).join('|') === '한자 설명|외우는 법 추천');
    const before = calls.n;
    await page.locator('.asksheet textarea').fill('');
    await page.locator('.ask-preset[data-preset="kanji"]').click();
    await page.waitForTimeout(300);
    ok('★ 낱말을 안 적고 누르면 부르지 않고 알려 준다 ★', calls.n === before && (await page.locator('.ask-err').innerText()).includes('글상자에 적고'));
    /* 한자를 몰라서 묻는 것이다 — 한글로 적고 눌러도 그 낱말의 일본어 한자를 찾아 설명해 준다 */
    const hcalls = await stubAI(page, { answer: '지하철은 일본어로 地下鉄(ちかてつ)라고 써요.', items: [{ jp: '地下鉄', kana: 'ちかてつ', ko: '지하철', note: '' }],
      kanji: [{ char: '地', hanja: '땅 지', korean: '한국어에서도 써요: 지구(地球)', parts: '土(흙 토) + 也', more: '음독 チ · ジ' }, { char: '下', hanja: '아래 하', korean: '한국어에서도 써요: 지하(地下)', parts: '가로선 아래를 가리키는 모양', more: '음독 カ · ゲ' }, { char: '鉄', hanja: '쇠 철(鐵)', korean: '한국어에서도 써요: 철도(鐵道)', parts: '金(쇠 금) + 失', more: '', on: 'テツ', kun: '' }], tips: [], word: { jp: '地下鉄', kana: 'ちかてつ' } });
    await page.locator('.asksheet textarea').fill('지하철');
    await page.locator('.ask-preset[data-preset="kanji"]').click();
    await page.locator('.ask-kanji').first().waitFor({ timeout: 8000 });
    ok('★ 한글로 적고 「한자 설명」을 눌러도 묻는다(일본어 한자로 어떻게 쓰는지부터) ★', hcalls.n === 1 && JSON.stringify(hcalls.last).includes('「지하철」를 일본어 한자로 어떻게 쓰는지') && JSON.stringify(hcalls.last).includes('[요청] 한자 설명'));
    const hk = (await page.locator('.asksheet').innerText()).replace(/\s+/g, ' ');
    ok('★ 일본어 낱말(地下鉄)과 글자마다의 풀이가 보인다 ★', await page.locator('.ask-kanji').count() === 3 && hk.includes('地下鉄') && hk.includes('땅 지') && hk.includes('아래 하') && hk.includes('쇠 철'), hk.slice(0, 120));
    const wd = (await page.locator('.ask-word').innerText()).replace(/\s+/g, ' ');
    ok('★ 낱말의 「일본어 읽기」와 「한국 한자음」을 따로 적는다 ★', wd.includes('地下鉄') && /일본어 읽기\s*ちかてつ/.test(wd) && /한국 한자음\s*지하철/.test(wd) && wd.includes('일본어 발음이 아니에요'), wd);
    const k3 = (await page.locator('.ask-kanji').nth(2).innerText()).replace(/\s+/g, ' ');
    ok('★ 글자마다 「한국 훈음」과 「일본어 읽기(음독)」가 이름표를 달고 따로 보인다 ★', /한국 훈음\s*쇠 철/.test(k3) && /일본어 읽기\s*음독 テツ/.test(k3), k3);
    await page.unroute('**/generativelanguage.googleapis.com/**');

    const kcalls = await stubAI(page, { answer: '習는 되풀이해 익힌다는 글자예요.', items: [{ jp: '練習', kana: 'れんしゅう', ko: '연습', note: '' }],
      kanji: [{ char: '習', hanja: '익힐 습', korean: '한국어에서도 써요: 학습(學習) · 연습(練習)', parts: '羽(깃 우) + 白(흰 백). 어린 새가 날갯짓을 되풀이하는 모습이라고 풀이해요.', more: '음독 シュウ, 훈독 なら(う).' }], tips: [] });
    await page.locator('.asksheet textarea').fill('習う');
    await page.locator('.ask-preset[data-preset="kanji"]').click();
    await page.locator('.ask-kanji').first().waitFor({ timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.ask-q')?.textContent.includes('習う'), null, { timeout: 8000 });   // 앞 답(地下鉄)이 아니라 이번 답이 뜬 뒤에 본다
    ok('★ 정해 둔 글로 한 번 묻는다 ★', kcalls.n === 1 && JSON.stringify(kcalls.last).includes('「習う」의 한자를 설명해 줘'));
    ok('★ 단추로 물었다고 알려 보낸다([요청] 한자 설명) ★', JSON.stringify(kcalls.last).includes('[요청] 한자 설명'));
    const k = (await page.locator('.ask-kanji').first().innerText()).replace(/\s+/g, ' ');
    ok('★ 글자마다 한국 한자음 · 한국어에서의 쓰임 · 짜임 · 덧붙임이 보인다 ★', k.includes('習') && k.includes('익힐 습') && k.includes('한국어에서') && k.includes('학습(學習)') && k.includes('짜임') && k.includes('羽') && k.includes('덧붙임'), k.slice(0, 120));
    ok('물어본 글이 답 위에 남는다', (await page.locator('.ask-q').innerText()).includes('한자를 설명해 줘'));
    ok('가로로 넘치지 않는다(한자 설명)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    /* 같은 답(글자별 풀이가 든)이 와도, 글로 그냥 물은 것에는 글자별 풀이를 보이지 않는다 */
    await page.locator('.asksheet textarea').fill('習う는 언제 써?');
    await page.locator('.asksheet .ask-box > .submit-btn').click();
    await page.waitForFunction(() => document.querySelector('.ask-q')?.textContent.includes('언제 써'), null, { timeout: 8000 });
    ok('★ 그냥 물은 것에는 글자별 한자 풀이가 안 붙는다 ★', kcalls.n === 2 && await page.locator('.ask-kanji').count() === 0 && (await page.locator('.asksheet').innerText()).includes('되풀이해 익힌다') && !JSON.stringify(kcalls.last).includes('[요청] 한자 설명'), `${kcalls.n}번`);

    const mcalls = await stubAI(page, { answer: '소리로 거는 쪽을 권해요.', items: [], kanji: [],
      tips: [{ kind: '소리', text: '「배울 사람 나라우(나와라)!」 하고 부르면 배우다.' }, { kind: '한자', text: '習는 학습(學習)의 습 — 익히는 것이 배우는 것.' }] });
    await page.locator('.asksheet textarea').fill('習う');
    await page.locator('.ask-preset[data-preset="memo"]').click();
    await page.locator('.ask-tip').first().waitFor({ timeout: 8000 });
    ok('★ 외우는 법을 두세 개 권한다(종류 표시와 함께) ★', mcalls.n === 1 && JSON.stringify(mcalls.last).includes('외우는 법을 추천해 줘') && await page.locator('.ask-tip').count() === 2 && (await page.locator('.ask-tip').first().innerText()).includes('소리') && (await page.locator('.ask-tip').first().innerText()).includes('나라우'));
    ok('카드 없이 물었을 때는 메모에 담는 단추가 없다', await page.locator('.ask-usetip').count() === 0);
    await page.locator('.asksheet textarea').fill('習う');
    await page.locator('.ask-preset[data-preset="memo"]').click();
    await page.waitForTimeout(500);
    ok('★ 같은 걸 또 누르면 다시 부르지 않고 받아 둔 답을 보여 준다 ★', mcalls.n === 1 && await page.locator('.ask-tip').count() === 2);
    await page.locator('.sheet.open .sheet-x').click();
    await page.waitForTimeout(500);
  }

  console.log('\n[ 회독(카드 학습) 화면에도 단추가 있다 ]');
  {
    const st = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' });
    st.on('pageerror', (e) => errors.push(e.message));
    await goTab(st, '오늘');
    await st.locator('.tdq-row', { hasText: '새로 배우기' }).click();
    await st.waitForTimeout(1200);
    const startBtn = st.locator('.study .submit-btn, .study .intro-start, .study .start-btn').first();
    if (await st.locator('.study-intro, .intro').count() && await startBtn.count()) { await startBtn.click(); await st.waitForTimeout(500); }
    ok('회독 화면이 열려 있다(탭바가 없다)', await st.locator('.study').count() >= 1 && await st.locator('.tabbar').count() === 0);
    ok('★ 회독 화면에도 곤 단추가 있다(위쪽 모서리) ★', await st.locator('.gonfab').count() === 1 && (await st.locator('.gonfab').boundingBox()).y < 60, String((await st.locator('.gonfab').boundingBox()).y));
    const top = await st.evaluate(() => { const e = document.querySelector('.gonfab'); const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === t || e.contains(t); });
    ok('가려지지 않고 눌린다', top);
    /* 카드를 뒤집어 판정 단추가 나왔을 때 단추와 겹치지 않는다 */
    await st.locator('.studycard').click().catch(() => {});
    await st.locator('.judgerow').waitFor({ timeout: 4000 }).catch(() => {});
    if (await st.locator('.judgerow').count()) {
      const fb2 = await st.locator('.gonfab').boundingBox();
      const rows = await st.locator('.judgerow button').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      const overlap = rows.some((r) => !(fb2.x + fb2.width <= r.x || r.x + r.w <= fb2.x || fb2.y + fb2.height <= r.y || r.y + r.h <= fb2.y));
      ok('★ 판정 단추를 가리지 않는다 ★', !overlap, `곤 ${Math.round(fb2.x)},${Math.round(fb2.y)}`);
    }
    await st.locator('.gonfab').click();
    await st.waitForTimeout(500);
    ok('★ 눌러서 질문 창이 열린다 ★', await st.locator('.sheet.open .asksheet').count() === 1);
    await st.locator('.sheet.open .sheet-x').click();
    await st.waitForTimeout(500);
    ok('닫으면 학습 중인 자리 그대로', await st.locator('.study').count() >= 1 && await st.locator('.sheet.open .asksheet').count() === 0);
    await st.close();
  }

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
