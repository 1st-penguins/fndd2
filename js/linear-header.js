// Linear Header JavaScript
// 헤더 스크롤 효과 및 모바일 메뉴 기능

// 중복 선언 방지
if (typeof window.LinearHeader === 'undefined') {
  class LinearHeader {
    constructor() {
      this.header = document.getElementById('linear-header');
      // 요소는 setupMobileMenu에서 다시 찾도록 함 (DOM 로드 시점 문제 해결)
      this.mobileToggle = document.getElementById('mobile-toggle');
      this.mobileMenu = document.getElementById('mobile-menu');
      this.isMenuOpen = false;

      // 로그인/로그아웃 상태 관리
      this.loginLink = document.getElementById('login-link');
      this.userProfileContainer = document.getElementById('user-profile-container');
      this.isLoggedIn = false;

      // 외부 클릭 핸들러 초기화
      this._outsideClickHandler = null;

      this.init();
    }

    init() {
      this.setupScrollEffect();
      this.setupMobileMenu();
      this.removeContactLinks();
      this.setupActiveLink();
      this.setupHomeTabNavigation();
      this.setupAuthButtons();
      this.updateAuthState();
      this.setupCertificateBadge(); // 🎯 자격증 배지 초기화

      // 접근성: 햄버거 버튼 ARIA 속성 기본값 설정
      if (this.mobileToggle) {
        this.mobileToggle.setAttribute('aria-label', this.mobileToggle.getAttribute('aria-label') || '메뉴');
        this.mobileToggle.setAttribute('aria-controls', this.mobileToggle.getAttribute('aria-controls') || 'mobile-menu');
        this.mobileToggle.setAttribute('aria-expanded', 'false');
      }
    }

    // 문의 링크 제거 (네비/모바일 메뉴)
    removeContactLinks() {
      const removeLinks = (root = document) => {
        const links = root.querySelectorAll('.linear-header__nav-link[href*="contact.html"]');
        links.forEach(link => {
          const listItem = link.closest('li');
          if (listItem) {
            listItem.remove();
          } else {
            link.remove();
          }
        });
      };

      removeLinks();

      if (this.mobileMenu) {
        removeLinks(this.mobileMenu);
      }
    }

    // 스크롤 효과 설정
    setupScrollEffect() {
      let lastScrollY = window.scrollY;
      let ticking = false;

      const updateHeader = () => {
        // ✅ null 체크 추가
        if (!this.header) {
          ticking = false;
          return;
        }

        const currentScrollY = window.scrollY;

        if (currentScrollY > 100) {
          this.header.classList.add('linear-header--scrolled');
        } else {
          this.header.classList.remove('linear-header--scrolled');
        }

        lastScrollY = currentScrollY;
        ticking = false;
      };

      const requestTick = () => {
        if (!ticking) {
          requestAnimationFrame(updateHeader);
          ticking = true;
        }
      };

      window.addEventListener('scroll', requestTick, { passive: true });
    }

    // 모바일 메뉴 설정
    setupMobileMenu() {
      // 요소를 다시 찾기 (DOM이 완전히 로드되지 않았을 수 있음)
      this.mobileToggle = document.getElementById('mobile-toggle');
      this.mobileMenu = document.getElementById('mobile-menu');
      
      if (!this.mobileToggle || !this.mobileMenu) {
        console.warn('⚠️ 햄버거 버튼 또는 모바일 메뉴 요소를 찾을 수 없습니다.', {
          mobileToggle: !!this.mobileToggle,
          mobileMenu: !!this.mobileMenu
        });
        return;
      }

      // 기존 이벤트 리스너 제거 (중복 방지)
      const newToggle = this.mobileToggle.cloneNode(true);
      this.mobileToggle.parentNode.replaceChild(newToggle, this.mobileToggle);
      this.mobileToggle = newToggle;

      let lastToggleTime = 0;
      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastToggleTime < 400) return; /* 터치 시 touchend + click 중복 방지 */
        lastToggleTime = now;
        this.toggleMobileMenu();
      };

      this.mobileToggle.addEventListener('click', handleToggle);
      // 모바일 터치 기기에서 클릭이 누락되거나 지연되는 경우 대비 (preventDefault로 합성 click 중복 방지)
      this.mobileToggle.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault();
        handleToggle(e);
      }, { passive: false });

      // 모바일 메뉴 링크 클릭 시 메뉴 닫기
      const mobileLinks = this.mobileMenu.querySelectorAll('.linear-header__nav-link');
      mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
          this.closeMobileMenu();
        });
      });

      // 외부 클릭 시 메뉴 닫기 (이벤트 위임 사용)
      if (!this._outsideClickHandler) {
        this._outsideClickHandler = (e) => {
          if (this.isMenuOpen &&
            this.mobileToggle &&
            this.mobileMenu &&
            !this.mobileToggle.contains(e.target) &&
            !this.mobileMenu.contains(e.target)) {
            this.closeMobileMenu();
          }
        };
        // 이벤트 캡처 단계에서 처리하여 다른 이벤트보다 먼저 실행
        document.addEventListener('click', this._outsideClickHandler, true);
      }
    }

    // 모바일 메뉴 토글
    toggleMobileMenu() {
      this.isMenuOpen = !this.isMenuOpen;

      if (this.isMenuOpen) {
        this.openMobileMenu();
      } else {
        this.closeMobileMenu();
      }
    }

    // 모바일 메뉴 열기
    openMobileMenu() {
      this.mobileToggle.classList.add('linear-header__mobile-toggle--active');
      this.mobileMenu.classList.add('linear-header__mobile-menu--active');
      this.isMenuOpen = true;

      // body 스크롤 방지
      document.body.style.overflow = 'hidden';

      // 접근성 상태 반영
      if (this.mobileToggle) {
        this.mobileToggle.setAttribute('aria-expanded', 'true');
      }
    }

    // 모바일 메뉴 닫기
    closeMobileMenu() {
      this.mobileToggle.classList.remove('linear-header__mobile-toggle--active');
      this.mobileMenu.classList.remove('linear-header__mobile-menu--active');
      this.isMenuOpen = false;

      // body 스크롤 복원
      document.body.style.overflow = '';

      // 접근성 상태 반영
      if (this.mobileToggle) {
        this.mobileToggle.setAttribute('aria-expanded', 'false');
      }
    }

    // 활성 링크 설정
    setupActiveLink() {
      const currentPath = window.location.pathname;
      const navLinks = document.querySelectorAll('.linear-header__nav-link');

      navLinks.forEach(link => {
        const href = link.getAttribute('href');

        // 현재 페이지와 일치하는 링크에 active 클래스 추가
        if (href === currentPath ||
          (currentPath === '/' && href === 'index.html') ||
          (currentPath === '/index.html' && href === 'index.html')) {
          link.classList.add('linear-header__nav-link--active');
        } else {
          link.classList.remove('linear-header__nav-link--active');
        }
      });
    }

    // 인증 버튼 설정
    setupAuthButtons() {
      // 데스크톱 로그인 링크 이벤트
      if (this.loginLink) {
        this.loginLink.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.lazyAuthAndShowLoginModal === 'function') {
            window.lazyAuthAndShowLoginModal();
          } else {
            this.showLoginModal();
          }
        });
      }

      // 모바일 로그인 링크 이벤트
      const mobileLoginLink = document.getElementById('mobile-login-link');
      if (mobileLoginLink) {
        mobileLoginLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeMobileMenu(); // 모바일 메뉴 닫기
          if (typeof window.lazyAuthAndShowLoginModal === 'function') {
            window.lazyAuthAndShowLoginModal();
          } else {
            this.showLoginModal();
          }
        });
      }

      // 데스크톱 로그아웃 링크/버튼 이벤트
      const logoutButton = this.userProfileContainer?.querySelector('[data-action="logout"]');
      if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.logout();
        });
      }

      // 모바일 로그아웃 링크 이벤트
      const mobileLogoutLink = document.getElementById('mobile-logout-link');
      if (mobileLogoutLink) {
        mobileLogoutLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeMobileMenu(); // 모바일 메뉴 닫기
          this.logout();
        });
      }
    }

    // 홈(index)에서 헤더 링크를 페이지 이동이 아닌 탭 전환으로 처리
    setupHomeTabNavigation() {
      const path = window.location.pathname || '/';
      const isHomePage = path === '/' || path.endsWith('/index.html');
      if (!isHomePage) return;

      const navLinks = document.querySelectorAll('.linear-header__nav-link[href]');
      navLinks.forEach(link => {
        const rawHref = (link.getAttribute('href') || '').trim();
        const href = rawHref.toLowerCase();

        // 공지사항 링크: /notice, /notices, notices.html 모두 메인 공지 탭으로 이동
        const isNoticeLink = href === '/notice' || href === '/notices'
          || href.endsWith('/notices') || href.endsWith('/notice')
          || href === 'notices.html' || href === '/notices.html';

        // 문제풀기 링크: index.html#quiz-tab / #quiz-tab
        const isQuizLink = href.includes('#quiz-tab');

        if (!isNoticeLink && !isQuizLink) return;

        link.addEventListener('click', (e) => {
          e.preventDefault();

          const targetTab = isNoticeLink ? 'notice-tab' : 'quiz-tab';
          const tabButton = document.querySelector(`.access-tabs .tab-button[data-tab="${targetTab}"]`);
          if (tabButton) {
            tabButton.click();
          }

          const mainContent = document.querySelector('.main-content');
          if (mainContent) {
            mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          if (this.isMenuOpen) {
            this.closeMobileMenu();
          }
        });
      });
    }

    // 로그인 모달 표시
    showLoginModal() {
      // 기존 인증 시스템의 로그인 모달 표시 함수 호출
      if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      } else {
        console.log('로그인 모달을 표시합니다.');
      }
    }

    // 로그아웃 처리
    logout() {
      // 기존 인증 시스템의 로그아웃 함수 호출
      if (typeof window.logout === 'function') {
        window.logout();
      } else {
        console.log('로그아웃합니다.');
        this.setLoggedInState(false);
      }
    }

    // 로그인 상태 설정
    setLoggedInState(isLoggedIn) {
      this.isLoggedIn = isLoggedIn;
      this.updateAuthState();
    }

    // 인증 상태에 따른 UI 업데이트
    updateAuthState() {
      // 데스크톱 인증 UI 업데이트
      if (this.loginLink && this.userProfileContainer) {
        if (this.isLoggedIn) {
          // 로그인된 상태: 로그인 링크 숨기고 사용자 프로필 표시
          this.loginLink.style.display = 'none';
          this.userProfileContainer.style.display = 'flex';
        } else {
          // 로그아웃된 상태: 사용자 프로필 숨기고 로그인 링크 표시
          this.loginLink.style.display = 'block';
          this.userProfileContainer.style.display = 'none';
        }
      }

      // 모바일 인증 UI 업데이트
      const mobileLoginLink = document.getElementById('mobile-login-link');
      const mobileUserProfileContainer = document.getElementById('mobile-user-profile-container');

      if (mobileLoginLink && mobileUserProfileContainer) {
        if (this.isLoggedIn) {
          // 로그인된 상태: 로그인 링크 숨기고 사용자 프로필 표시
          mobileLoginLink.style.display = 'none';
          mobileUserProfileContainer.style.display = 'block';

          // 사용자 정보 업데이트
          const mobileUserName = document.getElementById('mobile-user-name');
          const mobileUserAvatar = document.getElementById('mobile-user-avatar');
          if (mobileUserName && typeof window.getCurrentUserName === 'function') {
            const userName = window.getCurrentUserName();
            mobileUserName.textContent = userName || '사용자';
            if (mobileUserAvatar && userName) {
              mobileUserAvatar.textContent = userName.charAt(0).toUpperCase();
            }
          }
        } else {
          // 로그아웃된 상태: 사용자 프로필 숨기고 로그인 링크 표시
          mobileLoginLink.style.display = 'block';
          mobileUserProfileContainer.style.display = 'none';
        }
      }
    }

    // 기존 인증 시스템과 연동하여 상태 업데이트
    syncWithAuthSystem() {
      if (typeof window.isUserLoggedIn === 'function') {
        const isLoggedIn = window.isUserLoggedIn();
        this.setLoggedInState(isLoggedIn);

        // 사용자 이름 업데이트
        if (isLoggedIn && typeof window.getCurrentUserName === 'function') {
          const userName = window.getCurrentUserName();
          const userNameElement = document.getElementById('user-name');
          if (userNameElement) {
            userNameElement.textContent = userName;
          }
        }
      }
    }

    // 🎯 자격증 배지 설정 및 업데이트
    setupCertificateBadge() {
      this.headerBadge = document.getElementById('header-cert-badge');
      this.mobileBadge = document.getElementById('mobile-cert-badge');

      // 초기 자격증 설정
      this.updateCertificateBadge();

      // 자격증 변경 이벤트 리스너
      document.addEventListener('certificateTypeChanged', (e) => {
        this.updateCertificateBadge();
      });
    }

    // 자격증 배지 업데이트
    updateCertificateBadge() {
      const certType = localStorage.getItem('currentCertificateType') || 'health-manager';
      const certNames = {
        'health-manager': '건강운동관리사',
        'sports-instructor': '생활스포츠지도사'
      };

      const certName = certNames[certType] || '건강운동관리사';
      const certColor = certType === 'sports-instructor' ? '#059669' : '#1D2F4E';

      // CSS 변수 업데이트 (배지 색상)
      document.documentElement.style.setProperty('--cert-primary', certColor);

      // 데스크톱 배지 업데이트
      if (this.headerBadge) {
        this.headerBadge.textContent = certName;
      }

      // 모바일 배지 업데이트
      if (this.mobileBadge) {
        const nameElement = this.mobileBadge.querySelector('.mobile-cert-badge__name');
        if (nameElement) {
          nameElement.textContent = certName;
        }
      }

      console.log(`🏷️ 헤더 배지 업데이트: ${certName}`);
    }
  }

  // LinearHeader를 전역에 노출
  if (typeof window !== 'undefined') {
    window.LinearHeader = LinearHeader;
  }

} // if (typeof LinearHeader === 'undefined') 블록 종료

