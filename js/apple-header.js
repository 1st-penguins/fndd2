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

    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !hamburger.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }

  // 경로 prefix (하위 폴더 감지)
  const path = window.location.pathname;
  const isSubDir = path.includes('/exam/') || path.includes('/admin/') ||
    path.includes('/notices/') || path.includes('/subjects') || path.includes('/years');
  const prefix = isSubDir ? '../' : '';

  // 신뢰할 수 있는 소스(loginStateChanged 이벤트)에서 업데이트했는지 추적
  let authFromEvent = false;

  // 로그인 상태 UI 업데이트
  function updateHeaderAuth(isLoggedIn, isAdminFlag, fromEvent) {
    if (fromEvent) authFromEvent = true;
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
        // isAdminFlag가 명시적으로 전달되면 사용, 아니면 window.isAdmin() 시도
        const isAdminUser = isAdminFlag !== undefined
          ? isAdminFlag
          : (typeof window.isAdmin === 'function' && window.isAdmin());

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
            if (typeof window.handleLogout === 'function') {
              window.handleLogout();
            } else if (typeof window.logout === 'function') {
              window.logout();
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

  // loginStateChanged 이벤트 (auth-core.js에서 발생) — 가장 신뢰할 수 있는 소스
  window.addEventListener('loginStateChanged', (e) => {
    const detail = e.detail || {};
    updateHeaderAuth(detail.isLoggedIn, detail.isAdmin, true);
    // 이벤트 수신 후 폴링 불필요
    clearInterval(interval);
  });

  // 초기 상태 동기화 — auth 모듈 초기화 전 폴링 (이벤트 수신 전까지만)
  function trySync() {
    // 이벤트 기반 업데이트가 이미 되었으면 폴링 중단
    if (authFromEvent) return true;

    if (typeof window.isUserLoggedIn === 'function') {
      updateHeaderAuth(window.isUserLoggedIn());
      return true;
    }
    if (window.__authStateResolved) {
      updateHeaderAuth(!!window.__lastAuthState);
      return true;
    }
    return false;
  }

  // 500ms 간격으로 최대 30번(15초) 시도
  let attempts = 0;
  const interval = setInterval(() => {
    if (authFromEvent) { clearInterval(interval); return; }
    attempts++;
    if (trySync() || attempts > 30) {
      clearInterval(interval);
    }
  }, 500);

  // 즉시 한 번 시도
  trySync();
})();
