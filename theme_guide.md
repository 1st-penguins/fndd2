# Linear 다크/라이트 테마 시스템 가이드

## 🎨 새로운 테마 시스템 완성!

Linear 디자인 시스템에 다크/라이트 테마 전환 기능을 추가했습니다. 사용자의 선호도와 시스템 설정에 따라 자동으로 테마를 전환할 수 있습니다.

## ✨ 주요 특징

### 🌞 라이트 테마
- **밝고 깔끔한 배경**: 흰색과 연한 회색 계열
- **높은 가독성**: 어두운 텍스트와 밝은 배경의 조합
- **주간 사용 최적화**: 밝은 환경에서 눈의 피로 감소

### 🌙 다크 테마  
- **어두운 배경**: 검은색과 어두운 회색 계열
- **집중도 향상**: 밝은 텍스트와 어두운 배경의 조합
- **야간 사용 최적화**: 어두운 환경에서 눈의 피로 감소

### 🔄 스마트 테마 전환
- **자동 감지**: 시스템 다크/라이트 모드 설정 자동 감지
- **사용자 선택**: 수동 테마 전환 버튼 제공
- **설정 저장**: 선택한 테마를 로컬 스토리지에 저장
- **부드러운 전환**: 0.3초 애니메이션으로 자연스러운 전환

## 📁 새로운 파일들

### 테마 시스템 파일들
- `css/linear-themes.css` - 다크/라이트 테마 CSS 변수 및 스타일
- `src/components/ThemeSwitcher/` - 테마 전환 버튼 컴포넌트
- `new-index-light.html` - 테마 전환 기능이 포함된 홈페이지
- `theme-preview.html` - 테마 시스템 미리보기 페이지

### 컴포넌트 업데이트
- `src/components/Button/Button.css` - 테마 변수 사용으로 업데이트
- `src/components/Card/Card.css` - 테마 변수 사용으로 업데이트
- `src/components/Navigation/Navigation.css` - 테마 변수 사용으로 업데이트
- `src/components/Typography/Typography.css` - 테마 변수 사용으로 업데이트

## 🚀 사용 방법

### 1. 테마 시스템 미리보기
```bash
# 테마 시스템 미리보기 페이지 열기
open theme-preview.html
```

### 2. 테마 전환 기능이 있는 홈페이지
```bash
# 테마 전환 기능이 포함된 홈페이지 열기
open new-index-light.html
```

### 3. 기존 홈페이지에 테마 시스템 적용
```bash
# 기존 홈페이지 백업
cp index.html index-backup.html

# 테마 전환 기능이 있는 새 홈페이지로 교체
cp new-index-light.html index.html
```

## 🎯 테마 시스템 구조

### CSS 변수 시스템
```css
/* 라이트 테마 (기본) */
:root {
  --color-bg-primary: #ffffff;
  --color-text-primary: #202124;
  --color-border-primary: #dadce0;
  /* ... */
}

/* 다크 테마 */
[data-theme="dark"] {
  --color-bg-primary: #08090a;
  --color-text-primary: #f7f8f8;
  --color-border-primary: #23252a;
  /* ... */
}
```

### 테마 전환 버튼
```html
<button class="linear-theme-switcher linear-theme-switcher--primary">
  <div class="linear-theme-switcher__icon">
    <!-- 태양/달 아이콘 -->
  </div>
  <span class="linear-theme-switcher__label">테마 전환</span>
</button>
```

### JavaScript 테마 관리
```javascript
class ThemeManager {
  constructor() {
    this.currentTheme = this.getInitialTheme();
    this.init();
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('linear-theme', theme);
  }
}
```

## 🎨 색상 팔레트

### 라이트 테마 색상
- **배경**: `#ffffff`, `#f8f9fa`, `#f1f3f4`
- **텍스트**: `#202124`, `#5f6368`, `#80868b`
- **테두리**: `#dadce0`, `#e8eaed`, `#f1f3f4`
- **브랜드**: `#5e6ad2` (동일)

### 다크 테마 색상
- **배경**: `#08090a`, `#0f1011`, `#141516`
- **텍스트**: `#f7f8f8`, `#d0d6e0`, `#8a8f98`
- **테두리**: `#23252a`, `#34343a`, `#3e3e44`
- **브랜드**: `#5e6ad2` (동일)

