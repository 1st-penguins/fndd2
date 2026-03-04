// subject-page.js - 과목별 기출문제 페이지 컨트롤러

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../core/firebase-core.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { showLoginModal, closeLoginModal, updateLoginUI, updateRestrictedContent } from "../auth/auth-ui.js";
import { navigateWithAccessGuard, setupRestrictedLinkDelegation } from "../auth/access-guard.js";
import { addScrollUpButton } from "../utils/ui-utils.js";

/**
 * 과목별 기출문제 페이지 초기화
 */
function initSubjectPage() {
  // 현재 URL에서 과목 정보 추출
  const pathSegments = window.location.pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  const subjectMatch = filename.match(/subject_(.+)\.html/);

  if (subjectMatch) {
    const subject = decodeURIComponent(subjectMatch[1]);
    document.title = `${subject} 기출문제 - 퍼스트펭귄 건강운동관리사`;
  }

  // 로그인 상태에 따른 제한된 콘텐츠 처리
  const isLoggedIn = isUserLoggedIn();
  updateRestrictedContent(isLoggedIn);

  // 보안: 인라인 onclick 이벤트 가로채기
  startSecurityInterception();

  // 제한된 링크에 이벤트 핸들러 등록 (데이터 속성 기반)
  setupRestrictedLinks();

  // 로그인 모달 이벤트 리스너 등록
  setupLoginModalEvents();

  // 스크롤 업 버튼 추가
  addScrollUpButton();
}

/**
 * 보안: 인라인 이벤트 가로채기
 * HTML에 하드코딩된 onclick="window.location..." 호출을 안전하게 제어
 */
function startSecurityInterception() {
  // 인라인 onclick 제거 및 이벤트 리스너로 교체
  document.querySelectorAll('[onclick*="window.location"]').forEach(el => {
    // 기존 onclick 속성 백업 (필요 시) 및 제거
    const originalCode = el.getAttribute('onclick');
    const hrefMatch = originalCode.match(/href\s*=\s*['"]([^'"]+)['"]/);

    if (hrefMatch && hrefMatch[1]) {
      el.setAttribute('data-href', hrefMatch[1]);
      el.removeAttribute('onclick'); // 보안 취약점 제거

      // 안전한 클릭 이벤트 추가
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        secureNavigate(hrefMatch[1]);
      });
    }
  });
}

/**
 * 안전한 네비게이션 처리 (로그인 체크)
 * @param {string} url - 이동할 URL
 */
function secureNavigate(url) {
  navigateWithAccessGuard(url);
}

/**
 * 제한된 링크에 이벤트 핸들러 등록
 */
function setupRestrictedLinks() {
  setupRestrictedLinkDelegation(document);
}

/**
 * 로그인 모달 이벤트 리스너 등록
 */
function setupLoginModalEvents() {
  // 모달 닫기 버튼
  const closeModalBtn = document.querySelector('.login-modal-close');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeLoginModal);
  }

  // 닫기 버튼 이벤트
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeLoginModal);
  });

  // 로그인 표시 버튼 이벤트 (헤더 등)
  document.querySelectorAll('[data-action="show-login"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginModal();
    });
  });
}

/**
 * 인증 상태 변경 감지 및 처리
 */
function setupAuthStateListener() {
  onAuthStateChanged(auth, user => {
    updateLoginUI();
    updateRestrictedContent(!!user);
  });
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initSubjectPage();
  setupAuthStateListener();
});

// 전역으로 함수 노출
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.checkLoginBeforeRedirect = secureNavigate;