// app.js - 메인 애플리케이션 스크립트
// 인덱스 페이지의 초기화 및 UI 기능 관리

import { updateLoginUI, updateRestrictedContent as updateAuthRestrictedContent } from './auth/auth-ui.js';
import { loadNotices, loadNoticesWithPagination } from './notice/notice-ui.js';
import { formatSimpleDate } from './utils/date-utils.js';
import { addScrollUpButton } from './utils/ui-utils.js';
import {
  guardTabAccess,
  setupRestrictedLinkDelegation,
  syncLoginOverlays
} from './auth/access-guard.js';
import { isAdmin } from './auth/auth-utils.js';

/**
 * 홈 페이지 클래스 추가 (모바일 푸터 제어용)
 */
function addHomePageClass() {
  const currentUrl = window.location.href;
  const isHomePage = currentUrl.includes('index.html') ||
    currentUrl.endsWith('/') ||
    currentUrl.endsWith('localhost:8000');

  if (isHomePage) {
    document.body.classList.add('home-page');
    window.Logger?.debug('🏠 홈 페이지 클래스 추가됨');
  } else {
    document.body.classList.remove('home-page');
    window.Logger?.debug('📄 다른 페이지 - 홈 페이지 클래스 제거됨');
  }
}

// 전역 상태 관리
let currentTab = 'notice-tab';

