// analytics-app.js - 학습 분석 페이지 메인 컨트롤러 (오답노트 기능 제거)

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth, db } from "../core/firebase-core.js";
import { isUserLoggedIn, isAdmin } from "../auth/auth-utils.js";
import { showLoginModal, closeLoginModal } from "../auth/auth-ui.js";
import { getUserAttempts, getUserMockExamResults, getUserProgress } from "../data/quiz-repository.js";
import { initDashboard, loadAnalyticsData } from "./analytics-dashboard.js";
import { sessionManager } from '../data/session-manager.js';
import { isDevMode, getMockUser } from "../config/dev-config.js";
// 오답노트 임포트 제거

// 전역 상태
let dashboardInitialized = false;
let currentTab = 'overview-tab';
const devParams = new URLSearchParams(window.location.search);
const hasDevBypassParam = devParams.get('test') === '1' || devParams.get('dev') === '1';

function enforceDevBypassVisibility() {
  if (!hasDevBypassParam) return;

  applyVisibilityState({
    canViewDashboard: true,
    canViewAdmin: true
  });
}

/**
 * 학습 분석 페이지 초기화
 */
function initAnalyticsPage() {
  console.log('학습 분석 페이지 초기화...');
  
  // 탭 초기화
  initTabs();
  
  // 이벤트 리스너 등록
  setupEventListeners();
  
  // 로그인 상태 확인
  checkLoginStatus();

  // 개발 점검 파라미터가 있으면 auth 리스너 이후에도 표시 상태 유지
  enforceDevBypassVisibility();
  setTimeout(enforceDevBypassVisibility, 300);
  setTimeout(enforceDevBypassVisibility, 1200);
  
  console.log('학습 분석 페이지 초기화 완료');
}


 //탭 전환 기능 초기화
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('탭 초기화:', tabButtons.length, '개의 버튼,', tabContents.length, '개의 콘텐츠');
  
  // 초기 탭 설정 (처음 탭 활성화)
  const initialTab = 'overview-tab';
  tabContents.forEach(content => {
    if (content.id === initialTab) {
      content.classList.add('active');
      content.style.display = 'block';
    } else {
      content.classList.remove('active');
      content.style.display = 'none';
    }
  });
  
  // 활성 탭 버튼 설정
  tabButtons.forEach(button => {
    if (button.dataset.tab === initialTab) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
    
    // 탭 버튼 클릭 이벤트 리스너
    button.addEventListener('click', (e) => {
      console.log('탭 버튼 클릭:', button.dataset.tab);
      
      // 이벤트 기본 동작 방지
      e.preventDefault();
      
      // 모든 탭 버튼 비활성화
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // 클릭한 탭 버튼 활성화
      button.classList.add('active');
      
      // 탭 ID 가져오기
      const tabId = button.dataset.tab;
      
      // 모든 탭 콘텐츠 숨기기
      tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      // 선택한 탭 콘텐츠 표시
      const selectedContent = document.getElementById(tabId);
      if (selectedContent) {
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
        console.log('탭 콘텐츠 표시:', tabId);
      }
      
      // 현재 탭 업데이트 (전역 상태)
      currentTab = tabId;
      
      // 탭 변경 이벤트 발생
      document.dispatchEvent(new CustomEvent('tabChanged', { 
        detail: { tab: tabId } 
      }));
    });
  });
}
/**
 * 이벤트 리스너 등록
 */
function setupEventListeners() {
  // 로그인 관련 버튼 이벤트
  document.querySelectorAll('[data-action="show-login"]').forEach(element => {
    element.addEventListener('click', showLoginModal);
  });
  
  document.querySelectorAll('[data-action="close-modal"]').forEach(element => {
    element.addEventListener('click', closeLoginModal);
  });
  
  // 필터 버튼 이벤트
  const applySetFiltersBtn = document.getElementById('apply-set-filters');
  if (applySetFiltersBtn) {
    applySetFiltersBtn.addEventListener('click', applySetFilters);
  }
  
  const applyHistoryFiltersBtn = document.getElementById('apply-history-filters');
  if (applyHistoryFiltersBtn) {
    applyHistoryFiltersBtn.addEventListener('click', applyHistoryFilters);
  }
  
  // 관리자 통계 로드 버튼
  const loadAdminStatsBtn = document.getElementById('load-admin-stats');
  if (loadAdminStatsBtn) {
    loadAdminStatsBtn.addEventListener('click', loadAdminStats);
  }
  
  // 대시보드 준비 완료 이벤트
  document.addEventListener('dashboardReady', handleDashboardReady);
  
  // 오답노트 필터 이벤트 리스너 제거
}

/**
 * 문제풀이기록 필터 적용
 */
