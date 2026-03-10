# plan.md — 이어풀기 / 기록보기 / 관리자 어려운 문제 추려내기 구현 계획서

> 작성일: 2026-03-10 (v2 — 관리자 통계 워크플로우 반영)
> 상태: 승인 대기 중 (코드 수정 금지)

---

## 0. 전체 워크플로우 개요

이 프로젝트의 핵심 사이클:

```
[사용자 문제 풀이]
      ↓
[Firestore attempts 저장] ← 메타데이터 품질이 전체 분석의 기반
      ↓
[관리자 통계 탭] → 어려운 문제 추려내기
      ↓
[어려운 문제 → 오답 패턴 분석] → 왜 틀렸는지 파악
      ↓
[콘텐츠 개선 / 해설 보완]
```

**이 워크플로우의 병목**: `recordAttempt()`에서 Firestore에 저장하는 메타데이터 품질

---

## 1. 현황 진단 — 메타데이터 저장 구조 분석

### 1-1. 현재 Firestore attempts 문서에 저장되는 필드

```javascript
{
  // 기본 식별
  userId, userName, userEmail, sessionId,

  // 문제 식별 (플랫 필드, 쿼리 최적화용)
  year, subject, number,
  certificateType,           // 'health-manager' | 'sports-instructor'

  // 원본 questionData (중첩 객체)
  questionData: {
    year, subject, number,
    correctAnswer,           // ⚠️ 있을 수도 없을 수도 있음 (아래 문제점 설명)
    isFromMockExam,
    globalIndex,             // 모의고사 전용
    mockExamHour / mockExamPart
  },

  // 답변 데이터
  userAnswer: 0~3,
  isCorrect: boolean,
  isFirstAttempt: boolean,
  firstAttemptAnswer: 0~3,   // 첫 시도일 때만 저장
  firstAttemptIsCorrect: boolean,

  // 추가 행동 메타데이터
  timeSpent: 0,              // ⚠️ 현재 0으로만 저장됨 (실제 측정 안 됨)
  deviceType,
  viewedExplanation: false,  // ⚠️ 현재 항상 false (실제 측정 안 됨)
  timestamp
}
```

### 1-2. 관리자 통계가 사용하는 데이터 (`calculateQuestionStats`)

```
questionStats[`${year}_${subject}_${number}`] = {
  year, subject, number,
  total: 풀이 수,
  correct: 정답 수,
  answers: { 0: n, 1: n, 2: n, 3: n },   // 각 번호별 선택 횟수
  correctVotes: { 0: n, 1: n, 2: n, 3: n },
  correctAnswerIndex: 0~3,   // 추출 또는 추론
  isFromMockExam, fromBothTypes
}
```

`renderQuestionCard(stat)` 에서 시각화:
- 정답률 % + 난이도 배지 (쉬움/보통/어려움)
- 응시 인원 수
- **최다 오답 번호** (`getMostSelectedWrongOption`)
- **답안 선택률** (1~4번 각각 %)
- 문제 페이지로 바로 이동 링크

---

## 2. 발견된 문제점 (메타데이터 관련)

### 🔴 문제 1: `correctAnswer`가 questionData에 없을 수 있음

**증상**: `extractCorrectAnswerIndex(attempt)`에서 5가지 필드를 순서대로 체크:
```javascript
attempt?.correctAnswer,
attempt?.firstAttemptCorrectAnswer,
attempt?.questionData?.correctAnswer,
attempt?.questionData?.correctOption,
attempt?.questionData?.correct
```
모두 없으면 → `correctVotes` 기반 **추론** 처리.

**원인**: `quiz-core.js`에서 `recordAttempt(questionData, userAnswer, isCorrect)` 호출 시
`questionData`에 `correctAnswer` 필드를 포함하는지 여부가 호출부마다 다를 수 있음.

**결과**: 정답 인덱스가 없는 attempt는 "어느 보기가 정답인지 모른 채" 오답 분포만 표시됨.
관리자가 "왜 틀렸는지" 분석할 때 정답 자체를 알 수 없음.

### 🔴 문제 2: `timeSpent` 실제 측정 안 됨

```javascript
timeSpent: questionData?.timeSpent || 0,  // 항상 0
```
문제별 소요 시간은 관리자 입장에서 "어려운 문제" 판단의 중요한 지표.
현재 완전히 누락됨.

### 🔴 문제 3: `viewedExplanation` 실제 측정 안 됨

```javascript
viewedExplanation: questionData?.viewedExplanation || false  // 항상 false
```
"해설을 봤음에도 틀렸는지" 여부가 고난도 문제 분류의 핵심 단서인데 미측정.

### 🟡 문제 4: `questionImage` URL이 attempts에 없음

관리자 통계 카드에서 문제 번호 클릭 → 해당 시험 페이지로 이동.
하지만 attempts 문서에 `questionImage` URL이 없어서, Firestore에서 직접 조회할 수 없음.
(문제 이미지 기반 분석 불가)

### 🟡 문제 5: "왜 틀렸는지" 이유 메타데이터 없음

현재 저장되는 것: 어떤 번호를 선택했는지 (선택지 인덱스).
저장 안 되는 것: **사용자가 왜 그 선택지를 골랐는지** (개념 혼동, 실수, 미지, 계산 오류 등).
→ 이건 사용자 입력 UX가 필요한 선택사항 (Phase 5에서 검토).

### 🟡 문제 6: 관리자 "어려운 문제" 내보내기(Export) 기능 없음

현재: 화면에 카드로만 표시.
필요: 과목별 고난도 문제 목록을 CSV/JSON으로 다운로드하거나 별도 목록으로 관리.

---

## 3. 수정/생성할 파일 목록

| 파일 | 작업 | 이유 |
|------|------|------|
| `js/data/quiz-repository.js` | **수정** | `correctAnswer` 필드 저장 보장, `timeSpent` 실제값 전달 준비 |
| `js/quiz/quiz-core.js` | **수정** | `questionData`에 `correctAnswer` 포함 확인, 문제별 `timeSpent` 측정 추가 |
| `js/analytics/analytics-dashboard.js` | **수정** | 이어풀기 조건 완화, 재도전 버튼, 기록보기 쿼리 버그 수정, 고난도 문제 Export 기능 |
| `js/analytics/analytics-loader.js` | **수정** | `renderHistoryTab` dead code 처리 |
| `css/analytics-dashboard.css` | **수정** | 재도전 버튼, Export 버튼 스타일 |
| `sw.js` | **수정** | CACHE_VERSION 증가 (배포 시) |

---

## 4. 구현 로직

### 4-1. [버그 수정] `correctAnswer` 저장 보장

**수정 위치**: `js/quiz/quiz-core.js` — `recordAttempt()` 호출부

현재 문제별로 `questions[i]` JSON 데이터에 `correctAnswer` 필드가 있음.
호출 시 이를 `questionData`에 명시적으로 포함해야 함.

```javascript
// quiz-core.js 내 recordAttempt 호출부 의사코드
const questionData = {
  year,
  subject,
  number: currentQuestionIndex + 1,
  correctAnswer: questions[currentQuestionIndex].correctAnswer,  // ← 반드시 포함
  isFromMockExam: false,
  certificateType: getCurrentCertificateType(),
  // ...기타 필드
};
await recordAttempt(questionData, userAnswer, isCorrect);
```

**확인 필요**: 현재 `quiz-core.js` 호출부마다 `correctAnswer`가 빠진 경우 추가.

---

### 4-2. [신규] 문제별 `timeSpent` 실제 측정

**측정 방법**: 문제가 표시된 시각부터 "정답 확인" 클릭까지 시간.

```javascript
// quiz-core.js 내 의사코드
let questionStartTime = null;

function displayQuestion(index) {
  questionStartTime = Date.now();  // 문제 표시 시각 기록
  // ...기존 렌더링 로직
}

function submitAnswer(userAnswer) {
  const timeSpent = questionStartTime
    ? Math.floor((Date.now() - questionStartTime) / 1000)  // 초 단위
    : 0;

  const questionData = {
    ...existing fields...,
    correctAnswer: questions[currentQuestionIndex].correctAnswer,
    timeSpent,  // 실제 소요 시간
  };
  await recordAttempt(questionData, userAnswer, isCorrect);
}
```

**관리자 통계 반영**: `calculateQuestionStats`에서 `avgTimeSpent` 집계 추가.
```javascript
stats[key].totalTimeSpent = (stats[key].totalTimeSpent || 0) + attempt.timeSpent;
// avgTimeSpent = totalTimeSpent / total
```

**렌더링**: `renderQuestionCard(stat)`에 `평균 소요시간: NNs` 추가.

---

### 4-3. [신규] `viewedExplanation` 실제 측정

**측정 방법**: "해설 보기" 버튼 클릭 시 플래그를 `questionData`에 설정.

