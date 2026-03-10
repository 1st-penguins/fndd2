# 퍼스트펭귄 (fndd2) 코드베이스 리서치 문서

> 작성일: 2026-03-10
> 목적: 기능 구현 전 현재 코드 구조 및 흐름 파악

---

## 1. 프로젝트 개요

- **사이트**: the1stpeng.com
- **용도**: 건강운동관리사 / 2급 생활스포츠지도사 자격증 시험 대비 문제풀이
- **스택**: Vanilla JS (ES Modules), Firebase Auth + Firestore, Cloudflare Pages, PWA
- **빌드 없음**: `npm build` 없이 브라우저에서 직접 ES Module로 실행

---

## 2. 핵심 데이터 흐름 (Data Flow)

### 2-1. 인증 흐름

```
[페이지 진입]
    ↓
[firebase-core.js: ensureFirebase()]
  └─ Firebase SDK lazy import
  └─ browserLocalPersistence 설정
  └─ window.auth, window.db 생성
    ↓
[auth-core.js: initAuth()]
  └─ onAuthStateChanged 등록
  └─ 리다이렉트 결과 처리 (Google redirect fallback)
  └─ localStorage.userLoggedIn 동기화
    ↓
[인증 상태 우선순위]:
  1. window.auth.currentUser (Firebase 실체)
  2. localStorage.userLoggedIn (빠른 초기화용 fallback)
  3. window.__authStateResolved (초기화 완료 플래그)
    ↓
[auth-ui.js: updateLoginUI()]
  └─ 로그인 모달, 유저 프로필, 접근제한 콘텐츠 동기화
```

**핵심 제약**:
- `auth.currentUser`는 페이지 로드 직후 `null`일 수 있음 → 반드시 `ensureAuthReady()` 이후에 사용
- localStorage와 Firebase 두 가지 상태 소스가 존재 → 불일치 가능성 있음

---

### 2-2. 퀴즈 실행 흐름

```
[exam/2025_건강체력평가.html 진입]
    ↓
[data/2025_건강체력평가.json 로드] → 20문제 배열
    ↓
[quiz-core.js 초기화]
  ├─ currentQuestionIndex = 0
  ├─ userAnswers[] = []
  ├─ perQuestionChecked[] = []  ← 중복 기록 방지 핵심 플래그
  ├─ 타이머 20분 시작
  └─ ensureRegularSessionForPage() → SessionManager 세션 생성
    ↓
[사용자 답 선택 → "정답 확인" 클릭]
    ↓
[정답 비교 & 상태 업데이트]
  ├─ userAnswers[index] = 선택값 (0~3)
  ├─ perQuestionChecked[index] = true
  └─ localStorage에 quiz_progress_* 저장 (즉각 로컬 저장)
    ↓
[Firestore 기록 (로그인 상태일 때)]
  └─ quiz-repository.js: recordAttempt()
      └─ attempts/{userId}/attempts/{uuid} 에 저장
    ↓
[퀴즈 완료]
  └─ sessionManager.completeSession(results)
  └─ 점수 표시 (정답수 × 5점)
```

**핵심 제약**:
- `perQuestionChecked[]` 플래그 없으면 "정답 확인" 2회 클릭 시 중복 기록 발생
- Firestore 기록은 async fire-and-forget → 실패해도 UI는 정상 동작하나 데이터 유실 가능

---

### 2-3. 세션 관리 흐름

```
SessionManager (싱글톤, window.sessionManager)
  ├─ initialize()         → 이전 세션 Firestore에서 복원
  ├─ startNewSession()    → 신규 세션 생성 (sessions/{userId}/sessions/{uuid})
  ├─ resumeSession(id)    → 중단된 세션 이어하기
  ├─ recordAttempt()      → 현재 세션에 문제 기록 추가
  └─ completeSession()    → 세션 완료 처리 (status: completed)

세션 상태: active → paused → resumed → completed (or abandoned)
```

**핵심 제약**:
- SessionManager는 반드시 싱글톤으로 사용 (`window.sessionManager`)
- 자격증 유형 전환 시 localStorage의 세션 ID 오염 가능 → `ensureRegularSessionForPage()` 호출 필수

---

### 2-4. 분석(Analytics) 파이프라인

