# Plan: 1급 스포츠지도사 추가 및 다자격증 확장 설계

> 작성일: 2026-03-15 (v4 — 최종 확정)
> 목표: 3번째 자격증(1급 스포츠지도사) 추가 + 향후 N개 자격증 확장 가능한 구조
> 상태: **승인 대기 중**

---

## 체육지도자 자격증 시험 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│ 1급 (10:00~11:20, 80분, 필수 4과목, 교시 없음)                    │
│                                                                 │
│  공통 필수 3과목: 운동상해 · 체육측정평가론 · 트레이닝론            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│  │ 전문     │  │ 생활 ✅  │  │ 장애인       │                   │
│  │+스포츠   │  │+건강     │  │+장애인스포츠 │                   │
│  │ 영양학   │  │ 교육론   │  │ 론           │                   │
│  └──────────┘  └──────────┘  └──────────────┘                   │
├─────────────────────────────────────────────────────────────────┤
│ 2급 (선택 5과목 / 장애인·유소년·노인은 필수1+선택4)               │
│                                                                 │
│  선택 과목 풀 (7개):                                              │
│  스포츠심리학 · 운동생리학 · 스포츠사회학 · 운동역학               │
│  스포츠교육학 · 스포츠윤리 · 한국체육사                           │
│  ┌──────┐ ┌──────┐ ┌────────────┐ ┌────────┐ ┌──────┐          │
│  │전문  │ │생활✅│ │장애인      │ │유소년  │ │노인  │          │
│  │5선택 │ │5선택 │ │필수:특수   │ │필수:유아│ │필수: │          │
│  │      │ │      │ │체육론+4선택│ │체육론  │ │노인  │          │
│  │      │ │      │ │            │ │+4선택  │ │체육론│          │
│  └──────┘ └──────┘ └────────────┘ └────────┘ └──────┘          │
├─────────────────────────────────────────────────────────────────┤
│ 건강운동관리사 ✅ (별도 체계, 8과목, 1교시/2교시)                  │
└─────────────────────────────────────────────────────────────────┘

✅ = 현재 구현됨/이번에 추가
```

### 합격 기준 (전 자격증 공통)
- **과목당:** 만점의 40% 이상 (20문제 기준 → 8문제 이상)
- **전체:** 총점의 60% 이상

### 이번 구현 범위
- **1급 스포츠지도사** (전문·생활·장애인 통합, 6과목 전체 제공)
- 공통 3과목 + 고유 3과목 → 응시자가 자신의 유형에 맞는 4과목 학습
- 기출문제·이미지 6과목 전부 준비됨 (2021~2025)

---

## 확정 사항

| 항목 | 결정 |
|------|------|
| 자격증 키 | `sports-instructor-1` |
| 표시명 | 1급 스포츠지도사 (전문·생활·장애인 통합) |
| 과목 | 6과목 전체 제공 (공통3 + 전문1 + 생활1 + 장애인1) |
| 공통 필수 | 운동상해, 체육측정평가론, 트레이닝론 |
| 고유 과목 | 스포츠영양학(전문), 건강교육론(생활), 장애인스포츠론(장애인) |
| 교시 구분 | 없음 — 80분 통합 |
| 과목당 문제 수 | 20문제 |
| 합격 기준 | 과목 40% + 전체 60% |
| 폴더 접미사 | `-sports1` |
| 모바일 UI | 줄바꿈 (`flex-wrap`) |
| 색상 | 보라 (`#7C3AED` / `#6D28D9` / `#8B5CF6`) |
| 연도 범위 | 2021 ~ 2025 (5개년) |
| 이미지 | 준비 완료, 미업로드 |
| Firestore | 학습분석용 인덱스 추가 |

### 과목 코드
| 과목 | 코드 | 소속 |
|------|------|------|
| 스포츠영양학 | 00 | 1급 전문 고유 |
| 운동상해 | 11 | 공통 필수 |
| 체육측정평가론 | 22 | 공통 필수 |
| 트레이닝론 | 33 | 공통 필수 |
| 건강교육론 | 44 | 1급 생활 고유 |
| 장애인스포츠론 | 55 | 1급 장애인 고유 |