```javascript
// 해설 버튼 클릭 핸들러 (quiz-core.js 또는 quiz-ui.js)
document.querySelector('.explanation-toggle').addEventListener('click', () => {
  window.currentQuestionViewedExplanation = true;
});

// submitAnswer 시 포함
const questionData = {
  ...
  viewedExplanation: window.currentQuestionViewedExplanation || false,
};
window.currentQuestionViewedExplanation = false; // 다음 문제를 위해 리셋
```

**관리자 활용**: 해설을 봤음에도 틀린 문제 → 해설 내용 자체에 문제 있을 가능성.

---

### 4-4. [이어풀기 조건 완화]

**현재** (`analytics-dashboard.js` ~1881번째 줄):
```javascript
const canResume = isActive && completed > 0 && completed < totalQuestions;
```

**수정 의사코드**:
```javascript
// isActive 의존성 제거. 24시간 이내 + 미완료이면 항상 이어풀기 허용
const sessionAgeMs = startTime ? (Date.now() - startTime.getTime()) : Infinity;
const isWithin24h = sessionAgeMs < 24 * 60 * 60 * 1000;
const canResume = completed > 0 && completed < totalQuestions && isWithin24h;
```

---

### 4-5. [신규] 완료 세션 "다시 풀기" 버튼

```javascript
// createProSessionCard() 내 버튼 영역 수정
const isCompleted = completed >= totalQuestions;

// HTML 버튼 영역
${session.canResume
  ? `<button class="session-btn session-btn-resume">이어풀기 →</button>`
  : isCompleted
    ? `<button class="session-btn session-btn-retry">다시 풀기</button>`
    : ''}
<button class="session-btn session-btn-record">기록보기</button>
<button class="session-btn session-btn-delete">🗑</button>

// retrySession(sessionId) 함수 추가
function retrySession(sessionId) {
  const s = window.sessionCards?.find(c => c.id === sessionId);
  if (!s) return;
  const folder = s.certType === 'sports' ? 'exam-sports' : 'exam';
  const url = s.type === 'mockexam'
    ? `${folder}/${s.year}_모의고사_${s.hour}교시.html?year=${s.year}&hour=${s.hour}`
    : `${folder}/${s.year}_${s.subject}.html`;
  localStorage.removeItem('resumeSessionId');
  showToast('처음부터 다시 풀기를 시작합니다.');
  window.location.href = url;
}
```

---

### 4-6. [버그 수정] 기록보기 모의고사 쿼리 필드명 불일치

```javascript
// analytics-dashboard.js showSessionScorecard 내
// 변경 전 (버그)
where("examType", "==", "모의고사")

// 변경 후
where("type", "==", "mockexam")
```

---

### 4-7. [신규] 관리자 통계 — 고난도 문제 Export 기능

**구현 위치**: `renderQuestionStatsHTML()` 함수 내 버튼 추가.

```javascript
// "어려운 문제만 내보내기" 버튼 클릭 시
function exportHardQuestions(questionStats, threshold = 50) {
  const hard = Object.values(questionStats)
    .filter(s => (s.correct / s.total * 100) < threshold)
    .sort((a, b) => (a.correct / a.total) - (b.correct / b.total)) // 어려운 순
    .map(s => ({
      year: s.year,
      subject: decodeSubjectName(s.subject),
      number: s.number,
      accuracy: ((s.correct / s.total) * 100).toFixed(1) + '%',
      total: s.total,
      correctAnswer: (s.correctAnswerIndex ?? 'N/A') + 1,  // 1-based
      mostWrongOption: getMostSelectedWrongOption(s),
      answerDist: [0,1,2,3].map(i =>
        `${i+1}번: ${s.answers[i]||0}명(${s.total > 0 ? ((s.answers[i]||0)/s.total*100).toFixed(0) : 0}%)`
      ).join(' / ')
    }));

  // CSV 다운로드
  const header = ['연도', '과목', '문번', '정답률', '응시수', '정답', '최다오답', '선택 분포'];
  const rows = hard.map(q => [
    q.year, q.subject, q.number, q.accuracy, q.total,
    q.correctAnswer,
    q.mostWrongOption ? `${q.mostWrongOption.option}번(${q.mostWrongOption.rate}%)` : '-',
    q.answerDist
  ]);
  const csv = [header, ...rows].map(r => r.join('\t')).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/tab-separated-values;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `고난도문제_${new Date().toLocaleDateString()}.tsv`;
  link.click();
}
```

**버튼 UI 추가** (`renderQuestionStatsHTML` 요약 통계 섹션 아래):
```html
<button onclick="exportHardQuestions(questionStats, 50)">
  ⬇ 고난도 문제 내보내기 (정답률 50% 미만)
</button>
<button onclick="exportHardQuestions(questionStats, 40)">
  ⬇ 초고난도만 (40% 미만)
</button>
```

---

### 4-8. [신규] 관리자 통계 — 오답 패턴 상세 뷰

현재 카드에는 "최다 오답: 2번 (45%, 18명)" 한 줄만 표시.
개선: **카드 클릭 시** 해당 문제의 상세 오답 분포를 확장 표시.

```
┌──────────────────────────┐
│ 2025 운동생리학 3번       │
│ 어려움 | 응시 40명        │
│ 정답률 32.5%              │
│ ──────────────────────── │
│ 답안 선택 분포:           │
│ 1번 ██░░░░░ 25% (10명)   │
│ 2번 ████░░░ 45% (18명) ← 최다오답
│ 3번 ██████ 32.5% (13명) ← 정답 ✓
│ 4번 ░░░░░░░  0% (0명)    │
│ ──────────────────────── │
│ 평균 소요: 45초           │
│ [문제 보기] [해설 보기]   │
└──────────────────────────┘
```

구현: `renderQuestionCard`에서 기본 뷰 유지, 클릭 시 `data-expanded` 토글로 상세 표시.

---

## 5. 충돌 가능성 및 해결 방안

### 충돌 1: `correctAnswer` 저장 후 기존 데이터와의 불일치
- **상황**: 신규 attempts에는 `correctAnswer`가 있고 구버전에는 없음
- **해결**: `extractCorrectAnswerIndex()`의 fallback 로직이 이미 존재 → 하위 호환 유지됨
- **추가**: 구버전 attempts에서도 `correctVotes` 추론이 있으므로 통계에서 사용 가능

### 충돌 2: `timeSpent` 측정 추가 시 quiz-core.js 타이밍
- **상황**: `questionStartTime`이 문제 이미지 로드 전에 기록될 수 있음
- **해결**: `displayQuestion()` 내에서 이미지 onload 이후 타이머 시작 고려
- **또는**: 이미지 로드 대기 없이 DOM 삽입 직후 기록 (간단한 접근)

### 충돌 3: Export 기능에서 `decodeSubjectName` 접근
- **상황**: `decodeSubjectName` 함수가 `renderQuestionStatsHTML` 내부 지역 함수
- **해결**: `exportHardQuestions` 를 같은 스코프에 두거나 `safeDecodeText` 전역 함수 사용

### 충돌 4: 이어풀기 조건 완화 후 완료된 세션이 "이어풀기 가능"으로 표시될 수 있음
- **상황**: `completed >= totalQuestions` 체크가 없으면 완료된 세션도 canResume
- **해결**: `canResume = completed > 0 && completed < totalQuestions && isWithin24h` — `< totalQuestions` 조건이 있으므로 완료 세션은 canResume = false 유지됨

### 충돌 5: `renderHistoryTab` 호출 → 함수 없음 에러
- **상황**: `analytics-loader.js`에서 호출되지만 정의 없음
- **해결**: 각 파일에서 `const renderHistoryTab = renderQuestionSetsTab` alias 추가

---

## 6. 작업 단계별 To-do List

### Phase 1 — 버그 수정 (즉각 효과)
- [v] **1-A**: `analytics-dashboard.js` + `analytics-loader.js` — `renderHistoryTab` alias 추가
- [v] **1-B**: `showSessionScorecard` / `showMockExamScorecard` — `examType` → `type` 필드 수정
- [v] **1-C**: `renderAdminTab` 내 `renderHistoryTab` case 처리

### Phase 2 — 이어풀기 개선
- [v] **2-A**: `canResume` 조건에서 `isActive` 제거, `isWithin24h` 추가
- [v] **2-B**: `createProSessionCard()` — `session-btn-retry` 버튼 추가
- [v] **2-C**: `retrySession()` 함수 구현 및 이벤트 리스너 등록
- [v] **2-D**: 이어풀기/다시풀기 토스트 메시지 추가

