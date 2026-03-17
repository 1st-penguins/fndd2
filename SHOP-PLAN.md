# 퍼스트펭귄 상점 시스템 구축 계획서

> 작성일: 2026-03-17
> 목표: 강의 탭을 리틀리 외부링크 → 자체 상점으로 전환

---

## 현재 상태 (이미 구현된 것)

| 파일 | 상태 | 설명 |
|------|------|------|
| `lecture-purchase.html` | ✅ 완성 | 토스페이먼츠 결제 (테스트 키), 쿠폰 적용 |
| `lecture-success.html` | ✅ 완성 | 결제 성공 → Firestore `purchases` 저장 |
| `lecture-fail.html` | ✅ 완성 | 결제 실패 안내 |
| `lecture-play.html` | ✅ 완성 | Vimeo 플레이어 + 구매 확인 + 진도 추적 |
| `pdf-download.html` | ✅ 완성 | PDF 다운로드 + 구매 확인 + 관리자 바이패스 |
| `js/payment/coupon-manager.js` | ✅ 완성 | 쿠폰 검증/적용/취소 |
| `js/payment/lecture-tracker.js` | ✅ 완성 | Vimeo 진도율 추적 |
| `js/payment/pdf-tracker.js` | ✅ 완성 | PDF 다운로드 기록/환불 판단 |
| Firestore `purchases` | ✅ 완성 | 구매 기록 컬렉션 |
| Firestore `products` | ⚠️ 참조만 | pdf-download.html이 읽지만, 실제 데이터 없음 |

**결론: 결제 파이프라인(결제→저장→콘텐츠접근)은 완성. 빠진 건 "상점 프론트"와 "상품 데이터".**

---

## 빠진 것 (만들어야 할 것)

### Phase 1: 상품 데이터 & 상점 프론트 (핵심)

#### 1-1. Firestore 데이터 구조 설계

**`products` 컬렉션 — 결제 단위 (상점에 보이는 카드)**
```
products/{productId}
├── title: "운동생리학 인터넷 강의"
├── description: "핵심 개념부터 기출 해설까지"
├── detailDescription: "상세 설명..."
├── type: "pdf" | "video" | "ppt" | "bundle"
├── category: "health" | "sports" | "common"
├── price: 35000
├── originalPrice: 200000          ← (bundle만, 할인 전 합계)
├── thumbnailUrl: "/images/products/physiology-lecture.jpg"
├── tags: ["운동생리학", "건강운동관리사", "인강"]
├── totalEpisodes: 10              ← (video만, 총 강의 수)
├── totalDuration: "5시간 20분"     ← (video만)
├── fileUrl: "https://..."         ← (pdf/ppt만, Firebase Storage)
├── fileSize: "12.5MB"            ← (pdf/ppt만)
├── pages: 60                     ← (pdf/ppt만)
├── includedProducts: [...]        ← (bundle만, 포함 상품 ID 배열)
├── sortOrder: 1
├── isActive: true
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

**`episodes` 컬렉션 — 영상 강의의 개별 에피소드 (1강, 2강, ...)**
```
episodes/{productId_ep번호}
├── productId: "video_001"         ← 어떤 상품에 속하는지
├── episode: 1                     ← 몇 강
├── title: "세포와 에너지 대사"
├── description: "ATP 생성 과정..."
├── vimeoId: "987654321"           ← Vimeo 영상 ID
├── duration: "32분"
├── isFree: false                  ← true면 미구매자도 볼 수 있음 (맛보기)
└── sortOrder: 1
```

**구매 → 접근 권한 흐름:**
- `video_001` 구매 → episodes에서 `productId == "video_001"` 전부 시청 가능
- `bundle_001` 구매 → `includedProducts`의 모든 상품에 접근 가능
- `pdf_001` 구매 → 해당 PDF 다운로드 가능

#### 1-2. 강의 탭 → 상점 UI 전환

**현재**: 강의 탭 클릭 → `litt.ly/the1stpeng` 외부 이동
**목표**: 강의 탭 클릭 → 탭 내부에 상품 그리드 표시

```
강의 탭 레이아웃:
┌─────────────────────────────────────────────┐
│  🎓 퍼스트펭귄 스토어                          │
│  전문가의 자료로 확실하게 준비하세요              │
├─────────────────────────────────────────────┤
│  [전체] [인강] [PDF] [PPT] [패키지]  ← 필터   │
├─────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │ 썸네일 │  │ 썸네일 │  │ 썸네일 │              │
│  │      │  │      │  │      │              │
│  ├──────┤  ├──────┤  ├──────┤              │
│  │ 제목   │  │ 제목   │  │ 제목   │              │
│  │ 15,000│  │ 25,000│  │ 무료   │              │
│  │ 🎬영상 │  │ 📄PDF │  │ 📊PPT │              │
│  └──────┘  └──────┘  └──────┘              │
└─────────────────────────────────────────────┘
```

- 상단: 자격증 탭 (문제풀기 탭과 동일 구조)
  - 건강운동관리사 (`health`)
  - 2급 스포츠지도사 (`sports`)
  - 1급 스포츠지도사 (`sports-1`)
- 하단: 타입 필터 [전체] [인강] [PDF] [PPT] [패키지]
- 2열 그리드 (모바일), 3열 (태블릿), 4열 (데스크탑)
- 카드: 썸네일 + 제목 + 가격 + 타입 뱃지
- 구매 완료 상품은 "구매완료 ✓" 뱃지 표시
- Firestore `products`에서 `isActive: true` + 선택된 category로 필터
- `category: "common"`은 모든 자격증 탭에 표시

#### 1-3. 상품 상세 페이지 (`product-detail.html`)

```
상세 페이지 레이아웃:
┌─────────────────────────────────────────────┐
│  ← 뒤로가기                                  │
├──────────────┬──────────────────────────────┤
│              │  운동생리학 핵심요약 PDF         │
│   썸네일/     │  ⭐ 건강운동관리사               │
│   미리보기    │                               │
│              │  2026 시험 대비 운동생리학        │
│              │  핵심 내용 60페이지 요약          │
│              │                               │
│              │  📄 PDF · 60쪽 · 12.5MB        │
│              │                               │
│              │  ₩15,000                      │
│              │  [구매하기] ← lecture-purchase   │
├──────────────┴──────────────────────────────┤
│  📋 상세 설명                                 │
│  - 2026년 최신 출제경향 반영                    │
│  - 핵심 키워드 정리                            │
│  - 기출문제 해설 포함                           │
└─────────────────────────────────────────────┘
```

- URL: `product-detail.html?id=pdf_001`
- 구매 버튼 → `lecture-purchase.html?id=pdf_001&price=15000&title=...&type=pdf`
- 이미 구매한 경우 → "이용하기" 버튼 (play 또는 download로 바로 이동)

### Phase 2: 보안 & 제한

#### 2-1. 결제 서버 검증 (Firebase Cloud Functions)

> **현재 문제**: 클라이언트에서 토스 결제 → 성공 URL로 리다이렉트 → 클라이언트가 Firestore에 purchase 기록.
> URL을 조작하면 결제 없이 purchase 기록을 만들 수 있음.

**해결: Firebase Cloud Functions로 결제 승인 API 추가**

```
결제 흐름 (현재):
  사용자 → 토스결제 → successUrl → 클라이언트가 purchase 저장 ← ⚠️ 위험

