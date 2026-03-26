# 퍼스트펭귄 (FirstPenguin) - CLAUDE.md

## 프로젝트 개요
- 건강운동관리사/스포츠지도사 자격증 기출문제 학습 플랫폼
- Firebase Hosting + Firestore + Toss Payments
- 프로젝트 ID: `first-penguins-new`
- 배포: `firebase deploy --only hosting` (Firebase Hosting 사용, Cloudflare Pages 아님!)

## 상점/강의 시스템 (shop-dev 브랜치)

### Firestore 컬렉션 구조
- `products` — 상품 (정규강의, 요약본 등)
- `episodes` — 에피소드 (각 강의 영상, Vimeo ID 포함)
- `purchases` — 구매 내역 (문서ID: `{userId}_{productId}`)
- `lectureProgress` — 강의 진도율 (문서ID: `{userId}_{productId}_ep{번호}`)
- `coupons` / `couponUsage` — 쿠폰 시스템

### 상품 ID 규칙 (기존 ID 유지 필수!)
- 정규강의: `video_anatomy`, `video_injury`, `video_physio`, `video_load`, `video_ecg`, `video_patho`, `video_prescript`, `video_health`
- 요약본: `pdf_anatomy`, `pdf_injury`, `pdf_physio`, `pdf_load`, `pdf_patho`, `pdf_psycho`, `pdf_prescript`, `pdf_health`
- `pdf_001`~`pdf_005`: 레거시 상품 (CSCS 등)
- **주의**: `health-*-lecture`, `health-*-summary` ID는 비활성화된 중복 상품. 새 상품 등록 시 기존 `video_*`, `pdf_*` 패턴 따를 것

### 에피소드 ID 규칙
- 패턴: `{productId}_ep{번호(2자리)}` (예: `video_physio_ep01`)
- 각 에피소드에 `vimeoId` 필드로 Vimeo 영상 연결
- `isFree: true`인 에피소드는 미구매자도 시청 가능

### 구매 플로우
1. 상점 (`index.html#lecture-tab`) → 상품 카드 클릭
2. 상세 (`product-detail.html?id=...`) → 구매하기
3. 결제 (`lecture-purchase.html`) → Toss Payments (현재 테스트키, 심사중)
4. 완료 (`lecture-success.html`) → Firestore purchases 저장
5. 재생 (`lecture-play.html?id=...`) → Vimeo 임베드 + 진도율 저장

### Vimeo 연동
- Vimeo API 앱: "FirstPenguin LMS" (Client ID: 764029d1909697fc85d5e7f741b9abb1b2c50af7)
- 영상 privacy 설정: 도메인 제한 (the1stpeng.com)으로 무단 접근 차단 필요
- Vimeo Player API로 진도율 추적

### 관련 파일
- `js/payment/shop.js` — 상점 카탈로그 렌더링
- `js/payment/coupon-manager.js` — 쿠폰 검증/적용
- `js/payment/lecture-tracker.js` — 강의 진도 추적
- `js/payment/pdf-tracker.js` — PDF 다운로드 추적
- `css/shop.css` — 상점 UI
- `product-detail.html` — 상품 상세 페이지
- `lecture-play.html` — 강의 재생 페이지
- `lecture-purchase.html` — 결제 페이지
- `lecture-success.html` / `lecture-fail.html` — 결제 결과

### 시드/유틸 스크립트
- `seed-firestore.js` — 상품+에피소드 일괄 등록 (Admin SDK)
- `fix-episodes.js` — 에피소드 ID 수정 스크립트
- `serviceaccountkey.json` — Firebase Admin SDK 키 (커밋 금지!)

## 관리자 이메일
- kspo0324@gmail.com
- mingdy7283@gmail.com
- sungsoo702@gmail.com
- pyogobear@gmail.com
