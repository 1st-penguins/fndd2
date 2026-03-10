# 퍼스트펭귄 (fndd2) 프로젝트 가이드

## 새 세션 시작 시 읽기 순서

1. `WORKSTATE.md` — 현재 상태 파악 (필수)
2. `plan.md` 해당 Phase — 무엇을 해야 하는지
3. `research.md` 관련 섹션 — 함수/파일 위치
4. 실제 파일 Read — 코드 확인 후 작업

---

## 배포 체크리스트

### ⚠️ 배포 시 반드시 확인

**0. JS 구문 검사 먼저 실행**

```bash
bash scripts/check-syntax.sh
```

이 검사가 통과해야만 다음 단계 진행. 실패하면 배포 중단.

**JS/CSS 변경이 있는 배포 시 `sw.js` CACHE_VERSION 올리기**

```js
// sw.js 맨 위
const CACHE_VERSION = '2026030903'; // ← 배포마다 숫자 올리기 (예: ...03 → ...04)
```

이 값을 올리지 않으면:
- 일반 사용자의 서비스 워커가 구버전 JS/CSS를 계속 캐시해서 서빙
- 새로고침해도 구버전 코드 실행 (auth-core.js 등)
- 사용자가 수동으로 캐시 삭제해야만 최신 버전 확인 가능

값을 올리면:
- 새 서비스 워커 설치 → 구버전 캐시 전부 자동 삭제 → 사용자 새로고침 한 번으로 최신 반영

---

## 프로젝트 개요

- **사이트**: the1stpeng.com (건강운동관리사 / 2급 생활스포츠지도사 자격증 시험 대비)
- **브랜드**: 퍼스트펭귄, 슬로건: "Fear Not, Deep Dive"
- **배포**: Cloudflare Pages (GitHub 연동 자동 배포)
- **백엔드**: Firebase (Auth + Firestore)
- **프론트**: Vanilla JS (ES Modules), CSS 커스텀, PWA(SW)

## 핵심 색상

- `--penguin-navy`: #1D2F4E (메인 남색)
- `--penguin-skyblue`: #5FB2C9 (하늘색)
- 스포츠지도사: #059669 (초록)

## 관리자 계정

- kspo0324@gmail.com
- mingdy7283@gmail.com
- sungsoo702@gmail.com

## 관리자 전용 요소 처리 원칙

**CSS만으로 숨기면 안 됨** — specificity 충돌로 뚫릴 수 있음.

올바른 방법:
1. HTML에 `style="display:none"` 직접 추가 (인라인 > CSS)
2. JS에서 `isAdmin(user)` 확인 후 어드민이면 `el.style.display = ''` (인라인 제거 → CSS 원래값 복원)
3. 비어드민이면 `el.style.display = 'none'` 유지

## 주요 파일 구조

### HTML
- `index.html` — 메인 홈
- `login.html` — 로그인 페이지

### CSS (index.html 사용)
- `css/base.css` — 전역 변수, `.admin-only { display: none }`
- `css/tabs.css` — 탭 스타일 (`.sub-tab-button:not(.admin-only)` 사용)
- `css/mobile-ux-improvements.css` — 모바일 UX

### JS 핵심
- `js/app.js` — 앱 초기화, 탭 제어
- `js/auth/auth-core.js` — Firebase 인증 (onAuthStateChanged)
- `js/auth/auth-ui.js` — 로그인 모달 UI
- `js/auth/auth-utils.js` — isAdmin, setLoggedIn 등 유틸
- `js/analytics/analytics-dashboard.js` — 학습 분석 대시보드
- `sw.js` — 서비스 워커 (캐시 관리)

### 캐시 설정
- `_headers` — Cloudflare Pages 헤더 (HTML: no-cache, **sw.js: no-store**, JS/CSS: no-cache, images: 30일)
- `netlify.toml` — 레거시 파일 (Cloudflare Pages에서 무시됨, 삭제 가능)
- `/sw.js`에는 반드시 `no-store` 설정 — 없으면 Netlify CDN이 sw.js 자체를 캐시해서 CACHE_VERSION 변경이 사용자에게 반영 안 됨

### 모의고사 관련 파일 주의

- `js/mockexam.js` — **고아 파일** (어떤 HTML에서도 로드 안 함). 수정 불필요.
- `js/quiz/mock-exam.js` — **실제 사용되는 IIFE** (모의고사 HTML들이 로드). 모의고사 수정은 여기.
- `js/exam/mock-exam-page.js` — ESM 모듈. 497줄에 window.submitQuiz 덮어쓰기 주의.

---

## 코드 품질 규칙 (반드시 지킬 것)

### 절대 금지 패턴

```javascript
// ❌ 주석을 값으로 대입 — SyntaxError 유발
const year = /* 년도 추출 */;

// ❌ 빈 try 블록 — ESM SyntaxError 유발
try {
}

// ❌ window.xxx 덮어쓰기 (의도 없이)
window.submitQuiz = myFunction;  // 기존 submitQuiz를 파괴할 수 있음
```

### 올바른 패턴

```javascript
// ✅ 미완성 시 실제 기본값 + 주석
const year = '2025'; // TODO: URL에서 추출 필요

// ✅ try는 반드시 catch 또는 finally
try {
  doSomething();
} catch (e) {
  console.error('설명:', e);
}

// ✅ 전역 덮어쓰기 시 주석 필수
// mock-exam-page.js가 IIFE의 submitQuiz를 대체함 (의도적)
window.submitQuiz = submitMockExam;
```

### 새 함수 작성 전 중복 확인

```bash
# 동일 기능 함수 검색 먼저
grep -r "functionName" js/
```

### 단계 완료 시 업데이트 필수

- plan.md 해당 Todo에 [v] 체크
- WORKSTATE.md 업데이트 (다음 작업 명시)
- research.md에 새 발견 사항 추가