### 과목명 중복 (자격증 간)
| 과목명 | 중복 자격증 | 분리 방법 |
|--------|-----------|----------|
| 운동상해 | 건강운동관리사 | `certificateType` 필드 |
| 체육측정평가론 | 2급 스포츠지도사 | `certificateType` 필드 |

---

## Phase 0: CERT_REGISTRY 중앙 레지스트리

### 문제점
```js
// 현재: 하드코딩 if-else (2개만 지원)
if (type !== 'health-manager' && type !== 'sports-instructor') { return; }
```

### 해결: 레지스트리 패턴

**수정 파일:** `js/utils/certificate-utils.js`

```pseudo
const CERT_REGISTRY = {
  'health-manager': {
    name: '건강운동관리사',
    shortName: '건운사',
    emoji: '🏋️',
    color: { primary: '#1D2F4E', dark: '#162740', light: '#2a4570' },
    folderSuffix: '',
    hasSessionSplit: true,      // 1교시/2교시 분리
    subjects: {
      session1: ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'],
      session2: ['운동상해', '기능해부학', '병태생리학', '스포츠심리학']
    },
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
    examDuration: 80,
    passCriteria: { perSubject: 40, total: 60 }
  },

  'sports-instructor': {
    name: '2급 스포츠지도사',
    shortName: '2급스포츠',
    emoji: '⚽',
    color: { primary: '#059669', dark: '#047857', light: '#10b981' },
    folderSuffix: '-sports',
    hasSessionSplit: true,
    subjects: {
      session1: ['스포츠사회학', '스포츠윤리', '스포츠심리학', '운동생리학'],
      session2: ['운동역학', '체육측정평가론', '한국체육사', '스포츠교육학']
    },
    years: [2024, 2025],
    examDuration: 80,
    passCriteria: { perSubject: 40, total: 60 }
  },

  'sports-instructor-1': {
    name: '1급 스포츠지도사',
    shortName: '1급',
    emoji: '🏅',
    color: { primary: '#7C3AED', dark: '#6D28D9', light: '#8B5CF6' },
    folderSuffix: '-sports1',
    hasSessionSplit: false,     // 교시 구분 없음
    subjects: {
      all: ['운동상해', '체육측정평가론', '트레이닝론', '스포츠영양학', '건강교육론', '장애인스포츠론']
    },
    subjectCodes: {
      '스포츠영양학': '00', '운동상해': '11', '체육측정평가론': '22',
      '트레이닝론': '33', '건강교육론': '44', '장애인스포츠론': '55'
    },
    questionsPerSubject: 20,
    years: [2021, 2022, 2023, 2024, 2025],
    examDuration: 80,
    passCriteria: { perSubject: 40, total: 60 }
  }
};
```

### 리팩터링할 함수

```pseudo
// 모든 함수에서 하드코딩 제거 → CERT_REGISTRY 참조

getCertificateName(type)     → CERT_REGISTRY[type]?.name || '알 수 없음'
getCertificateNameKo(type)   → 통합 (중복 함수 제거)
getCertificateEmoji(type)    → CERT_REGISTRY[type]?.emoji || '📚'
setCertificateType(type)     → if (!CERT_REGISTRY[type]) return
getAllCertTypes()             → Object.keys(CERT_REGISTRY)
getCertificateColor(type)    → CERT_REGISTRY[type]?.color

// 폴더 헬퍼 (신규)
getFolder(type, prefix)      → prefix + (CERT_REGISTRY[type]?.folderSuffix || '') + '/'
  예: getFolder('sports-instructor-1', 'exam')  → 'exam-sports1/'
  예: getFolder('sports-instructor-1', 'data')  → 'data-sports1/'

// 전체 과목 목록 (교시 유무 대응)
getAllSubjects(type):
  config = CERT_REGISTRY[type]
  if config.hasSessionSplit:
    return [...config.subjects.session1, ...config.subjects.session2]
  else:
    return config.subjects.all

// 경로 감지 — 접미사 길이 내림차순 (핵심!)
detectCertFromPath(path):
  entries = Object.entries(CERT_REGISTRY)
    .filter(([_, c]) => c.folderSuffix !== '')
    .sort((a, b) => b[1].folderSuffix.length - a[1].folderSuffix.length)
  // '-sports1'을 '-sports'보다 먼저 매칭
  for (certType, config) of entries:
    if path.includes(config.folderSuffix + '/'):
      return certType
  return null
```

