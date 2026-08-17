import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e ? '— ' + e : ''); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 로그인 게이트를 오프라인 통행으로 통과
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    // 온보딩은 이번 검증 대상이 아니라 끝난 것으로 둔다
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1200);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }

  // 발화 시각을 기록한다 (내장 음성 경로를 가로챈다)
  await page.evaluate(() => {
    window._spoken = [];
    const t0 = Date.now();
    window.speechSynthesis.speak = (u) => window._spoken.push({ text: u.text, at: Date.now() - t0 });
    window.speechSynthesis.cancel = () => {};
  });

  // 설정에서 "판정할 때 읽어주기"를 켠다
  await page.locator('.tabbar button', { hasText: '설정' }).click();
  await page.waitForTimeout(500);
  const toggle = page.locator('.setrow', { hasText: '판정할 때 읽어주기' });
  ok('설정에 옵션이 생김', await toggle.count() > 0);
  await toggle.locator('button, .toggle').first().click().catch(async () => {
    await toggle.click();
  });
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').speakOnJudge);
  ok('설정이 저장됨', on === true, String(on));

  // 학습으로 들어가 판정해 본다
  await page.locator('.tabbar button', { hasText: '학습' }).click();
  await page.waitForTimeout(1200);
  const card = await page.locator('.judge.known').count();
  ok('학습 카드 진입', card > 0);

  await page.evaluate(() => { window._spoken = []; });
  await page.locator('.judge.known').click();          // 알아요
  await page.waitForTimeout(200);
  let spoken = await page.evaluate(() => window._spoken);
  ok('알아요 누르면 그 단어를 읽어줌', spoken.length >= 1, JSON.stringify(spoken.map((s) => s.text)));
  const judged = spoken[0];

  // 다음 카드의 자동 음성이 곧바로 끊지 않고 기다렸다가 나오는지
  await page.waitForTimeout(1400);
  spoken = await page.evaluate(() => window._spoken);
  ok('다음 카드도 이어서 읽어줌', spoken.length >= 2, JSON.stringify(spoken.map((s) => s.text)));
  if (spoken.length >= 2) {
    const gap = spoken[1].at - judged.at;
    ok('판정 음성이 끊기지 않게 간격을 둠', gap >= 800, `${gap}ms`);
    ok('서로 다른 단어를 읽음', spoken[0].text !== spoken[1].text, `${spoken[0].text} → ${spoken[1].text}`);
  }

  // 빠르게 연속 판정해도 뒤늦게 겹쳐 울리지 않아야 한다
  await page.evaluate(() => { window._spoken = []; });
  for (let i = 0; i < 3; i += 1) {
    await page.locator('.judge.known').click();
    await page.waitForTimeout(260);
  }
  await page.waitForTimeout(1600);
  spoken = await page.evaluate(() => window._spoken);
  const times = spoken.map((s) => s.at);
  const tooClose = times.filter((t, i) => i > 0 && t - times[i - 1] < 120).length;
  ok('연속 판정에도 소리가 겹치지 않음', tooClose === 0, `${spoken.length}회 재생`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
