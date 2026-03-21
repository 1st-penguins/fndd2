/**
 * Apple-style Header — 햄버거 메뉴 + 로그인 상태 + 관리자 메뉴
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

  // 경로 prefix (하위 폴더 감지)
  const isSubDir = window.location.pathname.includes('/exam/') ||
    window.location.pathname.includes('/admin/') ||
    window.location.pathname.includes('/notices/') ||
    window.location.pathname.includes('/subjects') ||
    window.location.pathname.includes('/years');
  const prefix = isSubDir ? '../' : '';

  // 로그인 상태 UI 업데이트
  function updateHeaderAuth(isLoggedIn) {
    const loginBtn = document.getElementById('header-login-btn');
    const authSection = document.getElementById('menu-auth');

    const userName = typeof window.getCurrentUserName === 'function'
      ? window.getCurrentUserName() : '마이페이지';

    // 헤더 로그인 pill 버튼
    if (loginBtn) {
      if (isLoggedIn) {
        loginBtn.textContent = userName;
        loginBtn.href = prefix + 'mypage.html';
      } else {
        loginBtn.textContent = '로그인';
        loginBtn.href = '#';
      }
    }

    // 햄버거 메뉴 내 계정 영역
    if (authSection) {
      if (isLoggedIn) {
        // 관리자 확인
        const isAdminUser = typeof window.isAdmin === 'function' && window.isAdmin();

        let adminLinks = '';
        if (isAdminUser) {
          adminLinks = `
            <div class="header__menu-divider"></div>
            <a href="${prefix}admin/dashboard.html" class="header__menu-auth-link header__menu-auth-link--admin">대시보드</a>
            <a href="${prefix}admin/statistics.html" class="header__menu-auth-link header__menu-auth-link--admin">통계</a>
            <a href="${prefix}admin/notices.html" class="header__menu-auth-link header__menu-auth-link--admin">공지 관리</a>
            <a href="${prefix}admin/user-lookup.html" class="header__menu-auth-link header__menu-auth-link--admin">회원 조회</a>
            <a href="${prefix}admin/coupons.html" class="header__menu-auth-link header__menu-auth-link--admin">쿠폰 관리</a>
          `;
        }

        authSection.innerHTML = `
          <a href="${prefix}mypage.html" class="header__menu-auth-link">마이페이지</a>${adminLinks}
          <div class="header__menu-divider"></div>
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

        const menuLoginBtn = document.getElementById('menu-login');
        if (menuLoginBtn) {
          menuLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (menu) menu.classList.remove('open');
            if (typeof window.showLoginModal === 'function') {
              window.showLoginModal();
            }
          });
        }
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