### Phase 3 — 메타데이터 품질 강화 (관리자 통계 정확도 향상)
- [v] **3-A**: `quiz-data-recorder.js` — `correctAnswer`, `certificateType`, `timeSpent`, `viewedExplanation` 포함
- [v] **3-B**: `quiz-core.js` — `loadQuestion()` 시작 시 `window.__questionStartTime` 기록
- [v] **3-C**: `quiz-core.js` — `checkAnswer()` 에서 `window.__questionTimeSpent` 계산
- [v] **3-D**: `quiz-core.js` — 해설 있을 시 `window.__questionViewedExplanation = true` 자동 설정
- [v] **3-E**: `quiz-data-recorder.js` — `window.__questionViewedExplanation` 값 읽어 저장 확인

### Phase 4 — 관리자 통계 Export 기능
- [v] **4-A**: `renderQuestionStatsHTML()` 내에 Export 버튼 2개 추가 (50% 미만, 40% 미만)
- [v] **4-B**: `exportHardQuestions(questionStats, threshold)` 함수 구현
  - CSV 형식으로 다운로드 (BOM 포함, 엑셀에서 바로 열기 가능)
  - 포함 컬럼: 연도, 과목, 문번, 정답률, 응시수, 정답번호, 최다오답, 선택 분포, 평균소요시간
- [v] **4-C**: `calculateQuestionStats()`에 `avgTimeSpent` 집계 추가 (Phase 3 완료 후)

### Phase 5 — 관리자 카드 UX 개선 (확장 상세 뷰)
- [v] **5-A**: `renderQuestionCard(stat)` — 클릭 시 상세 바 차트 토글 (답안 분포 시각화)
- [v] **5-B**: 정답 번호 하이라이트 (정답 행 배경색 강조)
- [v] **5-C**: 평균 소요 시간 표시 (Phase 3 완료 후)

### Phase 6 — 배포
- [v] **6-A**: `sw.js` CACHE_VERSION 증가 (2026031001 → 2026031002)
- [ ] **6-B**: GitHub 푸시

---

## 7. 메타데이터 품질 — 현재 vs 개선 후 비교

| 필드 | 현재 | 개선 후 | 관리자 통계 활용 |
|------|------|---------|----------------|
| `correctAnswer` | 저장 안 될 수도 있음 | 항상 저장 | 정답 인덱스 명확, 추론 불필요 |
| `userAnswer` | ✅ 저장 | ✅ 유지 | 오답 분포 정확 |
| `firstAttemptAnswer` | ✅ 저장 | ✅ 유지 | 첫 번째 선택 분석 |
| `timeSpent` | 항상 0 | 실제 초(sec) | 어려운 문제 = 오래 걸린 문제 교차 분석 |
| `viewedExplanation` | 항상 false | 실제 측정 | 해설 봐도 틀린 문제 → 해설 품질 이슈 |
| `deviceType` | ✅ 저장 | ✅ 유지 | 모바일 특유 오답 패턴 분석 |
| `certificateType` | ✅ 저장 | ✅ 유지 | 자격증별 필터링 |

---

## 8. 기록보기 현황 재진단

| 기능 | 상태 | 비고 |
|------|------|------|
| 세션 카드 목록 | ✅ 정상 | `question-sets-tab`에서 렌더링 |
| 일반 시험 정오표 | ✅ 정상 | `showSessionScorecard()` |
| 모의고사 정오표 | ⚠️ 쿼리 버그 | `examType` vs `type` 필드명 불일치 |
| 이어풀기 버튼 | ⚠️ 조건 과도 | `isActive` 제거 필요 |
| 완료 세션 재도전 | ❌ 없음 | Phase 2에서 추가 |
| 정오표 정답 하이라이트 | ✅ 있음 | `correctAnswerIndex` 기반 |
| `history-tab` | ❌ dead code | HTML 요소 없음, 함수 없음 |

---

## 9. 관리자 통계 현황 재진단

| 기능 | 상태 | 비고 |
|------|------|------|
| 문제별 정답률 카드 | ✅ 정상 | 과목별 그룹, 정렬 가능 |
| 최다 오답 표시 | ✅ 정상 | `getMostSelectedWrongOption()` |
| 답안 선택률 (1~4번 %) | ✅ 정상 | `stat.answers` |
| 정답 번호 식별 | ⚠️ 불안정 | `correctAnswer` 없으면 추론 |
| 소요시간 기반 난이도 | ❌ 없음 | `timeSpent` 항상 0 |
| 해설 조회 연동 분석 | ❌ 없음 | `viewedExplanation` 항상 false |
| 고난도 문제 내보내기 | ❌ 없음 | Phase 4에서 추가 |
| 문제 카드 상세 뷰 | ⚠️ 기본만 | Phase 5에서 확장 |

---

## 10. 구현 우선순위

```
[즉각 버그 수정]     Phase 1 (1-A~C)       ← 현재 작동 안 하는 것 수정
[이어풀기 UX]        Phase 2 (2-A~D)       ← 사용자 직접 체감
[메타데이터 강화]    Phase 3 (3-A~E)       ← 관리자 통계 정확도 기반
[관리자 Export]      Phase 4 (4-A~C)       ← 어려운 문제 추려내기 워크플로우
[관리자 카드 UX]     Phase 5 (5-A~C)       ← 세부 시각화
[배포]               Phase 6              ← 마무리
```

Phase 3과 4는 "어려운 문제 → 오답 이유 분석" 워크플로우의 핵심.
Phase 3 없이는 Phase 4 export 데이터 품질 보장 불가.

---

## 11. 신규 발견 버그 수정 (2026-03-10)

### 수정 완료
- [v] **analytics-dashboard.js 빈 try 블록 제거**: ~5562줄 `try {}` SyntaxError → 학습분석 탭 전체 로드 불가 원인. 제거 완료.
- [v] **mockexam.js 플레이스홀더 코드 수정**: `submitMockExam()` 내 `/* 년도 추출 */` 주석 대입 → SyntaxError. URL + URLParams에서 year/hour 추출로 교체.

### 추후 확인 필요
- [ ] **mockexam.js 이중 함수 정리**: `submitMockExam()` vs `saveMockExamResults()` 동일 로직 중복. 각 모의고사 HTML에서 어느 함수를 호출하는지 확인 후 단일화.
- [ ] **sw.js CACHE_VERSION 2026031002로 배포 후 버그 수정 반영 확인**

---

# Plan V3 — 모의고사 제출 통합 / 버그 재발 방지 / 세션 핸드오프 (2026-03-10)

> 목표: 단순 버그 수정이 아니라 "다시는 이런 문제가 반복되지 않는다"를 보장하는 구조 설계.
> 모바일 환경, 클로드 세션 연속성, 코드 품질 게이트까지 모두 포함.

---

## A. 현황 진단 — 진짜 문제

### A-1. 모의고사 제출 4중 구현 지도

현재 실제 실행 흐름 (감사 결과):

```
[exam/2025_모의고사_1교시.html]
  │
  ├─ <script> js/quiz/mock-exam.js (IIFE, ~2200줄)
  │     └─ submitQuiz() 정의 → saveMockExamResults() 호출 (가장 완전한 구현)
  │     └─ window.submitQuiz = submitQuiz (노출)
  │
  └─ <script module> js/exam/mock-exam-page.js (ESM)
        ├─ 265줄: submit-button.addEventListener('click', submitMockExam)
        ├─ submitMockExam() = quiz-core의 submitQuiz() + 자체 saveMockExamResults()
        └─ 497줄: window.submitQuiz = submitMockExam  ← IIFE의 submitQuiz를 덮어씀!

[js/mockexam.js]  ← 어떤 HTML에서도 로드하지 않음 (완전한 고아 파일)
  ├─ submitMockExam() — SyntaxError 있었음 (수정됨)
  └─ saveMockExamResults() — 완성된 구현이나 사용 안 됨
```

**실제 문제**: mock-exam-page.js의 submit button addEventListener가 먼저 등록되면서
IIFE의 가장 완전한 구현(batchRecordAttempts 사용)이 우회됨.
실제로는 mock-exam-page.js의 단순 saveMockExamResults만 실행됨.

### A-2. 데이터 저장 완전성 비교

| 필드 | 일반문제(수정후) | 모의고사(현재 실제) | 모의고사(의도) |
|------|---|---|---|
| timeSpent | 저장됨 | 항상 0 | 미구현 |
| viewedExplanation | 저장됨 | 항상 false | 연결 안 됨 |
| correctAnswer | 저장됨 | 저장됨 | 저장됨 |
| sessionId | 저장됨 | 조건부 | 저장됨 |
| batchRecordAttempts | 사용됨 | 미사용 | 사용 예정 |

### A-3. 모바일 취약점 현황

