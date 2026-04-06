// auth-ui.js - 인증 관련 UI 컴포넌트 및 인터랙션

import {
  handleGoogleLogin,
  handleEmailLogin,
  handleSignup,
  handleLogout
} from "./auth-core.js";

import {
  isUserLoggedIn,
  getCurrentUserName,
  isAdmin,
  isRestrictedPage
} from "./auth-utils.js";

import { Toast } from "../utils/toast.js";

import { isDevMode } from "../config/dev-config.js";
import {
  canAccessRestrictedContent,
  setupRestrictedLinkDelegation,
  syncLoginOverlays
} from "./access-guard.js";



// 페이지 로드 시 자동 모달 표시 방지 플래그
let isPageLoading = true;

// 페이지 로드 완료 시점 설정
if (document.readyState === 'loading') {
  // 문서가 아직 로딩 중
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      isPageLoading = false;
    }, 1000);
  });
} else {
  // 문서가 이미 로드됨
  setTimeout(() => {
    isPageLoading = false;
  }, 1000);
}

/**
 * 로그인 모달 표시
 */
export function showLoginModal() {
  // 모달이 존재하지 않으면 lazy 생성
  createLoginModal();

  const modal = document.getElementById('login-modal');
  if (modal) {
    // 인라인 display 제거 후 show 클래스 추가
    modal.style.removeProperty('display');
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }
}

/**
 * 로그인 모달 닫기
 */
export function closeLoginModal() {
  document.querySelectorAll('.login-modal.show').forEach(modal => {
    modal.classList.remove('show');
    modal.style.display = 'none';
  });
}

/**
 * 로그인 모달 동적 생성 (미니멀 디자인 적용)
 */
export function createLoginModal() {
  // 이미 모달이 존재하는지 확인
  let modal = document.getElementById('login-modal');
  if (modal) {
    return modal;
  }

  // 모달 생성
  modal = document.createElement('div');
  modal.id = 'login-modal';
  modal.className = 'login-modal';
  modal.style.display = 'none';

  // 모달 내용 설정 (미니멀 디자인 구조)
  modal.innerHTML = `
    <div class="login-modal-content">
      <div class="login-modal-close">&times;</div>
      
      <div class="login-modal-icon">
        <img src="/images/firstpenguin-logo3.png" alt="퍼스트펭귄" style="width: 50px;">
      </div>
      
      <h3>반가워요! 👋</h3>
      <p>더 깊은 학습을 위해 로그인해주세요.</p>
      
      <div class="login-form">
        <input type="email" id="login-email" placeholder="이메일" class="login-input">
        <input type="password" id="login-password" placeholder="비밀번호" class="login-input">
        
        <div id="login-error-message" class="error-message" style="display: none; color: #fa5252; font-size: 0.9rem; margin-bottom: 5px;"></div>
        
        <button class="btn-auth-primary auth-login-button">이메일로 로그인</button>
        
        <div class="login-separator">또는</div>
        
        <button class="btn-auth-google modern-google-button">
          <img src="/images/google_logo.png" alt="G"> Google로 계속하기
        </button>
        
        <div class="login-footer">
          계정이 없으신가요? <a href="#" id="show-signup-link">회원가입</a><br>
          <a href="#" id="forgot-password-link" style="color: #adb5bd; font-size: 0.85rem; margin-top: 8px; display: inline-block;">비밀번호 찾기</a>
        </div>
      </div>
    </div>
  `;


  // 모달을 body에 추가
  document.body.appendChild(modal);

  // 이벤트 리스너 설정
  setupLoginModalEvents(modal);

  return modal;
}

// 개발 모드에서는 로그인 모달을 표시하지 않음
// (개발 모드 체크는 각 함수 내부에서 처리됨)
if (isDevMode()) {
  if (window.Logger && window.Logger.isDev()) {
    console.log('개발 모드: 로그인 모달 표시 건너뜀');
  }
  // 모듈 최상위 레벨에서는 return을 사용할 수 없으므로 제거
  // 개발 모드 체크는 각 함수 내부에서 처리됨
}



/**
 * 로그인 모달 닫기
 */




