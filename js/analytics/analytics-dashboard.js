// analytics-dashboard.js - 통합된 학습 분석 대시보드 기능
// Last updated: 2025-01-21 - Fixed totalQuestions duplicate declaration

import { getUserAttempts, getUserMockExamResults } from "../data/quiz-data-service.js";
import { getUserProgress } from "../data/quiz-repository.js";
import { db, ADMIN_EMAILS, ensureAuthReady } from "../core/firebase-core.js";
import { getCurrentCertificateType, getCertificateName, getCertificateEmoji } from "../utils/certificate-utils.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  writeBatch,
  updateDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { auth } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";
import { formatRelativeDate } from '../utils/date-utils.js';
import { sessionManager } from '../data/session-manager.js';
import { showLoading, hideLoading, showError, showToast } from "../utils/ui-utils.js";
import { getScoreColor, getWeaknessColor } from './chart-utils.js';
import { isDevMode } from "../config/dev-config.js";
import {
  renderExpectedScore,
  renderLearningTrend,
  renderWeakQuestions,
  renderReviewRecommendations,
  renderLearningPattern
} from './advanced-analytics-ui.js';
import { analyzeWeaknesses } from './user-analytics.js';
import StatsCache from '../utils/stats-cache.js';
import { renderProgressTabStandalone } from './render-progress-tab-function.js';

// 차트 및 분석 데이터 상태
const state = {
  attempts: [],
  mockExamResults: [],
  userProgress: null,
  isLoading: false,
  error: null,
  chartInstances: {},
  lastRefreshTime: null
};

// 과목 색상 매핑
const subjectColors = {
  '운동생리학': '#4285F4',
  '건강체력평가': '#34A853',
  '운동처방론': '#FBBC05',
  '운동부하검사': '#EA4335',
  '운동상해': '#1976D2',
  '기능해부학': '#0097A7',
  '병태생리학': '#FFA000',
  '스포츠심리학': '#C2185B'
};

// 학습 진행률 탭 스타일은 css/analytics-dashboard.css에서 관리됨

/**
 * 대시보드 초기화
 */
export function initDashboard() {
  // console.log('대시보드 초기화 시작');

  // 로그인 상태 확인 및 오버레이 처리
  if (auth && auth.currentUser) {
    // 로그인 상태: 오버레이 숨기기
    const analyticsOverlay = document.getElementById('analytics-login-overlay');
    if (analyticsOverlay) {
      analyticsOverlay.style.display = 'none';
    }
    const restrictedOverlay = document.querySelector('.restricted-content-overlay');
    if (restrictedOverlay) {
      restrictedOverlay.style.display = 'none';
    }
  }

  // 로딩 UI 표시
  showLoading();

  // 탭 변경 이벤트 리스너
  document.addEventListener('tabChanged', handleTabChange);

  // 필터 변경 이벤트 리스너
  document.addEventListener('setFiltersChanged', handleSetFiltersChange);
  document.addEventListener('historyFiltersChanged', handleHistoryFiltersChange);

  // 관리자 통계 이벤트 리스너
  document.addEventListener('loadAdminStats', handleLoadAdminStats);

  // 새로고침 버튼 이벤트 리스너
  const refreshButton = document.getElementById('refresh-data');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => refreshDataIfNeeded(true));
  }

  // 서브탭 초기화는 탭이 표시될 때 app.js에서 처리하도록 변경
  // initAnalyticsSubTabs(); // 제거: 탭이 표시될 때만 초기화하도록 변경

  // console.log('대시보드 초기화 완료');
}

// 서브탭 초기화 상태 추적
let subTabsInitialized = false;

/**
 * 학습분석 탭 내부 서브탭 초기화
 */
export function initAnalyticsSubTabs() {
  // 중복 초기화 방지
  if (subTabsInitialized) {
    return;
  }

  const analyticsTab = document.getElementById('analytics-tab');
  if (!analyticsTab) {
    console.warn('analytics-tab을 찾을 수 없습니다.');
    return;
  }

  // analytics-tab이 표시되어 있는지 확인 (더 정확한 체크)
  const isTabVisible = analyticsTab.offsetParent !== null ||
    analyticsTab.style.display === 'block' ||
    analyticsTab.classList.contains('active');

  if (!isTabVisible) {
    // 탭이 표시되지 않았으면 초기화하지 않음 (경고 로그 제거)
    return;
  }

  const subTabButtons = analyticsTab.querySelectorAll('.sub-tabs .sub-tab-button');
  const subTabContents = analyticsTab.querySelectorAll('.sub-tab-content');

  if (subTabButtons.length === 0 || subTabContents.length === 0) {
    // HTML 구조가 준비되지 않았으면 초기화하지 않음 (경고 로그 제거)
    return;
  }

  console.log(`서브탭 초기화 시작: 버튼 ${subTabButtons.length}개, 콘텐츠 ${subTabContents.length}개`);

  // 중복 이벤트 리스너 방지
  subTabButtons.forEach(button => {
    if (button.dataset.listenerAttached === 'true') return;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 이벤트 버블링 방지

      const tabId = button.dataset.tab;
      if (!tabId) {
        console.warn('탭 ID를 찾을 수 없습니다.');
        return;
      }

      console.log(`학습분석 서브탭 클릭: ${tabId}`);

      // 버튼 활성화 상태 변경
      subTabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // 콘텐츠 표시/숨김 (클래스 기반 접근)
      let foundContent = false;
      subTabContents.forEach(content => {
        if (content.id === tabId) {
          content.classList.add('active');
          // 인라인 스타일 제거 (CSS 클래스가 처리하도록)
          content.style.display = '';
          foundContent = true;
          console.log(`✅ 서브탭 콘텐츠 표시: ${tabId}`, {
            element: content,
            hasActiveClass: content.classList.contains('active'),
            computedDisplay: window.getComputedStyle(content).display
          });
        } else {
          content.classList.remove('active');
          // 인라인 스타일 제거
          content.style.display = '';
        }
      });

      if (!foundContent) {
        console.error(`❌ 서브탭 콘텐츠를 찾을 수 없습니다: ${tabId}`);
        console.log('사용 가능한 콘텐츠 ID:', Array.from(subTabContents).map(c => c.id));
        return;
      }

      // 개별 탭 렌더링 함수 호출
      try {
        if (tabId === 'overview-tab') {
          renderOverviewTab();
        } else if (tabId === 'question-sets-tab') {
          console.log('문제풀이기록 탭 렌더링 시작...');
          renderQuestionSetsTab();
        } else if (tabId === 'weak-areas-tab') {
          renderWeakAreasTab();
        } else if (tabId === 'progress-tab') {
          renderProgressTab();
        } else if (tabId === 'admin-tab') {
          renderAdminTab();
        }
      } catch (error) {
        console.error(`탭 렌더링 오류 (${tabId}):`, error);
      }

      // 기존 이벤트 시스템과의 호환성을 위해 이벤트 발생
      document.dispatchEvent(new CustomEvent('tabChanged', {
        detail: { tab: tabId }
      }));
    });

    button.dataset.listenerAttached = 'true';
  });

  // 초기 활성 탭 설정
  const activeBtn = analyticsTab.querySelector('.sub-tabs .sub-tab-button.active');
  if (activeBtn) {
    const activeTabId = activeBtn.dataset.tab;
    console.log(`초기 활성 탭: ${activeTabId}`);
    subTabContents.forEach(content => {
      if (content.id === activeTabId) {
        content.classList.add('active');
        // 인라인 스타일 제거 (CSS 클래스가 처리하도록)
        content.style.display = '';
        console.log(`초기 서브탭 콘텐츠 표시: ${activeTabId}`, {
          element: content,
          hasActiveClass: content.classList.contains('active'),
          computedDisplay: window.getComputedStyle(content).display
        });
      } else {
        content.classList.remove('active');
        // 인라인 스타일 제거
        content.style.display = '';
      }
    });

    // 초기 탭 렌더링 호출
    if (activeTabId === 'overview-tab') renderOverviewTab();
    else if (activeTabId === 'question-sets-tab') renderQuestionSetsTab();
  } else {
    console.warn('초기 활성 서브탭 버튼을 찾을 수 없습니다.');
  }

  // 초기화 완료 플래그 설정
  subTabsInitialized = true;
  console.log(`서브탭 초기화 완료: 버튼 ${subTabButtons.length}개, 콘텐츠 ${subTabContents.length}개`);
}

/**
 * 서브탭 초기화 상태 리셋 (탭이 숨겨졌을 때 호출 가능)
 */
export function resetSubTabsInitialization() {
  subTabsInitialized = false;
}

/**
 * 탭 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleTabChange(e) {
  // console.log('탭 변경:', e.target.dataset.tab);
  const { tab } = e.detail;
  // console.log('탭 변경:', tab);

  // 탭에 따른 특정 작업 처리
  switch (tab) {
    case 'overview-tab':
      renderOverviewTab();
      break;
    case 'question-sets-tab':
      renderQuestionSetsTab();
      break;
    case 'weak-areas-tab':
      renderWeakAreasTab();
      break;
    case 'progress-tab':
      renderProgressTab();
      break;
    case 'admin-tab':
      renderAdminTab();
      break;
  }
}

/**
 * 대시보드 전체 렌더링 함수
 */
function renderDashboard() {
  // console.log('대시보드 렌더링 시작');

  // 각 탭 렌더링
  renderOverviewTab();

  // 현재 활성화된 탭 확인
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) {
    const tabId = activeTab.dataset.tab;

    // 현재 탭에 따른 렌더링
    switch (tabId) {
      case 'question-sets-tab':
        renderQuestionSetsTab();
        break;
      case 'weak-areas-tab':
        renderWeakAreasTab();
        break;
      case 'history-tab':
        renderHistoryTab();
        break;
      case 'progress-tab':
        renderProgressTab();
        break;
      case 'admin-tab':
        renderAdminTab();
        break;
    }
  }

  // console.log('대시보드 렌더링 완료');
}

/**
 * 개발자 모드용 가상 문제 풀이 데이터 생성
 * @param {string} certificateType - 자격증 타입
 * @returns {Array} 가상 문제 풀이 기록 배열
 */
function generateMockAttempts(certificateType = 'health-manager') {
  const subjects = certificateType === 'health-manager' 
    ? ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사', '운동상해', '기능해부학', '병태생리학', '스포츠심리학']
    : ['노인체육론', '스포츠교육학', '스포츠사회학', '스포츠심리학', '스포츠윤리', '운동생리학', '운동역학', '유아체육론', '특수체육론', '한국체육사'];
  
  const years = ['2025', '2024', '2023', '2022'];
  const attempts = [];
  const now = new Date();

  // 각 과목별로 다양한 연도의 문제 생성
  subjects.forEach((subject, subjectIndex) => {
    years.forEach((year, yearIndex) => {
      // 각 연도별로 20-30문제 생성
      const questionCount = 20 + Math.floor(Math.random() * 11);
      
      for (let i = 1; i <= questionCount; i++) {
        // 정답률을 다양하게 설정 (약점 과목은 낮게, 강점 과목은 높게)
        const baseAccuracy = subjectIndex < 4 ? 0.7 : 0.5; // 앞 4개 과목은 70%, 나머지는 50%
        const isCorrect = Math.random() < baseAccuracy;
        
        // 시간을 다양하게 설정 (최근 30일 내)
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        
        attempts.push({
          id: `mock-${subject}-${year}-${i}`,
          userId: 'dev-user-123',
          timestamp: timestamp,
          questionData: {
            year: year,
            subject: subject,
            number: i,
            globalIndex: (subjectIndex * 100) + (yearIndex * 20) + i - 1
          },
          userAnswer: Math.floor(Math.random() * 4),
          isCorrect: isCorrect,
          certificateType: certificateType,
          sessionId: `mock-session-${subject}-${year}`,
          isFirstAttempt: Math.random() > 0.3, // 70%는 첫 시도
          firstAttemptAnswer: Math.floor(Math.random() * 4),
          firstAttemptIsCorrect: isCorrect,
          setType: 'regular'
        });
      }
    });
  });

  // 최신순으로 정렬
  attempts.sort((a, b) => b.timestamp - a.timestamp);
  
  console.log(`[개발자 모드] ${attempts.length}개의 가상 문제 풀이 기록 생성됨`);
  return attempts;
}

/**
 * 개발자 모드용 가상 모의고사 결과 생성
 * @param {string} certificateType - 자격증 타입
 * @returns {Array} 가상 모의고사 결과 배열
 */
function generateMockExamResults(certificateType = 'health-manager') {
  const years = ['2025', '2024', '2023'];
  const results = [];
  const now = new Date();

  years.forEach((year, yearIndex) => {
    // 1교시와 2교시 각각 생성
    for (let hour = 1; hour <= 2; hour++) {
      const daysAgo = yearIndex * 30 + (hour - 1) * 15;
      const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      // 점수를 다양하게 설정 (합격/불합격 케이스)
      const baseScore = hour === 1 ? 280 : 260; // 1교시는 조금 높게
      const score = baseScore + Math.floor(Math.random() * 80) - 40; // ±40점 변동
      
      const subjectScores = {};
      const subjects = hour === 1 
        ? ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사']
        : ['운동상해', '기능해부학', '병태생리학', '스포츠심리학'];
      
      subjects.forEach(subject => {
        // 과목별 점수 (40-100점)
        subjectScores[subject] = 50 + Math.floor(Math.random() * 50);
      });

      results.push({
        id: `mock-exam-${year}-${hour}`,
        userId: 'dev-user-123',
        year: year,
        hour: hour.toString(),
        examType: '모의고사',
        totalScore: score,
        subjectScores: subjectScores,
        timestamp: timestamp,
        certificateType: certificateType,
        isPassed: score >= 480 && Object.values(subjectScores).every(s => s >= 40)
      });
    }
  });

  console.log(`[개발자 모드] ${results.length}개의 가상 모의고사 결과 생성됨`);
  return results;
}

/**
 * 분석 데이터 로드
 * @param {Object} user - 현재 사용자 정보
 */
export async function loadAnalyticsData(user) {
  // console.log('분석 데이터 로드 시작:', user);

  try {
    showLoading('학습 데이터를 불러오는 중...');
    state.isLoading = true;

    // 🎯 현재 선택된 자격증 가져오기
    const currentCertType = getCurrentCertificateType();
    const certName = getCertificateName(currentCertType);
    
    // 🔧 개발자 모드 확인
    const devMode = typeof isDevMode === 'function' && isDevMode();
    
    if (devMode) {
      // 개발자 모드: 가상 데이터 생성
      window.Logger?.info(`🔧 [개발자 모드] ${certName} 가상 데이터 생성 중...`);
      
      state.attempts = generateMockAttempts(currentCertType);
      state.mockExamResults = generateMockExamResults(currentCertType);
      state.userProgress = {
        mockExamProgress: {},
        regularProgress: {}
      };
      
      window.Logger?.debug(`📊 [${certName}] 가상 문제 풀이 기록: ${state.attempts.length}개`);
      window.Logger?.debug(`📊 [${certName}] 가상 모의고사 결과: ${state.mockExamResults.length}개`);
    } else {
      // Firebase 초기화 보장
      const ensured = await ensureFirebase();
      const finalUser = user || (ensured && ensured.auth ? ensured.auth.currentUser : null);

      if (!finalUser) {
        window.Logger?.warn('⚠️ 로그인된 사용자가 없습니다. 기본 통계만 표시합니다.');
      }

      window.Logger?.info(`📊 [${certName}] 학습 데이터 로드 시작...`);

      // 문제 풀이 기록 가져오기 (최근 1000개, 자격증 필터링)
      state.attempts = await getUserAttempts(1000, currentCertType);
      window.Logger?.debug(`📊 [${certName}] 문제 풀이 기록: ${state.attempts.length}개`);

      // 모의고사 결과 가져오기 (최근 30개, 자격증 필터링)
      state.mockExamResults = await getUserMockExamResults(30, currentCertType);
      window.Logger?.debug(`📊 [${certName}] 모의고사 결과: ${state.mockExamResults.length}개`);

      // 사용자 학습 진행률 가져오기
      state.userProgress = await getUserProgress();
    }

    // 전역 객체에 저장 (다른 컴포넌트에서 접근 가능하도록)
    window.userAttempts = state.attempts;

    // window.state 설정 (render-progress-tab-function.js에서 사용)
    if (!window.state) {
      window.state = {};
    }
    window.state.userProgress = state.userProgress;
    window.state.mockExamResults = state.mockExamResults; // ✅ 모의고사결과 추가

    // console.log('데이터 로드 완료:', {
    //   attempts: state.attempts.length,
    //   mockExamResults: state.mockExamResults.length,
    //   userProgress: state.userProgress
    // });

    // 마지막 새로고침 시간 기록
    state.lastRefreshTime = Date.now();

    // 오류 상태 초기화
    state.error = null;

    // 내 노트 컴포넌트 기능 비활성화
    // console.log('내 노트 기능이 비활성화되었습니다.');

    // 대시보드 렌더링
    renderDashboard();

    // 대시보드 준비 완료 이벤트
    document.dispatchEvent(new CustomEvent('dashboardReady', {
      detail: { user }
    }));

  } catch (error) {
    // console.error('분석 데이터 로드 오류:', error);
    state.error = error.message || '데이터를 불러오는 중 오류가 발생했습니다.';
    showError(state.error);
  } finally {
    state.isLoading = false;
    hideLoading();
  }
}

/**
 * 데이터 새로고침이 필요한지 확인하고 실행
 * @param {boolean} force - 강제 새로고침 여부
 */
async function refreshDataIfNeeded(force = false) {
  // console.log('데이터 새로고침 필요 여부 확인:', force);

  // 현재 로드 중이면 무시
  if (state.isLoading) return;

  // 마지막 새로고침으로부터 5분 이내면 무시 (강제가 아닌 경우)
  if (!force && state.lastRefreshTime && (Date.now() - state.lastRefreshTime) < 5 * 60 * 1000) {
    showToast('최근에 이미 데이터를 새로고침했습니다.');
    return;
  }

  // 사용자 확인
  const ensured = await ensureFirebase();
  const user = ensured.auth ? ensured.auth.currentUser : null;
  if (!user) {
    showToast('데이터를 새로고침하려면 로그인이 필요합니다.');
    return;
  }

  // 데이터 로드 시작
  await loadAnalyticsData(user);
  showToast('데이터가 성공적으로 새로고침되었습니다.');
}

/**
 * 문제풀이기록 필터 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleSetFiltersChange(e) {
  // console.log('필터 변경:', e.target.value);
  const { type, subject, year } = e.detail;
  // console.log('세트 필터 변경:', { type, subject, year });

  // 필터 적용하여 문제풀이기록 다시 렌더링
  renderFilteredQuestionSets(type, subject, year);
}

/**
 * 기록 필터 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleHistoryFiltersChange(e) {
  const { type, result } = e.detail;
  // console.log('기록 필터 변경:', { type, result });

  // 필터 적용하여 기록 다시 렌더링
  renderFilteredHistory(type, result);
}

/**
 * 관리자 통계 로드 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleLoadAdminStats(e) {
  const { set, year, subject } = e.detail;
  // console.log('관리자 통계 로드:', { set, year, subject });

  // 관리자 통계 로드 및 렌더링
  loadAndRenderAdminStats(set, year, subject);
}

/**
 * 🎯 개요 통계 렌더링 (자격증 완전 분리)
 */
function renderOverviewStats() {
  const container = document.getElementById('overview-stats');
  if (!container) return;

  // 🎯 현재 선택된 자격증
  const currentCertType = getCurrentCertificateType();
  const certName = getCertificateName(currentCertType);
  const certEmoji = getCertificateEmoji(currentCertType);

  console.log(`[개요 통계] ${certName} 자격증 데이터 렌더링 중...`);

  // 🔒 현재 자격증으로 필터링
  const filteredAttempts = state.attempts || []; // state.attempts는 이미 필터링되어 있을 수 있음 (loadAnalyticsData에서)

  // 데이터 없는 경우 처리
  if (filteredAttempts.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <div style="font-size: 48px; margin-bottom: 16px;">${certEmoji}</div>
        <p><strong>${certName}</strong>에 대한 학습 데이터가 아직 없습니다.</p>
        <p style="margin-top: 8px; color: #6b7280;">문제를 풀어보면 학습 통계가 표시됩니다.</p>
      </div>
    `;
    return;
  }

  // 🔧 중복 제거: 같은 문제를 여러 번 풀었을 때 최신 기록만 카운트
  const uniqueAttempts = [];
  const processedQuestions = new Map(); // questionId -> 최신 attempt

  for (const attempt of filteredAttempts) {
    // 고유 문제 ID 생성
    let questionId;
    if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
      questionId = `g_${attempt.questionData.globalIndex}`;
    } else if (attempt.questionNumber) {
      questionId = `n_${attempt.questionNumber}`;
    } else {
      const subject = attempt.subject || attempt.questionData?.subject || '';
      const number = attempt.questionData?.number || attempt.number || 0;
      questionId = `${subject}_${number}`;
    }

    // 타임스탬프 비교
    const timestamp = attempt.timestamp?.toDate ? attempt.timestamp.toDate() :
      (attempt.timestamp instanceof Date ? attempt.timestamp : new Date(attempt.timestamp));

    if (!processedQuestions.has(questionId)) {
      processedQuestions.set(questionId, attempt);
    } else {
      const existingAttempt = processedQuestions.get(questionId);
      const existingTimestamp = existingAttempt.timestamp?.toDate ? existingAttempt.timestamp.toDate() :
        (existingAttempt.timestamp instanceof Date ? existingAttempt.timestamp : new Date(existingAttempt.timestamp));

      if (timestamp > existingTimestamp) {
        processedQuestions.set(questionId, attempt);
      }
    }
  }

  uniqueAttempts.push(...processedQuestions.values());

  // 🎯 현재 자격증 통계 계산
  const totalAttempts = uniqueAttempts.length;
  const totalCorrect = uniqueAttempts.filter(attempt => attempt.isCorrect).length;
  const correctPercentage = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  // 최근 활동
  const sortedUniqueAttempts = [...uniqueAttempts].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate() :
      (a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp));
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate() :
      (b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp));
    return timeB - timeA;
  });

  const lastActivity = sortedUniqueAttempts.length > 0
    ? formatRelativeDate(sortedUniqueAttempts[0].timestamp)
    : '없음';

  // 통계 카드 HTML
  const certHeader = `
    <div class="cert-summary-banner">
      <div class="cert-banner-icon">${certEmoji}</div>
      <div class="cert-banner-info">
        <div class="cert-banner-name">${certName}</div>
        <div class="cert-banner-desc">학습 리포트</div>
      </div>
    </div>
  `;

  const html = certHeader + `
    <div class="overview-stats-grid">
      <div class="overview-stat-item">
        <div class="overview-stat-value">${totalAttempts}</div>
        <div class="overview-stat-label">총 문제 풀이</div>
      </div>
      
      <div class="overview-stat-item">
        <div class="overview-stat-value" style="color: ${correctPercentage >= 60 ? '#059669' : (correctPercentage >= 40 ? '#D97706' : '#DC2626')}">${correctPercentage}%</div>
        <div class="overview-stat-label">평균 정답률</div>
      </div>
      
      <div class="overview-stat-item">
        <div class="overview-stat-value" style="color: #0284C7; font-size: 1.8rem; margin-top: 4px; margin-bottom: 12px;">${lastActivity}</div>
        <div class="overview-stat-label">최근 학습일</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * 학습 개요 탭 렌더링
 */
function renderOverviewTab() {
  // console.log('학습 개요 탭 렌더링...');

  // 개요 통계 렌더링
  renderOverviewStats();

  // 예상 점수 렌더링
  renderExpectedScore(state.attempts);

  // 학습 트렌드 렌더링
  renderLearningTrend(state.attempts);

  // 과목별 학습 현황 렌더링
  renderSubjectProgress();

  // 취약 문제 및 복습 추천 렌더링
  renderWeakQuestions(state.attempts);
  renderReviewRecommendations(state.attempts);

  // 학습 패턴 분석 렌더링
  renderLearningPattern(state.attempts);
}

/**
 * 중복 제거 함수 - 같은 문제를 여러 번 풀었을 때 최신 기록만 유지
 * @param {Array} attempts - 문제 풀이 기록 배열
 * @returns {Array} 중복 제거된 문제 풀이 기록 배열
 */
function removeDuplicateAttempts(attempts) {
  if (!attempts || attempts.length === 0) {
    return [];
  }

  const uniqueAttempts = [];
  const processedQuestions = new Map(); // questionId -> 가장 최신 attempt

  // 시간순으로 정렬 (최신이 앞에 오도록)
  const sortedAttempts = [...attempts].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() :
      (a.timestamp instanceof Date ? a.timestamp.getTime() :
        (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0));
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() :
      (b.timestamp instanceof Date ? b.timestamp.getTime() :
        (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0));
    return timeB - timeA; // 최신이 앞에
  });

  for (const attempt of sortedAttempts) {
    // 고유 문제 ID 생성 (globalIndex 우선, 없으면 subject+number 조합)
    let questionId;

    if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
      questionId = `g_${attempt.questionData.globalIndex}`;
    } else if (attempt.questionNumber !== undefined && attempt.questionNumber !== null) {
      questionId = `q_${attempt.questionNumber}`;
    } else {
      // globalIndex 없으면 subject+number+year 조합
      const subject = attempt.subject || attempt.questionData?.subject || '';
      const number = attempt.questionData?.number || attempt.number || 0;
      const year = attempt.questionData?.year || '';
      questionId = `${year}_${subject}_${number}`;
    }

    // 같은 문제가 이미 처리되지 않았으면 추가
    if (questionId && !processedQuestions.has(questionId)) {
      processedQuestions.set(questionId, attempt);
      uniqueAttempts.push(attempt);
    }
  }

  console.log(`중복 제거: ${attempts.length}개 → ${uniqueAttempts.length}개 문제`);

  return uniqueAttempts;
}

/**
 * 홈 화면 대시보드 렌더링 (간소화 버전)
 * @param {Object} user - 현재 사용자 정보
 */
export async function renderHomeDashboard(user) {
  // console.log('홈 대시보드 초기화 시작');

  if (!user) {
    // console.log('로그인 필요');
    return;
  }

  // 데이터 로드 (기존 loadAnalyticsData 활용하되 에러 처리 강화)
  try {
    // 로딩 상태 표시 (간소화)
    const statsContainer = document.getElementById('overview-stats');
    if (statsContainer) statsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;">데이터를 불러오는 중...</div>';

    // 데이터 로드
    // 🎯 현재 선택된 자격증 가져오기
    const currentCertType = getCurrentCertificateType();

    // 문제 풀이 기록 가져오기 (최근 1000개)
    state.attempts = await getUserAttempts(1000, currentCertType);

    // 모의고사 결과 가져오기 (최근 10개만 - 홈 화면용)
    state.mockExamResults = await getUserMockExamResults(10, currentCertType);

    // 렌더링 실행
    renderHomeStats();
    renderHomeReviewRecommendations();
    renderSimpleActivityChart();

  } catch (error) {
    console.error('홈 대시보드 로드 오류:', error);
    const statsContainer = document.getElementById('overview-stats');
    if (statsContainer) statsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #fa5252;">데이터 로드 중 오류가 발생했습니다.</div>';
  }
}