```
[Firestore 수집]
  ├─ attempts/{userId}/attempts/    ← 개별 문제 시도
  ├─ sessions/{userId}/sessions/    ← 퀴즈 세션
  └─ mockExamResults/{userId}/      ← 모의고사 결과
    ↓
[analytics-dashboard.js 쿼리]
  ├─ getUserAttempts(userId)
  ├─ getUserMockExamResults(userId)
  └─ getUserProgress(userId)
    ↓
[JS에서 집계 (StatsCache 5분 캐시)]
  ├─ groupBySubject(attempts)
  ├─ calculateWeaknesses(attempts)
  └─ filterByCertificateType(attempts)
    ↓
[대시보드 렌더링]
  └─ 점수카드, 과목별 정확도, 취약 과목, 진행 타임라인
```

**핵심 제약**:
- 모든 attempts를 메모리로 로드 후 JS로 필터링 → 데이터 많을수록 느림
- 퀴즈 완료 후 5분 캐시 때문에 분석 대시보드가 즉시 갱신되지 않음
- 구버전 attempts에 `certificateType` 필드 없음 → `'health-manager'`로 기본 처리됨

---

## 3. 주요 함수 및 클래스 역할

### js/auth/

| 파일 | 주요 함수 | 역할 |
|------|-----------|------|
| `auth-core.js` | `initAuth()` | onAuthStateChanged 등록, 리다이렉트 처리 |
| `auth-core.js` | `handleGoogleLogin()` | Google 팝업 → 실패 시 리다이렉트 fallback |
| `auth-core.js` | `handleEmailLogin()` | 이메일 로그인 |
| `auth-core.js` | `handleLogout()` | 로그아웃 + 페이지 리로드 |
| `auth-ui.js` | `showLoginModal()` | 로그인 모달 표시 |
| `auth-ui.js` | `updateLoginUI()` | 헤더/버튼 상태 동기화 |
| `auth-utils.js` | `isAdmin(user)` | 관리자 여부 (이메일 하드코딩 비교) |
| `auth-utils.js` | `isUserLoggedIn()` | Firebase + localStorage 복합 확인 |
| `access-guard.js` | `guardTabAccess(tabId)` | 탭 접근 시 로그인 강제 |
| `access-guard.js` | `syncLoginOverlays(root)` | 로그인 시 오버레이 제거 |

### js/quiz/

| 파일 | 주요 함수 | 역할 |
|------|-----------|------|
| `quiz-core.js` | `loadQuestions(jsonUrl)` | JSON 데이터 fetch |
| `quiz-core.js` | `displayQuestion(index)` | 현재 문제 렌더링 |
| `quiz-core.js` | `submitAnswer(userAnswer)` | 답 제출 및 정답 비교 |
| `quiz-core.js` | `saveQuizProgress()` | localStorage 저장 |
| `quiz-core.js` | `completeQuiz()` | 퀴즈 완료 처리 |
| `quiz-core.js` | `ensureRegularSessionForPage()` | 세션 생성/복원 |

### js/data/

| 파일 | 주요 함수 | 역할 |
|------|-----------|------|
| `quiz-repository.js` | `recordAttempt()` | Firestore에 문제 시도 기록 |
| `quiz-repository.js` | `batchRecordAttempts()` | 일괄 기록 |
| `quiz-repository.js` | `getUserAttempts(userId)` | 사용자 시도 전체 조회 |
| `session-manager.js` | `SessionManager` class | 세션 생명주기 관리 (싱글톤) |
| `notice-repository.js` | `getNotices(limit)` | 공지사항 페이지네이션 조회 |

### js/utils/

| 파일 | 주요 함수 | 역할 |
|------|-----------|------|
| `certificate-utils.js` | `getCurrentCertificateType()` | 현재 자격증 유형 감지 (URL > localStorage > 기본값) |
| `certificate-utils.js` | `setCertificateType(type)` | 자격증 유형 설정 + 저장 |
| `certificate-utils.js` | `filterAttemptsByCertificate()` | 분석용 attempts 필터링 |
| `stats-cache.js` | `StatsCache` | 5분 분석 캐시 |
| `url-decoder.js` | `safeDecodeText()` | URL 인코딩된 과목명 재귀 디코딩 |

---

## 4. Firestore 데이터 구조