function setupLoginModalEvents(modal) {
  // 이미 이벤트가 부착된 경우 중복 방지
  if (modal.dataset.eventsAttached) return;
  modal.dataset.eventsAttached = 'true';

  // 닫기 버튼
  const closeButton = modal.querySelector('.login-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', closeLoginModal);
  }

  // 모달 외부 클릭 시 닫기 (오버레이 포인터 인터셉트 최소화)
  modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) {
      closeLoginModal();
    }
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', function escHandler(ev) {
    if (ev.key === 'Escape') {
      closeLoginModal();
      document.removeEventListener('keydown', escHandler);
    }
  });

  // 로그인 버튼
  const loginButton = modal.querySelector('.auth-login-button');
  if (loginButton) {
    loginButton.addEventListener('click', async () => {
      const email = document.getElementById('login-email')?.value;
      const password = document.getElementById('login-password')?.value;

      try {
        await handleEmailLogin(email, password);
      } catch (error) {
        console.error('로그인 오류:', error);
        Toast.error(error.message || '로그인 중 오류가 발생했습니다.');
      }
    });
  }

  // Google 로그인 버튼
  const googleButton = modal.querySelector('.modern-google-button');
  if (googleButton) {
    googleButton.addEventListener('click', async () => {
      const originalText = googleButton.innerHTML;
      googleButton.disabled = true;
      googleButton.innerHTML = '<span class="spinner"></span> Google 로그인 중...';
      try {
        // 로그인 시작 시 모달 즉시 숨김 (체감 속도 개선)
        closeLoginModal();
        const result = await handleGoogleLogin();
        if (result === null) {
          Toast.info('로그인 창으로 이동합니다. 완료 후 자동으로 반영됩니다.');
        }
      } catch (error) {
        console.error('Google 로그인 오류:', error);
        Toast.error(error?.message || 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
        // 에러 시 모달 다시 표시
        showLoginModal();
      } finally {
        googleButton.disabled = false;
        googleButton.innerHTML = originalText;
      }
    });
  }

  // 회원가입 링크
  const signupLink = modal.querySelector('#show-signup-link');
  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSignupForm();
    });
  }

  // 비밀번호 재설정 링크
  const forgotPasswordLink = modal.querySelector('#forgot-password-link');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showPasswordResetForm();
    });
  }
}

/**
 * 로그인 필요 알림 모달 생성
 */
/**
 * 로그인 필요 알림 모달 생성 (미니멀 디자인)
 */
export function createLoginRequiredModal() {
  // 이미 존재하는지 확인
  if (document.getElementById('login-required-modal')) {
    return document.getElementById('login-required-modal');
  }

  // 모달 요소 생성
  const modal = document.createElement('div');
  modal.id = 'login-required-modal';
  modal.className = 'login-modal';
  modal.style.display = 'none';

  // 모달 내용 설정
  modal.innerHTML = `
    <div class="login-modal-content">
      <div class="login-modal-close">&times;</div>
      <div class="login-modal-icon">
        <span class="lock-icon">🔒</span>
      </div>
      <h3>로그인이 필요합니다</h3>
      <p>이 기능은 로그인 후 이용하실 수 있습니다.<br>무료로 가입하고 모든 문제를 풀어보세요.</p>
      <button class="btn-auth-primary login-now-button">지금 로그인하기</button>
    </div>
  `;

  // 모달을 body에 추가
  document.body.appendChild(modal);

  // 이벤트 리스너 설정
  requestAnimationFrame(() => {
    // 닫기 버튼
    const closeButton = modal.querySelector('.login-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', closeLoginModal);
    }

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('mousedown', function (event) {
      if (event.target === modal) {
        closeLoginModal();
      }
    });

    // 로그인 버튼 (모달 교체)
    const loginButton = modal.querySelector('.login-now-button');
    if (loginButton) {
      loginButton.addEventListener('click', function () {
        closeLoginModal(); // 현재 모달 닫기
        setTimeout(() => {
          showLoginModal(); // 로그인 모달 열기 (약간의 텀을 두어 자연스럽게)
        }, 150);
      });
    }
  });

  return modal;
}


