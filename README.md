# JS일본어

한국인 학습자를 위한 일본어 회독 학습 PWA입니다. 오늘의 분량을 정하고, 단어·문장을 반복하며, 듣기와 말하기를 연습합니다.

- **오늘**: 일일 계획, 남은 분량, 학습 이어하기
- **학습**: 단어, 기초, 문법, 상황별 문장, 퀴즈와 회독
- **듣기**: 자동 듣기, 따라 말하기, 영상 학습
- **기록**: 학습 활동과 복습 현황
- **더보기**: 학습·음성 설정, 계정 동기화, 백업, 도구

## 개발과 검사

Node.js 22 이상이 필요합니다. React 18, Vite, vite-plugin-pwa, Supabase를 사용합니다.

```sh
npm ci
npm run dev
npm run test:logic
npm run build
npx playwright@1.62.1 install --with-deps chromium
npm run test:ui
```

개발·미리보기 기본 경로는 `/japan/`입니다. `npm run preview`는 `dist/`의 빌드 결과를 제공합니다. `npm test`는 로직과 브라우저 검사를 함께 실행합니다. 별도 Chromium은 `CHROMIUM=/path/to/chrome`으로 지정합니다.

## 코드 구조

| 경로 | 역할 |
|---|---|
| `src/App.jsx` | 학습 흐름, 화면 연결, 일일 계획과 판정 처리 |
| `src/app/useAppData.js` | 기기 저장 상태와 저장 효과 |
| `src/app/useAccountSync.js` | 인증, 계정 동기화, 음성 키 보관 |
| `src/app/useLayerNavigation.js` | 상세·회독 화면의 뒤로 가기 |
| `src/app/screens.js`, `FeatureScreen.jsx` | 화면 지연 로딩과 기능별 연결 |
| `src/components/ScreenSlot.jsx` | 첫 방문 로딩, 방문한 탭 유지, 오류 안내 |
| `src/screens/`, `src/components/` | 기능 화면과 공통 UI |
| `src/lib/`, `src/data/` | 학습 규칙·저장·병합·외부 서비스와 콘텐츠 |
| `src/styles/` | 테마 토큰, 공통·기능별 스타일 |
| `test/logic/`, `test/ui/` | 로직과 빌드 결과의 브라우저 검사 |

`src/index.css`의 import 순서는 기존 스타일 우선순위를 보존하므로 유지하세요. 학습 규칙은 `docs/PLAN.md`의 §0-A, 이번 구조 검토는 `docs/REFACTOR_2026-09-12.md`에 기록했습니다.

## 계정·오프라인·배포

현재 앱은 로그인을 요구하며, 이전에 로그인한 기기는 연결이 끊겼을 때 기기에 저장된 학습을 이어갈 수 있습니다. 온라인에서 서비스 워커의 캐시 설치를 마쳐야 합니다. 화면을 나눠 불러와도 오프라인 진입을 위해 모든 앱 JS/CSS를 사전 캐시합니다. 서버 동기화와 외부 음성·번역·영상 서비스에는 연결이 필요합니다.

GitHub Pages 배포는 `.github/workflows/pages.yml`에서 빌드·검사를 거쳐 수행합니다. 소스 브랜치를 Pages에 직접 지정하는 방식이 아닙니다. 배포 경로는 `vite.config.js`의 `base` 또는 `VITE_BASE`로 설정합니다.
