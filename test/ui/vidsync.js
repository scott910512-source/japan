/* 영상 상태가 기기에 제대로 남는지 — 뺀 영상이 되살아나지 않는지가 핵심. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

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
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
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

const openVideos = async (page) => {
  await page.locator('.tabbar .tab', { hasText: '영상' }).click();
  await page.waitForTimeout(900);
};

const ls = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await openVideos(page);

  ok('처음엔 기본 영상이 있음', await page.locator('.vd-item').count() === 1);

  // 자막을 넣으면 저장된다
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(600);
  await page.fill('.vd-script', '[0:05] 替え玉をお願いします。\n[0:12] ごちそうさまでした。');
  await page.locator('.vd-run').click();
  await page.waitForTimeout(600);
  const saved = await ls(page, 'jp_manabu_video_scripts_v1');
  ok('자막이 기기에 남음', Boolean(saved['8ZGXMjd6Z2E']), JSON.stringify(Object.keys(saved)));

  // 새로고침해도 남아 있다 (상태를 App으로 옮긴 뒤에도)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
  await openVideos(page);
  ok('새로고침해도 영상이 있음', await page.locator('.vd-item').count() === 1);
  ok('자막 진행 상태가 보임', (await page.textContent('.vd-item')).includes('2줄'), (await page.textContent('.vd-item')).replace(/\s+/g, ' '));

  // 영상을 담으면 목록에 붙는다
  await page.fill('.vd-add input', 'https://youtu.be/dQw4w9WgXcQ');
  await page.locator('.vd-addbtn').click();
  await page.waitForTimeout(500);
  ok('담으면 목록에 붙음', await page.locator('.vd-item').count() === 2);
  const list = await ls(page, 'jp_manabu_videos_v1');
  ok('담은 시각이 찍힘', list.find((v) => v.id === 'dQw4w9WgXcQ')?.addedAt > 0);

  // 빼면 묘비가 남는다
  await page.locator('.vd-item', { hasText: 'dQw4w9WgXcQ' }).locator('.vd-del').click();
  await page.waitForTimeout(400);
  await page.fill('.vd-delword', '삭제');
  await page.locator('.vd-delgo').click();
  await page.waitForTimeout(600);
  ok('목록에서 빠짐', await page.locator('.vd-item').count() === 1);
  const tomb = await ls(page, 'jp_manabu_video_removed_v1');
  ok('묘비가 남음', tomb.dQw4w9WgXcQ > 0, JSON.stringify(tomb));

  // 마지막 하나까지 빼도 기본 영상이 되살아나지 않는다
  await page.locator('.vd-del').first().click();
  await page.waitForTimeout(400);
  await page.fill('.vd-delword', '삭제');
  await page.locator('.vd-delgo').click();
  await page.waitForTimeout(600);
  ok('다 빼면 빈 목록', await page.locator('.vd-item').count() === 0);
  ok('비었다고 알려 줌', (await page.textContent('.screen.active')).includes('담아 둔 영상이 없어요'));
  ok('그 자막도 지워짐', Object.keys(await ls(page, 'jp_manabu_video_scripts_v1')).length === 0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const off2 = page.locator('.gate-offline');
  if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
  await openVideos(page);
  ok('새로고침해도 기본 영상이 안 돌아옴', await page.locator('.vd-item').count() === 0, String(await page.locator('.vd-item').count()));

  // 다시 담으면 정상적으로 들어온다
  await page.fill('.vd-add input', 'https://youtu.be/8ZGXMjd6Z2E');
  await page.locator('.vd-addbtn').click();
  await page.waitForTimeout(500);
  ok('다시 담으면 들어옴', await page.locator('.vd-item').count() === 1);
  const back = await ls(page, 'jp_manabu_videos_v1');
  const tomb2 = await ls(page, 'jp_manabu_video_removed_v1');
  ok('다시 담은 시각이 묘비보다 나중', back[0].addedAt > tomb2['8ZGXMjd6Z2E'], `${back[0].addedAt} > ${tomb2['8ZGXMjd6Z2E']}`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