/**
 * 인증 UI 초기화 - 모달 생성 및 이벤트 설정
 */
/**
 * 인증 UI 초기화 - 모달 생성 및 이벤트 설정
 */
export function initAuthUI() {
  if (window.Logger && window.Logger.isDev()) {
    console.log('인증 UI 초기화 중...');
  }

  // 모달은 미리 생성하지 않음 — showLoginModal() 호출 시 lazy 생성

  // 로그인 버튼 이벤트 연결 (DOM이 준비된 후 실행되도록 보장)
  const attachEvents = () => {
    document.querySelectorAll('[data-action="show-login"]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal();
      });
    });

    document.querySelectorAll('[data-action="logout"]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    });

    document.querySelectorAll('[data-action="show-signup"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm();
      });
    });

    document.querySelectorAll('[data-action="close-modal"]').forEach(button => {
      button.addEventListener('click', closeLoginModal);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachEvents);
  } else {
    attachEvents();
  }

  // 현재 로그인 상태에 따라 UI 업데이트
  updateLoginUI();
  updateRestrictedContent();

  if (window.Logger && window.Logger.isDev()) {
    console.log('인증 UI 초기화 완료');
  }
}

// DOM 로드 시 인증 UI 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 호환성을 위한 별칭 설정
    window.이름 = showLoginModal;
    window.showLoginModal = showLoginModal; // 명시적 전역 할당
    initAuthUI();
  });
} else {
  // 이미 로드된 경우 즉시 실행
  window.이름 = showLoginModal;
  window.showLoginModal = showLoginModal;
  initAuthUI();
}

/**
 * 회원가입 폼 제출 처리
 */
export async function handleSignupSubmit() {
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (!email || !password) {
    Toast.warning('이메일과 비밀번호를 모두 입력해주세요.');
    return;
  }

  if (password !== confirmPassword) {
    Toast.error('비밀번호가 일치하지 않습니다.');
    return;
  }

  // 로딩 표시
  const signupButton = document.querySelector('.signup-button') ||
    document.querySelector('.auth-signup-button');
  if (signupButton) {
    signupButton.innerHTML = '<span class="spinner"></span> 가입 중...';
    signupButton.disabled = true;
  }

  try {
    // auth-core.js의 handleSignup 함수 호출
    const user = await handleSignup(email, password, name);
    console.log('회원가입 성공:', user);

    // 이메일 인증 안내 메시지 표시
    Toast.success('회원가입이 완료되었습니다! 이메일로 발송된 인증 링크를 확인하여 계정을 활성화해주세요.', '가입 성공', 5000);

    // 모달 닫기 및 페이지 새로고침
    closeLoginModal();
    // Toast를 볼 시간을 주기 위해 지연 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error) {
    console.error('회원가입 오류:', error);
    Toast.error(error.message || '회원가입 중 오류가 발생했습니다.');

    // 버튼 상태 복원
    if (signupButton) {
      signupButton.innerHTML = '가입하기';
      signupButton.disabled = false;
    }
  }
}

/**
 * Google 계정으로 회원가입
 */
export async function handleGoogleSignup() {
  // Google 로그인과 동일한 프로세스 사용 (Firebase에서는 Google 로그인 = 회원가입)
  try {
    // 로딩 표시
    const googleButton = document.querySelector('.auth-social-button');
    if (googleButton) {
      googleButton.innerHTML = '<span class="spinner"></span> 처리 중...';
      googleButton.disabled = true;
    }

    // auth-core.js의 handleGoogleLogin 함수 호출
    const user = await handleGoogleLogin();
    console.log('Google 계정으로 가입/로그인 성공:', user);

    Toast.success('Google 계정으로 로그인되었습니다.');

    // 모달 닫기
    closeLoginModal();

    // 페이지 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error('Google 계정 가입/로그인 오류:', error);
    Toast.error('Google 계정으로 가입 중 오류가 발생했습니다.');

    // 버튼 상태 복원
    const googleButton = document.querySelector('.auth-social-button');
    if (googleButton) {
      googleButton.innerHTML = '<img src="/images/google_logo.png" alt="G" class="google-logo"> Google로 회원가입';
      googleButton.disabled = false;
    }
  }
}

