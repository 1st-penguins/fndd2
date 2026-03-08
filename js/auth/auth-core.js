// auth-core.js - 핵심 인증 기능

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { isInAppBrowser, handleExternalBrowserRedirect } from "../utils/browser-redirect.js";
import { auth as coreAuth, ensureFirebase } from "../core/firebase-core.js";
import {
  isAdmin,
  setLoggedIn,
  clearLoginState,
  isRestrictedPage,
  isUserLoggedIn
} from "./auth-utils.js";
import { recordDailyVisit } from "../analytics/daily-visitor.js";

/**
 * 현재 로그인한 사용자 정보 반환
 * @returns {Object|null} 사용자 객체 또는 null
 */
export function getCurrentUser() {
  return (coreAuth && coreAuth.currentUser) || null;
}

/**
 * 초기화 함수 - 인증 관련 이벤트 리스너 설정
 * @returns {Object} 인증 관련 함수 객체
 */
export async function initAuth() {
  try {
    const ensured = await ensureFirebase();
    const authInstance = ensured.auth;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('인증 모듈 초기화 (Auth Instance 확보)...');
    }

    // Firebase 인증 초기화 확인
    if (!authInstance) {
      console.warn('Firebase 인증이 초기화되지 않았습니다. 일부 기능이 제한될 수 있습니다.');
      return {
        handleGoogleLogin,
        handleEmailLogin,
        handleSignup,
        handleLogout,
        isUserLoggedIn: () => localStorage.getItem('userLoggedIn') === 'true',
        getCurrentUserName: () => localStorage.getItem('userName') || '사용자',
        isAdmin
      };
    }

    // redirect 로그인 복귀 결과 처리 (실패 원인 가시화)
    try {
      const redirectResult = await getRedirectResult(authInstance);
      if (redirectResult?.user) {
        console.log('✅ Redirect 로그인 복귀 성공:', redirectResult.user.email);
      }
    } catch (redirectError) {
      console.error('❌ Redirect 로그인 복귀 오류:', redirectError);
    }

    // 인증 상태 변경 감지 (모바일 환경 강화)
    onAuthStateChanged(authInstance, (user) => {
      // auth 상태가 최소 1회 확정되었음을 전역 플래그로 기록
      if (typeof window !== 'undefined') {
        window.__authStateResolved = true;
        window.__lastAuthState = !!user;
      }

      if (window.Logger && window.Logger.isDev()) {
        console.log('🔄 Firebase 인증 상태 변경:', user ? '로그인 됨' : '로그아웃 상태');
        console.log('User:', user ? user.email : 'null');
        console.log('Timestamp:', new Date().toISOString());
      }

      if (user) {
        // 로그인 상태 저장
        setLoggedIn(user);

        // 오늘 방문 기록 (비동기, 실패해도 무관)
        recordDailyVisit(user.uid);

        // 팝업/외부 탭 로그인 복귀 시 남아있는 로그인 모달 정리
        if (typeof window.closeLoginModal === 'function') {
          window.closeLoginModal();
        }

        // 관리자 상태 확인 및 저장
        localStorage.setItem('isAdmin', isAdmin(user) ? 'true' : 'false');

        // 이메일 인증 상태 저장 및 확인
        localStorage.setItem('emailVerified', user.emailVerified ? 'true' : 'false');

        // 이메일 인증되지 않았을 경우 배너 표시
        if (!user.emailVerified) {
          showEmailVerificationBanner(user.email);
        }

        // 강의 탭 표시 업데이트 (관리자/일반 사용자)
        if (typeof window.updateLectureTabVisibility === 'function') {
          window.updateLectureTabVisibility();
        }
        
        // 태그 검색 링크 표시 업데이트
        if (typeof window.updateTagSearchLinkVisibility === 'function') {
          window.updateTagSearchLinkVisibility(isAdmin(user));
        }
      } else {
        // 로그아웃 상태 처리
        clearLoginState();

        // 강의 탭 표시 업데이트 (로그아웃 시)
        if (typeof window.updateLectureTabVisibility === 'function') {
          window.updateLectureTabVisibility();
        }
        
        // 태그 검색 링크 숨기기 (로그아웃 시)
        if (typeof window.updateTagSearchLinkVisibility === 'function') {
          window.updateTagSearchLinkVisibility(false);
        }
      }

      // UI 업데이트 (전역 함수 호출 - 마이그레이션 호환성)
      if (typeof window.updateLoginUI === 'function') {
        window.updateLoginUI();
      }

      // 제한된 콘텐츠 업데이트 - 명시적으로 로그인 상태 전달
      if (typeof window.updateRestrictedContent === 'function') {
        window.updateRestrictedContent(!!user);
      }

      // 로그인 오버레이 업데이트 (모바일 환경 강화)
      if (typeof window.updateLoginOverlays === 'function') {
        console.log('🎯 Firebase 상태 변경으로 인한 오버레이 업데이트');
        window.updateLoginOverlays();

        // 모바일에서 추가 지연 후 재시도
        setTimeout(() => {
          console.log('🎯 Firebase 상태 변경 후 지연 업데이트');
          window.updateLoginOverlays();
        }, 500);

        // 추가 지연으로 모바일 상태 반영 확실히
        setTimeout(() => {
          window.updateLoginOverlays();
        }, 1500);
      }

      // 공지사항 재로드 (로그인 상태 변경 시)
      if (typeof window.reloadNotices === 'function') {
        console.log('🔄 로그인 상태 변경으로 공지사항 재로드');
        window.reloadNotices();
      }

      // 이벤트 발생
      document.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { user, isAdmin: isAdmin(user) }
      }));
    });

    // DOM 이벤트 리스너 - 이 기능은 auth-ui.js로 이동해야 하지만 
    // 마이그레이션 기간 동안 호환성을 위해 유지
    document.addEventListener('DOMContentLoaded', () => {
      // 제한된 페이지 접근 체크
      if (typeof window.checkRestrictedPageAccess === 'function') {
        window.checkRestrictedPageAccess();
      }

      // 제한된 콘텐츠 업데이트 - 현재 로그인 상태 명시적으로 전달
      if (typeof window.updateRestrictedContent === 'function') {
        const isLoggedIn = isUserLoggedIn();
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('DOM 로드 시 로그인 상태 확인:', isLoggedIn);
        }
        window.updateRestrictedContent(isLoggedIn);
      }

      // DOM 로드 시 오버레이 업데이트
      if (typeof window.updateLoginOverlays === 'function') {
        window.updateLoginOverlays();
      }
    });

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('인증 모듈 초기화 완료');
    }

    return {
      handleGoogleLogin,
      handleEmailLogin,
      handleSignup,
      handleLogout,
      isUserLoggedIn: () => localStorage.getItem('userLoggedIn') === 'true',
      getCurrentUserName: () => localStorage.getItem('userName') || '사용자',
      isAdmin
    };
  } catch (error) {
    console.error('인증 모듈 초기화 중 오류 발생:', error);
    // 오류 발생 시에도 기본 함수들은 반환
    return {
      handleGoogleLogin,
      handleEmailLogin,
      handleSignup,
      handleLogout,
      isUserLoggedIn: () => localStorage.getItem('userLoggedIn') === 'true',
      getCurrentUserName: () => localStorage.getItem('userName') || '사용자',
      isAdmin
    };
  }
}