/**
 * 홈 화면용 요약 통계 렌더링 (Premium & Minimal)
 */
function renderHomeStats() {
  const container = document.getElementById('overview-stats');
  if (!container) return;

  // 데이터 체크
  if (!state.attempts || state.attempts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #f8f9fa; border-radius: 12px; color: #868e96;">
        아직 푼 문제가 없어요.<br>
        <a href="#" onclick="document.querySelector('[data-tab=\\'quiz-tab\\']').click(); return false;" style="color: var(--penguin-navy); font-weight: 600; text-decoration: underline;">문제 풀러 가기</a>
      </div>
    `;
    return;
  }

  // 중복 제거 및 통계 계산
  const uniqueAttempts = removeDuplicateAttempts(state.attempts);
  const totalAttempts = uniqueAttempts.length;
  const totalRecords = state.attempts.length; // 전체 기록 수 (중복 포함)
  const totalCorrect = uniqueAttempts.filter(a => a.isCorrect).length;
  const correctRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  // 예상 점수 계산 (간소화)
  // 최근 50 문제 기준 정답률 * 100점 만점 환산 (단순 계산)
  const recentAttempts = uniqueAttempts.slice(0, 50);
  const recentCorrect = recentAttempts.filter(a => a.isCorrect).length;
  const recentRate = recentAttempts.length > 0 ? Math.round((recentCorrect / recentAttempts.length) * 100) : 0;
  const estimatedScore = Math.round(recentRate); // 100점 만점 기준

  container.innerHTML = `
    <!-- 1. 총 문제 수 -->
    <div class="stats-card stat-item">
      <div class="stats-value">${totalAttempts}</div>
      <div class="stats-label">푼 문제 (고유)</div>
      ${totalRecords > totalAttempts ? `<div style="font-size: 0.75rem; color: #868e96; margin-top: 4px;">전체 기록: ${totalRecords}개</div>` : ''}
    </div>
    
    <!-- 2. 정답률 -->
    <div class="stats-card stat-item">
      <div class="stats-value" style="color: ${getScoreColor(correctRate)}">${correctRate}%</div>
      <div class="stats-label">정답률</div>
    </div>
    
    <!-- 3. 예상 점수 -->
    <div class="stats-card stat-item">
      <div class="stats-value">${estimatedScore}점</div>
      <div class="stats-label">예상 점수</div>
    </div>
    
    <!-- 4. 합격 가능성 -->
    <div class="stats-card stat-item">
      <div class="stats-value" style="font-size: 1.2rem; line-height: 1.5; color: ${estimatedScore >= 60 ? '#12b886' : '#fa5252'}">
        ${estimatedScore >= 60 ? '안정권' : '노력필요'}
      </div>
      <div class="stats-label">합격 예측</div>
    </div>
  `;
}

/**
 * 홈 화면용 심플 차트 (Bar/Line Mix X -> Sparkline or Simple Bar)
 */
function renderSimpleActivityChart() {
  const container = document.getElementById('recent-activity-chart');
  if (!container) return;

  // 캔버스 초기화
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  if (!state.attempts || state.attempts.length === 0) return;

  // 최근 7일 데이터만 (clean look)
  const today = new Date();
  const labels = [];
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(i === 0 ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`);

    // 해당 날짜의 문제 풀이 수 계산
    const dayStr = d.toISOString().split('T')[0];
    const count = state.attempts.filter(a => {
      const aDate = new Date(a.timestamp?.toDate ? a.timestamp.toDate() : a.timestamp);
      return aDate.toISOString().split('T')[0] === dayStr;
    }).length;

    data.push(count);
  }

  // Chart.js가 로드되었는지 확인 (재시도 로직 포함)
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js가 아직 로드되지 않았습니다. 잠시 후 다시 시도합니다...');
    // Chart.js 로드를 기다림 (최대 3초)
    let retryCount = 0;
    const maxRetries = 30; // 3초 (100ms * 30)
    const checkChart = setInterval(() => {
      retryCount++;
      if (typeof Chart !== 'undefined') {
        clearInterval(checkChart);
        // Chart.js가 로드되면 다시 렌더링 시도
        renderSimpleActivityChart();
      } else if (retryCount >= maxRetries) {
        clearInterval(checkChart);
        console.warn('Chart.js 로드 시간 초과. 차트를 표시할 수 없습니다.');
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #868e96;">차트를 표시할 수 없습니다.</div>';
      }
    }, 100);
    return;
  }

  // Chart.js 인스턴스
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '푼 문제',
        data: data,
        backgroundColor: '#4285F4',
        borderRadius: 4,
        barThickness: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: true, drawBorder: false },
          ticks: { precision: 0 }
        },
        x: {
          grid: { display: false, drawBorder: false }
        }
      }
    }
  });
}

/**
 * 홈 화면용 복습 추천 (오답 노트) 렌더링
 */
function renderHomeReviewRecommendations() {
  const container = document.getElementById('review-recommendations-section');
  if (!container) return;

  if (!state.attempts || state.attempts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-text">아직 틀린 문제가 없습니다.</div></div>';
    return;
  }

  // 최신순으로 정렬된 오답 추출 (중복 제거 후)
  // 로직: 최근에 틀린 문제 상위 4개만 노출
  const uniqueAttempts = removeDuplicateAttempts(state.attempts);
  const wrongAttempts = uniqueAttempts
    .filter(a => !a.isCorrect) // 틀린 문제
    .slice(0, 4); // 최대 4개

  if (wrongAttempts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-text">🎉 모든 문제를 맞췄습니다! 완벽해요.</div></div>';
    return;
  }

  // 카드 리스트 생성
  let html = '';
  wrongAttempts.forEach(attempt => {
    const subject = attempt.questionData?.subject || attempt.subject || '과목 미상';
    const year = attempt.questionData?.year || attempt.year || '2024';
    const number = attempt.questionData?.number || attempt.number || '?';

    // 링크 생성 (문제 페이지로 이동)
    // index.html#quiz-tab을 통해 퀴즈 탭으로 이동하고, 특정 문제를 로드하도록 해야 함.
    // 여기서는 단순화를 위해 URL 해시 변경 방식 사용 (기존 구조 호환)
    const link = `javascript:window.location.href='exam/${year}_${subject}.html#question-${number}'`;

    html += `
      <a href="./exam/quiz.html?year=${year}&subject=${encodeURIComponent(subject)}&number=${number}" class="question-card priority-high">
        <div class="q-header">
          <span>${year}년 기출</span>
          <span class="q-badge badge-wrong">오답</span>
        </div>
        <div class="q-title">${subject} ${number}번</div>
        <div style="font-size: 0.8rem; color: #868e96;">탭하여 다시 풀기 →</div>
      </a>
    `;
  });

  if (html === '') {
    html = '<div class="empty-state"><div class="empty-text">표시할 추천 문제가 없습니다.</div></div>';
  }

  container.innerHTML = html;
}

/**
 * 최근 활동 차트 렌더링
 */
function renderRecentActivityChart() {
  const chartContainer = document.getElementById('recent-activity-chart');
  if (!chartContainer) return;

  // 기존 차트 정리
  if (state.chartInstances.recentActivity) {
    state.chartInstances.recentActivity.destroy();
  }

  // 데이터가 없는 경우
  if (!state.attempts || state.attempts.length === 0) {
    chartContainer.innerHTML = `
      <div class="no-data-message">
        <p>아직 학습 데이터가 없습니다. 문제를 풀어보면 그래프가 표시됩니다.</p>
      </div>
    `;
    return;
  }

  // 최근 30일 데이터 준비
  const today = new Date();
  const dates = [];
  const attemptsData = [];
  const correctData = [];

  // 지난 30일 날짜 배열 생성
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);

    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const displayDate = `${date.getMonth() + 1}/${date.getDate()}`; // MM/DD

    dates.push(displayDate);
    attemptsData.push(0);
    correctData.push(0);
  }

  // 시도 데이터 집계
  state.attempts.forEach(attempt => {
    const attemptDate = new Date(attempt.timestamp);
    const dayDiff = Math.floor((today - attemptDate) / (1000 * 60 * 60 * 24));

    if (dayDiff >= 0 && dayDiff < 30) {
      attemptsData[29 - dayDiff]++;

      if (attempt.isCorrect) {
        correctData[29 - dayDiff]++;
      }
    }
  });

  // Chart.js가 로드되었는지 확인
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js가 로드되지 않았습니다. 차트를 렌더링할 수 없습니다.');
    chartContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #868e96;">차트를 표시할 수 없습니다.</div>';
    return;
  }

  // 차트 생성
  const ctx = document.createElement('canvas');
  chartContainer.innerHTML = '';
  chartContainer.appendChild(ctx);

  state.chartInstances.recentActivity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: '총 문제 풀이',
          data: attemptsData,
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: '정답',
          data: correctData,
          borderColor: '#0F9D58',
          backgroundColor: 'rgba(15, 157, 88, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '최근 30일 학습 활동'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

/**
 * 과목별 학습 현황 렌더링
 */
/**
 * 과목별 학습 현황 렌더링 (Premium Glass Grid Redesign)
 */
function renderSubjectProgress() {
  const container = document.getElementById('subject-progress');
  if (!container) return;

  // 데이터가 없는 경우
  if (!state.attempts || state.attempts.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <p>아직 학습 데이터가 없습니다. 문제를 풀어보면 과목별 현황이 표시됩니다.</p>
      </div>
    `;
    return;
  }

  // 과목별 통계 계산
  const subjectStats = {};
  const allSubjects = [
    '운동생리학', '건강체력평가', '운동처방론', '운동부하검사',
    '운동상해', '기능해부학', '병태생리학', '스포츠심리학'
  ];

  // 이모지 매핑
  const subjectEmojis = {
    '운동생리학': '🧬', '건강체력평가': '💪', '운동처방론': '📝', '운동부하검사': '🏃',
    '운동상해': '🩹', '기능해부학': '💀', '병태생리학': '🦠', '스포츠심리학': '🧠'
  };

  // 통계 초기화
  allSubjects.forEach(subject => {
    subjectStats[subject] = {
      attempts: 0,
      correct: 0,
      percentage: 0
    };
  });

  // 시도 데이터 집계
  state.attempts.forEach(attempt => {
    const subject = attempt.questionData?.subject;
    if (subject && subjectStats[subject]) {
      subjectStats[subject].attempts++;

      if (attempt.isCorrect) {
        subjectStats[subject].correct++;
      }
    }
  });

  // 백분율 계산
  Object.keys(subjectStats).forEach(subject => {
    const { attempts, correct } = subjectStats[subject];
    subjectStats[subject].percentage = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  });

  // HTML 생성 - Glass Grid
  let html = `<div class="subject-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">`;

  allSubjects.forEach(subject => {
    const { attempts, correct, percentage } = subjectStats[subject];
    const color = subjectColors[subject] || '#4285F4';
    const emoji = subjectEmojis[subject] || '📚';

    // 취약도 판단
    let weaknessBadge = '';
    if (attempts >= 10) {
      if (percentage < 40) weaknessBadge = `<span style="background:var(--danger-bg); color:var(--danger-color); font-size:0.75rem; padding:2px 8px; border-radius:99px; font-weight:700;">취약</span>`;
      else if (percentage >= 80) weaknessBadge = `<span style="background:var(--success-bg); color:var(--success-color); font-size:0.75rem; padding:2px 8px; border-radius:99px; font-weight:700;">우수</span>`;
    }

    html += `
      <div class="glass-card subject-card-premium" style="padding: 20px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem; background: rgba(0,0,0,0.03); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 10px;">${emoji}</span>
            <div>
                <div class="subject-name" style="font-size: 1rem; font-weight: 700;">${subject}</div>
                <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 2px;">${attempts}문제 풀이</div>
            </div>
          </div>
          ${weaknessBadge}
        </div>
        
        <div class="progress-section">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; font-weight: 600;">
            <span style="color: var(--text-secondary);">정답률</span>
            <span style="color: ${color};">${percentage}%</span>
          </div>
          <div class="progress-bar-bg" style="height: 10px; background: rgba(0,0,0,0.05); border-radius: 99px; overflow: hidden;">
            <div class="progress-bar-fill" style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, ${color}, ${adjustColorBrightness(color, 20)}); border-radius: 99px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);"></div>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// 색상 밝기 조절 헬퍼 함수
function adjustColorBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * 문제풀이기록 탭 렌더링
 */
function renderQuestionSetsTab() {
  console.log('문제풀이기록 탭 렌더링...');

  // 필터 이벤트 리스너 등록 (중복 방지)
  const applyFilterButton = document.getElementById('apply-set-filters');
  if (applyFilterButton && applyFilterButton.dataset.listenerAttached !== 'true') {
    applyFilterButton.addEventListener('click', function () {
      const typeFilter = document.getElementById('set-type-filter').value;
      const subjectFilter = document.getElementById('set-subject-filter').value;
      const yearFilter = document.getElementById('set-year-filter').value;

      // 필터 변경 이벤트 발생
      document.dispatchEvent(new CustomEvent('setFiltersChanged', {
        detail: { type: typeFilter, subject: subjectFilter, year: yearFilter }
      }));
    });
    applyFilterButton.dataset.listenerAttached = 'true';
  }

  // 모든 문제풀이기록 삭제 버튼 이벤트 리스너 등록 (중복 방지)
  const deleteAllButton = document.getElementById('delete-all-question-sets');
  if (deleteAllButton && deleteAllButton.dataset.listenerAttached !== 'true') {
    deleteAllButton.addEventListener('click', async function () {
      const success = await deleteAllQuestionSets();
      if (success) {
        // 데이터 새로고침
        if (window.loadAnalyticsData && window.auth?.currentUser) {
          await window.loadAnalyticsData(window.auth.currentUser);
        }
      }
    });
    deleteAllButton.dataset.listenerAttached = 'true';
  }

  // 모든 필터에 대해 초기 렌더링
  renderFilteredQuestionSets('all', 'all', 'all');
}

/**
 * 세션 기반 문제풀이기록 렌더링 함수 (Firebase 인덱스 오류 해결)
 */