// 전역 헤더 인스턴스
let linearHeaderInstance = null;

// 🎯 전역 배지 업데이트 함수 (즉시 사용 가능)
// 주의: 이 함수는 인스턴스가 생성되기 전에도 호출될 수 있으므로 유지
window.updateHeaderCertificateBadge = function () {
  // 인스턴스가 있으면 인스턴스 메서드 사용 (중복 방지)
  if (linearHeaderInstance && linearHeaderInstance.updateCertificateBadge) {
    linearHeaderInstance.updateCertificateBadge();
    return;
  }

  // 인스턴스가 없을 때만 직접 업데이트
  const certType = localStorage.getItem('currentCertificateType') || 'health-manager';
  const certNames = {
    'health-manager': '건강운동관리사',
    'sports-instructor': '생활스포츠지도사'
  };

  const certName = certNames[certType] || '건강운동관리사';
  const certColor = certType === 'sports-instructor' ? '#059669' : '#1D2F4E';

  // CSS 변수 업데이트 (배지 색상)
  document.documentElement.style.setProperty('--cert-primary', certColor);

  // 데스크톱 배지 업데이트
  const headerBadge = document.getElementById('header-cert-badge');
  if (headerBadge) {
    headerBadge.textContent = certName;
  }

  // 모바일 배지 업데이트
  const mobileBadge = document.getElementById('mobile-cert-badge');
  if (mobileBadge) {
    const nameElement = mobileBadge.querySelector('.mobile-cert-badge__name');
    if (nameElement) {
      nameElement.textContent = certName;
    }
  }

  console.log(`🏷️ 헤더 배지 업데이트: ${certName}`);
};