function applySetFilters() {
  const typeFilter = document.getElementById('set-type-filter').value;
  const subjectFilter = document.getElementById('set-subject-filter').value;
  const yearFilter = document.getElementById('set-year-filter').value;
  
  // 필터 이벤트 발생
  document.dispatchEvent(new CustomEvent('setFiltersChanged', { 
    detail: { 
      type: typeFilter,
      subject: subjectFilter,
      year: yearFilter
    } 
  }));
}

/**
 * 풀이 기록 필터 적용
 */
function applyHistoryFilters() {
  const typeFilter = document.getElementById('history-type-filter').value;
  const resultFilter = document.getElementById('history-result-filter').value;
  
  // 필터 이벤트 발생
  document.dispatchEvent(new CustomEvent('historyFiltersChanged', { 
    detail: { 
      type: typeFilter,
      result: resultFilter
    } 
  }));
}

/**
 * 관리자 통계 로드
 */
function loadAdminStats() {
  const setFilter = document.getElementById('admin-set-filter').value;
  const yearFilter = document.getElementById('year-filter').value;
  const subjectFilter = document.getElementById('subject-filter').value;
  
  // 관리자 통계 로드 이벤트 발생
  document.dispatchEvent(new CustomEvent('loadAdminStats', { 
    detail: { 
      set: setFilter,
      year: yearFilter,
      subject: subjectFilter
    } 
  }));
}

/**
 * 대시보드 준비 완료 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleDashboardReady(e) {
  const { user } = e.detail;
  
  // 관리자 확인 및 관리자 탭 표시
  if (isAdmin(user)) {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'block';
    });
  }
  
  // 아직 초기화되지 않은 경우만 실행
  if (!dashboardInitialized) {
    dashboardInitialized = true;
    
    // 대시보드 초기화
    initDashboard();
    
    // 분석 데이터 로드
    loadAnalyticsData(user);
  }
}

/**
 * 로그인 상태 확인 및 처리
 */
function applyVisibilityState({ canViewDashboard, canViewAdmin }) {
  const loginRequired = document.getElementById('login-required');
  const analyticsDashboard = document.getElementById('analytics-dashboard');

  if (loginRequired) {
    loginRequired.style.display = canViewDashboard ? 'none' : 'block';
  }

  if (analyticsDashboard) {
    analyticsDashboard.style.display = canViewDashboard ? 'block' : 'none';
  }

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = canViewAdmin ? 'block' : 'none';
  });
}

function checkLoginStatus() {
  const loggedIn = isUserLoggedIn();
  const devMode = hasDevBypassParam || (typeof isDevMode === 'function' && isDevMode());
  
  if (loggedIn || devMode) {
    applyVisibilityState({
      canViewDashboard: true,
      canViewAdmin: devMode || (auth?.currentUser ? isAdmin(auth.currentUser) : false)
    });
    
    // 개발자 모드일 때도 데이터 로드
    if (devMode && !dashboardInitialized) {
      dashboardInitialized = true;
      initDashboard();
      const mockUser = typeof getMockUser === 'function' ? getMockUser() : null;
      loadAnalyticsData(mockUser);
    }
  } else {
    applyVisibilityState({
      canViewDashboard: false,
      canViewAdmin: false
    });
  }
}

/**
 * 인증 상태 변경 감지 및 처리
 */
function setupAuthStateListener() {
  const devModeLocked = hasDevBypassParam || (typeof isDevMode === 'function' && isDevMode());

  onAuthStateChanged(auth, user => {
    console.log('인증 상태 변경:', user ? '로그인됨' : '로그아웃 상태');
    const devMode = devModeLocked || (typeof isDevMode === 'function' && isDevMode());
    
    if (user || devMode) {
      applyVisibilityState({
        canViewDashboard: true,
        canViewAdmin: devMode || (user ? isAdmin(user) : false)
      });
      
      // 아직 초기화되지 않은 경우만 실행
      if (!dashboardInitialized) {
        dashboardInitialized = true;
        
        // 대시보드 초기화
        initDashboard();
        
        // 분석 데이터 로드 (개발모드는 목 사용자로 처리)
        const analyticsUser = user || (typeof getMockUser === 'function' ? getMockUser() : null);
        loadAnalyticsData(analyticsUser);
      }
    } else {
      applyVisibilityState({
        canViewDashboard: false,
        canViewAdmin: false
      });
      
      // 대시보드 초기화 상태 리셋
      dashboardInitialized = false;
    }
  });
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initAnalyticsPage();
  setupAuthStateListener();
});

// 로그인 모달 관련 함수 전역 노출 (기존 인라인 이벤트 핸들러와의 호환성 유지)
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.loadAnalyticsData = loadAnalyticsData; // 🎯 자격증 전환 시 사용
window.loginAndCloseModal = () => {
  // 구글 로그인 후 모달 닫기
  import("../auth/auth-core.js").then(module => {
    module.handleGoogleLogin().then(() => {
      closeLoginModal();
    }).catch(error => {
      console.error('로그인 오류:', error);
      alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    });
  });
};