async function renderFilteredQuestionSets(typeFilter, subjectFilter, yearFilter) {
  const container = document.getElementById('question-sets-container');
  if (!container) {
    console.error('컨테이너를 찾을 수 없습니다.');
    return;
  }

  try {
    const devMode = typeof isDevMode === 'function' && isDevMode();
    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      if (!devMode) {
        container.innerHTML = '<div class="no-data">로그인이 필요합니다.</div>';
        return;
      }
      // 🔧 개발 모드: 목업 데이터로 카드 렌더링
      const now = new Date();
      const mockSessions = [
        {
          id: 'dev-regular-1',
          title: '2025년 운동생리학 세트',
          type: 'regular',
          score: 78,
          total: 20,
          completed: 18,
          displayDate: now.toLocaleString(),
          subjectResults: {},
          attempts: Array.from({ length: 18 }).map((_, i) => ({
            isCorrect: i % 3 !== 0,
            questionData: { subject: '운동생리학', number: i + 1 }
          })),
          subject: '운동생리학',
          year: '2025',
          hour: null,
          startTime: new Date(now.getTime() - 1000 * 60 * 60 * 2),
          isActive: true,
          canResume: true,
          lastQuestionNumber: 18
        },
        {
          id: 'dev-mock-1',
          title: '2025년 모의고사 1교시',
          type: 'mockexam',
          score: 62,
          total: 80,
          completed: 50,
          displayDate: now.toLocaleString(),
          subjectResults: {
            '운동생리학': 65,
            '건강체력평가': 55,
            '운동처방론': 70,
            '운동부하검사': 58
          },
          attempts: Array.from({ length: 50 }).map((_, i) => ({
            isCorrect: i % 2 === 0,
            questionData: { subject: ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'][i % 4], number: i + 1 }
          })),
          subject: '모의고사',
          year: '2025',
          hour: '1',
          startTime: new Date(now.getTime() - 1000 * 60 * 60 * 5),
          isActive: true,
          canResume: true,
          lastQuestionNumber: 50
        },
        {
          id: 'dev-regular-2',
          title: '2024년 스포츠심리학',
          type: 'regular',
          score: 92,
          total: 20,
          completed: 20,
          displayDate: now.toLocaleString(),
          subjectResults: {},
          attempts: Array.from({ length: 20 }).map((_, i) => ({
            isCorrect: true,
            questionData: { subject: '스포츠심리학', number: i + 1 }
          })),
          subject: '스포츠심리학',
          year: '2024',
          hour: null,
          startTime: new Date(now.getTime() - 1000 * 60 * 60 * 24),
          isActive: false,
          canResume: false,
          lastQuestionNumber: 20
        }
      ].filter(card => {
        const typeMatches = typeFilter === 'all' || typeFilter === card.type;
        const subjectMatches = subjectFilter === 'all' || card.subject === subjectFilter;
        const yearMatches = yearFilter === 'all' || card.year === yearFilter;
        return typeMatches && subjectMatches && yearMatches;
      }).sort((a, b) => b.startTime - a.startTime);

      container.innerHTML = '';
      container.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
        gap: 12px !important;
        width: 100% !important;
        align-items: start !important;
      `;
      mockSessions.forEach(card => container.appendChild(createCardElement(card)));
      window.sessionCards = mockSessions;
      attachCardEventListeners(container, typeFilter, subjectFilter, yearFilter);
      return;
    }

    console.log("Current user ID:", user.uid);
    showLoading('세션 데이터 로드 중...');

    // === 수정된 부분: 최신 세션이 표시되도록 정렬 추가 ===
    const sessionsRef = collection(db, "sessions");
    let sessionsQuery;

    try {
      // startTime 기준 최신순으로 정렬
      sessionsQuery = query(
        sessionsRef,
        where("userId", "==", user.uid),
        orderBy("startTime", "desc"),
        limit(50) // 최근 50개 세션 로드
      );
    } catch (error) {
      console.warn("orderBy 쿼리 실패, 기본 쿼리로 시도:", error);
      // orderBy 없이 시도 (인덱스가 없는 경우)
      sessionsQuery = query(
        sessionsRef,
        where("userId", "==", user.uid),
        limit(50)
      );
    }

    const sessionsSnapshot = await getDocs(sessionsQuery);
    console.log(`${sessionsSnapshot.size}개의 세션을 찾았습니다.`);

    if (sessionsSnapshot.empty) {
      handleEmptySessionsCase(container, typeFilter, subjectFilter, yearFilter);
      return;
    }

    // 세션 ID 목록 생성
    const sessionDocs = sessionsSnapshot.docs;

    // 세션이 시작 시간 필드를 가지고 있다면 클라이언트 측에서 정렬
    const sortedSessionDocs = [...sessionDocs].sort((a, b) => {
      const aTime = a.data().startTime;
      const bTime = b.data().startTime;

      if (!aTime || !bTime) return 0;

      // Firestore 타임스탬프 처리
      const aDate = aTime.toDate ? aTime.toDate() : new Date(aTime);
      const bDate = bTime.toDate ? bTime.toDate() : new Date(bTime);

      // 내림차순 정렬 (최신순)
      return bDate - aDate;
    });

    // 최대 20개로 제한
    const limitedSessionDocs = sortedSessionDocs.slice(0, 20);
    const sessionIds = limitedSessionDocs.map(doc => doc.id);
    console.log("세션 ID 목록:", sessionIds);

    // === 수정된 부분: 배치 처리 단순화 ===
    // 시도 기록 조회를 위한 준비
    const attemptsBySession = {};

    // 세션 ID가 없으면 빈 결과 반환
    if (sessionIds.length === 0) {
      renderEmptyStateMessage(container, typeFilter, subjectFilter, yearFilter);
      hideLoading();
      return;
    }

    // Firebase 'in' 쿼리 제한(최대 10개)때문에 여러 번 나누어 쿼리
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < sessionIds.length; i += batchSize) {
      const batchSessionIds = sessionIds.slice(i, i + batchSize);
      batches.push(batchSessionIds);
    }

    // 각 배치에 대해 쿼리 실행
    for (const batchIds of batches) {
      try {
        const attemptsRef = collection(db, "attempts");
        const attemptsQuery = query(
          attemptsRef,
          where("userId", "==", user.uid),
          where("sessionId", "in", batchIds)
        );

        const attemptsSnapshot = await getDocs(attemptsQuery);
        console.log(`배치 쿼리: ${attemptsSnapshot.size}개의 시도 기록을 찾았습니다.`);

        // 결과를 세션별로 분류
        attemptsSnapshot.forEach(doc => {
          const attemptData = doc.data();
          const sessionId = attemptData.sessionId;

          if (sessionId) {
            // console.log(`시도 기록 발견: ID=${doc.id}, 세션=${sessionId}, 정답여부=${attemptData.isCorrect}`);

            if (!attemptsBySession[sessionId]) {
              attemptsBySession[sessionId] = [];
            }
            attemptsBySession[sessionId].push({
              id: doc.id,
              ...attemptData
            });
          }
        });
      } catch (error) {
        console.warn(`배치 쿼리 오류 (무시됨): ${error.message}`);
        // 오류가 있더라도 계속 진행
      }
    }

    // 전역 객체에 저장
    window.attemptsBySession = attemptsBySession;

    // 세션 카드 데이터 생성
    const sessionCards = [];

    for (const sessionDoc of limitedSessionDocs) {
      try {
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        console.log(`세션 정보 처리 중: ${sessionId}`, sessionData);

        // 날짜 형식 지정
        let displayDate = "날짜 정보 없음";
        let startTime = new Date();

        try {
          // 세션 시작 시간 처리
          if (sessionData.startTime) {
            if (typeof sessionData.startTime.toDate === 'function') {
              startTime = sessionData.startTime.toDate();
            } else {
              startTime = new Date(sessionData.startTime);
            }

            // 유효한 날짜인지 확인
            if (!isNaN(startTime.getTime())) {
              displayDate = startTime.toLocaleString();
            }
          } else {
            // 세션 ID에서 날짜 추출 시도
            const idParts = sessionId.split('_');
            if (idParts.length >= 2) {
              const dateStr = idParts[0];
              const timeStr = idParts[1];

              if (dateStr.length === 8 && timeStr.length >= 6) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);

                const hour = timeStr.substring(0, 2);
                const minute = timeStr.substring(2, 4);

                displayDate = `${year}-${month}-${day} ${hour}:${minute}`;
                startTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
              }
            }
          }
        } catch (dateError) {
          console.warn(`세션 ${sessionId}의 날짜 처리 오류:`, dateError);
        }

        // 세션 시도 기록 처리
        const sessionAttempts = attemptsBySession[sessionId] || [];
        const rawAttemptCount = sessionAttempts.length;
        
        // ✅ 빈 세션 필터링: 시도 기록이 없는 세션은 모두 제외
        if (rawAttemptCount === 0) {
          console.log(`빈 세션 건너뛰기 (시도 기록 없음): ${sessionId}`, { 
            title: sessionData.title || '제목 없음',
            subject: sessionData.subject,
            year: sessionData.year 
          });
          continue;
        }
        
        // ✅ 모의고사인 경우: 같은 문제를 여러 번 풀었을 수 있으므로 고유 문제만 카운트
        let uniqueQuestionCount = rawAttemptCount;
        let uniqueAttempts = sessionAttempts;
        
        if (sessionData.type === 'mockexam') {
          // 고유 문제 ID로 중복 제거 (globalIndex 우선)
          const uniqueQuestions = new Map();
          sessionAttempts.forEach(attempt => {
            let questionId;
            if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
              questionId = `g_${attempt.questionData.globalIndex}`;
            } else if (attempt.questionNumber !== undefined && attempt.questionNumber !== null) {
              questionId = `q_${attempt.questionNumber}`;
            } else {
              const subject = attempt.subject || attempt.questionData?.subject || '';
              const number = attempt.questionData?.number || attempt.questionNumber || 0;
              questionId = `${subject}_${number}`;
            }
            
            // 같은 문제가 없으면 추가 (있으면 첫 번째만 유지)
            if (questionId && !uniqueQuestions.has(questionId)) {
              uniqueQuestions.set(questionId, attempt);
            }
          });
          
          uniqueAttempts = Array.from(uniqueQuestions.values());
          uniqueQuestionCount = uniqueAttempts.length;
          
          console.log(`세션 ${sessionId} (모의고사): ${rawAttemptCount}개 시도 → ${uniqueQuestionCount}개 고유 문제`);
        }
        
        // ✅ 첫 시도 답변 우선 사용 (통계 정확성을 위해)
        const correctCount = uniqueAttempts.filter(a => {
          return a.firstAttemptIsCorrect !== undefined ? a.firstAttemptIsCorrect === true : a.isCorrect === true;
        }).length;
        
        const attemptCount = uniqueQuestionCount; // 고유 문제 수 사용
        console.log(`세션 ${sessionId}: ${attemptCount}개의 문제 중 ${correctCount}개 정답`);

        // 마지막 풀이 문제 번호 계산 (이어서 풀기용) - 고유 문제 기준
        let lastQuestionNumber = 0;
        if (uniqueAttempts.length > 0) {
          // 문제 번호 추출 (globalIndex 우선, 없으면 number 사용)
          const questionNumbers = uniqueAttempts.map(attempt => {
            if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
              return attempt.questionData.globalIndex + 1; // 0-based → 1-based
            }
            return attempt.questionData?.number || attempt.questionNumber || 0;
          });
          lastQuestionNumber = Math.max(...questionNumbers);
        }

        // 세션 활성 여부 확인 (24시간 이내이고 완료되지 않은 경우)
        const isActive = sessionData.isActive === true;
        
        // ✅ 모의고사는 항상 80문제로 고정 (attemptCount와 관계없이)
        let totalQuestions;
        if (sessionData.type === 'mockexam') {
          totalQuestions = 80; // 모의고사는 항상 80문제
        } else {
          totalQuestions = sessionData.totalQuestions || Math.max(attemptCount, 20);
        }
        
        // ✅ completed는 실제 풀린 문제 수지만, 모의고사인 경우 최대 80으로 제한
        const completed = sessionData.type === 'mockexam' 
          ? Math.min(attemptCount, 80)  // 모의고사는 최대 80문제
          : attemptCount;  // 일반 문제는 실제 시도 횟수
        
        // ✅ 이어서 풀기 조건: 활성 세션이고, 풀이한 문제 수가 전체 문제 수보다 적을 때만
        const canResume = isActive && completed > 0 && completed < totalQuestions;

        // 디버깅 로그 - 이어서 풀기 버튼 표시 조건 확인
        if (!canResume) {
          const reasons = [];
          if (!isActive) reasons.push('세션이 비활성화됨');
          if (completed === 0) reasons.push('아직 문제를 풀지 않음');
          if (completed >= totalQuestions) reasons.push(`모든 문제 완료 (${completed}/${totalQuestions})`);
          console.log(`세션 ${sessionId}: 이어서 풀기 불가 - ${reasons.join(', ')}`);
        } else {
          console.log(`세션 ${sessionId}: 이어서 풀기 가능 (${completed}/${totalQuestions})`);
        }

        // 세션 제목 설정 개선
        let sessionTitle = sessionData.title || '문제풀이기록';

        // 제목이 없는 경우 메타데이터로 제목 생성
        if (!sessionData.title) {
          // 세션 시작 시간 확인
          let formattedDate = '';

          try {
            if (sessionData.startTime) {
              // Firebase 타임스탬프 처리
              const startTime = sessionData.startTime.toDate ?
                sessionData.startTime.toDate() :
                new Date(sessionData.startTime);

              // 날짜 포맷팅
              const year = startTime.getFullYear();
              const month = startTime.getMonth() + 1;
              const day = startTime.getDate();
              const hours = startTime.getHours();
              const mins = startTime.getMinutes();

              formattedDate = ` (${year}.${month}.${day} ${hours}:${mins.toString().padStart(2, '0')})`;
            }
          } catch (e) {
            console.warn('날짜 파싱 오류:', e);
          }

          // 과목 정보가 있는 경우
          if (sessionData.subject && sessionData.year) {
            sessionTitle = `${sessionData.year}년 ${sessionData.subject}${formattedDate}`;
          } else if (sessionData.subject) {
            sessionTitle = `${sessionData.subject}${formattedDate}`;
          } else if (sessionData.type === 'mockexam' && sessionData.year) {
            sessionTitle = `${sessionData.year}년 모의고사${formattedDate}`;
          } else {
            // 세션 ID에서 정보 추출 시도
            try {
              // 세션 ID 형식: YYYYMMDD_HHMMSS_userID
              const parts = sessionId.split('_');
              if (parts.length >= 2) {
                // 날짜 부분 파싱
                const dateStr = parts[0];
                if (dateStr.length === 8) {
                  const year = dateStr.substring(0, 4);
                  const month = dateStr.substring(4, 6);
                  const day = dateStr.substring(6, 8);

                  // 시간 부분 파싱
                  const timeStr = parts[1];
                  if (timeStr.length >= 6) {
                    const hours = timeStr.substring(0, 2);
                    const mins = timeStr.substring(2, 4);

                    // 파일 기반으로 과목 추출 시도
                    let subject = null;

                    // 최근 접근한 과목 페이지가 있는지 확인
                    const recentSubject = localStorage.getItem('lastViewedSubject');
                    if (recentSubject) {
                      subject = recentSubject;
                    } else {
                      // URL에서 과목 정보 추출 시도
                      const currentPath = window.location.pathname;
                      const subjectMatch = currentPath.match(/subject_([^.]+)\.html/);
                      if (subjectMatch && subjectMatch[1]) {
                        try {
                          subject = decodeURIComponent(subjectMatch[1]);
                        } catch (e) {
                          console.warn('과목명 디코딩 오류:', e);
                        }
                      }
                    }

                    // ✅ 과목 정보가 있으면 표시, 없으면 날짜만 표시
                    if (subject) {
                      sessionTitle = `${subject} (${year}.${month}.${day} ${hours}:${mins})`;
                    } else {
                      sessionTitle = `세션 (${year}.${month}.${day} ${hours}:${mins})`;
                    }
                  } else {
                    sessionTitle = `세션 (${year}.${month}.${day})`;
                  }
                } else {
                  sessionTitle = `세션 (${displayDate})`;
                }
              } else {
                sessionTitle = `세션 (${displayDate})`;
              }
            } catch (error) {
              console.warn('세션 ID 파싱 오류:', error);
              sessionTitle = `세션 (${displayDate})`;
            }
          }
        }

        // 정확도 계산
        const accuracy = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;

        // 필터링 적용
        const typeMatches = typeFilter === 'all' || typeFilter === sessionData.type ||
          (typeFilter === 'regular' && !sessionData.type);
        const subjectMatches = subjectFilter === 'all' ||
          sessionData.subject === subjectFilter;
        const yearMatches = yearFilter === 'all' ||
          sessionData.year === yearFilter;

        // 세션 카드 표시 여부 결정 (필터 + 시도 기록 유무)
        const shouldShowCard = (typeMatches && subjectMatches && yearMatches);

        if (shouldShowCard) {
          // 세션 타입 결정 (title에서도 모의고사 감지)
          let sessionType = sessionData.type;
          if (!sessionType || sessionType === 'regular') {
            // title에 "모의고사"가 포함되어 있으면 mockexam으로 변경
            if (sessionTitle && (sessionTitle.includes('모의고사') || sessionData.title?.includes('모의고사'))) {
              sessionType = 'mockexam';
            } else {
              sessionType = 'regular';
            }
          }
          
          // 세션 카드 데이터 생성
          sessionCards.push({
            id: sessionId,
            title: sessionTitle,
            type: sessionType,
            score: accuracy,
            total: totalQuestions,
            completed: completed,  // ✅ 수정된 completed 사용 (모의고사는 최대 80)
            displayDate: displayDate,
            subjectResults: sessionData.subjectResults || {},
            attempts: uniqueAttempts,  // ✅ 고유 문제만 저장
            subject: sessionData.subject || '',
            year: sessionData.year || '',
            hour: sessionData.hour || sessionData.mockExamPart || null, // 모의고사 교시
            startTime: startTime, // 정렬용 시간 추가
            isActive: isActive, // 활성 세션 여부
            canResume: canResume, // 이어서 풀기 가능 여부
            lastQuestionNumber: lastQuestionNumber // 마지막 풀이 문제 번호
          });
        }
      } catch (docError) {
        console.error('세션 문서 처리 오류:', docError);
        continue;
      }
    }

    // 세션 카드가 없는 경우
    if (sessionCards.length === 0) {
      renderEmptyStateMessage(container, typeFilter, subjectFilter, yearFilter);
      hideLoading();
      return;
    }

    // 세션 정렬 (최신순)
    sessionCards.sort((a, b) => b.startTime - a.startTime);

    // 컨테이너 초기화
    // 컨테이너 초기화
    container.innerHTML = '';

    // 리스트 스타일 적용 (Pro Style - 세로 리스트)
    container.className = 'session-list-container question-sets-container';
    container.style.cssText = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    // 세션 카드 생성 (새로운 Pro 스타일 리스트 아이템)
    sessionCards.forEach(card => {
      const cardElement = createProSessionCard(card);
      container.appendChild(cardElement);
    });

    // 전역 변수에 세션 카드 데이터 저장
    window.sessionCards = sessionCards;
    console.log(`${sessionCards.length}개 세션 카드 생성 완료`);

    // 버튼 이벤트 리스너 등록 (Pro 카드 내부 처리 - 충돌 방지)
    // attachCardEventListeners(container, typeFilter, subjectFilter, yearFilter);

  } catch (error) {
    console.error('문제풀이기록 데이터 로드 오류:', error);
    handleLoadError(container, error);
  } finally {
    hideLoading();
  }
}

/**
 * 세션에 대한 시도 기록을 직접 로드하는 함수 (개선된 버전)
 */
async function loadAttemptsForSession(sessionId) {
  if (!sessionId) {
    console.warn('유효한 세션 ID가 제공되지 않았습니다.');
    return [];
  }

  // 🔧 개발자 모드 확인
  const devMode = typeof isDevMode === 'function' && isDevMode();
  
  if (devMode) {
    // 개발자 모드: 가상 세션 데이터에서 attempts 반환
    const sessionCard = window.sessionCards?.find(card => card.id === sessionId);
    if (sessionCard && sessionCard.attempts) {
      console.log(`[개발자 모드] 세션 ${sessionId}의 가상 attempts ${sessionCard.attempts.length}개 반환`);
      return sessionCard.attempts.map((attempt, index) => {
        const userAnswerIndex = attempt.userAnswer !== undefined ? Number(attempt.userAnswer) : Math.floor(Math.random() * 4);
        const isCorrect = attempt.isCorrect !== undefined ? attempt.isCorrect : Math.random() > 0.3;

        let correctAnswerIndex = null;
        if (attempt.correctAnswer !== undefined && attempt.correctAnswer !== null && !isNaN(attempt.correctAnswer)) {
          correctAnswerIndex = Number(attempt.correctAnswer);
        } else if (attempt.questionData?.correctAnswer !== undefined && attempt.questionData?.correctAnswer !== null && !isNaN(attempt.questionData.correctAnswer)) {
          correctAnswerIndex = Number(attempt.questionData.correctAnswer);
        } else if (attempt.questionData?.correctOption !== undefined && attempt.questionData?.correctOption !== null && !isNaN(attempt.questionData.correctOption)) {
          correctAnswerIndex = Number(attempt.questionData.correctOption);
        } else if (attempt.questionData?.correct !== undefined && attempt.questionData?.correct !== null && !isNaN(attempt.questionData.correct)) {
          correctAnswerIndex = Number(attempt.questionData.correct);
        }

        // mock 데이터라도 정답 필드가 비어 보이지 않도록 보정
        if (correctAnswerIndex === null || isNaN(correctAnswerIndex)) {
          correctAnswerIndex = isCorrect
            ? userAnswerIndex
            : (userAnswerIndex + 1) % 4;
        }

        return {
          ...attempt,
          id: `mock-attempt-${sessionId}-${index}`,
          userId: 'dev-user-123',
          sessionId: sessionId,
          timestamp: sessionCard.startTime || new Date(),
          questionData: {
            ...(attempt.questionData || {}),
            year: attempt.questionData?.year || sessionCard.year,
            subject: attempt.questionData?.subject || sessionCard.subject,
            number: attempt.questionData?.number || index + 1,
            correctAnswer: attempt.questionData?.correctAnswer ?? correctAnswerIndex
          },
          userAnswer: userAnswerIndex,
          correctAnswer: attempt.correctAnswer ?? correctAnswerIndex,
          isCorrect,
          certificateType: getCurrentCertificateType(),
          questionNumber: attempt.questionData?.number || index + 1
        };
      });
    }
    // 세션 카드가 없으면 빈 배열 반환
    console.warn(`[개발자 모드] 세션 ${sessionId}의 카드를 찾을 수 없습니다.`);
    return [];
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('사용자가 로그인되어 있지 않습니다.');
      return [];
    }

    console.log(`세션 ID ${sessionId}에 대한 시도 기록을 직접 로드합니다...`);

    // 캐시된 데이터 확인
    if (window.attemptsBySession && window.attemptsBySession[sessionId]) {
      const cachedAttempts = window.attemptsBySession[sessionId];
      console.log(`세션 ID ${sessionId}에 대한 시도 기록 ${cachedAttempts.length}개를 캐시에서 로드했습니다.`);
      return cachedAttempts;
    }

    // Firebase에서 직접 쿼리
    const attemptsRef = collection(db, "attempts");
    const attemptsQuery = query(
      attemptsRef,
      where("userId", "==", user.uid),
      where("sessionId", "==", sessionId),
      orderBy("timestamp", "asc"),
      limit(100) // 최대 100개 로드
    );

    const attemptsSnapshot = await getDocs(attemptsQuery);

    if (attemptsSnapshot.empty) {
      console.log(`세션 ID ${sessionId}에 대한 시도 기록이 없습니다.`);

      // 빈 배열을 캐시에 저장
      if (window.attemptsBySession) {
        window.attemptsBySession[sessionId] = [];
      }

      return [];
    }

    const attempts = [];
    attemptsSnapshot.forEach(doc => {
      attempts.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`${attempts.length}개의 시도 기록을 찾았습니다.`);

    // 결과를 캐시에 저장
    if (window.attemptsBySession) {
      window.attemptsBySession[sessionId] = attempts;
    }

    return attempts;
  } catch (error) {
    console.error('시도 기록 로드 오류:', error);
    return [];
  }
}

/**
 * 모든 문제풀이기록 삭제 함수
 */
async function deleteAllQuestionSets() {
  try {
    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      showToast('로그인이 필요합니다.');
      return false;
    }

    // 확인 메시지
    const confirmed = confirm(
      '⚠️ 모든 문제풀이기록을 삭제하시겠습니까?\n\n' +
      '이 작업은 되돌릴 수 없으며, 다음 항목들이 삭제됩니다:\n' +
      '• 모든 세션 기록\n' +
      '• 모든 문제 시도 기록\n' +
      '• 모든 모의고사 결과\n\n' +
      '정말로 계속하시겠습니까?'
    );

    if (!confirmed) {
      return false;
    }

    // 최종 확인
    const finalConfirm = confirm(
      '최종 확인: 모든 문제풀이기록이 완전히 삭제됩니다.\n\n' +
      '이 작업은 취소할 수 없습니다. 계속하시겠습니까?'
    );

    if (!finalConfirm) {
      return false;
    }

    showLoading('모든 문제풀이기록 삭제 중...');

    let totalDeleted = 0;
    const BATCH_SIZE = 500; // Firebase 배치 최대 크기

    // 1. 모든 세션의 시도 기록 삭제 (배치 처리로 여러 번 나누어 삭제)
    const attemptsRef = collection(db, "attempts");
    const attemptsQuery = query(
      attemptsRef,
      where("userId", "==", user.uid)
    );

    const attemptsDeleted = await deleteQueryBatch(db, attemptsQuery, BATCH_SIZE, (deleted) => {
      console.log(`시도 기록 ${deleted}개 삭제 중...`);
    });
    totalDeleted += attemptsDeleted;
    console.log(`총 ${attemptsDeleted}개 시도 기록 삭제 완료`);

    // 2. 모든 모의고사 결과 삭제 (배치 처리로 여러 번 나누어 삭제)
    const mockResultsRef = collection(db, "mockExamResults");
    const mockResultsQuery = query(
      mockResultsRef,
      where("userId", "==", user.uid)
    );

    const mockResultsDeleted = await deleteQueryBatch(db, mockResultsQuery, BATCH_SIZE, (deleted) => {
      console.log(`모의고사 결과 ${deleted}개 삭제 중...`);
    });
    totalDeleted += mockResultsDeleted;
    console.log(`총 ${mockResultsDeleted}개 모의고사 결과 삭제 완료`);

    // 3. 모든 세션 문서 삭제 (배치 처리로 여러 번 나누어 삭제)
    const sessionsRef = collection(db, "sessions");
    const sessionsQuery = query(
      sessionsRef,
      where("userId", "==", user.uid)
    );

    const sessionsDeleted = await deleteQueryBatch(db, sessionsQuery, BATCH_SIZE, (deleted) => {
      console.log(`세션 문서 ${deleted}개 삭제 중...`);
    });
    totalDeleted += sessionsDeleted;
    console.log(`총 ${sessionsDeleted}개 세션 문서 삭제 완료`);

    // 삭제 확인: 세션이 정말 모두 삭제되었는지 확인
    const verifyQuery = query(
      collection(db, "sessions"),
      where("userId", "==", user.uid),
      limit(1)
    );
    const verifySnapshot = await getDocs(verifyQuery);
    if (!verifySnapshot.empty) {
      console.warn('⚠️ 일부 세션 문서가 아직 남아있습니다. 추가 삭제 시도...');
      // 남은 세션 다시 삭제 시도
      const remainingDeleted = await deleteQueryBatch(db, 
        query(collection(db, "sessions"), where("userId", "==", user.uid)), 
        BATCH_SIZE
      );
      if (remainingDeleted > 0) {
        totalDeleted += remainingDeleted;
        console.log(`추가로 ${remainingDeleted}개 세션 문서 삭제 완료`);
      }
    }

    // 성공 메시지 표시
    hideLoading();
    showToast(`모든 문제풀이기록이 삭제되었습니다. (총 ${totalDeleted}개 항목)`, 'success');

    // 컨테이너 강제 초기화 및 빈 상태 표시
    const container = document.getElementById('question-sets-container');
    if (container) {
      container.innerHTML = '';
      // 삭제 후 빈 상태 메시지 즉시 표시
      renderEmptyStateMessage(container, 'all', 'all', 'all');
    }

    // 문제풀이기록 탭 다시 렌더링 (세션 확인을 위해)
    if (typeof renderFilteredQuestionSets === 'function') {
      // 약간의 지연 후 렌더링 (Firestore 동기화 시간 확보)
      setTimeout(async () => {
        await renderFilteredQuestionSets('all', 'all', 'all');
      }, 500);
    }

    return true;
  } catch (error) {
    console.error('모든 문제풀이기록 삭제 오류:', error);
    hideLoading();
    showToast(`삭제 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
}

/**
 * 세션 삭제 함수
 */
async function deleteSession(sessionId, typeFilter = 'all', subjectFilter = 'all', yearFilter = 'all') {
  try {
    showLoading('세션 기록 삭제 중...');

    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      showToast('로그인이 필요합니다.');
      hideLoading();
      return false;
    }

    console.log(`삭제 요청: sessionId=${sessionId}`);

    // 1. 세션에 속한 시도 기록 삭제 (배치 처리로 여러 번 나누어 삭제)
    const attemptsRef = collection(db, "attempts");
    const attemptsQuery = query(
      attemptsRef,
      where("userId", "==", user.uid),
      where("sessionId", "==", sessionId)
    );

    const attemptsDeleted = await deleteQueryBatch(db, attemptsQuery, 500, (deleted) => {
      console.log(`시도 기록 ${deleted}개 삭제 중...`);
    });
    console.log(`총 ${attemptsDeleted}개 시도 기록 삭제 완료`);

    // 2. 모의고사 결과 삭제 (있는 경우) (배치 처리로 여러 번 나누어 삭제)
    const mockResultsRef = collection(db, "mockExamResults");
    const mockResultsQuery = query(
      mockResultsRef,
      where("userId", "==", user.uid),
      where("sessionId", "==", sessionId)
    );

    const mockResultsDeleted = await deleteQueryBatch(db, mockResultsQuery, 500, (deleted) => {
      console.log(`모의고사 결과 ${deleted}개 삭제 중...`);
    });
    console.log(`총 ${mockResultsDeleted}개 모의고사 결과 삭제 완료`);

    // 3. 세션 문서 삭제
    await deleteDoc(doc(db, "sessions", sessionId));
    console.log(`세션 문서 삭제 완료: ${sessionId}`);

    // 성공 메시지 표시
    hideLoading();
    showToast('세션 기록이 삭제되었습니다.', 'success');

    // UI 업데이트: 문제풀이기록 목록 다시 렌더링
    if (typeof renderFilteredQuestionSets === 'function') {
      await renderFilteredQuestionSets(typeFilter, subjectFilter, yearFilter);
    }

    return true;
  } catch (error) {
    console.error('세션 삭제 오류:', error);
    hideLoading();
    showToast(`기록 삭제 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
}

/**
 * 정오표 표시 함수 개선 - 시도 기록 불러오기 및 표시 개선
 */
function showSessionScorecard(sessionIdOrData) {
  try {
    console.log('정오표 표시 함수 호출:', sessionIdOrData);

    // 기존 모달 제거
    const existingModals = document.querySelectorAll('.scorecard-modal');
    existingModals.forEach(modal => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });

    // 세션 ID 추출
    const sessionId = typeof sessionIdOrData === 'string' ?
      sessionIdOrData : (sessionIdOrData?.id || sessionIdOrData?.sessionId);

    if (!sessionId) {
      console.error('유효한 세션 ID를 찾을 수 없습니다:', sessionIdOrData);
      showToast('세션 정보가 올바르지 않습니다.');
      return;
    }

    // 로딩 표시
    showLoading('정오표 로딩 중...');

    // 세션 데이터 준비
    let sessionData = typeof sessionIdOrData === 'object' ? sessionIdOrData : null;

    // 세션 카드에서 데이터 찾기
    if (!sessionData && window.sessionCards) {
      sessionData = window.sessionCards.find(card => card.id === sessionId);
    }

    // 모의고사인지 확인
    const isMockExam = sessionData?.type === 'mockexam' || sessionId.includes('모의고사');

    // 모의고사라면 1교시+2교시 데이터를 모두 로드
    if (isMockExam) {
      console.log('모의고사 정오표: 1교시+2교시 데이터 로드 시작');
      console.log('세션 ID:', sessionId);
      console.log('세션 데이터:', sessionData);

      // 먼저 현재 세션의 attempts를 로드해서 year 정보 얻기
      loadAttemptsForSession(sessionId).then(currentAttempts => {
        if (currentAttempts.length === 0) {
          hideLoading();
          showToast('모의고사 시도 기록이 없습니다.');
          return;
        }

        // 첫 번째 시도에서 year 정보 추출
        const year = currentAttempts[0]?.year ||
          currentAttempts[0]?.questionData?.year ||
          sessionData?.year ||
          '2024';

        console.log('모의고사 년도:', year);
        console.log('현재 세션 문제 수:', currentAttempts.length);

        // 이미 40개 이상이면 그대로 사용
        if (currentAttempts.length >= 40) {
          console.log('이미 충분한 문제가 있음 (40개 이상)');
          hideLoading();

          // 정렬
          currentAttempts.sort((a, b) => {
            const aNum = a.questionNumber || 0;
            const bNum = b.questionNumber || 0;
            return aNum - bNum;
          });

          createScoreModal(sessionData, currentAttempts);
          return;
        }

        // 40개 미만이면 다른 세션도 조회
        console.log('추가 세션 조회 시작...');

        const user = auth.currentUser;
        if (!user) {
          hideLoading();
          showToast('로그인이 필요합니다.');
          return;
        }

        const sessionsRef = collection(db, "sessions");
        const sessionsQuery = query(
          sessionsRef,
          where("userId", "==", user.uid),
          where("year", "==", year),
          where("examType", "==", "모의고사")
        );

        getDocs(sessionsQuery).then(async sessionsSnapshot => {
          const sessionIds = [sessionId]; // 현재 세션 포함

          sessionsSnapshot.forEach(doc => {
            const sid = doc.id;
            if (sid !== sessionId) {
              sessionIds.push(sid);
            }
          });

          console.log(`${year}년 모의고사 세션 ${sessionIds.length}개 발견:`, sessionIds);

          // 모든 세션의 attempts 로드
          const allAttemptsPromises = sessionIds.map(sid => loadAttemptsForSession(sid));
          const allAttemptsArrays = await Promise.all(allAttemptsPromises);

          // 합치기
          const allAttempts = allAttemptsArrays.flat();

          console.log(`총 ${allAttempts.length}개 문제 로드 완료`);

          hideLoading();

          if (allAttempts.length > 0) {
            // 세션 데이터 업데이트
            if (!sessionData) {
              sessionData = {
                id: sessionId,
                title: `${year}년 모의고사`,
                type: 'mockexam',
                year: year,
                attempts: allAttempts,
                timestamp: allAttempts[0]?.timestamp || new Date()
              };
            } else {
              sessionData.title = `${year}년 모의고사`;
            }

            // 시도 기록 정렬 (문제 번호순)
            allAttempts.sort((a, b) => {
              const aNum = a.questionNumber || 0;
              const bNum = b.questionNumber || 0;
              return aNum - bNum;
            });

            // 정오표 모달 생성
            createScoreModal(sessionData, allAttempts);
          } else {
            showToast('모의고사 시도 기록이 없습니다.');
          }
        }).catch(error => {
          hideLoading();
          console.error('모의고사 세션 조회 오류:', error);
          showToast('세션을 불러오는 중 오류가 발생했습니다: ' + error.message);
        });
      }).catch(error => {
        hideLoading();
        console.error('모의고사 시도 기록 로드 오류:', error);
        showToast('시도 기록을 불러오는 중 오류가 발생했습니다: ' + error.message);
      });
    } else {
      // 일반 문제는 기존 로직 사용
      loadAttemptsForSession(sessionId).then(attempts => {
        hideLoading();

        if (attempts && attempts.length > 0) {
          console.log(`세션 ${sessionId}에 대한 시도 기록 ${attempts.length}개를 로드했습니다.`);

          // 기본 세션 데이터 생성
          if (!sessionData) {
            sessionData = {
              id: sessionId,
              title: getSessionTitle(sessionId),
              attempts: attempts,
              timestamp: attempts[0]?.timestamp || new Date()
            };
          }

          // 시도 기록 정렬 (문제 번호순)
          attempts.sort((a, b) => {
            const aNum = a.questionNumber || (a.questionData?.number) || 0;
            const bNum = b.questionNumber || (b.questionData?.number) || 0;

            if (aNum !== bNum) return aNum - bNum;

            // 문제 번호가 같으면 타임스탬프로 정렬
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);

            return aTime - bTime;
          });

          // 정오표 모달 생성
          createScoreModal(sessionData, attempts);
        } else {
          console.log('시도 기록을 찾을 수 없습니다.');
          showToast('이 세션에는 시도 기록이 없습니다.');
        }
      }).catch(error => {
        hideLoading();
        console.error('시도 기록 로드 오류:', error);
        showToast('시도 기록을 불러오는 중 오류가 발생했습니다: ' + error.message);
      });
    }
  } catch (error) {
    hideLoading();
    console.error('정오표 표시 오류:', error);
    showToast('정오표를 표시하는 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 세션 제목 가져오기 함수 (세션 ID에서 정보 추출)
 */
function getSessionTitle(sessionId) {
  try {
    // 세션 카드에서 제목 찾기
    if (window.sessionCards) {
      const card = window.sessionCards.find(card => card.id === sessionId);
      if (card && card.title) {
        return card.title;
      }
    }

    // 세션 ID에서 날짜/시간 추출
    const parts = sessionId.split('_');
    if (parts.length >= 2) {
      try {
        // YYYYMMDD 형식에서 날짜 추출
        const dateStr = parts[0];
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);

        // HHMMSS 형식에서 시간 추출
        const timeStr = parts[1];
        const hour = timeStr.substring(0, 2);
        const minute = timeStr.substring(2, 4);

        return `세션 (${year}-${month}-${day} ${hour}:${minute})`;
      } catch (e) {
        return `세션 (${sessionId})`;
      }
    }

    return `세션 (${sessionId})`;
  } catch (error) {
    console.warn('세션 제목 처리 오류:', error);
    return `세션 (${sessionId})`;
  }
}

/**
 * 정오표 모달 생성 함수 (개선된 버전)
 */
function createScoreModal(sessionData, attempts) {
  // 아무 시도 기록이 없는 경우 처리
  if (!attempts || attempts.length === 0) {
    console.warn('showSessionScorecard: 세트에 시도 기록이 없습니다.');
    showToast('이 세션에는 시도 기록이 없습니다.');
    return;
  }

  // 첫 번째 시도의 데이터 구조 로깅 (디버깅용)
  console.log('시도 기록 데이터 구조 확인:', JSON.stringify(attempts[0], null, 2));

  // 모달 컨테이너 생성 - 모던한 디자인
  const modal = document.createElement('div');
  modal.className = 'scorecard-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // 모달 내용 컨테이너 - 깔끔한 디자인
  const modalContent = document.createElement('div');
  modalContent.className = 'scorecard-modal-content';
  modalContent.style.cssText = `
    background-color: #ffffff;
    border-radius: 24px;
    padding: 0;
    width: 90%;
    max-width: 920px;
    max-height: 90vh;
    overflow: hidden;
    position: relative;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
  `;

  // 헤더 생성 - 테마에 맞는 깔끔한 디자인
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 32px;
    background: linear-gradient(135deg, #1D2F4E 0%, #2a4570 100%);
    color: white;
    border-radius: 24px 24px 0 0;
  `;

  // 과목 및 연도 정보 추출
  let subject = '';
  let year = '';

  if (sessionData.subject) {
    subject = sessionData.subject;
  } else if (attempts.length > 0 && attempts[0].questionData) {
    subject = attempts[0].questionData.subject || '';
  }

  if (sessionData.year) {
    year = sessionData.year;
  } else if (attempts.length > 0 && attempts[0].questionData) {
    year = attempts[0].questionData.year || '';
  }

  // 제목 생성 수정 - 중복 제거
  let fullTitle = '';
  // 세션 제목에 year와 subject가 모두 포함된 경우 그대로 사용
  if (sessionData.title && sessionData.title.includes(year) && sessionData.title.includes(subject)) {
    fullTitle = sessionData.title;
  }
  // 세션 제목이 있지만 year나 subject가 없는 경우 보강
  else if (sessionData.title) {
    if (year && subject) {
      // 세션 제목에 year나 subject가 이미 포함되어 있는지 확인
      if (sessionData.title.includes(year) && !sessionData.title.includes(subject)) {
        fullTitle = `${sessionData.title} - ${subject}`;
      } else if (!sessionData.title.includes(year) && sessionData.title.includes(subject)) {
        fullTitle = `${year} ${sessionData.title}`;
      } else if (!sessionData.title.includes(year) && !sessionData.title.includes(subject)) {
        fullTitle = `${year} ${subject} - ${sessionData.title}`;
      } else {
        fullTitle = sessionData.title;
      }
    } else if (year) {
      fullTitle = sessionData.title.includes(year) ? sessionData.title : `${year} ${sessionData.title}`;
    } else if (subject) {
      fullTitle = sessionData.title.includes(subject) ? sessionData.title : `${subject} - ${sessionData.title}`;
    } else {
      fullTitle = sessionData.title;
    }
  }
  // 세션 제목이 없는 경우 새로 생성
  else {
    if (year && subject) {
      fullTitle = `${year} ${subject}`;
    } else if (year) {
      fullTitle = `${year}년 세션`;
    } else if (subject) {
      fullTitle = `${subject} 세션`;
    } else {
      fullTitle = '정오표';
    }
  }

  // 제목 - 모던한 타이포그래피
  const title = document.createElement('h3');
  title.innerHTML = `${fullTitle}`;
  title.style.cssText = `
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: white;
    letter-spacing: -0.3px;
  `;

  // 닫기 버튼 - 깔끔한 디자인
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.className = 'scorecard-modal-close';
  closeBtn.style.cssText = `
    width: 36px;
    height: 36px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    font-size: 24px;
    font-weight: 300;
    cursor: pointer;
    color: white;
    line-height: 1;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.style.transform = 'rotate(90deg)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.style.transform = 'rotate(0deg)';
  });
  closeBtn.addEventListener('click', () => {
    // 페이드 아웃 애니메이션
    modal.style.opacity = '0';
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  modalContent.appendChild(header);

  // 스크롤 가능한 컨텐츠 영역
  const scrollableContent = document.createElement('div');
  scrollableContent.style.cssText = `
    padding: 32px;
    overflow-y: auto;
    flex: 1;
  `;

  // 세션 요약 정보 - 모던하고 깔끔한 디자인
  const summary = document.createElement('div');
  summary.className = 'scorecard-summary';
  summary.style.cssText = `
    margin-bottom: 32px;
  `;

  // ✅ 정답률 계산 (첫 시도 답변 우선 사용)
  const correctCount = attempts.filter(a => {
    // 첫 시도 답변이 있으면 첫 시도 답변 사용, 없으면 기존 답변 사용 (하위 호환성)
    return a.firstAttemptIsCorrect !== undefined ? a.firstAttemptIsCorrect : a.isCorrect;
  }).length;
  const totalQuestions = attempts.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const wrongCount = totalQuestions - correctCount;

  // 타임스탬프 처리 (서버 타임스탬프 또는 일반 날짜)
  let displayDate = new Date().toLocaleString();

  try {
    if (sessionData.timestamp) {
      if (typeof sessionData.timestamp.toDate === 'function') {
        displayDate = sessionData.timestamp.toDate().toLocaleString();
      } else if (sessionData.timestamp instanceof Date) {
        displayDate = sessionData.timestamp.toLocaleString();
      } else if (typeof sessionData.timestamp === 'string' || typeof sessionData.timestamp === 'number') {
        displayDate = new Date(sessionData.timestamp).toLocaleString();
      }
    } else if (attempts.length > 0 && attempts[0].timestamp) {
      if (typeof attempts[0].timestamp.toDate === 'function') {
        displayDate = attempts[0].timestamp.toDate().toLocaleString();
      } else if (attempts[0].timestamp instanceof Date) {
        displayDate = attempts[0].timestamp.toLocaleString();
      } else if (typeof attempts[0].timestamp === 'string' || typeof attempts[0].timestamp === 'number') {
        displayDate = new Date(attempts[0].timestamp).toLocaleString();
      }
    }
  } catch (e) {
    console.warn('날짜 처리 오류:', e);
  }

  // 요약 정보 내용 - 모던하고 깔끔한 디자인 (채도는 숫자에만)
  summary.innerHTML = `
    <div style="background: #ffffff; border-radius: 16px; padding: 28px; border: 1px solid #e2e8f0;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 24px;">
        <div style="text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 500; letter-spacing: 0.2px;">총 문제</div>
          <div style="font-size: 32px; font-weight: 700; color: #1D2F4E; line-height: 1.2;">${totalQuestions}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 500; letter-spacing: 0.2px;">정답</div>
          <div style="font-size: 32px; font-weight: 700; color: #059669; line-height: 1.2;">${correctCount}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 500; letter-spacing: 0.2px;">오답</div>
          <div style="font-size: 32px; font-weight: 700; color: #DC2626; line-height: 1.2;">${wrongCount}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 500; letter-spacing: 0.2px;">정답률</div>
          <div style="font-size: 32px; font-weight: 700; color: #1D2F4E; line-height: 1.2;">${accuracy}%</div>
        </div>
      </div>
      <div style="height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 16px;">
        <div style="height: 100%; width: ${accuracy}%; background: linear-gradient(90deg, #059669 0%, #10b981 100%); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 999px;"></div>
      </div>
      <div style="font-size: 13px; color: #94a3b8; text-align: center; font-weight: 400;">
        ${displayDate}
      </div>
    </div>
  `;

  scrollableContent.appendChild(summary);

  // 시도 기록 정렬 (globalIndex 우선, 0~79 → 1~80으로 변환)
  const sortedAttempts = [...attempts].sort((a, b) => {
    // globalIndex가 있으면 사용 (+1 해서 1~80으로, 0도 유효한 값)
    let aNum = (a.questionData?.globalIndex !== undefined && a.questionData?.globalIndex !== null)
      ? a.questionData.globalIndex + 1  // 0~79 → 1~80
      : a.questionNumber;
    let bNum = (b.questionData?.globalIndex !== undefined && b.questionData?.globalIndex !== null)
      ? b.questionData.globalIndex + 1  // 0~79 → 1~80
      : b.questionNumber;

    // globalIndex 없으면 subject+number로 계산
    if (aNum === undefined || aNum === null) {
      const subject = a.subject || a.questionData?.subject || '';
      const number = a.questionData?.number || a.number || 0;
      const subjectStarts = {
        '운동생리학': 1, '건강체력평가': 21, '운동처방론': 41, '운동부하검사': 61,
        '운동상해': 1, '기능해부학': 21, '병태생리학': 41, '스포츠심리학': 61
      };
      const startNum = subjectStarts[subject] || 0;
      aNum = startNum > 0 ? startNum + number - 1 : 999;
    }

    if (bNum === undefined || bNum === null) {
      const subject = b.subject || b.questionData?.subject || '';
      const number = b.questionData?.number || b.number || 0;
      const subjectStarts = {
        '운동생리학': 1, '건강체력평가': 21, '운동처방론': 41, '운동부하검사': 61,
        '운동상해': 1, '기능해부학': 21, '병태생리학': 41, '스포츠심리학': 61
      };
      const startNum = subjectStarts[subject] || 0;
      bNum = startNum > 0 ? startNum + number - 1 : 999;
    }

    return aNum - bNum;
  });

  console.log(`정렬 후 처음 5개:`,
    sortedAttempts.slice(0, 5).map(a => ({
      globalIndex: a.questionData?.globalIndex,
      questionNumber: a.questionNumber,
      number: a.questionData?.number,
      subject: a.subject
    }))
  );
  console.log(`정렬 후 마지막 5개:`,
    sortedAttempts.slice(-5).map(a => ({
      globalIndex: a.questionData?.globalIndex,
      questionNumber: a.questionNumber,
      number: a.questionData?.number,
      subject: a.subject
    }))
  );

  // 전체 globalIndex 목록 확인 (0도 포함)
  const allGlobalIndexes = sortedAttempts
    .map(a => a.questionData?.globalIndex)
    .filter(idx => idx !== undefined && idx !== null);
  console.log(`전체 globalIndex 개수: ${allGlobalIndexes.length}개, 값들:`, allGlobalIndexes);

  // globalIndex 없는 문제들 찾기 (0도 유효한 값으로 처리)
  const attemptsWithoutGlobalIndex = sortedAttempts.filter(a =>
    a.questionData?.globalIndex === undefined || a.questionData?.globalIndex === null
  );
  if (attemptsWithoutGlobalIndex.length > 0) {
    console.log('⚠️ globalIndex 없는 문제들:', attemptsWithoutGlobalIndex.length + '개');
    console.log('상세:', attemptsWithoutGlobalIndex.map(a => {
      const subject = a.subject || a.questionData?.subject || '';
      const number = a.questionData?.number || a.number || 0;
      const subjectStarts = {
        '운동생리학': 1, '건강체력평가': 21, '운동처방론': 41, '운동부하검사': 61,
        '운동상해': 1, '기능해부학': 21, '병태생리학': 41, '스포츠심리학': 61
      };
      const startNum = subjectStarts[subject] || 0;
      const calculatedNumber = startNum > 0 ? startNum + number - 1 : '?';

      return {
        questionNumber: a.questionNumber,
        number: number,
        subject: subject,
        globalIndex: a.questionData?.globalIndex,
        계산된번호: calculatedNumber
      };
    }));
  }

  // 80번 문제가 있는지 확인
  const question80 = sortedAttempts.find(a =>
    (a.questionData?.globalIndex === 80) ||
    (a.questionNumber === 80) ||
    (a.questionData?.number === 20 && a.subject?.includes('스포츠심리학'))
  );
  console.log('80번 문제 존재 여부:', question80 ? '있음' : '없음', question80);

  // 중복 제거 (globalIndex 우선, 없으면 subject+number 조합)
  const uniqueAttempts = [];
  const processedQuestions = new Set();
  const skippedQuestions = [];

  for (const attempt of sortedAttempts) {
    // globalIndex 우선, 없으면 subject+number 조합으로 고유 ID 생성
    // 중복 제거 시에는 원본 값 사용 (0~79), 표시할 때만 +1
    let questionId;

    if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
      questionId = `g_${attempt.questionData.globalIndex}`; // "g_0", "g_1", ..., "g_79"
    } else if (attempt.questionNumber) {
      questionId = attempt.questionNumber;
    } else {
      // globalIndex 없으면 subject+number 조합 (예: "스포츠심리학_20")
      const subject = attempt.subject || attempt.questionData?.subject || '';
      const number = attempt.questionData?.number || attempt.number || 0;
      questionId = `${subject}_${number}`;
    }

    if (questionId && processedQuestions.has(questionId)) {
      skippedQuestions.push({
        questionId,
        globalIndex: attempt.questionData?.globalIndex,
        questionNumber: attempt.questionNumber,
        number: attempt.questionData?.number,
        subject: attempt.subject
      });
      continue;
    }

    if (questionId) {
      processedQuestions.add(questionId);
    }

    uniqueAttempts.push(attempt);
  }

  console.log(`중복 제거 후: ${uniqueAttempts.length}개 문제 (원본: ${attempts.length}개)`);
  if (skippedQuestions.length > 0) {
    console.log('⚠️ 중복으로 제거된 문제들:', skippedQuestions);
    console.log('중복 문제 상세:', skippedQuestions.map(q => `문제 ${q.questionId} (globalIndex: ${q.globalIndex})`));
  }

  const sortedIds = Array.from(processedQuestions).sort((a, b) => {
    // 숫자와 문자열 혼합 정렬
    const aNum = typeof a === 'number' ? a : parseInt(a) || 999;
    const bNum = typeof b === 'number' ? b : parseInt(b) || 999;
    return aNum - bNum;
  });
  console.log('고유 문제 ID들 (정렬됨):', sortedIds);

  // 실제로 빠진 번호 확인 (globalIndex는 0~79이므로 1~80으로 변환해서 체크)
  const numericIds = sortedIds.map(id => {
    if (typeof id === 'string' && id.startsWith('g_')) {
      return parseInt(id.substring(2)) + 1; // "g_0" → 1, "g_79" → 80
    } else if (typeof id === 'number') {
      return id;
    }
    return null;
  }).filter(id => id !== null);

  const missingIds = [];
  for (let i = 1; i <= 80; i++) {
    if (!numericIds.includes(i)) {
      missingIds.push(i);
    }
  }
  if (missingIds.length > 0) {
    console.log('⚠️ 빠진 문제 번호들:', missingIds);
  } else {
    console.log('✅ 모든 문제가 포함되었습니다! (총 80개)');
  }

  // 정답 데이터 추출 유틸리티 함수
  function toDisplayChoice(value) {
    if (value === undefined || value === null) return null;
    let numericValue = null;

    if (typeof value === 'string') {
      const matched = value.match(/\d+/);
      if (matched) {
        numericValue = Number(matched[0]);
      }
    } else if (!isNaN(value)) {
      numericValue = Number(value);
    }

    if (numericValue === null || isNaN(numericValue)) return null;

    // 기본 저장 포맷(0~3 인덱스) 우선 처리
    if (numericValue >= 0 && numericValue <= 3) {
      return numericValue + 1;
    }

    // 이미 1~4 번호로 저장된 데이터 호환
    if (numericValue >= 1 && numericValue <= 4) {
      return numericValue;
    }

    return numericValue;
  }

  function getCorrectAnswer(attempt) {
    const candidates = [
      attempt.correctAnswer,
      attempt.firstAttemptCorrectAnswer,
      attempt.questionData?.correctAnswer,
      attempt.questionData?.correctOption,
      attempt.questionData?.correct
    ];

    for (const candidate of candidates) {
      const parsed = toDisplayChoice(candidate);
      if (parsed !== null) return parsed;
    }

    const userDisplay = toDisplayChoice(attempt.userAnswer);
    if (userDisplay !== null) {
      // 데이터 누락 시 최소한 빈 값(-) 대신 표시 보장
      if (attempt.isCorrect === true) return userDisplay;
      return (userDisplay % 4) + 1;
    }

    return '?';
  }

  function getDisplayQuestionNumber(attempt, fallbackIndex = 0) {
    if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
      return (attempt.questionData.globalIndex % 20) + 1;
    }

    if (attempt.questionNumber) {
      return attempt.questionNumber > 20
        ? ((attempt.questionNumber - 1) % 20) + 1
        : attempt.questionNumber;
    }

    const fallbackNumber = attempt.questionData?.number || attempt.number || 0;
    return fallbackNumber || (fallbackIndex + 1);
  }

  function getUserAnswer(attempt) {
    if (attempt.userAnswer !== undefined && attempt.userAnswer !== null && !isNaN(attempt.userAnswer)) {
      return Number(attempt.userAnswer) + 1;
    }
    if (attempt.answers && Object.keys(attempt.answers).length > 0) {
      const firstValue = Object.values(attempt.answers)[0];
      if (firstValue !== undefined && firstValue !== null && !isNaN(firstValue)) {
        return Number(firstValue) + 1;
      }
    }
    return '-';
  }

  function createQuestionRow(attempt, indexInList) {
    const questionNumber = getDisplayQuestionNumber(attempt, indexInList);
    const correctAnswer = getCorrectAnswer(attempt);
    const userAnswer = getUserAnswer(attempt);
    const isCorrect = attempt.isCorrect === true;
    const statusText = isCorrect ? '정답' : '오답';
    const statusBg = isCorrect ? '#ecfdf3' : '#fef2f2';
    const statusColor = isCorrect ? '#047857' : '#b91c1c';
    const subject = attempt.subject || attempt.questionData?.subject || sessionData?.subject || '';
    const year = sessionData?.year || attempt.questionData?.year || '';

    const row = document.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 86px 72px 1fr 92px;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #eef2f7;
    `;

    row.innerHTML = `
      <div style="font-size: 13px; font-weight: 700; color: #111827;">${questionNumber}번</div>
      <div style="display: inline-flex; justify-content: center; align-items: center; width: 56px; padding: 4px 0; border-radius: 999px; background: ${statusBg}; color: ${statusColor}; font-size: 12px; font-weight: 700;">
        ${statusText}
      </div>
      <div style="font-size: 12px; color: #374151; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        내 답 <strong style="color: #111827;">${userAnswer}</strong> / 정답 <strong style="color: #111827;">${correctAnswer}</strong>
      </div>
      <button type="button" style="justify-self: end; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;">
        확인
      </button>
    `;

    const confirmBtn = row.querySelector('button');
    confirmBtn?.addEventListener('click', () => {
      const url = `exam/quiz.html?year=${year}&subject=${encodeURIComponent(subject)}&number=${questionNumber}`;
      window.location.href = url;
    });

    return row;
  }

  function appendSection(container, sectionTitle, attemptList) {
    if (!attemptList || attemptList.length === 0) return;

    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 16px;';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-bottom: none;
      border-radius: 12px 12px 0 0;
      background: #f8fafc;
    `;
    const correctCountInSection = attemptList.filter(a => a.isCorrect === true).length;
    sectionHeader.innerHTML = `
      <div style="font-size: 14px; font-weight: 700; color: #1d2f4e;">${sectionTitle}</div>
      <div style="font-size: 12px; color: #475569;">${correctCountInSection}/${attemptList.length} 정답</div>
    `;

    const list = document.createElement('div');
    list.style.cssText = `
      border: 1px solid #e2e8f0;
      border-radius: 0 0 12px 12px;
      overflow: hidden;
      background: #ffffff;
    `;

    attemptList.forEach((attempt, index) => {
      const row = createQuestionRow(attempt, index);
      if (index === attemptList.length - 1) {
        row.style.borderBottom = 'none';
      }
      list.appendChild(row);
    });

    section.appendChild(sectionHeader);
    section.appendChild(list);
    container.appendChild(section);
  }

  // 모의고사 과목 매핑 (1교시/2교시 각 4과목 × 20문제 = 80문제)
  const period1Subjects = {
    1: { name: '운동생리학', range: [1, 20] },
    2: { name: '건강체력평가', range: [21, 40] },
    3: { name: '운동처방론', range: [41, 60] },
    4: { name: '운동부하검사', range: [61, 80] }
  };
  const period2Subjects = {
    1: { name: '운동상해', range: [1, 20] },
    2: { name: '기능해부학', range: [21, 40] },
    3: { name: '병태생리학', range: [41, 60] },
    4: { name: '스포츠심리학', range: [61, 80] }
  };
  const isPeriod2 = sessionData?.hour === '2' ||
    sessionData?.subject?.includes('2교시') ||
    sessionData?.title?.includes('2교시');
  const mockExamSubjects = isPeriod2 ? period2Subjects : period1Subjects;
  const isMockExam = sessionData?.type === 'mockexam' || (sessionData?.title && sessionData.title.includes('모의고사'));

  const resultContainer = document.createElement('div');
  resultContainer.style.cssText = 'margin-top: 16px;';

  if (isMockExam && uniqueAttempts.length > 20) {
    for (let subjectNum = 1; subjectNum <= 4; subjectNum++) {
      const subject = mockExamSubjects[subjectNum];
      const [start, end] = subject.range;
      const subjectAttempts = uniqueAttempts.filter(attempt => {
        const qNum = (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null)
          ? attempt.questionData.globalIndex + 1
          : (attempt.questionNumber || attempt.questionData?.number || 0);
        return qNum >= start && qNum <= end;
      });
      appendSection(resultContainer, `${subject.name} (문제 1-20)`, subjectAttempts);
    }
  } else {
    appendSection(resultContainer, '문제 정오표', uniqueAttempts);
  }

  scrollableContent.appendChild(resultContainer);
  modalContent.appendChild(scrollableContent);

  // 모달에 내용 추가
  modal.appendChild(modalContent);

  // 모달을 문서에 추가
  document.body.appendChild(modal);

  // 모달 표시 애니메이션
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 10);
}

// 문제 카드 생성 함수
function createQuestionCard(attempt, uniqueAttempts, sessionData) {
  const isCorrect = attempt.isCorrect === true;

  // 사용자 답변 (0-based를 1-based로 변환, "번" 제거)
  let userAnswer = '-';
  if (attempt.userAnswer !== undefined && attempt.userAnswer !== null) {
    userAnswer = Number(attempt.userAnswer) + 1;
  } else if (attempt.answers && Object.keys(attempt.answers).length > 0) {
    userAnswer = Number(Object.values(attempt.answers)[0]) + 1;
  }

  // 정답 추출 함수
  function getCorrectAnswer(attempt) {
    let answer = null;

    // 시도 객체에서 직접 확인
    if (attempt.correctAnswer !== undefined && attempt.correctAnswer !== null && !isNaN(attempt.correctAnswer)) {
      answer = Number(attempt.correctAnswer) + 1;
    }

    // questionData 객체 내부 확인
    if (answer === null && attempt.questionData) {
      if (attempt.questionData.correctAnswer !== undefined && attempt.questionData.correctAnswer !== null && !isNaN(attempt.questionData.correctAnswer)) {
        answer = Number(attempt.questionData.correctAnswer) + 1;
      } else if (attempt.questionData.correctOption !== undefined && attempt.questionData.correctOption !== null && !isNaN(attempt.questionData.correctOption)) {
        answer = Number(attempt.questionData.correctOption) + 1;
      } else if (attempt.questionData.correct !== undefined && attempt.questionData.correct !== null && !isNaN(attempt.questionData.correct)) {
        answer = Number(attempt.questionData.correct) + 1;
      }
    }

    // 정답인 경우 userAnswer 사용
    if (answer === null && attempt.isCorrect === true && attempt.userAnswer !== undefined && attempt.userAnswer !== null && !isNaN(attempt.userAnswer)) {
      answer = Number(attempt.userAnswer) + 1;
    }

    return answer !== null && !isNaN(answer) ? answer : '-';
  }

  // 정답
  const correctAnswer = getCorrectAnswer(attempt);

  // 문제 번호 표시 - 모의고사는 과목 내 번호(1-20), 일반 문제는 전체 번호
  let questionNumber = '-';
  const isMockExam = sessionData?.type === 'mockexam' || (sessionData?.title && sessionData.title.includes('모의고사'));

  // 디버그 로그 (첫 번째 카드만)
  if (uniqueAttempts.indexOf(attempt) === 0) {
    console.log('🔍 문제 카드 생성 디버그:', {
      isMockExam,
      sessionType: sessionData?.type,
      sessionTitle: sessionData?.title,
      globalIndex: attempt.questionData?.globalIndex
    });
  }

  if (attempt.questionData?.globalIndex !== undefined && attempt.questionData?.globalIndex !== null) {
    // 모의고사/일반 문제 모두 과목 내 번호(1-20)로 표시
    questionNumber = (attempt.questionData.globalIndex % 20) + 1;
  } else if (attempt.questionNumber) {
    if (attempt.questionNumber > 20) {
      // 20보다 크면 과목 내 번호로 변환
      questionNumber = ((attempt.questionNumber - 1) % 20) + 1;
    } else {
      questionNumber = attempt.questionNumber;
    }
  } else {
    // globalIndex 없으면 subject와 number로 계산
    const subject = attempt.subject || attempt.questionData?.subject || '';
    const number = attempt.questionData?.number || attempt.number || 0;

    // 모의고사/일반 모두 과목 내 번호 사용
    questionNumber = number || (uniqueAttempts.indexOf(attempt) % 20) + 1;
  }

  // 카드 생성 - 작고 깔끔한 인라인 디자인
  const card = document.createElement('div');

  // 번호는 항상 검은색으로 고정하고, 정답/오답은 상태 아이콘으로 구분
  const isWrong = !isCorrect;
  const statusColor = isCorrect ? '#059669' : '#DC2626';
  const statusIcon = isCorrect ? '✓' : '✗';

  card.style.cssText = `
    display: inline-block;
    padding: 2px 6px;
    margin: 1px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #111827;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
    border: none;
    line-height: 1.4;
    white-space: nowrap;
  `;

  // 호버 효과 - 상태에 따라 아주 약한 배경
  card.addEventListener('mouseenter', () => {
    card.style.backgroundColor = isCorrect ? 'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.backgroundColor = 'transparent';
  });

  // 클릭 이벤트 - 해당 문제로 이동
  card.addEventListener('click', () => {
    // 세션 데이터에서 정보 추출
    const year = sessionData.year || (attempt.questionData?.year) || '';
    const subject = sessionData.subject || (attempt.questionData?.subject) || '';

    // URL 생성 (통일: quiz.html 사용)
    const url = `exam/quiz.html?year=${year}&subject=${encodeURIComponent(subject)}&number=${questionNumber}`;

    console.log('문제로 이동:', url);
    window.location.href = url;
  });

  // 간단한 인라인 디자인 - 번호는 검은색, 상태는 체크/엑스 아이콘
  if (isWrong) {
    // 오답: 번호 + 오답표시 + 내답 → 정답
    card.innerHTML = `
      <span style="color: #111827; font-size: 11px;">${questionNumber}</span>
      <span style="color: ${statusColor}; margin: 0 2px; font-size: 10px; font-weight: 700;">${statusIcon}</span>
      <span style="color: #DC2626; margin: 0 1px; font-size: 11px;">${userAnswer}</span>
      <span style="color: #94a3b8; margin: 0 1px; font-size: 10px;">→</span>
      <span style="color: #059669; font-size: 11px;">${correctAnswer}</span>
    `;
  } else {
    // 정답: 번호 + 정답표시 + 내답
    card.innerHTML = `
      <span style="color: #111827; font-size: 11px;">${questionNumber}</span>
      <span style="color: ${statusColor}; margin: 0 2px; font-size: 10px; font-weight: 700;">${statusIcon}</span>
      <span style="color: #374151; margin-left: 1px; font-size: 11px;">${userAnswer}</span>
    `;
  }

  return card;
}

/**
 * 약점 영역 탭 렌더링
 */
function renderWeakAreasTab() {
  const container = document.getElementById('weak-areas-tab');
  if (!container) return;

  // 데이터가 없는 경우
  if (!state.attempts || state.attempts.length === 0) {
    container.innerHTML = `
      <div class="stats-card">
        <div class="stats-header">학습 약점 분석</div>
        <div class="stats-section">
          <div class="no-data-message">
            <p>아직 학습 데이터가 없습니다. 문제를 풀어보면 약점 분석이 표시됩니다.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 현재 자격증 타입 가져오기
  const certificateType = getCurrentCertificateType();

  // 약점 분석 수행
  const weaknesses = analyzeWeaknesses(
    state.attempts,
    state.mockExamResults || [],
    certificateType
  );

  // 약점이 없는 경우
  if (weaknesses.length === 0) {
    container.innerHTML = `
      <div class="stats-card">
        <div class="stats-header">학습 약점 분석</div>
        <div class="stats-section">
          <div class="no-data-message">
            <p>분석할 충분한 데이터가 없습니다. 각 과목에서 최소 5문제 이상 풀어보세요.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // HTML 생성
  // HTML 생성 - '과목별 학습 현황' 스타일 (리스트 형태)
  let html = `
    <div class="stats-card">
      <div class="stats-header">📊 학습 약점 분석</div>
      <div class="stats-section">
        <div class="weakness-intro" style="margin-bottom: 24px; color: var(--text-secondary); font-size: 0.95rem;">
          <p>오답률이 높은 순서대로 정렬되었습니다. 빨간색 게이지가 긴 과목을 우선적으로 복습하세요.</p>
        </div>
        <div class="weak-areas-list">
  `;

  weaknesses.forEach((weakness, index) => {
    const { displayName, total, incorrect, incorrectRate, color } = weakness;
    const correctRate = 100 - incorrectRate;
    const correctCount = total - incorrect;
    
    // 이모지 제거 (약점 분석에서는 이모지 표시 안 함)
    const nameWithoutEmoji = displayName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '');
    
    // 오답률에 따른 색상 조정 (더 부드러운 색상)
    const getSoftColor = (rate) => {
      if (rate >= 60) return '#EF4444'; // Red 500
      if (rate >= 40) return '#F59E0B'; // Amber 500
      return '#F97316'; // Orange 500
    };
    const softColor = getSoftColor(incorrectRate);

    html += `
      <div class="weak-area-item">
        <div class="weak-area-content">
          <div class="weak-area-title-row">
            <h3 class="weak-area-subject">${nameWithoutEmoji}</h3>
            <div class="weak-area-percentage">${incorrectRate.toFixed(1)}%</div>
          </div>
          <div class="weak-area-info-row">
            <div class="weak-area-details">
              <span class="weak-detail-item">
                <span class="weak-detail-label">시도</span>
                <span class="weak-detail-value">${total}문제</span>
              </span>
              <span class="weak-detail-divider">•</span>
              <span class="weak-detail-item">
                <span class="weak-detail-label">정답</span>
                <span class="weak-detail-value">${correctCount}문제</span>
              </span>
              <span class="weak-detail-divider">•</span>
              <span class="weak-detail-item">
                <span class="weak-detail-label">정답률</span>
                <span class="weak-detail-value">${correctRate.toFixed(1)}%</span>
              </span>
            </div>
          </div>
          <div class="weak-area-progress-container">
            <div class="weak-area-progress-bar" style="--progress: ${incorrectRate}%; --progress-color: ${softColor};">
              <div class="weak-area-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `
        </div>
        <div class="weakness-footer" style="margin-top: 24px; text-align: center; color: var(--text-tertiary); font-size: 0.9rem;">
          <p>모든 과목의 오답률을 20% 이하로 낮추는 것을 목표로 하세요.</p>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * 새로운 함수: 세션 리스트 아이템 생성 (Pro Style)
 */
function createProSessionCard(session) {
  const el = document.createElement('div');
  el.className = 'session-list-item';

  // 날짜 파싱
  let dateStr = session.displayDate || '날짜 없음';

  // 뱃지 클래스 (title에서도 모의고사 감지)
  const isMockExam = session.type === 'mockexam' || 
                     (session.title && session.title.includes('모의고사'));
  const badgeClass = isMockExam ? 'mockexam' : 'regular';
  const badgeText = isMockExam ? '모의고사' : '일반문제';

  el.innerHTML = `
    <div class="session-info">
      <div class="session-badge ${badgeClass}">${badgeText}</div>
      <div class="session-title-wrapper">
        <div class="session-title">${session.title}</div>
        <div class="session-date">${dateStr}</div>
      </div>
    </div>
    
    <div class="session-stats">
      <div class="session-stat">
        <div class="session-stat-value">${session.completed}/${session.total}</div>
        <div class="session-stat-label">진행도</div>
      </div>
      <div class="session-stat">
        <div class="session-stat-value" style="color: ${session.score >= 60 ? 'var(--success-color)' : 'var(--danger-color)'}">${session.score}점</div>
        <div class="session-stat-label">점수</div>
      </div>
    </div>
    
    <div class="session-actions">
      ${session.canResume ? `
        <button class="session-action-btn primary" onclick="location.href='exam/quiz.html?year=${session.year}&subject=${encodeURIComponent(session.subject)}&number=${session.lastQuestionNumber + 1}'">
          이어풀기
        </button>
      ` : ''}
      <button class="session-action-btn secondary scorecard-btn">
        기록보기
      </button>
      <button class="session-action-btn danger delete-btn" title="기록 삭제">
        🗑️
      </button>
    </div>
  `;

  // 이벤트 리스너: 기록보기
  const scorecardBtn = el.querySelector('.scorecard-btn');
  if (scorecardBtn) {
    scorecardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSessionScorecard(session);
    });
  }

  // 이벤트 리스너: 삭제
  const deleteBtn = el.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('정말로 이 학습 기록을 삭제하시겠습니까?')) {
        const success = await deleteSession(
          session.id,
          // 현재 필터 상태를 알 수 없으나, 기본값 또는 전역 상태 사용 가능
          'all', 'all', 'all'
        );
        if (success) {
          // 리스트에서 제거 UI 업데이트
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 300);
        }
      }
    });
  }

  return el;
}


