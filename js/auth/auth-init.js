// auth-init.js - 인증 초기화 및 이벤트 설정

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../core/firebase-core.js";
import { handleLogout } from "./auth-core.js";
import { isUserLoggedIn, isAdmin, isRestrictedPage, setLoggedIn, clearLoginState } from "./auth-utils.js";
import { showLoginModal, closeLoginModal, showSignupForm, updateLoginUI, updateRestrictedContent } from "./auth-ui.js";
import { initBrowserRedirect } from "../utils/browser-redirect.js";

/**
 * 인증 초기화 및 이벤트 설정
 * @param {Object} options - 초기화 옵션
 * @param {boolean} options.requireLogin - 로그인 필수 여부
 * @param {boolean} options.autoShowLogin - 비로그인 시 자동으로 로그인 모달 표시
 */
export function initAuth(options = {}) {
  const { requireLogin = false, autoShowLogin = false } = options;
  
  console.log('인증 초기화 중...');
  
  // 브라우저 리다이렉트 초기화 추가
  initBrowserRedirect();
  
  // 인증 상태 변경 감지
  onAuthStateChanged(auth, user => {
    console.log('인증 상태 변경:', user ? '로그인됨' : '로그아웃 상태');
    
    if (user) {
      // 로그인 상태 저장
      setLoggedIn(user);
      
      // 관리자 탭 업데이트
      updateAdminUI(isAdmin(user));
    } else {
      // 로그아웃 상태 처리
      clearLoginState();
      
      // 로그인 필수 페이지인 경우 모달 표시
      if (requireLogin || (isRestrictedPage() && autoShowLogin)) {
        showLoginModal();
      }
    }
    
    // UI 업데이트
    updateLoginUI();
    updateRestrictedContent();
  });
  
  // UI 요소 이벤트 연결
  setupUIEvents();
  
  console.log('인증 초기화 완료');
}

/**
 * UI 요소에 이벤트 리스너 설정
 */
function setupUIEvents() {
  // data-action 속성을 사용한 요소 이벤트 연결
  document.addEventListener('click', function(event) {
    // 클릭된 요소 또는 부모 요소 중 data-action 속성을 가진 요소 찾기
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    
    // 기본 동작 방지
    event.preventDefault();
    
    // 액션 실행
    const action = actionElement.getAttribute('data-action');
    executeAction(action);
  });
  
  // 키보드 이벤트 처리
  document.addEventListener('keydown', function(event) {
    // 로그인 폼의 비밀번호 입력에서 Enter 키 누르면 로그인 시도
    if (event.key === 'Enter' && 
        event.target.id === 'login-password' && 
        document.getElementById('login-modal')?.style.display === 'flex') {
      const loginButton = document.querySelector('.login-now-button') || 
                         document.querySelector('.auth-login-button');
      if (loginButton) {
        loginButton.click();
      }
    }
  });
}

/**
 * 데이터 액션 실행
 * @param {string} action - 액션 이름
 */
function executeAction(action) {
  switch (action) {
    case 'show-login':
      showLoginModal();
      break;
    case 'close-modal':
      closeLoginModal();
      break;
    case 'show-signup':
      showSignupForm();
      break;
    case 'signup-submit':
      handleSignupSubmit();
      break;
    case 'google-signup':
      handleGoogleSignup();
      break;
    case 'logout':
      handleLogout();
      break;
    default:
      console.warn('알 수 없는 액션:', action);
  }
}

/**
 * 관리자 UI 업데이트
 * @param {boolean} isAdmin - 관리자 여부
 */
function updateAdminUI(isAdmin) {
  // 관리자 전용 요소 표시/숨김
  document.querySelectorAll('.admin-only').forEach(element => {
    if (isAdmin) {
      // sub-tab-button은 CSS :not(.admin-only)로 제외되어 기본 display 없음
      if (element.classList.contains('sub-tab-button')) {
        element.style.display = 'inline-block';
      } else {
        element.style.display = '';
      }
    } else {
      element.style.display = 'none';
    }
  });
}

// 페이지 로드 시 자동 초기화 (로그인 모달 자동 표시 안 함)
document.addEventListener('DOMContentLoaded', () => {
  // 현재 페이지가 로그인 필수 페이지인지 확인
  const requireLogin = document.body.classList.contains('require-login');
  
  // 인증 초기화 (홈페이지 디자인을 위해 자동 모달 비활성화)
  initAuth({
    requireLogin,
    autoShowLogin: false  // 홈페이지에서 자동으로 모달 표시 안 함
  });
});

// 전역 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.initAuth = initAuth;
}

export default {
  initAuth
};