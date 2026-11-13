/* 잘못 눌린 입력 막기 + 모바일 입력칸 확대 막기.
 *
 *   1. 같은 키를 0.2초 안에 또 누르면 한 번으로 본다 — 「답 보기」(Enter) 바로 뒤의 Enter가 「알아요」로 기록되지 않는다
 *   2. 같은 자리를 0.2초 안에 또 누르면 한 번으로 본다 — 「알아요」를 두 번 눌러 다음 카드까지 넘어가지 않는다
 *      (자동 조작에서는 이 틈이 꺼진다 — 검사는 사람보다 빨리 눌러서다. 여기서만 jp_input_guard = 'on'으로 켜고 본다)
 *   3. 손가락으로 쓰는 기기에서 입력칸 글자는 16px 이상이다 — iOS는 그보다 작으면 초점이 갈 때 화면을 확대한다 */
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

async function boot(browser, settings = {}, context = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, ...context });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_input_guard', 'on');   // 자동 조작에서는 꺼지는 틈을 이 검사에서만 켠다(lib/useHotkeys.js inputGapMs)
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, settings);
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

const reviewCount = (page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 같은 키를 연달아 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await startStudy(page);
    await page.locator('.sc-reveal').waitFor({ timeout: 15000 });
    const n0 = await reviewCount(page);
    /* 손이 튀어 Enter가 두 번 들어갔다 — 답은 보이되 판정은 안 적혀야 한다 */
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    ok('★ Enter 두 번 — 답만 보이고 「알아요」로 기록되지 않는다 ★', await page.locator('.judge.known').count() === 1 && await reviewCount(page) === n0, `${n0} → ${await reviewCount(page)}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    ok('0.2초가 지난 뒤의 Enter는 「알아요」로 받는다', await reviewCount(page) === n0 + 1, `${n0} → ${await reviewCount(page)}`);
    /* 다른 키는 바로 받는다 — Enter(답 보기) 뒤에 곧바로 1(몰라요) */
    await page.locator('.sc-reveal').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    ok('★ 다른 키는 바로 받는다(Enter 뒤 곧바로 1) ★', await reviewCount(page) === n0 + 2, `${n0} → ${await reviewCount(page)}`);
    await page.close();
  }

  console.log('\n[ 같은 자리를 연달아 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await startStudy(page);
    await page.locator('.sc-reveal').waitFor({ timeout: 15000 });
    const n0 = await reviewCount(page);
    await page.locator('.sc-reveal').click();
    await page.locator('.judge.known').waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const box = await page.locator('.judge.known').boundingBox();
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    /* 「알아요」가 두 번 눌렸다 — 한 장만 넘어가야 한다. 둘째 클릭이 다음 카드의 그 자리에 들어가면 안 된다 */
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await page.waitForTimeout(700);
    ok('★ 같은 자리 두 번 — 판정은 한 번만 적힌다 ★', await reviewCount(page) === n0 + 1, `${n0} → ${await reviewCount(page)}`);
    ok('다음 카드는 아직 앞면이다(둘째 클릭이 안 들어갔다)', await page.locator('.sc-reveal').count() === 1 && await page.locator('.judge.known').count() === 0);
    /* 0.2초 뒤에는 같은 자리도 받는다 */
    await page.locator('.sc-reveal').click();
    await page.locator('.judge.known').waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator('.judge.known').click();
    await page.waitForTimeout(600);
    ok('틈을 두고 누르면 그대로 받는다', await reviewCount(page) === n0 + 2, `${n0} → ${await reviewCount(page)}`);
    await page.close();
  }

  console.log('\n[ 모바일 입력칸 — 초점이 갈 때 화면이 확대되지 않게 ]');
  {
    /* 손가락으로 쓰는 기기(hover 없음 · 굵은 포인터) */
    const page = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' }, { hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errors.push(e.message));
    ok('손가락 기기로 보인다', await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches));
    await page.locator('.hunter-top-ask').click();
    await page.locator('.asksheet textarea').waitFor({ timeout: 8000 });
    const fs = await page.locator('.asksheet textarea').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    ok('★ 곤에게 물어보기 입력칸 글자가 16px 이상이다 ★', fs >= 16, `${fs}px`);
    ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    /* 앱에 있는 입력칸 모양을 다 재 본다 — 하나라도 16px보다 작으면 그 칸에서 화면이 커진다 */
    const small = await page.evaluate(() => {
      const shapes = [
        ['input', 'search-input', ''], ['textarea', 'search-input', ''], ['textarea', 'memo-input', ''], ['textarea', 'tr-input', ''],
        ['input', 'search-input cmp-input', ''], ['input', 'search-input cmp-ko', ''], ['textarea', 'search-input cmp-mine', ''],
        ['input', 'search-input st-input', ''], ['input', 'search-input sp-topic', ''], ['input', 'search-input swl-input', ''],
        ['input', 'search-input', 'qtyping'], ['input', 'ob-date', ''], ['textarea', 'vd-prompt', ''], ['textarea', 'vd-script', ''],
        ['textarea', 'search-input vd-script', ''], ['input', 'vd-delword', ''], ['input', '', 'vd-add'], ['input', '', 'field'], ['select', '', 'field'],
        ['input', '', 'setrow'], ['input', '', 'mistake-retest'], ['input', '', ''], ['textarea', '', ''], ['select', '', ''],
      ];
      const out = [];
      for (const [tag, cls, wrap] of shapes) {
        const box = document.createElement('div'); box.className = wrap;
        const el = document.createElement(tag); el.className = cls;
        box.appendChild(el); document.body.appendChild(box);
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px < 16) out.push(`${wrap ? `.${wrap} ` : ''}${tag}${cls ? `.${cls.replace(/ /g, '.')}` : ''} ${px}px`);
        box.remove();
      }
      return out;
    });
    ok('★ 어느 입력칸도 16px보다 작지 않다 ★', small.length === 0, small.join(' | ') || '모두 16px 이상');
    const big = await page.evaluate(() => {
      const box = document.createElement('div'); box.className = 'qtyping';
      const el = document.createElement('input'); el.className = 'search-input'; box.appendChild(el); document.body.appendChild(box);
      const a = parseFloat(getComputedStyle(el).fontSize); box.remove();
      const el2 = document.createElement('input'); el2.className = 'search-input swl-input'; document.body.appendChild(el2);
      const b = parseFloat(getComputedStyle(el2).fontSize); el2.remove();
      return [a, b];
    });
    ok('더 큰 글자를 쓰던 칸은 줄어들지 않는다(시험 답 17 · 스위스 18)', big[0] === 17 && big[1] === 18, big.join(' · '));
    await page.close();

    /* 마우스를 쓰는 기기는 그대로다 */
    const desk = await boot(browser, { geminiKey: 'AQ.test-not-a-real-key' });
    const dfs = await desk.evaluate(() => { const el = document.createElement('input'); el.className = 'search-input'; document.body.appendChild(el); const px = parseFloat(getComputedStyle(el).fontSize); el.remove(); return px; });
    ok('PC에서는 입력칸 글자 크기가 그대로다(13.5px)', dfs === 13.5, `${dfs}px`);
    await desk.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
