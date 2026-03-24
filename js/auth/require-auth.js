// require-auth.js — 비로그인 사용자의 페이지 기능을 실질적으로 차단
// 블러/오버레이 같은 시각적 처리가 아닌, JS 레벨에서 기능 자체를 막음

import { ensureAuthReady } from '../core/firebase-core.js';

/**
 * 로그인 상태를 확인하고, 비로그인 시 로그인 모달을 띄우며 false 반환
 * @param {Object} options
 * @param {boolean} options.showModal - 로그인 모달 자동 표시 여부 (기본 true)
 * @param {string} options.redirectUrl - 모달 대신 리디렉트할 URL (선택)
 * @returns {Promise<Object|null>} 로그인된 user 객체 또는 null
 */
export async function requireAuth({ showModal = true, redirectUrl = null } = {}) {
  const user = await ensureAuthReady();

  if (user) return user;

  // 비로그인 — 차단
  if (redirectUrl) {
    window.location.href = redirectUrl;
    return null;
  }

  if (showModal && typeof window.showLoginModal === 'function') {
    setTimeout(() => window.showLoginModal(), 200);
  }

  return null;
}

/**
 * 동기적 로그인 체크 (이미 auth 초기화된 후 사용)
 * @returns {boolean}
 */
export function isAuthenticated() {
  return localStorage.getItem('userLoggedIn') === 'true';
}
