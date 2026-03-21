# 페이지 레지스트리 — CSS/JS 의존성 관리

> 페이지 추가/수정 시 이 문서를 참고하여 필수 파일 누락 방지
> 마지막 업데이트: 2026-03-21

---

## 필수 공통 파일 (모든 페이지에 포함해야 함)

| 파일 | 용도 |
|------|------|
| `css/design-tokens.css` | 디자인 토큰 (폰트, 색상, 간격) |
| `css/apple-header.css` | Apple 스타일 헤더 |
| `css/apple-footer.css` | Apple 스타일 푸터 |
| `css/login.css` | 로그인 모달 (없으면 모달이 스타일 없이 노출됨) |
| `js/core/firebase-core.js` | Firebase 초기화 (type="module") |
| `js/auth/auth-core.js` | 인증 상태 관리 (type="module") |
| `js/auth/auth-ui.js` | 로그인 UI/모달 (type="module") |
| `js/apple-header.js` | 헤더 햄버거 + 로그인 상태 동기화 |

### 필수 HTML 구조

```html
<!-- HEAD -->
<link rel="stylesheet" href="css/design-tokens.css">
<link rel="stylesheet" href="css/apple-header.css">
<link rel="stylesheet" href="css/apple-footer.css">
<link rel="stylesheet" href="css/login.css">
<script type="module" src="js/core/firebase-core.js"></script>
<script type="module" src="js/auth/auth-core.js"></script>
<script type="module" src="js/auth/auth-ui.js"></script>

<!-- BODY 끝 -->
<script src="js/apple-header.js"></script>
```

> 하위 폴더(notices/, admin/) 페이지는 `../css/`, `../js/` 사용

---

## 페이지별 현황

### 완전 리디자인 완료 (인라인 스타일, apple-header/footer 불필요)

| 페이지 | 헤더/푸터 | 추가 CSS | 추가 JS | 비고 |
|--------|-----------|----------|---------|------|
| `index.html` | 인라인 | - | - | 메인, 헤더/푸터 인라인 |
| `cft.html` | 인라인 | analytics-dashboard, wrong-note | bookmark-ui, wrong-note-ui | 건운사 |
| `si1.html` | 인라인 | analytics-dashboard, wrong-note | bookmark-ui, wrong-note-ui | 1급 |
| `si2.html` | 인라인 | analytics-dashboard, wrong-note | bookmark-ui, wrong-note-ui | 2급 |
| `notices.html` | 인라인 | pages/notice | notice-ui, logger | 공지 목록 |
| `search-by-tags.html` | 인라인 | tag-search, wrong-note | tag-search, auth-utils | 태그 검색 |

### 헤더/푸터 교체 완료 (apple-header/footer CSS 사용)

| 페이지 | login.css | auth JS | apple-header.js | 추가 CSS | 비고 |
|--------|-----------|---------|-----------------|----------|------|
| `company-info.html` | O | O | O | - | 사업자정보 |
| `terms.html` | O | O | O | base, linear-themes, components | 이용약관 |
| `privacy-policy.html` | O | O | O | base, linear-themes, components | 개인정보 |
| `about.html` | O | O | - | base, linear-themes | 소개 |
| `mypage.html` | X | 부분 | - | base, layout | 마이페이지 |
| `login.html` | O | O | - | base, components, layout, premium-ui | 로그인 |
| `bookmark.html` | - | O | - | base, components, layout, linear-themes, wrong-note, dark-mode | 북마크 |
| `wrong-note.html` | - | O | - | base, components, layout, linear-themes, wrong-note, dark-mode | 오답노트 |
| `pdf-download.html` | - | 부분 | - | base, components, layout | PDF 다운로드 |
| `product-detail.html` | - | 부분 | - | base, layout, shop | 상품 상세 |
| `notices/detail.html` | - | 부분 | - | base, components, layout, pages/notice, wrong-note | 공지 상세 |
| `admin/statistics.html` | - | 부분 | - | base, components, layout | 관리자 통계 |

### 미리디자인 (구 Linear 헤더/푸터 사용 중)

| 페이지 | 파일 수 | 비고 |
|--------|---------|------|
| `exam/*.html` | ~70개 | 건운사 기출 |
| `exam-sports/*.html` | ~50개 | 2급 기출 |
| `exam-sports1/*.html` | ~30개 | 1급 기출 |
| `exam/quiz.html` | 1개 | 퀴즈 엔진 |
| `lecture-*.html` | 4개 | 결제 관련 (심사 중 주의) |

---

## 주의사항

1. **login.css 누락** → 로그인 모달이 푸터 아래에 스타일 없이 노출됨
2. **auth JS 누락** → 헤더 로그인 버튼이 항상 "로그인"으로 표시됨
3. **apple-header.js 누락** → 햄버거 메뉴 작동 안 함 + 로그인 상태 미반영
4. **하위 폴더 경로** → `../css/`, `../js/` 사용 필수
5. **구 CSS 정리 필요** → terms, privacy-policy, about에 아직 `base.css`, `linear-themes.css` 남아있음 (리디자인 시 제거)