| 상황 | 현재 처리 | 문제 |
|------|----------|------|
| 앱 백그라운드 전환 | visibilitychange → saveQuizProgress | 모의고사 타이머 멈추지 않음 |
| iOS Safari bfcache 복원 | pagehide 이벤트만 처리 | 복원 시 타이머 재시작 안 됨 |
| 네트워크 끊김 | 처리 없음 | 제출 시 데이터 유실 |
| 화면 잠금 중 타이머 | 처리 없음 | 잠금 시간이 풀이시간에 합산됨 |
| 뒤로가기 경고 | 처리 없음 | 실수 이탈 시 진행상황 유실 |
| 중복 제출 | isSubmitInProgress 있음 | 모의고사만, 일반퀴즈는 없음 |

### A-4. 발견된 코드 품질 위험 요소

| 위치 | 문제 유형 | 영향 |
|------|--------|------|
| analytics-dashboard.js 구 5562줄 | 빈 try{} | 학습분석 탭 전체 로드 불가 (수정완료) |
| mockexam.js 구 110줄 | 플레이스홀더 주석 대입 | SyntaxError (수정완료) |
| analytics-dashboard.js 4336줄 | TODO 미처리 — 전체 풀스캔 | Firestore 비용 폭증 위험 |
| mock-exam.js 2079줄 | perQuestionChecked 미연결 | viewedExplanation 항상 false |
| mock-exam-page.js 497줄 | window.submitQuiz 덮어씀 | IIFE 구현 무력화 |

---

## B. 구현 계획 — 모의고사 제출 단일화

### B-1. 목표 아키텍처

```
[제출 버튼 클릭]
  ↓
[mock-exam.js IIFE: submitQuiz()] — 단일 진입점
  ├─ isSubmitInProgress 가드 (중복 클릭 방지)
  ├─ clearInterval(timerInterval)
  ├─ reviewMode = true
  ├─ showResults()
  └─ mockExamSavePromise = saveMockExamData()

[saveMockExamData()] — 신규 통합 함수 (mock-exam.js IIFE 내부)
  ├─ 로그인 확인 → 비로그인 시 localStorage 임시 저장 후 리턴
  ├─ navigator.onLine 확인 → 오프라인 시 localStorage 저장 + online 이벤트 대기
  ├─ year/hour 추출 (URLSearchParams → pathname regex → 기본값 순서)
  ├─ sessionId 확보 (sessionManager → localStorage → temp)
  ├─ 80문제 순회
  │   ├─ timeSpent: __mockAnswerTimestamps[i] - __mockQuestionStartTime[i]
  │   ├─ viewedExplanation: __mockViewedExplanation[i]
  │   └─ correctAnswer: question.correctAnswer
  ├─ batchRecordAttempts() (실패 시 개별 저장 fallback)
  ├─ recordMockExamResults() (시험 전체 결과)
  ├─ sessionManager.endSession()
  └─ 성공/실패 toast 표시
```

### B-2. 모의고사 per-question 메타데이터 수집 설계

mock-exam.js IIFE 내부에 추가할 추적 변수:

```javascript
// globalIndex 기준 추적 맵
const __mockQuestionStartTime = {};   // 문제 표시 시각
const __mockAnswerTimestamps = {};    // 선택지 클릭 시각
const __mockViewedExplanation = {};   // 해설 조회 여부

// [연결 위치 1] 문제 로드 함수 (loadQuestion 또는 renderQuestion)
// 기존 코드 상단에 삽입:
__mockQuestionStartTime[globalIndex] = Date.now();

// [연결 위치 2] 선택지 클릭 핸들러
// 기존 selectOption() 상단에 삽입:
if (!__mockAnswerTimestamps[globalIndex]) {
  __mockAnswerTimestamps[globalIndex] = Date.now();
}

// [연결 위치 3] 해설 토글 함수
// 기존 explanation 토글 코드에 삽입:
__mockViewedExplanation[globalIndex] = true;

// [saveMockExamData 내부] 문제별 데이터 구성 시:
const start = __mockQuestionStartTime[globalIndex];
const answered = __mockAnswerTimestamps[globalIndex];
const timeSpent = (start && answered) ? Math.floor((answered - start) / 1000) : 0;
const viewedExplanation = __mockViewedExplanation[globalIndex] || false;
```

### B-3. 모바일 안전성 설계

**① visibilitychange — 타이머 일시정지 및 localStorage 백업**

```javascript
let __timerPausedAt = null;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (!reviewMode && timerInterval) {
      clearInterval(timerInterval);
      __timerPausedAt = Date.now();
    }
    saveExamProgressToLocal();  // localStorage 백업
  } else {
    if (__timerPausedAt && !reviewMode && timeRemaining > 0) {
      __timerPausedAt = null;
      startTimer();  // 재시작 (잠금 시간은 타이머에서 제외됨)
    }
  }
});
```

**② pageshow — iOS bfcache 복원 대응**

```javascript
window.addEventListener('pageshow', (e) => {
  if (e.persisted && !reviewMode && timeRemaining > 0) {
    // bfcache에서 복원됨 → 타이머 재시작
    if (!timerInterval) {
      startTimer();
    }
  }
});
```

**③ beforeunload — 이탈 경고**

```javascript
window.addEventListener('beforeunload', (e) => {
  if (!reviewMode && timeRemaining > 0 && !isSubmitInProgress) {
    e.preventDefault();
    e.returnValue = '';  // 브라우저 기본 경고 다이얼로그
    saveExamProgressToLocal();
  }
});
```

**④ 네트워크 오프라인 fallback**

```javascript
async function saveMockExamData() {
  if (!navigator.onLine) {
    const pendingData = JSON.stringify({
      attemptsToSave, year, hour,
      savedAt: Date.now()
    });
    localStorage.setItem('pendingMockExamSave', pendingData);
    showToast('오프라인 상태입니다. 인터넷 연결 시 자동 저장됩니다.', 'warning');
    window.addEventListener('online', async () => {
      const pending = localStorage.getItem('pendingMockExamSave');
      if (pending) {
        await saveMockExamData();  // 재시도
        localStorage.removeItem('pendingMockExamSave');
      }
    }, { once: true });
    return;
  }
  // ... 정상 저장 로직
}
```

**⑤ localStorage 진행상황 백업 함수**

```javascript
function saveExamProgressToLocal() {
  localStorage.setItem('mockExamProgress', JSON.stringify({
    year, hour, timeRemaining,
    userAnswers: Object.fromEntries(
      Object.entries(userAnswers).filter(([, v]) => v !== null)
    ),
    savedAt: Date.now()
  }));
}
```

### B-4. 파일별 작업 목록 (실행 순서)

| 순서 | 파일 | 변경 내용 |
|------|------|-----------|
| 1 | js/exam/mock-exam-page.js | 497줄 window.submitQuiz 덮어쓰기 제거 |
| 2 | js/quiz/mock-exam.js | 추적 변수 선언 및 연결 3곳 |
| 3 | js/quiz/mock-exam.js | saveMockExamData() 통합 함수 구현 |
| 4 | js/quiz/mock-exam.js | visibilitychange / pageshow / beforeunload 핸들러 |
| 5 | js/quiz/mock-exam.js | 네트워크 오프라인 fallback |
| 6 | js/mockexam.js | deprecated 주석 추가 (고아 파일 표시) |
| 7 | scripts/check-syntax.sh | 신규 생성 |
| 8 | CLAUDE.md | 배포 전 체크 규칙 추가 |
| 9 | WORKSTATE.md | 신규 생성 |
| 10 | sw.js | CACHE_VERSION 증가 |

---

## C. 재발 방지 — 품질 게이트

### C-1. 배포 전 필수 구문 검사 스크립트

파일: `scripts/check-syntax.sh` (신규)

역할: ESM 모드로 모든 JS 파일 검사. 오류 있으면 exit 1로 배포 중단.
실행: `bash scripts/check-syntax.sh`

검사 항목:
- 빈 try{} 블록
- 플레이스홀더 주석 대입
- import/export 문법 오류
- 미완성 함수 본체

### C-2. CLAUDE.md에 추가할 규칙

배포 전 필수 명령:
```
bash scripts/check-syntax.sh
```

코드 품질 금지 사항:
- 주석을 값으로 대입하는 코드 절대 금지
  (const year = /* 추출 */; 형태)
- 빈 try{} 블록 금지
- 동일 로직 중복 구현 금지 — 새 함수 작성 전 Grep 확인 필수
- window.xxx = yyy로 전역 함수 덮어쓰기 금지 (의도적인 경우 주석 필수)

### C-3. 코드 리뷰 체크리스트 (Claude가 코드 수정 시 매번 확인)

- [ ] 추가한 모든 try{}에 catch 또는 finally가 있는가?
- [ ] 플레이스홀더 주석(TODO)이 코드로 완성되었는가?
- [ ] 동일 기능의 기존 함수가 없는지 Grep으로 확인했는가?
- [ ] window.xxx 덮어쓰기가 없는가?
- [ ] 수정 후 node --input-type=module --check 통과하는가?

