/* 오답노트 한 곳 — 진짜 화면에서.
 *
 *   · 복습&내기록에 「오답노트」 줄이 있고 숫자가 합계다(같은 문제는 한 번만)
 *   · 누르면 한 화면: 합계 · 새 오답노트(다시 시험 · 기록 보기) · N3 코스 오답
 *   · 복습 화면의 「오답노트」 줄도 같은 화면을 연다 — 복습 화면 안에 오답 패널이 더는 없다
 *   · N3 오답노트 줄은 N3 코스의 오답노트로 간다
 *   · 오늘 탭의 오답 패널은 그대로다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = new Date().toISOString().slice(0, 10);
const mrow = (id, source, prompt) => ({
  id, source, ref: id, kind: 'choice', prompt, correct: '정답', options: ['정답', '오답'], explanation: '해설이에요', chosen: '오답', wrongChosen: '오답',
  wrong: 1, right: 0, at: Date.now(), lastWrongAt: Date.now(), due: today, resolved: false, successes: {},
});
const PROGRESS = {
  mistakes: {
    'word:a': mrow('word:a', 'word', '単語の問題'),
    'compose:b': mrow('compose:b', 'compose', '作文の問題'),
    'n3:q-dup': mrow('n3:q-dup', 'n3', 'N3の問題'),
  },
  n3: { v: 1, lessons: {}, skip: {}, days: {}, q: {}, tests: {}, exams: [], summary: null,
    /* q-dup는 새 쪽에도 있다(두 번 세면 안 된다). 나머지 둘은 코스에만 남은 옛 오답 */
    wrong: { 'q-dup': { c: 1, at: 1, cat: 'grammar', ref: 'g:x', ok: 0 }, 'x:yomi-1': { c: 2, at: 1, cat: 'kanji', ref: 'k:窓', ok: 0 }, 'q-old2': { c: 1, at: 1, cat: 'grammar', ref: 'g:z', ok: 0 } } },
};

async function boot(browser, progress) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (p) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(p));
  }, progress);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 복습&내기록 › 오답노트 줄 ]');
  const page = await boot(browser, PROGRESS);
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '내 학습');
  const row = page.locator('.me-row[data-row="wrong"]');
  ok('오답노트 줄이 있다', await row.count() === 1);
  ok('★ 숫자는 합계 — 새 3 + 코스에만 남은 2 = 5 (같은 문제는 한 번만) ★', (await row.locator('.rv-cnt').innerText()) === '5', await row.locator('.rv-cnt').innerText());

  console.log('\n[ 한 화면 ]');
  await row.click();
  await page.waitForTimeout(800);
  ok('제목이 오답노트', (await page.locator('.subscreen.open .sub-title').innerText()).includes('오답노트'));
  ok('합계 카드', (await page.locator('.wb2-sum').getAttribute('data-total')) === '5');
  ok('합계 설명이 숫자를 나눠 말한다', (await page.locator('.wb2-sum').innerText()).includes('새 오답노트 3개') && (await page.locator('.wb2-sum').innerText()).includes('N3 코스에만 남은 오답 2개'));
  ok('★ 새 오답노트(다시 시험)가 같은 화면에 ★', await page.locator('.subscreen.open .mistake-notebook').count() === 1 && await page.locator('.subscreen.open .mistake-start').count() === 1);
  ok('N3 코스 오답 줄과 개수', (await page.locator('.wb2-n3').innerText()).includes('N3 오답노트 3개'));
  await page.locator('.subscreen.open .mistake-start').click();
  await page.waitForTimeout(300);
  ok('다시 시험이 이 화면에서 돈다', await page.locator('.subscreen.open .mistake-retest').count() === 1);
  /* ★ 푸는 동안에도 곤이 말해 준다 ★ */
  ok('★ 답을 내기 전에 곤이 지난번 고른 답을 짚어 준다 ★', (await page.locator('.mistake-retest .hunter-tutor').getAttribute('data-guide')) === 'gon' && (await page.locator('.mistake-retest .hunter-tutor').innerText()).includes('지난번엔'));
  ok('정답은 곤이 말하지 않는다', !(await page.locator('.mistake-retest .hunter-tutor').innerText()).includes('정답'));
  await page.locator('.mistake-options button').first().click();
  await page.waitForTimeout(400);
  ok('답을 내면 해설 카드가 뜬다', await page.locator('.mistake-feedback .hunter-tutor').count() === 1);
  /* ★ 해설 상자의 글자가 바탕과 구별된다(어두운 바탕에 어두운 글자였다) ★ */
  const contrast = await page.evaluate(() => {
    const box = document.querySelector('.mistake-feedback .ht-lesson');
    const p = box.querySelector('p');
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const a = lum(getComputedStyle(box).backgroundColor); const b = lum(getComputedStyle(p).color);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  ok('★ 해설 글자와 바탕의 대비가 충분하다(4.5:1 이상) ★', contrast >= 4.5, contrast.toFixed(1));
  await page.locator('.subscreen.open .mistake-retest-head button').click();

  console.log('\n[ N3 코스 오답노트로 ]');
  await page.locator('.wb2-n3').click();
  await page.waitForTimeout(1200);
  ok('N3 오답노트가 열린다', await page.locator('.n3-wrong').count() === 1);
  ok('★ N3 오답노트의 「관련 내용 →」 버튼이 손가락 크기(44px)다 ★', await page.locator('.n3-reflink').evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 40)), `${await page.locator('.n3-reflink').count()}개`);
  await goTab(page, '내 학습');

  console.log('\n[ 복습 화면에서도 같은 곳 ]');
  await page.locator('.me-row[data-row="review"]').click();
  await page.waitForTimeout(700);
  ok('★ 복습 화면 안에 오답 패널이 더는 없다 ★', await page.locator('.subscreen.open .mistake-notebook').count() === 0);
  const rvRow = page.locator('.rv-row[data-row="wrong"]');
  ok('복습의 「오답노트」 줄 · 같은 합계', (await rvRow.innerText()).includes('오답노트') && (await rvRow.locator('.rv-cnt').innerText()) === '5');
  await rvRow.click();
  await page.waitForTimeout(700);
  ok('★ 같은 오답노트 화면이 열린다 ★', await page.locator('.wb2-sum').count() === 1);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  ok('뒤로 가면 복습 화면', await page.locator('.rv-top').count() === 1);
  await page.close();

  console.log('\n[ 아무것도 없을 때 ]');
  const empty = await boot(browser, null);
  empty.on('pageerror', (e) => errors.push(e.message));
  await goTab(empty, '내 학습');
  ok('숫자 0', (await empty.locator('.me-row[data-row="wrong"] .rv-cnt').innerText()) === '0');
  await empty.locator('.me-row[data-row="wrong"]').click();
  await empty.waitForTimeout(700);
  ok('빈 화면도 안내한다', (await empty.locator('.subscreen.open').innerText()).includes('새로 틀린 문제가 여기에 쌓여요'));
  ok('N3 줄은 잠겨 있다', await empty.locator('.wb2-n3:disabled').count() === 1);
  await empty.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
