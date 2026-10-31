#!/usr/bin/env bash
# 서버를 깨운다 — 하루에 한 번 부르면 무료 프로젝트가 자동 정지되지 않는다.
#
# ★ 왜 있나 ★
#
# Supabase 무료 프로젝트는 일주일쯤 아무 요청이 없으면 저절로 정지된다. 정지되면
# 서버 주소가 아예 안 열리고, 앱의 로그인은 「Load failed」로 실패한다 — 앱 코드는
# 멀쩡한데 로그인만 막힌다. 학습 기록은 기기에 있어서 공부는 되지만 기기 사이
# 동기화가 멈춘다. 2주쯤 앱을 안 연 사이에 실제로 그랬다.
#
# 그래서 하루 한 번 서버에 진짜 요청을 보낸다(.github/workflows/keepalive.yml).
# 주소만 건드리는 상태 확인(/auth/v1/health)이 아니라 데이터베이스까지 닿는
# 조회를 쓴다 — 정지 판정은 데이터베이스 활동을 기준으로 하기 때문이다.
#
# ★ 안전한 요청이다 ★
#
# 앱이 브라우저에서 쓰는 공개 키로 user_data를 한 줄 조회할 뿐이다. 이 테이블에는
# 「본인 행만」 보게 하는 RLS가 걸려 있어서 로그인 없이는 빈 목록([])이 돌아온다.
# 아무것도 읽거나 쓰지 않는다. 서버 주소와 키는 앱 소스(src/lib/supabase.js)에서
# 그대로 읽는다 — 두 군데에 적어 두면 한쪽만 고쳐져서 조용히 틀어진다.
#
# ★ 실패는 시끄럽게 ★
#
# 2xx가 아니면 실패로 끝낸다. 그러면 GitHub가 실패 메일을 보내 준다 — 서버가
# 이미 정지됐거나 키가 막혔을 때 앱에서 로그인이 막히기 전에 알 수 있다.
# 일시적인 장애는 몇 번 다시 해 본다.
#
# 쓰기:   tools/keepalive.sh
# 시험용: SUPABASE_URL=http://127.0.0.1:9 SUPABASE_KEY=x RETRIES=1 RETRY_SLEEP=0 tools/keepalive.sh
#         KEEPALIVE_DRY=1 tools/keepalive.sh      # 요청 없이 읽어 온 설정만 확인
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src/lib/supabase.js"

URL="${SUPABASE_URL:-$(grep -o "https://[a-z0-9]*\.supabase\.co" "$SRC" 2>/dev/null | head -1)}"
KEY="${SUPABASE_KEY:-$(grep -o "sb_publishable_[A-Za-z0-9_-]*" "$SRC" 2>/dev/null | head -1)}"
RETRIES="${RETRIES:-3}"
RETRY_SLEEP="${RETRY_SLEEP:-20}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "서버 주소나 키를 못 읽었어요 ($SRC)" >&2
  exit 2
fi

# 키는 공개용이지만 로그에 남기지 않는다 — 있다는 것만 적는다.
echo "서버: $URL  · 키: 있음 · 최대 ${RETRIES}번 시도"

if [ "${KEEPALIVE_DRY:-0}" = "1" ]; then
  echo "(요청은 보내지 않았어요)"
  exit 0
fi

ENDPOINT="$URL/rest/v1/user_data?select=user_id&limit=1"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for i in $(seq 1 "$RETRIES"); do
  code="$(curl -sS -m 30 -o "$TMP" -w '%{http_code}' -H "apikey: $KEY" "$ENDPOINT" 2>"$TMP.err")" || code="000"
  rm -f "$TMP.err"
  case "$code" in
    2??)
      echo "✓ 서버가 깨어 있어요 (HTTP $code, $i번째 시도)"
      exit 0
      ;;
    000) echo "✗ $i/$RETRIES  서버에 닿지 못했어요 (프로젝트가 정지됐거나 장애일 수 있어요)" ;;
    401|403) echo "✗ $i/$RETRIES  서버가 키를 거절했어요 (HTTP $code) — 키가 바뀌었거나 꺼졌을 수 있어요" ;;
    *) echo "✗ $i/$RETRIES  HTTP $code" ;;
  esac
  [ "$i" -lt "$RETRIES" ] && sleep "$RETRY_SLEEP"
done

echo "서버를 깨우지 못했어요. Supabase 대시보드에서 프로젝트 상태를 확인해 주세요." >&2
exit 1