/**
 * Google 로그인
 * @returns {Promise<Object>} 로그인된 사용자 정보
 */
export async function handleGoogleLogin() {
  try {
    const ensured = await ensureFirebase();
    const auth = ensured.auth;

    // 인앱 브라우저 체크 추가
    if (isInAppBrowser()) {
      console.log('인앱 브라우저에서 구글 로그인 시도. 외부 브라우저로 리다이렉트 처리...');
      const redirected = handleExternalBrowserRedirect();
      if (redirected) {
        // 실제 리다이렉트가 일어난 경우에만 현재 흐름 중단
        return null;
      }
      // 사용자가 리다이렉트를 취소한 경우 현재 탭에서 로그인 계속 진행
      console.warn('외부 브라우저 리다이렉트가 실행되지 않아 현재 탭에서 로그인 진행');
    }

    // 로딩 표시 (auth-ui.js에서 처리하는 것이 더 적절함)
    const loginButton = document.querySelector('.login-with-google');
    if (loginButton) {
      loginButton.innerHTML = '<span class="spinner"></span> 로그인 중...';
      loginButton.disabled = true;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let user = null;
    try {
      const result = await signInWithPopup(auth, provider);
      user = result.user;
    } catch (popupError) {
      const popupCode = popupError?.code || '';
      const shouldFallbackToRedirect = popupCode === 'auth/popup-blocked'
        || popupCode === 'auth/cancelled-popup-request'
        || popupCode === 'auth/popup-closed-by-user';

      if (!shouldFallbackToRedirect) {
        throw popupError;
      }

      console.warn('팝업 로그인 실패, redirect 방식으로 재시도:', popupCode);
      await signInWithRedirect(auth, provider);
      return null;
    }

    if (window.Logger && window.Logger.isDev()) {
      console.log('Google 로그인 성공');
    }

    // 모달 닫기 (전역 함수 호출 - 마이그레이션 호환성)
    if (typeof window.closeLoginModal === 'function') {
      window.closeLoginModal();
    }

    // 로그인 직후 명시적으로 제한된 콘텐츠 업데이트
    if (typeof window.updateRestrictedContent === 'function') {
      window.updateRestrictedContent(true);
    }

    // 로그인 직후 오버레이 업데이트
    if (typeof window.updateLoginOverlays === 'function') {
      window.updateLoginOverlays();
    }

    return user;
  } catch (error) {
    console.error('Google 로그인 오류:', error);

    // 로딩 표시 복원 (auth-ui.js에서 처리하는 것이 더 적절함)
    const loginButton = document.querySelector('.login-with-google');
    if (loginButton) {
      loginButton.innerHTML = '<span>G</span> Google로 로그인';
      loginButton.disabled = false;
    }

    if (error?.code === 'auth/unauthorized-domain') {
      throw new Error('현재 도메인이 Firebase 인증 허용 도메인에 없습니다. Firebase Console > Authentication > Settings > Authorized domains에서 localhost를 추가해주세요.');
    }
    if (error?.code === 'auth/operation-not-allowed') {
      throw new Error('Firebase Authentication에서 Google 로그인이 비활성화되어 있습니다. Sign-in method에서 Google을 활성화해주세요.');
    }

    throw error;
  }
}

/**
 * 이메일/비밀번호 로그인
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 로그인된 사용자 정보
 */
export async function handleEmailLogin(email, password) {
  try {
    const ensured = await ensureFirebase();
    const auth = ensured.auth;

    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 이메일 인증 상태 확인
    if (!user.emailVerified) {
      // 인증 메일 재발송 옵션 제공
      const resendVerification = confirm(
        '이메일 인증이 완료되지 않았습니다. 인증 메일을 다시 받으시겠습니까?'
      );

      if (resendVerification) {
        await sendEmailVerification(user);
        alert('인증 메일이 재발송되었습니다. 메일함을 확인해주세요.');
      }

      // 로그인은 성공하지만 일부 기능 제한 가능
      console.log('이메일 미인증 사용자 로그인');
    } else {
      console.log('인증된 사용자 로그인 성공');
    }

    // 모달 닫기 (전역 함수 호출 - 마이그레이션 호환성)
    if (typeof window.closeLoginModal === 'function') {
      window.closeLoginModal();
    }

    // 로그인 직후 명시적으로 제한된 콘텐츠 업데이트
    if (typeof window.updateRestrictedContent === 'function') {
      window.updateRestrictedContent(true);
    }

    // 로그인 직후 오버레이 업데이트
    if (typeof window.updateLoginOverlays === 'function') {
      window.updateLoginOverlays();
    }

    return user;
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
}

/**
 * 회원가입
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @param {string} displayName - 표시 이름 (선택)
 * @returns {Promise<Object>} 가입된 사용자 정보
 */
export async function handleSignup(email, password, displayName) {
  try {
    const ensured = await ensureFirebase();
    const auth = ensured.auth;

    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
    }

    if (password.length < 6) {
      throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
    }

    // 로딩 표시 (auth-ui.js에서 처리하는 것이 더 적절함)
    const signupButton = document.querySelector('.signup-button');
    if (signupButton) {
      signupButton.innerHTML = '<span class="spinner"></span> 처리 중...';
      signupButton.disabled = true;
    }

    // 계정 생성
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 이메일 인증 메일 발송
    await sendEmailVerification(user);

    // 사용자 이름 설정 (있는 경우)
    if (displayName) {
      await updateProfile(user, { displayName });
    }

    console.log('회원가입 성공 및 인증 메일 발송됨');

    // 모달 닫기 (전역 함수 호출 - 마이그레이션 호환성)
    if (typeof window.closeLoginModal === 'function') {
      window.closeLoginModal();
    }

    // 회원가입 직후 명시적으로 제한된 콘텐츠 업데이트
    if (typeof window.updateRestrictedContent === 'function') {
      window.updateRestrictedContent(true);
    }

    return user;
  } catch (error) {
    console.error('회원가입 오류:', error);

    // 로딩 표시 복원 (auth-ui.js에서 처리하는 것이 더 적절함)
    const signupButton = document.querySelector('.signup-button');
    if (signupButton) {
      signupButton.innerHTML = '가입하기';
      signupButton.disabled = false;
    }

    // 사용자 친화적인 오류 메시지
    let errorMessage = "회원가입 중 오류가 발생했습니다.";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = "이미 사용 중인 이메일입니다.";
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = "유효하지 않은 이메일 형식입니다.";
    } else if (error.code === 'auth/weak-password') {
      errorMessage = "비밀번호가 너무 약합니다.";
    }

    throw new Error(errorMessage);
  }
}