---

## D. 클로드 세션 핸드오프 워크플로우

### D-1. 필수 문서 체계

```
프로젝트 루트/
  WORKSTATE.md   ← 현재 작업 상태 (매 단계 완료 시 업데이트)
  research.md    ← 코드베이스 분석 결과 (발견 즉시 추가)
  plan.md        ← 구현 계획 전체 (단계 완료 시 체크)
  CLAUDE.md      ← 프로젝트 영구 규칙 (검증된 것만 기록)
```

### D-2. WORKSTATE.md 형식 (신규 파일 — 아래 형식으로 유지)

```
# 현재 작업 상태
마지막 업데이트: YYYY-MM-DD

## 지금 하고 있는 것
[한 줄 설명]

## 직전 완료
[완료된 단계 + plan.md 섹션 참조]

## 다음 할 것
[다음 단계 + 관련 파일명 + plan.md 섹션 참조]

## 현재 수정 중인 파일
- 파일명 — 이유

## 주의사항
- [현재 세션 발견 사항]

## 배포 전 체크
- [ ] bash scripts/check-syntax.sh
- [ ] sw.js CACHE_VERSION 확인
- [ ] 모바일 Safari 수동 테스트
```

### D-3. 새 클로드 세션 첫 작업 순서

1. WORKSTATE.md 읽기 — 현재 상태 파악
2. plan.md 해당 Phase 읽기 — 무엇을 해야 하는지
3. research.md 관련 섹션 읽기 — 함수/파일 위치
4. 실제 파일 Read — 코드 확인 후 작업 시작

새 세션 첫 메시지 예시:
"WORKSTATE.md와 plan.md를 읽고 Plan V3 Phase M1부터 이어서 진행해줘."

### D-4. 단계 완료 시 필수 업데이트

매 Phase 완료 후 반드시:
1. plan.md 해당 Todo에 [v] 체크
2. WORKSTATE.md 업데이트 (다음 작업 + 주의사항)
3. research.md에 새 발견 사항 추가 (있을 경우)
4. bash scripts/check-syntax.sh 실행

---

## E. Phase별 Todo (실행 순서)

### Phase M1 — mock-exam-page.js 덮어쓰기 제거
- [v] **M1-A**: mock-exam-page.js 497줄 window.submitQuiz = submitMockExam 주석 처리 + deprecated 헤더 추가
- [v] **M1-B**: 확인 — 모의고사 HTML은 mock-exam-page.js를 로드하지 않음 (고아 파일)
- [v] **M1-C**: 확인 — mock-exam.js IIFE의 window.submitQuiz = submitQuiz (2642줄)가 단독 진입점

### Phase M2 — per-question 메타데이터 수집
- [v] **M2-A**: mock-exam.js loadQuestion 진입 시 __mockQuestionStartTime[gIdx] 기록
- [v] **M2-B**: selectOption 클릭 시 __mockAnswerTimestamps[globalIndex] 기록 (최초 클릭만)
- [v] **M2-C**: checkAnswer() 시 해설 있으면 __mockViewedExplanation[globalIndex] = true
- [v] **M2-D**: saveMockExamResults() questionData에 timeSpent, viewedExplanation 포함

### Phase M3 — 모바일 안전성 (mock-exam.js + quiz-core.js 양쪽 적용)
- [v] **M3-A**: visibilitychange — 타이머 일시정지(clearInterval) + visible 시 재시작 + localStorage 백업
- [v] **M3-B**: pageshow e.persisted — bfcache 복원 시 타이머 재시작
- [v] **M3-C**: beforeunload — reviewMode 아닐 때 e.returnValue='' 경고 + 저장
- [v] **M3-D**: navigator.onLine 체크 + pendingXxxSave localStorage + online 이벤트 재시도

### Phase M4 — 품질 게이트 구축
- [v] **M4-A**: scripts/check-syntax.sh 생성
- [v] **M4-B**: CLAUDE.md에 배포 전 체크 명령 + 코드 품질 규칙 추가
- [v] **M4-C**: WORKSTATE.md 신규 생성

### Phase M5 — 고아 파일 정리
- [v] **M5-A**: js/mockexam.js 상단에 DEPRECATED 주석 추가
- [v] **M5-B**: js/exam/mock-exam-page.js 상단 DEPRECATED + window.submitQuiz 덮어쓰기 주석 처리

### Phase M6 — 배포
- [v] **M6-A**: bash scripts/check-syntax.sh 전체 통과
- [v] **M6-B**: sw.js CACHE_VERSION 2026031002 → 2026031003
- [ ] **M6-C**: GitHub 푸시 (사용자 확인 후)

---

## F. 위험도 우선순위

| 이슈 | 사용자 영향 | 긴급도 | Phase |
|------|-----------|--------|-------|
| mock-exam-page.js submitQuiz 덮어쓰기 | 모의고사 저장 경로 혼선 | 높음 | M1 |
| 모바일 타이머 백그라운드 미정지 | 타이머 부정확 | 높음 | M3-A/B |
| 네트워크 오프라인 저장 실패 | 데이터 유실 | 높음 | M3-D |
| 뒤로가기 이탈 경고 없음 | UX 불편, 데이터 유실 | 중간 | M3-C |
| timeSpent 모의고사 미수집 | 관리자 통계 불완전 | 중간 | M2 |
| analytics 전체 풀스캔 TODO | Firestore 비용 폭증 위험 | 중간 | 별도 |
| mockexam.js 고아 파일 | 혼선 (기능 영향 없음) | 낮음 | M5 |

---

# Plan R — 세션 기반 이어풀기 (뒤로가기/이탈 대응, 2026-03-10)

> 목표: iOS Safari에서 작동하지 않는 `beforeunload e.returnValue` 대신,
> 이탈 시 조용히 저장 → 재진입 시 in-page 배너로 이어서/처음부터 선택.

## Phase R1 — beforeunload 경고 제거 + 조용한 저장
- [v] **R1-A**: quiz-core.js beforeunload: e.returnValue 제거 → saveQuizProgress만 호출
- [v] **R1-B**: mock-exam.js beforeunload: e.returnValue 제거 → _saveExamProgressToLocal만 호출

## Phase R2 — 일반문제(quiz-core.js) 배너 추가
- [v] **R2-A**: detectInterruptedProgress(totalQuestions) 함수 추가
- [v] **R2-B**: showResumeBanner(data) 함수 추가 (inline CSS 배너, 이어서/처음부터 버튼)
- [v] **R2-C**: initializeQuiz() 내 자동 복원 로직 → 배너 기반으로 교체

## Phase R3 — 모의고사(mock-exam.js) 배너 추가
- [v] **R3-A**: detectInterruptedMockExam() 함수 추가 (IIFE 내부)
- [v] **R3-B**: showMockResumeBanner(data) 함수 추가 (IIFE 내부)
- [v] **R3-C**: DOMContentLoaded 5분 자동복원 → 24시간 배너 기반으로 교체

## Phase R4 — 배너 CSS (모바일 터치)
- [v] **R4**: 배너 버튼 min-height:40px / min-width:80px — 이미 inline CSS로 반영됨

## Phase R5 — 제출 성공 시 localStorage 정리
- [v] **R5**: saveMockExamResults() 성공 후 mockexam_${year}_${hour}_answers + mockExamProgress_${year}_${hour} 삭제

## Phase R6 — 배포
- [v] **R6-A**: bash scripts/check-syntax.sh 통과
- [v] **R6-B**: sw.js CACHE_VERSION 2026031003 → 2026031004
- [v] **R6-C**: GitHub 푸시 완료 (18be985)

---

# Plan V4 — 관리자 통계 강화 + 완주 세션 필터 (2026-03-10)

> 목표 1 (기능 1): admin/statistics.html — 과목별 문제 정답률 + 오답 분포 테이블 + xlsx 다운로드
> 목표 2 (기능 2): 완주 세션만 통계에 반영 (admin + 사용자 분석 양쪽)
> 승인 전 코드 수정 금지.

---

## A. 현황 분석 — 기존 코드 상태

### A-1. admin/statistics.html 현재 구현

| 항목 | 현재 상태 |
|------|---------|
| 데이터 소스 | `attempts` 루트 컬렉션 전체 다운로드 (`getDocs(collection(db, 'attempts'))`, 줄 418-419) |
| 과목 필터 | 있음 — `<select id="subjectFilter">` (줄 306-318), 코드 필터 (줄 432-433) |
| 연도 필터 | 없음 |
| 문제번호 정렬 | 불명확 (집계 후 order 확인 필요) |
| 정답률 표시 | 있음 — `Math.round((stat.correct / stat.total) * 100)` (줄 556, 586) |
| 오답 분포 표시 | 있음 — 선택지별 인원수/비율 (줄 592-609) |
| 완주 세션 필터 | **없음** — 모든 attempts 포함 |
| xlsx 다운로드 | **없음** |

