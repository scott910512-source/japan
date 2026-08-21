import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.gttsKey = 'AIzaWORKINGVOICEKEY';   // 잘 되던 음성 키
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await p.waitForTimeout(1000);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.context().setOffline(true);
  await p.waitForTimeout(900);
  const off = p.locator('.gate-offline'); if (await off.count()) { await off.click(); await p.waitForTimeout(700); }

  await goTab(p, '더보기');
  await p.waitForTimeout(700);

  const input = p.locator('input[name="gtts-api-key"]');
  await input.fill('AQ.SAMPLE-NOT-A-REAL-KEY-000000000000');
  await p.waitForTimeout(300);
  ok('Gemini 키를 알아봄', await p.locator('.set-warn').count() === 1);
  ok('어디에 넣어야 하는지 알려 줌', (await p.textContent('.set-warn')).includes('영상 학습'));

  await p.locator('button', { hasText: '저장하고 확인' }).click();
  await p.waitForTimeout(600);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).gttsKey);
  ok('되던 음성 키를 덮어쓰지 않음', saved === 'AIzaWORKINGVOICEKEY', saved);
  ok('토스트로 이유를 알려 줌', (await p.textContent('body')).includes('Gemini 키예요'));

  // 정상적인 Cloud 키는 그대로 저장된다
  await input.fill('AIzaNEWVOICEKEY123');
  await p.waitForTimeout(300);
  ok('Cloud 키에는 경고 없음', await p.locator('.set-warn').count() === 0);
  await p.locator('button', { hasText: '저장하고 확인' }).click();
  await p.waitForTimeout(900);
  ok('Cloud 키는 저장됨', (await p.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).gttsKey)) === 'AIzaNEWVOICEKEY123');

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await b.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
