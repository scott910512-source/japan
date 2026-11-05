/* 보기 읽기 · 뜻 · 듣기 2차 — 부사 · 동사 활용 · 짝 맞추기 · 독일어(독일어식) — 펼친 기본 상태에서.
 *
 *   · 부사: 보기마다 읽기 · 뜻 · 🔊, 맞혀도 저절로 안 넘어가고 「다음」을 누른다
 *   · 동사 활용: 진짜 활용형은 무슨 모양인지 + 🔊, 틀린 활용은 소리 없이 「틀린 활용」
 *   · 짝 맞추기: 한 판을 다 맞히면 쌍마다 읽기 · 뜻 · 🔊를 보고 「다음 판」
 *   · 독일어: 독일어 음성(de-DE) 🔊 · 한글 발음 · 뜻, 일본어 칸이 아니라 독일어 전용 칸 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 독일어 소리를 검사하려고 목소리 목록을 흉내 낸다 — 진짜 엔진은 헤드리스에서 못 쓴다 */
const VOICES = `
  window.__said = [];
  (() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const list = [{ voiceURI: 'ko', name: 'Yuna', lang: 'ko-KR' }, { voiceURI: 'de', name: 'Anna', lang: 'de-DE' }, { voiceURI: 'ja', name: 'Kyoko', lang: 'ja-JP' }];
    synth.getVoices = () => list;
    Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', { configurable: true, get() { return this.__voice || null; }, set(v) { this.__voice = v; } });
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '', voice: u?.voice?.lang || null });
      setTimeout(() => { try { u.onstart?.(); } catch {} }, 10);
      setTimeout(() => { try { u.onend?.(); } catch {} }, 600);
    };
    synth.cancel = () => {};
  })();
`;

async function boot(browser, settings = {}, init = null, review = null) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  if (init) await page.addInitScript(init);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([s, review]) => {
    if (review) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, [settings, review]);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
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