function getAppVersion() {
  return document.querySelector('meta[name="app-version"]')?.content
    || new Date().toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * 강의 탭 표시 제어 (관리자 vs 일반 사용자)
 */
export function updateLectureTabVisibility() {
  // 상점은 모든 사용자에게 표시 (shop.js가 렌더링 담당)
  // 로그인 상태 변경 시 상점 갱신
  document.dispatchEvent(new CustomEvent('certChanged'));

  // 태그 검색 링크 표시 제어
  updateTagSearchLinkVisibility();
}

/**
 * 태그 검색 링크 표시 제어 (모든 사용자)
 */
export function updateTagSearchLinkVisibility() {
  let tagSearchLink = document.querySelector('.tag-search-link');

  // 링크가 없으면 생성
  if (!tagSearchLink) {
    const subTabs = document.querySelector('#quiz-tab .sub-tabs');
    if (subTabs) {
      tagSearchLink = document.createElement('a');
      tagSearchLink.href = 'search-by-tags.html';
      tagSearchLink.className = 'sub-tab-button tag-search-link';
      tagSearchLink.style.cssText = 'text-decoration: none; display: inline-flex; align-items: center; justify-content: center;';
      tagSearchLink.innerHTML = '🏷️ 태그 검색';
      subTabs.appendChild(tagSearchLink);
      window.Logger?.debug('✅ 태그 검색 링크 생성됨');
    }
  } else {
    tagSearchLink.style.display = 'inline-flex';
  }
}

// 전역으로 노출 (auth-core.js에서 접근 가능하도록)
window.updateLectureTabVisibility = updateLectureTabVisibility;
window.updateTagSearchLinkVisibility = updateTagSearchLinkVisibility;

/**
 * 문서 로드 완료 시 실행되는 초기화 함수
 */
function initApp() {
  if (window.__homeAppInitialized) return;
  window.__homeAppInitialized = true;

  // 홈 페이지 클래스 추가 (모바일 푸터 제어용)
  addHomePageClass();

  // 페이지 로드 직후 즉시 모든 탭 숨기기
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  // 기본 탭만 표시
  const defaultTab = document.getElementById('notice-tab');
  if (defaultTab) {
    defaultTab.style.display = 'block';
  }

  // 인증 상태를 앱 시작 시 선초기화해서
  // redirect 로그인 복귀 후에도 currentUser/localStorage 동기화를 보장
  (async () => {
    try {
      const [{ ensureAuthReady }, authMod] = await Promise.all([
        import('./core/firebase-core.js'),
        import('./auth/auth-core.js')
      ]);

      if (authMod && typeof authMod.initAuth === 'function') {
        await authMod.initAuth();
      }
      await ensureAuthReady();
    } catch (e) {
      console.warn('초기 인증 동기화 실패:', e);
    }
  })();

  // 탭 초기화
  initTabs();

  // 초기 태그 검색 링크 표시 상태 설정
  updateTagSearchLinkVisibility();

  // 전역 프리로더 숨기기 (약간의 지연으로 부드러운 전환)
  setTimeout(() => {
    const preloader = document.getElementById('global-preloader');
    if (preloader) {
      preloader.classList.add('hidden');
      // 트랜지션 완료 후 제거
      setTimeout(() => {
        preloader.remove();
      }, 500);
    }
  }, 300);

  // 공지사항 로드: 즉시 실행 (UX 개선)
  const noticeSectionEl = document.querySelector('.notice-section');
  if (noticeSectionEl) {
    initNotices();
  }

  // 로그인 상태에 따른 콘텐츠 제어
  updateRestrictedContent(isUserLoggedIn());
  setupRestrictedLinkDelegation(document);

  // 강의 탭 표시 제어
  updateLectureTabVisibility();

  // 빙하 애니메이션 효과 설정
  initIcebergAnimation();

  // 플로팅 버튼 초기화 (맨위로 가기, 관리자 공지 작성)
  initFloatingButtons();

  // 로그인 상태에 따른 오버레이 제어
  updateLoginOverlays();

  // 초기 로드 후 안정화 체크 (1초 후 한 번만)
  setTimeout(() => {
    window.Logger?.debug('초기 로드 후 오버레이 재확인');
    updateLoginOverlays();
  }, 1000);

  // 히어로 버튼 이벤트 바인딩
  const handleHeroQuizClick = (certType) => {
    // 먼저 메인 콘텐츠로 부드럽게 스크롤
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 스크롤 후 탭 전환 및 자격증 변경 (약간 딜레이)
    setTimeout(() => {
      // 자격증 변경 로직이 필요할 경우 여기에 추가
      if (typeof window.setCertificateType === 'function') {
        window.setCertificateType(certType);
      }

      const quizTabBtn = document.querySelector('.access-tabs .tab-button[data-tab="quiz-tab"]');
      if (quizTabBtn) {
        quizTabBtn.click();
      }
    }, 400);
  };

  const healthBtn = document.getElementById('hero-start-quiz-health');
  if (healthBtn) {
    healthBtn.addEventListener('click', () => handleHeroQuizClick('health-manager'));
  }

  const sportsBtn = document.getElementById('hero-start-quiz-sports');
  if (sportsBtn) {
    sportsBtn.addEventListener('click', () => handleHeroQuizClick('sports-instructor'));
  }

  const viewNoticesBtn = document.getElementById('hero-view-notices');
  if (viewNoticesBtn) {
    viewNoticesBtn.addEventListener('click', () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      setTimeout(() => {
        const noticeTabBtn = document.querySelector('.access-tabs .tab-button[data-tab="notice-tab"]');
        if (noticeTabBtn) {
          noticeTabBtn.click();
        }
      }, 400);
    });
  }

  // 페이지 포커스 시 오버레이 상태 재확인
  window.addEventListener('focus', () => {
    window.Logger?.debug('페이지 포커스 시 오버레이 재확인');
    updateLoginOverlays();
  });

  // 탭 전환 시 오버레이 상태 재확인 (모바일 중요)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      window.Logger?.debug('탭 활성화 시 오버레이 재확인');
      updateLoginOverlays();
    }
  });

  // 로그인 트리거 버튼 이벤트 바인딩 (인라인 onclick 제거 대응)
  document.querySelectorAll('.login-trigger-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.lazyAuthAndShowLoginModal === 'function') {
        window.lazyAuthAndShowLoginModal();
      } else {
        console.error('Login function not available');
        window.location.href = 'login.html';
      }
    });
  });
}

/**
 * 로그인 상태에 따른 오버레이 표시/숨김
 */
function updateLoginOverlays() {
  syncLoginOverlays(document);
}

/**
 * 디버깅용: 강제로 오버레이 상태 업데이트
 */
window.forceUpdateOverlays = function () {
  window.Logger?.debug('=== 강제 오버레이 업데이트 ===');
  updateLoginOverlays();
}

