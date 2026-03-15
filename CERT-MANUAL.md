# 자격증 추가 매뉴얼

> 새 자격증(또는 새 과목)을 추가할 때 따라야 할 단계별 체크리스트

---

## A. 새 자격증 추가 (예: 유소년스포츠지도사)

### 1단계: CERT_REGISTRY 등록
**파일:** `js/utils/certificate-utils.js`

```js
// CERT_REGISTRY에 객체 추가
'youth-instructor': {
  name: '유소년스포츠지도사',
  shortName: '유소년',
  emoji: '👶',
  color: { primary: '#F59E0B', dark: '#D97706', light: '#FBBF24' },
  folderSuffix: '-youth',       // 폴더 접미사
  hasSessionSplit: false,       // 교시 구분 여부
  subjects: {
    all: ['유아체육론', '스포츠심리학', ...]  // 교시 없으면 all
    // session1: [...], session2: [...]      // 교시 있으면 이렇게
  },
  years: [2024, 2025],
  examDuration: 100,
  questionsPerSubject: 20,
  passCriteria: { perSubject: 40, total: 60 }
}
```

### 2단계: 색상 등록 (3곳)
1. `index.html` — `changeThemeColor()` 함수의 colors 객체에 추가
2. `js/linear-header.js` — `certNames` + `certColors` 객체 (2곳: 클래스 내부 + 전역 함수)

### 3단계: index.html UI (3곳)
1. **cert-button 추가** (라인 420 부근)
   ```html
   <button class="cert-button" data-cert="youth-instructor">유소년스포츠지도사</button>
   ```

2. **cert-content 블록 추가** (기존 cert-content 블록 아래)
   - 과목별 탭: 과목 링크 (`subjects-youth/subject_과목명.html`)
   - 연도별 탭: 연도 링크 (`years-youth/year_YYYY.html`)

3. **학습분석 자격증 필터 드롭다운에 option 추가** (`set-cert-filter` select)
   ```html
   <option value="youth">유소년스포츠지도사</option>
   ```

### 4단계: CSS 모바일 대응
**파일:** `css/cert-selector.css`
- 4개 이상 버튼이면 `flex-wrap` + `nth-child` 규칙 수정 필요

### 5단계: 폴더 생성
```
exam-youth/              # 기출문제 HTML
subjects-youth/          # 과목별 페이지
  └── images/
years-youth/             # 연도별 페이지
data/youth/              # JSON 문제 데이터
images-youth/            # 문제 이미지
```

### 6단계: HTML 파일 생성
기존 exam-sports1/ 파일을 템플릿으로 복제 후 치환:
- `sports1` → `youth` (폴더 접미사)
- `1급 스포츠지도사` → `유소년스포츠지도사`
- `#7C3AED` → 새 색상
- `window.QUIZ_DATA_FOLDER = 'sports1'` → `window.QUIZ_DATA_FOLDER = 'youth'`
- 과목명/연도 치환

**필수: 모든 HTML `<head>`에 localStorage 즉시 설정 포함할 것!**
```html
<script>
  window.QUIZ_DATA_FOLDER = 'youth';
  localStorage.setItem('currentCertificateType', 'youth-instructor');
</script>
```
이게 없으면 헤더 배지가 이전 자격증으로 표시되는 버그 발생.
subjects-{suffix}/, years-{suffix}/ HTML에도 동일하게 추가:
```html
<script>localStorage.setItem('currentCertificateType', 'youth-instructor');</script>
```

### 7단계: 학습분석 대응
**파일:** `js/analytics/analytics-dashboard.js`
- `CERT_SHORT_MAP`에 추가: `'youth': 'youth-instructor'`
- `CERT_LABEL_MAP`에 추가: `'youth': '유소년스포츠지도사'`
- 삭제 버튼 배열에 추가: `['health', 'sports', 'sports1', 'youth']`
- `SPORTS1_SUBJECTS` 옆에 새 과목 상수 추가 (renderQuestionSetsTab 내부):
  ```js
  const YOUTH_SUBJECTS = ['유아체육론', '스포츠심리학', ...];
  ```
- `updateSubjectOptions()` 함수에 조건 추가:
  ```js
  if (cert === 'all' || cert === 'youth') { /* 과목 그룹 추가 */ }
  ```

**파일:** `js/analytics/render-progress-tab-function.js`
- 1급처럼 연도/카테고리/과목 상수 정의하고 `renderProgressTabStandalone()`에 분기 추가

### 8단계: 북마크/오답노트
**파일:** `js/quiz/bookmark-ui.js`, `js/quiz/wrong-note-ui.js`
- 탭 버튼에 새 자격증 추가

### 9단계: SW 캐시 버전 업
**파일:** `sw.js`
- `CACHE_VERSION` 숫자 증가

---

## B. 기존 자격증에 새 과목 추가

### 1단계: CERT_REGISTRY 과목 배열 수정
**파일:** `js/utils/certificate-utils.js`
- 해당 자격증의 `subjects` 배열에 과목명 추가

### 2단계: 파일 생성
- `exam-{suffix}/{YEAR}_{과목명}.html` — 기존 파일 복제 후 과목명 치환
- `subjects-{suffix}/subject_{과목명}.html`
- `data/{folder}/{YEAR}_{과목명}.json` — placeholder 또는 실제 데이터
- 이미지 폴더: `images-{suffix}/{YEAR} {과목명}/`

### 3단계: index.html cert-content 수정
- 과목별 탭에 새 과목 링크 추가

