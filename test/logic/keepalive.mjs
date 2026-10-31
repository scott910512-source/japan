/* 서버 깨우기 — 요청이 맞고, 실패를 숨기지 않는가.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 하루 한 번 도는 이 일은 아무도 안 본다. 그래서 두 가지가 조용히 틀어지기 쉽다.
 *
 *   요청이 틀린다   엉뚱한 주소를 부르거나 키 헤더가 빠지면 「성공」으로 끝나도 서버는
 *                    깨어나지 않는다. 정지를 막는다는 목적이 조용히 사라진다
 *   실패를 삼킨다   서버가 이미 정지됐는데 초록으로 끝나면, 알림이 안 오고 로그인이
 *                    막힌 뒤에야 안다
 *
 * 진짜 서버는 부를 수 없으니(이 검사는 인터넷 없이 돈다) 이 컴퓨터에 가짜 서버를 열어
 * 스크립트를 실제로 돌리고, 받은 요청과 끝난 모양(종료 코드)을 본다. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'tools', 'keepalive.sh');
const KEY = 'sb_publishable_TESTKEY_abc123';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 가짜 서버 — replies는 요청마다 차례로 돌려줄 상태 코드 */
function mock(replies) {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, apikey: req.headers.apikey });
    const code = replies[Math.min(seen.length - 1, replies.length - 1)];
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(code < 300 ? '[]' : '{"message":"nope"}');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, port: server.address().port })));
}

function run(env) {
  return new Promise((resolve) => {
    const p = spawn('bash', [SCRIPT], { env: { ...process.env, RETRY_SLEEP: '0', ...env } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

console.log('\n[ 정상 — 서버가 깨어 있다 ]');
{
  const m = await mock([200]);
  const r = await run({ SUPABASE_URL: `http://127.0.0.1:${m.port}`, SUPABASE_KEY: KEY, RETRIES: '3' });
  ok('종료 코드 0', r.code === 0, `${r.code}`);
  ok('★ 한 번에 끝난다 — 요청 1번 ★', m.seen.length === 1, `${m.seen.length}번`);
  ok('★ 데이터베이스까지 닿는 요청이다 — user_data 조회 ★', m.seen[0]?.method === 'GET' && m.seen[0]?.url === '/rest/v1/user_data?select=user_id&limit=1', m.seen[0]?.url);
  ok('★ 키가 헤더로 간다 ★', m.seen[0]?.apikey === KEY);
  ok('★ 로그에 키가 안 남는다 ★', !r.out.includes(KEY), r.out.includes(KEY) ? '키가 출력됨' : '없음');
  ok('성공을 알린다', r.out.includes('깨어 있어요'));
  m.server.close();
}

console.log('\n[ 일시 장애 — 다시 해 보고 성공하면 초록 ]');
{
  const m = await mock([503, 200]);
  const r = await run({ SUPABASE_URL: `http://127.0.0.1:${m.port}`, SUPABASE_KEY: KEY, RETRIES: '3' });
  ok('종료 코드 0', r.code === 0, `${r.code}`);
  ok('두 번째 시도에서 성공 — 요청 2번', m.seen.length === 2, `${m.seen.length}번`);
  m.server.close();
}

console.log('\n[ 실패는 숨기지 않는다 ]');
for (const [code, label] of [[503, '서버 오류'], [401, '키 거절'], [404, '테이블 없음']]) {
  const m = await mock([code]);
  const r = await run({ SUPABASE_URL: `http://127.0.0.1:${m.port}`, SUPABASE_KEY: KEY, RETRIES: '3' });
  ok(`★ ${label}(HTTP ${code}) — 실패로 끝난다 → 실패 메일이 간다 ★`, r.code === 1, `종료 ${r.code}`);
  ok(`${label} — 끝까지 세 번 해 본다`, m.seen.length === 3, `${m.seen.length}번`);
  ok(`${label} — 무엇을 확인할지 알린다`, r.out.includes('대시보드'));
  m.server.close();
}
{
  const m = await mock([401]);
  const r = await run({ SUPABASE_URL: `http://127.0.0.1:${m.port}`, SUPABASE_KEY: KEY, RETRIES: '1' });
  ok('키 거절은 원인을 알려 준다', r.out.includes('키를 거절'), r.out.split('\n').find((l) => l.includes('거절')));
  m.server.close();
}
{
  /* 닫힌 포트 — 정지된 프로젝트처럼 아예 안 열린다 */
  const m = await mock([200]);
  const dead = m.port;
  await new Promise((res) => m.server.close(res));
  const r = await run({ SUPABASE_URL: `http://127.0.0.1:${dead}`, SUPABASE_KEY: KEY, RETRIES: '2' });
  ok('★ 서버가 아예 안 열리면(정지) 실패로 끝난다 ★', r.code === 1, `종료 ${r.code}`);
  ok('정지·장애일 수 있다고 알린다', r.out.includes('닿지 못했어요'));
}

console.log('\n[ 설정은 앱 소스에서 읽는다 — 두 군데에 적지 않는다 ]');
{
  const r = await run({ KEEPALIVE_DRY: '1' });
  const src = readFileSync(join(ROOT, 'src', 'lib', 'supabase.js'), 'utf8');
  const srcUrl = src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  ok('★ 앱이 쓰는 서버 주소를 그대로 읽는다 ★', Boolean(srcUrl) && r.out.includes(srcUrl), srcUrl);
  ok('키도 읽는다(값은 안 찍는다)', r.out.includes('키: 있음') && !/sb_publishable_/.test(r.out));
  ok('요청은 안 보낸다(시험 모드)', r.out.includes('요청은 보내지 않았어요') && r.code === 0);
  const none = await run({ SUPABASE_URL: '', SUPABASE_KEY: '' });
  /* env가 비어 있으면 소스에서 읽으니 이 경우도 주소가 잡힌다 — 소스가 비었을 때만 2로 끝난다 */
  ok('환경변수가 비어도 소스에서 채운다', none.out.includes('서버:'), none.out.split('\n')[0]);
}

console.log('\n[ 워크플로 — 하루 한 번, 손으로도 ]');
{
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'keepalive.yml'), 'utf8');
  ok('★ 매일 도는 예약이 있다 ★', /schedule:\s*\n\s*-\s*cron:\s*'[^']+\s+\*\s+\*\s+\*'/.test(yml) || /cron:\s*'\d+ \d+ \* \* \*'/.test(yml));
  ok('정각을 피했다(분이 0이 아님)', !/cron:\s*'0 /.test(yml));
  ok('손으로도 돌릴 수 있다 — workflow_dispatch', /workflow_dispatch:/.test(yml));
  ok('이 스크립트를 부른다', /bash tools\/keepalive\.sh/.test(yml));
  ok('★ 권한은 읽기만 ★', /permissions:\s*\n\s*contents:\s*read/.test(yml) && !/contents:\s*write/.test(yml));
  ok('시간 제한이 있다(멈춰 있지 않게)', /timeout-minutes:\s*\d+/.test(yml));
  ok('서버 키를 비밀값으로 끌어오지 않는다 — 소스에서 읽는다', !/secrets\./.test(yml));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
