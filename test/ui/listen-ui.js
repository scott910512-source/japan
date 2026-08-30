/* 듣기 · 따라 말하기 — 화면 안 보고 하는 공부.
 *
 * today.js에서 떼어 왔다. 이 화면 하나가 검사 백 줄이 넘게 자라서 today.js가
 * 묶음 제한(180초)에 걸려 통째로 멈췄다 — 오늘 화면이 멀쩡한지 보려는데
 * 듣기 때문에 아무것도 못 보게 됐다. 결이 다른 것은 파일도 갈라 둔다.
 *
 * 여기서 보는 것.
 *   · 시작 버튼이 맨 위에 작게 있고 한 번 더 묻는가
 *   · 뜻도 소리로 나오는가 — 화면을 못 보는 동안 쓰는 자리다
 *   · 뒤집어서(뜻 → 일본어) 물어보고 답을 두 번 들려주는가
 *   · 음성 목록이 비어 있는 기기에서도 읽는가
 *   · 범위와 개수가 실제로 먹고 순서가 흩어지는가 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  \u2713', l, e !== undefined ? `\u2014 ${e}` : ''); } else { fail++; console.log('  \u2717', l, e !== undefined ? `\u2014 ${e}` : ''); }
};

/* 며칠 해 본 사람의 기록 — 빈 기기로만 보면 「배운 것」 범위가 비어 있다 */
function seeded() {
  const day = (d) => {
    const x = new Date(); x.setDate(x.getDate() - d);
    return x.toISOString().slice(0, 10);
  };
  const review = {};
  for (let i = 1; i <= 30; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = { box: 3, streak: 1, lastSeen: day(5), rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1 };
  }
  return { review };
}

/* 재생을 시작한다. 시작 버튼이 맨 위로 작아지면서 확인을 한 번 더 받는다 —
   누르자마자 소리가 나면 이어폰을 안 꽂았을 때 놀란다. */
async function startListen(page) {
  await page.locator('.ls-go').click();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').click();
  await page.waitForTimeout(900);
}

/* 앱이 뜨기 전에 심어야 하는 것(음성 목록 가로채기)은 세 번째 인자로 받는다.
   patch에 같이 넣으면 안 된다 — patch는 통째로 page.evaluate에 넘어가는데
   함수는 그 경계를 못 넘는다. */