```
attempts/{userId}/attempts/{attemptId}
  ├─ userId, sessionId
  ├─ questionData: {id, year, subject, certificateType, isFromMockExam}
  ├─ userAnswer: number (0~3)
  ├─ isCorrect: boolean
  ├─ timestamp, deviceType
  └─ excludedFromAnalytics: boolean (오염 데이터 제외용)

sessions/{userId}/sessions/{sessionId}
  ├─ type: 'regular' | 'mockexam'
  ├─ year, subject, hour
  ├─ status: 'active' | 'paused' | 'completed' | 'abandoned'
  ├─ totalQuestions, correct, accuracy, score
  └─ results: {totalQuestions, correct, incorrect, accuracy, score}

mockExamResults/{userId}/results/{resultId}
  ├─ year, part (1 or 2), subject
  ├─ score, totalScore
  └─ details: [{questionId, userAnswer, isCorrect, subject}]

notices/{noticeId}
  ├─ title, content (HTML), badge, pinned
  ├─ views, certificateType
  └─ comments: [{author, content, timestamp, likes}]

dailyVisitors/{date}_{userId}
  └─ userId, date, timestamp, deviceInfo
```

---

## 5. 자격증 유형 이중 구조

| 항목 | 건강운동관리사 | 2급 생활스포츠지도사 |
|------|--------------|-------------------|
| 식별값 | `'health-manager'` | `'sports-instructor'` |
| 데이터 폴더 | `data/` | `data/sports/` |
| 시험 페이지 | `exam/` | `exam-sports/` |
| 과목 수 | 8개 | 10개 |
| 연도 | 2019~2025 | 2021~2025 |
| 색상 | Navy #1D2F4E | Green #059669 |

**자격증 유형 감지 우선순위** (`certificate-utils.js`):
1. URL parameter: `?cert=sports-instructor`
2. URL 경로: `/exam-sports/`, `/subjects-sports/` 등
3. localStorage: `selectedCertificate`
4. 기본값: `'health-manager'`

---

## 6. 서비스 워커 & 캐시 전략

```
sw.js 캐시 전략:
  - HTML: network-first, cache fallback
  - JS/CSS: network-first, cache fallback
  - Images: Cloudflare _headers에서 30일 캐시
  - sw.js 자체: no-store (캐시 금지)

_headers:
  / → Cache-Control: no-cache, must-revalidate
  /sw.js → Cache-Control: no-store, no-cache, must-revalidate
  /images/* → Cache-Control: public, max-age=2592000
```

**CACHE_VERSION 관리**:
- `sw.js` 맨 위 `const CACHE_VERSION = '2026031001'`
- JS/CSS 변경 시 반드시 올려야 함 → 올리지 않으면 사용자에게 구버전 코드 서빙

---

## 7. 관리자 시스템

**관리자 감지** (`firebase-core.js`):
```javascript
export const ADMIN_EMAILS = [
  'kspo0324@gmail.com',
  'mingdy7283@gmail.com',
  'sungsoo702@gmail.com'
];

function isAdmin(user) {
  if (isDevMode()) return true;  // 개발모드 = 항상 관리자
  return ADMIN_EMAILS.includes(user?.email);
}
```

**관리자 전용 UI 처리 원칙**:
- CSS만으로 숨기면 안 됨 (specificity 충돌로 뚫릴 수 있음)
- HTML에 `style="display:none"` 인라인 추가 후, JS에서 어드민 확인 후 `el.style.display = ''`로 복원

---

## 8. 구현 시 주요 제약 및 주의점

### 8-1. 인증 관련

- **`auth.currentUser`는 페이지 로드 직후 null** → 항상 `ensureAuthReady()` 또는 `onAuthStateChanged` 콜백 이후 사용
- **두 가지 상태 소스** (Firebase + localStorage) → `isUserLoggedIn()`은 두 가지 모두 확인하는 유일 진입점
- **Dev 모드**: `localhost + ?dev=1` 또는 `localStorage.devKey='4578'` 시 Firebase 우회, mock 유저 사용

### 8-2. 퀴즈/세션 관련

- **중복 기록 방지**: `perQuestionChecked[index]` 플래그 체크 필수, `recordAttempt()`는 "정답 확인" 클릭 1회에만 호출
- **세션 ID 오염**: cert 유형 전환 시 localStorage 세션 ID 재검증 필요
- **Resume 기능**: `isResume: true` + `resumeSessionId` 파라미터로 중단 세션 이어하기 가능

### 8-3. 분석 관련

