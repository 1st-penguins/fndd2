// auth-ui-linear.js - Linear 디자인 시스템용 인증 UI 업데이트

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

/**
 * Linear 디자인 시스템용 로그인 상태 UI 업데이트
 */
export function updateLinearLoginUI() {
  const isLoggedIn = window.isUserLoggedIn ? window.isUserLoggedIn() : false;
  
  console.log('🔄 Linear 로그인 UI 업데이트:', { isLoggedIn });
  
  // Linear 디자인 시스템의 로그인 버튼 컨테이너
  const loginContainer = document.getElementById('login-button-container');
  const profileContainer = document.getElementById('user-profile-container');
  const userName = document.getElementById('user-name');
  
  if (loginContainer && profileContainer) {
    if (isLoggedIn) {
      // 로그인된 상태: 로그인 버튼 숨기고 프로필 표시
      loginContainer.style.display = 'none';
      loginContainer.classList.add('hidden');
      
      profileContainer.style.display = 'flex';
      profileContainer.classList.remove('hidden');
      
      // 사용자 이름 업데이트
      if (userName) {
        userName.textContent = getCurrentUserName();
        userName.setAttribute('data-event-added', 'true');
      }
      
      console.log('✅ 로그인 상태 UI 적용됨');
    } else {
      // 로그아웃 상태: 프로필 숨기고 로그인 버튼 표시
      loginContainer.style.display = 'flex';
      loginContainer.classList.remove('hidden');
      
      profileContainer.style.display = 'none';
      profileContainer.classList.add('hidden');
      
      console.log('✅ 로그아웃 상태 UI 적용됨');
    }
  } else {
    console.warn('⚠️ 로그인 UI 컨테이너를 찾을 수 없습니다');
  }
  
  // 제한된 콘텐츠 업데이트
  updateLinearRestrictedContent(isLoggedIn);
  
  // 로그인 오버레이 업데이트
  updateLoginOverlays(isLoggedIn);
}

/**
 * Linear 디자인 시스템용 제한된 콘텐츠 업데이트
 */
export function updateLinearRestrictedContent(isLoggedIn) {
  if (isLoggedIn === undefined) {
    isLoggedIn = isUserLoggedIn();
  }
  
  console.log('🔒 제한된 콘텐츠 업데이트:', { isLoggedIn });
  
  // 제한된 콘텐츠 요소들
  const restrictedElements = document.querySelectorAll('.restricted-content');
  const loginOverlays = document.querySelectorAll('.login-required-overlay');
  
  restrictedElements.forEach(el => {
    if (isLoggedIn) {
      el.classList.remove('content-locked');
      el.style.filter = 'none';
      el.style.pointerEvents = 'auto';
    } else {
      el.classList.add('content-locked');
      el.style.filter = 'blur(2px)';
      el.style.pointerEvents = 'none';
    }
  });
  
  // 로그인 오버레이 표시/숨김
  loginOverlays.forEach(overlay => {
    overlay.style.display = isLoggedIn ? 'none' : 'flex';
  });
}

/**
 * 로그인 오버레이 업데이트
 */
export function updateLoginOverlays(isLoggedIn) {
  const overlays = document.querySelectorAll('.login-required-overlay');
  
  overlays.forEach(overlay => {
    if (isLoggedIn) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
    }
  });
}

/**
 * Linear 디자인 시스템용 이벤트 리스너 설정
 */
export function initLinearAuthUI() {
  console.log('🚀 Linear 인증 UI 초기화 시작');
  
  // 로그인 버튼 이벤트
  const loginButtons = document.querySelectorAll('[data-action="show-login"]');
  loginButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      showLinearLoginModal();
    });
  });
  
  // 로그아웃 버튼 이벤트
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await handleLogout();
        updateLinearLoginUI();
        console.log('✅ 로그아웃 완료');
      } catch (error) {
        console.error('❌ 로그아웃 실패:', error);
      }
    });
  });
  
  // 사용자 이름 클릭 이벤트
  const userName = document.getElementById('user-name');
  if (userName && !userName.hasAttribute('data-event-added')) {
    userName.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.goToMypage === 'function') {
        window.goToMypage();
      } else {
        console.log('마이페이지로 이동');
      }
    });
    userName.setAttribute('data-event-added', 'true');
  }
  
  // 로그인 필요 버튼 이벤트
  const loginRequiredButtons = document.querySelectorAll('[data-action="show-login"]');
  loginRequiredButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      showLinearLoginModal();
    });
  });
  
  // 미리보기 버튼 이벤트
  const previewButtons = document.querySelectorAll('[data-action="preview-content"]');
  previewButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      showPreviewAlert();
    });
  });
  
  console.log('✅ Linear 인증 UI 이벤트 리스너 설정 완료');
}

/**
 * Linear 디자인 시스템용 로그인 모달 표시
 */
export function showLinearLoginModal() {
  console.log('🔑 Linear 로그인 모달 표시');
  
  // 기존 모달이 있으면 사용, 없으면 생성
  let modal = document.getElementById('login-modal');
  if (!modal) {
    createLinearLoginModal();
    modal = document.getElementById('login-modal');
  }
  
  if (modal) {
    modal.style.display = 'flex';
    console.log('✅ 로그인 모달 표시됨');
  } else {
    console.error('❌ 로그인 모달을 찾을 수 없습니다');
  }
}

/**
 * Linear 디자인 시스템용 로그인 모달 생성
 */
export function createLinearLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'login-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <h2 class="linear-typography linear-typography--h2">로그인</h2>
      <form id="login-form">
        <div class="form-group">
          <label for="email" class="linear-typography linear-typography--body">이메일</label>
          <input type="email" id="email" name="email" required class="form-input">
        </div>
        <div class="form-group">
          <label for="password" class="linear-typography linear-typography--body">비밀번호</label>
          <input type="password" id="password" name="password" required class="form-input">
        </div>
        <button type="submit" class="linear-button linear-button--primary">로그인</button>
      </form>
      <p class="linear-typography linear-typography--caption linear-typography--secondary">
        아직 계정이 없으신가요? <a href="#" class="link">회원가입</a>
      </p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 이벤트 리스너 설정
  setupLinearModalEvents(modal);
  
  console.log('✅ Linear 로그인 모달 생성됨');
}

/**
 * Linear 모달 이벤트 설정
 */
function setupLinearModalEvents(modal) {
  // 닫기 버튼
  const closeBtn = modal.querySelector('.close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // 폼 제출
  const form = modal.querySelector('#login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;
      
      try {
        await handleEmailLogin(email, password);
        modal.style.display = 'none';
        updateLinearLoginUI();
        console.log('✅ 로그인 성공');
      } catch (error) {
        console.error('❌ 로그인 실패:', error);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    });
  }
}

/**
 * 미리보기 알림 표시
 */
export function showPreviewAlert() {
  alert('🎭 미리보기: 실제 문제 페이지로 이동합니다.');
}

// 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.updateLinearLoginUI = updateLinearLoginUI;
  window.updateLinearRestrictedContent = updateLinearRestrictedContent;
  window.showLinearLoginModal = showLinearLoginModal;
  window.initLinearAuthUI = initLinearAuthUI;
  window.showPreviewAlert = showPreviewAlert;
}

// 모듈 내보내기
export default {
  updateLinearLoginUI,
  updateLinearRestrictedContent,
  showLinearLoginModal,
  initLinearAuthUI,
  showPreviewAlert
};
