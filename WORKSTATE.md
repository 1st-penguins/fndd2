# 현재 작업 상태 (WORKSTATE)

> 마지막 업데이트: 2026-03-11
> 이 파일은 클로드 세션이 바뀌어도 작업을 이어받을 수 있도록 항상 최신 상태로 유지한다.

---

## 지금 하고 있는 것

프로젝트 정비 플랜 실행 (심층 분석 기반)

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

### Phase 2: isAdmin() 통합 (의존성 검증 완료)

#### 현재 상태 (검증 결과)
| 위치 | 사용처 | toLowerCase | devMode |
|------|--------|------------|---------|
| auth-utils.js ★ | 12곳+ (auth-core, admin pages, notices 등) | X | O |
| admin-utils.js | pdf-download.html, lectures.html (2곳만) | O | X |
| app.js (로컬) | app.js 내부 3곳 | X | X |

#### Step 2.1: auth-utils.js에 toLowerCase() 추가 [v]
- [v] isAdmin() 내부에 `.toLowerCase()` 추가

#### Step 2.2: pdf-download.html import 경로 변경 [v]
- [v] `pdf-download.html` → `./js/auth/auth-utils.js`로 변경
- (lectures.html은 Phase 1에서 삭제됨)

#### Step 2.3: app.js 로컬 isAdmin() → import 교체 [v]
- [v] import 추가, 로컬 함수+ADMIN_EMAILS 삭제. 호출부 3곳 호환 확인.

#### Step 2.4: admin-utils.js 삭제 [v]
- [v] 참조 0건 확인 후 삭제

#### Step 2.5: ADMIN_EMAILS 중복 제거 [v]
- [v] mock-exam.js → `window.ADMIN_EMAILS` 사용
- [v] search-by-tags.html → `isAdmin(user)` import로 교체
- [v] 최종 확인: firebase-core.js 1곳만 남음

---

### Phase 3: certType 정규화 (방어적)

#### 현재 불일치 (검증 결과)
- sessions: `certType = 'health'/'sports'`
- attempts: `certificateType = 'health-manager'/'sports-instructor'` + `certType = 'health'/'sports'`
- UI 필터: `'health'/'sports'` (sessions 기준)
- certificate-utils: `'health-manager'/'sports-instructor'` (attempts 기준)
- **현재 각 맥락에서 정상 작동 중** — 급히 변경 불필요

#### Step 3.1: session-manager.js에 certificateType 필드 추가 저장 [v]
- [v] 세션 생성 시 `certificateType` 필드도 함께 저장
  - 기존 `certType` 유지 (하위 호환) + `certificateType` 추가 (정규화)

---

### Phase 4: 안정성 개선

#### Step 4.1: StatsCache 즉시 무효화 [v]
- [v] session-manager.js endSession()에서 window.StatsCache.clear() 호출 추가

#### Step 4.2: 즉시 필터 (UX 개선) [v]
- [v] 4개 select에 change 이벤트 → debounce 300ms → applyCurrentFilters()
- [v] "적용" 버튼도 그대로 유지 (접근성)

---

### Phase 5: 새 기능 (별도 판단)
1. 틀린 문제 다시 풀기
2. 학습 스트릭 (dailyVisitors 활용)
3. 과목별 트렌드 차트
4. 다크모드 수동 토글

---

## 실행 규칙

1. 각 Step 완료 → `bash scripts/check-syntax.sh` 실행
2. Phase 단위로 커밋 + 푸시
3. 의심스러우면 건너뛰기 — 추측으로 수정 금지
4. 각 Step에서 변경 파일 정확히 기록

---

## 주요 파일 주의사항

- mock-exam.js (IIFE 3518줄): window.* 200개+ 노출. ESM 전환은 장기 과제. 건드리지 말 것.
- analytics-dashboard.js (2500줄+): 단일 책임 위반이지만 현재 안정적. 분리는 Phase 5 이후.
- filterCompletedAttempts: admin/statistics.html과 analytics-dashboard.js 독립 선언 (의도적)
- getUserAttempts: quiz-data-service.js — MAX_FETCH=3000 (홈은 1000)