- **구버전 데이터 처리**: `certificateType` 없는 attempts → `'health-manager'`로 기본 처리
- **URL 인코딩 과목명**: `safeDecodeText()`로 반드시 디코딩 후 비교
- **캐시 5분**: 퀴즈 완료 후 분석 즉시 반영 안 됨

### 8-4. 배포 관련

- **JS/CSS 변경 시 `sw.js` CACHE_VERSION 반드시 증가**
- **`sw.js`에는 no-store 헤더 필수** (없으면 CDN이 sw.js 캐시)
- **`netlify.toml`**: 레거시 파일, Cloudflare Pages에서 무시됨

### 8-5. 전역 변수 (레거시 호환 유지)

```javascript
window.auth              // Firebase auth 인스턴스
window.db                // Firestore 인스턴스
window.sessionManager    // 세션 매니저 싱글톤
window.Logger            // 로깅 시스템
window.showLoginModal()  // 레거시 함수
window.isUserLoggedIn()
window.ADMIN_EMAILS
```

---

## 9. 접근 제어 구조

| 페이지 유형 | 접근 조건 | 처리 방식 |
|------------|----------|----------|
| `/subjects/*.html` | 로그인 필요 | `access-guard.js` 리다이렉트 |
| `/years/*.html` | 로그인 필요 | `access-guard.js` 리다이렉트 |
| `/exam/*.html` | 공개 (기록은 로그인 필요) | Firestore 기록만 로그인 체크 |
| `/analytics.html` | 로그인 필요 | 빈 화면 → 로그인 유도 |
| `/admin/*.html` | 관리자만 | `isAdmin()` 체크 |
| `/index.html` 공지탭 | 항상 공개 | 제한 없음 |

---

## 10. 성능 최적화 현황

| 기법 | 적용 위치 | 효과 |
|------|----------|------|
| Firebase lazy import | `firebase-core.js: ensureFirebase()` | 초기 로드 최소화 |
| 분석 캐시 5분 | `stats-cache.js: StatsCache` | Firestore 쿼리 절감 |
| 이미지 30일 캐시 | `_headers` Cloudflare | CDN에서 서빙 |
| 공지 페이지네이션 | 8개씩 로드 | 홈 초기 렌더 빠름 |
| 분석 대시보드 lazy | 탭 클릭 시 로드 | 불필요한 사전 로드 방지 |

---

## 11. 발견된 잠재 버그 — 신규 (2026-03-10 추가)

### 11-1. analytics-dashboard.js — 빈 try 블록 (SyntaxError)

**위치**: `js/analytics/analytics-dashboard.js` ~5562번째 줄 (createProSessionCard 함수 내부)

**증상**:
```
app.js:509 대시보드 로드 실패: SyntaxError: Missing catch or finally after try
```

**원인**: `let decodedTitle` 선언 직후 빈 `try {}` 블록이 남아 있었음.
CommonJS 파서는 통과하지만 브라우저 ES Module 파서는 SyntaxError 발생.
→ analytics 탭 전체(학습분석 탭)가 로드 불가.

**수정**: 빈 try 블록 제거 (2026-03-10 완료)

---

### 11-2. mockexam.js — 미완성 코드 플레이스홀더 (SyntaxError)

**위치**: `js/mockexam.js` 110~111번째 줄 (`submitMockExam` 함수 내)

**증상**: 모의고사 제출 시 JS parse 에러 → 결과 저장 불가

**원인**:
```javascript
// 완성되지 않은 플레이스홀더 코드
const year = /* 년도 추출 */;
const hour = /* 교시 추출 */;
```
실제 값 없이 주석만 할당해 SyntaxError.

**중복 함수 문제**: `submitMockExam()`과 `saveMockExamResults()`가 동일 로직 중복 구현.
- `saveMockExamResults()`: URL 파싱, title 파싱, URLParams 파싱까지 완성된 버전
- `submitMockExam()`: 미완성 플레이스홀더 상태 (배포된 파일에서 SyntaxError 유발)

**수정**: URL + URLParams에서 year/hour 추출로 플레이스홀더 교체 (2026-03-10 완료)

---

### 11-3. 모의고사 결과 저장 이중화 문제

**위치**: `js/mockexam.js`

**현황**:
- `submitMockExam()` 내부: `batchRecordAttempts()` → `recordAttempt()` fallback
- `saveMockExamResults()`: 별도의 독립 함수로 동일 로직