결제 흐름 (개선):
  사용자 → 토스결제 → successUrl(paymentKey 포함)
       → Cloud Function 호출 (paymentKey로 토스 서버에 승인 요청)
       → 승인 성공 시 Cloud Function이 purchase 저장 ← ✅ 안전
```

**구현:**
```
functions/
  index.js
    - confirmPayment(paymentKey, orderId, amount)
      → 토스 서버 API로 결제 승인
      → Firestore purchases에 저장
      → 성공/실패 응답
```

#### 2-2. PDF 다운로드 횟수 제한

현재 `pdf-tracker.js`는 다운로드 횟수를 기록만 함 → **제한 로직 추가**

```javascript
// 정책:
// - 최초 구매 후 3회까지 다운로드 가능
// - 3회 초과 시 고객센터 문의 안내
// - 관리자는 무제한
```

#### 2-3. Vimeo 도메인 제한

Vimeo 설정에서:
- Privacy → "Hide from Vimeo" 선택
- Embed → "Specific domains" → `the1stpeng.com` 만 허용
- 이렇게 하면 다른 사이트에서 영상 임베드 불가

### Phase 3: 편의 기능

#### 3-1. 내 구매 목록 (내 강의실)

- 학습분석 탭 내 서브탭 추가 또는 별도 섹션
- 구매한 영상: 진도율 표시 + 이어보기
- 구매한 PDF: 남은 다운로드 횟수 표시 + 다운로드 버튼

#### 3-2. 관리자: 상품 등록/관리

- 관리자 전용 UI에서 상품 CRUD
- 또는 초기에는 Firestore 콘솔에서 직접 등록 (빠른 시작)

#### 3-3. 무료 샘플 / 미리보기

- `price: 0`인 상품은 로그인만 하면 바로 접근
- 영상은 처음 5분 미리보기 가능 (Vimeo 설정)

### Phase 4: 토스페이먼츠 실서비스 전환

#### 4-1. 토스페이먼츠 가맹점 가입

1. [토스페이먼츠 가맹점 센터](https://developers.tosspayments.com/) 가입
2. 사업자등록증 제출 → 심사 (보통 1-3 영업일)
3. 실서비스 Client Key + Secret Key 발급

#### 4-2. 키 교체

```javascript
// 현재 (테스트)
const clientKey = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