(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 부사 연습 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '부사 연습');
    await page.locator('.av-set').first().click();
    await page.waitForTimeout(500);
    ok('답을 내기 전에는 오른쪽 읽기·뜻이 없다', await page.locator('.optwrap .optaside, .optwrap .optspks').count() === 0);
    const n = await page.locator('.qopt').count();
    // 정답을 고른다 — 정답은 고른 뒤에야 알 수 있으니 첫 보기를 눌러 맞으면 홀드를, 틀리면 다음 버튼을 본다
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(500);
    ok('★ 큰 패널 없이 줄마다 🔊가 붙는다 ★', await page.locator('.optrev').count() === 0 && await page.locator('.optwrap .optspks .spk').count() === n);
    ok('★ 부사 보기에 뜻(한국어)이 오른쪽에 붙는다 ★', await page.locator('.optaside').count() >= 1, (await page.locator('.optaside').allInnerTexts()).join(' / ').slice(0, 60));
    await page.waitForTimeout(1500);
    ok('★ 맞혀도 틀려도 저절로 안 넘어간다(같은 문제) ★', await page.locator('.optwrap .optspks').count() === n);
    await page.close();
  }

  console.log('\n[ 동사 활용 ]');
  {
    const page = await boot(browser);
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '동사 활용');
    await page.locator('.subscreen .bigstart').click();
    await page.waitForTimeout(500);
    const n = await page.locator('.qoptions .qopt').count();
    await page.locator('.qoptions .qopt').first().click();
    await page.waitForTimeout(400);
    ok('★ 큰 패널 없이 줄마다 오른쪽에 붙는다 ★', await page.locator('.optrev').count() === 0 && await page.locator('.optwrap .optaside').count() >= 1);
    const rows = await page.locator('.optwrap').evaluateAll((els) => els.map((e) => ({ spk: e.querySelectorAll('.optspks .spk').length, ko: e.querySelector('.optaside')?.textContent || '' })));
    ok('★ 진짜 활용형에는 모양 이름과 🔊 ★', rows.some((r) => r.spk === 1 && r.ko.includes('·')));
    ok('★ 틀린 활용은 소리 없이 「틀린 활용」 ★', rows.every((r) => r.spk === 1 || r.ko.includes('틀린 활용')));
    await page.close();
  }

  console.log('\n[ 짝 맞추기 ]');
  {
    const seen = Object.fromEntries(ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 30).map((w) => [w.id, { box: 3, lastSeen: '2026-01-01', due: '2026-01-02', rounds: 1, level: 1 }]));
    const page = await boot(browser, {}, null, seen);
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '짝 맞추기');
    await page.locator('.mt-pick').first().click();
    await page.waitForTimeout(600);
    /* 자료와 대조하지 않는다 — 같은 표기에 뜻이 둘인 낱말이 있어서 대조가 어긋난다.
       왼쪽 하나를 잡고 오른쪽 타일을 차례로 눌러, 짝이 맞아 사라질 때까지 한다(사람이 그렇게 한다) */
    const leftCount = await page.locator('.mt-col').first().locator('.mt-tile').count();
    for (let k = 0; k < leftCount; k++) {
      const left = page.locator('.mt-col').first().locator('.mt-tile:not(.gone)').first();
      const rights = page.locator('.mt-col').nth(1).locator('.mt-tile:not(.gone)');
      const rn = await rights.count();
      for (let j = 0; j < rn; j++) {
        await left.click();
        await rights.nth(j).click();
        await page.waitForTimeout(160);
        const stillThere = await page.locator('.mt-col').first().locator('.mt-tile:not(.gone)').count();
        if (stillThere < leftCount - k) break;           // 짝이 맞아 하나 줄었다
        await page.waitForTimeout(450);                  // 틀린 짝이 흔들리다 돌아올 때까지
      }
    }
    await page.waitForTimeout(900);
    ok('★ 한 판을 다 맞히면 저절로 안 넘어가고 「다음 판」이 있다 ★', await page.locator('.mt-nextround').count() === 1);
    ok('쌍마다 읽기 · 뜻 · 🔊 (다섯 쌍)', await page.locator('.optrev-row').count() === 5 && await page.locator('.optrev-spk').count() === 5);
    await page.locator('.mt-nextround').click();
    await page.waitForTimeout(500);
    ok('「다음 판」을 누르면 2판', (await page.locator('.mt-head').innerText()).includes('2 / 4'));
    await page.close();
  }

  console.log('\n[ 독일어 — 독일어식 칸 ]');
  {
    const page = await boot(browser, {}, VOICES);
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page, '독일어');
    await page.locator('.swh-next').click();
    await page.waitForTimeout(700);
    let seenChoice = false; let seenMatch = false;
    for (let k = 0; k < 16 && !(seenChoice && seenMatch); k++) {
      if (await page.locator('.swl-finish').count()) break;
      if (await page.locator('.swl-match').count()) {
        const ids = await page.locator('.swl-mleft').evaluateAll((els) => els.map((e) => e.dataset.id));
        for (const id of ids) {
          await page.locator(`.swl-mleft[data-id="${id}"]`).click();
          await page.locator(`.swl-mright[data-id="${id}"]`).click();
          await page.waitForTimeout(120);
        }
        await page.waitForTimeout(1000);
        if (!seenMatch) {
          seenMatch = true;
          ok('★ 짝 맞추기도 끝나면 낱말마다 발음 · 뜻 · 🔊를 보고 「계속」 ★', await page.locator('.optrev-de .optrev-row').count() === ids.length && await page.locator('.swl-next').count() === 1);
        }
        await page.locator('.swl-next').click().catch(() => {});
        await page.waitForTimeout(500);
        continue;
      }
      if (await page.locator('.swl-prompt').count() && await page.locator('.qopt').count()) {
        const n = await page.locator('.qopt').count();
        await page.locator('.qopt').first().click();
        await page.locator('.swl-check').click();
        await page.waitForTimeout(400);
        if (!seenChoice) {
          seenChoice = true;
          ok('★ 큰 패널 없이 보기 줄 오른쪽에 붙는다 ★', await page.locator('.optrev').count() === 0 && await page.locator('.swl-optwrap .swl-optside').count() === n, `${n}`);
          ok('★ 같은 줄: 보기 단추와 오른쪽 말·스피커가 한 칸 안에 있다 ★', await page.evaluate(() => [...document.querySelectorAll('.swl-optwrap')].every((w) => { const b = w.querySelector('.qopt').getBoundingClientRect(); const s = w.querySelector('.swl-optspks .spk').getBoundingClientRect(); return s.top >= b.top && s.bottom <= b.bottom && s.left >= b.left; })));
          ok('줄마다 스피커가 있다', await page.locator('.swl-optwrap .swl-optspks .spk').count() >= n);
          await page.evaluate(() => { window.__said = []; });
          await page.locator('.swl-optwrap .swl-optspks .spk').first().click();
          await page.waitForTimeout(300);
          const said = await page.evaluate(() => window.__said);
          ok('★ 🔊는 독일어(de-DE)로 읽는다 ★', said.length >= 1 && said[0].lang.startsWith('de'), JSON.stringify(said[0]));
        }
        await page.locator('.swl-next').click();
        await page.waitForTimeout(400);
        continue;
      }
      // 쓰기·받아쓰기·조립 같은 보기 없는 문제는 건너뛴다 — 확인 없이 다음으로 갈 수 없으니 일부러 틀린 답을 낸다
      if (await page.locator('.swl-check').count()) {
        if (await page.locator('.swl-input, input').count()) await page.locator('.swl-input, input').first().fill('x').catch(() => {});
        await page.locator('.swl-check').click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        if (await page.locator('.swl-next').count()) await page.locator('.swl-next').click();
        await page.waitForTimeout(300);
      } else await page.waitForTimeout(300);
    }
    ok('고르는 문제를 만났다', seenChoice);
    await page.close();
  }

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