**위험**: 어느 함수가 실제로 호출되는지 HTML마다 다를 수 있음.
모의고사 HTML 파일이 어떤 함수를 onsubmit에 바인딩하는지 확인 필요.

**추후 체크 필요**: 각 모의고사 HTML에서 `submitMockExam` vs `saveMockExamResults` 어느 것을 호출하는지 확인.

---

### 11-4. 루트 원인 요약 — "대시보드 로드 실패" 에러

```
원인 체인:
1. analytics-dashboard.js 5562줄 빈 try {} → ES Module SyntaxError
2. app.js에서 dynamic import('analytics-dashboard.js') 실패
3. "대시보드 로드 실패: SyntaxError" 콘솔 에러
4. 학습분석 탭 전체 화면 공백 (사용자에게는 빈 화면)
```

이 버그로 인해:
- 이전 세션의 기록보기(history) 불가
- 관리자 통계 탭 접근 불가
- 이어풀기 버튼 렌더링 불가

---

## 12. 심층 분석 — Firestore 구조 / 저장 방식 / 완료 여부 / 통계 페이지 (2026-03-10 추가)

### 12-1. Firestore 컬렉션 전체 목록 및 필드

#### 컬렉션: `attempts/{userId}/attempts/{attemptId}`

**기록 위치**: `js/data/quiz-repository.js`

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 사용자 UID |
| `sessionId` | string | 소속 세션 ID |
| `questionData.id` | string | 문제 고유 ID |
| `questionData.year` | string | 출제 연도 |
| `questionData.subject` | string | 과목명 |
| `questionData.certificateType` | string | `'health-manager'` \| `'sports-instructor'` |
| `questionData.isFromMockExam` | boolean | 모의고사 문제 여부 |
| `userAnswer` | number | 사용자 선택 (0~3) |
| `isCorrect` | boolean | 정답 여부 |
| `firstAttemptAnswer` | number | 첫 번째 시도 선택지 |
| `firstAttemptIsCorrect` | boolean | 첫 번째 시도 정답 여부 |
| `timestamp` | Timestamp | Firestore serverTimestamp |
| `deviceType` | string | 기기 유형 |
| `excludedFromAnalytics` | boolean | 오염 데이터 제외 플래그 |
| `timeSpent` | number | 문제 풀이 시간(초) — V3에서 추가 |
| `viewedExplanation` | boolean | 해설 조회 여부 — V3에서 추가 |
| `correctAnswer` | number | 정답 번호 — V3에서 추가 |

**참조**: `quiz-repository.js:178–212` (recordAttempt), `quiz-repository.js:380–436` (batchRecordAttempts)

---

#### 컬렉션: `sessions/{userId}/sessions/{sessionId}`

**기록 위치**: `js/data/session-manager.js`

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 사용자 UID |
| `userName` | string | 표시 이름 |
| `userEmail` | string | 이메일 |
| `startTime` | Timestamp | 세션 시작 (serverTimestamp) |
| `endTime` | Timestamp | 세션 종료 (serverTimestamp) |
| `isActive` | boolean | 진행 중 여부 (true = 미완료) |
| `type` | string | `'regular'` \| `'mockexam'` |
| `year` | string | 출제 연도 |
| `subject` | string | 과목명 (regular 전용) |
| `hour` | string | 교시 (`'1'` \| `'2'`, mockexam 전용) |
| `title` | string | 세션 제목 (표시용) |
| `certType` | string | `'sports'` \| `'health'` |
| `deviceInfo.userAgent` | string | 브라우저 UA |
| `deviceInfo.platform` | string | OS/플랫폼 |
| `stats` | object | 세션 종료 시 기록되는 최종 통계 |
| `attemptCount` | number | 총 시도 문제 수 |

**세션 ID 형식**: `YYYYMMDD_HHMMSS_userid(6자)` — `session-manager.js:178–188`

**완료 시 업데이트** (`session-manager.js:528–535`):
```javascript
updateDoc(sessionRef, {
  isActive: false,
  endTime: serverTimestamp(),
  stats: sessionStats
})
```

---

#### 컬렉션: `mockExamResults/{userId}/results/{resultId}`

**기록 위치**: `js/quiz/mock-exam.js`의 `saveMockExamResults()`

