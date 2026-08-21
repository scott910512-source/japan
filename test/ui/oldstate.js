/* 낡은 저장 기록으로 앱을 켠다.
 *
 * 실제로 이것 때문에 번역기가 흰 화면이 됐다 — 「요즘 말」 칸을 더했더니 그
 * 전에 받아 둔 기록에서 터졌다. 검사는 늘 새 기기로 도니까 안 보였다.
 *
 * 기능을 더하면 저장 모양이 바뀌고, 사람들 기기에는 옛 모양이 남아 있다.
 * 그러니 "칸이 빠진 기록"으로도 화면이 떠야 한다. 여기서는 저장소마다 일부러
 * 낡은/망가진 모양을 넣고 모든 화면을 한 바퀴 돈다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openVideos, startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 옛 앱이 남겼을 법한 모양들. 새로 생긴 칸은 일부러 빼 뒀다. */
const OLD = {
  // 회독 기록 — seenAt이 없던 시절
  jp_manabu_review_v1: {
    'n5-0001': { box: 3, streak: 2, lastSeen: '2026-08-10', rounds: 2, wrongCount: 0, vagueCount: 0 },
    'n5-0002': { box: 1, lastSeen: '2026-08-11' },
    'custom-tr-それな': { box: 2, streak: 0, lastSeen: '2026-08-12' },
  },
  // 번역 기록 — slang이 없던 시절
  jp_manabu_translations_v1: [{
    id: 'tr-old', korean: '이거 얼마예요?', at: 1,
    jp: 'これはいくらですか。', yomi: 'これわいくらですか。', ko: '이거 얼마예요?',
  }],
  // 영상 설명 — 항목이 통째로 빠진 것
  jp_manabu_video_analyses_v1: {
    '8ZGXMjd6Z2E': { overview: { jlpt: 'N4' }, words: [{ jp: '替え玉', yomi: 'かえだま', ko: '면 추가' }], at: 1 },
  },
  jp_manabu_video_scripts_v1: { '8ZGXMjd6Z2E': '[0:05] 替え玉をお願いします。' },
  jp_manabu_video_progress_v1: { '8ZGXMjd6Z2E': { scriptStep: 1 } },
  // 진행 — 새 칸들이 없던 시절
  jp_manabu_progress_v1: { bookmarks: ['n5-0001'] },
  // 내 단어 — 예문 칸이 없던 시절
  jp_manabu_custom_words_v1: [
    { id: 'custom-tr-それな', kanji: 'それな', kana: 'それな', mean: '그니까', type: 'expr', level: 'N3', custom: true },
  ],
  jp_manabu_stats_v1: { '2026-08-16': { studied: 10 } },
  jp_manabu_streak_v1: { count: 2, lastDate: '2026-08-16' },
  // 이어하던 세션 — 오늘 게 아니고 칸도 모자란다
  jp_manabu_session_v1: { date: '2026-08-10', queue: ['n5-0003'], round: 1 },
  jp_manabu_memos_v1: { 'n5-0001': { text: '헷갈림' } },
  // 요즘 일본어 — 예문 칸이 없던 것
  jp_manabu_trends_v1: { at: 1, items: [{ jp: 'それな', yomi: 'それな', ko: '그니까' }] },
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((old) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false; s.geminiKey = 'AIzaTESTKEY'; s.aiProvider = 'gemini';
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    for (const [k, v] of Object.entries(old)) localStorage.setItem(k, JSON.stringify(v));
  }, OLD);
  await page.waitForTimeout(1100);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }

  ok('낡은 기록으로도 앱이 켜짐', await page.locator('.tabbar').count() === 1);

  // 탭을 한 바퀴
  for (const tab of ['오늘', '학습', '복습', '기록', '더보기']) {
    await page.locator('.tabbar .tab', { hasText: tab }).click();
    await page.waitForTimeout(800);
    const body = (await page.textContent('.screen.active')).trim();
    ok(`${tab} 탭이 뜸`, body.length > 30, `${body.length}자`);
    ok(`${tab}에 깨진 숫자 없음`, !body.includes('undefined') && !body.includes('NaN'));
  }

  // 홈 메뉴를 하나씩
  await goTab(page, '오늘');
  await page.waitForTimeout(700);
  await goTab(page, '학습');
  const tiles = await page.locator('.menutile').count();
  ok('메뉴가 보임', tiles >= 5, `${tiles}개`);
  for (let i = 0; i < tiles; i++) {
    const tile = page.locator('.menutile').nth(i);
    const label = (await tile.textContent()).trim().slice(0, 10);
    if (await tile.isDisabled()) continue;
    await tile.click();
    await page.waitForTimeout(800);
    const shown = (await page.textContent('body')).trim().length;
    ok(`메뉴가 열림 · ${label}`, shown > 200 && await page.locator('.tabbar').count() === 1, `${shown}자`);
    const back = page.locator('.subscreen .sub-back, .subscreen .sh-close').first();
    if (await back.count()) { await back.click(); await page.waitForTimeout(600); }
    if (await page.locator('.menutile').count() === 0) {
      await goTab(page, '오늘');
      await page.waitForTimeout(600);
    }
  }

  // 영상 — 설명이 모자란 채로 학습까지
  await openVideos(page);
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(800);
  ok('낡은 설명이 있어도 영상이 열림', (await page.textContent('body')).includes('자막'));
  const lesson = page.locator('button', { hasText: '설명 보기' });
  if (await lesson.count()) {
    await lesson.first().click();
    await page.waitForTimeout(800);
    ok('모자란 설명으로도 학습이 열림', (await page.textContent('body')).trim().length > 200);
    const close = page.locator('.subscreen .sh-close, .subscreen .sub-back').first();
    if (await close.count()) { await close.click(); await page.waitForTimeout(500); }
  }

  // 회독 — seenAt 없는 기록으로 판정까지
  await startStudy(page);
  await page.waitForTimeout(1400);
  ok('낡은 회독 기록으로도 학습이 열림', await page.locator('.judgerow').count() === 1);
  await page.locator('.judgerow button', { hasText: '알아요' }).click();
  await page.waitForTimeout(700);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
  const touched = Object.values(rec).find((v) => v.seenAt);
  ok('판정하면 시각이 새로 붙음', Boolean(touched), touched ? String(touched.seenAt).slice(0, 4) : '없음');
  ok('옛 기록도 그대로 있음', Boolean(rec['n5-0001']));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