// 필요 시 인증 모듈을 로드하고 로그인 모달을 표시하는 래퍼
window.lazyAuthAndShowLoginModal = async function () {
  try {
    // Firebase 및 auth 모듈 초기화 보장
    const [{ ensureFirebase }, authMod] = await Promise.all([
      import('./core/firebase-core.js').then(m => ({ ensureFirebase: m.ensureFirebase })),
      import('./auth/auth-core.js')
    ]);

    // Firebase 초기화
    await ensureFirebase();

    // 인증 초기화 (필요시)
    if (authMod && typeof authMod.initAuth === 'function') {
      await authMod.initAuth();
    }

    // 모달 표시
    if (typeof window.showLoginModal === 'function') {
      window.showLoginModal();
    } else {
      // auth-ui 모듈도 로드 시도
      const uiMod = await import('./auth/auth-ui.js');
      if (uiMod && typeof uiMod.showLoginModal === 'function') {
        uiMod.showLoginModal();
      }
    }
  } catch (e) {
    window.Logger?.error('인증 모듈 로드 실패:', e);
    // 로그인 페이지로 이동
    if (window.location.pathname !== '/login.html' && !window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
  }
}

// 전역 오버레이 업데이트 함수 노출
window.updateLoginOverlays = updateLoginOverlays;

/**
 * 미리보기 콘텐츠 표시
 */
window.showPreviewContent = function () {
  // 현재 활성화된 탭 확인
  const activeTab = document.querySelector('.tab-content.active');
  const overlay = activeTab.querySelector('.login-required-overlay');

  if (overlay) {
    // 오버레이를 일시적으로 숨기고 3초 후 다시 표시
    overlay.style.display = 'none';

    // 3초 후 다시 표시
    setTimeout(() => {
      overlay.style.display = 'flex';

      // 미리보기 종료 알림
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(29, 47, 78, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      notification.textContent = '미리보기가 종료되었습니다. 로그인하여 모든 기능을 이용하세요.';

      document.body.appendChild(notification);

      // 3초 후 알림 제거
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 3000);
    }, 3000);

    // 미리보기 시작 알림
    const previewNotification = document.createElement('div');
    previewNotification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(95, 178, 201, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    previewNotification.textContent = '3초간 미리보기 중입니다...';

    document.body.appendChild(previewNotification);

    setTimeout(() => {
      if (previewNotification.parentNode) {
        previewNotification.remove();
      }
    }, 3000);
  }
}

/**
 * 학습 분석 탭 클릭 처리 (로그인 체크)
 * 홈 화면 내에서 대시보드 로드
 */
window.handleAnalyticsTabClick = async function () {
  // 개발 모드 확인
  let isDevModeActive = false;
  try {
    const { isDevMode } = await import('./config/dev-config.js');
    isDevModeActive = isDevMode();
  } catch (e) {
    console.warn('개발 모드 확인 실패:', e);
  }

  // 전역 isUserLoggedIn 함수가 있으면 사용, 없으면 localStorage 직접 확인
  let isLoggedIn = (typeof window.isUserLoggedIn === 'function')
    ? window.isUserLoggedIn()
    : localStorage.getItem('userLoggedIn') === 'true';

  // Firebase auth 상태도 확인 (더 정확한 로그인 상태 확인)
  try {
    const { ensureFirebase } = await import('./core/firebase-core.js');
    const { auth } = await ensureFirebase();
    if (auth && auth.currentUser) {
      isLoggedIn = true;
    }
  } catch (e) {
    console.warn('Firebase auth 확인 실패:', e);
  }

  // 개발 모드일 경우 로그인 상태로 간주
  if (isDevModeActive) {
    isLoggedIn = true;
  }

  // 서브탭 초기화는 탭이 실제로 표시될 때만 실행하도록 변경
  // 초기 로드 시에는 제거 (탭 전환 시에만 초기화)

  if (isLoggedIn) {
    // 로그인 상태: 오버레이 즉시 숨기기
    const analyticsOverlay = document.getElementById('analytics-login-overlay');
    if (analyticsOverlay) {
      analyticsOverlay.style.display = 'none';
    }
    const restrictedOverlay = document.querySelector('.restricted-content-overlay');
    if (restrictedOverlay) {
      restrictedOverlay.style.display = 'none';
    }

    // 즉시 로딩 표시 (모듈 로드 대기 시간 동안 빈 화면 방지)
    const container = document.querySelector('.analytics-dashboard-container');
    // 이미 로드된 컨텐츠가 없거나 비어있을 때만 로딩 표시
    if (container && (!container.classList.contains('dashboard-loaded') && !document.querySelector('.stats-summary-grid'))) {
      // 임시 로딩 UI 주입 (기존 구조 유지하면서 로더만 추가)
      const existingLoader = document.getElementById('temp-analytics-loader');
      if (!existingLoader) {
        const loader = document.createElement('div');
        loader.id = 'temp-analytics-loader';
        loader.style.cssText = 'padding: 60px 0; text-align: center; color: #666;';
        loader.innerHTML = '<div class="loading-spinner" style="margin: 0 auto 10px; width: 30px; height: 30px; border: 3px solid #eee; border-top-color: #5FB2C9; border-radius: 50%; animation: spin 1s infinite linear;"></div><div>분석 도구를 불러오는 중...</div>';

        // overview-tab에 추가
        const overviewTab = document.getElementById('overview-tab');
        if (overviewTab) {
          overviewTab.insertBefore(loader, overviewTab.firstChild);
        }
      }
    }

    // 로그인 상태: 대시보드 모듈 동적 로드 및 초기화
    try {
      const dashboardModule = await import(`./analytics/analytics-dashboard.js?v=${getAppVersion()}`);

      // 임시 로더 제거
      const tempLoader = document.getElementById('temp-analytics-loader');
      if (tempLoader) tempLoader.remove();

      // 컨테이너에 로드 완료 클래스 표시
      if (container) container.classList.add('dashboard-loaded');

      // 대시보드 초기화 (내부 guard로 최초 1회만 실행됨)
      if (dashboardModule && typeof dashboardModule.initDashboard === 'function') {
        dashboardModule.initDashboard();
      }

      // 데이터 로드 — 매 탭 방문마다 호출 (loadAnalyticsData 내부에서 isLoading 중복 방지)
      if (dashboardModule && typeof dashboardModule.loadAnalyticsData === 'function') {
        const { ensureFirebase } = await import('./core/firebase-core.js');
        const { auth } = await ensureFirebase();
        const user = auth ? auth.currentUser : null;
        dashboardModule.loadAnalyticsData(user);
      }
    } catch (e) {
      console.error('대시보드 로드 실패:', e);
      const tempLoader = document.getElementById('temp-analytics-loader');
      if (tempLoader) {
        tempLoader.innerHTML = '<div style="color: red;">불러오기 실패. 페이지를 새로고침해주세요.</div>';
      }
    }
  } else {
    // 비로그인 상태: 로그인 모달 표시 (탭은 전환되도록 true 반환)
    if (typeof window.lazyAuthAndShowLoginModal === 'function') {
      window.lazyAuthAndShowLoginModal();
    } else if (typeof window.showLoginModal === 'function') {
      window.showLoginModal();
    }
  }

  // 항상 true 반환하여 탭 전환 허용 (오버레이는 표시되지만 탭은 전환됨)
  return true;
}

/**
 * 탭 기능 초기화
 */
function initTabs() {
  // 탭 버튼에 이벤트 리스너 추가 (메인 탭만)
  document.querySelectorAll('.access-tabs .tab-button').forEach(button => {
    if (!button.hasAttribute('onclick')) {  // onclick이 없는 버튼만 처리
      button.addEventListener('click', async function () {
        const tabId = this.getAttribute('data-tab');

        // 학습분석 탭 클릭 시 특별 처리
        if (tabId === 'analytics-tab') {
          const result = await window.handleAnalyticsTabClick();
          // 로그인하지 않은 경우 탭 전환하지 않음 (false 리턴 시)
          if (result === false) {
            return;
          }
          // true 리턴 시 (비로그인이라도) 탭 전환 진행
        }

        // 문제풀기 탭 클릭 시 로그인 체크
        if (tabId === 'quiz-tab') {
          const isLoggedIn = (typeof window.isUserLoggedIn === 'function')
            ? window.isUserLoggedIn()
            : localStorage.getItem('userLoggedIn') === 'true';

          if (!isLoggedIn) {
            // 비로그인 시 로그인 유도 (모달 표시)
            if (typeof window.lazyAuthAndShowLoginModal === 'function') {
              window.lazyAuthAndShowLoginModal();
            } else if (typeof window.showLoginModal === 'function') {
              window.showLoginModal();
            }
            // 탭 전환은 진행시켜서 "문제풀기 + 오버레이(있는 경우)"를 보여주거나 
            // UX상 탭 전환을 하면서 모달을 띄우는 게 자연스러움
          }
        }

        // 강의 탭: 상점 표시 (자격증 변경 시 상점 갱신)
        if (tabId === 'lecture-tab') {
          document.dispatchEvent(new CustomEvent('certChanged'));
        }

        if (tabId) {  // data-tab 속성이 있는 경우에만 처리
          showTab(tabId);
        }
      });
    }
  });

  // URL 해시 또는 referrer 기반으로 탭 복원 (뒤로가기 지원)
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['notice-tab', 'quiz-tab', 'analytics-tab', 'lecture-tab'];
  const defaultTab = (hash && validTabs.includes(hash)) ? hash : 'notice-tab';
  localStorage.setItem('lastActiveTab', defaultTab);
  window.Logger?.debug('탭 초기화', { defaultTab });

  // 탭 표시
  showTab(defaultTab);
}

/**
 * 공지사항 초기화
 */
function initNotices() {
  // 공지사항 컨테이너 확인
  const noticeContainer = document.getElementById('notice-list');
  if (!noticeContainer) return;

  // 공지사항 로드 (페이지네이션 포함, notice-ui.js의 DOMContentLoaded와 중복 방지)
  noticeContainer.dataset.initBy = 'app';
  loadNoticesWithPagination('notice-list', {
    itemsPerPage: 8,
    showBadges: true,
    showDates: true,
    dateFn: formatSimpleDate,
    paginationId: 'notice-pagination'
  }).catch(error => {
    window.Logger?.error('공지사항 로드 오류:', error);
    noticeContainer.innerHTML = `
      <div class="notice-error">
        공지사항을 불러오는 중 오류가 발생했습니다: ${error.message}
        <br>오류가 지속되면 관리자에게 문의해주세요.
      </div>
    `;
  });
}

/**
 * 빙하 애니메이션 효과 초기화 (반응형 개선)
 */
function initIcebergAnimation() {
  window.addEventListener('scroll', function () {
    const leftIceberg = document.querySelector('.iceberg-container.iceberg-left');
    const rightIceberg = document.querySelector('.iceberg-container.iceberg-right');
    let scrollPosition = window.scrollY;

    // 화면 크기에 따라 움직임 조절
    const screenWidth = window.innerWidth;
    let horizontalSpeed = 0.2;
    let verticalSpeed = 0.7;

    // 모바일에서는 움직임 감소
    if (screenWidth <= 480) {
      horizontalSpeed = 0.1;
      verticalSpeed = 0.4;
    } else if (screenWidth <= 768) {
      horizontalSpeed = 0.15;
      verticalSpeed = 0.5;
    }

    if (leftIceberg) {
      leftIceberg.style.transform = `translate(${-scrollPosition * horizontalSpeed}px, ${scrollPosition * verticalSpeed}px)`;
    }
    if (rightIceberg) {
      rightIceberg.style.transform = `translate(${scrollPosition * horizontalSpeed}px, ${scrollPosition * verticalSpeed}px)`;
    }
  });
}

/**
 * 탭 표시 함수 (로그인 체크 포함)
 * @param {string} tabId - 탭 ID
 */
function showTab(tabId) {
  // 제한 탭 접근 제어
  if (!guardTabAccess(tabId)) {
    return;
  }

  // 모든 탭 내용 숨기기
  document.querySelectorAll('.tab-content').forEach(tab => {
    // 서브탭 콘텐츠는 tab-content 클래스를 가지지 않으므로 제외할 필요 없음
    // 하지만 안전을 위해 analytics-tab 내부의 서브탭은 건드리지 않도록 함
    // (서브탭은 .sub-tab-content 클래스를 사용하므로 .tab-content 선택자에 포함되지 않음)
    tab.style.display = 'none';
    tab.classList.remove('active');
  });

  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });

  // 선택된 탭 내용과 버튼 활성화
  const selectedTab = document.getElementById(tabId);
  const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);

  if (selectedTab) {
    selectedTab.style.display = 'block';
    selectedTab.classList.add('active');
    currentTab = tabId;

    // 학습분석 탭이 표시된 경우 서브탭 초기화
    if (tabId === 'analytics-tab') {
      setTimeout(async () => {
        try {
          const dashboardModule = await import(`./analytics/analytics-dashboard.js?v=${getAppVersion()}`);
          if (dashboardModule && typeof dashboardModule.initAnalyticsSubTabs === 'function') {
            // 탭이 실제로 표시된 후 초기화
            dashboardModule.initAnalyticsSubTabs();
          }
        } catch (e) {
          console.error('서브탭 초기화 실패:', e);
        }
      }, 100); // DOM 업데이트를 위한 충분한 지연 시간
    }
  }

  if (selectedButton) {
    selectedButton.classList.add('active');
  }

  // 탭 선택 상태 저장 + URL 해시 업데이트 (뒤로가기 지원)
  localStorage.setItem('lastActiveTab', tabId);
  if (window.location.hash !== `#${tabId}`) {
    // 초기 로드(hash 없음)에서 기본 탭은 replaceState (URL에 #notice-tab 불필요)
    if (!window.location.hash && tabId === 'notice-tab') {
      history.replaceState({ tab: tabId }, '', window.location.pathname);
    } else {
      history.pushState({ tab: tabId }, '', `#${tabId}`);
    }
  }
}