| 필드 | 타입 | 설명 |
|------|------|------|
| `year` | string | 출제 연도 |
| `part` | number | 교시 (1 또는 2) |
| `subject` | string | 과목명 |
| `score` | number | 해당 과목 점수 |
| `totalScore` | number | 전체 점수 합계 |
| `details` | array | 문제별 결과 배열 |
| `details[].questionId` | string | 문제 ID |
| `details[].userAnswer` | number | 사용자 답 |
| `details[].isCorrect` | boolean | 정답 여부 |
| `details[].subject` | string | 소속 과목 |

---

#### 컬렉션: `notices/{noticeId}`

**기록 위치**: `js/data/notice-repository.js`

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 제목 |
| `content` | string | HTML 본문 |
| `badge` | string | 배지 텍스트 (예: "중요") |
| `pinned` | boolean | 상단 고정 여부 |
| `views` | number | 조회수 |
| `certificateType` | string | 자격증 유형 필터 |
| `comments` | array | `[{author, content, timestamp, likes}]` |

---

#### 컬렉션: `purchases/{purchaseId}` (관리자 대시보드용)

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 구매자 UID |
| `productId` | string | 상품 ID |
| `purchasedAt` | Timestamp | 구매 시각 |
| `price` | number | 결제 금액 |

---

#### 컬렉션: `dailyVisitors/{date}_{userId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 방문자 UID |
| `date` | string | 날짜 (YYYY-MM-DD) |
| `timestamp` | Timestamp | 방문 시각 |
| `deviceInfo` | object | UA / 플랫폼 |

---

### 12-2. 퀴즈 저장 방식 — 즉시 저장 vs 일괄 저장

#### 일반문제 (quiz-core.js): **즉시 저장 (매 문제 확인 시)**

```
사용자가 "정답 확인" 클릭
  → submitAnswer()
    → quiz-data-recorder.js: recordQuizAttempt()
      → quiz-repository.js: recordAttempt()  ← Firestore에 즉시 write
        → attempts/{userId}/attempts/{uuid} 생성 or 업데이트
  → localStorage: saveQuizProgress()  ← 동시에 로컬도 저장
```

- **중복 방지**: `perQuestionChecked[index]` 플래그 — 이미 체크된 문제는 재기록 안 함 (`quiz-core.js:59`)
- **기존 시도 있으면 UPDATE**: 같은 `sessionId + questionNumber` 조합이면 덮어씀 (`quiz-repository.js:280–304`)

#### 모의고사 (mock-exam.js): **완료 시 일괄 저장**

```
사용자가 "제출" 클릭
  → submitQuiz()
    → showResults()  ← UI 즉시 표시
    → saveMockExamResults()  ← Firestore 일괄 write
      → batchRecordAttempts()  ← 80문제 writeBatch
      → recordMockExamResults()  ← mockExamResults 컬렉션
      → sessionManager.endSession()  ← 세션 종료
```

- **중간 저장**: `_saveExamProgressToLocal()` — localStorage에만 저장 (visibilitychange, beforeunload, 선택지 클릭 시)
- **Firestore 저장은 제출 완료 시 1회만**

**핵심 차이**:

| 구분 | 일반문제 | 모의고사 |
|------|---------|---------|
| Firestore 저장 타이밍 | 매 문제 확인 시 즉시 | 제출 완료 시 일괄 |
| 로컬 저장 키 | `quiz_progress_{year}_{subject}` | `mockexam_{year}_{hour}_answers` |
| 중간 저장 함수 | `saveQuizProgress()` | `_saveExamProgressToLocal()` |
| 배치 여부 | 단건 (recordAttempt) | writeBatch (batchRecordAttempts) |

---

### 12-3. 완료 여부 판정 필드 및 로직

#### 세션 레벨: `isActive` 필드

- `true`: 세션 진행 중 (미완료)
- `false`: `endSession()` 호출 후 → 완료
- **설정 위치**: `session-manager.js:257` (생성 시 true), `session-manager.js:531` (종료 시 false)

#### 분석 대시보드 레벨: 클라이언트 계산

`analytics-dashboard.js:1878–1896`:

