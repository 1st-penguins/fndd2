/**
 * 모바일 Viewport 최적화 스크립트
 * iOS Safari 등에서 스크롤 시 주소창 자동 숨김으로 인한 viewport 변화 처리
 */

(function() {
  'use strict';
  
  // iOS Safari 감지
  const isIOSSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Android Chrome 감지
  const isAndroidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);
  
  // 모바일 브라우저 감지
  const isMobile = isIOSSafari || isAndroidChrome || window.innerWidth <= 768;
  
  if (!isMobile) {
    console.log('데스크톱 환경: Viewport 최적화 스킵');
    return;
  }
  
  console.log('모바일 환경 감지: Viewport 최적화 시작');
  
  // Hero 섹션 요소 가져오기
  const heroElements = document.querySelectorAll('.linear-hero, .hero-section');
  
  if (heroElements.length === 0) {
    console.log('Hero 섹션을 찾을 수 없습니다.');
    return;
  }
  
  // 초기 viewport 높이 저장
  let initialHeight = window.innerHeight;
  
  // Viewport 높이 설정 함수
  function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Hero 섹션에 고정 높이 적용 (모바일 브라우저 확대 방지)
    heroElements.forEach(hero => {
      // 배경 크기 고정
      hero.style.backgroundAttachment = 'scroll';
      
      // iOS Safari & Android Chrome: 스크롤 시 배경 확대 방지
      if (isIOSSafari || isAndroidChrome) {
        hero.style.backgroundSize = 'auto 100%';
        hero.style.backgroundPosition = 'center center';
        
        // transform을 사용하여 배경 고정 (GPU 가속)
        hero.style.transform = 'translateZ(0)';
        hero.style.willChange = 'transform';
        
        // Android Chrome 추가 최적화
        if (isAndroidChrome) {
          // Android Chrome은 contain-intrinsic-size를 지원
          hero.style.containIntrinsicSize = 'auto';
          // 배경 반복 방지
          hero.style.backgroundRepeat = 'no-repeat';
        }
      }
    });
  }
  
  // 스크롤 시 배경 위치 재조정 (모바일 브라우저 대응)
  let lastScrollTop = 0;
  let ticking = false;
  
  function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // 모바일 브라우저에서 스크롤 시 배경이 확대되는 현상 방지
        heroElements.forEach(hero => {
          const heroRect = hero.getBoundingClientRect();
          
          // Hero 섹션이 화면에 보이는 경우에만 처리
          if (heroRect.top < window.innerHeight && heroRect.bottom > 0) {
            // 배경 크기를 항상 고정 (iOS Safari & Android Chrome)
            if (isIOSSafari || isAndroidChrome) {
              hero.style.backgroundSize = 'auto 100%';
              
              // Android Chrome: 추가 보정
              if (isAndroidChrome) {
                // 스크롤 중 배경이 흔들리지 않도록
                hero.style.backgroundAttachment = 'scroll';
                // 배경 위치 고정
                const scrollRatio = Math.min(scrollTop / window.innerHeight, 1);
                hero.style.backgroundPosition = `center ${70 - scrollRatio * 10}%`;
              }
            }
          }
        });
        
        lastScrollTop = scrollTop;
        ticking = false;
      });
      
      ticking = true;
    }
  }
  
  // 스크롤 이벤트 리스너 (passive 옵션으로 성능 향상)
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Resize 이벤트 리스너
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const currentHeight = window.innerHeight;
      
      // 높이 변화가 100px 이상인 경우에만 재계산 (주소창 숨김/표시 무시)
      if (Math.abs(currentHeight - initialHeight) > 100) {
        initialHeight = currentHeight;
        setViewportHeight();
        console.log('Viewport 높이 업데이트:', currentHeight);
      }
    }, 150);
  }, { passive: true });
  
  // Orientation 변경 이벤트
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      initialHeight = window.innerHeight;
      setViewportHeight();
      console.log('화면 방향 변경: Viewport 업데이트');
    }, 200);
  });
  
  // 초기 설정
  setViewportHeight();
  
  // DOMContentLoaded 후 재확인
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setViewportHeight, 100);
    });
  }
  
  console.log('✅ 모바일 Viewport 최적화 완료');
})();

