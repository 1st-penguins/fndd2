import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Navigation, NavigationItem } from '../components/Navigation';
import { Typography } from '../components/Typography';
import './Demo.css';

export const Demo: React.FC = () => {
  return (
    <div className="demo-page">
      {/* 네비게이션 데모 */}
      <Navigation variant="header" className="demo-section">
        <div className="linear-navigation__brand">
          <img src="/logo.svg" alt="Logo" className="linear-navigation__logo" />
          <span>Linear Design System</span>
        </div>
        
        <ul className="linear-navigation__list">
          <NavigationItem href="/">홈</NavigationItem>
          <NavigationItem href="/components" active>컴포넌트</NavigationItem>
          <NavigationItem href="/docs">문서</NavigationItem>
          <NavigationItem href="/about">소개</NavigationItem>
        </ul>
        
        <div className="linear-navigation__actions">
          <Button variant="ghost" size="small">로그인</Button>
          <Button variant="primary" size="small">시작하기</Button>
        </div>
      </Navigation>

      <main className="demo-main">
        {/* 히어로 섹션 */}
        <section className="demo-hero">
          <Typography variant="h1" className="demo-hero__title">
            Linear Design System
          </Typography>
          <Typography variant="body" size="large" color="secondary" className="demo-hero__subtitle">
            Linear.app에서 추출한 현대적이고 일관된 디자인 시스템
          </Typography>
          <div className="demo-hero__actions">
            <Button variant="primary" size="large">시작하기</Button>
            <Button variant="outline" size="large">문서 보기</Button>
          </div>
        </section>

        {/* 버튼 컴포넌트 데모 */}
        <section className="demo-section">
          <Typography variant="h2" className="demo-section__title">
            Button 컴포넌트
          </Typography>
          
          <div className="demo-grid">
            <div className="demo-item">
              <Typography variant="h3" size="title3">Primary 버튼</Typography>
              <div className="demo-item__content">
                <Button variant="primary" size="small">작은 버튼</Button>
                <Button variant="primary" size="medium">중간 버튼</Button>
                <Button variant="primary" size="large">큰 버튼</Button>
              </div>
            </div>
            
            <div className="demo-item">
              <Typography variant="h3" size="title3">Secondary 버튼</Typography>
              <div className="demo-item__content">
                <Button variant="secondary" size="small">작은 버튼</Button>
                <Button variant="secondary" size="medium">중간 버튼</Button>
                <Button variant="secondary" size="large">큰 버튼</Button>
              </div>
            </div>
            
            <div className="demo-item">
              <Typography variant="h3" size="title3">Ghost 버튼</Typography>
              <div className="demo-item__content">
                <Button variant="ghost" size="small">작은 버튼</Button>
                <Button variant="ghost" size="medium">중간 버튼</Button>
                <Button variant="ghost" size="large">큰 버튼</Button>
              </div>
            </div>
            
            <div className="demo-item">
              <Typography variant="h3" size="title3">Outline 버튼</Typography>
              <div className="demo-item__content">
                <Button variant="outline" size="small">작은 버튼</Button>
                <Button variant="outline" size="medium">중간 버튼</Button>
                <Button variant="outline" size="large">큰 버튼</Button>
              </div>
            </div>
            
            <div className="demo-item">
              <Typography variant="h3" size="title3">비활성화 상태</Typography>
              <div className="demo-item__content">
                <Button variant="primary" disabled>비활성화</Button>
                <Button variant="secondary" disabled>비활성화</Button>
                <Button variant="ghost" disabled>비활성화</Button>
              </div>
            </div>
          </div>
        </section>

        {/* 카드 컴포넌트 데모 */}
        <section className="demo-section">
          <Typography variant="h2" className="demo-section__title">
            Card 컴포넌트
          </Typography>
          
          <div className="demo-grid">
            <Card variant="default" className="demo-card">
              <Typography variant="h3" size="title3">기본 카드</Typography>
              <Typography variant="body" color="secondary">
                이것은 기본 카드 컴포넌트입니다. Linear.app의 디자인 시스템을 기반으로 만들어졌습니다.
              </Typography>
              <div className="linear-card__actions">
                <Button variant="primary" size="small">액션</Button>
                <Button variant="ghost" size="small">취소</Button>
              </div>
            </Card>
            
            <Card variant="feature" className="demo-card" onClick={() => alert('카드 클릭!')}>
              <div className="linear-card__icon">🚀</div>
              <Typography variant="h3" size="title3">Feature 카드</Typography>
              <Typography variant="body" color="secondary">
                클릭 가능한 feature 카드입니다. 호버 효과와 클릭 이벤트를 확인해보세요.
              </Typography>
            </Card>
            
            <Card variant="outlined" className="demo-card">
              <Typography variant="h3" size="title3">아웃라인 카드</Typography>
              <Typography variant="body" color="secondary">
                테두리가 있는 카드 컴포넌트입니다. 더 세련된 느낌을 줍니다.
              </Typography>
              <div className="linear-card__meta">
                <div className="linear-card__meta-item">
                  <span>📅</span>
                  <span>2024년 1월</span>
                </div>
                <div className="linear-card__meta-item">
                  <span>👤</span>
                  <span>개발자</span>
                </div>
              </div>
            </Card>
            
            <Card variant="elevated" className="demo-card">
              <Typography variant="h3" size="title3">Elevated 카드</Typography>
              <Typography variant="body" color="secondary">
                그림자가 있는 elevated 카드입니다. 더 입체적인 느낌을 줍니다.
              </Typography>
            </Card>
          </div>
        </section>

        {/* 타이포그래피 데모 */}
        <section className="demo-section">
          <Typography variant="h2" className="demo-section__title">
            Typography 컴포넌트
          </Typography>
          
          <div className="demo-grid">
            <div className="demo-item">
              <Typography variant="h1">Heading 1</Typography>
              <Typography variant="h2">Heading 2</Typography>
              <Typography variant="h3">Heading 3</Typography>
              <Typography variant="h4">Heading 4</Typography>
              <Typography variant="h5">Heading 5</Typography>
              <Typography variant="h6">Heading 6</Typography>
            </div>
            
            <div className="demo-item">
              <Typography variant="body" size="large">Large Body Text</Typography>
              <Typography variant="body">Regular Body Text</Typography>
              <Typography variant="body" size="small">Small Body Text</Typography>
              <Typography variant="caption">Caption Text</Typography>
              <Typography variant="label">Label Text</Typography>
            </div>
            
            <div className="demo-item">
              <Typography variant="body" color="primary">Primary Color</Typography>
              <Typography variant="body" color="secondary">Secondary Color</Typography>
              <Typography variant="body" color="tertiary">Tertiary Color</Typography>
              <Typography variant="body" color="accent">Accent Color</Typography>
              <Typography variant="body" color="success">Success Color</Typography>
              <Typography variant="body" color="warning">Warning Color</Typography>
              <Typography variant="body" color="error">Error Color</Typography>
            </div>
          </div>
        </section>

        {/* 네비게이션 데모 */}
        <section className="demo-section">
          <Typography variant="h2" className="demo-section__title">
            Navigation 컴포넌트
          </Typography>
          
          <div className="demo-grid">
            <div className="demo-item">
              <Typography variant="h3" size="title3">기본 네비게이션</Typography>
              <Navigation variant="default">
                <ul className="linear-navigation__list">
                  <NavigationItem href="/home">홈</NavigationItem>
                  <NavigationItem href="/about" active>소개</NavigationItem>
                  <NavigationItem href="/contact">연락처</NavigationItem>
                </ul>
              </Navigation>
            </div>
            
            <div className="demo-item">
              <Typography variant="h3" size="title3">푸터 네비게이션</Typography>
              <Navigation variant="footer">
                <ul className="linear-navigation__list">
                  <NavigationItem href="/privacy">개인정보처리방침</NavigationItem>
                  <NavigationItem href="/terms">이용약관</NavigationItem>
                  <NavigationItem href="/support">지원</NavigationItem>
                </ul>
              </Navigation>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <Navigation variant="footer" className="demo-footer">
        <div className="demo-footer__content">
          <Typography variant="body" color="tertiary">
            © 2024 Linear Design System. Linear.app에서 영감을 받아 제작되었습니다.
          </Typography>
        </div>
      </Navigation>
    </div>
  );
};

