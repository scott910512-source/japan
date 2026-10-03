#!/usr/bin/env bash
# 배포된 것이 실제로 다 올라갔나.
#
# ★ 로컬 검사가 못 보는 자리 ★
#
# 로컬 검사는 방금 구운 dist를 본다 — 「코드가 맞나」다. 「올라간 것이
# 맞나」는 다른 질문이고, 둘이 갈라지는 자리가 있다.
#
#   · Pages가 경로를 다르게 준다 (대소문자, base, 404)
#   · 배포 올리기에서 파일 하나가 빠진다
#   · 서비스워커 캐시 목록(sw.js)에 적힌 파일이 실제로는 없다 —
#     이게 제일 고약하다. 설치는 되는데 그 한 줄 때문에 캐시가 통째로
#     실패하고, 오프라인이 조용히 안 된다.
#
# 브라우저를 안 쓴다. 이 세션의 바깥 길은 프록시를 지나고, 그 CA를 브라우저
# 신뢰 저장소가 안 읽어서 인증서가 거부된다 — 거기서 TLS 검증을 끄는 것은
# 하지 않는다(그러면 이 검사가 「연결이 멀쩡한가」를 더는 못 본다).
# curl은 CA를 읽으니, 받아서 목록을 맞춰 보는 일은 그대로 할 수 있다.
#
# 쓰기: tools/live-check.sh https://scott910512-source.github.io/japan/
set -uo pipefail

BASE="${1:?배포 주소를 주세요}"
BASE="${BASE%/}/"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ✓ %s%s\n' "$1" "${2:+ — $2}"; }
bad() { fail=$((fail+1)); printf '  ✗ %s%s\n' "$1" "${2:+ — $2}"; }

code() { curl -s -o "$2" -w '%{http_code}' --max-time 30 "$1"; }

printf '\n═══ %s ═══\n' "$BASE"

# ── 1. 첫 화면 ──
c=$(code "$BASE" "$TMP/index.html")
[ "$c" = "200" ] && ok "첫 화면이 온다" "$c" || bad "첫 화면이 온다" "$c"
bytes=$(wc -c < "$TMP/index.html")
[ "$bytes" -gt 300 ] && ok "빈 파일이 아니다" "${bytes}B" || bad "빈 파일이 아니다" "${bytes}B"

# ── 2. 첫 화면이 가리키는 것들이 다 있나 ──
# src= / href= 에서 상대·절대 경로를 모은다. 바깥 주소는 뺀다.
grep -oE '(src|href)="[^"]+"' "$TMP/index.html" \
  | sed -E 's/^(src|href)="//; s/"$//' \
  | grep -vE '^(https?:|data:|mailto:|#)' \
  | sort -u > "$TMP/refs.txt"