### A-2. analytics-dashboard.js 현재 구현

| 항목 | 현재 상태 |
|------|---------|
| attempts 쿼리 | `where('userId','==',uid)` + `where('sessionId','in',[...])` (줄 184-188) |
| 문제별 통계 | `loadQuestionStatistics()` 함수 (줄 4291+) |
| 완주 필터 | `completed >= totalQuestions` — **세션 카드 UI 용도**, 통계 계산에는 미적용 |
| 캐시 | `StatsCache` 5분 캐시, 키: `generateKey('question-stats', {year, subject, setType})` |

### A-3. Firestore 데이터 구조 핵심

```
attempts/{attemptId}              ← 루트 컬렉션
  ├─ userId
  ├─ sessionId                    ← 세션과 연결되는 핵심 키
  ├─ number                       ← 문제 번호 (1~20 또는 1~80)
  ├─ questionData.subject         ← 과목명
  ├─ questionData.year            ← 연도
  ├─ questionData.isFromMockExam  ← true면 모의고사 (80문제 기준)
  ├─ userAnswer                   ← 사용자 선택 (0~3)
  ├─ isCorrect                    ← 정답 여부
  └─ timestamp

sessions/{userId}/sessions/{sessionId}    ← 서브컬렉션
  ├─ isActive                     ← false = endSession() 호출됨
  ├─ stats.attemptedQuestions     ← 모의고사 완료 시 설정
  ├─ attemptCount                 ← batchRecordAttempts() 시 increment
  └─ type                         ← 'regular' | 'mockexam'
```

---

## B. 완주 세션 판정 로직 설계 (기능 2 핵심)

### B-1. 판정 기준 선택

**채택 방식: 클라이언트 사이드 — attempts 카운팅**

이유:
- 기존 코드가 이미 모든 attempts를 메모리에 로드함 → 추가 Firestore 쿼리 없음
- `sessions` 서브컬렉션 collectionGroup 쿼리는 추가 읽기 비용 발생
- `stats.attemptedQuestions`는 모의고사 완료 시에만 설정 (일반문제는 미적용) → 비일관적
- `isActive: false`만으로는 "중간에 앱 종료 후 재시작 없음" 케이스를 잡지 못함

**완주 판정 알고리즘**:

```
1. attempts를 sessionId 기준으로 그룹핑
2. 각 세션 그룹에서:
   a. isFromMockExam이 하나라도 true → 모의고사 세션 → 기준: 80문제
   b. 전부 false → 일반문제 세션 → 기준: 20문제
3. 그룹 내 attempt 수 >= 기준 → 완주 세션으로 판정
4. 완주 세션 ID Set 생성
5. attempts 중 sessionId가 Set에 포함된 것만 통계에 사용
```

**의사 코드**:
```javascript
function filterCompletedAttempts(allAttempts) {
  // 1단계: 세션별 그룹핑
  const sessionGroups = {};
  allAttempts.forEach(a => {
    if (!sessionGroups[a.sessionId]) {
      sessionGroups[a.sessionId] = [];
    }
    sessionGroups[a.sessionId].push(a);
  });

  // 2단계: 완주 세션 ID 수집
  const completedSessionIds = new Set();
  Object.entries(sessionGroups).forEach(([sessionId, attempts]) => {
    const isMockExam = attempts.some(a => a.questionData?.isFromMockExam === true);
    const required = isMockExam ? 80 : 20;
    if (attempts.length >= required) {
      completedSessionIds.add(sessionId);
    }
  });

  // 3단계: 완주 세션의 attempts만 반환
  return allAttempts.filter(a => completedSessionIds.has(a.sessionId));
}
```

### B-2. 주의: sessionId가 없는 attempts 처리

일부 구버전 attempts에 `sessionId`가 없을 수 있음.
→ `sessionId`가 null/undefined인 attempt는 **개별 독립 기록으로 간주, 완주 필터 적용 제외 (유지)**.

```javascript
// sessionId 없는 attempts는 필터에서 제외하지 않고 유지
allAttempts.filter(a => !a.sessionId || completedSessionIds.has(a.sessionId));
```

---

## C. 기능 1 상세 설계 — admin/statistics.html

### C-1. 추가할 UI 컴포넌트

**연도 필터 추가** (기존 `<select id="subjectFilter">` 옆에):
```html
<select id="yearFilter">
  <option value="">전체</option>
  <option value="2025">2025</option>
  <option value="2024">2024</option>
  <option value="2023">2023</option>
  ...
</select>
```

**완주 세션 토글** (체크박스):
```html
<label>
  <input type="checkbox" id="completedOnlyToggle" checked>
  완주 세션만 집계
</label>
```

**xlsx 다운로드 버튼**:
```html
<button id="downloadXlsxBtn" class="btn-download">
  📥 엑셀 다운로드 (.xlsx)
</button>
```

### C-2. xlsx 라이브러리

SheetJS (xlsx) CDN import (파일 상단 `<script>` 태그):
```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

한글 깨짐 방지: SheetJS는 UTF-8 BOM + xlsx 포맷으로 자동 처리됨.

### C-3. 테이블 출력 형태

**표시 컬럼**:

| 문제번호 | 정답률(%) | 가장 많은 오답 선택지 | 오답 선택 비율(%) | 총 응시 수 |
|---------|---------|-----------------|--------------|---------|
| 1       | 73%     | ④               | 18%          | 412명   |
| 2       | 45%     | ②               | 31%          | 398명   |
| ...     | ...     | ...             | ...          | ...     |

**정렬**: 문제번호 오름차순 (1→20 또는 1→80)

### C-4. 집계 로직 의사 코드 (admin/statistics.html 적용)

```javascript
async function loadStats() {
  // 1. 전체 attempts 다운로드 (기존 코드 유지)
  const snapshot = await getDocs(collection(db, 'attempts'));
  let allAttempts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. 완주 세션 필터 (토글 ON 시)
  if (completedOnlyToggle.checked) {
    allAttempts = filterCompletedAttempts(allAttempts);
  }

  // 3. 연도 + 과목 필터
  if (yearFilter.value) {
    allAttempts = allAttempts.filter(a => a.questionData?.year === yearFilter.value);
  }
  if (subjectFilter.value) {
    allAttempts = allAttempts.filter(a => a.questionData?.subject === subjectFilter.value);
  }

  // 4. 문제별 집계
  const questionStats = {};  // key: number (1~20 또는 1~80)
  allAttempts.forEach(attempt => {
    const num = attempt.number;
    if (!questionStats[num]) {
      questionStats[num] = { total: 0, correct: 0, choices: [0, 0, 0, 0] };
    }
    questionStats[num].total++;
    if (attempt.isCorrect) questionStats[num].correct++;
    if (attempt.userAnswer >= 0 && attempt.userAnswer <= 3) {
      questionStats[num].choices[attempt.userAnswer]++;
    }
  });

  // 5. 테이블 렌더링
  const rows = Object.entries(questionStats)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([num, stat]) => {
      const accuracy = stat.total > 0 ? Math.round(stat.correct / stat.total * 100) : 0;
      // 오답 중 가장 많이 선택된 선택지
      const wrongChoices = stat.choices.map((cnt, idx) => ({ idx, cnt }))
        .filter(c => /* 정답 선택지 제외 필요 — correctAnswer 필드 추가 필요 */);
      const topWrong = wrongChoices.sort((a, b) => b.cnt - a.cnt)[0];
      const topWrongPct = stat.total > 0 ? Math.round(topWrong.cnt / stat.total * 100) : 0;
      return { num, accuracy, topWrong: topWrong.idx + 1, topWrongPct, total: stat.total };
    });

  renderTable(rows);
}
```

**⚠️ 주의 — correctAnswer 필드 필요**:
현재 `attempts` 문서에 `correctAnswer` 필드가 있으면 (V3에서 추가됨) 오답 필터에 활용 가능.
없으면 choices 배열에서 가장 많이 선택된 선택지를 "오답 1위"로 표시 (정답도 포함될 수 있음).
→ **V3에서 추가된 `correctAnswer` 필드 있음** → 활용 가능.

### C-5. xlsx 생성 의사 코드

```javascript
function downloadXlsx(rows, subject, year) {
  const data = [
    ['문제번호', '정답률(%)', '오답 1위 선택지', '오답 1위 비율(%)', '총 응시수'],
    ...rows.map(r => [r.num, r.accuracy, `${r.topWrong}번`, r.topWrongPct, r.total])
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '문제별통계');

  const filename = `${year || '전체'}_${subject || '전과목'}_문제별통계.xlsx`;
  XLSX.writeFile(wb, filename);
}
```

---

## D. 기능 2 적용 범위 — analytics-dashboard.js

### D-1. analytics-dashboard.js 공유 구조 (확인된 사실)

`analytics-dashboard.js`는 **두 페이지가 동일 모듈을 공유**한다.

| 진입점 | 파일 | 로딩 방식 |
|--------|------|---------|
| 메인 홈 학습분석 탭 | `index.html` | `js/app.js`에서 `import('./analytics/analytics-dashboard.js')` 동적 임포트 (app.js:487, 687) |
| 독립 분석 페이지 | `analytics.html` | `<script type="module" src="js/analytics/analytics-dashboard.js">` 직접 로드 (analytics.html:1228) |
| 분석 앱 래퍼 | `js/analytics/analytics-app.js` | `import { initDashboard, loadAnalyticsData }` 정적 임포트 |

→ **`analytics-dashboard.js` 집계 로직 수정 = 두 페이지 동시 적용**. 별도 작업 불필요.

### D-2. 현재 데이터 흐름

```
loadAnalyticsData(user)  ← index.html 학습분석 탭 + analytics.html 양쪽에서 호출
  └─ getUserAttempts(uid)
       └─ Firestore: where('userId','==',uid) + where('sessionId','in',[...])
            └─ JS 메모리에 적재
  └─ state.attempts = allAttempts  ← ★ 필터 삽입 위치 1
  └─ groupBySubject(state.attempts) → 취약과목 탭
  └─ analyzeWeaknesses(state.attempts) → 약점 분석 탭
  └─ renderProgressTabStandalone(state.attempts) → 진도 탭