/**
 * 로그아웃
 */
export async function handleLogout() {
  try {
    const ensured = await ensureFirebase();
    const auth = ensured.auth;
    await signOut(auth);
    clearLoginState();

    console.log('로그아웃 성공');

    // 제한된 페이지인 경우 홈페이지로 리디렉션
    if (isRestrictedPage()) {
      window.location.href = '/';
    } else {
      // 페이지 새로고침
      window.location.reload();
    }
  } catch (error) {
    console.error('로그아웃 오류:', error);
    alert('로그아웃 중 오류가 발생했습니다. 다시 시도해 주세요.');
    throw error;
  }
}

/**
 * 이메일 인증 배너 표시
 * @param {string} email - 사용자 이메일
 */
function showEmailVerificationBanner(email) {
  // 이미 배너가 있으면 제거
  const existingBanner = document.getElementById('email-verification-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  // 새 배너 생성
  const banner = document.createElement('div');
  banner.id = 'email-verification-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #fff3cd;
    color: #856404;
    padding: 12px 20px;
    text-align: center;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 500;
  `;

  banner.innerHTML = `
    <div>
      <span>이메일 인증이 필요합니다. ${email}로 발송된 인증 링크를 확인해주세요.</span>
      <button id="resend-verification-email" style="margin-left: 15px; background: #856404; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: 500;">인증 메일 재발송</button>
      <button id="close-verification-banner" style="margin-left: 10px; background: transparent; border: none; cursor: pointer; font-size: 18px; line-height: 1;">&times;</button>
    </div>
  `;

  // 문서에 배너 추가
  document.body.appendChild(banner);

  // 재발송 버튼 이벤트
  document.getElementById('resend-verification-email').addEventListener('click', async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      alert('인증 이메일이 재발송되었습니다. 메일함을 확인해주세요.');
    } catch (error) {
      console.error('인증 이메일 재발송 오류:', error);
      alert('인증 이메일 재발송 중 오류가 발생했습니다.');
    }
  });

  // 닫기 버튼 이벤트
  document.getElementById('close-verification-banner').addEventListener('click', () => {
    banner.remove();
  });
}

/**
 * 비밀번호 재설정 이메일 발송
 * @param {string} email - 사용자 이메일
 */
export async function handlePasswordReset(email) {
  if (!email) {
    throw new Error('이메일을 입력해주세요.');
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    throw error;
  }
}

// 전역 객체에 함수 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.handleGoogleLogin = handleGoogleLogin;
  window.handleEmailLogin = handleEmailLogin;
  window.handleSignup = handleSignup;
  window.handleLogout = handleLogout;
  window.handlePasswordReset = handlePasswordReset;
  window.initAuth = initAuth;
}

// 기본 내보내기 (인스턴스 형태)
export default initAuth();