async function boot(browser, patch = {}, init = null) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  if (init) await page.addInitScript(init);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    Object.assign(s, p.settings || {});
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (p.review) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(p.review));
  }, patch);
  await page.waitForTimeout(1000);
  /* 켜진 채로 다시 부르고 나서 끊는다. 끊고 부르면 서비스워커가 자리를 못 잡아
     아무것도 안 뜬다 — 인터넷 되는 곳(CI)에서 이것 때문에 검사가 통째로 죽었다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, seeded());
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n── 듣기 · 따라 말하기');
  await goTab(page, '듣기');
  await page.locator('.lh-way[data-way="auto"]').click();
  await page.waitForTimeout(800);
  const listen = await page.textContent('.sub-body');
  ok('듣기 화면이 열림', await page.locator('.listen').count() === 1);
  ok('두 가지 방식', await page.locator('.listen .ls-mode').count() === 2, listen.slice(0, 40));
  ok('간격을 고를 수 있음', await page.locator('.listen .grouppick button', { hasText: '초' }).count() === 4);

  /* ★ 무엇을 들을지 여기서 고른다 ★
     여태 오늘의 학습 큐를 빌려 써서, 배운 게 수백 개인데 늘 같은 스무 개가
     같은 차례로 들렸다. 그러면 소리가 아니라 순서를 외운다. */
  ok('무엇을 들을지 고를 수 있다', await page.locator('.listen .ls-scope').count() === 4);
  ok('범위마다 몇 개인지 미리 보인다',
    /\d+개/.test(await page.locator('.ls-scope[data-scope="seen"] .pk-count').innerText()),
    (await page.locator('.listen .ls-scope .pk-count').allTextContents()).join(' / '));
  /* ★ 오늘 몫 스무 장에 묶여 있지 않다 ★
     이 화면이 회독 큐를 빌려 쓰던 시절엔 고를 수 있는 게 그 스무 장이 전부였다. */
  const allN = Number((await page.locator('.ls-scope[data-scope="all"] .pk-count').innerText()).match(/\d+/)[0]);
  ok('고를 수 있는 범위가 오늘 몫보다 훨씬 넓다', allN > 500, `${allN}개`);

  ok('방향을 고를 수 있다', await page.locator('.listen .ls-dir').count() === 2);
  ok('뒤집는 길이 있다', await page.locator('.ls-dir[data-dir="ko-jp"]').count() === 1);

  /* ── 시작 버튼은 맨 위에 작게 ──
     아래에 커다랗게 두었더니 화면 하나를 먹어서, 간격이나 개수를 바꾸려면
     스크롤을 해야 했다. 설정이 세 덩이인 화면에서 그건 매번 드는 비용이다. */
  ok('시작 버튼이 맨 위에 있다', await page.locator('.ls-top .ls-go').count() === 1);
  ok('커다란 버튼은 없앴다', await page.locator('.listen .bigstart').count() === 0);
  ok('무엇으로 시작하는지 옆에 적혀 있다',
    /\d+개 · \d+초/.test(await page.locator('.ls-topbody').innerText()),
    (await page.locator('.ls-topbody').innerText()).replace(/\n/g, ' '));

  /* 누르자마자 소리가 나면 이어폰을 안 꽂았을 때 놀란다 — 한 번 더 묻는다 */
  await page.locator('.ls-go').click();
  await page.waitForTimeout(500);
  ok('바로 시작하지 않고 한 번 더 묻는다', await page.locator('.ls-ask').count() === 1);
  ok('아직 재생 안 됨', await page.locator('.ls-stage').count() === 0);
  ok('무엇으로 시작할지 보여 준다', await page.locator('.ls-ask .td-cell').count() === 3);
  await page.locator('.ls-ask .ghost-btn').click();
  await page.waitForTimeout(500);
  ok('아니요를 누르면 안 시작한다', await page.locator('.ls-stage').count() === 0);
  ok('회독 기록은 안 건드린다고 밝힘', listen.includes('회독 기록은 건드리지 않아요'));

  /* ★ 화면을 못 보는 동안 쓰는 자리다 ★
     뜻이 눈으로만 나오면 일본어 뒤에 침묵만 남는다 — 절반이 안 들리는 셈이다. */
  ok('뜻도 소리로 낼 수 있다', listen.includes('한국어 뜻도 소리로'));
  const koRow = page.locator('.listen .toggle-row', { hasText: '한국어 뜻도' });
  /* ★ 목록이 비었다고 꺼 두지 않는다 ★
     예전엔 음성 목록에 한국어가 없으면 토글을 끄고 회색으로 잠갔다. 그런데
     안드로이드 크롬·웹뷰는 목록이 []인데도 소리가 멀쩡히 난다 — 그 기기에서
     일본어는 나오고 한국어만 안 나왔고, 사용자는 켤 수도 없었다.
     목록이 비었으면 「모른다」이지 「없다」가 아니다. */
  ok('기기와 상관없이 기본으로 켜져 있다',
    await koRow.locator('.toggle.on').count() === 1,
    (await koRow.innerText()).replace(/\n/g, ' ').slice(0, 70));
  ok('잠가 두지 않는다', !(await koRow.isDisabled()));
  ok('무엇을 해 주는지 적혀 있다',
    (await koRow.innerText()).includes('뜻을 읽어 줘요'),
    (await koRow.innerText()).replace(/\n/g, ' ').slice(0, 70));
  ok('화면이 꺼지면 멈길 수 있다고 밝힘', listen.includes('멈출 수 있'));

  const beforeReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  await startListen(page);
  await page.waitForTimeout(400);
  ok('재생 화면으로 바뀜', await page.locator('.ls-stage').count() === 1);
  ok('일본어가 크게 나옴', (await page.textContent('.ls-jp')).trim().length > 0);
  ok('한글 발음도 나옴', (await page.textContent('.ls-yomi')).trim().length > 0);
  ok('뜻은 아직 안 보임', (await page.textContent('.ls-ko')).trim() === '···');
  /* 무엇을 읽으라고 넘겼는지만 가로챈다 — 진짜 음성 엔진은 검사에서 못 쓴다.
     일본어는 클라우드 음성을 쓸 수 있어 여기 안 잡힐 수도 있지만, 뜻은
     기기 음성으로만 내므로 반드시 잡힌다. */
  ok('손 안 대도 넘어간다고 적힘', (await page.textContent('.ls-note')).includes('손을 안 대도'));

  await page.locator('.ls-controls .ghost-btn', { hasText: '다음' }).click();
  await page.waitForTimeout(500);
  ok('다음으로 넘길 수 있음', (await page.textContent('.listen .sub-title')).startsWith('2 /'), await page.textContent('.listen .sub-title'));

  /* 듣기는 귀에 넣는 것만 한다 — 회독 기록을 건드리면 안 된다 */
  const afterReview = await page.evaluate(() => localStorage.getItem('jp_manabu_review_v1'));
  ok('듣기가 회독 기록을 안 건드림', beforeReview === afterReview);

  await page.locator('.listen .sub-back').click();
  await page.waitForTimeout(500);
  ok('그만두면 시작 화면으로', await page.locator('.listen .ls-go').count() === 1);

  await page.close();

  /* ── 한국어 음성이 있는 기기에서 ──
     검사 기기에는 한국어 음성이 없어서 위에서는 안내만 확인된다. 여기서는
     있는 척을 하고, 뜻 차례에 실제로 읽으라고 넘기는지 본다. */
  console.log('\n── 듣기에서 뜻도 읽어 준다');
  {
    /* 음성 목록에 한국어를 끼워 넣고, 무엇을 읽으라고 넘겼는지 가로챈다.
       진짜 음성 엔진은 검사에서 못 쓴다. */
    const p7 = await boot(browser, { settings: { listenGap: 1 } }, () => {
      window.__said = [];
      const ko = { voiceURI: 'test-ko', name: 'Test Korean', lang: 'ko-KR' };
      const ja = { voiceURI: 'test-ja', name: 'Test Japanese', lang: 'ja-JP' };
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices = () => [ko, ja];
      const real = synth.speak.bind(synth);
      synth.speak = (u) => {
        window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
        try { real(u); } catch { /* 무시 */ }
      };
    });

    const err7 = [];
    p7.on('pageerror', (e) => err7.push(e.message));
    await goTab(p7, '듣기');
    await p7.locator('.lh-way[data-way="auto"]').click();
    await p7.waitForTimeout(900);

    const row = p7.locator('.listen .toggle-row', { hasText: '한국어 뜻도' });
    ok('한국어 음성이 있으면 켜진다', await row.locator('.toggle.on').count() === 1,
      (await row.innerText()).replace(/\n/g, ' ').slice(0, 60));
    ok('안내도 바뀐다', (await row.innerText()).includes('화면을 안 봐도'));

    await p7.evaluate(() => { window.__said = []; });
    await startListen(p7);
    ok('재생이 시작된다', await p7.locator('.ls-stage').count() === 1);
    /* 음성 하나를 못 붙였다고 화면이 죽으면 안 된다 — 검사에서 끼워 넣은
       가짜 음성은 진짜 SpeechSynthesisVoice가 아니라 붙이기가 실패한다.
       실제 기기에서도 목록이 이상한 브라우저가 있다. */
    ok('음성을 못 붙여도 화면이 안 죽는다', err7.length === 0, err7.slice(0, 2).join(' | '));

    /* 일본어 → 뜸 → 뜻. 뜻 차례가 올 때까지 기다린다 — 문장이 길면
       읽는 시간이 길어져서 고정 시간으로 재면 흔들린다. */
    let heardKo = false;
    for (let i = 0; i < 20 && !heardKo; i++) {
      await p7.waitForTimeout(1000);
      heardKo = await p7.evaluate(() => (window.__said || []).some((u) => u.lang === 'ko-KR'));
    }
    const said = await p7.evaluate(() => window.__said || []);
    ok('일본어를 읽는다', said.some((u) => u.lang === 'ja-JP'), said.map((u) => u.lang).join(','));
    ok('뜻도 읽어 준다', heardKo,
      said.map((u) => `${u.lang}:${u.text}`).join(' | ').slice(0, 120));

    /* 끄면 안 읽어야 한다 — 껐는데 나오면 설정이 거짓말이 된다 */
    await p7.locator('.listen .sub-back').click();
    await p7.waitForTimeout(700);
    await row.click();
    await p7.waitForTimeout(300);
    ok('끌 수 있다', await row.locator('.toggle.on').count() === 0);

    await p7.evaluate(() => { window.__said = []; });
    await startListen(p7);
    /* 일본어를 두 장 읽을 때까지만 본다 — 그동안 한국어가 한 번도 안 나오면
       꺼진 것이다. 고정으로 오래 기다리면 검사 전체가 시간에 쫓긴다. */
    for (let i = 0; i < 20; i++) {
      await p7.waitForTimeout(700);
      const n = await p7.evaluate(() => (window.__said || []).filter((u) => u.lang === 'ja-JP').length);
      if (n >= 2) break;
    }
    const said2 = await p7.evaluate(() => window.__said || []);
    ok('끄면 뜻은 안 읽는다', !said2.some((u) => u.lang === 'ko-KR'),
      said2.map((u) => u.lang).join(',') || '조용함');
    ok('그래도 일본어는 읽는다', said2.some((u) => u.lang === 'ja-JP'));

    await p7.close();
  }

  /* ── 뒤집어서 — 뜻을 듣고 내가 일본어로 ──
   *
   * 듣고 알아듣는 것과, 듣고 말해 보는 것은 다른 연습이다. 여행에서 막히는
   * 쪽은 뒤엣것인데 여태 앞엣것만 있었다. */
  console.log('\n── 뜻 → 일본어 (뒤집기)');
  {
    const p8 = await boot(browser, { settings: { listenGap: 1, listenDir: 'ko-jp' } }, () => {
      window.__said = [];
      const ko = { voiceURI: 'test-ko', name: 'Test Korean', lang: 'ko-KR' };
      const ja = { voiceURI: 'test-ja', name: 'Test Japanese', lang: 'ja-JP' };
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices = () => [ko, ja];
      const real = synth.speak.bind(synth);
      synth.speak = (u) => {
        window.__said.push({ text: u?.text || '', lang: u?.lang || '' });
        try { real(u); } catch { /* 무시 */ }
      };
    });
    const err8 = [];
    p8.on('pageerror', (e) => err8.push(e.message));
    await goTab(p8, '듣기');
    await p8.locator('.lh-way[data-way="auto"]').click();
    await p8.waitForTimeout(900);

    ok('고른 방향이 기억된다',
      await p8.locator('.ls-dir[data-dir="ko-jp"].active').count() === 1);
    /* 「따라 말하기」는 들려준 걸 따라 하는 것이라 뒤집은 판에는 없다 */
    ok('뒤집으면 따라 말하기는 안 보인다', await p8.locator('.listen .ls-mode').count() === 0);
    const ansRow = p8.locator('.listen .ls-sayans');
    ok('여기서 끄는 건 일본어 쪽이다', (await ansRow.innerText()).includes('일본어 답도 소리로'),
      (await ansRow.innerText()).replace(/\n/g, ' ').slice(0, 60));

    await p8.evaluate(() => { window.__said = []; });
    await startListen(p8);
    await p8.waitForTimeout(600);
    ok('재생이 시작된다', await p8.locator('.ls-stage').count() === 1);

    /* ★ 뜻이 먼저다 ★ 물어보는 게 뜻인데 일본어가 먼저 보이면 문제가 아니다 */
    ok('뜻이 먼저 뜬다', (await p8.textContent('.ls-prompt')).trim().length > 0,
      (await p8.textContent('.ls-prompt')).trim().slice(0, 30));
    ok('일본어는 아직 가려져 있다', (await p8.textContent('.ls-jp')).trim() === '···',
      (await p8.textContent('.ls-jp')).trim().slice(0, 20));

    const first = await p8.evaluate(() => (window.__said || [])[0] || null);
    ok('한국어부터 읽어 준다', first?.lang === 'ko-KR', JSON.stringify(first));

    /* 말할 틈 → 답. 답이 뜰 때까지 기다린다 */
    let showed = false;
    for (let i = 0; i < 20 && !showed; i++) {
      await p8.waitForTimeout(800);
      showed = (await p8.textContent('.ls-jp')).trim() !== '···';
    }
    ok('말해 본 뒤에 답이 뜬다', showed, await p8.textContent('.ls-phase'));
    const said8 = await p8.evaluate(() => window.__said || []);
    ok('답도 읽어 준다', said8.some((u) => u.lang === 'ja-JP'), said8.map((u) => u.lang).join(','));
    /* ★ 답은 두 번 읽어 준다 ★
       한 번만 읽으면 긴 침묵 뒤에 스치듯 지나간다 — 「나무」를 듣고 3초를
       말해 본 다음 「き」가 0.3초 나오고 끝이니 안 읽어 준 것과 구별이 안 됐다.
       한 번은 확인하려고, 한 번은 내가 말한 것과 견주려고 듣는다. */
    let twice = said8.filter((u) => u.lang === 'ja-JP').length >= 2;
    for (let i = 0; i < 8 && !twice; i++) {
      await p8.waitForTimeout(800);
      twice = await p8.evaluate(() => (window.__said || [])
        .filter((u) => u.lang === 'ja-JP').length >= 2);
    }
    ok('답을 두 번 들려준다', twice,
      (await p8.evaluate(() => (window.__said || []).map((u) => u.lang).join(','))));
    ok('한국어가 일본어보다 먼저 나온다',
      said8.findIndex((u) => u.lang === 'ko-KR') < said8.findIndex((u) => u.lang === 'ja-JP'),
      said8.map((u) => u.lang).join(','));

    /* ★ 답 소리를 끌 수 있어야 한다 ★
       읽어 주면 떠올리기 전에 답이 먼저 들려서, 말하기가 아니라 따라 하기가 된다.
       그래도 화면에는 떠야 한다 — 맞았는지 확인할 길까지 막을 이유는 없다. */
    await p8.locator('.listen .sub-back').click();
    await p8.waitForTimeout(700);
    await ansRow.click();
    await p8.waitForTimeout(300);
    ok('답 소리를 끌 수 있다', await ansRow.locator('.toggle.on').count() === 0);
    ok('끄면 왜 조용한지 적어 준다', (await ansRow.innerText()).includes('화면으로 확인'),
      (await ansRow.innerText()).replace(/\n/g, ' ').slice(0, 70));

    await p8.evaluate(() => { window.__said = []; });
    await startListen(p8);
    let showed2 = false;
    for (let i = 0; i < 20 && !showed2; i++) {
      await p8.waitForTimeout(800);
      showed2 = (await p8.textContent('.ls-jp')).trim() !== '···';
    }
    const said9 = await p8.evaluate(() => window.__said || []);
    ok('끄면 일본어는 안 읽는다', !said9.some((u) => u.lang === 'ja-JP'),
      said9.map((u) => u.lang).join(',') || '조용함');
    ok('그래도 뜻은 읽어 준다 — 그게 문제니까', said9.some((u) => u.lang === 'ko-KR'));
    ok('꺼도 답은 화면에 뜬다', showed2, await p8.textContent('.ls-jp'));

    /* 뒤집어도 회독 기록은 안 건드린다 */
    ok('뒤집어도 안 죽는다', err8.length === 0, err8.slice(0, 2).join(' | '));
    await p8.close();
  }

  /* ── ★ 음성 목록이 비어 있는 기기 ★ ──
   *
   * 안드로이드 크롬과 웹뷰는 getVoices()가 []를 주면서도 소리는 멀쩡히 난다.
   * 그 기기에서 일본어는 나오는데 한국어만 안 나왔다 — 일본어 쪽은 음성을
   * 못 찾아도 lang만 맞춰 그냥 읽는데, 한국어 쪽만 「음성이 없다」며 돌아섰다.
   * 게다가 토글까지 회색으로 잠가 놔서 사용자가 켤 수도 없었다.
   *
   * 목록이 비었으면 「모른다」이지 「없다」가 아니다. 시켜 보고, 안 나면
   * 그때 사용자가 끄면 된다. */
  console.log('\n── 음성 목록이 비어 있어도 읽는다');
  for (const dir of ['jp-ko', 'ko-jp']) {
    const pv = await boot(browser, { settings: { listenGap: 1, listenDir: dir } }, () => {
      window.__said = [];
      const s = window.speechSynthesis;
      if (!s) return;
      s.getVoices = () => [];                 // ← 목록이 비어 있다
      const real = s.speak.bind(s);
      s.speak = (u) => { window.__said.push({ lang: u?.lang || '' }); try { real(u); } catch { /* 무시 */ } };
    });
    await goTab(pv, '듣기');
    const way = pv.locator('.lh-way[data-way="auto"]');
    if (await way.count()) { await way.click(); await pv.waitForTimeout(800); }

    const r = pv.locator('.listen .ls-sayans');
    ok(`[${dir}] 목록이 비어도 토글을 끌 수 없게 잠그지 않는다`, !(await r.isDisabled()));
    ok(`[${dir}] 기본으로 켜져 있다`, await r.locator('.toggle.on').count() === 1);

    await pv.evaluate(() => { window.__said = []; });
    await startListen(pv);
    /* 둘 다 나올 때까지 기다린다. 한쪽만 보고 끊으면 방향에 따라 아직 안 온
       쪽을 「안 나온다」고 잡는다 — 뒤집은 판은 한국어가 먼저다. */
    let both = false;
    for (let i = 0; i < 24 && !both; i++) {
      await pv.waitForTimeout(800);
      both = await pv.evaluate(() => {
        const l = (window.__said || []).map((u) => u.lang);
        return l.includes('ko-KR') && l.includes('ja-JP');
      });
    }
    const langs = await pv.evaluate(() => (window.__said || []).map((u) => u.lang).join(','));
    ok(`[${dir}] 한국어를 읽으라고 넘긴다`, langs.includes('ko-KR'), langs || '조용함');
    ok(`[${dir}] 일본어도 읽는다`, langs.includes('ja-JP'), langs);
    await pv.close();
  }

  /* ── 범위와 개수가 실제로 먹는가, 순서는 흩어지는가 ──
   *
   * 여태 이 화면은 오늘의 학습 큐를 빌려 썼다. 그래서 「전체」를 골라도 오늘
   * 몫 스무 장이 전부였고, 개수 설정은 통째로 무시됐고, 차례까지 매번 같았다.
   * 그러면 소리가 아니라 순서를 외운다. */
  console.log('\n── 전체에서 골라 흩는다');
  {
    const p9 = await boot(browser, { settings: { listenGap: 1, listenScope: 'all', listenCount: 50 } });
    await goTab(p9, '듣기');
    await p9.locator('.lh-way[data-way="auto"]').click();
    await p9.waitForTimeout(900);

    const firstCard = async () => {
      await startListen(p9);
      await p9.waitForTimeout(400);
      const t = (await p9.textContent('.ls-jp')).trim();
      const n = await p9.textContent('.listen .sub-title');
      await p9.locator('.listen .sub-back').click();
      await p9.waitForTimeout(500);
      return { t, n };
    };
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(await firstCard());
    /* ★ 개수 설정이 실제로 먹는다 ★ 「50개만 듣고 자자」가 이 화면의 쓰임이다 */
    ok('고른 개수만큼 담긴다', seq[0].n.trim().endsWith('/ 50'), seq[0].n.trim());
    ok('돌릴 때마다 첫 장이 달라진다', new Set(seq.map((s) => s.t)).size > 1,
      seq.map((s) => s.t).join(' / '));
    await p9.close();
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
