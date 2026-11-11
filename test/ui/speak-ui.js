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
  { jp: 'この料理は辛いですか。', kana: 'このりょうりはからいですか。', ko: '이 요리는 매워요?' },
  { jp: 'お水をください。', kana: 'おみずをください。', ko: '물 주세요.' },
] };
/* 두 번째로 만들 때 오는 문장 — 다른 회차로 묶여야 한다 */
const SECOND = { sentences: [
  { jp: '会議は三時からです。', kana: 'かいぎはさんじからです。', ko: '회의는 3시부터예요.' },
  { jp: '資料を送ります。', kana: 'しりょうをおくります。', ko: '자료를 보낼게요.' },
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
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });
  await page.context().setOffline(false);
  let calls = 0; let lastBody = '';
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    calls += 1; lastBody = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(calls === 1 ? SENTENCES : SECOND) }] } }] }) });
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
  /* 조사 は — 읽기(가나)만 보내면 엔진이 りょうり + はからい로 끊어 「하」로 읽었다. 소리 낼 때만 わ로 바꿔 보낸다 */
  await page.evaluate(() => { window._spoken.length = 0; });
  await page.locator('.sp-row', { hasText: '料理' }).locator('.sp-say').click();
  await page.waitForTimeout(300);
  const saidWa = await page.evaluate(() => window._spoken.filter((x) => /ja/i.test(x.lang)).map((x) => x.text));
  ok('★ 조사 は는 「와」로 읽게 보낸다(このりょうりわからいですか) ★', saidWa.some((t) => t.includes('りょうりわからい')) && !saidWa.some((t) => t.includes('りょうりはからい')), saidWa.join(' | '));
  ok('화면의 읽기는 그대로 は다', (await page.locator('.sp-row', { hasText: '料理' }).innerText()).includes('りょうりはからい'));
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
  /* 다시 듣기 — 어느 걸음에서 눌러도 이 문장을 처음부터 다시 */
  ok('단추 이름은 「다시 듣기」', (await page.locator('.sp-replay').innerText()).includes('다시 듣기'));
  const koBefore = await page.evaluate(() => window._spoken.filter((x) => /ko/i.test(x.lang)).length);
  await page.locator('.sp-replay').click();
  await page.waitForTimeout(400);
  ok('★ 따라 말할 차례에 다시 듣기 — 같은 문장을 처음(뜻)부터 다시 읽어 준다 ★', (await run.getAttribute('data-step')) === 'prompt' && (await run.getAttribute('data-index')) === '0'
    && await page.evaluate((n) => window._spoken.filter((x) => /ko/i.test(x.lang)).length === n + 1, koBefore));
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.index === '1', null, { timeout: 25000 });
  ok('★ 손대지 않아도 다음 문장으로 넘어간다 ★', (await run.getAttribute('data-step')) === 'prompt' && (await page.locator('.sp-pos').innerText()).replace(/\s/g, '') === '2/2');
  ok('가로로 넘치지 않는다(재생)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  /* 「말할 시간」(내 차례)에 눌러도 된다 — 전에는 조용한 걸음만 되풀이해서 아무 일도 없는 것처럼 보였다 */
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'think', null, { timeout: 8000 });
  const koThink = await page.evaluate(() => window._spoken.filter((x) => /ko/i.test(x.lang)).length);
  await page.locator('.sp-replay').click();
  await page.waitForTimeout(300);
  ok('★ 말할 시간에 다시 듣기 — 뜻부터 다시 읽어 준다 ★', (await run.getAttribute('data-step')) === 'prompt' && (await run.getAttribute('data-index')) === '1'
    && await page.evaluate((n) => window._spoken.filter((x) => /ko/i.test(x.lang)).length === n + 1, koThink));
  /* 멈춰 둔 채로 눌러도 다시 흘러간다 */
  await page.locator('.sp-pause').click();
  await page.locator('.sp-replay').click();
  await page.waitForTimeout(300);
  ok('멈춘 채로 다시 듣기를 누르면 다시 흘러간다', (await run.getAttribute('data-paused')) !== '1' && (await run.getAttribute('data-step')) === 'prompt');
  await page.locator('.sp-next').click();
  await page.waitForTimeout(500);
  ok('마지막 문장에서 다음을 누르면 끝난다', await page.locator('.sp-done').count() === 1 && (await page.locator('.sp-donehead').innerText()).includes('2문장'));
  const after = await page.evaluate(() => ({ review: localStorage.getItem('jp_manabu_review_v1'), stats: JSON.parse(localStorage.getItem('jp_manabu_stats_v1') || '{}') }));
  ok('★ 복습 기록은 건드리지 않는다 ★', after.review === reviewBefore);
  ok('★ 말한 문장 수가 활동에 남는다 ★', Object.values(after.stats).some((d) => d.speak === 2), JSON.stringify(Object.values(after.stats).slice(-1)));

  console.log('\n[ 일본어 듣고 따라 말하기 ]');
  await page.locator('.sp-out').click();
  await page.locator('.sp-dirs [data-dir="jp-ko"]').click();
  ok('「정답을 들은 뒤 한 번 더 말하기」가 기본으로 켜져 있다', await page.locator('.sp-agains [data-again="1"].active').count() === 1);
  await page.locator('.sp-start').click();
  await page.waitForTimeout(400);
  ok('★ 일본어가 먼저 보이고 뜻은 가려져 있다 ★', await page.locator('.sp-jp').count() === 1 && await page.locator('.sp-ko.sp-hidden').count() === 1);
  /* 일본어 → 따라 말하기 → 뜻과 일본어 → (뜻을 본 채로) 한 번 더 말하기 */
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'answer', null, { timeout: 15000 });
  ok('뜻이 나오고 일본어를 한 번 더 들려준다', await page.locator('.sp-ko:not(.sp-hidden)').count() === 1);
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'repeat', null, { timeout: 15000 });
  ok('★ 일본어가 끝난 뒤에도 뜻을 본 채로 한 번 더 말할 차례가 온다 ★', (await run.getAttribute('data-index')) === '0' && (await page.locator('.sp-step').innerText()).includes('한 번 더 말해')
    && await page.locator('.sp-ko:not(.sp-hidden)').count() === 1 && await page.locator('.sp-jp').count() === 1 && await page.locator('.sp-stage.speak-now').count() === 1);
  await page.locator('.sp-quit').click();
  ok('그만하면 설정으로 돌아온다', await page.locator('.sp-setup').count() === 1);
  /* 끄면 정답을 듣고 바로 다음 문장 */
  await page.locator('.sp-agains [data-again="0"]').click();
  ok('설정에서 끄면 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_speak_prefs_v1')).again === false));
  await page.locator('.sp-start').click();
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step === 'answer', null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.sp-run')?.dataset.step !== 'answer', null, { timeout: 15000 });
  ok('★ 끄면 한 번 더 말하기 없이 다음 문장으로 간다 ★', (await run.getAttribute('data-index')) === '1' && (await run.getAttribute('data-step')) === 'prompt');
  await page.locator('.sp-quit').click();
  await page.locator('.sp-agains [data-again="1"]').click();

  console.log('\n[ AI 문장 회차 ]');
  ok('회차가 하나뿐이면 회차 고르기는 안 보인다', await page.locator('.sp-batches').count() === 0);
  await page.locator('.sp-topic').fill('회사 회의');
  await page.locator('.sp-make').click();
  await page.waitForTimeout(1200);
  const store = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').speak?.items || {}));
  const ids = [...new Set(store.map((x) => x.batch))];
  ok('★ 다시 만들면 새 회차로 저장된다 ★', store.length === 4 && ids.length === 2 && ids.every(Boolean), `${store.length}문장 · ${ids.length}회차`);
  ok('회차 고르기가 나온다(전체 섞기 + 회차 둘)', await page.locator('.sp-batches [data-batch]').count() === 3 && await page.locator('.sp-batches [data-batch="all"].active').count() === 1);
  ok('회차마다 번호 · 주제 · 문장 수가 보인다', (await page.locator('.sp-batches [data-no="2"]').innerText()).replace(/\s+/g, ' ').includes('2회차 · 회사 회의 2개') && (await page.locator('.sp-batches [data-no="1"]').innerText()).includes('식당에서 주문'));
  await page.locator('.sp-sources [data-source="ai"]').click();
  await page.locator('.sp-batches [data-no="2"]').click();
  ok('★ 회차 하나를 고르면 그 문장 수만큼만 연습한다 ★', (await page.locator('.sp-sources [data-source="ai"]').innerText()).includes('2개') && (await page.locator('.sp-start').innerText()).includes('2문장'));
  await page.locator('.sp-start').click();
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => document.querySelector('.sp-jp')?.textContent || '');
  ok('★ 고른 회차의 문장만 나온다 ★', (await page.locator('.sp-pos').innerText()).replace(/\s/g, '') === '1/2' && SECOND.sentences.some((x) => x.jp === picked), picked);
  await page.locator('.sp-quit').click();
  await page.locator('.sp-batches [data-no="1"]').click();
  ok('둘 다 고르면 전체 섞기와 같다', await page.locator('.sp-batches [data-batch="all"].active').count() === 1 && (await page.locator('.sp-start').innerText()).includes('4문장'));
  await page.locator('.sp-batches [data-no="1"]').click();
  ok('전체에서 회차 하나를 누르면 그 회차만 고른다 · 고른 회차를 기억한다', await page.locator('.sp-batches [data-no="1"].active').count() === 1 && await page.locator('.sp-batches [data-no="2"].active').count() === 0 && await page.locator('.sp-batches [data-batch="all"].active').count() === 0
    && await page.evaluate(() => JSON.parse(localStorage.getItem('jp_speak_prefs_v1')).batches.length === 1));
  if ((await page.locator('.sp-savedrow').getAttribute('aria-expanded')) !== 'true') await page.locator('.sp-savedrow').click();
  ok('저장한 문장도 회차별로 묶여 보인다', await page.locator('.sp-batch').count() === 2 && (await page.locator('.sp-batchhead').first().innerText()).includes('2회차'));
  ok('가로로 넘치지 않는다(회차)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