/**
 * 로그인 폼 표시 (간단한 구현)
 */
export function showLoginForm() {
  // 기존 모달 닫고 새로 열기
  closeLoginModal();
  showLoginModal();

  console.log('로그인 폼 표시 (간단 구현)');
}

export function showSignupForm() {
  console.log('회원가입 폼 표시 시작');

  const loginModal = document.getElementById('login-modal');
  if (!loginModal) {
    console.error('로그인 모달을 찾을 수 없습니다.');
    return;
  }

  const modalContent = loginModal.querySelector('.login-modal-content');
  if (modalContent) {
    modalContent.innerHTML = `
      <div class="modal-header">
        <button class="back-button" style="position: absolute; top: 15px; left: 15px; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background-color 0.2s ease;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="#555555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="login-modal-close">&times;</span>
      </div>
      <div class="login-modal-icon">
        <img src="/images/firstpenguin-logo3.png" alt="퍼스트펭귄" class="modal-logo">
      </div>
      <h3>회원가입</h3>
      <div class="login-form">
        <input type="text" id="signup-name" placeholder="이름" class="login-input">
        <input type="email" id="signup-email" placeholder="이메일" class="login-input">
        <input type="password" id="signup-password" placeholder="비밀번호" class="login-input">
        <input type="password" id="signup-confirm-password" placeholder="비밀번호 확인" class="login-input">
        <div id="signup-error-message" class="error-message" style="display: none; color: red; margin-bottom: 10px;"></div>
        <button class="auth-social-button auth-signup-button">가입하기</button>
        <div class="separator">
          <span>또는</span>
        </div>
        <button class="auth-social-button">
          <img src="/images/google_logo.png" alt="G" class="google-logo"> Google로 회원가입
        </button>
        <p class="login-option-text">이미 계정이 있으신가요? <a href="#" id="show-login-link">로그인</a></p>
      </div>
    `;

    // 회원가입 버튼 스타일 직접 적용
    const signupButton = modalContent.querySelector('.auth-signup-button');
    if (signupButton) {
      signupButton.style.backgroundColor = '#34A853';
      signupButton.style.color = 'white';
      signupButton.style.padding = '14px';
      signupButton.style.borderRadius = '8px';
      signupButton.style.fontWeight = '500';
      signupButton.style.boxShadow = '0 2px 4px rgba(52, 168, 83, 0.3)';
      signupButton.style.transition = 'all 0.2s ease';
    }

    // Google 회원가입 버튼 스타일 적용
    const googleButton = modalContent.querySelector('.auth-social-button:not(.auth-signup-button)');
    if (googleButton) {
      googleButton.style.backgroundColor = 'white';
      googleButton.style.color = '#5f6368';
      googleButton.style.border = '1px solid #dadce0';
      googleButton.style.padding = '14px';
      googleButton.style.borderRadius = '8px';
      googleButton.style.transition = 'all 0.2s ease';
    }

    // 뒤로가기 버튼 스타일 및 호버 효과 추가
    const backButton = modalContent.querySelector('.back-button');
    if (backButton) {
      backButton.addEventListener('mouseover', () => {
        backButton.style.backgroundColor = 'rgba(0,0,0,0.05)';
      });

      backButton.addEventListener('mouseout', () => {
        backButton.style.backgroundColor = 'transparent';
      });

      backButton.addEventListener('click', () => {
        const currentDisplay = loginModal.style.display;
        loginModal.remove();
        createLoginModal();
        const newModal = document.getElementById('login-modal');
        if (newModal && currentDisplay === 'flex') {
          showLoginModal();
        }
      });
    }

    // 닫기 버튼
    const closeButton = modalContent.querySelector('.login-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', closeLoginModal);
    }

    // 회원가입 버튼
    if (signupButton) {
      signupButton.addEventListener('click', handleSignupSubmit);
    }

    // Google 로그인 버튼
    if (googleButton) {
      googleButton.addEventListener('click', handleGoogleSignup);
    }

    // 로그인 링크
    const loginLink = modalContent.querySelector('#show-login-link');
    if (loginLink) {
      loginLink.addEventListener('click', function (e) {
        e.preventDefault();
        const currentDisplay = loginModal.style.display;
        loginModal.remove();
        createLoginModal();
        const newModal = document.getElementById('login-modal');
        if (newModal && currentDisplay === 'flex') {
          showLoginModal();
        }
      });
    }
  }

  console.log('회원가입 폼 표시 완료');
}

