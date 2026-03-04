// browser-redirect.js - 내장 브라우저 감지 및 리다이렉트

/**
 * 내장 브라우저 감지 (카카오톡, 인스타그램, 네이버 등)
 * @returns {boolean} 내장 브라우저 여부
 */
export function isInAppBrowser() {
  const userAgent = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

  // 데스크톱/에디터 내장 브라우저(Curor WebView 등) 오탐 방지:
  // 인앱 브라우저 판정은 모바일 환경에서만 수행
  const isMobile = /android|iphone|ipad|ipod/i.test(userAgent);
  if (!isMobile) {
    return false;
  }

  // 대표적인 모바일 인앱 브라우저 식별자
  if (userAgent.includes('kakaotalk')) return true;
  if (userAgent.includes('instagram')) return true;
  if (userAgent.includes('fban') || userAgent.includes('fbav')) return true;
  if (userAgent.includes('line/')) return true;
  if (userAgent.includes('naver')) return true;

  return false;
}

/**
 * 외부 브라우저로 리다이렉트 처리
 */
export function handleExternalBrowserRedirect() {
  // 현재 URL 파라미터 체크하여 이미 리다이렉트된 경우는 처리하지 않음
  const urlParams = new URLSearchParams(window.location.search);
  const isRedirected = urlParams.get('external_browser') === 'true';
  
  // 인앱 브라우저이고 아직 리다이렉트되지 않은 경우
  if (isInAppBrowser() && !isRedirected) {
    console.log('인앱 브라우저 감지됨. 외부 브라우저 리다이렉트 안내 표시...');
    
    // 현재 URL에 파라미터 추가하여 외부 브라우저로 열기
    const currentUrl = window.location.href;
    const redirectUrl = currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'external_browser=true';
    
    // 사용자에게 안내 메시지 표시
    const confirmRedirect = confirm(
      '구글 로그인 정책상 외부 브라우저에서 로그인해야 합니다. 확인을 누르면 브라우저로 이동합니다.'
    );
    
    if (confirmRedirect) {
      console.log('사용자가 외부 브라우저 리다이렉트를 승인함');
      
      // iOS의 경우
      if (/(iPhone|iPad|iPod)/i.test(navigator.userAgent)) {
        window.location.href = 'https://apps.apple.com/app/id535886823?mt=8';
        setTimeout(function() {
          window.location.href = redirectUrl;
        }, 2000);
      }
      // 안드로이드의 경우
      else {
        window.location.href = 'intent://' + window.location.host + window.location.pathname + 
          window.location.search + '#Intent;scheme=https;package=com.android.chrome;end';
      }
      return true;
    } else {
      console.log('사용자가 외부 브라우저 리다이렉트를 취소함');
      return false;
    }
  }
  return false;
}

/**
 * 초기화 함수 - 페이지 로드 시 자동 실행
 */
export function initBrowserRedirect() {
  if (window.Logger && window.Logger.isDev()) {
    console.log('브라우저 리다이렉트 기능 초기화...');
  }
  document.addEventListener('DOMContentLoaded', handleExternalBrowserRedirect);
}

// 전역 노출
if (typeof window !== 'undefined') {
  window.isInAppBrowser = isInAppBrowser;
  window.handleExternalBrowserRedirect = handleExternalBrowserRedirect;
  window.initBrowserRedirect = initBrowserRedirect;
}

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', handleExternalBrowserRedirect);