refs=$(wc -l < "$TMP/refs.txt")
miss=0; missed=""
while read -r p; do
  [ -z "$p" ] && continue
  # 절대 경로면 호스트에 붙이고, 아니면 base 뒤에 붙인다
  case "$p" in
    /*) url="$(printf '%s' "$BASE" | sed -E 's|(https?://[^/]+).*|\1|')$p" ;;
    *)  url="$BASE$p" ;;
  esac
  cc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url")
  if [ "$cc" != "200" ]; then miss=$((miss+1)); missed="$missed $cc:$p"; fi
done < "$TMP/refs.txt"
[ "$miss" = "0" ] && ok "첫 화면이 가리키는 파일이 다 있다" "${refs}개" \
                  || bad "첫 화면이 가리키는 파일이 다 있다" "${refs}개 중 ${miss}개 없음:$missed"

# ── 3. 서비스워커와 캐시 목록 ──
c=$(code "${BASE}sw.js" "$TMP/sw.js")
if [ "$c" = "200" ]; then
  ok "서비스워커가 온다" "$(wc -c < "$TMP/sw.js")B"
  # workbox 사전 캐시 목록.
  #
  # ★ 축약된 모양도 읽어야 한다 ★
  # 빌드가 minify하면 키의 따옴표가 사라져서 {url:"...",revision:...} 가 된다.
  # 처음엔 따옴표 있는 모양만 찾다가 「목록이 비어 있다」는 거짓 통과를 받았다 —
  # 빌드 로그에는 44개가 있는데 0개로 읽혔다. 검사가 조용히 아무것도 안 보는
  # 쪽이, 못 본다고 말하는 쪽보다 나쁘다.
  grep -oE '"?url"?:"[^"]+"' "$TMP/sw.js" | sed -E 's/^"?url"?:"//; s/"$//' | sort -u > "$TMP/pre.txt"
  n=$(wc -l < "$TMP/pre.txt")
  if [ "$n" -gt 0 ]; then
    pm=0; pmiss=""
    while read -r p; do
      [ -z "$p" ] && continue
      case "$p" in
        /*) url="$(printf '%s' "$BASE" | sed -E 's|(https?://[^/]+).*|\1|')$p" ;;
        *)  url="$BASE$p" ;;
      esac
      cc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url")
      if [ "$cc" != "200" ]; then pm=$((pm+1)); pmiss="$pmiss $cc:$p"; fi
    done < "$TMP/pre.txt"
    # ★ 여기가 핵심이다 ★ 한 줄이라도 없으면 캐시가 통째로 실패하고,
    # 설치는 된 것처럼 보이는데 오프라인이 조용히 안 된다.
    [ "$pm" = "0" ] && ok "★ 캐시 목록의 파일이 다 있다 ★" "${n}개" \
                    || bad "★ 캐시 목록의 파일이 다 있다 ★" "${n}개 중 ${pm}개 없음:$pmiss"
  else
    # 사전 캐시를 안 쓰는 앱일 수도 있지만, 읽는 쪽이 틀렸을 수도 있다.
    # 어느 쪽인지 모르면 통과로 세지 않는다.
    bad "캐시 목록을 읽었다" "0개 — 사전 캐시가 없는 앱이거나, 이 검사가 목록 모양을 못 읽는다"
  fi
else
  ok "서비스워커가 없다 — PWA가 아닌 앱" "$c"
fi

# ── 4. 설치 설명서 ──
mani=$(grep -oE 'href="[^"]*manifest[^"]*"' "$TMP/index.html" | head -1 | sed -E 's/href="//; s/"$//')
if [ -n "$mani" ]; then
  case "$mani" in /*) murl="$(printf '%s' "$BASE" | sed -E 's|(https?://[^/]+).*|\1|')$mani" ;; *) murl="$BASE$mani" ;; esac
  c=$(code "$murl" "$TMP/m.json")
  if [ "$c" = "200" ]; then
    ok "설치 설명서가 온다" "$(grep -oE '"name":"[^"]*"' "$TMP/m.json" | head -1)"
    # 설명서가 가리키는 아이콘도 확인한다 — 없으면 홈 화면에 빈 칸이 뜬다
    im=0
    for ic in $(grep -oE '"src":"[^"]+"' "$TMP/m.json" | sed -E 's/"src":"//; s/"$//'); do
      case "$ic" in /*) iurl="$(printf '%s' "$BASE" | sed -E 's|(https?://[^/]+).*|\1|')$ic" ;; *) iurl="$BASE$ic" ;; esac
      cc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$iurl")
      [ "$cc" != "200" ] && im=$((im+1))
    done
    [ "$im" = "0" ] && ok "홈 화면 아이콘이 다 있다" || bad "홈 화면 아이콘이 다 있다" "${im}개 없음"
  else
    bad "설치 설명서가 온다" "$c"
  fi
fi

# ── 5. 없는 주소를 넣으면 ──
# Pages는 404.html이 없으면 제 404를 준다. SPA에 404.html이 있으면 200이다.
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${BASE}__없는주소__")
ok "없는 주소의 응답" "$c"

printf '\n통과 %d / 문제 %d\n' "$pass" "$fail"
exit 0   # 라이브는 우리가 못 고치는 이유로도 흔들린다 — 적어 두는 것이 목적이다