```javascript
// 전체 문제 수 결정
const totalQuestions = sessionData.type === 'mockexam'
  ? 80
  : (sessionData.total || 20);

// 완료된 문제 수 (attempts 카운팅)
const completed = attemptsForSession.length;

// 이어풀기 가능 여부
const isWithin24h = (Date.now() - startTime.toMillis()) < 24 * 60 * 60 * 1000;
const canResume = completed > 0 && completed < totalQuestions && isWithin24h;

// 완료 여부
const isDone = completed >= totalQuestions;
```

#### 관련 필드 정리

| 필드 | 위치 | 역할 |
|------|------|------|
| `isActive` | Firestore sessions | true = 미완료 (세션 수준) |
| `completed` | 클라이언트 계산 | 풀린 문제 수 |
| `total` | 클라이언트 계산 | 전체 문제 수 (20 or 80) |
| `canResume` | 클라이언트 계산 | 이어풀기 버튼 표시 조건 |
| `isDone` | 클라이언트 계산 | 다시풀기 버튼 표시 조건 |
| `endTime` | Firestore sessions | 세션 종료 시각 |
| `stats` | Firestore sessions | 종료 시 최종 통계 스냅샷 |

---

### 12-4. 다시풀기 / 이어풀기 / 세션 재연결 처리 로직

#### 이어풀기(Resume) 버튼

**표시 조건** (`analytics-dashboard.js:3387–3391`):
```javascript
if (session.canResume) → "이어풀기 →" 버튼 렌더링
```

**핸들러** (`analytics-dashboard.js:6054–6116`):
```javascript
function resumeSession(sessionId) {
  // 1. 세션 카드 데이터에서 URL 구성
  //    - 모의고사: exam/YYYY_모의고사_H교시.html?year=Y&hour=H&question=N&resume=true
  //    - 일반:    exam/YYYY_과목.html?question=N&resume=true&sessionId=ID
  // 2. localStorage.setItem('resumeSessionId', sessionId)
  // 3. window.location.href = url
}
```

#### 다시풀기(Retry) 버튼

**표시 조건** (`analytics-dashboard.js:3392`):
```javascript
if (session.completed >= session.total) → "다시 풀기" 버튼 렌더링
```

**핸들러** (`analytics-dashboard.js:6122–6157`):
```javascript
function retrySession(sessionId) {
  localStorage.removeItem('resumeSessionId');
  // question 파라미터 없이 처음부터 이동
}
```

#### 세션 재연결 조건 (findRecentSession)

**파일**: `js/data/session-manager.js:429–493`

```javascript
async findRecentSession(hoursLimit = 12) {
  // isActive === true인 세션만
  // startTime >= (현재 - hoursLimit시간) 조건
  // 기본: 12시간 이내
}
```

⚠️ **주의**: Firestore `isActive` 기준 재연결은 12시간이지만,
분석 대시보드의 이어풀기 표시 조건은 24시간 (`canResume` 계산 기준).

#### localStorage 키 전체 목록

| 키 | 용도 | 설정 위치 |
|----|------|---------|
| `userLoggedIn` | 로그인 상태 bool | `auth-utils.js:12` |
| `userId` | 사용자 UID | `auth-utils.js:15` |
| `userName` | 표시 이름 | `auth-utils.js:13` |
| `userEmail` | 이메일 | `auth-utils.js` |
| `currentSessionId` | 현재 진행 세션 ID | `session-manager.js:81,173,313` |
| `resumeSessionId` | 이어풀기 대상 세션 ID | `analytics-dashboard.js:6107` |
| `lastViewedSubject` | 마지막 방문 과목 | `session-manager.js:211` |
| `quiz_progress_{year}_{subject}` | 일반문제 진행 저장 | `quiz-core.js:saveQuizProgress()` |
| `mockexam_{year}_{hour}_answers` | 모의고사 임시 저장 | `mock-exam.js:_saveExamProgressToLocal()` |
| `mockExamProgress_{year}_{hour}` | 모의고사 타이머 + 답변 백업 | `mock-exam.js:2714` |
| `currentCertificateType` | 자격증 유형 | `certificate-utils.js` |
| `selectedCertificate` | 자격증 유형 (레거시 키) | `certificate-utils.js` |
| `pendingMockExamSave` | 오프라인 시 임시 저장 | `mock-exam.js:M3-D` |
| `devKey` | 개발 모드 활성화 | `firebase-core.js` |

---

### 12-5. 관리자 통계 페이지

#### 파일 경로