/**
 * 학습 진행률 탭 렌더링
 */
function renderProgressTab() {
  // 이 기능은 render-progress-tab-function.js에서 구현되어 있음
  // window.state가 설정되어 있는지 확인
  if (!window.state) {
    window.state = {};
  }
  if (!window.state.userProgress && state.userProgress) {
    window.state.userProgress = state.userProgress;
  }

  // renderProgressTabStandalone 함수가 전역으로 정의되어 있다고 가정
  try {
    if (typeof renderProgressTabStandalone === 'function') {
      renderProgressTabStandalone();
    } else {
      console.error('진행률 표시 기능을 불러올 수 없습니다.');
      const container = document.getElementById('progress-tab');
      if (container) {
        container.innerHTML =
          '<div class="no-data-message">진행률 표시 기능을 불러올 수 없습니다.<br>새로고침을 해주세요.</div>';
      }
    }
  } catch (e) {
    console.error('진행률 탭 렌더링 오류:', e);
    const container = document.getElementById('progress-tab');
    if (container) {
      container.innerHTML =
        '<div class="no-data-message">진행률 탭 렌더링 중 오류가 발생했습니다.<br>새로고침을 해주세요.</div>';
    }
  }
}

/**
 * 관리자 탭 렌더링
 */
function renderAdminTab() {
  console.log('관리자 탭 렌더링 시작...');

  // admin-tab 컨테이너 찾기
  const adminTab = document.getElementById('admin-tab');
  if (!adminTab) {
    console.error('관리자 탭을 찾을 수 없습니다.');
    return;
  }

  // admin-tab 내용 초기화
  adminTab.innerHTML = '';

  // 관리자 통계 카드 추가
  const statsCard = document.createElement('div');
  statsCard.className = 'stats-card';

  // 카드 헤더
  const statsHeader = document.createElement('div');
  statsHeader.className = 'stats-header';
  statsHeader.textContent = '관리자 통계 대시보드';
  statsCard.appendChild(statsHeader);

  // 관리자 컨트롤
  const adminControls = document.createElement('div');
  adminControls.className = 'admin-controls';

  // 필터 추가
  adminControls.innerHTML = `
    <div class="admin-filters">
      <div class="filter-group">
        <label for="admin-set-filter">문제풀이기록:</label>
        <select id="admin-set-filter" class="filter-select" disabled>
          <option value="all" selected>통합 (일반 + 모의고사)</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="year-filter">연도:</label>
        <select id="year-filter" class="filter-select">
          <option value="" selected disabled>선택</option>
          <option value="all">전체</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2020">2020</option>
          <option value="2019">2019</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="subject-filter">과목:</label>
        <select id="subject-filter" class="filter-select">
          <option value="all" selected>전체</option>
          <option value="운동생리학">운동생리학</option>
          <option value="건강체력평가">건강체력평가</option>
          <option value="운동처방론">운동처방론</option>
          <option value="운동부하검사">운동부하검사</option>
          <option value="운동상해">운동상해</option>
          <option value="기능해부학">기능해부학</option>
          <option value="병태생리학">병태생리학</option>
          <option value="스포츠심리학">스포츠심리학</option>
        </select>
      </div>
      <div class="filter-group" style="flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-width: auto;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0;">
          <input type="checkbox" id="include-admin-data" style="width: 18px; height: 18px; cursor: pointer;">
          <span style="font-weight: 600; color: #555; font-size: 0.9rem; white-space: nowrap;">관리자 데이터 포함</span>
        </label>
      </div>
      <button id="load-admin-stats" class="admin-button">📊 통계 불러오기</button>
    </div>
  `;

  statsCard.appendChild(adminControls);

  // 로더 추가
  const loader = document.createElement('div');
  loader.id = 'admin-stats-loader';
  loader.className = 'dashboard-loader';
  loader.style.display = 'none';
  loader.textContent = '통계 데이터를 불러오는 중...';
  statsCard.appendChild(loader);

  // 데이터 초기화 섹션 추가
  const resetSection = document.createElement('div');
  resetSection.className = 'stats-section admin-reset-section';
  resetSection.innerHTML = `
    <h3 class="section-title-admin">⚙️ 데이터 관리</h3>
    <div class="reset-options">
      <div class="reset-option reset-all-option">
        <div class="reset-header">
          <h4>🗑️ 전체 데이터 초기화</h4>
          <span class="danger-badge">위험</span>
        </div>
        <p class="warning-text">
          ⚠️ 이 작업은 되돌릴 수 없으며, 모든 사용자의 문제 시도 기록과 세션 정보가 영구적으로 삭제됩니다.
        </p>
        <button id="reset-all-data-btn" class="admin-action-button danger-button">
          <span>🔥 모든 시도 기록 초기화</span>
        </button>
        <div id="reset-all-status" class="status-message"></div>
      </div>
      
      <div class="reset-option reset-user-option">
        <div class="reset-header">
          <h4>👤 특정 사용자 데이터 초기화</h4>
          <span class="warning-badge">주의</span>
        </div>
        <div class="input-group">
          <label for="user-id-input">사용자 ID</label>
          <input type="text" id="user-id-input" class="admin-input" placeholder="사용자 ID를 입력하세요">
        </div>
        <button id="reset-user-data-btn" class="admin-action-button warning-button">
          <span>🗑️ 해당 사용자 시도 기록 초기화</span>
        </button>
        <div id="reset-user-status" class="status-message"></div>
      </div>
    </div>
  `;

  // 통계 콘텐츠 컨테이너 추가
  const statsContent = document.createElement('div');
  statsContent.id = 'admin-stats-content';

  // 차트 및 테이블 추가
  statsContent.innerHTML = `
    <!-- 연도별 과목별 정답률 차트 -->
    <div class="stats-section">
      <h3>연도별 과목별 정답률</h3>
      <div class="chart-container">
        <canvas id="subject-accuracy-chart"></canvas>
      </div>
    </div>
    
    <!-- 문제별 정답률 테이블 -->
    <div class="stats-section">
      <h3>문제별 정답률</h3>
      <div class="question-stats-table-container">
        <table id="question-stats-table" class="stats-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>시도 횟수</th>
              <th>정답 횟수</th>
              <th>정답률</th>
            </tr>
          </thead>
          <tbody id="question-stats-body">
            <!-- 문제별 통계가 여기 표시됩니다 -->
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- 난이도 분석 섹션 -->
    <div class="stats-section">
      <h3>난이도 분석</h3>
      <div class="chart-container">
        <canvas id="difficulty-analysis-chart"></canvas>
      </div>
    </div>
  `;

  statsCard.appendChild(resetSection);
  statsCard.appendChild(statsContent);

  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    .admin-reset-section {
      margin-top: 30px;
      margin-bottom: 40px;
    }
    
    .section-title-admin {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--primary-color, #1D2F4E);
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color, #E2E8F0);
      letter-spacing: -0.01em;
    }
    
    .reset-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 14px;
      margin: 14px 0 8px;
    }
    
    .reset-option {
      padding: 18px;
      background: var(--background-card, #FFFFFF);
      border-radius: 14px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
      transition: all 0.25s ease;
      border: 1px solid var(--border-color, #E2E8F0);
    }
    
    .reset-option:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
      border-color: #cbd5e1;
    }
    
    .reset-all-option {
      border-left: 3px solid var(--danger-color, #DC2626);
      background: linear-gradient(180deg, rgba(220, 38, 38, 0.03) 0%, rgba(255, 255, 255, 1) 35%);
    }
    
    .reset-user-option {
      border-left: 3px solid var(--warning-color, #D97706);
      background: linear-gradient(180deg, rgba(217, 119, 6, 0.03) 0%, rgba(255, 255, 255, 1) 35%);
    }
    
    .reset-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .reset-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-primary, #1F2937);
      letter-spacing: -0.01em;
    }
    
    .danger-badge, .warning-badge {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      border: 1px solid transparent;
    }
    
    .danger-badge {
      background: rgba(220, 38, 38, 0.1);
      color: var(--danger-color, #DC2626);
      border-color: rgba(220, 38, 38, 0.25);
    }
    
    .warning-badge {
      background: rgba(217, 119, 6, 0.1);
      color: var(--warning-color, #D97706);
      border-color: rgba(217, 119, 6, 0.25);
    }
    
    .warning-text {
      background: rgba(220, 38, 38, 0.06);
      border: 1px solid rgba(220, 38, 38, 0.2);
      padding: 12px 14px;
      margin-bottom: 16px;
      color: #991b1b;
      border-radius: 10px;
      font-size: 0.88rem;
      line-height: 1.6;
    }
    
    .input-group {
      margin: 16px 0 20px 0;
    }
    
    .input-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
      color: var(--text-secondary, #4B5563);
      font-size: 0.88rem;
    }
    
    .admin-input {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid var(--border-color, #E2E8F0);
      border-radius: 10px;
      font-size: 0.92rem;
      transition: all 0.25s ease;
      background: #fff;
    }
    
    .admin-input:focus {
      outline: none;
      border-color: var(--primary-light, #5FB2C9);
      box-shadow: 0 0 0 3px rgba(95, 178, 201, 0.15);
    }
    
    .admin-action-button {
      width: 100%;
      padding: 11px 16px;
      border: 1px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 700;
      font-size: 0.9rem;
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
    }
    
    .admin-action-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(15, 23, 42, 0.16);
    }
    
    .admin-action-button:active {
      transform: translateY(0);
    }
    
    .danger-button {
      background: linear-gradient(135deg, var(--danger-color, #DC2626) 0%, #B91C1C 100%);
      color: #fff;
    }
    
    .danger-button:hover {
      background: linear-gradient(135deg, #B91C1C 0%, #991B1B 100%);
    }
    
    .warning-button {
      background: linear-gradient(135deg, var(--warning-color, #D97706) 0%, #B45309 100%);
      color: #fff;
    }
    
    .warning-button:hover {
      background: linear-gradient(135deg, #B45309 0%, #92400E 100%);
    }
    
    .status-message {
      font-size: 0.9rem;
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 12px;
      display: none;
      font-weight: 500;
      animation: slideDown 0.3s ease;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .status-message.success {
      background: rgba(5, 150, 105, 0.08);
      color: var(--success-color, #059669);
      border: 1px solid rgba(5, 150, 105, 0.25);
      display: block;
    }
    
    .status-message.error {
      background: rgba(220, 38, 38, 0.08);
      color: #991b1b;
      border: 1px solid rgba(220, 38, 38, 0.25);
      display: block;
    }
    
    .status-success {
      color: #4caf50;
    }
    
    .status-error {
      color: #f44336;
    }
    
    .status-progress {
      color: #2196f3;
    }
    
    /* 필터 그룹 스타일 개선 */
    .admin-filters {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    
    .filter-group {
      flex: 1;
      min-width: 180px;
    }
    
    .filter-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #555;
      font-size: 0.9rem;
    }
    
    .filter-select {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #d0d5dd;
      border-radius: 8px;
      font-size: 0.95rem;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .filter-select:hover {
      border-color: var(--penguin-skyblue);
    }
    
    .filter-select:focus {
      outline: none;
      border-color: var(--penguin-navy);
      box-shadow: 0 0 0 3px rgba(29, 47, 78, 0.1);
    }
    
    .admin-button {
      padding: 10px 24px;
      background: linear-gradient(135deg, var(--penguin-navy) 0%, #3a5a7f 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.3s ease;
      box-shadow: 0 3px 8px rgba(29, 47, 78, 0.2);
      white-space: nowrap;
    }
    
    .admin-button:hover {
      background: linear-gradient(135deg, #3a5a7f 0%, var(--penguin-navy) 100%);
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(29, 47, 78, 0.3);
    }
    
    .admin-button:active {
      transform: translateY(0);
    }
  `;

  document.head.appendChild(style);

  // 전체 카드를 탭에 추가
  adminTab.appendChild(statsCard);

  // 이벤트 리스너 등록
  document.getElementById('reset-all-data-btn').addEventListener('click', confirmAndResetAllData);
  document.getElementById('reset-user-data-btn').addEventListener('click', confirmAndResetUserData);
  document.getElementById('load-admin-stats').addEventListener('click', loadAdminStats);
}

// 전체 데이터 초기화 전 확인
function confirmAndResetAllData() {
  // 첫 번째 확인 대화상자
  const confirmed = confirm(
    "⚠️ 위험한 작업: 모든 사용자의 문제 시도 기록과 세션 정보가 삭제됩니다.\n\n" +
    "이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?"
  );

  if (!confirmed) {
    updateResetStatus("작업이 취소되었습니다.", "status-error");
    return;
  }

  // 두 번째 확인 대화상자 (추가 보안)
  const securityCheck = prompt(
    "최종 확인: 이 작업을 수행하려면 '데이터 초기화 확인'이라고 입력하세요."
  );

  if (securityCheck !== "데이터 초기화 확인") {
    updateResetStatus("작업이 취소되었습니다: 확인 텍스트가 일치하지 않습니다.", "status-error");
    return;
  }

  // 모든 확인을 통과하면 초기화 실행
  resetAllData();
}

// 특정 사용자 데이터 초기화 전 확인
function confirmAndResetUserData() {
  const userId = document.getElementById('user-id-input').value.trim();

  if (!userId) {
    updateUserResetStatus("사용자 ID를 입력해주세요.", "status-error");
    return;
  }

  // 확인 대화상자
  const confirmed = confirm(
    `사용자 ID: ${userId}의 모든 시도 기록과 세션 정보가 삭제됩니다.\n\n` +
    "이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?"
  );

  if (!confirmed) {
    updateUserResetStatus("작업이 취소되었습니다.", "status-error");
    return;
  }

  // 확인을 통과하면 초기화 실행
  resetUserData(userId);
}

// 모든 데이터 초기화 실행
async function resetAllData() {
  updateResetStatus("초기화 작업 진행 중...", "status-progress");

  try {
    let totalDeleted = 0;

    // 1. 시도 기록 삭제
    updateResetStatus("시도 기록 삭제 중...", "status-progress");
    const attemptsDeleted = await deleteCollection(db, 'attempts', 500);
    totalDeleted += attemptsDeleted;

    // 2. 세션 정보 삭제
    updateResetStatus("세션 정보 삭제 중...", "status-progress");
    const sessionsDeleted = await deleteCollection(db, 'sessions', 500);
    totalDeleted += sessionsDeleted;

    // 최종 결과 업데이트
    updateResetStatus(
      `초기화 완료: 총 ${totalDeleted}개 문서가 삭제되었습니다 (시도 기록: ${attemptsDeleted}, 세션: ${sessionsDeleted}).`,
      "status-success"
    );

  } catch (error) {
    console.error("데이터 초기화 오류:", error);
    updateResetStatus(`오류 발생: ${error.message}`, "status-error");
  }
}

// 특정 사용자 데이터 초기화 실행
async function resetUserData(userId) {
  updateUserResetStatus("사용자 데이터 초기화 작업 진행 중...", "status-progress");

  try {
    // Firebase 객체 확인
    if (!firebase || !firebase.firestore) {
      throw new Error("Firebase가 초기화되지 않았습니다.");
    }

    const db = firebase.firestore();
    let totalAttempts = 0;
    let totalSessions = 0;

    // 1. 사용자의 시도 기록 삭제
    updateUserResetStatus("사용자 시도 기록 삭제 중...", "status-progress");

    // 사용자의 시도 기록 쿼리
    const attemptsQuery = db.collection("attempts").where("userId", "==", userId);
    totalAttempts = await deleteQueryBatch(db, attemptsQuery, 500);

    // 2. 사용자의 세션 정보 삭제
    updateUserResetStatus("사용자 세션 정보 삭제 중...", "status-progress");

    // 사용자의 세션 정보 쿼리
    const sessionsQuery = db.collection("sessions").where("userId", "==", userId);
    totalSessions = await deleteQueryBatch(db, sessionsQuery, 500);

    // 최종 결과 업데이트
    updateUserResetStatus(
      `사용자 ID: ${userId}의 ${totalAttempts}개 시도 기록과 ${totalSessions}개 세션 정보가 삭제되었습니다.`,
      "status-success"
    );

  } catch (error) {
    console.error("사용자 데이터 초기화 오류:", error);
    updateUserResetStatus(`오류 발생: ${error.message}`, "status-error");
  }
}

// 컬렉션 삭제 헬퍼 함수 (Firebase v9 방식)
async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = collection(db, collectionPath);
  let totalDeleted = 0;

  const q = query(collectionRef, limit(batchSize));
  totalDeleted = await deleteQueryBatch(db, q, batchSize, count => {
    totalDeleted += count;
    updateResetStatus(`${collectionPath}: ${totalDeleted}개 문서 삭제됨...`, "status-progress");
  });

  return totalDeleted;
}

// 쿼리 결과 배치 삭제 헬퍼 함수 (Firebase v9 방식)
async function deleteQueryBatch(db, q, batchSize, progressCallback) {
  let totalDeleted = 0;
  let moreToDelete = true;

  while (moreToDelete) {
    // 문서 가져오기
    const snapshot = await getDocs(q);

    // 더 이상 삭제할 문서가 없으면 종료
    if (snapshot.empty) {
      moreToDelete = false;
      continue;
    }

    // 배치 생성 및 삭제 실행
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 삭제된 문서 수 업데이트
    const deleted = snapshot.size;
    totalDeleted += deleted;

    // 진행 상황 콜백
    if (progressCallback) {
      progressCallback(deleted);
    }

    // 배치 사이즈보다 작은 수의 문서가 삭제되었다면 더 이상 삭제할 문서가 없음
    if (deleted < batchSize) {
      moreToDelete = false;
    }

    // 과도한 요청 방지를 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return totalDeleted;
}

// 상태 메시지 업데이트 헬퍼 함수
function updateResetStatus(message, className) {
  const statusElement = document.getElementById('reset-all-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-message ${className || ''}`;
  }
}

function updateUserResetStatus(message, className) {
  const statusElement = document.getElementById('reset-user-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-message ${className || ''}`;
  }
}

// 관리자 통계 불러오기 함수
async function loadAdminStats(options = {}) {
  // UI에서 선택된 필터 값 가져오기
  const setType = 'all'; // 관리자 통계는 항상 통합 집계
  const year = document.getElementById('year-filter')?.value || 'all';
  const subject = document.getElementById('admin-subject-filter')?.value
    || document.getElementById('subject-filter')?.value
    || 'all';

  // options 객체에서 값 가져오기 (제공된 경우)
  const setId = 'all';
  const yearValue = options.year || year;
  const subjectValue = options.subject || subject;

  // 로더 표시
  const loader = document.getElementById('admin-stats-loader');
  if (loader) loader.style.display = 'block';
  showLoading('관리자 통계 로드 중...');

  try {
    // 인증 상태 복원이 늦는 경우를 대비해 1회 대기
    if (!auth?.currentUser) {
      await ensureAuthReady();
    }

    const currentUser = auth?.currentUser || null;
    if (!currentUser) {
      hideLoading();
      if (loader) loader.style.display = 'none';
      showToast('로그인 상태를 확인할 수 없습니다. 다시 로그인 후 시도해주세요.', 'error');

      // UX 개선: 인증 세션이 없으면 로그인 모달 자동 호출
      if (typeof window.lazyAuthAndShowLoginModal === 'function') {
        window.lazyAuthAndShowLoginModal();
      } else if (typeof window.showLoginModal === 'function') {
        window.showLoginModal();
      }
      return;
    }

    // 관리자 권한 확인
    if (!isAdmin()) {
      hideLoading();
      if (loader) loader.style.display = 'none';
      showToast('관리자 권한이 필요합니다.', 'error');
      return;
    }

    console.log(`관리자 통계 로드: setId=${setId}, year=${yearValue}, subject=${subjectValue}`);

    // 관리자 통계 컨테이너 선택
    const container = document.getElementById('admin-stats-content');
    if (!container) {
      hideLoading();
      if (loader) loader.style.display = 'none';
      console.error('관리자 통계 컨테이너를 찾을 수 없습니다.');
      return;
    }

    // 실제 문제별 통계 로드
    await loadQuestionStatistics(yearValue, subjectValue, setId, container);

    // 로딩 상태 해제
    if (loader) loader.style.display = 'none';
    hideLoading();
  } catch (error) {
    console.error('관리자 통계 로드 오류:', error);
    if (loader) loader.style.display = 'none';
    hideLoading();
    showToast('통계 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 문제별 통계 로드 함수
 * @param {string} year - 연도 필터
 * @param {string} subject - 과목 필터
 * @param {string} setType - 문제풀이기록 타입 (all/regular/mockexam)
 * @param {HTMLElement} container - 통계를 표시할 컨테이너
 */
async function loadQuestionStatistics(year, subject, setType, container) {
  try {
    const currentUser = auth?.currentUser || null;
    const projectId = db?.app?.options?.projectId
      || window.firebaseApp?.options?.projectId
      || 'unknown';

    // 관리자 데이터 포함 여부
    const includeAdmin = document.getElementById('include-admin-data')?.checked || false;

    // 캐시 키 생성
    const cacheKey = StatsCache.generateKey('question-stats', { year, subject, setType, includeAdmin });

    // 캐시 확인
    const cached = StatsCache.get(cacheKey);
    if (cached) {
      console.log('✅ 캐시된 통계 사용 (Firebase 읽기 없음)');
      renderQuestionStatsHTML(cached, container);
      return;
    }

    // 전체 데이터 조회 경고
    if (year === 'all' && subject === 'all') {
      console.warn('⚠️ 전체 데이터 조회 - Firebase 읽기 비용이 많이 발생할 수 있습니다!');
      container.innerHTML = `
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <h3 style="color: #ff9800; margin-top: 0;">⚠️ 주의</h3>
          <p style="margin-bottom: 10px;">전체 데이터를 조회하면 많은 Firebase 읽기 비용이 발생합니다.</p>
          <p style="margin-bottom: 10px;"><strong>권장:</strong> 연도 또는 과목을 선택해주세요.</p>
          <button onclick="document.getElementById('year-filter').value='2025'; document.getElementById('load-admin-stats').click();" 
                  style="padding: 10px 20px; background: var(--penguin-navy); color: white; border: none; border-radius: 6px; cursor: pointer;">
            2025년 데이터만 보기
          </button>
        </div>
      `;
      return;
    }

    // Firestore 쿼리 최적화
    let attemptsQuery = collection(db, 'attempts');

    // ⚠️ 임시: 마이그레이션 전까지는 전체 읽기
    // TODO: 마이그레이션 후 where 쿼리 활성화
    console.log('⚠️ 전체 데이터 읽기 (마이그레이션 후 최적화됩니다)');

    const snapshot = await getDocs(attemptsQuery);

    let attempts = [];
    snapshot.forEach(doc => {
      attempts.push({ id: doc.id, ...doc.data() });
    });

    // 클라이언트 사이드 필터링 (Firestore 복합 인덱스 없이)
    if (year && year !== 'all') {
      attempts = attempts.filter(a => a.questionData?.year === year);
    }
    if (subject && subject !== 'all') {
      attempts = attempts.filter(a => a.questionData?.subject === subject);
    }

    // ✅ 관리자 데이터 필터링
    const includeAdminData = document.getElementById('include-admin-data')?.checked;
    if (!includeAdminData) {
      const beforeCount = attempts.length;
      attempts = attempts.filter(a => !ADMIN_EMAILS.includes(a.userEmail));
      console.log(`✅ 관리자 데이터 제외됨 (${beforeCount - attempts.length}개 제외)`);
    } else {
      console.log('✅ 관리자 데이터 포함');
    }

    // 관리자 통계는 항상 일반 + 모의고사 통합 집계
    console.log('✅ 전체 세트 (일반 + 모의고사 통합)');

    console.log(`📊 Firebase reads: ${snapshot.size}개 (필터링 후: ${attempts.length}개)`)

    // 문제별 통계 계산
    const questionStats = calculateQuestionStats(attempts);

    // 캐시 저장
    const statsData = {
      questionStats,
      attempts,
      totalQuestions: Object.keys(questionStats).length,
      totalAttempts: attempts.length
    };
    StatsCache.set(cacheKey, statsData);

    // HTML 렌더링
    renderQuestionStatsHTML(statsData, container);

  } catch (error) {
    console.error('문제별 통계 로드 오류:', error);
    const currentUser = auth?.currentUser || null;
    const projectId = db?.app?.options?.projectId
      || window.firebaseApp?.options?.projectId
      || 'unknown';
    const isPermissionDenied = error?.code === 'permission-denied';

    if (isPermissionDenied) {
      container.innerHTML = `
        <div style="padding: 20px; border: 1px solid rgba(220,38,38,.25); background: rgba(220,38,38,.05); border-radius: 12px;">
          <div style="font-size: 18px; font-weight: 700; color: #991b1b; margin-bottom: 10px;">⚠️ 관리자 통계 권한 없음</div>
          <div style="font-size: 14px; color: #374151; line-height: 1.6;">
            Firestore에서 <code>attempts</code> 전체 조회 권한이 거부되었습니다.<br />
            아래 항목을 확인해주세요.
          </div>
          <ul style="margin: 12px 0 0 18px; color: #374151; font-size: 13px; line-height: 1.6;">
            <li>로그인 이메일이 관리자 계정인지 확인</li>
            <li>규칙이 <code>${projectId}</code> 프로젝트에 배포되었는지 확인</li>
            <li><code>admins/${currentUser?.uid || 'YOUR_UID'}</code> 문서 존재 여부 확인</li>
            <li>로그아웃/로그인으로 토큰 갱신 후 재시도</li>
          </ul>
          <div style="margin-top: 12px; padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #4b5563;">
            debug: projectId=<b>${projectId}</b>, email=<b>${currentUser?.email || 'null'}</b>, uid=<b>${currentUser?.uid || 'null'}</b>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #f44336;">
        <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
        <div style="font-size: 18px; font-weight: 600;">통계를 불러오는 중 오류가 발생했습니다.</div>
        <div style="font-size: 14px; color: #666; margin-top: 8px;">${error.message}</div>
      </div>
    `;
  }
}

/**
 * 통계 데이터 HTML 렌더링
 * @param {Object} data - 통계 데이터
 * @param {HTMLElement} container - 컨테이너
 */
function renderQuestionStatsHTML(data, container) {
  const { questionStats, attempts, totalQuestions, totalAttempts } = data;

  const totalUsers = new Set(attempts.map(a => a.userId)).size;

  const avgAccuracy = totalQuestions > 0 ? Object.values(questionStats).reduce((sum, stat) => {
    return sum + (stat.correct / stat.total * 100);
  }, 0) / totalQuestions : 0;

  const hardQuestions = Object.values(questionStats).filter(s => (s.correct / s.total * 100) < 50).length;

  // HTML 렌더링
  let html = `
    <div class="stats-section" style="margin-bottom: 30px;">
      <h3>요약 통계</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-top: 15px;">
        <div style="text-align: center; padding: 20px; background: #e3f2fd; border-radius: 8px;">
          <div style="font-size: 32px; font-weight: bold; color: var(--penguin-skyblue);">${totalQuestions}</div>
          <div style="color: #666; margin-top: 8px; font-size: 14px;">분석된 문제 수</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #e8f5e9; border-radius: 8px;">
          <div style="font-size: 32px; font-weight: bold; color: #4caf50;">${totalUsers}</div>
          <div style="color: #666; margin-top: 8px; font-size: 14px;">참여 사용자 수</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #fff3e0; border-radius: 8px;">
          <div style="font-size: 32px; font-weight: bold; color: #ff9800;">${totalAttempts}</div>
          <div style="color: #666; margin-top: 8px; font-size: 14px;">총 풀이 횟수</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f3e5f5; border-radius: 8px;">
          <div style="font-size: 32px; font-weight: bold; color: #9c27b0;">${avgAccuracy.toFixed(1)}%</div>
          <div style="color: #666; margin-top: 8px; font-size: 14px;">평균 정답률</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #ffebee; border-radius: 8px;">
          <div style="font-size: 32px; font-weight: bold; color: #f44336;">${hardQuestions}</div>
          <div style="color: #666; margin-top: 8px; font-size: 14px;">고난도 문제 (50% 미만)</div>
        </div>
      </div>
    </div>
    
    <div class="stats-section">
      <h3>문제별 상세 통계</h3>
  `;

  if (totalQuestions === 0) {
    html += '<p style="text-align: center; color: #666; padding: 40px;">해당 조건의 데이터가 없습니다.</p>';
  } else {
    const statsArray = Object.entries(questionStats);

    // 정렬 옵션 가져오기
    const sortOption = document.getElementById('admin-sort-filter')?.value
      || document.getElementById('sort-filter')?.value
      || 'number';

    // 정렬 함수
    const sortStats = (stats) => {
      if (sortOption === 'accuracy') {
        // 정답률순 정렬 (높은 것부터)
        return stats.sort((a, b) => {
          const accuracyA = a[1].correct / a[1].total;
          const accuracyB = b[1].correct / b[1].total;
          return accuracyB - accuracyA; // 높은 정답률부터 (내림차순)
        });
      } else if (sortOption === 'hardest') {
        // 어려운 순 정렬 (정답률 낮은 순)
        return stats.sort((a, b) => {
          const accuracyA = a[1].correct / a[1].total;
          const accuracyB = b[1].correct / b[1].total;
          if (accuracyA !== accuracyB) return accuracyA - accuracyB;
          return b[1].total - a[1].total; // 동률이면 표본 큰 순
        });
      } else {
        // 기본: 문제 번호순 정렬
        return stats.sort((a, b) => {
          if (a[1].year !== b[1].year) {
            return a[1].year - b[1].year;
          }
          if (a[1].subject !== b[1].subject) {
            return a[1].subject.localeCompare(b[1].subject);
          }
          return a[1].number - b[1].number;
        });
      }
    };

    const sortedStats = sortStats([...statsArray]);

    // 과목명 디코딩 함수
    const decodeSubjectName = (subject) => {
      let decoded = subject;
      try {
        for (let i = 0; i < 3; i++) {
          const temp = decodeURIComponent(decoded);
          if (temp === decoded) break;
          decoded = temp;
        }
      } catch (e) {
        console.warn('과목명 디코딩 실패:', subject);
      }
      return decoded;
    };

    // ✅ 디코딩된 과목명으로 그룹화 (일반/모의고사 구분 없이)
    const subjectGroups = {};
    sortedStats.forEach(([key, stat]) => {
      const decodedSubject = decodeSubjectName(stat.subject);
      if (!subjectGroups[decodedSubject]) {
        subjectGroups[decodedSubject] = [];
      }
      subjectGroups[decodedSubject].push([key, stat]);
    });

    // 과목명 정렬
    const sortedSubjects = Object.keys(subjectGroups).sort();

    html += `
      <div style="margin-top: 20px;">
        <div style="background: linear-gradient(135deg, #1d2f4e 0%, #0D5C80 100%); color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: white;">📊 문제별 통계</h3>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.95; color: white;">일반 문제 + 모의고사 통합 통계 (${sortedStats.length}개)</p>
          </div>
          <div style="display: flex; align-items: center; gap: 15px;">
            <select id="subject-filter-regular" style="background: white; color: #1d2f4e; padding: 8px 12px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; font-size: 14px;">
              <option value="all">전체 과목</option>
              ${sortedSubjects.map(subject =>
      `<option value="${subject}">${subject} (${subjectGroups[subject].length})</option>`
    ).join('')}
            </select>
            <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 16px; color: white;">
              ${sortedStats.length}
            </div>
          </div>
        </div>
    `;

    // 과목별로 렌더링
    sortedSubjects.forEach(decodedSubject => {
      const stats = subjectGroups[decodedSubject];
      html += `
        <div class="subject-group-regular" data-subject="${decodedSubject}" style="margin-bottom: 35px;">
          <h3 style="color: var(--penguin-navy); font-size: 1.5rem; font-weight: 700; margin-bottom: 18px; padding: 12px 16px; border-left: 6px solid var(--penguin-skyblue); background: linear-gradient(135deg, #f8f9fa 0%, #e8ecf1 100%); border-radius: 8px;">
            ${decodedSubject} <span style="color: #666; font-weight: 600; font-size: 1.1rem;">(${stats.length}문제)</span>
          </h3>
          <div class="question-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
            ${stats.map(([key, stat]) => renderQuestionCard(stat)).join('')}
          </div>
        </div>
      `;
    });

    html += `
      </div>
    `;

    // ✅ 반응형 CSS 추가
    html += `
      <style>
        @media (max-width: 1200px) {
          .question-stats-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .question-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .question-stats-grid {
            grid-template-columns: repeat(1, 1fr) !important;
          }
        }
      </style>
    `;
  }

  html += '</div>';

  container.innerHTML = html;

  // ✅ 과목 필터 이벤트 리스너 추가
  const subjectFilterRegular = document.getElementById('subject-filter-regular');
  if (subjectFilterRegular) {
    subjectFilterRegular.addEventListener('change', (e) => {
      const selectedSubject = e.target.value;
      const subjectGroups = document.querySelectorAll('.subject-group-regular');

      subjectGroups.forEach(group => {
        if (selectedSubject === 'all') {
          group.style.display = 'block';
        } else {
          if (group.dataset.subject === selectedSubject) {
            group.style.display = 'block';
          } else {
            group.style.display = 'none';
          }
        }
      });
    });
  }
}

/**
 * 문제 카드 렌더링 함수
 * @param {Object} stat - 문제 통계 객체
 * @returns {string} HTML 문자열
 */
function renderQuestionCard(stat) {
  const accuracy = (stat.correct / stat.total * 100).toFixed(1);
  let difficulty = 'medium';
  let difficultyText = '보통';
  let color = '#ff9800';

  if (accuracy >= 80) {
    difficulty = 'easy';
    difficultyText = '쉬움';
    color = '#4caf50';
  } else if (accuracy < 50) {
    difficulty = 'hard';
    difficultyText = '어려움';
    color = '#f44336';
  }

  // ✅ 일반+모의고사 통합 표시
  const typeBadge = stat.fromBothTypes
    ? '<span style="background: linear-gradient(135deg, var(--penguin-skyblue), #e91e63); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">통합</span>'
    : stat.isFromMockExam
      ? '<span style="background: #e91e63; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">모의</span>'
      : '<span style="background: var(--penguin-skyblue); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">일반</span>';

  // ✅ 과목명 URL 디코딩
  let decodedSubject = stat.subject;
  try {
    for (let i = 0; i < 3; i++) {
      const temp = decodeURIComponent(decodedSubject);
      if (temp === decodedSubject) break;
      decodedSubject = temp;
    }
  } catch (e) {
    console.warn('과목명 디코딩 실패:', stat.subject);
  }

  // 문제 페이지 URL 생성
  const questionUrl = stat.isFromMockExam
    ? `../exam/${stat.year}_모의고사_${stat.mockExamPart || '1'}교시.html?question=${stat.number}`
    : `../exam/${stat.year}_${decodedSubject}.html?question=${stat.number}`;
  const mostWrongOption = getMostSelectedWrongOption(stat);

  return `
    <div onclick="window.open('${questionUrl}', '_blank')" style="background: #fff; border: 2px solid ${color}; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)';">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="font-weight: 600; color: var(--penguin-navy); font-size: 12px; line-height: 1.3; flex: 1;">
          ${stat.year} ${decodedSubject}
        </div>
        ${typeBadge}
      </div>
      
      <div style="font-size: 28px; font-weight: bold; color: ${color}; margin: 8px 0; text-align: center;">
        ${stat.number}
      </div>
      
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="background: ${color}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block;">
          ${difficultyText}
        </div>
      </div>
      
      <div style="font-size: 12px; color: #666; text-align: center; line-height: 1.6;">
        <div style="margin-bottom: 4px;"><span style="font-weight: 600;">응시</span> ${stat.total}명</div>
        <div style="color: ${color}; font-weight: bold; font-size: 14px; line-height: 1.5;">
          정답 ${stat.correct}명 <span style="color: #94a3b8; font-weight: 500;">(정답률 ${accuracy}%)</span>
        </div>
      </div>
      <div style="margin-top: 6px; text-align: center; font-size: 11px; color: #475569;">
        ${mostWrongOption
      ? `최다 오답: <strong style="color: #b91c1c;">${mostWrongOption.option}번</strong> (${mostWrongOption.rate}%, ${mostWrongOption.count}명)`
      : '최다 오답: 데이터 부족'}
      </div>
      
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e0e0e0;">
        <div style="font-weight: 600; margin-bottom: 5px; font-size: 10px; color: #999; text-align: center;">답안 선택률</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px;">
        ${[0, 1, 2, 3].map(i => {
    const count = stat.answers[i] || 0;
    const percentage = stat.total > 0 ? (count / stat.total * 100).toFixed(0) : 0;
    return `
            <div style="padding: 3px 5px; background: #f8f9fa; border-radius: 3px; border: 1px solid #e0e0e0;">
              <div style="font-size: 9px; color: #666; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">${i + 1}</span>
                <span>${percentage}%</span>
              </div>
            </div>
          `;
  }).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * 문제별 통계 계산
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Object} 문제별 통계 객체
 */
function calculateQuestionStats(attempts) {
  const stats = {};

  attempts.forEach(attempt => {
    const qData = attempt.questionData;
    if (!qData) return;

    // ✅ 일반/모의고사 구분 없이 통합 통계 (같은 문제는 하나로)
    const key = `${qData.year}_${qData.subject}_${qData.number}`;

    if (!stats[key]) {
      stats[key] = {
        year: qData.year,
        subject: qData.subject,
        number: qData.number,
        isFromMockExam: qData.isFromMockExam || false,
        fromBothTypes: false, // 일반+모의고사 둘 다 있는지 추적
        total: 0,
        correct: 0,
        answers: { 0: 0, 1: 0, 2: 0, 3: 0 },
        correctVotes: { 0: 0, 1: 0, 2: 0, 3: 0 },
        correctAnswerIndex: null
      };
    }

    // 일반/모의고사 둘 다에서 나온 문제인지 체크
    if (stats[key].isFromMockExam !== qData.isFromMockExam) {
      stats[key].fromBothTypes = true;
    }

    // ✅ 첫 시도 답변 우선 사용 (통계 정확성을 위해)
    // 첫 시도 답변이 있으면 첫 시도 답변 사용, 없으면 기존 답변 사용 (하위 호환성)
    const isCorrect = attempt.firstAttemptIsCorrect !== undefined
      ? attempt.firstAttemptIsCorrect
      : attempt.isCorrect;
    const userAnswer = attempt.firstAttemptAnswer !== undefined
      ? attempt.firstAttemptAnswer
      : attempt.userAnswer;
    const answerIndex = Number(userAnswer);
    const correctAnswerIndex = extractCorrectAnswerIndex(attempt);

    stats[key].total++;
    if (isCorrect) {
      stats[key].correct++;
    }

    // 답안 선택 집계 (첫 시도 답변 사용)
    if (Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 3) {
      stats[key].answers[answerIndex]++;
      if (isCorrect) {
        stats[key].correctVotes[answerIndex]++;
      }
    }

    // 명시된 정답 인덱스가 있으면 우선 반영
    if (Number.isInteger(correctAnswerIndex) && correctAnswerIndex >= 0 && correctAnswerIndex <= 3) {
      stats[key].correctAnswerIndex = correctAnswerIndex;
    }
  });

  // 정답 정보가 없는 레거시 데이터는 정답으로 선택된 답안을 기반으로 추론
  Object.values(stats).forEach((stat) => {
    if (Number.isInteger(stat.correctAnswerIndex)) return;
    let inferredIndex = null;
    let maxVotes = 0;
    [0, 1, 2, 3].forEach((idx) => {
      const votes = stat.correctVotes[idx] || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        inferredIndex = idx;
      }
    });
    stat.correctAnswerIndex = maxVotes > 0 ? inferredIndex : null;
  });

  return stats;
}

function extractCorrectAnswerIndex(attempt) {
  const candidates = [
    attempt?.correctAnswer,
    attempt?.firstAttemptCorrectAnswer,
    attempt?.questionData?.correctAnswer,
    attempt?.questionData?.correctOption,
    attempt?.questionData?.correct
  ];

  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (value >= 0 && value <= 3) return Math.trunc(value);
    if (value >= 1 && value <= 4) return Math.trunc(value) - 1;
  }

  return null;
}

function getMostSelectedWrongOption(stat) {
  if (!stat || !stat.answers || stat.total <= 0) return null;
  const correctIndex = Number.isInteger(stat.correctAnswerIndex) ? stat.correctAnswerIndex : null;
  if (correctIndex === null) return null;

  let bestIndex = null;
  let bestCount = -1;

  [0, 1, 2, 3].forEach((idx) => {
    if (idx === correctIndex) return;
    const count = stat.answers[idx] || 0;
    if (count > bestCount) {
      bestCount = count;
      bestIndex = idx;
    }
  });

  if (bestIndex === null || bestCount <= 0) return null;
  return {
    option: bestIndex + 1,
    count: bestCount,
    rate: ((bestCount / stat.total) * 100).toFixed(0)
  };
}

/**
 * anonymous 세션 통계 로드 함수
 * @param {HTMLElement} container - 통계를 표시할 컨테이너
 */
async function loadAnonymousSessionStats(container) {
  try {
    // 컨테이너에 로딩 표시
    container.innerHTML = '<div class="loading-indicator">Anonymous 세션 통계 로드 중...</div>';

    // 세션당 시도 횟수 가져오기
    const sessionCounts = {};

    // 시도 기록 개수 계산
    if (window.attemptsBySession) {
      Object.keys(window.attemptsBySession).forEach(sessionId => {
        if (sessionId.includes('anonymous')) {
          sessionCounts[sessionId] = window.attemptsBySession[sessionId].length;
        }
      });
    }

    // 표시할 HTML 생성
    let html = `
      <div class="admin-card">
        <h3>Anonymous 세션 통계</h3>
        <div class="anonymous-sessions-stats">
          <p>총 ${Object.keys(sessionCounts).length}개의 anonymous 세션이 발견되었습니다.</p>
          <div class="anonymous-session-list">
    `;

    if (Object.keys(sessionCounts).length > 0) {
      html += '<table class="admin-table">';
      html += `
        <thead>
          <tr>
            <th>세션 ID</th>
            <th>시도 기록 수</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
      `;

      Object.keys(sessionCounts).sort().forEach(sessionId => {
        html += `
          <tr>
            <td>${sessionId}</td>
            <td>${sessionCounts[sessionId]}</td>
            <td>
              <button class="delete-session-btn" data-session="${sessionId}">삭제</button>
              <button class="migrate-session-btn" data-session="${sessionId}">마이그레이션</button>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';

      // 전체 관리 버튼
      html += `
        <div class="bulk-actions" style="margin-top: 20px;">
          <button id="delete-all-anonymous" class="danger-button">모든 Anonymous 세션 삭제</button>
          <button id="migrate-all-anonymous" class="primary-button">모든 Anonymous 세션 마이그레이션</button>
        </div>
      `;
    } else {
      html += '<p>Anonymous 세션이 없습니다.</p>';
    }

    html += `
          </div>
        </div>
      </div>
    `;

    // HTML 업데이트
    container.innerHTML = html;

    // 이벤트 리스너 등록
    const deleteButtons = container.querySelectorAll('.delete-session-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const sessionId = this.dataset.session;
        if (confirm(`세션 ${sessionId}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
          deleteSession(sessionId);
        }
      });
    });

    const migrateButtons = container.querySelectorAll('.migrate-session-btn');
    migrateButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const sessionId = this.dataset.session;
        if (confirm(`세션 ${sessionId}를 현재 사용자 세션으로 마이그레이션하시겠습니까?`)) {
          migrateAnonymousSession(sessionId);
        }
      });
    });

    // 전체 삭제 버튼
    const deleteAllBtn = document.getElementById('delete-all-anonymous');
    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', function () {
        if (confirm('모든 anonymous 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
          deleteAnonymousSessions();
        }
      });
    }

    // 전체 마이그레이션 버튼
    const migrateAllBtn = document.getElementById('migrate-all-anonymous');
    if (migrateAllBtn) {
      migrateAllBtn.addEventListener('click', function () {
        if (confirm('모든 anonymous 세션을 현재 사용자 세션으로 마이그레이션하시겠습니까?')) {
          migrateAnonymousSessions();
        }
      });
    }
  } catch (error) {
    console.error('Anonymous 세션 통계 로드 오류:', error);
    container.innerHTML = `<div class="error-message">통계 로드 중 오류가 발생했습니다: ${error.message}</div>`;
  }
}

/**
 * 단일 anonymous 세션 마이그레이션 함수
 * @param {string} sessionId - 마이그레이션할 세션 ID
 */
async function migrateAnonymousSession(sessionId) {
  try {
    if (!sessionId || !sessionId.includes('anonymous')) {
      showToast('유효하지 않은 anonymous 세션입니다.', 'error');
      return false;
    }

    showLoading(`세션 ${sessionId} 마이그레이션 중...`);

    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      showToast('마이그레이션하려면 로그인이 필요합니다.', 'error');
      hideLoading();
      return false;
    }

    // Firebase에서 세션 시도 기록 찾기
    const attemptsRef = collection(db, "attempts");
    const attemptsQuery = query(
      attemptsRef,
      where("sessionId", "==", sessionId)
    );

    const attemptsSnapshot = await getDocs(attemptsQuery);
    if (attemptsSnapshot.empty) {
      showToast('마이그레이션할 시도 기록이 없습니다.', 'info');
      hideLoading();
      return false;
    }

    console.log(`${attemptsSnapshot.size}개의 시도 기록을 마이그레이션합니다.`);

    // 새 세션 ID 생성 (날짜_시간_사용자ID)
    const sessionParts = sessionId.split('_');
    const newSessionId = `${sessionParts[0]}_${sessionParts[1]}_${user.uid.substring(0, 6)}`;

    // 배치 처리를 위한 준비
    const batch = writeBatch(db);
    let updatedCount = 0;

    // 각 시도 기록에 대해 사용자 ID와 새 세션 ID 설정
    attemptsSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        userId: user.uid,
        sessionId: newSessionId
      });
      updatedCount++;
    });

    // 배치 커밋
    await batch.commit();

    console.log(`마이그레이션 완료: ${updatedCount}개 문서 업데이트됨`);
    showToast(`${updatedCount}개의 시도 기록이 마이그레이션되었습니다.`, 'success');

    // 세션 문서 생성 (필요한 경우)
    try {
      const sessionDoc = doc(db, "sessions", newSessionId);
      await setDoc(sessionDoc, {
        userId: user.uid,
        startTime: serverTimestamp(),
        migratedFrom: sessionId
      });
      console.log(`새 세션 문서 생성됨: ${newSessionId}`);
    } catch (sessionError) {
      console.warn('세션 문서 생성 실패:', sessionError);
    }

    hideLoading();

    // 데이터 새로고침
    if (typeof refreshDataIfNeeded === 'function') {
      refreshDataIfNeeded(true);
    }

    return true;
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    showToast(`마이그레이션 중 오류가 발생했습니다: ${error.message}`, 'error');
    hideLoading();
    return false;
  }
}

/**
 * 퀴즈 초기화 함수
 */
async function initializeQuiz() {
  try {
    console.log('퀴즈 초기화 시작');

    // 세션 초기화 추가
    try {
      // 세션 매니저가 있는지 확인
      if (window.sessionManager) {
        console.log('세션 매니저로 세션 초기화');

        // 명시적으로 새 세션 시작
        const session = await window.sessionManager.startNewSession();
        console.log('새 세션이 시작되었습니다:', session.id);
      }
    } catch (error) {
      console.error('세션 초기화 오류:', error);
      // 세션 초기화 실패는 치명적 오류가 아니므로 계속 진행
    }

    // 기존 퀴즈 초기화 코드 계속...
    // ...
  } catch (error) {
    console.error('퀴즈 초기화 오류:', error);
    showToast('퀴즈 초기화 중 오류가 발생했습니다.');
  }
}

/**
 * 퀴즈 제출 함수
 */
async function submitQuiz() {
  try {
    // 타이머 중지
    clearInterval(timerInterval);

    // ... 기존 제출 코드 ...

    // 결과 저장 전에 세션 종료 추가
    try {
      if (window.sessionManager) {
        // 세션 통계 정보 준비
        const sessionStats = {
          totalQuestions: questions.length,
          attemptedQuestions: questions.length,
          correctAnswers: correctAnswers,
          accuracy: Math.round((correctAnswers / questions.length) * 100)
        };

        // 세션 종료
        await window.sessionManager.endSession(sessionStats);
        console.log('퀴즈 세션이 종료되었습니다.');
      }
    } catch (error) {
      console.error('세션 종료 오류:', error);
    }

    // ... 나머지 제출 코드 계속 ...
  } catch (error) {
    console.error('퀴즈 제출 오류:', error);
    showToast('퀴즈 제출 중 오류가 발생했습니다.');
  }
}

// 앱 초기화 시 빈 세션 정리
document.addEventListener('DOMContentLoaded', async function () {
  try {
    // 인증 상태 확인 후 빈 세션 정리 (auth가 초기화된 경우에만)
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(async (user) => {
        if (user && window.sessionManager) {
          // 로딩 지연 후 실행 (다른 초기화가 끝난 후)
          setTimeout(async () => {
            // 30분 이상 지난 빈 세션 정리
            const cleanedCount = await window.sessionManager.cleanupEmptySessions(30);
            if (cleanedCount > 0) {
              console.log(`${cleanedCount}개의 빈 세션이 정리되었습니다.`);
            }
          }, 5000);
        }
      });
    }
  } catch (error) {
    console.error('세션 정리 오류:', error);
  }
});

// 문서 로드 시 대시보드 초기화 및 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
  // 대시보드 초기화
  initDashboard();

  // 인증 상태 확인 및 데이터 로드 (auth가 초기화된 경우에만)
  if (auth && auth.currentUser) {
    loadAnalyticsData(auth.currentUser);
  }
});

// 인증 상태 변경 시 데이터 로드 (auth가 초기화된 경우에만)
if (auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged((user) => {
    console.log('인증 상태 변경:', user ? '로그인됨' : '로그아웃됨');

    if (user) {
      // 로그인 상태이면 데이터 로드
      loadAnalyticsData(user);

      // 로그인 필요 오버레이 숨기기 (공통 UI 활용)
      const overlay = document.querySelector('.restricted-content-overlay');
      if (overlay) overlay.style.display = 'none';

      // 학습분석 탭의 로그인 오버레이 숨기기
      const analyticsOverlay = document.getElementById('analytics-login-overlay');
      if (analyticsOverlay) {
        analyticsOverlay.style.display = 'none';
      }
    } else {
      // 로그아웃 상태이면 로그인 필요 오버레이만 표시 (기존 HTML 구조 유지)
      const overlay = document.getElementById('analytics-login-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
      }
    }
  });
}

// 빈 상태 처리 함수 (ReferenceError 해결)
function handleEmptySessionsCase(container, typeFilter, subjectFilter, yearFilter) {
  renderEmptyStateMessage(container, typeFilter, subjectFilter, yearFilter);
}

// 빈 상태 메시지 렌더링 함수
function renderEmptyStateMessage(container, typeFilter, subjectFilter, yearFilter) {
  container.innerHTML = `
    <div class="no-data">
      <p>세션 데이터가 없습니다.</p>
      <p class="sub-text">
        ${typeFilter !== 'all' ? `유형: ${typeFilter}` : ''}
        ${subjectFilter !== 'all' ? `, 과목: ${subjectFilter}` : ''}
        ${yearFilter !== 'all' ? `, 년도: ${yearFilter}` : ''}
      </p>
    </div>
  `;
}

// 로드 오류 처리 함수
function handleLoadError(container, error) {
  container.innerHTML = `
    <div class="error-message">
      <p>데이터 로드 중 오류가 발생했습니다.</p>
      <p class="error-details">${error.message}</p>
      <button onclick="retryLoad()" class="retry-btn">다시 시도</button>
    </div>
  `;
}

/**
 * 세션 카드 스타일 상수
 */
const CARD_STYLES = {
  colors: {
    mockexam: '#2e7d32',   // 초록색 (모의고사용)
    subject: '#ffb74d',    // 노란색 (과목별 학습용)
    regular: '#ffb74d',    // 노란색 (기본 학습용, 과목별과 동일)
    text: {
      primary: '#333',
      secondary: '#666',
    },
    score: {
      high: '#2E7D32',
      medium: '#ef6c00',
      low: '#c62828'
    }
  },
  shadows: {
    default: '0 4px 8px rgba(0, 0, 0, 0.06)',
    hover: '0 8px 16px rgba(0, 0, 0, 0.08)'
  }
};

/**
 * 버튼 스타일 생성 함수
 */
function createButtonStyle(baseColor, hoverColor) {
  return {
    base: `
      padding: 8px 12px;
      background-color: ${baseColor};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s;
      box-shadow: 0 2px 4px ${baseColor}4D;
      flex: 1;
    `,
    hover: `
      background-color: ${hoverColor};
      box-shadow: 0 4px 8px ${baseColor}66;
    `
  };
}

/**
 * 세션 카드 요소 생성 함수 - 세로형 디자인
 * 
 * 세션 데이터로부터 시각적 카드 요소를 생성합니다.
 * @param {Object} card - 세션 카드 데이터
 * @returns {HTMLElement} - 생성된 카드 요소
 */
function createCardElement(card) {
  const cardElement = document.createElement('div');
  cardElement.className = 'session-card';
  cardElement.id = `card-${card.id}`;
  cardElement.dataset.id = card.id;
  cardElement.dataset.type = card.type || 'regular';
  cardElement.setAttribute('role', 'article');
  cardElement.setAttribute('aria-label', `${card.title || '문제풀이기록'} 세션 카드`);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isSmallMobile = window.matchMedia('(max-width: 480px)').matches;
  const useMobileCompact = isMobile;
  const layout = {
    padding: isSmallMobile ? 10 : isMobile ? 12 : 12,
    height: isMobile ? 'auto' : '320px',
    minHeight: isSmallMobile ? '210px' : isMobile ? '240px' : '320px',
    titleSize: isSmallMobile ? 11 : 12,
    titleWrap: isMobile ? 'normal' : 'nowrap',
    mainScoreSize: isSmallMobile ? 22 : isMobile ? 24 : 28,
    subScoreSize: isSmallMobile ? 14 : isMobile ? 16 : 18,
    miniSubjectsColumns: isSmallMobile ? '1fr' : 'repeat(2, 1fr)',
    miniSubjectsGap: isSmallMobile ? '4px' : '6px',
    miniSubjectsMaxHeight: isSmallMobile ? 60 : isMobile ? 72 : 80,
    pillFont: isSmallMobile ? 11 : 12,
    dateFont: isSmallMobile ? 10 : 11,
    dateWrap: isMobile ? 'normal' : 'nowrap',
    buttonPadding: isSmallMobile ? 7 : 8,
    buttonFont: isSmallMobile ? 11 : 12,
    badgeFont: isSmallMobile ? 9 : 10,
    bottomGap: isSmallMobile ? '5px' : '6px'
  };

  // 점수와 색상 계산 (카드는 중립, 낮은 점수만 텍스트에 색상 적용)
  const correctCount = card.correctCount || Math.round(card.score * card.completed / 100);
  const accuracy = Math.round((correctCount / card.total) * 100);
  let scoreTextColor = '#1f2937'; // 기본 중립 텍스트 색상
  if (accuracy < 50) {
    scoreTextColor = '#e11d48'; // 낮은 점수: 텍스트만 강조 (rose)
  }

  // 포인트 환산 (문제당 5점)
  const isMock = card.type === 'mockexam';
  const totalPoints = (card.total || 0) * 5;
  const points = correctCount * 5;
  const mainScoreHTML = isMock
    ? `<div style="font-size: ${layout.mainScoreSize}px; font-weight: bold; color: ${scoreTextColor}; margin: 6px 0; text-align: center; line-height: 1.2; overflow: hidden; flex-shrink: 0;">${points}<span style=\"font-size: ${layout.subScoreSize}px; color: #999;\">/${totalPoints || 400}</span></div>`
    : `<div style="font-size: ${layout.mainScoreSize}px; font-weight: bold; color: ${scoreTextColor}; margin: 6px 0; text-align: center; line-height: 1.2; overflow: hidden; flex-shrink: 0;">${points}<span style=\"font-size: ${layout.subScoreSize}px; color: #999;\">/${totalPoints || 100}</span></div>`;

  // 모의고사: 과목별 소형 점수(각 100점 만점) 표시
  let miniSubjectsHTML = '';
  if (isMock) {
    const subjectStats = {};
    (card.attempts || []).forEach(attempt => {
      const subj = attempt?.questionData?.subject;
      if (!subj) return;
      if (!subjectStats[subj]) subjectStats[subj] = { total: 0, correct: 0 };
      subjectStats[subj].total += 1;
      if (attempt.isCorrect) subjectStats[subj].correct += 1;
    });
    const entries = Object.entries(subjectStats).slice(0, 4);
    if (entries.length > 0) {
      miniSubjectsHTML = `<div style="display: grid; grid-template-columns: ${layout.miniSubjectsColumns}; gap: ${layout.miniSubjectsGap}; margin: 4px 0 8px; max-height: ${layout.miniSubjectsMaxHeight}px; overflow: hidden;">` +
        entries.map(([name, s]) => {
          // URL 인코딩된 텍스트 디코딩
          let decodedName = name;
          try {
            // URL 인코딩된 경우 디코딩 시도
            if (name.includes('%')) {
              decodedName = decodeURIComponent(name);
            }
          } catch (e) {
            // 디코딩 실패 시 원본 사용
            decodedName = name;
          }
          const subjPoints = (s.correct || 0) * 5;
          const subjTotal = (s.total || 20) * 5; // 기본 100점 기준
          const subjAcc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          const subjColor = subjAcc < 50 ? '#e11d48' : '#1f2937';
          return `<div style='font-size:11px; display:flex; justify-content:space-between; color:#374151; gap: 4px; min-height: 18px;'>` +
            `<span style='overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex: 1; min-width: 0;'>${decodedName}</span>` +
            `<span style='font-weight:700; color:${subjColor}; flex-shrink: 0;'>${subjPoints}/${subjTotal}</span>` +
            `</div>`;
        }).join('') + `</div>`;
    }
  }

  const miniSubjectsSection = (!isMobile && miniSubjectsHTML)
    ? `<div style="flex: 1; min-height: 0; overflow: hidden;">${miniSubjectsHTML}</div>`
    : '';

  const buttonSectionHTML = `
    <div style="
      margin-top: ${useMobileCompact ? '0' : 'auto'};
      padding-top: 8px;
      border-top: 1px dashed #e0e0e0;
      display: ${isMobile ? 'grid' : 'flex'};
      ${isMobile ? 'grid-template-columns: repeat(2, minmax(0, 1fr));' : 'flex-direction: column;'}
      gap: ${isMobile ? (isSmallMobile ? '6px' : '8px') : layout.bottomGap};
      flex-shrink: 0;
    ">
      ${card.canResume ? `
        <button class="resume-btn" data-card-id="${card.id}" style="width: 100%; background: #10b981; color: white; border: none; padding: ${layout.buttonPadding}px; border-radius: 8px; font-size: ${layout.buttonFont}px; font-weight: 600; cursor: pointer; transition: all 0.3s; flex-shrink: 0; box-sizing: border-box;">
          ▶ 이어서 풀기
        </button>
      ` : `
        <button class="completed-btn" disabled style="width: 100%; background: #e5e7eb; color: #9ca3af; border: none; padding: ${layout.buttonPadding}px; border-radius: 8px; font-size: ${layout.buttonFont}px; font-weight: 500; cursor: not-allowed; flex-shrink: 0; box-sizing: border-box; opacity: 0.7;">
          ✓ 문제풀이완료
        </button>
      `}
      <button class="scorecard-btn" data-card-id="${card.id}" style="width: 100%; background: #8ab5c6; color: white; border: none; padding: ${layout.buttonPadding}px; border-radius: 8px; font-size: ${layout.buttonFont}px; font-weight: 600; cursor: pointer; transition: all 0.3s; flex-shrink: 0; box-sizing: border-box;">
        📊 정오표 보기
      </button>
    </div>
  `;

  // 모의고사 카드는 초록색 테두리 추가
  const borderColor = isMock ? CARD_STYLES.colors.mockexam : '#e5e7eb';
  const borderWidth = isMock ? '2px' : '1px';

  // 카드 컨테이너 스타일 - 4칸 그리드용 세로형 디자인 (고정 높이)
  cardElement.style.cssText = `
    background-color: white;
    border-radius: 8px;
    padding: ${layout.padding}px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: ${borderWidth} solid ${borderColor};
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: ${useMobileCompact ? 'row' : 'column'};
    align-items: ${useMobileCompact ? 'stretch' : 'flex-start'};
    gap: ${useMobileCompact ? '10px' : '0'};
    height: ${useMobileCompact ? 'auto' : layout.height};
    min-height: ${useMobileCompact ? '160px' : layout.minHeight};
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  `;

  // 호버 효과
  cardElement.addEventListener('mouseenter', () => {
    cardElement.style.transform = 'translateY(-3px)';
    cardElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  });
  cardElement.addEventListener('mouseleave', () => {
    cardElement.style.transform = 'translateY(0)';
    cardElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
  });

  // 카드 제목 URL 디코딩
  let decodedTitle = card.title || '문제풀이기록';
  try {
    if (decodedTitle.includes('%')) {
      decodedTitle = decodeURIComponent(decodedTitle);
    }
  } catch (e) {
    // 디코딩 실패 시 원본 사용
  }

  // 간단한 HTML 구조로 변경 (모바일은 가로형 컴팩트, 데스크톱은 세로형)
  if (useMobileCompact) {
    cardElement.innerHTML = `
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; min-width: 0;">
          <div style="font-weight: 600; color: var(--penguin-navy); font-size: ${layout.titleSize}px; line-height: 1.35; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: ${layout.titleWrap}; min-width: 0;">
            ${decodedTitle}
          </div>
          ${card.type === 'mockexam' ? `<span style="background: ${CARD_STYLES.colors.mockexam}; color: white; padding: 2px 6px; border-radius: 4px; font-size: ${layout.badgeFont}px; font-weight: bold; flex-shrink: 0;">모의고사</span>` : ''}
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div style="font-size: ${Math.max(layout.mainScoreSize - 4, 18)}px; font-weight: bold; color: ${scoreTextColor}; line-height: 1.2; overflow: hidden; flex-shrink: 0;">
            ${points}<span style="font-size: ${Math.max(layout.subScoreSize - 4, 12)}px; color: #999;">/${isMock ? (totalPoints || 400) : (totalPoints || 100)}</span>
          </div>
          <div style="background: #f3f4f6; color: #111827; padding: ${isSmallMobile ? '3px 9px' : '4px 10px'}; border-radius: 10px; font-size: ${layout.pillFont}px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e5e7eb; max-width: 100%; box-sizing: border-box;">
            <span style="color: ${scoreTextColor};">${accuracy}%</span> 정답률
          </div>
        </div>

        <div style="font-size: ${layout.dateFont}px; color: #666; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: ${layout.dateWrap};">
          <span style="font-weight: 600;">${card.displayDate || ''}</span>
        </div>
      </div>

      <div style="flex: 0 0 42%; min-width: 130px; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
        ${buttonSectionHTML}
      </div>
    `;
  } else {
    cardElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 4px; min-width: 0; flex-shrink: 0;">
        <div style="font-weight: 600; color: var(--penguin-navy); font-size: ${layout.titleSize}px; line-height: 1.35; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: ${layout.titleWrap}; min-width: 0;">
          ${decodedTitle}
        </div>
        ${card.type === 'mockexam' ? `<span style="background: ${CARD_STYLES.colors.mockexam}; color: white; padding: 2px 6px; border-radius: 4px; font-size: ${layout.badgeFont}px; font-weight: bold; flex-shrink: 0;">모의고사</span>` : ''}
      </div>
      <div style="flex-shrink: 0; margin-bottom: 4px;">
        ${mainScoreHTML}
      </div>
      ${miniSubjectsSection}
      
      <div style="text-align: center; margin-bottom: 6px; flex-shrink: 0;">
        <div style="background: #f3f4f6; color: #111827; padding: ${isSmallMobile ? '4px 10px' : '5px 12px'}; border-radius: 12px; font-size: ${layout.pillFont}px; font-weight: 600; display: inline-block; border: 1px solid #e5e7eb; max-width: 100%; box-sizing: border-box;">
          정답률 <span style="color: ${scoreTextColor};">${accuracy}%</span>
        </div>
      </div>
      
      <div style="font-size: ${layout.dateFont}px; color: #666; text-align: center; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: ${layout.dateWrap}; flex-shrink: 0; line-height: 1.4;">
        <span style="font-weight: 600;">${card.displayDate || ''}</span>
      </div>
      
      ${buttonSectionHTML}
    `;
  }

  return cardElement;
}

// 기존 함수 종료 - 아래 코드는 사용되지 않음

/*
  // 헤더 섹션 생성 (사용 안 함)
  const createHeader_OLD = () => {
    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    `;
 
    // 타입 라벨
    const typeLabel = document.createElement('span');
    typeLabel.className = 'type-label';
    typeLabel.textContent = {
      mockexam: '모의고사',
      subject: '과목별 학습',
      regular: '기본 학습'
    }[card.type] || '기본 학습';
    
    typeLabel.style.cssText = `
      padding: 5px 10px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      color: white;
      background-color: ${CARD_STYLES.colors[card.type] || CARD_STYLES.colors.regular};
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
 
    // 제목
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = card.title || '문제풀이기록';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${CARD_STYLES.colors.text.primary};
      flex-grow: 1;
      max-width: 75%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
 
    header.appendChild(title);
    header.appendChild(typeLabel);
    return header;
  };
 
  // 점수 섹션 생성
  const createScoreSection = () => {
    const section = document.createElement('div');
    
    // 맞은 문제 수 (correctCount가 있으면 사용, 없으면 계산)
    const correctCount = card.correctCount || Math.round(card.score * card.completed / 100);
    
    // 한 문제당 5점으로 계산
    const pointsPerQuestion = 5;
    const actualScore = correctCount * pointsPerQuestion;
    
    // 점수 정보
    const scoreInfo = document.createElement('div');
    scoreInfo.textContent = `점수: ${actualScore}점 (${correctCount}/${card.total} 문제)`;
    scoreInfo.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: ${correctCount/card.total >= 0.7 ? CARD_STYLES.colors.score.high : 
              correctCount/card.total >= 0.5 ? CARD_STYLES.colors.score.medium : 
              CARD_STYLES.colors.score.low};
      margin-bottom: 12px;
    `;
 
    // 진행률 바
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = `
      height: 8px;
      background-color: #E0E0E0;
      border-radius: 4px;
      overflow: hidden;
    `;
 
    const progressPercent = Math.round((correctCount / card.total) * 100);
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
      height: 100%;
      width: ${progressPercent}%;
      background-color: ${progressPercent >= 70 ? CARD_STYLES.colors.score.high : 
                        progressPercent >= 50 ? CARD_STYLES.colors.score.medium : 
                        CARD_STYLES.colors.score.low};
      border-radius: 4px;
      transition: width 0.5s ease;
    `;
 
    progressBar.appendChild(progressFill);
    section.appendChild(scoreInfo);
    section.appendChild(progressBar);
    return section;
  };
 
  // 과목별 점수 섹션 생성
  const createSubjectSection = () => {
    if (card.type !== 'mockexam') return null;
 
    const section = document.createElement('div');
    section.className = 'subject-section';
    section.style.cssText = 'margin: 16px 0;';
 
    const subjects = card.subjectResults || {
      '운동생리학': 0,
      '건강체력평가': 0,
      '운동처방론': 0,
      '운동부하검사': 0
    };
 
    Object.entries(subjects).forEach(([name, score]) => {
      const item = document.createElement('div');
      item.className = 'subject-item';
      item.style.cssText = 'margin-bottom: 8px;';
 
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 4px;
      `;
      header.innerHTML = `
        <span>${name}</span>
        <span>${score}점</span>
      `;
 
      const bar = document.createElement('div');
      bar.style.cssText = `
        height: 5px;
        background-color: #E0E0E0;
        border-radius: 3px;
        overflow: hidden;
      `;
 
      const fill = document.createElement('div');
      fill.style.cssText = `
        height: 100%;
        width: ${score}%;
        background-color: ${score >= 70 ? CARD_STYLES.colors.score.high : 
                          score >= 50 ? CARD_STYLES.colors.score.medium : 
                          CARD_STYLES.colors.score.low};
        border-radius: 3px;
        transition: width 0.3s ease;
      `;
 
      bar.appendChild(fill);
      item.appendChild(header);
      item.appendChild(bar);
      section.appendChild(item);
    });
 
    return section;
  };
 
  // 버튼 섹션 생성
  const createButtonSection = () => {
    const section = document.createElement('div');
    section.className = 'button-section';
    section.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: auto;
    `;
    
    // 버튼 스타일 정의 - 채도를 높인 버전
    const scorecardStyle = createButtonStyle('#8ab5c6', '#6a9fb5'); // primary-dark 기반, 채도 약간 높임
    const deleteStyle = createButtonStyle('#c4cfd6', '#a9bac5'); // 부드러운 그레이, 채도 약간 높임
    
    // 정오표 버튼
    const scorecardBtn = document.createElement('button');
    scorecardBtn.className = 'btn scorecard-btn';
    scorecardBtn.textContent = '정오표 보기';
    scorecardBtn.onclick = () => viewSessionDetails(card.id);
    scorecardBtn.style.cssText = scorecardStyle.base;
    addButtonHoverEffect(scorecardBtn, scorecardStyle);
    
    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn delete-btn';
    deleteBtn.textContent = '삭제';
    deleteBtn.dataset.id = card.id;
    deleteBtn.style.cssText = deleteStyle.base;
    addButtonHoverEffect(deleteBtn, deleteStyle);
    
    section.appendChild(scorecardBtn);
    section.appendChild(deleteBtn);
    return section;
  };
  // 버튼 호버 효과 추가
  const addButtonHoverEffect = (button, styles) => {
    button.addEventListener('mouseenter', () => {
      button.style.cssText = `${styles.base} ${styles.hover}`;
    });
    button.addEventListener('mouseleave', () => {
      button.style.cssText = styles.base;
    });
  };
 
  // 컴포넌트 조립
  cardContent.appendChild(createHeader());
  cardContent.appendChild(createScoreSection());
 
  const subjectSection = createSubjectSection();
  if (subjectSection) {
    cardContent.appendChild(subjectSection);
  } else {
    // 일반 세션용 여백
    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex-grow: 1;';
    cardContent.appendChild(spacer);
  }
 
  cardContent.appendChild(createButtonSection());
  cardElement.appendChild(cardContent);
  return cardElement;
}
 
/**
 * 카드 그리드 스타일 설정
 */
function addCardGridStyles() {
  if (document.getElementById('card-grid-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'card-grid-styles';
  styleElement.textContent = `
    .session-cards-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      padding: 20px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 768px) {
      .session-cards-container {
        grid-template-columns: 1fr;
        padding: 12px;
        gap: 12px;
      }

      .session-card {
        height: auto;
        min-height: 230px;
      }

      .button-section {
        flex-direction: column;
      }

      .button-section button {
        width: 100%;
      }
    }

    @media (min-width: 769px) and (max-width: 1024px) {
      .session-cards-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .session-card {
        min-height: 280px;
      }
    }

    @media (min-width: 1025px) {
      .session-cards-container {
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      }
    }

    .session-card {
      opacity: 0;
      animation: fadeIn 0.3s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  document.head.appendChild(styleElement);
}

/**
 * 카드 컨테이너 초기화
 */
function initializeCardContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  addCardGridStyles();
  container.classList.add('session-cards-container');

  // 접근성 속성 추가
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', '세션 카드 목록');
}

/**
 * 카드 이벤트 리스너 등록 함수
 * 
 * 세션 카드의 버튼에 이벤트 리스너를 등록합니다.
 * @param {HTMLElement} container - 카드 컨테이너 요소
 * @param {string} typeFilter - 현재 타입 필터 값
 * @param {string} subjectFilter - 현재 과목 필터 값
 * @param {string} yearFilter - 현재 연도 필터 값
 */
function attachCardEventListeners(container, typeFilter, subjectFilter, yearFilter) {
  console.log('🔧 이벤트 리스너 등록 시작...');

  // 이어서 풀기 버튼 이벤트 등록
  const resumeBtns = container.querySelectorAll('.resume-btn');
  console.log(`▶ 이어서 풀기 버튼 ${resumeBtns.length}개 발견`);
  resumeBtns.forEach(btn => {
    const cardId = btn.dataset.cardId;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('▶ 이어서 풀기 클릭:', cardId);
      resumeSession(cardId);
    });

    // Hover 효과
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#059669';
      btn.style.transform = 'scale(1.02)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#10b981';
      btn.style.transform = 'scale(1)';
    });
  });

  // 정오표 버튼 이벤트 등록
  const scorecardBtns = container.querySelectorAll('.scorecard-btn');
  console.log(`📊 정오표 버튼 ${scorecardBtns.length}개 발견`);
  scorecardBtns.forEach(btn => {
    const cardId = btn.dataset.cardId;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('📊 정오표 보기 클릭:', cardId);
      showSessionScorecard(cardId);
    });

    // Hover 효과
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#6a9fb5';
      btn.style.transform = 'scale(1.02)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#8ab5c6';
      btn.style.transform = 'scale(1)';
    });
  });

  // 오답 리뷰 버튼 이벤트 등록 (기존 기능 유지)
  const reviewBtns = container.querySelectorAll('.review-btn');
  reviewBtns.forEach(btn => {
    console.log('오답 리뷰 버튼 감지됨:', btn);
  });

  console.log('✅ 이벤트 리스너 등록 완료');

  // 삭제 버튼 이벤트 등록
  const deleteBtns = container.querySelectorAll('.delete-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async function () {
      const sessionId = this.dataset.id;

      // 삭제 확인
      if (confirm('이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        try {
          showLoading('세션 삭제 중...');

          // deleteSession 함수가 정의되어 있다고 가정
          const success = await deleteSession(sessionId, typeFilter, subjectFilter, yearFilter);

          hideLoading();

          if (success) {
            // 성공 시 화면에서 카드 제거
            const card = document.getElementById(`card-${sessionId}`);
            if (card) {
              card.remove();
              showToast('세션이 삭제되었습니다.', 'success');
            }

            // 모든 카드가 삭제되었는지 확인
            if (container.children.length === 0) {
              renderEmptyStateMessage(container, typeFilter, subjectFilter, yearFilter);
            }
          } else {
            showToast('세션 삭제 중 오류가 발생했습니다.', 'error');
          }
        } catch (error) {
          hideLoading();
          console.error('세션 삭제 오류:', error);
          showToast('세션 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
        }
      }
    });
  });
}

// 전역 함수로 등록
window.renderFilteredQuestionSets = renderFilteredQuestionSets;
window.loadAttemptsForSession = loadAttemptsForSession;

export {
  renderFilteredQuestionSets,
  loadAttemptsForSession
};

/**
 * 이어서 풀기 함수
 * 
 * 세션 카드에서 "이어서 풀기" 버튼을 클릭할 때 호출됩니다.
 * 마지막 풀이 문제부터 계속 풀 수 있도록 해당 페이지로 이동합니다.
 * @param {string} sessionId - 세션 ID
 */
function resumeSession(sessionId) {
  try {
    console.log(`이어서 풀기 시작: ${sessionId}`);

    // 세션 카드 데이터 확인
    const sessionData = window.sessionCards?.find(card => card.id === sessionId);

    if (!sessionData) {
      console.error('세션 데이터를 찾을 수 없습니다:', sessionId);
      showToast('세션 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    // 세션 정보 추출
    const year = sessionData.year || '';
    const subject = sessionData.subject || '';
    const type = sessionData.type || 'regular';
    const hour = sessionData.hour || null;
    const lastQuestionNumber = sessionData.lastQuestionNumber || 1;

    if (!year) {
      console.error('세션에 년도 정보가 없습니다.');
      showToast('세션 정보가 불완전합니다.', 'error');
      return;
    }

    // URL 생성
    let url = '';
    if (type === 'mockexam') {
      // 모의고사 URL 생성
      if (!hour) {
        console.error('모의고사 세션에 교시 정보가 없습니다.');
        showToast('모의고사 정보가 불완전합니다.', 'error');
        return;
      }
      // 모의고사는 globalIndex 기준 (0-79)이므로 그대로 사용
      // lastQuestionNumber는 이미 1-based이므로 그대로 사용
      url = `exam/${year}_모의고사_${hour}교시.html?question=${lastQuestionNumber}&resume=true`;
    } else {
      // 일반 문제 URL 생성
      if (!subject) {
        console.error('일반 문제 세션에 과목 정보가 없습니다.');
        showToast('세션 정보가 불완전합니다.', 'error');
        return;
      }
      url = `exam/${year}_${subject}.html?question=${lastQuestionNumber}&resume=true&sessionId=${sessionId}`;
    }

    console.log('이어서 풀기 - 페이지 이동:', url);

    // 세션 ID를 로컬 스토리지에 저장 (페이지 이동 전)
    localStorage.setItem('resumeSessionId', sessionId);

    // 페이지 이동
    window.location.href = url;

  } catch (error) {
    console.error('이어서 풀기 오류:', error);
    showToast('이어서 풀기 중 오류가 발생했습니다: ' + error.message, 'error');
  }
}

/**
 * 세션 상세 보기 함수
 * 
 * 세션 카드에서 "상세 보기" 버튼을 클릭할 때 호출됩니다.
 * @param {string} sessionId - 세션 ID
 */
function viewSessionDetails(sessionId) {
  try {
    console.log(`세션 상세 보기 시작: ${sessionId}`);

    // 세션 데이터 확인
    const sessionData = window.sessionCards?.find(card => card.id === sessionId);
    console.log("세션 데이터:", sessionData);

    if (!sessionData) {
      console.warn("세션 데이터를 찾을 수 없습니다. 기본 정오표를 표시합니다.");
      showSessionScorecard(sessionId);
      return;
    }

    // 세션 타입에 따라 다른 정오표 함수 호출
    if (sessionData.type === 'mockexam') {
      console.log("모의고사 정오표 표시 함수 호출");
      // 모의고사 교시 정보 확인
      const hour = sessionData.mockExamHour || sessionData.hour || '1';
      console.log(`모의고사 교시: ${hour}`);

      // 모의고사 정보 로깅
      console.log("모의고사 세션 정보:", {
        id: sessionId,
        title: sessionData.title,
        type: sessionData.type,
        year: sessionData.year,
        hour: hour,
        subject: sessionData.subject
      });

      showMockExamScorecard(sessionId);
    } else {
      console.log("일반 세션 정오표 표시 함수 호출");
      console.log("일반 세션 정보:", {
        id: sessionId,
        title: sessionData.title,
        type: sessionData.type || 'regular',
        subject: sessionData.subject
      });

      showSessionScorecard(sessionId);
    }
  } catch (error) {
    console.error('세션 상세 보기 오류:', error);
    showToast('세션 정보를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 세션 리뷰 함수
 * 
 * 세션 카드에서 "오답 리뷰" 버튼을 클릭할 때 호출됩니다.
 * @param {string} sessionId - 세션 ID
 */
function reviewSession(sessionId) {
  try {
    console.log(`세션 오답 리뷰: ${sessionId}`);
    loadAttemptsForSession(sessionId).then(attempts => {
      if (!attempts || attempts.length === 0) {
        showToast('이 세션에는 풀이 기록이 없습니다.');
        return;
      }

      // 오답만 필터링
      const incorrectAttempts = attempts.filter(a => a.isCorrect === false);

      if (incorrectAttempts.length === 0) {
        showToast('이 세션에는 오답이 없습니다. 모두 정답입니다!');
        return;
      }

      // 오답 리뷰 페이지로 이동 로직... (필요한 경우 구현)
      showToast('오답 리뷰 기능이 준비 중입니다.');
    });
  } catch (error) {
    console.error('세션 리뷰 오류:', error);
    showToast('오답 리뷰를 시작하는 중 오류가 발생했습니다.');
  }
}

// 함수를 전역으로 노출
window.viewSessionDetails = viewSessionDetails;
window.reviewSession = reviewSession;

/**
 * 모의고사 정오표 표시 함수
 * @param {string} sessionId - 세션 ID
 */
function showMockExamScorecard(sessionId) {
  try {
    console.log('모의고사 정오표 표시 함수 호출:', sessionId);

    // 시도 기록 로드
    loadMockExamAttemptsForSession(sessionId).then(attempts => {
      if (!attempts || attempts.length === 0) {
        showToast('이 모의고사 세션에는 풀이 기록이 없습니다.');
        return;
      }

      // 모달 생성
      const modal = document.createElement('div');
      modal.className = 'mockexam-scorecard-modal';

      // 모달 내용 컨테이너
      const modalContent = document.createElement('div');
      modalContent.className = 'mockexam-scorecard-content';

      // 세션 정보 추출
      const year = attempts[0]?.questionData?.year || '';
      const hour = attempts[0]?.questionData?.mockExamHour || '';

      // 과목 목록 (교시에 따라 다름)
      const subjectNames = hour === '1' ?
        ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"] :
        ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];

      // 헤더 생성
      const header = document.createElement('div');
      header.innerHTML = `<h3>${year}년 ${hour}교시 모의고사 정오표</h3>`;
      modalContent.appendChild(header);

      // 요약 정보 (전체 정답률 등)
      const summary = createScoreCardSummary(attempts);
      modalContent.appendChild(summary);

      // 과목별 탭 생성
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'scorecard-tabs';

      // 전체 탭 및 과목별 탭 추가
      let tabsHTML = `<button class="tab-button active" data-subject="all">전체 문제</button>`;

      subjectNames.forEach(subject => {
        tabsHTML += `<button class="tab-button" data-subject="${subject}">${subject}</button>`;
      });

      tabsContainer.innerHTML = tabsHTML;
      modalContent.appendChild(tabsContainer);

      // 정오표 컨테이너
      const scorecardContainer = document.createElement('div');
      scorecardContainer.className = 'scorecard-container';
      modalContent.appendChild(scorecardContainer);

      // 정오표 생성 함수
      const renderScorecard = (subjectFilter = 'all') => {
        // 과목 필터링 및 정오표 테이블 생성
        const filteredAttempts = subjectFilter === 'all' ?
          attempts :
          attempts.filter(a => a.questionData.subject === subjectFilter);

        if (filteredAttempts.length === 0) {
          scorecardContainer.innerHTML = '<p class="no-data">해당 과목에 풀이 기록이 없습니다.</p>';
          return;
        }

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'scorecard-table';

        // 테이블 헤더
        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d0d9e6; background: #f0f5ff;">번호</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d0d9e6; background: #f0f5ff;">과목</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d0d9e6; background: #f0f5ff;">선택한 답</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d0d9e6; background: #f0f5ff;">정답</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #d0d9e6; background: #f0f5ff;">결과</th>
          </tr>
        `;
        table.appendChild(thead);

        // 테이블 본문
        const tbody = document.createElement('tbody');

        // 과목별 정렬 (1:운동생리학, 2:건강체력평가 등)
        const sortedAttempts = [...filteredAttempts].sort((a, b) => {
          const subjectAIndex = subjectNames.indexOf(a.questionData.subject);
          const subjectBIndex = subjectNames.indexOf(b.questionData.subject);

          if (subjectAIndex !== subjectBIndex) return subjectAIndex - subjectBIndex;

          // 같은 과목 내에서는 문제 번호로 정렬
          return a.questionData.number - b.questionData.number;
        });

        // 정답 추출 헬퍼 함수 (createQuestionCard와 동일한 로직)
        function getCorrectAnswer(attempt) {
          let answer = null;

          // 시도 객체에서 직접 확인
          if (attempt.correctAnswer !== undefined && attempt.correctAnswer !== null && !isNaN(attempt.correctAnswer)) {
            answer = Number(attempt.correctAnswer) + 1;
          }

          // questionData 객체 내부 확인
          if (answer === null && attempt.questionData) {
            if (attempt.questionData.correctAnswer !== undefined && attempt.questionData.correctAnswer !== null && !isNaN(attempt.questionData.correctAnswer)) {
              answer = Number(attempt.questionData.correctAnswer) + 1;
            } else if (attempt.questionData.correctOption !== undefined && attempt.questionData.correctOption !== null && !isNaN(attempt.questionData.correctOption)) {
              answer = Number(attempt.questionData.correctOption) + 1;
            } else if (attempt.questionData.correct !== undefined && attempt.questionData.correct !== null && !isNaN(attempt.questionData.correct)) {
              answer = Number(attempt.questionData.correct) + 1;
            }
          }

          // 정답인 경우 userAnswer 사용
          if (answer === null && attempt.isCorrect === true && attempt.userAnswer !== undefined && attempt.userAnswer !== null && !isNaN(attempt.userAnswer)) {
            answer = Number(attempt.userAnswer) + 1;
          }

          return answer !== null && !isNaN(answer) ? answer : '-';
        }

        sortedAttempts.forEach(attempt => {
          const row = document.createElement('tr');
          const isCorrect = attempt.isCorrect;

          // 과목 내 상대적 문제 번호 계산 (1~20)
          const subjectIndex = subjectNames.indexOf(attempt.questionData.subject);
          const displayNumber = attempt.questionData.number;

          // 선택 답안과 정답 (0-based를 1-based로 변환)
          const userAnswer = attempt.userAnswer !== undefined ? (Number(attempt.userAnswer) + 1) : '-';
          const correctAnswer = getCorrectAnswer(attempt);

          row.className = isCorrect ? 'correct-row' : 'incorrect-row';

          row.innerHTML = `
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${displayNumber}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${attempt.questionData.subject}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${userAnswer}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${correctAnswer}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee; font-weight: bold; color: ${isCorrect ? '#4CAF50' : '#F44336'};">
              ${isCorrect ? '정답' : '오답'}
            </td>
          `;

          tbody.appendChild(row);
        });

        table.appendChild(tbody);
        scorecardContainer.innerHTML = '';
        scorecardContainer.appendChild(table);
      };

      // 초기 정오표 렌더링 (전체 탭)
      renderScorecard('all');

      // 탭 클릭 이벤트 설정
      tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
          const subject = e.target.dataset.subject;

          // 탭 활성화 상태 변경
          tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subject === subject);
          });

          // 정오표 렌더링
          renderScorecard(subject);
        }
      });

      // 모달에 내용 추가 및 표시
      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // 닫기 버튼 추가
      const closeButton = document.createElement('button');
      closeButton.className = 'modal-close-button';
      closeButton.innerHTML = '&times;';
      closeButton.onclick = () => {
        document.body.removeChild(modal);
      };
      modalContent.prepend(closeButton);

      // 모달 스타일 추가
      addScorecardModalStyles();
    });
  } catch (error) {
    console.error('정오표 표시 오류:', error);
    showToast('정오표를 표시하는 중 오류가 발생했습니다.');
  }
}

/**
 * 정오표 요약 정보 생성 함수 - 가로 공간 최대 활용 버전
 * @param {Array} attempts - 시도 기록 배열
 * @returns {HTMLElement} 요약 정보를 담은 div 요소
 */
function createScoreCardSummary(attempts) {
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'scorecard-summary';

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(a => a.isCorrect).length;
  const accuracyPercent = Math.round((correctAttempts / totalAttempts) * 100);

  const pointsPerQuestion = 5;
  const totalScore = correctAttempts * pointsPerQuestion;

  // 채도를 낮춘 메인 색상
  const mainColor = '#4b89dc'; // 기존 #1a73e8에서 채도를 낮춘 색상

  const subjectStats = {};

  attempts.forEach(attempt => {
    const subject = attempt.questionData.subject;

    if (!subjectStats[subject]) {
      subjectStats[subject] = {
        total: 0,
        correct: 0
      };
    }

    subjectStats[subject].total++;
    if (attempt.isCorrect) {
      subjectStats[subject].correct++;
    }
  });

  summaryDiv.innerHTML = `
    <div class="scorecard-container" style="font-family: 'Arial', sans-serif; width: 100%; margin: 0 auto;">
      <div style="border: 1px solid ${mainColor}; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="margin-bottom: 8px; font-size: 13px; font-weight: 600; color: ${mainColor}; display: flex; justify-content: space-between; align-items: center;">
          <span>총점</span>
          <span style="font-size: 12px; color: #777;">${totalAttempts}문제 중 ${correctAttempts}문제 정답 (${accuracyPercent}%)</span>
        </div>
        <div style="display: flex; align-items: center;">
          <div style="margin-right: 20px;">
            <div style="font-size: 34px; font-weight: 700; color: ${mainColor}; line-height: 1;">${totalScore}점</div>
          </div>
          <div style="flex: 1;">
            <div style="height: 8px; background: #e8e8e8; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: ${accuracyPercent}%; background: ${mainColor}; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="border: 1px solid ${mainColor}; border-radius: 8px; padding: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="margin-bottom: 8px; font-size: 13px; font-weight: 600; color: ${mainColor};">과목별 점수</div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); grid-gap: 12px;">
          ${createCompactSubjectGrid(subjectStats, pointsPerQuestion)}
        </div>
      </div>
    </div>
  `;

  return summaryDiv;
}

function createCompactSubjectGrid(subjectStats, pointsPerQuestion = 5) {
  let html = '';

  // 채도를 낮춘 점수 색상들
  const scoreColors = {
    high: '#5cb85c',   // 녹색 (높은 점수)
    medium: '#f0ad4e', // 노란색 (중간 점수)
    low: '#d9534f'     // 빨간색 (낮은 점수)
  };

  // 과목 순서 정의 (지정된 순서대로 표시)
  const subjectOrder = [
    '기능해부학', '운동상해',
    '스포츠심리학', '병태생리학',
    '운동생리학', '건강체력평가',
    '운동처방론', '운동부하검사'
  ];

  // 필터링된 과목 목록 (실제 데이터에 있는 과목만)
  const availableSubjects = subjectOrder.filter(subject => subjectStats[subject]);

  // 각 과목별로 HTML 생성
  for (let i = 0; i < availableSubjects.length; i++) {
    const subject = availableSubjects[i];
    const stats = subjectStats[subject];
    const subjectAccuracy = Math.round((stats.correct / stats.total) * 100);

    // 점수 계산 (문제당 5점)
    const subjectScore = stats.correct * pointsPerQuestion;

    // 점수에 따른 색상 결정 (채도 낮춤)
    let scoreColor;
    if (subjectAccuracy >= 60) scoreColor = scoreColors.high;
    else if (subjectAccuracy >= 40) scoreColor = scoreColors.medium;
    else scoreColor = scoreColors.low;

    // 과목 카드 HTML 생성
    const subjectHtml = `
      <div style="background: #f9f9f9; border-radius: 6px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
        <div style="margin-bottom: 2px; font-size: 12px; color: #444;">${subject}</div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
          <div style="font-size: 24px; font-weight: 700; color: ${scoreColor};">${subjectScore}점</div>
          <div style="color: #777; font-size: 11px;">(${stats.correct}/${stats.total})</div>
        </div>
        <div style="height: 6px; background: #e8e8e8; border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${subjectAccuracy}%; background-color: ${scoreColor}; border-radius: 3px;"></div>
        </div>
      </div>
    `;

    // HTML에 추가
    html += subjectHtml;
  }

  return html;
}

/**
 * 정오표 모달 스타일 추가 함수
 */
function addScorecardModalStyles() {
  const styleId = 'mockexam-scorecard-styles';

  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;

    style.textContent = `
      .mockexam-scorecard-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      
      .mockexam-scorecard-content {
        background-color: white;
        border-radius: 16px;
        padding: 28px;
        width: 92%;
        max-width: 950px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      }
      
      .scorecard-summary {
        background-color: #f5f8ff;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 28px;
        border-left: 4px solid #4285F4;
      }
      
      .scorecard-table th {
        background-color: #f0f5ff;
        padding: 12px 16px;
        text-align: left;
        border-bottom: 2px solid #d0d9e6;
        font-weight: 600;
      }
      
      .scorecard-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #eaedf2;
      }
      
      .scorecard-table .correct-row {
        background-color: rgba(76, 175, 80, 0.05);
      }
      
      .scorecard-table .incorrect-row {
        background-color: rgba(244, 67, 54, 0.05);
      }
      
      .scorecard-table .correct {
        color: #2E7D32;
        font-weight: 600;
      }
      
      .scorecard-table .incorrect {
        color: #C62828;
        font-weight: 600;
      }
      
      .modal-close-button {
        position: absolute;
        top: 20px;
        right: 20px;
        font-size: 24px;
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        transition: color 0.3s;
      }
      
      .modal-close-button:hover {
        color: #333;
      }
      
      .overall-accuracy {
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      
      .accuracy-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 8px;
      }
      
      .accuracy-value {
        font-size: 28px;
        font-weight: 600;
        color: #2196F3;
        margin-bottom: 4px;
      }
      
      .accuracy-detail {
        font-size: 14px;
        color: #666;
        margin-bottom: 12px;
      }
      
      .accuracy-bar-container {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .accuracy-bar {
        height: 100%;
        background: #2196F3;
        border-radius: 4px;
        transition: width 0.5s ease;
      }
    `;

    document.head.appendChild(style);
  }
}

/**
 * 모의고사 세션 시도 기록 로드 함수
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<Array>} 시도 기록 배열
 */
async function loadMockExamAttemptsForSession(sessionId) {
  try {
    // 현재 사용자 확인
    const user = auth.currentUser;
    if (!user) {
      console.warn('사용자가 로그인되어 있지 않습니다.');
      return [];
    }

    console.log(`세션 ID ${sessionId}에 대한 모의고사 시도 기록을 로드합니다...`);

    // 캐시된 데이터 확인
    if (window.attemptsBySession && window.attemptsBySession[sessionId]) {
      const cachedAttempts = window.attemptsBySession[sessionId];
      console.log(`세션 ID ${sessionId}에 대한 시도 기록 ${cachedAttempts.length}개를 캐시에서 로드했습니다.`);
      return cachedAttempts;
    }

    // Firebase에서 직접 쿼리
    const attemptsRef = collection(db, "attempts");
    const attemptsQuery = query(
      attemptsRef,
      where("userId", "==", user.uid),
      where("sessionId", "==", sessionId),
      orderBy("timestamp", "asc"),
      limit(100) // 모의고사는 최대 80문제지만 여유 있게 100개까지 로드
    );

    const attemptsSnapshot = await getDocs(attemptsQuery);

    if (attemptsSnapshot.empty) {
      console.log(`세션 ID ${sessionId}에 대한 시도 기록이 없습니다.`);
      return [];
    }

    const attempts = [];
    attemptsSnapshot.forEach(doc => {
      attempts.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`${attempts.length}개의 모의고사 시도 기록을 찾았습니다.`);

    // 결과를 캐시에 저장
    if (!window.attemptsBySession) window.attemptsBySession = {};
    window.attemptsBySession[sessionId] = attempts;

    return attempts;
  } catch (error) {
    console.error('모의고사 시도 기록 로드 오류:', error);
    return [];
  }
}

// 함수를 전역으로 노출
window.showMockExamScorecard = showMockExamScorecard;
window.loadMockExamAttemptsForSession = loadMockExamAttemptsForSession;

function reviewQuiz() {
  // 오답 모드 플래그 설정
  reviewMode = true;

  // 전체 문제에서 틀린 문제 찾기
  const incorrectIndices = [];
  const incorrectGlobalIndices = [];

  // 모든 문제를 확인
  for (let i = 0; i < allQuestions.length; i++) {
    const question = allQuestions[i];
    const globalIndex = question.globalIndex;
    const userAnswer = userAnswers[globalIndex];

    // 답변하지 않은 문제는 건너뛰기
    if (userAnswer === null) {
      continue;
    }

    // 정답 확인 로직 (배열 정답 지원)
    const correctAnswer = question.correctAnswer !== undefined
      ? question.correctAnswer
      : question.correct;

    let isCorrect = false;
    if (Array.isArray(correctAnswer)) {
      if (correctAnswer.length === 4) {
        // 모든 선택지가 정답인 경우, 사용자가 답을 선택했으면 정답
        isCorrect = userAnswer !== null;
      } else {
        // 일부 선택지만 정답인 경우, 사용자 답변이 정답 배열에 포함되어 있는지 확인
        isCorrect = correctAnswer.includes(userAnswer);
      }
    } else {
      // 단일 정답인 경우
      isCorrect = userAnswer === correctAnswer;
    }

    // 틀린 문제만 추가
    if (!isCorrect) {
      incorrectIndices.push(i);
      incorrectGlobalIndices.push(globalIndex);
    }
  }

  console.log('📊 오답 확인 결과:', {
    전체문제수: allQuestions.length,
    답변한문제수: userAnswers.filter(a => a !== null).length,
    틀린문제수: incorrectIndices.length
  });

  // 틀린 문제가 없는 경우 처리
  if (incorrectIndices.length === 0) {
    alert('틀린 문제가 없습니다!');
    return;
  }

  console.log('틀린 문제 수:', incorrectIndices.length);
  console.log('틀린 문제 인덱스:', incorrectIndices);

  // 오답 인덱스 배열을 전역 변수에 저장
  window.incorrectIndices = incorrectIndices;
  window.incorrectGlobalIndices = incorrectGlobalIndices;
  window.currentIncorrectIndex = 0;

  // 첫 번째 오답 문제로 이동
  changeSubject('all'); // 전체 모드로 변경
  currentQuestionIndex = incorrectIndices[0];
  questions = allQuestions;

  // 네비게이션 버튼 함수 백업 및 설정
  if (!window.originalNextFunction) {
    window.originalNextFunction = goToNextQuestion;
    window.originalPrevFunction = goToPreviousQuestion;
  }

  // 네비게이션 버튼 이벤트 리스너 변경
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');

  prevButton.removeEventListener('click', goToPreviousQuestion);
  nextButton.removeEventListener('click', goToNextQuestion);

  prevButton.addEventListener('click', goToPreviousIncorrect);
  nextButton.addEventListener('click', goToNextIncorrect);

  // 네비게이션 버튼 초기 상태 설정
  prevButton.disabled = true;
  nextButton.disabled = incorrectIndices.length <= 1;

  // 리뷰 모드 UI 추가
  addReviewModeUI(incorrectIndices.length);

  // 문제 화면 표시 및 결과 화면 숨기기
  document.getElementById('quiz-container').style.display = 'block';
  document.querySelector('.navigation-buttons').style.display = 'flex';
  document.getElementById('results-summary').style.display = 'none';

  // 인디케이터 초기화 및 문제 로드
  initQuestionIndicators();
  updateResultIndicators(); // 정답/오답 표시 적용
  loadQuestion(currentQuestionIndex);

  // 정답 표시
  showCurrentAnswer(questions[currentQuestionIndex]);
}

// 오답 리뷰 이동 함수들
function goToPreviousIncorrect() {
  if (window.currentIncorrectIndex > 0) {
    window.currentIncorrectIndex--;
    currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];

    // 버튼 상태 업데이트
    document.getElementById('prev-button').disabled = window.currentIncorrectIndex === 0;
    document.getElementById('next-button').disabled = false;

    loadQuestion(currentQuestionIndex);
    updateQuestionIndicators();
    showCurrentAnswer(questions[currentQuestionIndex]);
    updateIncorrectCounter();
  }
}

function goToNextIncorrect() {
  if (window.currentIncorrectIndex < window.incorrectIndices.length - 1) {
    window.currentIncorrectIndex++;
    currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];

    // 버튼 상태 업데이트
    document.getElementById('prev-button').disabled = false;
    document.getElementById('next-button').disabled = window.currentIncorrectIndex >= window.incorrectIndices.length - 1;

    loadQuestion(currentQuestionIndex);
    updateQuestionIndicators();
    showCurrentAnswer(questions[currentQuestionIndex]);
    updateIncorrectCounter();
  }
}

// 리뷰 모드 UI 추가 함수
function addReviewModeUI(incorrectCount, subject = '전체') {
  // 기존 UI 제거
  const existingMessage = document.querySelector('.review-mode-message');
  if (existingMessage) existingMessage.remove();

  // 리뷰 모드 메시지 추가
  const messageDiv = document.createElement('div');
  messageDiv.className = 'review-mode-message';
  messageDiv.style.cssText = `
    background-color: #FFF3E0;
    padding: 10px 15px;
    border-radius: 6px;
    margin-bottom: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const infoSpan = document.createElement('span');
  infoSpan.className = 'review-mode-info';
  infoSpan.textContent = subject !== 'all' ?
    `${subject}: 틀린 ${incorrectCount}문제 중 1번째` :
    `틀린 ${incorrectCount}문제 중 1번째`;
  infoSpan.style.fontWeight = '500';

  const exitButton = document.createElement('button');
  exitButton.className = 'exit-review-button';
  exitButton.textContent = '오답 리뷰 종료';
  exitButton.style.cssText = `
    padding: 5px 10px;
    background-color: #FF9800;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  exitButton.addEventListener('click', exitReviewMode);

  messageDiv.appendChild(infoSpan);
  messageDiv.appendChild(exitButton);

  // UI에 추가
  const container = document.querySelector('.quiz-header');
  container.appendChild(messageDiv);
}

// 오답 리뷰 모드 종료 함수
function exitReviewMode() {
  reviewMode = false;

  // 네비게이션 버튼 이벤트 리스너 복원
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');

  prevButton.removeEventListener('click', goToPreviousIncorrect);
  nextButton.removeEventListener('click', goToNextIncorrect);

  prevButton.addEventListener('click', window.originalPrevFunction || goToPreviousQuestion);
  nextButton.addEventListener('click', window.originalNextFunction || goToNextQuestion);

  // 리뷰 모드 UI 제거
  const reviewMessage = document.querySelector('.review-mode-message');
  if (reviewMessage) reviewMessage.remove();

  // 현재 문제 인덱스 유지 및 재로드
  loadQuestion(currentQuestionIndex);
  updateQuestionIndicators();
  updateNavButtons();

  // 피드백 숨기기
  const feedback = document.getElementById('feedback');
  feedback.style.display = 'none';
  feedback.innerHTML = '';
}

// 현재 문제의 정답 표시 함수
function showCurrentAnswer(question) {
  if (!question) return;

  const correctAnswer = question.correctAnswer;
  const userAnswer = userAnswers[question.globalIndex];
  const isCorrect = (userAnswer === correctAnswer);

  // 피드백
  const feedback = document.getElementById('feedback');
  feedback.className = `answer-feedback ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`;
  feedback.innerHTML = `
    <div class="feedback-title">
      <span class="feedback-icon">${isCorrect ? '✓' : '✗'}</span>
      <span>${isCorrect ? '정답입니다!' : '오답입니다!'}</span>
    </div>
    ${!isCorrect ? `<div class="correct-answer">정답: ${correctAnswer + 1}번</div>` : ''}
    <div class="explanation">${question.explanation || '해설 정보가 없습니다.'}</div>
  `;
  feedback.style.display = 'block';
}