loadQuestionStatistics(year, subject, ...)  ← 관리자 탭에서 별도 호출
  └─ 자체 Firestore 쿼리 (where userId)
  └─ JS 집계  ← ★ 필터 삽입 위치 2
  └─ StatsCache에 저장
```

현재 `filterCompletedAttempts()` 없음 → 미완주 세션 attempts도 통계에 포함.

### D-3. 적용 범위 — UI는 건드리지 않고 집계 레이어만

**적용 위치 1**: `loadAnalyticsData()` 내 `getUserAttempts()` 직후

```javascript
// 기존 코드 (예시)
const allAttempts = await getUserAttempts(uid);
state.attempts = allAttempts;  // ← 이 줄 앞에 삽입

// 추가할 코드
state.attempts = filterCompletedAttempts(allAttempts);
// sessionId 없는 레거시 데이터는 자동 통과 (B-2 규칙)
```

이 한 줄로 하위 모든 집계 함수(취약과목, 약점분석, 진도 탭)에 완주 필터가 일괄 적용됨.
**UI 렌더링 함수는 전혀 변경하지 않는다.**

**적용 위치 2**: `loadQuestionStatistics()` 내 attempts 집계 전

```javascript
// 자체 쿼리로 가져온 attempts에 동일 필터 적용
const filtered = filterCompletedAttempts(rawAttempts);
// 이후 집계 로직은 기존 그대로
```

**적용 위치 3 (캐시 키)**: `StatsCache.generateKey()` 호출 시 `completedOnly: true` 파라미터 추가
→ 기존 캐시 데이터(미필터)와 자동 분리됨.

### D-4. 탭별 영향 범위 정리

| 탭 | 데이터 소스 | 필터 적용 여부 | UI 변경 여부 |
|----|-----------|------------|------------|
| 기록보기(history) | `state.sessions` (세션 카드) | **미적용** — 세션 목록은 완주 여부 무관하게 표시 | 없음 |
| 취약과목 | `state.attempts` | **적용** (위치 1) | 없음 |
| 약점분석 | `state.attempts` | **적용** (위치 1) | 없음 |
| 진도탭 | `state.attempts` | **적용** (위치 1) | 없음 |
| 관리자 문제통계 | `loadQuestionStatistics()` 내부 | **적용** (위치 2) | 없음 |

**기록보기 탭은 의도적으로 제외**: 세션 카드(이어풀기/다시풀기 버튼 포함)는 완주 여부와 무관하게 모든 세션을 표시하는 것이 올바른 UX.

### D-5. 사용자 대시보드 적용 효과

| 케이스 | 변경 전 | 변경 후 |
|--------|--------|--------|
| 20문제 중 10문제에서 이탈 | 10개 attempts가 정답률에 포함 → 분모 작아져 왜곡 | 해당 세션 제외 → 완주 기준 정답률 |
| 다시풀기로 같은 과목 2회 완주 | 두 세션 모두 반영 | 두 세션 모두 반영 (완주했으므로) |
| sessionId 없는 레거시 데이터 | 포함 | 포함 (예외 처리) |

---

## E. 기존 로직과의 충돌 가능성 및 해결

| 충돌 지점 | 내용 | 해결 방안 |
|---------|------|---------|
| **StatsCache 키 불일치** | 기존 캐시 키에 `completedOnly` 파라미터 없음 → 구 캐시 데이터 반환 위험 | 캐시 키에 `completedOnly: true` 추가 → 자동으로 다른 키로 분리 |
| **admin/statistics.html 기존 집계 덮어쓰기** | 기존 `renderStats()` 함수가 모든 attempts 사용 → 함수 안에 필터 삽입 시 기존 UI 영향 | 기존 함수 내부에 `if (completedOnlyToggle.checked)` 분기 삽입 — 기존 동작은 토글 OFF 시 유지 |
| **연도 필터 기준 필드** | `questionData.year` (nested) vs `year` (평탄화) — 둘 다 존재 | `attempt.year \|\| attempt.questionData?.year` 로 fallback 처리 |
| **오답 1위 계산 시 정답 포함 가능성** | `choices[0~3]` 중 가장 많은 것이 정답일 수도 있음 | `correctAnswer` 필드로 정답 선택지 제외 후 오답 1위 계산 |
| **sessionId 없는 레거시 데이터** | 완주 필터 적용 시 해당 attempts 모두 제거될 위험 | `!a.sessionId`인 경우 완주 필터 통과 (유지) 처리 |
| **모의고사 attempts 80개 기준** | 80문제 중 일부 과목만 통계 필터 시 세션 판정 오류 가능 | `isFromMockExam` 플래그로 판정, 과목 필터는 집계 단계에서만 적용 (완주 판정과 분리) |

---

## F. 수정/생성 파일 목록

| 파일 | 작업 | 변경 범위 |
|------|------|---------|
| `admin/statistics.html` | **수정** | 연도 필터 추가 / xlsx 다운로드 버튼 + 함수 / SheetJS import / filterCompletedAttempts() 삽입 / 완주 토글 UI |
| `js/analytics/analytics-dashboard.js` | **수정** | filterCompletedAttempts() 함수 추가 / loadQuestionStatistics() 내 필터 호출 / StatsCache 키에 completedOnly 파라미터 추가 |
| `plan.md` | **수정** | Plan V4 추가 (현재 작성 중) |
| `WORKSTATE.md` | **수정** | 작업 상태 업데이트 |
| `sw.js` | **수정** | CACHE_VERSION 증가 (배포 시) |

신규 생성 파일 없음.

---

## G. Phase별 Todo (실행 순서)

### Phase V4-A — filterCompletedAttempts 유틸 함수 작성
- [v] **V4-A1**: `admin/statistics.html` 스크립트 블록에 `filterCompletedAttempts(allAttempts)` 함수 추가
  - sessionId 없는 attempts는 `!a.sessionId` 조건으로 필터 통과 (유지)
  - `isFromMockExam` 기반으로 모의고사(기준 80) vs 일반(기준 20) 분기
- [v] **V4-A2**: `analytics-dashboard.js` 상단부에 동일한 `filterCompletedAttempts()` 함수 추가
  - 코드 내용은 V4-A1과 완전 동일 — 파일별 독립 선언 (공유 모듈 없음)

### Phase V4-B — admin/statistics.html UI 추가
- [v] **V4-B1**: 연도 필터 `<select id="yearFilter">` — 기존에 이미 존재 (2019~2025), 확인됨
- [v] **V4-B2**: 완주 세션 토글 `<input type="checkbox" id="completedOnlyToggle" checked>` + 라벨 추가
- [v] **V4-B3**: SheetJS CDN `<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js">` 추가
- [v] **V4-B4**: xlsx 다운로드 버튼 `<button id="downloadXlsxBtn">📥 엑셀 다운로드 (.xlsx)</button>` 추가 (조회 전에는 display:none)

