/* 독일어 여행 회화 코스 — 진짜 화면에서.
 *
 *   학습 탭에 「독일어」 칸이 있고 들어가진다
 *   카드는 뜻 → 독일어 → 🔊 순서이고, 스위스 팁은 실제로 다른 것에만 🇨🇭로 붙는다
 *   🔊는 de-DE로, 팁 🔊는 de-CH로 넘기고, de-CH 목소리가 없으면 de-DE로 간다
 *   읽는 동안 그 버튼만 「읽는 중」이 되고, 연속으로 누르면 앞 것은 끊긴다
 *   독일어 소리에 한글이 섞이지 않는다
 *   레슨 둘을 끝까지 풀고(문장 조립 포함) 별·XP·다음 레슨 열림을 저장소에서 본다
 *   자동재생이 독일어 → 뜻 → 독일어 차례로 배운 것만 튼다
 *   ★ 일본어 회독 기록·활동 집계를 하나도 안 건드린다 ★ */
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
const HANGUL = /[가-힣]/;

/* 무엇을 읽으라고 넘겼는지 가로챈다. 목소리 목록은 검사마다 다르게 심는다 —
   진짜 엔진은 못 쓰니 start/end를 직접 흉내 낸다(짧게 「읽는 중」이 보이게). */
const initScript = (withCH) => `
  window.__said = [];
  (() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const list = [
      { voiceURI: 'en', name: 'Samantha', lang: 'en-US' },
      { voiceURI: 'ko', name: 'Yuna', lang: 'ko-KR' },
      { voiceURI: 'at', name: 'Michael', lang: 'de-AT' },
      { voiceURI: 'de', name: 'Anna', lang: 'de-DE' },
      ${withCH ? "{ voiceURI: 'ch', name: 'Petra', lang: 'de-CH' }," : ''}
    ];
    synth.getVoices = () => list;
    /* 가짜 목소리는 진짜 SpeechSynthesisVoice가 아니라 크롬이 대입을 거부한다.
       앱이 무엇을 고르려 했는지 보려고 접근자를 가로채 그림자 칸에 담는다. */
    Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', {
      configurable: true,
      get() { return this.__voice || null; },
      set(v) { this.__voice = v; },
    });
    /* 진짜 speak()은 부르지 않는다 — 목소리 없는 헤드리스 크롬은 곧바로
       synthesis-failed를 내서 「끝남」이 되어 버린다. 시작·끝만 흉내 낸다. */
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '', voice: u?.voice?.lang || null });
      setTimeout(() => { try { u.onstart?.(); } catch {} }, 10);
      setTimeout(() => { try { u.onend?.(); } catch {} }, 600);
    };
    synth.cancel = () => {};
  })();
`;

