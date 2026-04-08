# 상품 등록/수정 가이드

## 상품 타입 정의

| 타입 | 설명 | 마이페이지 위치 | 예시 |
|------|------|----------------|------|
| `video` | 영상 강의 (Vimeo/YouTube) | 내 강의실 | 정규강의, 무료강의 |
| `bundle` | 영상 + PDF 포함 | 내 강의실 + 내 자료 | 심전도 특별강의, 계산문제 특별강의 |
| `package` | PDF 묶음 (영상 없음) | 내 자료 | 7일 완성 합격패키지 |
| `pdf` | 개별 PDF | 내 자료 | 요약본 |

> **주의**: `bundle`과 `package`를 혼동하지 말 것!

---

## 새 상품 추가 시 수정 필요한 곳

### 1. Firestore `products` 컬렉션
- Firebase Console 또는 `seed-firestore.js`로 등록
- **절대 기존 상품과 다른 ID로 같은 상품을 중복 등록하지 않을 것!**
- 기존 상품 ID 패턴: `video_*`, `pdf_*`, `pdf_si2_package`, `video_si2_*_free`

### 2. `data/products.json`
- 정적 폴백 데이터 (product-detail.html에서 사용)
- Firestore와 동일하게 유지해야 함
- **수정 후 반드시 캐시 버스팅 버전 올리기** (`products.json?v=YYYYMMDD{a,b,c...}`)
  - 위치: `product-detail.html` 내 `fetch('/data/products.json?v=...')`

### 3. `seed-firestore.js`
- 새 상품만 추가 (기존 Firestore 상품은 포함하지 않음!)
- 건강운동관리사 상품은 이미 `video_*`, `pdf_*` ID로 Firestore에 등록되어 있음
- seed 실행 시 `set({ merge: true })`라 기존 데이터 덮어쓰진 않지만, **다른 ID로 같은 상품을 넣으면 중복 노출됨**

### 4. `mypage.html` — `PRODUCT_NAMES` 객체
- 상품 ID → 표시 이름 매핑
- 새 상품 추가 시 여기에도 등록해야 마이페이지에서 이름이 제대로 나옴

### 5. Firestore `episodes` 컬렉션 (영상 강의인 경우)
- 에피소드 ID 패턴: `{productId}_ep{번호(2자리)}`
- Vimeo: `vimeoId` 필드
- YouTube: `youtubeId` 필드
- 챕터: `chapters` 배열 `[{ time: 초, title: '제목' }]`

### 6. Firebase Storage (PDF/자료인 경우)
- 경로: `products/파일명.pdf`
- **업로드 후 반드시 다운로드 토큰 생성** (안 하면 403 에러)
- URL 형식: `https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2F파일명.pdf?alt=media&token=xxx`

---

## 상품 제목 규칙

- 제목 앞에 `[자격증명]` 포함: `[건강운동관리사] 기능해부학 정규강의`
- 강의 탭 카드, 상세 페이지, 마이페이지 등에서 일관되게 표시됨
- 상세 페이지에서는 `[자격증명]` 뒤에 자동 줄바꿈 처리

---

## 카테고리

| 자격증 | category 값 |
|--------|------------|
| 건강운동관리사 | `health` |
| 2급 생활스포츠지도사 | `sports` |
| 1급 스포츠지도사 | `sports1` |
| 공통 | `common` |

---

## 썸네일

- 경로: `images/products/`
- 파일명 패턴: `{과목}-{타입}.jpg` (건운사), `si2-{과목}-{타입}.jpg` (2급 스포츠)
- 유튜브 무료강의: `https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg` 사용 가능
- 썸네일 변경 시 캐시 버스팅 파라미터 추가: `?v=YYYYMMDD`

---

## 주의사항

1. **products.json 수정 후 캐시 버스팅 필수** — 안 바꾸면 구버전이 계속 보임
2. **seed-firestore.js에 기존 상품 넣지 않기** — 중복 등록 사고 방지
3. **Firebase Storage 업로드 후 토큰 생성 필수** — 토큰 없으면 다운로드 403
4. **Firestore와 products.json 둘 다 수정** — 하나만 바꾸면 불일치 발생
