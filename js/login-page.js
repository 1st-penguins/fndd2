// login-page.js - 로그인 페이지 컨트롤러

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { ensureFirebase } from "./core/firebase-core.js";
import { 
  handleGoogleLogin, 
  handleEmailLogin, 
  handleSignup, 
  handleLogout 
} from "./auth/auth-core.js";
import { 
  showLoginModal, 
  closeLoginModal, 
  showSignupForm, 
  showLoginForm 
} from "./auth/auth-ui.js";
import { 
  isUserLoggedIn, 
  getCurrentUserName, 
  clearLoginState 
} from "./auth/auth-utils.js";

/**
 * 로그인 페이지 초기화
 */
function initLoginPage() {
  // 로그인 페이지에서는 Firebase를 즉시 초기화 (모바일 호환)
  ensureFirebase().catch(() => {});
  // 세션 클리어 제거 또는 조건부 실행
  // 로그인 페이지에서만 세션 클리어 (다른 페이지에서는 유지)
  if (window.location.pathname.includes('login.html')) {
    clearFirebaseSession();
  }
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 현재 로그인 상태 확인
  checkCurrentLoginStatus();
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 데이터 속성을 통한 액션 처리
  document.addEventListener('click', function(event) {
    // 클릭된 요소 또는 그 상위 요소 중에 data-action 속성을 가진 요소 찾기
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    
    // 이벤트 기본 동작 방지
    event.preventDefault();
    
    // 액션 실행
    const action = actionElement.getAttribute('data-action');
    executeAction(action, actionElement);
  });
  
  // 모달 외부 클릭 시 닫기
  document.getElementById('login-modal')?.addEventListener('click', function(event) {
    if (event.target === this) {
      closeLoginModal();
    }
  });
  
  // 이메일 로그인 폼 엔터 키 처리
  document.getElementById('login-password')?.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      handleEmailLoginAction();
    }
  });

  // 회원가입 링크 클릭 처리 (기존 코드 외에 추가)
  document.getElementById('show-signup-link')?.addEventListener('click', function(event) {
    event.preventDefault();
    showSignupForm();
  });
}

/**
 * 액션 실행
 * @param {string} action - 액션 이름
 * @param {HTMLElement} element - 액션 요소
 */
function executeAction(action, element) {
  switch (action) {
    case 'show-login':
      showLoginModal();
      break;
    case 'close-modal':
      closeLoginModal();
      break;
    case 'show-email-login':
      showLoginModal();
      break;
    case 'email-login':
      handleEmailLoginAction();
      break;
    case 'google-login':
      handleGoogleLoginAction();
      break;
    case 'show-signup':
      showSignupForm();
      break;
    case 'signup':  // 회원가입 처리 액션 추가
      handleSignupAction();
      break;
    case 'logout':
      handleLogout();
      break;
    case 'switch-account':
      clearFirebaseSession();
      showLoginModal();
      break;
    case 'continue-session':
      window.location.href = 'index.html';
      break;
  }
}

/**
 * 이메일 로그인 처리
 */
async function handleEmailLoginAction() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  
  if (!emailInput || !passwordInput) {
    console.error('로그인 폼 요소를 찾을 수 없습니다.');
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    alert('이메일과 비밀번호를 모두 입력해주세요.');
    return;
  }
  
  try {
    // 로딩 상태 표시
    const loginButton = document.querySelector('.login-now-button');
    if (loginButton) {
      loginButton.innerHTML = '<span class="spinner"></span> 로그인 중...';
      loginButton.disabled = true;
    }
    
    // 로그인 처리
    const user = await handleEmailLogin(email, password);
    
    // 모달 닫기 및 성공 처리
    closeLoginModal();
    handleLoginSuccess(user);
  } catch (error) {
    console.error('로그인 오류:', error);
    alert(error.message || '로그인 중 오류가 발생했습니다.');
    
    // 로딩 상태 복원
    const loginButton = document.querySelector('.login-now-button');
    if (loginButton) {
      loginButton.innerHTML = '로그인';
      loginButton.disabled = false;
    }
  }
}

/**
 * 회원가입 처리
 */
async function handleSignupAction() {
  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const passwordConfirmInput = document.getElementById('signup-password-confirm');
  
  if (!emailInput || !passwordInput || !passwordConfirmInput) {
    console.error('회원가입 폼 요소를 찾을 수 없습니다.');
    return;
  }
  
  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordConfirm = passwordConfirmInput.value;
  
  if (!email || !password) {
    alert('이메일과 비밀번호를 모두 입력해주세요.');
    return;
  }
  
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  try {
    // 로딩 상태 표시
    const signupButton = document.querySelector('.signup-now-button');
    if (signupButton) {
      signupButton.innerHTML = '<span class="spinner"></span> 가입 중...';
      signupButton.disabled = true;
    }
    
    // 회원가입 처리
    const user = await handleSignup(email, password, name);
    
    // 모달 닫기 및 성공 처리
    closeLoginModal();
    alert('회원가입이 완료되었습니다!');
    handleLoginSuccess(user);
  } catch (error) {
    console.error('회원가입 오류:', error);
    alert(error.message || '회원가입 중 오류가 발생했습니다.');
    
    // 로딩 상태 복원
    const signupButton = document.querySelector('.signup-now-button');
    if (signupButton) {
      signupButton.innerHTML = '가입하기';
      signupButton.disabled = false;
    }
  }
}