/**
 * 로그인 상태에 따른 콘텐츠 제어
 * @param {boolean} isLoggedIn - 로그인 상태
 */
function updateRestrictedContent(isLoggedIn) {
  if (isLoggedIn === undefined) {
    isLoggedIn = isUserLoggedIn();
  }
  updateAuthRestrictedContent(isLoggedIn);
  syncLoginOverlays(document);
  setupRestrictedLinkDelegation(document);
}

/**
 * 콘텐츠 접근 제어 적용
 */
function applyContentRestrictions() {
  updateRestrictedContent(isUserLoggedIn());
}

// DOM 로드 시 앱 초기화
document.addEventListener('DOMContentLoaded', initApp);

// 인증 상태 변경 이벤트 리스너
document.addEventListener('authStateChanged', function (e) {
  window.__lastAuthState = !!e.detail.user;
  // 로그인 UI 업데이트
  updateLoginUI();

  // 제한된 콘텐츠 업데이트
  updateRestrictedContent(!!e.detail.user);

  // 플로팅 버튼 표시 여부 업데이트
  updateFloatingButtonsVisibility();

  // 관리자 전용 요소 표시/숨김
  const adminStatus = isAdmin();
  document.querySelectorAll('.admin-only').forEach(el => {
    if (adminStatus) {
      el.classList.add('admin-visible');
    } else {
      el.classList.remove('admin-visible');
    }
  });
});