// 🎯 certificateTypeChanged 이벤트 리스너는 클래스 내부에서만 처리
// (중복 방지를 위해 전역 리스너 제거)

// 🎯 loginStateChanged 이벤트 리스너 (auth-ui.js에서 발생)
// 중복 호출 방지를 위한 디바운싱
let loginStateSyncTimeout = null;
window.addEventListener('loginStateChanged', (e) => {
  // 이전 타임아웃 취소
  if (loginStateSyncTimeout) {
    clearTimeout(loginStateSyncTimeout);
  }
  
  // 100ms 디바운싱 (연속 호출 방지)
  loginStateSyncTimeout = setTimeout(() => {
    if (linearHeaderInstance) {
      const isLoggedIn = e.detail && e.detail.isLoggedIn;
      linearHeaderInstance.setLoggedInState(isLoggedIn);
      console.log('🔄 헤더 로그인 상태 동기화:', isLoggedIn);
    }
  }, 100);
});

// DOM 로드 완료 후 초기화
function initLinearHeader() {
  // window.LinearHeader를 사용하여 안전하게 인스턴스 생성
  if (window.LinearHeader) {
    linearHeaderInstance = new window.LinearHeader();

    // 전역에서 접근 가능하도록 설정
    window.linearHeader = linearHeaderInstance;

    // 기존 인증 시스템과 연동
    setupAuthSystemIntegration();

    // 🎯 초기 배지 업데이트는 setupCertificateBadge()에서 이미 처리됨
    // (중복 방지를 위해 여기서는 호출하지 않음)
    
    console.log('✅ LinearHeader 초기화 완료');
  } else {
    console.error('❌ LinearHeader 클래스가 정의되지 않았습니다.');
  }
}

