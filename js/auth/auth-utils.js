// auth-utils.js - 인증 관련 유틸리티 함수

import { auth } from "../core/firebase-core.js";
import { ADMIN_EMAILS } from "../core/firebase-core.js";
import { isDevMode, getMockUser } from "../config/dev-config.js";

/**
 * 사용자 로그인 상태를 로컬 스토리지에 저장
 * @param {Object} user - Firebase 사용자 객체
 */
export function setLoggedIn(user) {
  localStorage.setItem('userLoggedIn', 'true');
  localStorage.setItem('userName', user.displayName || user.email || '사용자');
  localStorage.setItem('userEmail', user.email || '');
  localStorage.setItem('userId', user.uid);

  // 이메일 인증 상태 저장
  localStorage.setItem('emailVerified', user.emailVerified ? 'true' : 'false');
}

/**
 * 로그인 상태 제거
 */
export function clearLoginState() {
  localStorage.removeItem('userLoggedIn');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('emailVerified');
}

/**
 * 로그인 상태 확인 (localStorage 기반)
 * @returns {boolean} 로그인 여부
 */
export function isUserLoggedIn() {
  // 개발 모드에서는 항상 로그인된 상태로 처리
  if (isDevMode()) {
    return true;
  }
  const localLoggedIn = localStorage.getItem('userLoggedIn') === 'true';

  // Firebase Auth가 실제 로그인 상태면 true
  if (auth?.currentUser) {
    return true;
  }

  // auth 상태가 이미 확정되었는데 currentUser가 없고 localStorage만 true면
  // 오래된 로그인 캐시로 판단하여 정리한다.
  if (localLoggedIn && window.__authStateResolved === true) {
    clearLoginState();
    return false;
  }

  // auth 상태가 아직 확정 전이면 기존 로컬 상태를 임시로 허용
  return localLoggedIn;
}

/**
 * 현재 사용자 이름 가져오기
 * @returns {string} 사용자 이름
 */
export function getCurrentUserName() {
  // 개발 모드에서는 가짜 사용자 이름 반환
  if (isDevMode()) {
    return getMockUser().displayName;
  }
  if (auth?.currentUser?.displayName || auth?.currentUser?.email) {
    return auth.currentUser.displayName || auth.currentUser.email;
  }
  return localStorage.getItem('userName') || '사용자';
}

/**
 * 현재 사용자가 관리자인지 확인
 * @param {Object} [user] - Firebase 사용자 객체 (없으면 현재 사용자 사용)
 * @returns {boolean} 관리자 여부
 */
export function isAdmin(user) {
  // 개발 모드에서는 항상 관리자로 처리
  if (isDevMode()) {
    return true;
  }
  
  // 인자로 받은 사용자 객체가 있으면 사용, 없으면 현재 로그인된 사용자 확인
  const currentUser = user || auth.currentUser;
  
  if (!currentUser || !currentUser.email) {
    return false;
  }
  
  return ADMIN_EMAILS.includes(currentUser.email);
}

/**
 * 제한된 페이지인지 확인
 * @returns {boolean} 제한된 페이지 여부
 */
export function isRestrictedPage() {
  return document.body.classList.contains('restricted-page');
}

/**
 * 제한된 페이지 접근 체크
 * @returns {boolean} 접근 가능 여부
 */
export function checkRestrictedPageAccess() {
  if (isRestrictedPage() && !isUserLoggedIn()) {
    return false;
  }
  return true;
}

export function updateLoginUI() {
  const isLoggedIn = isUserLoggedIn();
  const userName = getCurrentUserName();
  const isEmailVerified = localStorage.getItem('emailVerified') === 'true';
  
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
      // 사용자 이름 요소 찾기
      const nameElement = element.querySelector('#user-name') || element;
      nameElement.textContent = userName;
    }
  });
  
  logoutButtons.forEach(button => {
    button.style.display = isLoggedIn ? 'block' : 'none';
  });
  
  // 이메일 인증 상태 표시
  if (isLoggedIn) {
    const verificationElements = document.querySelectorAll('.email-verification-status');
    verificationElements.forEach(element => {
      element.style.display = 'block';
      if (isEmailVerified) {
        element.innerHTML = '<span style="color: green;">✓ 인증됨</span>';
        element.classList.remove('not-verified');
      } else {
        element.innerHTML = '<span style="color: orange;">! 이메일 인증 필요</span>';
        element.classList.add('not-verified');
      }
    });
  }
  
  // 제한된 콘텐츠 업데이트
  updateRestrictedContent();
}

export function updateRestrictedContent() {
  const isLoggedIn = isUserLoggedIn();
  const isEmailVerified = localStorage.getItem('emailVerified') === 'true';
  
  // 제한된 콘텐츠 요소 업데이트
  const restrictedElements = document.querySelectorAll('.restricted-content');
  restrictedElements.forEach(el => {
    // 화면 오버레이/블러 없이 콘텐츠는 항상 동일하게 보이도록 유지
    // 실제 접근 차단은 restricted-link 클릭 가드에서 처리한다.
    el.classList.remove('content-blurred');
    el.style.filter = 'none';
    el.style.pointerEvents = 'auto';
  });
  
  // 제한된 링크 이벤트 처리
  const restrictedLinks = document.querySelectorAll('.restricted-link');
  restrictedLinks.forEach(link => {
    // 기존 이벤트 제거 (중복 방지)
    const clone = link.cloneNode(true);
    link.parentNode.replaceChild(clone, link);
    
    if (!isLoggedIn) {
      // 로그인하지 않은 경우에만 클릭 시 로그인 모달 표시
      clone.addEventListener('click', function(e) {
        e.preventDefault();
        showLoginModal();
        return false;
      });
    }
  });
}

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.isUserLoggedIn = isUserLoggedIn;
  window.getCurrentUserName = getCurrentUserName;
  window.isAdmin = isAdmin;
  window.setLoggedIn = setLoggedIn;
  window.clearLoginState = clearLoginState;
  window.isRestrictedPage = isRestrictedPage;
  window.checkRestrictedPageAccess = checkRestrictedPageAccess;
}