window.addEventListener('loginStateChanged', function (e) {
  const isLoggedIn = !!e.detail?.isLoggedIn;
  window.__lastAuthState = isLoggedIn;
  updateRestrictedContent(isLoggedIn);
  updateLoginOverlays();
});

/**
 * 플로팅 버튼 초기화
 */
function initFloatingButtons() {
  const backToTopBtn = document.getElementById('fab-back-to-top');

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    // 스크롤 위치에 따른 맨위로 가기 버튼 표시/숨김
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });
  }

  // 관리자 공지 작성 버튼 상태 초기화
  updateFloatingButtonsVisibility();
}

/**
 * 관리자 권한에 따른 플로팅 버튼 표시 여부 업데이트
 */
function updateFloatingButtonsVisibility() {
  const adminNoticeBtn = document.getElementById('fab-admin-notice');
  if (adminNoticeBtn) {
    const adminStatus = isAdmin();
    if (adminStatus) {
      // 관리자일 때만 표시
      adminNoticeBtn.style.display = 'flex';
      // 애니메이션을 위해 약간의 지연 후 클래스 추가
      setTimeout(() => {
        adminNoticeBtn.classList.add('visible');
      }, 100);
    } else {
      // 일반 사용자는 숨김
      adminNoticeBtn.classList.remove('visible');
      // 애니메이션 완료 후 display: none 처리
      setTimeout(() => {
        if (!adminNoticeBtn.classList.contains('visible')) {
          adminNoticeBtn.style.display = 'none';
        }
      }, 400);
    }
  }
}

