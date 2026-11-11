/* 말하기 연습 — 진짜 화면에서.
 *   · 학습 탭에 「말하기」 칸이 있고, 누르면 설정 화면이 열린다
 *   · AI로 문장을 만들면 저장되고(가짜 답), 저장한 문장을 보고 지울 수 있다
 *   · 시작하면 저절로 흘러간다: 뜻 → 말할 시간(일본어는 안 보인다) → 정답 → 따라 말하기 → 다음 문장
 *   · 잠시 멈춤 · 다음 · 그만하기, 끝나면 몇 문장 말했는지 활동에 남는다. 복습 기록은 안 건드린다
 *   · 모바일 폭에서 가로로 안 넘친다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const SENTENCES = { sentences: [
  { jp: 'ここに座ってもいいですか。', kana: 'ここにすわってもいいですか。', ko: '여기 앉아도 될까요?' },
  { jp: '注文をお願いします。', kana: 'ちゅうもんをおねがいします。', ko: '주문 부탁드려요.' },
  { jp: 'お水をください。', kana: 'おみずをください。', ko: '물 주세요.' },
] };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_speak_prefs_v1', JSON.stringify({ dir: 'ko-jp', think: 3, count: 10, source: 'ai' }));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false, geminiKey: 'AQ.test-not-a-real-key' });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });
  await page.context().setOffline(false);
  let calls = 0; let lastBody = '';
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    calls += 1; lastBody = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(SENTENCES) }] } }] }) });
  });
  await page.evaluate(() => {
    window._spoken = [];
    window.speechSynthesis.speak = (u) => window._spoken.push({ lang: u.lang, text: u.text });
    window.speechSynthesis.cancel = () => {};
  });

  console.log('\n[ 메뉴와 설정 화면 ]');
  await openMenu(page, '말하기');
  await page.waitForTimeout(900);
  ok('★ 학습 탭의 「말하기」 칸이 말하기 연습을 연다 ★', await page.locator('.speak.sp-setup').count() === 1 && (await page.locator('.subscreen.open .sub-title').innerText()).includes('말하기'));
  ok('문장이 없을 때는 시작이 잠겨 있고 이유를 말한다', await page.locator('.sp-start:disabled').count() === 1 && (await page.locator('.sp-start').innerText()).includes('AI로'));

  console.log('\n[ AI로 문장 만들기 ]');
  await page.locator('.sp-topic').fill('식당에서 주문');
  await page.locator('.sp-make').click();
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').speak?.items || {}));
  ok('★ 만든 문장 셋이 저장된다 ★', saved.length === 3 && saved.every((s) => s.jp && s.ko && s.topic === '식당에서 주문'), `${saved.length}개`);
  ok('주제와 수준을 AI에게 보낸다', calls === 1 && lastBody.includes('식당에서 주문') && lastBody.includes('JLPT'));
  ok('저장한 문장 수가 보인다', (await page.locator('.sp-savedrow').innerText()).includes('3개') && (await page.locator('.sp-sources [data-source="ai"]').innerText()).includes('3개'));
  await page.locator('.sp-savedrow').click();
  ok('저장한 문장을 펼쳐 본다', await page.locator('.sp-row').count() === 3);
  await page.locator('.sp-row').last().locator('.sp-del').click();
  await page.waitForTimeout(300);
  ok('필요 없는 문장을 지운다', await page.locator('.sp-row').count() === 2);
  ok('가로로 넘치지 않는다(설정)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 저절로 흘러간다 ]');
  const reviewBefore = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  await page.locator('.sp-start').click();
  await page.waitForTimeout(400);
  const run = page.locator('.sp-run');
  ok('시작하면 첫 문장의 뜻이 보인다', await run.count() === 1 && (await run.getAttribute('data-step')) === 'prompt' && (await page.locator('.sp-ko').innerText()).length > 2);
  ok('★ 말하기 전에는 일본어 정답이 안 보인다 ★', await page.locator('.sp-jp').count() === 0);
  ok('뜻은 한국어 음성으로 읽어 준다', await page.evaluate(() => window._spoken.some((s) => /ko/i.test(s.lang))));
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'think', null, { timeout: 8000 });
  ok('★ 말할 시간 — 「소리 내어 말해 보세요」, 정답은 아직 안 보인다 ★', (await page.locator('.sp-step').innerText()).includes('말해 보세요') && await page.locator('.sp-jp').count() === 0);
  /* 잠시 멈춤 */
  await page.locator('.sp-pause').click();
  await page.waitForTimeout(3600);
  ok('★ 잠시 멈추면 넘어가지 않는다 ★', (await run.getAttribute('data-step')) === 'think' && (await run.getAttribute('data-paused')) === '1');
  await page.locator('.sp-pause').click();
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'answer', null, { timeout: 8000 });
  ok('★ 정답이 보이고(일본어 · 읽기) 일본어 음성으로 읽어 준다 ★', await page.locator('.sp-jp').count() === 1 && await page.locator('.sp-kana').count() === 1 && await page.evaluate(() => window._spoken.some((s) => /ja/i.test(s.lang))));
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'repeat', null, { timeout: 12000 });
  ok('따라 말할 시간이 이어진다', (await page.locator('.sp-step').innerText()).includes('따라 말해'));
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.index === '1', null, { timeout: 12000 });
  ok('★ 손대지 않아도 다음 문장으로 넘어간다 ★', (await run.getAttribute('data-step')) === 'prompt' && (await page.locator('.sp-pos').innerText()).replace(/\s/g, '') === '2/2');
  ok('가로로 넘치지 않는다(재생)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.sp-next').click();
  await page.waitForTimeout(500);
  ok('마지막 문장에서 다음을 누르면 끝난다', await page.locator('.sp-done').count() === 1 && (await page.locator('.sp-donehead').innerText()).includes('2문장'));
  const after = await page.evaluate(() => ({ review: localStorage.getItem('jp_manabu_review_v1'), stats: JSON.parse(localStorage.getItem('jp_manabu_stats_v1') || '{}') }));
  ok('★ 복습 기록은 건드리지 않는다 ★', after.review === reviewBefore);
  ok('★ 말한 문장 수가 활동에 남는다 ★', Object.values(after.stats).some((d) => d.speak === 2), JSON.stringify(Object.values(after.stats).slice(-1)));

  console.log('\n[ 일본어 듣고 따라 말하기 ]');
  await page.locator('.sp-out').click();
  await page.locator('.sp-dirs [data-dir="jp-ko"]').click();
  await page.locator('.sp-start').click();
  await page.waitForTimeout(400);
  ok('★ 일본어가 먼저 보이고 뜻은 가려져 있다 ★', await page.locator('.sp-jp').count() === 1 && await page.locator('.sp-ko.sp-hidden').count() === 1);
  await page.locator('.sp-quit').click();
  ok('그만하면 설정으로 돌아온다', await page.locator('.sp-setup').count() === 1);
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