**Trade-off:**
- ✅ 새 자격증 = 레지스트리 객체 1개 추가
- ✅ if-else 완전 제거
- ✅ 향후 2급 장애인, 유소년, 노인 등 추가 용이
- ⚠️ 기존 코드 전체 리팩터링 (영향 범위 큼, 꼼꼼한 테스트 필요)
- ⚠️ `-sports` vs `-sports1` 매칭 순서 중요 → 길이 내림차순으로 해결

---

## Phase 1: 폴더/파일 구조 생성

### 생성할 구조
```
exam-sports1/                       # 기출문제
├── quiz.html                       # 퀴즈 엔진 페이지
├── 2021_운동상해.html              # 5년 × 6과목 = 30개
├── 2021_체육측정평가론.html
├── 2021_트레이닝론.html
├── 2021_스포츠영양학.html
├── 2021_건강교육론.html
├── 2021_장애인스포츠론.html
├── 2022_운동상해.html ... (동일 패턴)
├── 2025_장애인스포츠론.html
├── 2021_모의고사.html              # 교시 없음, 연도당 1개 = 5개
├── 2022_모의고사.html
├── 2023_모의고사.html
├── 2024_모의고사.html
└── 2025_모의고사.html

subjects-sports1/                   # 과목별 페이지 = 6개
├── subject_운동상해.html
├── subject_체육측정평가론.html
├── subject_트레이닝론.html
├── subject_스포츠영양학.html
├── subject_건강교육론.html
├── subject_장애인스포츠론.html
└── images/

years-sports1/                      # 연도별 페이지 = 5개
├── year_2021.html
├── year_2022.html
├── year_2023.html
├── year_2024.html
└── year_2025.html

data-sports1/                       # JSON 문제 데이터 = 30개
├── 2021_운동상해.json
├── ... (5년 × 6과목)
└── 2025_장애인스포츠론.json

images-sports1/                     # 문제 이미지 (준비됨, 업로드 대기)
├── 2021 운동상해/
├── ... (5년 × 6과목)
```

### 파일 수량
| 종류 | 수량 |
|------|------|
| exam HTML (과목별) | 30 |
| exam HTML (모의고사) | 5 |
| quiz.html | 1 |
| subject HTML | 6 |
| year HTML | 5 |
| data JSON | 30 |
| **합계** | **77** |

### 생성 전략
- 기존 `exam-sports/` 파일을 템플릿으로 복제 → 과목명/경로 치환
- JSON은 문제 데이터 입력 필요 (별도 작업)

---

## Phase 2: index.html + CSS

### 2-1. 자격증 선택 버튼 추가

**수정 파일:** `index.html` (라인 420-427)

```html
<!-- After -->
<div class="cert-selector">
  <button class="cert-button active" data-cert="health-manager">건강운동관리사</button>
  <button class="cert-button" data-cert="sports-instructor">2급 스포츠지도사</button>
  <button class="cert-button" data-cert="sports-instructor-1">1급 스포츠지도사</button>
</div>
```

### 2-2. CSS 모바일 줄바꿈

**수정 파일:** `css/cert-selector.css`

```css
/* 기존 480px 미디어쿼리 수정 */
@media (max-width: 480px) {
  .cert-selector {
    flex-wrap: wrap;
    border-radius: 12px;
    width: calc(100% - 32px);
    gap: 3px;
  }
  .cert-button {
    flex: 1 1 calc(50% - 4px);   /* 2열 배치 */
    text-align: center;
    font-size: 12px;
    padding: 8px 6px;
    min-height: 38px;
    border-radius: 8px;
  }
  .cert-button:nth-child(3) {
    flex: 1 1 100%;               /* 3번째는 전체 폭 */
  }
}
```