async function boot(browser, withCH) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(initScript(withCH));
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
  return { page, errors };
}
const saidDe = (page) => page.evaluate(() => (window.__said || []).filter((u) => String(u.lang).startsWith('de')));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const { page, errors } = await boot(browser, true);

  const reviewBefore = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  const statsBefore = await page.evaluate(() => localStorage.getItem('jp_manabu_stats_v1'));

  console.log('── 들어가기');
  await openMenu(page, '독일어');
  ok('학습 탭에서 들어가진다', await page.locator('.swh-unit').count() === 9, `${await page.locator('.swh-unit').count()}단원`);
  ok('제목이 「독일어 여행 회화」', (await page.textContent('.sub-title').catch(() => '')).includes('독일어'));
  ok('표준 독일어라고 밝힌다', (await page.locator('.swh-sum').innerText()).includes('표준 독일어'));
  ok('첫 레슨은 열려 있다', await page.locator('.swh-lesson[data-lesson="u1l1"].open').count() === 1);
  ok('둘째 레슨은 잠겨 있다', await page.locator('.swh-lesson[data-lesson="u1l2"].locked').count() === 1);

  console.log('\n── 카드: 뜻 → 독일어 → 🔊, 스위스 팁');
  await page.locator('.swh-unit[data-unit="u1"] .swh-peek').click();
  await page.waitForTimeout(300);
  const card = page.locator('.sw-card[data-item="gutentag"]');
  ok('카드가 있다', await card.count() === 1);
  ok('★ 뜻이 먼저 ★', (await card.locator('.sw-ko').innerText()).includes('안녕하세요'));
  ok('★ 독일어는 표준 독일어 ★', (await card.locator('.sw-word').innerText()).trim() === 'Guten Tag');
  ok('🔊가 있다', await card.locator('.spk.sw-spk-main').count() === 1);
  ok('★ 스위스 팁이 붙어 있다 ★', (await card.locator('.sw-tip').innerText()).includes('Grüezi'));
  ok('팁에 자기 🔊가 있다', await card.locator('.sw-tip .spk').count() === 1);
  ok('팁이 없는 낱말에는 안 붙는다', await page.locator('.sw-card[data-item="gutenmorgen"] .sw-tip').count() === 0);
  const tipCount = await page.locator('.swh-unit[data-unit="u1"] .sw-tip').count();
  const cardCount = await page.locator('.swh-unit[data-unit="u1"] .sw-card').count();
  ok('팁은 일부에만', tipCount > 0 && tipCount < cardCount / 2, `${tipCount} / ${cardCount}`);

  /* 🔊 — de-DE로, 목소리도 de-DE (첫 번째 영어가 아니라) */
  await page.evaluate(() => { window.__said = []; });
  await card.locator('.spk.sw-spk-main').click();
  await page.waitForTimeout(250);
  let de = await saidDe(page);
  ok('★ 🔊는 de-DE로 넘긴다 ★', de[0]?.lang === 'de-DE', de[0]?.lang);
  ok('★ 목소리도 de-DE ★', de[0]?.voice === 'de-DE', de[0]?.voice);
  ok('넘긴 글자는 독일어만', de[0]?.text === 'Guten Tag');
  ok('★ 읽는 동안 버튼이 「읽는 중」 ★', await card.locator('.spk.sw-spk-main.playing').count() === 1);
  await page.waitForTimeout(700);
  ok('끝나면 꺼진다', await card.locator('.spk.sw-spk-main.playing').count() === 0);

  /* 팁 🔊 — de-CH로, 목소리는 de-CH (있으니까) */
  await page.evaluate(() => { window.__said = []; });
  await card.locator('.sw-tip .spk').click();
  await page.waitForTimeout(250);
  de = await saidDe(page);
  ok('★ 팁 🔊는 de-CH로 넘긴다 ★', de[0]?.lang === 'de-CH', de[0]?.lang);
  ok('★ de-CH 목소리가 있으면 그걸로 ★', de[0]?.voice === 'de-CH', de[0]?.voice);
  ok('넘긴 글자는 팁 그대로', de[0]?.text === 'Grüezi');

  /* 연속으로 누르면 앞 것은 끊기고 하나만 「읽는 중」 */
  await page.evaluate(() => { window.__said = []; });
  await page.locator('.sw-card[data-item="hallo"] .spk.sw-spk-main').click();
  await page.locator('.sw-card[data-item="gutenmorgen"] .spk.sw-spk-main').click();
  await page.waitForTimeout(250);
  ok('★ 연속으로 눌러도 「읽는 중」은 하나 ★', await page.locator('.spk.playing').count() === 1, `${await page.locator('.spk.playing').count()}개`);
  ok('마지막 것이 읽는 중', await page.locator('.sw-card[data-item="gutenmorgen"] .spk.playing').count() === 1);
  await page.waitForTimeout(700);

  /* 독일어 소리에 한글이 섞이지 않는다 */
  const all = await saidDe(page);
  ok('★ 독일어 소리에 한글이 없다 ★', all.every((u) => !HANGUL.test(u.text)), all.map((u) => u.text).join(' | '));

  console.log('\n── 레슨 하나를 끝까지');
  await page.locator('.swh-next').click();
  await page.waitForTimeout(700);
  ok('레슨이 열린다', await page.locator('.swl-bar').count() === 1);

  const lastDe = async () => (await saidDe(page)).at(-1)?.text || '';
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
      const item = byId.get(await prompt.getAttribute('data-item'));
      seen.add(type);
      if (!item) { ok('문제의 낱말을 자료에서 찾는다', false); break; }
      if (type === 'choose-ko') {
        ok(`듣고 뜻 고르기 — 화면에 ${item.de}`, (await page.locator('.swl-ptext').innerText()).trim() === item.de);
        await page.locator('.swl-opts .qopt', { hasText: item.ko }).first().click();
      } else if (type === 'choose-sw') {
        await page.locator(`.swl-opts .qopt[data-id="${item.id}"]`).click();
      } else if (type === 'listen') {
        ok('★ 듣기 문제는 글자를 안 보여 준다 ★', await page.locator('.swl-ptext').count() === 0);
        const heard = await lastDe();
        ok('★ 들은 것이 이 문제의 낱말이다 ★', heard === item.de, `${heard} / ${item.de}`);
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
      if (!fb.includes('ok')) ok(`맞혀야 한다 (${type} ${item.id})`, false, fb);
      if (item.ch && (await page.locator('.swl-feedback .sw-tip').count()) !== 1) ok(`팁이 있는 낱말은 띠에도 팁 (${item.id})`, false);
      await page.locator('.swl-next').click();
      await page.waitForTimeout(350);
    }
    return { seen, steps };
  };

  const r1 = await solve();
  ok('★ 끝까지 간다 ★', await page.locator('.swl-finish').count() === 1, `${r1.steps}걸음`);
  ok('★ 유형을 다 만났다 ★', ['choose-ko', 'choose-sw', 'listen', 'match'].every((t) => r1.seen.has(t)), [...r1.seen].join(','));
  ok('하나도 안 틀렸으니 별 셋', await page.locator('.swl-stars[data-stars="3"]').count() === 1);
  await page.locator('.swl-done').click();
  await page.waitForTimeout(600);

  console.log('\n── 끝낸 뒤');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || 'null'));
  ok('★ 진도가 기기에 남는다 (열쇠는 처음 것 그대로) ★', saved?.lessons?.u1l1?.stars === 3, JSON.stringify(saved?.lessons));
  ok('경험치가 남는다', saved?.xp === 15, `${saved?.xp}`);
  ok('★ 둘째 레슨이 열린다 ★', await page.locator('.swh-lesson[data-lesson="u1l2"].open').count() === 1);

  console.log('\n── 문장이 있는 레슨 — 조립 문제');
  await page.locator('.sub-back').first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || '{"lessons":{},"xp":0,"weak":[]}');
    for (const id of ['u1l2', 'u2l1', 'u2l2', 'u2l3']) p.lessons[id] = { stars: 2, last: 2, tries: 1, at: Date.now() };
    localStorage.setItem('jp_manabu_swiss_v1', JSON.stringify(p));
  });
  await openMenu(page, '독일어');
  ok('심어 둔 진도로 식당 레슨이 열린다', await page.locator('.swh-lesson[data-lesson="u3l1"].open').count() === 1);
  await page.locator('.swh-lesson[data-lesson="u3l1"]').click();
  await page.waitForTimeout(700);
  const r2 = await solve();
  ok('★ 문장 레슨도 끝까지 간다 ★', await page.locator('.swl-finish').count() === 1, `${r2.steps}걸음`);
  ok('★ 조립 문제를 만났다 ★', r2.seen.has('build'), [...r2.seen].join(','));
  await page.locator('.swl-done').click();
  await page.waitForTimeout(600);

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
  ok('★ 독일어 → 뜻 → 독일어 ★', seq[0] === 'de' && k > 0 && seq[k + 1] === 'de', seq.join(','));
  const firstText = await page.evaluate(() => (window.__said || [])[0]?.text);
  const firstItem = [...byId.values()].find((it) => it.de === firstText);
  const learned = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_swiss_v1') || '{"lessons":{}}').lessons));
  ok('★ 배운 낱말만 튼다 ★', Boolean(firstItem) && learned.includes(firstItem.lessonId), `${firstText} (${firstItem?.lessonId})`);
  await page.locator('.swp .sub-back').click();
  await page.waitForTimeout(400);

  console.log('\n── 본업을 안 건드린다');
  ok('★ 회독 기록이 그대로 ★', (await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'))) === reviewBefore);
  ok('★ 활동 집계도 그대로 ★', (await page.evaluate(() => localStorage.getItem('jp_manabu_stats_v1'))) === statsBefore);
  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();

  console.log('\n── de-CH 목소리가 없는 기기');
  {
    const { page: p2, errors: e2 } = await boot(browser, false);
    await openMenu(p2, '독일어');
    await p2.locator('.swh-unit[data-unit="u1"] .swh-peek').click();
    await p2.waitForTimeout(300);
    await p2.evaluate(() => { window.__said = []; });
    await p2.locator('.sw-card[data-item="danke"] .sw-tip .spk').click();
    await p2.waitForTimeout(250);
    const d = await saidDe(p2);
    ok('팁은 여전히 de-CH로 부른다', d[0]?.lang === 'de-CH', d[0]?.lang);
    ok('★ de-CH가 없으면 de-DE 목소리로 간다 ★', d[0]?.voice === 'de-DE', d[0]?.voice);
    ok('글자는 팁 그대로', d[0]?.text === 'Merci', d[0]?.text);
    ok('JS 에러 없음', e2.length === 0, e2.slice(0, 2).join(' | '));
    await p2.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
