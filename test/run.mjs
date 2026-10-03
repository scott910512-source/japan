/* 전부 돌린다.  npm test
 *
 * 두 갈래다.
 *   logic/  순수 함수 — 회독 규칙, 기기 합치기, 자막 파싱. 브라우저가 필요 없다.
 *   ui/     빌드한 결과물을 진짜 크롬으로 눌러 본다. 소스가 아니라 배포될 물건이다.
 *
 * ui 쪽은 미리 빌드해 두고 vite preview로 띄운 뒤 돈다 — 개발 서버가 아니라
 * 실제 배포와 같은 경로(/japan/)와 같은 파일을 봐야 의미가 있다.
 *
 * 크롬은 PLAYWRIGHT 브라우저를 쓴다. 경로가 다르면 CHROMIUM 환경변수로 준다.
 *   CHROMIUM=/path/to/chrome npm test
 * ui를 건너뛰려면:  npm test -- --logic
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = Number(process.env.PORT || 8932);
const APP_URL = `http://localhost:${PORT}/japan/`;
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : '');
/* 검사 하나에 줄 시간. 제일 긴 묶음(listen-ui)이 160초쯤이라 두 배를 둔다 —
   느린 러너에서 한 번 길어졌다고 통째로 죽이면 고칠 것도 못 찾는다. */
const TIMEOUT_MS = 300_000;

const only = process.argv.includes('--logic') ? 'logic' : process.argv.includes('--ui') ? 'ui' : 'all';

const list = (dir, ext) => (existsSync(join(HERE, dir))
  /* 밑줄로 시작하는 건 검사가 아니라 검사들이 같이 쓰는 것이다 —
     화면 사이를 다니는 길(_nav.js) 같은 것. 돌리면 0개 통과로 죽는다. */
  ? readdirSync(join(HERE, dir)).filter((f) => f.endsWith(ext) && !f.startsWith('_')).sort()
  : []);

/* 검사 하나를 돌리고 "통과 N / 실패 M"을 읽어 온다.
   출력은 그대로 흘려보낸다 — 실패했을 때 어느 줄이 깨졌는지 봐야 한다. */
function runOne(cmd, args, label) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    // CHROMIUM이 빈 값이면 넘기지 않는다 — 검사가 알아서 찾게 둔다
    env: { ...process.env, APP_URL, ...(CHROME ? { CHROMIUM: CHROME } : {}) },
    timeout: TIMEOUT_MS,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/통과\s+(\d+)\s*\/\s*실패\s+(\d+)/);
  const passed = m ? Number(m[1]) : 0;
  // 성공 요약을 찍은 뒤 프로세스가 죽어도 통과로 처리하지 않는다.
  /* ★ 「졌다」와 「죽었다」를 가린다 ★
     여태 0이 아닌 종료 코드면 모두 죽은 것으로 적었다. 그런데 검사가
     「실패 1」을 제대로 찍고 1로 끝나는 것은 죽은 게 아니라 진 것이다.
     그걸 「멈춤」으로 적으면, 깨진 이름만 보고 어디서 멈췄나를 찾다가
     정작 ✗ 한 줄을 못 본다. 요약을 찍었으면 진 것이다. */
  const crashed = !m || Boolean(r.error);
  /* ★ 시간초과와 죽음을 가려 적는다 ★
     둘 다 「멈춤」으로 적었더니, 깨진 이름만 보고는 어디를 봐야 할지
     알 수 없었다 — 검사가 느려진 것과 코드가 터진 것은 고칠 데가 다르다.
     시간초과면 마지막으로 찍힌 줄이 「거기서 기다리다 끊겼다」는 뜻이고,
     죽은 것이면 그 아래에 이유가 적혀 있다. */
  const timedOut = r.error?.code === 'ETIMEDOUT' || (!m && r.signal === 'SIGTERM');
  const failed = Math.max(m ? Number(m[2]) : 1, crashed ? 1 : 0);
  console.log(`\n── ${label}`);
  if (failed > 0 || crashed) {
    const tail = out.trim().split('\n').slice(-25).join('\n');
    process.stdout.write(tail);
    console.log();
    /* 깨진 줄을 깃허브 주석으로도 남긴다.
     *
     * 액션 로그는 조직에 따라 못 받는 경우가 있다 — 실제로 그랬고, 어느 검사가
     * 왜 깨졌는지 알 길이 없어 짐작으로 고치게 됐다. 주석은 API로 읽히니
     * 로그를 못 봐도 어디가 깨졌는지는 남는다. */
    if (process.env.GITHUB_ACTIONS) {
      const why = out.split('\n').filter((l) => l.includes('✗') || /Error|Timeout|CRASH/.test(l))
        .slice(0, 6).map((l) => l.trim()).join(' | ');
      console.log(`::error title=${label}::${(why || tail.split('\n').slice(-3).join(' ')).replace(/[\r\n]+/g, ' ').slice(0, 900)}`);
    }
  } else {
    console.log(`   통과 ${passed}`);
  }
  return { label, passed, failed, crashed, timedOut };
}

/* preview 서버가 뜰 때까지 기다린다. 바로 붙으면 아직 안 올라와 있어서
   첫 검사가 통째로 실패한다. */
async function waitFor(url, ms = 30_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* 아직 안 떴다 */ }
    await new Promise((r) => { setTimeout(r, 300); });
  }
  return false;
}

const results = [];

if (only !== 'ui') {
  for (const f of list('logic', '.mjs')) {
    results.push(runOne('npx', ['vite-node', join(HERE, 'logic', f)], `logic/${f}`));
  }
}

let server = null;
if (only !== 'logic') {
  const ui = list('ui', '.js');
  if (ui.length) {
    if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
      console.log('── 빌드 (dist가 없음)');
      spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    }
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT, stdio: 'ignore', detached: true,
    });
    if (!(await waitFor(APP_URL))) {
      console.error(`\n서버가 안 떴어요 (${APP_URL}). 다른 게 ${PORT} 포트를 쓰고 있는지 보세요.`);
      try { process.kill(-server.pid); } catch { /* 이미 죽음 */ }
      process.exit(2);
    }
    for (const f of ui) results.push(runOne('node', [join(HERE, 'ui', f)], `ui/${f}`));
  }
}

if (server) { try { process.kill(-server.pid); } catch { /* 이미 죽음 */ } }

const passed = results.reduce((n, r) => n + r.passed, 0);
const failed = results.reduce((n, r) => n + r.failed, 0);
const broken = results.filter((r) => r.failed > 0 || r.crashed);

console.log(`\n${'─'.repeat(46)}`);
console.log(`검사 ${results.length}묶음 · 통과 ${passed} · 실패 ${failed}`);
if (broken.length) {
  const list = broken.map((r) => {
    if (r.timedOut) return `${r.label}(${TIMEOUT_MS / 1000}초 넘겨 끊음 — 위 출력의 마지막 줄에서 기다리다 끊겼다)`;
    if (r.crashed) return `${r.label}(멈춤)`;
    return r.label;
  }).join(', ');
  console.log(`\n깨진 곳: ${list}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=깨진 곳::${list}`);
  process.exit(1);
}
console.log('전부 통과');