**레이아웃 시각화 (모바일):**
```
┌──────────────────────────────┐
│ [건강운동관리사] [2급 생활..] │   ← 상단 2열
│ [    1급 스포츠지도사   ] │   ← 하단 전체폭
└──────────────────────────────┘
```

### 2-3. cert-content 블록 추가

**수정 파일:** `index.html`

```pseudo
<div class="cert-content" data-cert-content="sports-instructor-1">
  <!-- 과목별 탭 (6과목) -->
  <div class="access-tab-content" data-tab="subject">
    <div class="subject-grid">
      <!-- 공통 필수 3과목 -->
      <a href="subjects-sports1/subject_운동상해.html">운동상해</a>
      <a href="subjects-sports1/subject_체육측정평가론.html">체육측정평가론</a>
      <a href="subjects-sports1/subject_트레이닝론.html">트레이닝론</a>
      <!-- 고유 과목 3개 (전문/생활/장애인) -->
      <a href="subjects-sports1/subject_스포츠영양학.html">스포츠영양학</a>
      <a href="subjects-sports1/subject_건강교육론.html">건강교육론</a>
      <a href="subjects-sports1/subject_장애인스포츠론.html">장애인스포츠론</a>
    </div>
  </div>

  <!-- 연도별 탭 -->
  <div class="access-tab-content" data-tab="year">
    2025년 ~ 2021년 (5개 링크)
  </div>

  <!-- 모의고사 탭 (교시 없음 → 연도당 1개) -->
  <div class="access-tab-content" data-tab="mock">
    2025 모의고사 ~ 2021 모의고사 (5개 링크)
  </div>
</div>
```

### 2-4. changeThemeColor() 리팩터링

```pseudo
// Before: if/else 2개
// After:
function changeThemeColor(certType):
  color = CERT_REGISTRY[certType]?.color || CERT_REGISTRY['health-manager'].color
  root.style.setProperty('--cert-primary', color.primary)
  root.style.setProperty('--cert-primary-dark', color.dark)
  root.style.setProperty('--cert-primary-light', color.light)
```

---

## Phase 3: 헤더 배지

**수정 파일:** `js/linear-header.js` (라인 404-446)

```pseudo
// Before: 삼항 연산자 2개 분기
// After:
certName = CERT_REGISTRY[certType]?.shortName || '건운사'
certColor = CERT_REGISTRY[certType]?.color.primary || '#1D2F4E'
```

---

## Phase 4: 경로 감지

**수정 파일:** `js/utils/certificate-utils.js`

```pseudo
getCurrentCertificateType():
  1. URL 파라미터 (?cert=sports-instructor-1)
  2. 경로 기반 (folderSuffix 길이 내림차순 매칭)
     // '-sports1/' → sports-instructor-1 (먼저!)
     // '-sports/'  → sports-instructor     (나중)
  3. localStorage (CERT_REGISTRY에 존재하는 값만 허용)
  4. 기본값 'health-manager'
```

---

## Phase 5: mock-exam.js (모의고사)

**수정 파일:** `js/quiz/mock-exam.js`

### 교시 없는 모의고사 처리

```pseudo
// 핵심 분기: hasSessionSplit 플래그
config = CERT_REGISTRY[certType]

if config.hasSessionSplit:
  // 기존 로직: 1교시/2교시 선택, 과목 4개씩
  subjects = config.subjects['session' + selectedSession]
else:
  // 신규 로직: 전체 과목 한 번에
  subjects = config.subjects.all
  // 모의고사 파일명: YYYY_모의고사.html (교시 접미사 없음)

// 합격 판정 (모든 자격증 공통)
passCriteria = config.passCriteria  // { perSubject: 40, total: 60 }
isPass = allSubjects >= 40% && total >= 60%
```

### 6과목 모의고사 UI 고려
- 건운사/2급: 4과목씩 → 모의고사 결과 카드 4개
- 1급: 6과목 → 결과 카드 6개
- 그리드 레이아웃이 과목 수에 맞게 동적이어야 함

### 모의고사 파일 (교시 없음)
```
exam-sports1/2021_모의고사.html  (5개)
exam-sports1/2022_모의고사.html
exam-sports1/2023_모의고사.html
exam-sports1/2024_모의고사.html
exam-sports1/2025_모의고사.html
```