// 실서비스로 교체
const clientKey = 'live_gck_XXXXXXXXXXXXXXX';
```

- Secret Key는 **절대 프론트에 넣지 않음** → Cloud Functions에서만 사용
- 환경변수로 관리: `firebase functions:config:set toss.secret_key="live_gsk_XXX"`

---

## 구현 우선순위

```
Phase 1 (상점 오픈 — 가장 급함)
  ├── 1-1. Firestore products 데이터 수동 등록 (30분)
  ├── 1-2. 강의 탭 상점 UI (index.html + shop.js)
  └── 1-3. 상품 상세 페이지 (product-detail.html)

Phase 2 (보안 — 돈이 오가기 전 반드시)
  ├── 2-1. Cloud Functions 결제 승인 ← ⚠️ 실결제 전 필수
  ├── 2-2. PDF 다운로드 3회 제한
  └── 2-3. Vimeo 도메인 제한 (Vimeo 설정)

Phase 3 (편의 — 출시 후)
  ├── 3-1. 내 구매 목록
  ├── 3-2. 관리자 상품 관리 UI
  └── 3-3. 무료 샘플

Phase 4 (실서비스 전환)
  ├── 4-1. 토스 가맹점 심사
  └── 4-2. 키 교체 + Secret Key 보안
```

---

## 파일 구조 (최종)

```
fndd2/
├── index.html                    ← 강의 탭 UI 수정 (상점 그리드)
├── product-detail.html           ← [새로 만듦] 상품 상세
├── lecture-purchase.html         ← 기존 유지 (결제)
├── lecture-success.html          ← 수정 (Cloud Function 호출)
├── lecture-fail.html             ← 기존 유지
├── lecture-play.html             ← 기존 유지 (영상 재생)
├── pdf-download.html             ← 기존 유지 + 횟수 제한 추가
├── js/
│   ├── payment/
│   │   ├── shop.js               ← [새로 만듦] 상점 카탈로그 로직
│   │   ├── coupon-manager.js     ← 기존 유지
│   │   ├── lecture-tracker.js    ← 기존 유지
│   │   └── pdf-tracker.js        ← 기존 유지 + 횟수 제한
│   └── ...
├── functions/                    ← [새로 만듦] Firebase Cloud Functions
│   ├── package.json
│   └── index.js                  ← confirmPayment API
├── images/products/              ← [새로 만듦] 상품 썸네일 이미지
└── css/
    └── shop.css                  ← [새로 만듦] 상점 전용 스타일
```

---

## 수정이 필요한 기존 코드

| 파일 | 수정 내용 |
|------|----------|
| `index.html` 1275-1303행 | 강의 탭 내용을 "준비중" → 상품 그리드로 교체 |
| `js/app.js` 534-538행 | 강의 탭 클릭 시 외부링크 이동 → 탭 내부 표시로 변경 |
| `js/app.js` 44-70행 | `updateLectureTabVisibility()` 로직 수정 |
| `index.html` 279행 | 헤더 강의 링크를 외부 → 탭 이동으로 변경 |
| `index.html` 342행 | 모바일 메뉴 강의 링크도 동일 수정 |
| `lecture-success.html` | 목록 버튼 리틀리 → `index.html#lecture-tab`으로 변경 |
| `lecture-fail.html` | 목록 버튼 리틀리 → `index.html#lecture-tab`으로 변경 |
| `lecture-play.html` | 접근 거부 시 구매 버튼 리틀리 → 상세페이지로 변경 |
| `pdf-download.html` | 강의 목록 링크 리틀리 → `index.html#lecture-tab`으로 변경 |
| `sw.js` | 새 파일들 캐시 목록에 추가 |

---

## 참고: 토스페이먼츠 결제수단 (SDK v1 기준)

현재 `tossPayments.requestPayment('카드', ...)` → 카드만 가능.
다른 수단도 추가 가능:

```javascript
// 카드 + 간편결제(토스페이, 카카오페이, 네이버페이 등)
await tossPayments.requestPayment('카드', { ... });

// 또는 위젯 방식 (v2 SDK — 결제수단 선택 UI 자동 제공)
// → Phase 4에서 v2 SDK로 업그레이드하면 사용자가 결제수단 선택 가능
```

---

## 빠르게 시작하려면

**최소한의 작업으로 상점 오픈:**

1. Firestore 콘솔에서 `products` 컬렉션에 상품 2-3개 수동 등록
2. 강의 탭에 상품 그리드 UI 구현 (shop.js)
3. 상품 상세 페이지 1개 만들기 (product-detail.html)
4. 기존 결제 파이프라인 연결 확인
5. 리틀리 링크 전부 내부 링크로 교체

이것만 하면 **테스트 결제로 전체 플로우 동작** 확인 가능.
실결제는 Phase 2(보안) + Phase 4(토스 심사) 완료 후 전환.
