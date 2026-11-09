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
  ok('오늘 화면에는 떠 있는 곤 단추가 있다', await page.locator('.gonfab').count() === 1);
  /* 상단 바가 있는 화면은 떠 있는 단추 대신 상단 곤 얼굴이 연다(아래 버튼을 안 가리게) */
  await goTab(page, '학습');
  await page.waitForTimeout(400);
  ok('★ 학습 탭에는 떠 있는 단추 대신 상단 곤 얼굴(AI)이 있다 ★', await page.locator('.gonfab').count() === 0 && await page.locator('.hunter-app-ask').count() === 1 && (await page.locator('.hunter-app-ask .hunter-app-ai').innerText()).trim() === 'AI');
  const hb = await page.locator('.hunter-app-ask').boundingBox();
  ok('상단 곤 얼굴도 누르는 자리가 44px다', hb.width >= 43.5 && hb.height >= 43.5, `${hb.width}x${hb.height}`);
  await page.locator('.hunter-app-ask').click();
  await page.waitForTimeout(500);
  ok('★ 상단 곤 얼굴을 누르면 같은 질문 창이 열린다 ★', await page.locator('.sheet.open .asksheet').count() === 1);
  await page.locator('.sheet.open .sheet-x').click();
  await page.waitForTimeout(500);
  await goTab(page, '오늘');
  await page.waitForTimeout(400);
  ok('★ 단추에 「AI」 표시가 있다 ★', (await page.locator('.gonfab .gonfab-ai').innerText()).trim() === 'AI');
  ok('곤 얼굴 그림이 있다', await page.locator('.gonfab img').count() === 1);
  const fab = await page.locator('.gonfab').boundingBox();
  const bar = await page.locator('.tabbar').boundingBox();
  const vp = page.viewportSize();
  ok('★ 우측 하단, 탭바 바로 위에 있다 ★', fab && bar && fab.x + fab.width > vp.width * 0.8 && fab.y + fab.height <= bar.y, `${Math.round(fab.x)},${Math.round(fab.y)} / 탭바 ${Math.round(bar.y)}`);
  ok('손가락으로 누를 크기(40px 이상)', fab.width >= 40 && fab.height >= 40);

  console.log('\n[ 눌러서 묻기 ]');
  await page.locator('.gonfab').click();
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
  ok('★ 답은 곤이 알려 준다 ★', (await page.locator('.ask-ans .hunter-tutor').getAttribute('data-guide')) === 'gon');
  ok('AI가 답한 거라고 적혀 있다', (await page.locator('.ask-warn').innerText()).includes('AI'));
  ok('한 번 불렀다', calls.n === 1, `${calls.n}번`);
  ok('카드 정보 없이 질문만 보냈다', !JSON.stringify(calls.last || {}).includes('[지금 보는 카드]'));

  console.log('\n[ 닫기 ]');
  await page.locator('.sheet.open .sheet-x').click();
  await page.waitForTimeout(600);
  ok('✕로 닫힌다', await page.locator('.sheet.open .asksheet').count() === 0);

  console.log('\n[ 작게 접고 펼치기 ]');
  const big = await page.locator('.gonfab img').boundingBox();
  ok('펼친 단추 위에 접기(−) 버튼이 있다', await page.locator('.gonfab-fold').count() === 1);
  const fb = await page.locator('.gonfab-fold').boundingBox();
  ok('접기 버튼도 누르는 자리는 44px다', fb.width >= 43.5 && fb.height >= 43.5 && fb.y + fb.height <= big.y + 1, `${fb.width}x${fb.height}`);
  await page.locator('.gonfab-fold').click();
  await page.waitForTimeout(300);
  const small = await page.locator('.gonfab.mini img').boundingBox();
  const miniBtn = await page.locator('.gonfab.mini').boundingBox();
  ok('접힌 얼굴도 누르는 자리는 44px다', miniBtn.width >= 43.5 && miniBtn.height >= 43.5, `${miniBtn.width}x${miniBtn.height}`);
  ok('★ 접으면 작은 곤 얼굴만 남는다 ★', small && small.width <= 30 && small.width < big.width && await page.locator('.gonfab-ai').count() === 0, `${big.width} → ${small?.width}`);
  await page.locator('.gonfab.mini').click();
  await page.waitForTimeout(300);
  ok('★ 접힌 얼굴을 누르면 질문 창이 아니라 다시 펼쳐진다 ★', await page.locator('.sheet.open .asksheet').count() === 0 && (await page.locator('.gonfab img').boundingBox()).width >= 40);
  await page.locator('.gonfab-fold').click();
  await page.waitForTimeout(200);
  /* 접힘을 기억하는지 — 저장소만 본다(오프라인 새로고침은 서비스워커 사정을 타서 이 검사의 일이 아니다) */
  ok('★ 접어 둔 상태가 저장된다 ★', await page.evaluate(() => localStorage.getItem('jp_gonfab_mini')) === '1');
  /* 접어 둔 채 저장된 기기로 새로 열면 접혀 있다 */
  const again = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' }, { jp_gonfab_mini: '1' });
  ok('★ 접어 둔 상태를 기억한다(다시 열어도 접혀 있다) ★', await again.locator('.gonfab.mini').count() === 1 && await again.locator('.gonfab-fold').count() === 0);
  await again.close();
  ok('접힌 뒤에도 곤 단추가 그대로 있다', await page.locator('.gonfab').count() === 1);

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