---

## Phase 6: Firestore + 학습분석

### 6-1. 데이터 저장
- `certificateType: 'sports-instructor-1'` → 스키마 변경 불필요
- 기존 `filterByCertificateType()` 자동 대응

### 6-2. Firestore 복합 인덱스 추가

```
컬렉션: attempts
  → userId (ASC) + certificateType (ASC) + timestamp (DESC)

컬렉션: mockExamResults
  → userId (ASC) + certificateType (ASC) + timestamp (DESC)
```

**이유:** 자격증 3개 + 데이터 증가 → 클라이언트 필터링 비효율
**효과:** 서버 측 필터링으로 Firestore 읽기 횟수 절감

### 6-3. 학습분석 합격 판정

```pseudo
// analytics에서 모의고사 결과 표시 시 합격/불합격 판정
config = CERT_REGISTRY[certType]
criteria = config.passCriteria

subjectPass = every subject score >= (20 * criteria.perSubject / 100)  // 8문제
totalPass = totalScore >= (totalQuestions * criteria.total / 100)
isPass = subjectPass && totalPass
```

---

## Phase 7: SW 캐시

**수정 파일:** `sw.js`
- `CACHE_VERSION` 증가만 → 기존 전략이 새 폴더 자동 처리

---

## 실행 순서

```
Phase 0  CERT_REGISTRY 구축 + 함수 리팩터링          ← 🔑 최우선
Phase 1  폴더 구조 생성 (77개 파일)
Phase 2  index.html + cert-selector.css
Phase 3  linear-header.js 배지
Phase 4  경로 감지 (certificate-utils.js)
Phase 5  mock-exam.js (교시 없는 모의고사)
Phase 6  Firestore 인덱스 + 학습분석
Phase 7  SW 캐시 버전 업
```

---

## 수정 파일 전체 목록

| 파일 | Phase | 변경 |
|------|-------|------|
| `js/utils/certificate-utils.js` | 0, 4 | CERT_REGISTRY, 함수 리팩터링, 경로 감지 |
| `index.html` | 2 | cert-button·cert-content 추가, changeThemeColor |
| `css/cert-selector.css` | 2 | 3버튼 모바일 줄바꿈 |
| `js/linear-header.js` | 3 | 배지 → 레지스트리 기반 |
| `js/quiz/mock-exam.js` | 5 | hasSessionSplit 분기, 6과목 모의고사 |
| `js/data/quiz-repository.js` | 6 | 쿼리 조건 |
| `js/analytics/*.js` | 6 | 합격 판정 로직 |
| `sw.js` | 7 | 캐시 버전 업 |
| `exam-sports1/` (신규) | 1 | 기출 30 + 모의고사 5 + quiz.html |
| `subjects-sports1/` (신규) | 1 | 과목 페이지 6개 |
| `years-sports1/` (신규) | 1 | 연도 페이지 5개 |
| `data-sports1/` (신규) | 1 | JSON 데이터 30개 |
| `images-sports1/` (신규) | 1 | 이미지 (업로드 대기) |

---

## 향후 확장 로드맵 (이번에는 구현 안 함)

CERT_REGISTRY에 객체만 추가하면 대응 가능한 자격증들:

| 자격증 | 키 (예시) | 과목 수 | 비고 |
|--------|----------|---------|------|
| ~~1급 전문스포츠지도사~~ | — | — | 1급 스포츠지도사에 통합됨 |
| ~~1급 장애인스포츠지도사~~ | — | — | 1급 스포츠지도사에 통합됨 |
| 2급 전문스포츠지도사 | `pro-instructor` | 5 (선택) | 7개 중 5선택 |
| 2급 장애인스포츠지도사 | `disabled-instructor` | 5 (필수1+선택4) | 특수체육론 + 4선택 |
| 유소년스포츠지도사 | `youth-instructor` | 5 (필수1+선택4) | 유아체육론 + 4선택 |
| 노인스포츠지도사 | `senior-instructor` | 5 (필수1+선택4) | 노인체육론 + 4선택 |
