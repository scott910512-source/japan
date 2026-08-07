# 이전 버전 — 처음 가는 일본 (여행 RPG)

바닐라 JS로 만든 이전 앱의 소스다. 지금 배포되는 앱은 아니다.

빌드에 포함되지 않는다 — Vite는 루트 `index.html`과 `src/`만 번들한다.
여기 파일들은 **JS일본어의 "실전연습(여행연습)" 메뉴를 React로 이관할 때
참조하려고** 남겨 둔 것이다 (PLAN.md의 Phase 2).

| 파일 | 내용 |
|---|---|
| `app.js` | 화면 전환, 설정, Google Cloud TTS·STT, 장면 진행 |
| `npc-engine.js` | NPC 대사 생성과 대화 판정 |
| `data.js` | 장면·대사·단어 데이터 |
| `style.css` | 이전 앱 스타일 |
| `manifest.json`, `sw.js` | 이전 앱의 PWA 설정 (현재 PWA는 vite-plugin-pwa가 생성) |

Google Cloud TTS 키는 이 앱이 `localStorage`의 `jtrip_settings.gttsKey`에
저장했고, 새 앱이 그 값을 그대로 승계해서 쓴다 (`src/lib/storage.js`).
