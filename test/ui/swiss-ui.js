/* 스위스 독일어 맛보기 — 진짜 화면에서.
 *
 * 곁가지라 확인할 것도 단출하다.
 *   더보기 → 학습 도구에서 들어가진다
 *   묶음을 고르면 카드가 바뀐다
 *   카드를 누르면 독일어로 읽으라고 넘긴다 (일본어·한국어가 아니라)
 *   맞혀 보기가 정답을 알아본다
 *   ★ 회독 기록을 하나도 안 건드린다 ★ — 곁가지가 본업 기록에 손대면 안 된다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMore } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  /* 무엇을 읽으라고 넘겼는지만 가로챈다 — 진짜 음성 엔진은 검사에서 못 쓴다 */
  await page.addInitScript(() => {
    window.__said = [];
    const synth = window.speechSynthesis;
    if (!synth) return;
    const real = synth.speak.bind(synth);
    synth.speak = (u) => {
      window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
      try { real(u); } catch { /* 무시 */ }
    };
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
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
  await openMore(page, 'tools');
  const row = page.locator('.tool-swiss');
  ok('학습 도구에 줄이 있다', await row.count() === 1);
  ok('유치원 수준이라고 적혀 있다', (await row.innerText()).includes('유치원'),
    (await row.innerText()).replace(/\n/g, ' ').slice(0, 60));
  await row.click();
  await page.waitForTimeout(900);
  ok('화면이 열린다', await page.locator('.sw-cards').count() === 1);
  ok('제목이 맞다', (await page.textContent('.sub-title').catch(() => '')).includes('스위스'),
    (await page.textContent('.sub-title').catch(() => '')).trim());

  console.log('\n── 카드');
  const firstWord = (await page.locator('.sw-word').first().innerText()).trim();
  ok('인사부터 — Grüezi', firstWord === 'Grüezi', firstWord);
  ok('한글 소리가 같이 있다', (await page.locator('.sw-han').first().innerText()).trim() === '그뤼에치');
  ok('뜻이 같이 있다', (await page.locator('.sw-ko').first().innerText()).includes('안녕'));

  await page.locator('.sw-card').first().click();
  await page.waitForTimeout(500);
  /* 첫 탭에서는 iOS 재생을 여는 무음 발화(" ", ja-JP)가 먼저 나간다.
     그건 우리가 넘긴 낱말이 아니다 — 독일어로 나간 것만 골라 본다. */
  const said = await page.evaluate(() => window.__said || []);
  const de = said.filter((u) => String(u.lang).startsWith('de'));
  ok('★ 누르면 읽으라고 넘긴다 ★', said.length >= 1, JSON.stringify(said));
  ok('★ 독일어로 넘긴다 ★', de.length >= 1, de.map((u) => u.lang).join(',') || '독일어 없음');
  ok('넘긴 글자가 그 낱말이다', de[0]?.text === 'Grüezi', de[0]?.text);

  /* 묶음을 바꾸면 카드가 바뀐다 — 안 바뀌면 칩이 장식이다 */
  await page.locator('.sw-chips .chip[data-group="animal"]').click();
  await page.waitForTimeout(400);
  const animal = (await page.locator('.sw-word').first().innerText()).trim();
  ok('묶음을 바꾸면 카드가 바뀐다', animal !== firstWord && animal === 'Hund', animal);
  await page.locator('.sw-chips .chip[data-group="color"]').click();
  await page.waitForTimeout(400);
  ok('색깔 묶음은 색을 보여 준다', await page.locator('.sw-swatch').count() >= 5,
    `${await page.locator('.sw-swatch').count()}개`);

  console.log('\n── 맞혀 보기');
  await page.locator('.sw-chips .chip[data-group="num"]').click();
  await page.waitForTimeout(300);
  await page.locator('.sw-quiz-go').click();
  await page.waitForTimeout(600);
  ok('문제가 뜬다', await page.locator('.sw-ask').count() === 1);
  ok('보기가 셋', await page.locator('.sw-opts .qopt').count() === 3);
  /* 바깥 화면 제목도 .sub-title이라 첫 것을 잡으면 「스위스 독일어 맛보기」가
     나온다. 맞혀 보기 안의 작은 머리(sub-header.inline)만 본다. */
  const progress = () => page.locator('.sub-header.inline .sub-title').innerText().then((t) => t.trim()).catch(() => '');
  ok('진행이 보인다', /1 \/ \d+/.test(await progress()), await progress());

  /* 정답을 알아보는지 — 어느 게 정답인지 화면이 안 알려 주니 하나씩 눌러 본다.
     틀리면 답을 보여 주고 「다음」이 뜬다. 맞히면 저절로 넘어간다.
     둘 다 한 번씩 보면 충분하다 — 같은 확인을 문제마다 되풀이하지 않는다. */
  let sawWhy = false; let sawAuto = false;
  for (let i = 0; i < 6 && !(sawWhy && sawAuto); i += 1) {
    const before = await progress();
    if (await page.locator('.sw-opts .qopt').count() === 0) break;
    await page.locator('.sw-opts .qopt').first().click();
    await page.waitForTimeout(400);
    if (await page.locator('.sw-why').count()) {
      if (!sawWhy) {
        ok('틀리면 답을 알려 준다', (await page.locator('.sw-why').innerText()).includes('답은'));
        ok('정답 보기에 표시가 붙는다', await page.locator('.sw-opts .qopt.correct').count() === 1);
      }
      sawWhy = true;
      await page.locator('.sw-next').click();
      await page.waitForTimeout(400);
    } else {
      await page.waitForTimeout(1300);
      if ((await progress()) !== before) sawAuto = true;
    }
  }
  ok('★ 정답을 알아본다 ★', sawWhy || sawAuto, `틀림봄 ${sawWhy} / 맞힘봄 ${sawAuto}`);

  console.log('\n── 본업을 안 건드린다');
  const reviewAfter = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  const statsAfter = await page.evaluate(() => localStorage.getItem('jp_manabu_stats_v1'));
  ok('★ 회독 기록이 그대로 ★', reviewBefore === reviewAfter);
  ok('★ 활동 집계도 그대로 ★', statsBefore === statsAfter);

  /* 뒤로 나가면 더보기로 — 곁가지에 갇히면 안 된다 */
  await page.locator('.sub-back').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('.sub-back').first().click().catch(() => {});
  await page.waitForTimeout(600);
  ok('나갈 수 있다', await page.locator('.tabbar').isVisible());

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
