/**
 * Apple-style Header — 로그인 상태 동기화 + 햄버거 메뉴
 */
(function () {
  // 햄버거 메뉴 토글
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
  }

  // 로그인 상태 UI 업데이트
  function updateHeaderAuth(isLoggedIn) {
    const loginBtn = document.getElementById('header-login-btn');
    const mobileLoginBtn = document.getElementById('mobile-login-btn');

    if (isLoggedIn) {
      const userName = typeof window.getCurrentUserName === 'function'
        ? window.getCurrentUserName() : '마이페이지';

      if (loginBtn) {
        loginBtn.textContent = userName;
        loginBtn.href = 'mypage.html';
      }
      if (mobileLoginBtn) {
        mobileLoginBtn.textContent = userName;
        mobileLoginBtn.href = 'mypage.html';
      }
    } else {
      if (loginBtn) {
        loginBtn.textContent = '로그인';
        loginBtn.href = '#';
      }
      if (mobileLoginBtn) {
        mobileLoginBtn.textContent = '로그인';
        mobileLoginBtn.href = '#';
      }
    }
  }

  // loginStateChanged 이벤트 리스너
  window.addEventListener('loginStateChanged', (e) => {
    const isLoggedIn = e.detail && e.detail.isLoggedIn;
    updateHeaderAuth(isLoggedIn);
  });

  // 초기 상태 동기화 — 여러 번 시도
  function syncInitialState() {
    if (typeof window.isUserLoggedIn === 'function') {
      updateHeaderAuth(window.isUserLoggedIn());
      return true;
    }
    return false;
  }

  // DOM 로드 후 반복 체크 (Firebase Auth 초기화 대기)
  function startSync() {
    if (syncInitialState()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (syncInitialState() || attempts > 20) {
        clearInterval(interval);
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSync);
  } else {
    startSync();
  }
})();
