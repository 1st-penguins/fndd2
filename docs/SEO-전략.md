# 퍼스트펭귄 검색 노출 개선 전략 (Google SEO)

## 1. 현재 상태 요약

| 항목 | 현재 | 문제점 |
|------|------|--------|
| **페이지 제목 (title)** | `퍼스트펭귄 \| 스포츠자격증 \| 학습플랫폼` | "건강운동관리사", "기출문제" 등 검색 키워드 없음 |
| **H1** | `Fear Not, Deep Dive` | 슬로건만 있어 검색엔진이 주제 파악 어려움 |
| **meta description** | 있음 (양호) | - |
| **robots.txt** | 없음 | 크롤러 가이드 없음 |
| **sitemap.xml** | 없음 | 색인 요청/목록 제공 불가 |
| **Open Graph / Twitter** | 없음 | 공유·미리보기·일부 SEO 시그널 부족 |
| **canonical URL** | 없음 | 중복 콘텐츠 시 유리하지 않음 |
| **구조화 데이터(JSON-LD)** | 없음 | 리치 스니펫 기회 없음 |

---

## 2. 전략 요약 (우선순위)

1. **제목·H1·본문 키워드** – 검색어와 일치하는 문구로 수정 (가장 중요)
2. **sitemap.xml + robots.txt** – 색인 가능 페이지 목록·크롤 규칙 제공
3. **Open Graph / canonical** – 공유 품질·중복 방지
4. **구조화 데이터(JSON-LD)** – 사이트/서비스 설명으로 리치 결과 가능성
5. **배포 URL 기준 메타/OG** – 실제 도메인으로 canonical·og:url 반영

---

## 3. 상세 전략

### 3-1. 제목(Title) 개선

- **적용:**  
  `건운사 기출문제 | 건운사 문제풀이 | 건강운동관리사 | 퍼스트펭귄`
- **이유:**  
  "건운사"는 건강운동관리사의 줄임말로 검색량이 많음.  
  "건운사 기출문제", "건운사 문제풀이" 등 실제 검색어를 title·description에 반영.

### 3-2. H1·히어로 문구 개선

- **현재:**  
  - H1: `Fear Not, Deep Dive`  
  - H2: `두려움을 넘어, 더 깊은 곳으로.`
- **권장:**  
  - H1: `건강운동관리사·2급 스포츠지도사 기출문제` (또는 한 종류만 강조할 경우 하나만)  
  - H2: `Fear Not, Deep Dive – 두려움을 넘어, 더 깊은 곳으로.` (슬로건은 유지하되 H2로)
- **이유:**  
  H1은 페이지 주제를 대표하므로, 핵심 시험명·"기출문제"가 들어가야 검색엔진과 사용자 모두에게 명확함.

### 3-3. meta description

- 현재 문구가 이미 "건강운동관리사, 2급 스포츠지도사, 기출문제, 2019~2025"를 포함하므로 유지.  
- 필요 시 "무료", "기출문제 모음", "모의고사" 등 1~2개 키워드만 자연스럽게 보강.

### 3-4. robots.txt

- 경로: **`/robots.txt`** (사이트 루트)
- 내용 예시:
  - `User-agent: *`  
  - `Allow: /`  
  - `Sitemap: https://실제도메인.com/sitemap.xml`
- 관리자/임포트 등 비공개 경로는 `Disallow`로 제외 검토.

### 3-5. sitemap.xml

- 경로: **`/sitemap.xml`**
- 포함 페이지 예:  
  `index.html`, `notices.html`, `lectures.html`, `contact.html`,  
  `years/year_2019.html` ~ `year_2025.html`,  
  `subjects/subject_*.html` 등 공개된 주요 URL.
- `lastmod`(최종 수정일) 있으면 좋음.
- 배포 시 **실제 도메인**으로 `loc` URL 작성.

### 3-6. Open Graph / Twitter Card

- **추가 권장 태그**
  - `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale`
  - `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- **og:image**  
  - 비율 1.91:1 권장(예: 1200×630).  
  - 로고+서비스명이 보이는 이미지 한 장 준비 후 절대 URL로 지정.

### 3-7. canonical URL

- 모든 주요 HTML에  
  `<link rel="canonical" href="https://실제도메인.com/현재경로" />`  
  추가.
- 예: `index.html` → `https://실제도메인.com/` 또는 `https://실제도메인.com/index.html` (사이트 기본 규칙에 맞춰 통일).

### 3-8. 구조화 데이터(JSON-LD)

- **Organization** 또는 **WebSite** 스키마 적용.
- `name`, `url`, `description`, `logo` 등 필수 속성 채우기.
- (선택) **WebApplication** 또는 학습/교육 관련 스키마로 "기출문제", "모의고사" 등 서비스 성격 명시.

### 3-9. 기타

- **배포 URL 기준 작업**  
  canonical, og:url, sitemap의 `loc`는 반드시 **실제 배포 도메인**으로 작성.
- **이미지 alt**  
  로고·히어로 이미지에 `alt="퍼스트펭귄 - 건강운동관리사 기출문제"` 등 설명 텍스트 유지.
- **페이지별 title**  
  연도/과목 페이지는 이미 "2025년 기출문제 - 퍼스트펭귄 건강운동관리사" 형태로 적절함.  
  필요 시 "기출문제", "모의고사" 등 한두 단어만 더 넣어도 됨.

---

## 4. 적용 순서 제안

1. **즉시:** `index.html` – title, H1/H2, og/canonical, JSON-LD (도메인만 배포 URL로 교체)
2. **단기:** `robots.txt`, `sitemap.xml` 생성 후 루트에 배포
3. **중기:** 서브 페이지(notices, years, subjects 등)에 canonical·OG 이미지 URL 정리
4. **모니터링:** Google Search Console에 사이트 등록 후 색인·쿼리·노출 확인

---

## 5. index.html 수정 체크리스트

- [ ] `<title>` → 검색 키워드 포함 제목으로 변경
- [ ] `<h1>` → "건강운동관리사·2급 스포츠지도사 기출문제" 등으로 변경
- [ ] `<h2>` → 슬로건 유지
- [ ] `<link rel="canonical" href="...">` 추가 (실제 도메인)
- [ ] `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale` 추가
- [ ] `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` 추가
- [ ] JSON-LD (WebSite 또는 Organization) 스크립트 블록 추가
- [ ] (선택) meta description 1~2문장 보강

이후 **robots.txt**와 **sitemap.xml**을 생성하면 검색엔진이 사이트를 더 잘 발견하고 색인하는 데 도움이 됩니다.

---

## 6. 도메인 안내

현재 **https://fndd.netlify.app/** 로 설정되어 있습니다.  
도메인을 변경할 경우 다음을 모두 새 도메인으로 바꿔주세요.

- `index.html`: `canonical`, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`
- `robots.txt`: `Sitemap:` URL
- `sitemap.xml`: 모든 `<loc>` URL
