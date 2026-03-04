# 퍼스트펭귄 - 건강운동관리사 학습 플랫폼

건강운동관리사 및 2급 생활스포츠지도사 자격증 시험 대비 기출문제 모음 및 학습 플랫폼입니다.

## 🚀 특징

- **Linear.app 디자인**: Linear.app의 공식 디자인 시스템을 기반으로 제작
- **완전한 TypeScript 지원**: 모든 컴포넌트에 TypeScript 타입 정의 포함
- **접근성 우선**: WCAG 가이드라인을 준수한 접근 가능한 컴포넌트
- **반응형 디자인**: 모든 화면 크기에서 완벽하게 작동
- **다크 모드 지원**: 기본적으로 다크 테마 적용
- **커스터마이징 가능**: CSS 변수를 통한 쉬운 테마 커스터마이징

## 📦 설치

```bash
npm install linear-design-system
```

## 🎯 빠른 시작

```typescript
import React from 'react';
import { Button, Card, Typography, Navigation } from 'linear-design-system';

function App() {
  return (
    <div>
      <Navigation variant="header">
        <ul className="linear-navigation__list">
          <NavigationItem href="/" active>홈</NavigationItem>
          <NavigationItem href="/about">소개</NavigationItem>
        </ul>
      </Navigation>
      
      <Card variant="feature">
        <Typography variant="h2">환영합니다!</Typography>
        <Typography variant="body" color="secondary">
          Linear Design System을 사용해보세요.
        </Typography>
        <div className="linear-card__actions">
          <Button variant="primary">시작하기</Button>
          <Button variant="ghost">더 알아보기</Button>
        </div>
      </Card>
    </div>
  );
}
```

## 🧩 컴포넌트

### Button

다양한 스타일과 크기의 버튼 컴포넌트입니다.

```typescript
import { Button } from 'linear-design-system';

// 기본 사용법
<Button variant="primary" size="medium">클릭하세요</Button>

// 모든 변형
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>

// 크기 변형
<Button size="small">작은 버튼</Button>
<Button size="medium">중간 버튼</Button>
<Button size="large">큰 버튼</Button>

// 비활성화
<Button disabled>비활성화된 버튼</Button>
```

### Card

콘텐츠를 담는 카드 컴포넌트입니다.

```typescript
import { Card } from 'linear-design-system';

// 기본 카드
<Card variant="default">
  <h3>카드 제목</h3>
  <p>카드 내용입니다.</p>
</Card>

// Feature 카드 (클릭 가능)
<Card variant="feature" onClick={handleClick}>
  <h3>Feature 카드</h3>
  <p>클릭할 수 있는 카드입니다.</p>
</Card>

// 아웃라인 카드
<Card variant="outlined">
  <h3>아웃라인 카드</h3>
  <p>테두리가 있는 카드입니다.</p>
</Card>

// Elevated 카드
<Card variant="elevated">
  <h3>Elevated 카드</h3>
  <p>그림자가 있는 카드입니다.</p>
</Card>
```

### Typography

일관된 타이포그래피를 위한 텍스트 컴포넌트입니다.

```typescript
import { Typography } from 'linear-design-system';

// 헤딩
<Typography variant="h1">메인 제목</Typography>
<Typography variant="h2">섹션 제목</Typography>
<Typography variant="h3">소제목</Typography>

// 본문 텍스트
<Typography variant="body">일반 텍스트</Typography>
<Typography variant="body" size="large">큰 텍스트</Typography>

// 색상 변형
<Typography variant="body" color="primary">주요 텍스트</Typography>
<Typography variant="body" color="secondary">보조 텍스트</Typography>
<Typography variant="body" color="tertiary">3차 텍스트</Typography>
<Typography variant="body" color="accent">강조 텍스트</Typography>

// 캡션과 라벨
<Typography variant="caption">캡션 텍스트</Typography>
<Typography variant="label">라벨 텍스트</Typography>
```

### Navigation

네비게이션 메뉴 컴포넌트입니다.

```typescript
import { Navigation, NavigationItem } from 'linear-design-system';

// 헤더 네비게이션
<Navigation variant="header">
  <div className="linear-navigation__brand">
    <span>브랜드</span>
  </div>
  
  <ul className="linear-navigation__list">
    <NavigationItem href="/" active>홈</NavigationItem>
    <NavigationItem href="/about">소개</NavigationItem>
  </ul>
  
  <div className="linear-navigation__actions">
    <Button variant="ghost" size="small">로그인</Button>
    <Button variant="primary" size="small">시작하기</Button>
  </div>
</Navigation>

// 푸터 네비게이션
<Navigation variant="footer">
  <ul className="linear-navigation__list">
    <NavigationItem href="/privacy">개인정보처리방침</NavigationItem>
    <NavigationItem href="/terms">이용약관</NavigationItem>
    <NavigationItem href="/support">지원</NavigationItem>
  </ul>
</Navigation>
```

## 🎨 테마 시스템

### 색상 팔레트

```css
/* CSS 변수 사용 */
.my-component {
  background-color: var(--color-bg-primary);    /* #08090a */
  color: var(--color-text-primary);            /* #f7f8f8 */
  border: 1px solid var(--color-border-primary); /* #23252a */
}
```

### 주요 색상

- **Primary**: `#5e6ad2` (브랜드 색상)
- **Background**: `#08090a` (주 배경), `#0f1011` (카드 배경)
- **Text**: `#f7f8f8` (주 텍스트), `#d0d6e0` (보조 텍스트)
- **Border**: `#23252a` (주 테두리), `#34343a` (보조 테두리)

### 타이포그래피

- **Font Family**: Inter Variable, SF Pro Display, system fonts
- **Font Weights**: 300 (light) ~ 680 (bold)
- **Font Sizes**: 0.625rem (tiny) ~ 4.5rem (title9)

## 📱 반응형 디자인

모든 컴포넌트는 모바일 우선 접근법으로 설계되었습니다.

```css
/* 기본 스타일 (모바일) */
.linear-button {
  padding: 0px 12px;
  font-size: 13px;
}

/* 태블릿 이상 */
@media (min-width: 768px) {
  .linear-button {
    padding: 0px 16px;
    font-size: 15px;
  }
}
```

## ♿ 접근성

- **키보드 네비게이션**: 모든 인터랙티브 요소는 키보드로 접근 가능
- **스크린 리더**: 적절한 ARIA 속성과 시맨틱 HTML 사용
- **색상 대비**: WCAG AA 기준 준수
- **포커스 표시**: 명확한 포커스 인디케이터 제공

## 🛠️ 개발

### 프로젝트 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 타입 체크
npm run type-check

# 린팅
npm run lint
```

### 데모 페이지

개발 서버 실행 후 `http://localhost:5173`에서 모든 컴포넌트의 데모를 확인할 수 있습니다.

## 📋 Cursor Rules

이 프로젝트는 `.cursorrules` 파일을 포함하고 있어 Cursor에서 일관된 코드 스타일을 유지할 수 있습니다.

주요 규칙:
- 모든 UI 요소는 제공된 컴포넌트 사용 필수
- 인라인 스타일 사용 금지
- CSS 변수 사용 권장
- 접근성 고려 필수

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 크레딧

이 디자인 시스템은 [Linear.app](https://linear.app)에서 영감을 받아 제작되었습니다.

---

**Linear Design System**으로 더 나은 사용자 인터페이스를 구축하세요! 🚀

