/* 탭 넷 — 홈 · 학습 · 복습 · 내 학습. 한 흐름으로.
 *
 *   홈 → 오늘 학습 시작 → 판정 → 회독 기록 → 나갔다 와서 이어하기
 *   복습 탭 「오늘 복습 N개」 = 홈의 N = 탭 배지 — 복습 시작 → 끝까지 → 홈 진도 갱신 → 내 학습에 끝낸 카드
 *   숫자와 큐가 같다 — 「새로 배우기 8개」를 누르면 판이 8장
 *   N3 코스 → 오늘의 N3 → 종료 → 다시 접속 → 홈 「이어서 공부하기」에서 그 자리로
 *   네 탭 모두 375px에서 가로로 안 넘친다 · 학습 중에는 탭바가 없다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

function seedDue(n) {
  const past = new Date(); past.setDate(past.getDate() - 9);
  const lastSeen = past.toISOString().slice(0, 10);
  const review = {};
  for (let i = 1; i <= n; i++) review[`n5-${String(i).padStart(4, '0')}`] = { box: 3, streak: 1, lastSeen, rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1 };
  return review;
}

async function boot(browser, patch = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.canReadKana = true; s.autoTTS = false;
    Object.assign(s, p.settings || {});
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (p.review) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(p.review));
    sessionStorage.removeItem('jp_n3_view_v1');
  }, patch);
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

/* 오프라인으로 다시 켠다 — 저장된 것만으로 다시 그려지는지 */
async function reboot(page) {
  await page.context().setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const num = (s, re) => Number((s || '').match(re)?.[1] || 0);

async function judgeAll(page, max = 60, label = '알아요') {
  let n = 0;
  for (let i = 0; i < max; i++) {
    if (await page.locator('.finish').count()) break;
    if (await page.locator('.studycard').count() === 0) break;
    let ready = false;
    for (let t = 0; t < 3 && !ready; t += 1) {
      await page.locator('.studycard').click().catch(() => {});
      await page.locator('.judgerow').waitFor({ timeout: 4000 }).catch(() => {});
      ready = await page.locator('.judgerow button', { hasText: label }).count() > 0;
    }
    if (!ready) break;
    await page.locator('.judgerow button', { hasText: label }).first().click();
    await page.waitForTimeout(250);
    n += 1;
  }
  return n;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, { review: seedDue(30), settings: { goals: { fresh: 6, review: 8, weak: 4 } } });
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('── 네 탭');
  const tabs = await page.locator('.tabbar .tab').evaluateAll((els) => els.map((e) => e.textContent.replace(/^\d+\+?/, '')));
  ok('★ 홈 · 학습 · 복습 · 내 학습 ★', tabs.join() === '홈,학습,복습,내 학습', tabs.join());
  ok('켜면 홈', (await page.locator('.tabbar .tab.active').innerText()) === '홈');
  for (const t of ['홈', '학습', '복습', '내 학습']) {
    await goTab(page, t);
    ok(`${t} 탭이 375px에서 가로로 안 넘친다`, !(await overflow(page)));
  }
  await goTab(page, '홈');

  console.log('\n── 숫자는 한 곳에서 — 홈 · 복습 탭 · 배지');
  const homeReview = num(await page.locator('.tdlist .tdtask', { hasText: '복습' }).innerText().catch(() => ''), /(\d+)개/);
  const badge = num(await page.locator('.tabbar .tab[data-tab="review"] .count').innerText().catch(() => '0'), /(\d+)/);
  await goTab(page, '복습');
  const rvLeft = Number(await page.locator('.rv-top').getAttribute('data-left'));
  ok('★ 홈의 복습 수 = 복습 탭의 오늘 복습 수 = 배지 ★', homeReview > 0 && homeReview === rvLeft && badge === rvLeft, `${homeReview} / ${rvLeft} / ${badge}`);
  ok('복습 탭 맨 위가 오늘 복습', (await page.locator('.rv-top').innerText()).includes('오늘 복습'));
  ok('틀린 문제 · 취약 단어 · 취약 문법 · 문장 복습 · 전체 복습', await page.locator('.rv-row').count() === 5);

  console.log('\n── 복습 시작 → 판정 → 끝 → 홈·내 학습에 반영');
  await page.locator('.rv-start').click();
  await page.waitForTimeout(900);
  const intro = page.locator('.study.intro .bigstart');
  if (await intro.count()) {
    const introText = await page.locator('.study.intro').innerText();
    ok('판을 열기 전에 몇 장인지 말한다 — 복습 탭의 수와 같다', introText.includes(String(rvLeft)), introText.replace(/\s+/g, ' ').slice(0, 60));
    await intro.click(); await page.waitForTimeout(900);
  }
  ok('회독 화면', await page.locator('.studycard').count() === 1);
  ok('★ 학습 중에는 탭바가 없다 ★', await page.locator('.tabbar').count() === 0);
  const judged = await judgeAll(page);
  ok('끝까지 판정했다', judged === rvLeft, `${judged} / ${rvLeft}`);
  ok('끝나면 결과 화면', await page.locator('.finish').count() === 1);
  await page.locator('.finish .submit-btn').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  ok('홈으로 돌아온다', await page.locator('.tdhead').count() === 1 && await page.locator('.tabbar').count() === 1);
  const homeRow = page.locator('.tdlist .tdtask', { hasText: '복습' });
  ok('★ 홈의 복습 줄이 다 했다로 바뀐다 ★', (await homeRow.getAttribute('class')).includes('done'), await homeRow.innerText().catch(() => ''));
  ok('배지가 사라진다', await page.locator('.tabbar .tab[data-tab="review"] .count').count() === 0);
  await goTab(page, '복습');
  ok('복습 탭도 다 했다', Number(await page.locator('.rv-top').getAttribute('data-left')) === 0 && (await page.locator('.rv-top').innerText()).includes('다 했어요'));
  await goTab(page, '내 학습');
  const me = await page.locator('.screen.active').innerText();
  ok('내 학습에 끝낸 카드가 적힌다', num(me, /(\d+)\s*끝낸 카드/) >= rvLeft, me.match(/\d+\s*끝낸 카드/)?.[0]);
  ok('JLPT N3 진도 카드가 있다', await page.locator('.me-n3').count() === 1);
  ok('설정으로 가는 줄이 있다', await page.locator('.me-settings').count() === 1);
  const rv = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
  ok('회독 기록에 오늘 판정이 남았다', Object.values(rv).some((v) => v.seenAt > 1000));

  console.log('\n── 새로 배우기: 숫자 = 판');
  await goTab(page, '홈');
  const freshRow = page.locator('.tdlist .tdtask', { hasText: '새로 배우기' });
  const freshN = num(await freshRow.innerText(), /(\d+)개/);
  await freshRow.click(); await page.waitForTimeout(800);
  const swap = page.locator('.swapask .submit-btn');
  if (await swap.count()) { await swap.click(); await page.waitForTimeout(700); }
  const intro2 = page.locator('.study.intro');
  ok('★ 「N개」를 눌렀더니 판도 N장 ★', await intro2.count() === 1 && (await intro2.innerText()).includes(`${freshN}`), (await intro2.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 60));
  await page.locator('.study.intro .bigstart').click(); await page.waitForTimeout(800);
  await judgeAll(page, 1);
  await page.locator('.sh-close').click(); await page.waitForTimeout(600);
  ok('나갔다 오면 큰 버튼이 이어하기', (await page.locator('.bigcta').innerText()).includes('이어하기'));

  console.log('\n── N3 코스: 시작 → 종료 → 다시 접속 → 이어서');
  ok('홈에 N3 진도 한 줄 (아직 시작 전)', (await page.locator('.hm-goal').innerText()).includes('시작 전'));
  await openMenu(page, '한 권으로 끝내는 N3');
  await page.locator('.n3-hub').waitFor({ timeout: 8000 });
  await page.locator('.n3-cta').click();
  await page.locator('.n3-today').waitFor();
  const steps = await page.locator('.n3-steprow').count();
  ok('오늘의 N3가 짜였다', steps >= 4, `${steps}단계`);
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(500);
  await reboot(page);
  ok('다시 켜도 홈', (await page.locator('.tabbar .tab.active').innerText()) === '홈');
  ok('★ 홈 N3 줄에 준비도가 적힌다 (코스가 적어 둔 요약) ★', /\d+%/.test(await page.locator('.hm-goal').innerText()), await page.locator('.hm-goal').innerText());
  const cont = page.locator('.hm-n3');
  ok('이어서 공부하기에 N3 코스 · 오늘 몫', (await cont.innerText()).includes('레슨') && (await cont.innerText()).includes('남음'), (await cont.innerText()).replace(/\s+/g, ' '));
  ok('오늘 목록에 오늘의 N3 줄', await page.locator('.tdlist .tdtask', { hasText: '오늘의 N3' }).count() === 1);
  await cont.click();
  await page.locator('.n3-hub').waitFor({ timeout: 8000 });
  ok('그 자리(코스 메인)로 간다', await page.locator('.n3-hub').count() === 1);
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(400);

  console.log('\n── 학습 탭 · 복습 탭에서 코스 안으로 바로');
  await openMenu(page, '한자');
  await page.locator('.n3-curriculum').waitFor({ timeout: 8000 });
  ok('★ 학습 → 한자는 N3 한자 과정을 연다 ★', await page.locator('.n3-chapter[data-chapter="ch4"].open').count() === 1);
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(400);
  await goTab(page, '복습');
  await page.locator('.rv-row[data-row="wrong"]').click();
  await page.locator('.n3-wrong').waitFor({ timeout: 8000 });
  ok('★ 복습 → 틀린 문제는 N3 오답노트를 연다 ★', await page.locator('.n3-wrong').count() === 1);
  await page.locator('.subscreen.open .sub-header:not(.inline) .sub-back').click(); await page.waitForTimeout(400);
  await openMenu(page, '듣기');
  ok('학습 → 듣기: 자동 · 따라 · 영상', await page.locator('.lh-way').count() === 3);

  console.log('\n── 옛 설정으로 켜도 새 칸이 보인다');
  {
    const p2 = await boot(browser, { settings: { menus: { n3: true, words: true, grammar: false, sentences: true, basics: true, swiss: false, quiz: true, conjugate: true, adverb: true, match: true, rpg: true, repeat: true, weak: true } } });
    await goTab(p2, '학습');
    const names = await p2.locator('.menutile .mt-title').allTextContents();
    ok('옛 설정에 없던 한자·듣기·영상이 켜져 나온다', ['한자', '듣기', '영상'].every((n) => names.includes(n)), names.join(','));
    ok('꺼 둔 문법은 꺼진 채', !names.includes('문법'));
    ok('옛 열쇠(회독 학습·약점 복습)는 학습 탭에 안 뜬다', !names.includes('회독 학습') && !names.includes('약점 복습'));
    await p2.close();
  }

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); console.log(`\n통과 ${pass} / 실패 ${fail + 1}`); process.exit(1); });