## 🔧 커스터마이징

### 새로운 색상 추가
```css
:root {
  --color-custom: #your-color;
}

[data-theme="dark"] {
  --color-custom: #your-dark-color;
}
```

### 컴포넌트에 테마 적용
```css
.my-component {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}
```

### 테마별 특별 스타일
```css
/* 라이트 테마에서만 적용 */
:root:not([data-theme="dark"]) .my-component {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 다크 테마에서만 적용 */
[data-theme="dark"] .my-component {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

## 📱 반응형 테마 지원

### 자동 테마 감지
```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* 시스템 다크모드 설정에 따른 자동 적용 */
    --color-bg-primary: #08090a;
    --color-text-primary: #f7f8f8;
  }
}
```

### 접근성 지원
```css
/* 고대비 모드 */
@media (prefers-contrast: high) {
  :root {
    --color-border-primary: #000000;
  }
  
  [data-theme="dark"] {
    --color-border-primary: #ffffff;
  }
}

/* 모션 감소 */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
```

## 🎯 사용자 경험

### 테마 전환 플로우
1. **초기 로드**: 저장된 테마 또는 시스템 설정 감지
2. **테마 적용**: CSS 변수 업데이트 및 애니메이션
3. **사용자 전환**: 버튼 클릭으로 테마 변경
4. **설정 저장**: 로컬 스토리지에 사용자 선택 저장

### 시각적 피드백
- **아이콘 변경**: 태양 ↔ 달 아이콘 전환
- **부드러운 애니메이션**: 0.3초 전환 효과
- **즉시 적용**: 모든 컴포넌트에 즉시 반영

## 🧪 테스트 방법

### 1. 수동 테스트
```bash
# 테마 전환 버튼 클릭
# 브라우저 새로고침 후 테마 유지 확인
# 시스템 다크모드 설정 변경 후 자동 감지 확인
```

### 2. 자동화 테스트
```javascript
// 테마 전환 테스트
const themeManager = new ThemeManager();
themeManager.toggleTheme();
assert(document.documentElement.getAttribute('data-theme') === 'dark');

// 로컬 스토리지 테스트
assert(localStorage.getItem('linear-theme') === 'dark');
```

## 🐛 문제 해결

### 일반적인 문제들

1. **테마가 적용되지 않는 경우**
   - CSS 파일 경로 확인
   - 브라우저 캐시 클리어
   - CSS 변수 이름 확인

2. **테마 전환이 부드럽지 않은 경우**
   - CSS transition 속성 확인
   - JavaScript 애니메이션 타이밍 조정

3. **시스템 테마 감지가 안 되는 경우**
   - `window.matchMedia` 지원 확인
   - 브라우저 호환성 확인

### 디버깅 도구
```javascript
// 현재 테마 확인
console.log(document.documentElement.getAttribute('data-theme'));

// 저장된 테마 확인
console.log(localStorage.getItem('linear-theme'));

// CSS 변수 값 확인
console.log(getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary'));
```

## 📊 성능 최적화

### CSS 최적화
- CSS 변수 사용으로 일관성 확보
- 미디어 쿼리 최적화
- 불필요한 스타일 제거

### JavaScript 최적화
- 이벤트 위임 사용
- 디바운싱 적용
- 메모리 누수 방지

## 🚀 향후 개선 계획

### Phase 1: 기본 테마 시스템 ✅
- 다크/라이트 테마 구현
- 테마 전환 버튼
- 자동 테마 감지

### Phase 2: 고급 기능
- 커스텀 테마 지원
- 테마별 애니메이션
- 테마별 이미지 최적화

### Phase 3: 사용자 경험
- 테마별 접근성 개선
- 테마별 성능 최적화
- 사용자 피드백 수집

## 🎉 완료!

Linear 다크/라이트 테마 시스템이 성공적으로 구현되었습니다!

### 다음 단계
1. `theme-preview.html`에서 테마 시스템 체험
2. `new-index-light.html`에서 테마 전환 기능 확인
3. 만족하시면 실제 홈페이지에 적용

---

**Linear 테마 시스템**으로 더욱 개인화된 사용자 경험을 제공하세요! 🌓✨
