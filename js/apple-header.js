/**
 * Apple-style Header — 햄버거 메뉴 + 로그인 상태 동기화
 */
(function () {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');

  // 햄버거 토글
  if (hamburger && menu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    // 메뉴 바깥 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }

  // 로그인 상태 UI 업데이트
  function updateHeaderAuth(isLoggedIn) {
    const authSection = document.getElementById('menu-auth');
    if (!authSection) return;

    if (isLoggedIn) {
      const userName = typeof window.getCurrentUserName === 'function'
        ? window.getCurrentUserName() : '사용자';

      authSection.innerHTML = `
        <a href="mypage.html" class="header__menu-auth-link">${userName}</a>
        <a href="#" class="header__menu-auth-link header__menu-auth-link--logout" id="menu-logout">로그아웃</a>
      `;

      const logoutBtn = document.getElementById('menu-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.logout === 'function') {
            window.logout();
          } else if (typeof window.handleLogout === 'function') {
            window.handleLogout();
          }
        });
      }
    } else {
      authSection.innerHTML = `
        <a href="#" class="header__menu-auth-link" id="menu-login">로그인</a>
      `;

      const loginBtn = document.getElementById('menu-login');
      if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
          e.preventDefault();
          menu.classList.remove('open');
          if (typeof window.showLoginModal === 'function') {
            window.showLoginModal();
          }
        });
      }
    }
  }

  // loginStateChanged 이벤트
  window.addEventListener('loginStateChanged', (e) => {
    updateHeaderAuth(e.detail && e.detail.isLoggedIn);
  });

  // 초기 상태 동기화
  function syncInitialState() {
    if (typeof window.isUserLoggedIn === 'function') {
      updateHeaderAuth(window.isUserLoggedIn());
      return true;
    }
    return false;
  }

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