/**
 * 로그인 상태 UI 업데이트
 */
export function updateLoginUI() {
  const isLoggedIn = window.isUserLoggedIn ? window.isUserLoggedIn() : false;

  // 헤더 로그인 버튼 업데이트
  const loginButtons = document.querySelectorAll('.login-button');
  const userInfoElements = document.querySelectorAll('.user-info');
  const logoutButtons = document.querySelectorAll('.logout-button');

  loginButtons.forEach(button => {
    button.style.display = isLoggedIn ? 'none' : 'block';
  });

  userInfoElements.forEach(element => {
    element.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) {
      const nameElement = element.querySelector('#user-name') || element;
      nameElement.textContent = getCurrentUserName();
    }
  });

  logoutButtons.forEach(button => {
    button.style.display = isLoggedIn ? 'block' : 'none';
  });

  // 제한된 콘텐츠 업데이트 (내부적으로 syncLoginOverlays 포함)
  updateRestrictedContent();

  // Body 클래스 토글 (CSS 제어용)
  document.body.classList.toggle('logged-in', isLoggedIn);

  // loginStateChanged 이벤트는 auth-core.js에서 isAdmin 포함하여 발생시킴
  // 여기서 중복 발생시키지 않음 (isAdmin 없이 발생하면 햄버거 메뉴 관리자 링크 누락)
}

/**
 * 제한된 콘텐츠 업데이트
 */
export function updateRestrictedContent(isLoggedIn) {
  // 일부 호출부가 false를 넘겨도 실제 로그인 상태(프로필 표시/Firebase 상태)가 true면 우선 적용
  const effectiveLoggedIn = isLoggedIn === true || canAccessRestrictedContent();

  // 제한된 콘텐츠 요소 업데이트
  const restrictedElements = document.querySelectorAll('.restricted-content');
  restrictedElements.forEach(el => {
    if (effectiveLoggedIn) {
      el.classList.remove('content-blurred');
      el.classList.remove('content-locked');
      el.style.filter = 'none';
      el.style.pointerEvents = 'auto';
    } else {
      el.classList.add('content-blurred');
      el.style.filter = '';
      el.style.pointerEvents = 'none';
    }
  });

  // 블러된 콘텐츠 클릭 시 로그인 모달 표시
  if (!effectiveLoggedIn) {
    restrictedElements.forEach(el => {
      if (!el.dataset.blurClickBound) {
        el.dataset.blurClickBound = 'true';
        // ::before 영역(로그인 뱃지) 클릭 감지를 위해 부모에 이벤트 위임
        el.addEventListener('click', (e) => {
          if (el.classList.contains('content-blurred')) {
            showLoginModal();
          }
        });
      }
    });
  }

  setupRestrictedLinkDelegation(document);
}

/**
 * 페이지 링크 클릭 시 로그인 체크
 * @param {string} url - 이동할 URL
 */
export function checkLoginBeforeRedirect(url) {
  if (isUserLoggedIn()) {
    window.location.href = url;
  } else {
    showLoginModal();
  }
}

// 전역 객체에 함수 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.showLoginModal = showLoginModal;
  window.closeLoginModal = closeLoginModal;
  window.showSignupForm = showSignupForm;
  window.showLoginForm = showLoginForm;
  window.updateLoginUI = updateLoginUI;
  window.updateRestrictedContent = updateRestrictedContent;
  window.checkLoginBeforeRedirect = checkLoginBeforeRedirect;
  window.handleSignupSubmit = handleSignupSubmit;
  window.handleGoogleSignup = handleGoogleSignup;
  window.이름 = showLoginModal;  // 별칭으로 유지 (호환성)
}

