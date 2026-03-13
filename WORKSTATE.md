# 현재 작업 상태 (WORKSTATE)

> 마지막 업데이트: 2026-03-13
> 이 파일은 클로드 세션이 바뀌어도 작업을 이어받을 수 있도록 항상 최신 상태로 유지한다.

---

## 지금 하고 있는 것

mock-exam.js ESM 전환 완료

---

## 프로젝트 정비 플랜

### Phase 1: 안전한 정리 (부작용 제로)

#### Step 1.1: 고아 파일 삭제 [v]
- [v] `js/mockexam.js` 삭제
- [v] `netlify.toml` 삭제

#### Step 1.2: 깨진 링크 수정 [v]
- [v] `lecture-purchase.html:192` — `refund-policy.html` → `terms.html` 변경

#### Step 1.3: analytics-loader.js 삭제 [v]
- [v] `js/analytics/analytics-loader.js` 삭제

#### Step 1.4: analytics.html 삭제 + 참조 리다이렉트 [v]
- [v] `exam/quiz.html` 2곳 → `../index.html#analytics-tab`으로 변경
- [v] `analytics.html` 삭제
- [v] `sitemap.xml` — analytics 항목 없었음 (확인 완료)

#### Step 1.5: lectures.html 삭제 + 참조 정리 [v]
- [v] `js/linear-header.js` — 푸터 강의 링크 → `/#lecture-tab`
- [v] `sitemap.xml` — lectures.html + refund-policy.html + contact.html 제거
- [v] `lectures.html` 삭제

---

### Phase 2: isAdmin() 통합 (의존성 검증 완료) [v]

---

### Phase 3: certType 정규화 (방어적) [v]

---

### Phase 4: 안정성 개선 [v]

---

### Phase 5: 새 기능 [v]

---

### Phase 6: mock-exam.js ESM 전환 [v]

#### Step 6.1: IIFE → ESM 변환 [v]
- [v] IIFE 래퍼 제거 + 전체 코드 unindent
- [v] static import 추가 (firebase-core.js, firebase-firestore.js)
- [v] dynamic import 3곳 제거 (static import로 대체)
- [v] deprecated `restorePreviousAnswersForMockExam()` 삭제
- [v] `window._testKeyQ/W` → 로컬 변수
- [v] legacy `firebase.auth()` 폴백 → modular `auth?.currentUser` 교체
- [v] devMode `window.*` 디버깅 노출 6개 삭제

#### Step 6.2: HTML onclick → data-option + 이벤트 위임 [v]
- [v] 14개 모의고사 HTML: `onclick="selectOption(N)"` → `data-option="N"`
- [v] 14개 HTML: selectOption 폴백 함수 제거
- [v] mock-exam.js: option-buttons 이벤트 위임 추가
- [v] mock-exam.js: results-summary 이벤트 위임 추가 (reviewQuiz, goHomeAfterSave, reviewSubjectIncorrect)

#### Step 6.3: window.* 전역 노출 전부 제거 [v]
- [v] window.selectOption 등 10개 함수 노출 삭제
- [v] window.incorrectIndices/incorrectGlobalIndices/currentIncorrectIndex → 모듈 변수
- [v] window.originalNextFunction/originalPrevFunction → 모듈 변수
- [v] window.subjectColors → 모듈 변수
- [v] window.perQuestionChecked → 모듈 변수
- [v] innerHTML onclick → data-action 속성으로 전환

#### Step 6.4: 고아 파일 삭제 + 배포 준비 [v]
- [v] `js/exam/mock-exam-page.js` 삭제
- [v] `sw.js` CACHE_VERSION 증가 (2026031304 → 2026031305)
- [v] HTML script 태그 캐시 버스팅 업데이트 (v=2026031305)
- [v] `bash scripts/check-syntax.sh` 통과

---

## 실행 규칙

1. 각 Step 완료 → `bash scripts/check-syntax.sh` 실행
2. Phase 단위로 커밋 + 푸시
3. 의심스러우면 건너뛰기 — 추측으로 수정 금지
4. 각 Step에서 변경 파일 정확히 기록

---

## 주요 파일 주의사항

- mock-exam.js (ESM 3546줄): IIFE→ESM 전환 완료 (2026-03-13). window.* 200개+ → 48개(외부 모듈 읽기만)
- analytics-dashboard.js (2500줄+): 단일 책임 위반이지만 현재 안정적. 분리는 향후 과제.
- filterCompletedAttempts: admin/statistics.html과 analytics-dashboard.js 독립 선언 (의도적)
- getUserAttempts: quiz-data-service.js — MAX_FETCH=3000 (홈은 1000)