/**
 * Google 로그인 처리
 */
async function handleGoogleLoginAction() {
  try {
    // 로딩 상태 표시
    const googleButton = document.querySelector('.login-with-google');
    if (googleButton) {
      googleButton.innerHTML = '<span class="spinner"></span> 로그인 중...';
      googleButton.disabled = true;
    }
    
    // Google 로그인 처리
    const user = await handleGoogleLogin();
    
    // 모달 닫기 및 성공 처리
    closeLoginModal();
    handleLoginSuccess(user);
  } catch (error) {
    console.error('Google 로그인 오류:', error);
    alert('Google 로그인 중 오류가 발생했습니다.');
    
    // 로딩 상태 복원
    const googleButton = document.querySelector('.login-with-google');
    if (googleButton) {
      googleButton.innerHTML = '<span>G</span> Google로 로그인';
      googleButton.disabled = false;
    }
  }
}

/**
 * 로그인 성공 처리
 * @param {Object} user - 로그인된 사용자 객체
 */
function handleLoginSuccess(user) {
  // 홈페이지로 리디렉션
  window.location.href = 'index.html';
}

/**
 * 현재 로그인 상태 확인
 */
function checkCurrentLoginStatus() {
  if (isUserLoggedIn()) {
    // 이전 세션 정보 표시
    const userNameElement = document.getElementById('current-user-info');
    if (userNameElement) {
      const userName = getCurrentUserName();
      userNameElement.innerHTML = `
        <div class="alert">
          현재 <strong>${userName}</strong>으로 로그인되어 있습니다.
          <button id="switch-account" class="button-outline" data-action="switch-account">다른 계정으로 로그인</button>
          <button id="continue-session" class="button-primary" data-action="continue-session">계속하기</button>
        </div>
      `;
    }
  } else {
    // 로그인 창 표시
    setTimeout(() => {
      showLoginModal();
    }, 500);
  }
}

/**
 * Firebase 세션 클리어
 */
async function clearFirebaseSession() {
  // UI에서 로그인 상태 정보 초기화
  clearLoginState();
  
  // 로그인 정보 리셋
  try {
    const { auth } = await ensureFirebase();
    if (auth) {
      auth.signOut().catch(error => {
        console.error('로그아웃 중 오류:', error);
      });
    }
  } catch (error) {
    console.error('세션 클리어 중 오류:', error);
  }
}

/**
 * 인증 상태 변경 감지
 */
async function setupAuthStateListener() {
  try {
    // Firebase 초기화 보장
    const { auth } = await ensureFirebase();
    
    if (!auth) {
      console.error('Firebase auth가 초기화되지 않았습니다.');
      return;
    }
    
    onAuthStateChanged(auth, user => {
      // 사용자 UI 요소 업데이트
      updateUserUI(user);
      
      // 로그인 상태 감지 및 처리
      if (user) {
        checkCurrentLoginStatus();
      }
    });
  } catch (error) {
    console.error('인증 상태 리스너 설정 오류:', error);
  }
}

/**
 * 사용자 UI 업데이트
 * @param {Object|null} user - 사용자 객체 또는 null
 */
function updateUserUI(user) {
  const loginButtonContainer = document.getElementById('login-button-container');
  const userProfileContainer = document.getElementById('user-profile-container');
  const userNameElement = document.getElementById('user-name');
  
  if (user) {
    // 로그인 상태
    if (loginButtonContainer) loginButtonContainer.style.display = 'none';
    if (userProfileContainer) userProfileContainer.style.display = 'flex';
    if (userNameElement) userNameElement.textContent = user.displayName || user.email || '사용자';
  } else {
    // 로그아웃 상태
    if (loginButtonContainer) loginButtonContainer.style.display = 'flex';
    if (userProfileContainer) userProfileContainer.style.display = 'none';
  }
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  initLoginPage();
  await setupAuthStateListener();
});

// 전역 노출 (기존 인라인 이벤트 핸들러와의 호환성 유지)
window.clearFirebaseSession = clearFirebaseSession;
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.showLoginModalWithoutAutoLogin = showLoginModal;  // 그냥 같은 함수 사용
window.showSignupForm = showSignupForm;
window.firebaseEmailLogin = handleEmailLoginAction;
window.firebaseGoogleLogin = handleGoogleLoginAction;
window.firebaseLogout = handleLogout;
window.handleSignupAction = handleSignupAction;  // 회원가입 함수 전역 노출