// 모듈 내보내기
export default {
  showLoginModal,
  closeLoginModal,
  updateLoginUI,
  updateRestrictedContent,
  checkLoginBeforeRedirect,
  showLoginForm
};


// ... (Previous code remains)

// Function removed: addLoginModalStyles (Styles are now in css/login.css)

export function showPasswordResetForm() {
  console.log('비밀번호 재설정 폼 표시 시작');

  const loginModal = document.getElementById('login-modal');
  if (!loginModal) {
    console.error('로그인 모달을 찾을 수 없습니다.');
    return;
  }

  const modalContent = loginModal.querySelector('.login-modal-content');
  if (modalContent) {
    modalContent.innerHTML = `
      <div class="modal-header">
        <button class="back-button" style="position: absolute; top: 15px; left: 15px; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background-color 0.2s ease;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="#555555" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="login-modal-close">&times;</span>
      </div>
      <div class="login-modal-icon">
        <img src="/images/firstpenguin-logo3.png" alt="퍼스트펭귄" class="modal-logo">
      </div>
      <h3>비밀번호 재설정</h3>
      <p>가입하신 이메일 주소를 입력하시면 비밀번호 재설정 안내를 보내드립니다.</p>
      <div class="login-form">
        <input type="email" id="reset-email" placeholder="이메일" class="login-input">
        <div id="reset-error-message" class="error-message" style="display: none; color: red; margin-bottom: 10px;"></div>
        <button class="auth-social-button auth-reset-button" style="background-color: #4285F4; color: white; padding: 14px; border-radius: 8px; font-weight: 500; box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3); transition: all 0.2s ease;">비밀번호 재설정 메일 보내기</button>
      </div>
    `;

    // 뒤로가기 버튼 스타일 및 호버 효과 추가
    const backButton = modalContent.querySelector('.back-button');
    if (backButton) {
      backButton.addEventListener('mouseover', () => {
        backButton.style.backgroundColor = 'rgba(0,0,0,0.05)';
      });

      backButton.addEventListener('mouseout', () => {
        backButton.style.backgroundColor = 'transparent';
      });

      backButton.addEventListener('click', () => {
        const currentDisplay = loginModal.style.display;
        loginModal.remove();
        createLoginModal();
        const newModal = document.getElementById('login-modal');
        if (newModal && currentDisplay === 'flex') {
          showLoginModal();
        }
      });
    }

    // 닫기 버튼
    const closeButton = modalContent.querySelector('.login-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', closeLoginModal);
    }

    // 재설정 버튼
    const resetButton = modalContent.querySelector('.auth-reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', handlePasswordReset);
    }
  }

  console.log('비밀번호 재설정 폼 표시 완료');
}

import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../core/firebase-core.js";


export async function handlePasswordReset() {
  const email = document.getElementById('reset-email')?.value;

  if (!email) {
    alert('이메일을 입력해주세요.');
    return;
  }

  // 로딩 표시
  const resetButton = document.querySelector('.auth-reset-button');
  if (resetButton) {
    resetButton.innerHTML = '<span class="spinner"></span> 처리 중...';
    resetButton.disabled = true;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert('비밀번호 재설정 이메일이 발송되었습니다. 메일함을 확인해주세요.');
    closeLoginModal();
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);

    // 버튼 상태 복원
    if (resetButton) {
      resetButton.innerHTML = '비밀번호 재설정 메일 보내기';
      resetButton.disabled = false;
    }

    // 오류 메시지
    let errorMessage = "비밀번호 재설정 중 오류가 발생했습니다.";
    if (error.code === 'auth/user-not-found') {
      errorMessage = "해당 이메일로 가입된 계정을 찾을 수 없습니다.";
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = "유효하지 않은 이메일 형식입니다.";
    }

    // 오류 표시
    const errorElement = document.getElementById('reset-error-message');
    if (errorElement) {
      errorElement.textContent = errorMessage;
      errorElement.style.display = 'block';
    } else {
      alert(errorMessage);
    }
  }
}