/* 자동 듣기 · JLPT 문장 — 급수를 골라 그 급수의 문장만.
 *
 * 「오늘 볼 것」을 틀었더니 N3이 섞여 와서 몇몇 낱말 말고는 안 들렸다. 그래서
 * 급수로 고르는 범위를 하나 더 뒀다. 여기서 보는 것.
 *   · 범위에 「JLPT 문장」이 있고 숫자가 붙어 있는가
 *   · 고르면 급수 칸(N5·N4·N3)이 나오고 기본이 N5인가
 *   · 시작하면 낱말이 아니라 문장이 흘러가는가
 *   · 급수를 바꾸면 요약·구간이 따라 바뀌고, 나갔다 와도 남는가 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openListen } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1000);
  /* 켜진 채로 다시 부르고 나서 끊는다 — 끊고 부르면 서비스워커가 자리를 못 잡는다 */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

const num = (s) => Number(String(s).replace(/[^\d]/g, '')) || 0;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await boot(browser);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 범위에 JLPT 문장이 있다 ]');
  await openListen(page, 'auto');
  ok('자동 듣기 화면', await page.locator('.ls-go').count() === 1);
  const pill = page.locator('.ls-scope[data-scope="jlpt"]');
  ok('★ 「JLPT 문장」 범위가 있다 ★', await pill.count() === 1);
  ok('눌러도 된다 — 숫자가 0이 아니다', await pill.count() && !(await pill.isDisabled()), await pill.innerText().catch(() => '?'));
  ok('고르기 전에는 급수 칸이 없다', await page.locator('.ls-level').count() === 0);

  console.log('\n[ 고르면 급수 칸이 나온다 ]');
  await pill.click();
  await page.waitForTimeout(400);
  const levels = page.locator('.ls-level');
  ok('급수 칸은 셋', await levels.count() === 3, `${await levels.count()}`);
  ok('★ 기본은 N5 ★', await page.locator('.ls-level.active').getAttribute('data-level') === 'N5');
  const n5 = num(await page.locator('.ls-level[data-level="N5"] .pk-count').innerText());
  const n4 = num(await page.locator('.ls-level[data-level="N4"] .pk-count').innerText());
  const n3 = num(await page.locator('.ls-level[data-level="N3"] .pk-count').innerText());
  ok('N5 문장이 수백 개', n5 >= 600, `${n5}`);
  ok('N4 · N3도 있다', n4 >= 600 && n3 >= 1500, `${n4} · ${n3}`);
  ok('범위 칸의 숫자는 고른 급수의 것', num((await pill.locator('.pk-count').innerText())) === n5);
  ok('요약에 급수가 적힌다', (await page.locator('.ls-topbody').innerText()).includes('JLPT 문장 N5'));
  const blocks = await page.locator('.ls-blk').count();
  ok('구간이 여럿이다 (20개씩)', blocks === Math.ceil(n5 / 20), `${blocks}구간`);

  console.log('\n[ 시작하면 문장이 흘러간다 ]');
  await page.locator('.ls-go').click();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').click();
  await page.waitForTimeout(900);
  ok('★ 재생 화면 ★', await page.locator('.listen.play').count() === 1);
  ok('낱말이 아니라 문장이다', await page.locator('.ls-jp.long').count() === 1,
    (await page.locator('.ls-jp').innerText().catch(() => '?')).slice(0, 30));
  ok('한 판은 스무 장', (await page.locator('.listen.play .sub-title').innerText()).includes('/ 20'));
  const first = (await page.locator('.ls-jp').innerText()).trim();
  ok('첫 장은 단어장 예문(마침표로 끝나는 짧은 문장)', /[。？]$/.test(first) && first.length >= 4, first);
  await page.locator('.listen .sub-back').click();
  await page.waitForTimeout(500);

  console.log('\n[ 급수를 바꾸면 따라온다 ]');
  await page.locator('.ls-blk[data-block="3"]').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('.ls-level[data-level="N4"]').click();
  await page.waitForTimeout(400);
  ok('N4가 켜진다', await page.locator('.ls-level.active').getAttribute('data-level') === 'N4');
  ok('요약도 N4', (await page.locator('.ls-topbody').innerText()).includes('JLPT 문장 N4'));
  ok('범위 칸의 숫자가 N4로', num((await pill.locator('.pk-count').innerText())) === n4);
  ok('★ 급수를 바꾸면 구간은 처음으로 ★', (await page.locator('.ls-blk.active').getAttribute('data-block')) === '1');

  /* 나갔다 와도 남는가 — 기기에 적힌다 */
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}'));
  ok('범위와 급수가 기기에 남는다', saved.listenScope === 'jlpt' && saved.listenJlptLevel === 'N4',
    `${saved.listenScope} · ${saved.listenJlptLevel}`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