// 뒤로가기/앞으로가기 시 탭 복원
window.addEventListener('popstate', (e) => {
  const tabId = e.state?.tab || window.location.hash.replace('#', '') || 'notice-tab';
  const validTabs = ['notice-tab', 'quiz-tab', 'analytics-tab', 'lecture-tab'];
  if (validTabs.includes(tabId)) {
    // pushState 중복 방지를 위해 직접 탭 전환
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
      document.querySelectorAll('.tab-content').forEach(t => { t.style.display = 'none'; t.classList.remove('active'); });
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      selectedTab.style.display = 'block';
      selectedTab.classList.add('active');
      const btn = document.querySelector(`[data-tab="${tabId}"]`);
      if (btn) btn.classList.add('active');
      localStorage.setItem('lastActiveTab', tabId);
    }
  }
});

// bfcache 복원 시 학습 데이터 갱신 (문제 풀고 뒤로가기 시)
window.addEventListener('pageshow', (e) => {
  if (e.persisted && window.location.hash === '#analytics-tab' && window.auth?.currentUser && window.loadAnalyticsData) {
    window.loadAnalyticsData(window.auth.currentUser);
  }
});

// 전역 함수 노출 (마이그레이션 호환성 유지)
window.showTab = showTab;
window.updateRestrictedContent = updateRestrictedContent;
window.applyContentRestrictions = applyContentRestrictions;


// 함수 내보내기 추가
export { initApp };