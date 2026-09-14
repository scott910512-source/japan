/* 스위스 독일어 코스 — 진짜 화면에서 레슨 하나를 끝까지.
 *
 *   학습 탭에 칸이 있고 들어가진다
 *   첫 레슨만 열려 있고 나머지는 잠겨 있다
 *   문제 유형마다 답을 찾아 끝까지 간다 (듣기 문제는 실제로 넘긴 소리로 답을 안다)
 *   끝나면 별과 XP가 남고, 둘째 레슨이 열린다 — 저장소까지 본다
 *   자동재생이 스위스 독일어 → 뜻 → 스위스 독일어 차례로 넘긴다
 *   ★ 일본어 회독 기록·활동 집계를 하나도 안 건드린다 ★
 *
 * 답은 자료에서 찾는다. 화면이 보여 주는 글자(뜻·스위스 독일어)로 낱말을 찾고
 * 그 낱말의 다른 쪽을 고른다 — 사용자가 하는 것과 같다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { SWISS_ITEMS, tokensOf } from '../../src/data/swiss.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const byId = new Map(SWISS_ITEMS.map((it) => [it.id, it]));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  /* 무엇을 읽으라고 넘겼는지 가로챈다. 독일어·한국어 음성이 있는 척해서
     기기 음성 길로 가게 한다 — 클라우드는 검사에서 못 쓴다. */
  await page.addInitScript(() => {
    window.__said = [];
    const synth = window.speechSynthesis;
    if (!synth) return;
    const de = { voiceURI: 'test-de', name: 'Test German', lang: 'de-DE' };
    const ko = { voiceURI: 'test-ko', name: 'Test Korean', lang: 'ko-KR' };
    synth.getVoices = () => [de, ko];
    const real = synth.speak.bind(synth);
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
      try { u.onstart?.(); } catch { /* 무시 */ }
      try { real(u); } catch { /* 무시 */ }
    };
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.removeItem('jp_manabu_swiss_v1');
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }

  const reviewBefore = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  const statsBefore = await page.evaluate(() => localStorage.getItem('jp_manabu_stats_v1'));

  console.log('── 들어가기');
  await openMenu(page, '스위스 독일어');
  ok('학습 탭에서 들어가진다', await page.locator('.swh-unit').count() >= 5, `${await page.locator('.swh-unit').count()}단원`);
  ok('제목', (await page.textContent('.sub-title').catch(() => '')).includes('스위스'));
  ok('첫 레슨은 열려 있다', await page.locator('.swh-lesson[data-lesson="u1l1"].open').count() === 1);
  ok('★ 둘째 레슨은 잠겨 있다 ★', await page.locator('.swh-lesson[data-lesson="u1l2"].locked').count() === 1);
  ok('시작 버튼이 첫 레슨을 가리킨다', (await page.locator('.swh-next').innerText()).includes('시작하기'));

  /* 낱말 미리 보기 — 잠긴 단원도 볼 수는 있다 */
  await page.locator('.swh-unit[data-unit="u5"] .swh-peek').click();
  await page.waitForTimeout(300);
  ok('잠긴 단원도 낱말은 미리 본다', await page.locator('.swh-unit[data-unit="u5"] .sw-card').count() >= 5);
  await page.locator('.swh-unit[data-unit="u5"] .sw-card').first().click();
  await page.waitForTimeout(400);
  const peek = await page.evaluate(() => (window.__said || []).filter((u) => String(u.lang).startsWith('de')));
  ok('카드를 누르면 독일어로 읽는다', peek.some((u) => u.text === 'Hund'), peek.map((u) => u.text).join(','));

  console.log('\n── 레슨 하나를 끝까지');
  await page.locator('.swh-next').click();
  await page.waitForTimeout(700);
  ok('레슨이 열린다', await page.locator('.swl-bar').count() === 1);

  /* 문제를 보고 답을 찾는다. 틀리는 일은 없어야 한다 — 자료를 알고 푼다. */
  const lastDe = async () => {
    const s = await page.evaluate(() => (window.__said || []).filter((u) => String(u.lang).startsWith('de')));
    return s.at(-1)?.text || '';
  };
  const solve = async () => {
  const seen = new Set();
  let steps = 0;
  while (steps < 40) {
    steps += 1;
    if (await page.locator('.swl-finish').count()) break;
    if (await page.locator('.swl-match').count()) {
      seen.add('match');
      const lefts = await page.locator('.swl-mleft').evaluateAll((els) => els.map((e) => e.dataset.id));
      for (const id of lefts) {
        await page.locator(`.swl-mleft[data-id="${id}"]`).click();
        await page.waitForTimeout(150);
        await page.locator(`.swl-mright[data-id="${id}"]`).click();
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(1000);
      continue;
    }
    const prompt = page.locator('.swl-prompt');
    if (await prompt.count() === 0) { await page.waitForTimeout(300); continue; }
    const type = await prompt.getAttribute('data-type');
    const itemId = await prompt.getAttribute('data-item');
    const item = byId.get(itemId);
    seen.add(type);
    if (!item) { ok('문제의 낱말을 자료에서 찾는다', false, itemId); break; }

    if (type === 'choose-ko') {
      ok(`듣고 뜻 고르기 — 화면에 ${item.sw}`, (await page.locator('.swl-ptext').innerText()).trim() === item.sw);
      await page.locator('.swl-opts .qopt', { hasText: item.ko }).first().click();
    } else if (type === 'choose-sw') {
      await page.locator(`.swl-opts .qopt[data-id="${item.id}"]`).click();
    } else if (type === 'listen') {
      /* 글자는 없다. 실제로 넘긴 소리가 답이다 — 사용자도 그렇게 안다 */
      ok('★ 듣기 문제는 글자를 안 보여 준다 ★', await page.locator('.swl-ptext').count() === 0);
      const heard = await lastDe();
      ok('★ 들은 것이 이 문제의 낱말이다 ★', heard === item.sw, `${heard} / ${item.sw}`);
      await page.locator(`.swl-opts .qopt[data-id="${item.id}"]`).click();
    } else if (type === 'build') {
      for (const t of tokensOf(item)) {
        await page.locator('.swl-bank .swl-tok:not(.used)', { hasText: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
        await page.waitForTimeout(80);
      }
    }
    await page.waitForTimeout(150);
    await page.locator('.swl-check').click();
    await page.waitForTimeout(400);
    const fb = await page.locator('.swl-feedback').getAttribute('class').catch(() => '');
    if (!fb.includes('ok')) { ok(`맞혀야 한다 (${type} ${item.id})`, false, fb); }
    await page.locator('.swl-next').click();
    await page.waitForTimeout(350);
  }
  return { seen, steps };
  };

  const r1 = await solve();
  ok('★ 끝까지 간다 ★', await page.locator('.swl-finish').count() === 1, `${r1.steps}걸음`);
  ok('★ 유형을 다 만났다 ★', ['choose-ko', 'choose-sw', 'listen', 'match'].every((t) => r1.seen.has(t)), [...r1.seen].join(','));
  ok('하나도 안 틀렸으니 별 셋', await page.locator('.swl-stars[data-stars="3"]').count() === 1,
    await page.locator('.swl-stars').getAttribute('data-stars'));

  await page.locator('.swl-done').click();
  await page.waitForTimeout(600);

  console.log('\n── 끝낸 뒤');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || 'null'));
  ok('★ 진도가 기기에 남는다 ★', saved?.lessons?.u1l1?.stars === 3, JSON.stringify(saved?.lessons));
  ok('경험치가 남는다', saved?.xp === 15, `${saved?.xp}`);
  ok('★ 둘째 레슨이 열린다 ★', await page.locator('.swh-lesson[data-lesson="u1l2"].open').count() === 1);
  ok('첫 레슨에 별이 붙는다', (await page.locator('.swh-lesson[data-lesson="u1l1"] .swh-lmark').innerText()).trim() === '★★★');
  ok('이어서 배우기가 둘째를 가리킨다', (await page.locator('.swh-next').innerText()).includes('이어서'));

  console.log('\n── 문장이 있는 레슨 — 조립 문제');
  /* 1단원에는 문장이 없어 조립 문제가 안 나온다. 2단원을 열려면 1단원 둘을
     끝내야 하니 진도를 심어 두고 다시 들어온다 — 화면은 들어올 때 진도를 읽는다. */
  await page.locator('.sub-back').first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || '{"lessons":{},"xp":0,"weak":[]}');
    p.lessons.u1l2 = { stars: 2, last: 2, tries: 1, at: Date.now() };
    localStorage.setItem('jp_manabu_swiss_v1', JSON.stringify(p));
  });
  await openMenu(page, '스위스 독일어');
  ok('심어 둔 진도로 2단원이 열린다', await page.locator('.swh-lesson[data-lesson="u2l1"].open').count() === 1);
  await page.locator('.swh-lesson[data-lesson="u2l1"]').click();
  await page.waitForTimeout(700);
  const r2 = await solve();
  ok('★ 문장 레슨도 끝까지 간다 ★', await page.locator('.swl-finish').count() === 1, `${r2.steps}걸음`);
  ok('★ 조립 문제를 만났다 ★', r2.seen.has('build'), [...r2.seen].join(','));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(600);
  const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || 'null'));
  ok('2단원 진도도 남는다', saved2?.lessons?.u2l1?.stars >= 1, JSON.stringify(saved2?.lessons?.u2l1));

  console.log('\n── 자동재생');
  await page.locator('.swh-listen').click();
  await page.waitForTimeout(500);
  ok('배운 것이 기본', await page.locator('.swp-scopes .chip.active[data-scope="learned"]').count() === 1);
  await page.evaluate(() => { window.__said = []; });
  await page.locator('.swp-go').click();
  let seq = [];
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(700);
    seq = await page.evaluate(() => (window.__said || []).map((u) => String(u.lang).split('-')[0]));
    const k = seq.indexOf('ko');
    if (k > 0 && seq.slice(k + 1).includes('de')) break;
  }
  const k = seq.indexOf('ko');
  ok('재생 화면', await page.locator('.swp-stage').count() === 1);
  ok('★ 스위스 독일어 → 뜻 → 스위스 독일어 ★', seq[0] === 'de' && k > 0 && seq[k + 1] === 'de', seq.join(','));
  /* 「배운 것」 = 끝낸 레슨의 낱말. 지금은 1단원 둘과 2단원 첫 레슨을 끝냈으니
     그중 어느 것이든 되고, 안 배운 단원 것이 나오면 틀린 것이다. */
  const first = await page.evaluate(() => (window.__said || [])[0]?.text);
  const firstItem = [...byId.values()].find((it) => it.sw === first);
  const learnedNow = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || '{"lessons":{}}').lessons));
  ok('★ 배운 낱말만 튼다 ★', Boolean(firstItem) && learnedNow.includes(firstItem.lessonId), `${first} (${firstItem?.lessonId}) / 배운 레슨 ${learnedNow.join(',')}`);
  await page.locator('.swp .sub-back').click();
  await page.waitForTimeout(400);

  console.log('\n── 본업을 안 건드린다');
  ok('★ 회독 기록이 그대로 ★', (await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'))) === reviewBefore);
  ok('★ 활동 집계도 그대로 ★', (await page.evaluate(() => localStorage.getItem('jp_manabu_stats_v1'))) === statsBefore);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