### Phase V4-C — admin/statistics.html 집계 로직 수정
- [v] **V4-C1**: `loadStatistics()` 내 attempts 배열 구성 직후 완주 필터 삽입 (토글 ON 시)
- [v] **V4-C2**: 문제번호 오름차순 정렬 — `Number(a[1].number) - Number(b[1].number)` 적용
- [v] **V4-C3**: `getTopWrongAnswer(answers, correctAnswer, total)` 함수 추가 — correctAnswer 필드로 정답 제외 후 최다 오답 추출 / `calculateQuestionStats()`에 correctAnswer 저장 추가
- [v] **V4-C4**: 테이블 렌더링 — 문제번호 / 과목 / 연도 / 정답률 / 오답 1위 / 응시 수 컬럼 (상단 compact table)
- [v] **V4-C5**: `downloadXlsx()` 함수 구현 + 버튼 표시 로직 / 기존 카드 뷰는 `<details>` 토글로 lazy 렌더링

### Phase V4-D — analytics-dashboard.js 집계 필터 적용 (index.html + analytics.html 동시 적용)
- [v] **V4-D1**: `loadAnalyticsData(user)` 내 `shouldExcludeAttempt` 필터 직후에 `filterCompletedAttempts()` 호출
- [v] **V4-D2**: `loadQuestionStatistics()` 내 관리자 이메일 필터 직후 `filterCompletedAttempts()` 호출 추가
- [v] **V4-D3**: `StatsCache.generateKey()` 호출 시 `completedOnly: true` 파라미터 추가
- [v] **V4-D4**: 기록보기(history) 탭은 `state.sessions` 사용 → 완주 필터 미적용 확인 (변경 없음)

### Phase V4-E — 검증 및 배포
- [v] **V4-E1**: `bash scripts/check-syntax.sh` 통과 확인 ✅
- [v] **V4-E2**: admin/statistics.html 수동 테스트 (푸시 전 확인 완료)
- [v] **V4-E3**: analytics.html (독립 분석 페이지) 취약과목 탭 숫자 변화 확인 (푸시 전 확인 완료)
- [v] **V4-E4**: index.html 학습분석 탭 취약과목 탭 숫자 변화 확인 (푸시 전 확인 완료)
- [v] **V4-E5**: `sw.js` CACHE_VERSION 2026031004 → 2026031005
- [v] **V4-E6**: GitHub 푸시 완료 (18be985)

---

## H. 단계별 작업 우선순위 및 적용 범위 요약

```
[Phase V4-A] filterCompletedAttempts 함수 작성
  → admin/statistics.html (독립 선언)
  → analytics-dashboard.js (독립 선언)

[Phase V4-B/C] admin/statistics.html 기능 완성
  → 관리자만 사용하는 화면 — 사용자 화면 무관
  → 연도필터 + 완주토글 + 테이블 + xlsx

[Phase V4-D] analytics-dashboard.js 집계 필터 (★ 주요 범위 확장)
  → loadAnalyticsData() 수정 1줄
    ├─ index.html 학습분석 탭   ← 자동 적용
    ├─ analytics.html 분석 페이지 ← 자동 적용
    └─ 취약과목/약점분석/진도 탭  ← 자동 적용
  → loadQuestionStatistics() 수정
    └─ 관리자 탭 문제 통계       ← 적용
  → 기록보기 탭                  ← 의도적 제외 (세션 목록은 완주 무관)
  → UI 렌더링 함수               ← 변경 없음

[Phase V4-E] 검증 및 배포
```

**수정 파일 최종 목록 (업데이트)**:

| 파일 | 작업 | 변경 내용 |
|------|------|---------|
| `admin/statistics.html` | **수정** | filterCompletedAttempts / 연도필터 / 완주토글 / SheetJS / xlsx 버튼+함수 / 집계 로직 |
| `js/analytics/analytics-dashboard.js` | **수정** | filterCompletedAttempts / loadAnalyticsData 1줄 / loadQuestionStatistics 필터 / StatsCache 키 |
| `sw.js` | **수정** | CACHE_VERSION 증가 (배포 시) |
| `plan.md` | **수정** | Plan V4 업데이트 (현재) |
| `WORKSTATE.md` | **수정** | 작업 상태 업데이트 (작업 시작 시) |

신규 생성 파일 없음.

---

# Plan V5 — 기능 안정화 (로그인·퀴즈 저장·분석 데이터) 2026-03-10

## 배경
심층 분석(섹션 13)에서 발견된 🔴 심각 3건 + 🟡 주의 7건. 사용자 데이터 손실·오염 가능성 있는 항목 우선.

---

## V5 Phase별 작업

### Phase V5-A — 로그인 안정화 (🔴 1-1, 🟡 1-4)

- [v] **V5-A1**: `auth-core.js` DOMContentLoaded 폴백 추가
  - `document.readyState === 'loading'`이면 이벤트 리스너, 아니면 즉시 실행
  - `onDomReady()` 함수로 추출, `readyState` 분기로 래핑
- [v] **V5-A2**: `handleLogout()` 개선
  - 로그아웃 전 `sessionManager.currentSessionId = null` + localStorage 삭제
  - `window.userId/userEmail/isAdmin/userName = null` 정리
  - `window.location.href = '/'` 통일 (isRestrictedPage 분기 제거)

### Phase V5-B — 퀴즈 저장 실패 알림 (🔴 3-1)

- [v] **V5-B1**: `quiz-core.js` — batchRecordAttempts 결과 검사
  - `_batchFn` 단일 변수로 window/import 분기 통합
  - `result.success === false` 시 `window.showToast(...)` 경고
- [v] **V5-B2**: `mock-exam.js` — 배치 저장 실패 시 폴백 + Toast
  - `!result?.success` → throw → 기존 catch 블록의 개별 저장 폴백 트리거
  - `savedCount < total` 시 `window.showToast(...)` 경고

### Phase V5-C — 세션ID 경쟁 조건 방어 (🔴 3-3)

- [v] **V5-C1**: `session-manager.js` — `getCurrentSessionId()` defensive 패턴
  - localStorage 항상 읽어 메모리와 비교 → 불일치 시 localStorage 우선
- [v] **V5-C2**: 로그아웃 후 analytics state/cache 정리
  - V5-A2의 `window.location.href = '/'`로 전체 페이지 재로드 → 모든 메모리 state 자동 초기화
  - 별도 코드 불필요 (V5-A2에서 커버됨)

### Phase V5-D — 분석 데이터 정확도 (🔴 3-6)

- [v] **V5-D1**: `getUserAttempts()` 1000개 제한 해소
  - `startAfter()` 페이지네이션: 500개씩 최대 3000개 (6페이지)
  - `quiz-data-service.js` import에 `startAfter` 추가
  - 호출 지점 `analytics-dashboard.js:682` → `getUserAttempts(3000, ...)`
  - 홈 대시보드(`analytics-dashboard.js:1010`) → 1000 유지 (홈 화면 경량)
  - `check-syntax.sh` 통과 ✅

### Phase V5-E — 검증 및 배포

- [v] **V5-E1**: `bash scripts/check-syntax.sh` 통과 ✅
- [ ] **V5-E2**: 로컬 로그인/로그아웃 수동 테스트 (팝업, redirect, 멀티탭)
- [ ] **V5-E3**: 퀴즈 저장 실패 시뮬레이션 (네트워크 차단 → 토스트 확인)
- [ ] **V5-E4**: sw.js CACHE_VERSION 증가
- [ ] **V5-E5**: GitHub 푸시

---

# Plan W — 관리자 공지사항 조회수 목록 표시 2026-03-10

## 배경
- `viewCount` 필드는 이미 Firestore에 저장됨 (`incrementNoticeViewCount` 완성)
- `notices/detail.html`에는 관리자용 조회수 표시 있음
- **admin/notices.html 카드 목록에 조회수가 없음** — 관리자가 한눈에 인기 공지를 파악 불가

## 범위
- 파일: `js/admin/notices-admin.js` (카드 렌더링 1곳)
- UI: 카드 `card-meta` 영역에 `조회 N` 텍스트 추가 (발행된 공지만)
- 스타일: 기존 `.card-date` 옆에 인라인, 별도 CSS 불필요

## Phase W-A — 구현

- [v] **W-A1**: `notices-admin.js` `card-meta` 에 조회수 추가
  - `!n.isDraft && n.viewCount` 조건부 렌더링
```
// 변경 전
<span class="card-date">${formatSimpleDate(n.timestamp)}</span>

// 변경 후
<span class="card-date">${formatSimpleDate(n.timestamp)}</span>
${!n.isDraft && n.viewCount ? `<span class="card-view">조회 ${n.viewCount}</span>` : ''}
```

- [v] **W-A2**: `admin/notices.html` `.card-view` 스타일 추가
  - `.card-view { font-size: 11px; color: #adb5bd; }`

## Phase W-B — 검증 및 배포

- [ ] **W-B1**: admin/notices.html에서 발행된 공지 목록 조회수 표시 확인
- [ ] **W-B2**: 초안 공지에는 조회수 미표시 확인 (isDraft=true)
- [v] **W-B3**: sw.js CACHE_VERSION 증가 + GitHub 푸시