// DOM이 이미 로드되었는지 확인
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinearHeader);
} else {
  // DOM이 이미 로드된 경우 즉시 실행
  initLinearHeader();
}

// 기존 인증 시스템과 연동 설정
function setupAuthSystemIntegration() {
  // 간단한 헤더 상태 업데이트 함수
  function updateHeaderAuthState() {
    const loginContainer = document.getElementById('login-button-container');
    const userContainer = document.getElementById('user-profile-container');

    if (loginContainer && userContainer) {
      if (typeof window.isUserLoggedIn === 'function' && window.isUserLoggedIn()) {
        // 로그인된 상태
        loginContainer.style.display = 'none';
        userContainer.style.display = 'flex';
      } else {
        // 로그아웃된 상태
        loginContainer.style.display = 'block';
        userContainer.style.display = 'none';
      }
    }
  }

  // 기존 updateLoginUI 함수를 오버라이드
  const originalUpdateLoginUI = window.updateLoginUI;
  if (originalUpdateLoginUI) {
    window.updateLoginUI = function () {
      // 기존 함수 실행
      originalUpdateLoginUI();

      // 헤더 상태도 업데이트
      updateHeaderAuthState();
    };
  }

  // 초기 상태 동기화
  updateHeaderAuthState();

  // 주기적으로 상태 확인 (1초마다)
  setInterval(updateHeaderAuthState, 1000);
}

// 페이지 로드 시 활성 링크 업데이트
window.addEventListener('load', () => {
  if (linearHeaderInstance) {
    linearHeaderInstance.setupActiveLink();
    // 페이지 로드 시에도 인증 상태 동기화
    linearHeaderInstance.syncWithAuthSystem();
  }
});