### 4단계: 연도별 페이지 수정
- `years-{suffix}/year_{YEAR}.html`에 새 과목 항목 추가

---

## C. 기존 자격증에 새 연도 추가

### 1단계: CERT_REGISTRY years 배열 수정
**파일:** `js/utils/certificate-utils.js`
- 해당 자격증의 `years` 배열에 연도 추가 (예: `2026`)

### 2단계: 파일 생성
- `exam-{suffix}/{YEAR}_{과목명}.html` — 각 과목별 기출문제 HTML
- `years-{suffix}/year_{YEAR}.html` — 연도별 페이지
- `data/{folder}/{YEAR}_{과목명}.json` — 문제 데이터

### 3단계: index.html 연도별 탭 수정
- cert-content 블록의 연도별 탭에 새 연도 링크 추가

### 4단계: 과목별 페이지 수정
- `subjects-{suffix}/subject_{과목명}.html`에 새 연도 항목 추가

---

## D. JSON 데이터 형식

```json
[
  {
    "id": 1,
    "questionImage": "images-{suffix}/{YEAR} {과목명}/문제 (1).png",
    "correctAnswer": 0,
    "explanation": "정답 해설 텍스트. <br/>HTML 태그 사용 가능."
  },
  ...
  // id 1~20 (과목당 20문제)
]
```

- `correctAnswer`: 0~3 (1번~4번 선택지)
- `questionImage`: 상대 경로 (exam HTML 기준이 아닌 프로젝트 루트 기준)
- `explanation`: HTML 지원 (`<br/>`, `<b>` 등)

---

## E. 이미지 폴더 구조

```
images-{suffix}/
└── {YEAR} {과목명}/
    ├── 문제 (1).png
    ├── 문제 (2).png
    └── ... (문제 (20).png까지)
```

---

## F. 데이터 흐름 요약

```
사용자 클릭
  → exam-{suffix}/{YEAR}_{과목}.html
  → window.QUIZ_DATA_FOLDER = '{folder}'
  → quiz-core.js: fetch('../data/{folder}/{YEAR}_{과목}.json')
  → JSON의 questionImage 경로로 이미지 로드
  → 답안 제출 시 certificateType 자동 감지 (경로 기반)
  → Firestore에 저장
  → 학습분석에서 certificateType으로 필터링
```

---

## G. 놓치기 쉬운 버그 방지 (필독)

### 헤더 배지 덮어쓰기 방지
- `linear-header.js`의 `updateCertificateBadge()`는 경로 기반 감지 포함됨
- 하지만 **모든 HTML `<head>`에 localStorage 즉시 설정 필수**
- 누락 시 증상: 문제 페이지 진입 시 배지가 "건강운동관리사"로 변경됨

### 북마크 자격증 간 충돌 방지
- `bookmark-service.js`의 `isBookmarked()`는 certType으로 필터링함
- 과목명이 같은 자격증이 있으면 (예: 운동상해 — 건운사 vs 1급) 반드시 certType 구분 필요
- `quiz-core.js`에서 `isBookmarked()` 호출 시 certType 전달 중

### 경로 감지 순서
- `-sports1/`를 `-sports/`보다 **먼저** 매칭해야 함 (긴 접미사 우선)
- `certificate-utils.js`, `linear-header.js`, `mock-exam.js`, `quiz-core.js`, `quiz-data-recorder.js`, `session-manager.js` 모두 이 규칙 적용됨
- 새 접미사가 기존 접미사의 prefix이면 충돌 (예: `-sport` vs `-sports`) — 피할 것

---

## H. 체크리스트 (새 자격증)

- [ ] `certificate-utils.js` CERT_REGISTRY 등록
- [ ] `index.html` changeThemeColor colors 추가
- [ ] `linear-header.js` certNames/certColors 추가 (2곳: 클래스 내부 + 전역 함수)
- [ ] `index.html` cert-button 추가
- [ ] `index.html` cert-content 블록 추가
- [ ] `cert-selector.css` 모바일 대응 확인
- [ ] 폴더 5개 생성 (exam, subjects, years, data, images)
- [ ] exam HTML 생성 (과목수 x 연도수) — **localStorage 설정 포함**
- [ ] subject HTML 생성 (과목수) — **localStorage 설정 포함**
- [ ] year HTML 생성 (연도수) — **localStorage 설정 포함**
- [ ] data JSON 생성 (과목수 x 연도수)
- [ ] `index.html` 학습분석 자격증 필터 드롭다운(`set-cert-filter`)에 option 추가
- [ ] `analytics-dashboard.js` CERT_SHORT_MAP, CERT_LABEL_MAP, 삭제 버튼 배열 추가
- [ ] `analytics-dashboard.js` 과목 상수 추가 + `updateSubjectOptions()` 조건 추가
- [ ] `render-progress-tab-function.js` 연도/카테고리/과목 상수 + 분기 추가
- [ ] `bookmark-ui.js` 탭 버튼 추가
- [ ] `wrong-note-ui.js` 탭 버튼 추가
- [ ] `sw.js` CACHE_VERSION 증가
- [ ] 이미지 업로드
- [ ] **테스트: 배지 표시 확인** (페이지 진입 시 올바른 자격증명)
- [ ] **테스트: 북마크 격리 확인** (다른 자격증 북마크 안 보이는지)
- [ ] **테스트: 학습분석 필터링** (해당 자격증 데이터만 표시되는지)
