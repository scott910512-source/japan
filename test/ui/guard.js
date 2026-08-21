/* 회독 중 탭바가 남는지, 영상 삭제가 확인 없이 지워지지 않는지. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openVideos, startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const boot = async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false; s.aiProvider = 'gemini'; s.geminiKey = 'AIzaX';
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_video_scripts_v1', JSON.stringify({
      '8ZGXMjd6Z2E': '[0:05] 替え玉をお願いします。\n[0:12] ごちそうさまでした。',
    }));
  });
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);

  // ── 회독 중에도 탭바 ──
  await startStudy(page);
  await page.waitForTimeout(900);
  ok('회독으로 들어감', await page.locator('.judgerow').count() === 1);
  ok('탭바가 남아 있음', await page.locator('.tabbar').isVisible());
  ok('탭 다섯 개 그대로', await page.locator('.tabbar .tab').count() === 5);
  ok('시작한 자리(오늘)가 켜져 있음', await page.locator('.tabbar .tab.active').textContent() === '오늘');

  const box = await page.locator('.judgerow').boundingBox();
  const bar = await page.locator('.tabbar').boundingBox();
  ok('판정 버튼이 탭바에 안 가림', box.y + box.height <= bar.y + 1, `${Math.round(box.y + box.height)} vs ${Math.round(bar.y)}`);
  ok('판정 버튼이 화면 안에 있음', box.y + box.height <= 844, String(Math.round(box.y + box.height)));

  // 회독 중에 학습 탭을 또 눌러도 세션이 안 깨진다
  const before = await page.textContent('.studyhead');
  await startStudy(page);
  await page.waitForTimeout(500);
  ok('학습 탭을 또 눌러도 그대로', (await page.textContent('.studyhead')) === before);

  // 다른 탭으로 나갈 수 있다
  await openVideos(page);
  await page.waitForTimeout(900);
  ok('탭바로 회독을 빠져나옴', await page.locator('.judgerow').count() === 0);
  ok('영상 화면이 열림', await page.locator('.vd-item').count() >= 1);

  // ── 영상 삭제 ──
  const n0 = await page.locator('.vd-item').count();
  await page.locator('.vd-del').first().click();
  await page.waitForTimeout(500);
  ok('바로 안 지워짐', await page.locator('.vd-item').count() === n0);
  ok('확인 창이 뜸', await page.locator('.sheet.open').count() === 1);
  const sheet = await page.textContent('.sheet');
  ok('무엇이 사라지는지 알려 줌', sheet.includes('자막 2줄'), sheet.replace(/\s+/g, ' ').slice(0, 90));
  ok('되돌릴 수 없다고 말함', sheet.includes('되돌릴 수 없'));
  ok('단어는 남는다고 말함', sheet.includes('단어는 그대로 남'));
  ok('삭제 버튼이 잠겨 있음', await page.locator('.vd-delgo').isDisabled());

  await page.fill('.vd-delword', 'ㅅㅂ');
  await page.waitForTimeout(200);
  ok('아무 글자나 치면 안 열림', await page.locator('.vd-delgo').isDisabled());
  await page.fill('.vd-delword', '삭제 ');
  await page.waitForTimeout(200);
  ok('삭제라고 치면 열림', !(await page.locator('.vd-delgo').isDisabled()));

  // 취소하면 그대로
  await page.locator('.sheet button', { hasText: '취소' }).click();
  await page.waitForTimeout(500);
  ok('취소하면 안 지워짐', await page.locator('.vd-item').count() === n0);

  // 다시 열면 친 글자가 비어 있다
  await page.locator('.vd-del').first().click();
  await page.waitForTimeout(400);
  ok('다시 열면 입력칸이 비어 있음', (await page.inputValue('.vd-delword')) === '');
  ok('다시 열면 다시 잠겨 있음', await page.locator('.vd-delgo').isDisabled());

  await page.fill('.vd-delword', '삭제');
  await page.locator('.vd-delgo').click();
  await page.waitForTimeout(600);
  ok('치고 누르면 지워짐', await page.locator('.vd-item').count() === n0 - 1);
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_video_scripts_v1') || '{}'));
  ok('자막도 같이 지워짐', !left['8ZGXMjd6Z2E'], JSON.stringify(Object.keys(left)));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
