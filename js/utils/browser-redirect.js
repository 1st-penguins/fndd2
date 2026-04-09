// browser-redirect.js - 내장 브라우저 감지 및 리다이렉트

/**
 * 내장 브라우저 감지 (카카오톡, 인스타그램, 네이버 등)
 * @returns {boolean} 내장 브라우저 여부
 */
export function isInAppBrowser() {
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '');
  const uaLower = ua.toLowerCase();

  // 데스크톱/에디터 내장 브라우저 오탐 방지: 모바일 환경에서만 판정
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);
  if (!isMobile) return false;

  // 1) 대표적인 인앱 브라우저 식별자
  if (uaLower.includes('kakaotalk')) return true;
  if (uaLower.includes('instagram')) return true;
  if (uaLower.includes('fban') || uaLower.includes('fbav')) return true;
  if (uaLower.includes('line/')) return true;
  if (uaLower.includes('naver')) return true;
  if (uaLower.includes('band/')) return true;
  if (uaLower.includes('everytimeapp')) return true;
  if (uaLower.includes('daumapps')) return true;

  // 2) Android WebView 범용 감지: "wv" 플래그가 있으면 WebView
  if (/Android.*; wv\)/.test(ua)) return true;

  // 3) iOS WebView 범용 감지: 모바일 Safari가 아닌데 iPhone인 경우
  //    정상 Safari UA에는 "Safari/" 가 포함되지만, WebView에는 없음
  if (/iPhone|iPad|iPod/.test(ua) && !ua.includes('Safari/')) return true;

  return false;
}

/**
 * 외부 브라우저로 리다이렉트 (Android: intent, iOS: 안내 배너)
 * @returns {boolean} 리다이렉트가 실행되었는지 여부
 */
export function handleExternalBrowserRedirect() {
  if (!isInAppBrowser()) return false;

  const ua = navigator.userAgent || '';
  const currentUrl = window.location.href;

  // Android: intent 스킴으로 Chrome 열기
  if (/Android/i.test(ua)) {
    // URL을 정확히 인코딩하여 intent 전달
    const intentUrl = 'intent://' + window.location.host + window.location.pathname
      + window.location.search + window.location.hash
      + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='
      + encodeURIComponent(currentUrl) + ';end';
    window.location.href = intentUrl;
    return true;
  }

  // iOS: Safari로 강제 전환이 불가하므로 안내 배너 표시
  if (/iPhone|iPad|iPod/i.test(ua)) {
    showInAppBrowserBanner();
    return true;
  }

  return false;
}

/**
 * iOS 인앱 브라우저 안내 배너 표시
 * Safari에서 열기를 유도하는 오버레이
 */
function showInAppBrowserBanner() {
  if (document.getElementById('inapp-browser-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'inapp-browser-banner';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    background: #1D2F4E; color: #fff;
    padding: 16px 20px; text-align: center;
    z-index: 99999; font-size: 14px; line-height: 1.5;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  `;

  banner.innerHTML = `
    <div style="max-width: 420px; margin: 0 auto;">
      <p style="margin: 0 0 8px; font-weight: 700;">
        인앱 브라우저에서는 구글 로그인이 제한됩니다
      </p>
      <p style="margin: 0 0 12px; font-size: 13px; opacity: 0.9;">
        아래 <b>Safari로 열기</b> 버튼을 누르거나,<br>
        우측 상단 <b>⋯</b> 메뉴 → <b>"Safari로 열기"</b>를 선택해주세요.
      </p>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button id="inapp-copy-url" style="
          background: #5FB2C9; color: #fff; border: none;
          padding: 10px 18px; border-radius: 8px; font-size: 14px;
          font-weight: 600; cursor: pointer;">
          URL 복사하기
        </button>
        <button id="inapp-close-banner" style="
          background: transparent; color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.3);
          padding: 10px 14px; border-radius: 8px; font-size: 14px;
          cursor: pointer;">
          닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('inapp-copy-url').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = document.getElementById('inapp-copy-url');
      btn.textContent = '복사 완료!';
      btn.style.background = '#28a745';
      setTimeout(() => {
        btn.textContent = 'URL 복사하기';
        btn.style.background = '#5FB2C9';
      }, 2000);
    }).catch(() => {
      // clipboard API 실패 시 fallback
      prompt('아래 URL을 복사하여 Safari에 붙여넣기 해주세요:', window.location.href);
    });
  });

  document.getElementById('inapp-close-banner').addEventListener('click', () => {
    banner.remove();
  });
}

/**
 * 초기화 함수 - 페이지 로드 시 자동 실행
 */
export function initBrowserRedirect() {
  if (window.Logger && window.Logger.isDev()) {
    console.log('브라우저 리다이렉트 기능 초기화...');
  }
}

// 전역 노출
if (typeof window !== 'undefined') {
  window.isInAppBrowser = isInAppBrowser;
  window.handleExternalBrowserRedirect = handleExternalBrowserRedirect;
  window.initBrowserRedirect = initBrowserRedirect;
}

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', handleExternalBrowserRedirect);