| 파일 | 역할 |
|------|------|
| `admin/statistics.html` | 문제별 오답률 통계 |
| `admin/dashboard.html` | 수익/활동 요약 대시보드 |
| `js/analytics/analytics-dashboard.js` | 사용자용 학습 분석 (관리자 탭 포함) |

#### 데이터 조회 방식

**admin/statistics.html** (`statistics.html:418`):
```javascript
// attempts 컬렉션 전체 다운로드
const q = collection(db, 'attempts');
const snapshot = await getDocs(q);  // ← 페이지네이션 없음, 전수 조회
snapshot.forEach(doc => attempts.push({ id: doc.id, ...data }));
```

**admin/dashboard.html** (`dashboard.html:39–100`):
```javascript
// purchases 컬렉션 전수 조회
const purchasesSnap = await getDocs(collection(db, 'purchases'));
// sessions 컬렉션 전수 조회
```

**analytics-dashboard.js** (관리자 탭):
```javascript
// 사용자 attempts 전수 조회 후 클라이언트 집계
// getUserAttempts(userId) → JS에서 groupBySubject(), calculateWeaknesses() 등
```

#### 집계 방식: **클라이언트 사이드 (풀스캔)**

1. `getDocs()` 로 전체 컬렉션 다운로드
2. JavaScript `forEach` + 조건 필터링으로 메모리 집계
3. 서버 사이드 집계 없음 (Firestore aggregation query 미사용)

⚠️ **위험**: 데이터 증가 시 Firestore 읽기 비용 폭증 + 메모리 부족
→ `analytics-dashboard.js:4336` TODO 주석으로 표시됨, 아직 미해결

#### 통계 집계 항목

| 항목 | 계산 방식 |
|------|---------|
| 정답률 | `correctCount / totalAnswered × 100` |
| 점수 | `correctCount × 5` (문제당 5점) |
| 진행률 | `completed / total × 100` |
| 과목별 정확도 | `groupBySubject(attempts)` 후 각 과목별 정답/전체 |
| 취약 과목 | 과목별 정확도 오름차순 정렬 상위 N개 |
| 평균 점수 | 전체 세션 점수 합 / 세션 수 |

---

### 12-6. 문제 수 기준 정의 위치

#### 일반문제: 20문제

| 파일 | 줄 | 형태 |
|------|-----|------|
| `js/analytics/analytics-dashboard.js` | 1879 | `sessionData.total \|\| 20` |
| `js/analytics/analytics-dashboard.js` | 3349, 5485 | `(session.total \|\| 20) * 5` (점수 계산) |
| `js/mockexam.js` | 138 | `total: 20` (각 과목별 — 고아 파일) |

**결론**: Firestore `sessions` 문서의 `total` 필드에 없으면 클라이언트에서 20으로 하드코딩 fallback.

#### 모의고사: 80문제

| 파일 | 줄 | 형태 |
|------|-----|------|
| `js/analytics/analytics-dashboard.js` | 1878 | `type === 'mockexam' ? 80 : ...` |
| `js/analytics/scorecard-component.js` | 815 | `totalQuestions: 80` |
| `js/quiz/mock-exam.js` | 455 | `totalQuestions: 80` (세션 메타데이터) |
| `js/quiz/quiz-core.js` | 168 | `answeredCount < totalQuestions` (detect 함수) |

**결론**: 모두 하드코딩. 설정 파일에 없음. 과목 수(4개 × 20문제 = 80문제) 구조지만 상수로 고정됨.

#### 타이머 기준

| 구분 | 값 | 위치 |
|------|-----|------|
| 일반문제 타이머 | 20분 (`20 * 60`) | `quiz-core.js` |
| 모의고사 타이머 | 80분 (`80 * 60`) | `mock-exam.js:15` |

---

### 12-7. 파일별 Firestore 접근 요약

| 파일 | 읽기 컬렉션 | 쓰기 컬렉션 |
|------|-----------|-----------|
| `js/data/quiz-repository.js` | `attempts` | `attempts` |
| `js/data/session-manager.js` | `sessions` | `sessions` |
| `js/quiz/mock-exam.js` | — | `attempts`, `mockExamResults`, `sessions` |
| `js/analytics/analytics-dashboard.js` | `attempts`, `sessions` | — |
| `admin/statistics.html` | `attempts` | — |
| `admin/dashboard.html` | `purchases`, `sessions` | — |
| `js/data/notice-repository.js` | `notices` | `notices` |
