// analytics-loader.js - 학습 분석 데이터 로더 및 초기화 (패치 버전)

import {
  getUserAttempts,
  getUserMockExamResults,
  getUserProgress,
  getUserStatistics,
  getUserQuestionSets,
  getUserLearningStatus
} from '../data/quiz-data-service.js';

import { getScoreColor, getWeaknessColor, getRandomColor } from '../analytics/chart-utils.js';
import { formatSimpleDate, formatRelativeDate } from '../utils/date-utils.js';
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { 
  getCurrentCertificateType, 
  getCertificateName,
  getCertificateEmoji,
  filterAttemptsByCertificate,
  groupBySubject,
  calculateCertificateStats
} from '../utils/certificate-utils.js';

// 🎯 전역 상태 (자격증 완전 분리)
let dashboardInitialized = false;
let currentTab = 'overview-tab';
let isDataLoading = false;
let lastRefreshTime = null;

// 🎯 데이터 캐시 (자격증별로 관리)
let cachedData = {
  attempts: [],           // 전체 attempts (필터링 전)
  mockExamResults: [],    // 전체 mockExamResults (필터링 전)
  userProgress: null,
  userStats: null,
  questionSets: [],
  lastUpdated: null,
  lastCertificateType: null  // 마지막으로 로드한 자격증
};

// 과목별 색상 매핑 - 일관성을 위해 전역으로 유지
const subjectColors = {
  '운동생리학': '#4285F4',
  '건강체력평가': '#0F9D58',
  '운동처방론': '#F4B400',
  '운동부하검사': '#DB4437',
  '운동상해': '#9C27B0',
  '기능해부학': '#FF9800',
  '병태생리학': '#00BCD4',
  '스포츠심리학': '#795548'
};

/**
 * 학습 분석 페이지 초기화
 */
export function initAnalyticsPage() {
  window.Logger?.debug('[analytics-loader] 학습 분석 페이지 초기화...');
  
  // 탭 초기화
  initTabs();
  
  // 이벤트 리스너 등록
  setupEventListeners();
  
  // 로그인 상태 확인
  checkLoginStatus();
  
  window.Logger?.debug('[analytics-loader] 학습 분석 페이지 초기화 완료');
}

/**
 * 탭 전환 기능 초기화
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('[analytics-loader] 탭 초기화:', tabButtons.length, '개의 버튼,', tabContents.length, '개의 콘텐츠');
  
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
      console.log('[analytics-loader] 탭 버튼 클릭:', button.dataset.tab);
      
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
        console.log('[analytics-loader] 탭 콘텐츠 표시:', tabId);
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
  
  // 자동 새로고침 (5분마다)
  setInterval(refreshDataIfNeeded, 5 * 60 * 1000);
  
  // 탭 변경 이벤트 - 탭 내용 렌더링 처리
  document.addEventListener('tabChanged', handleTabChange);
  
  // 필터 변경 이벤트
  document.addEventListener('setFiltersChanged', handleSetFiltersChange);
  document.addEventListener('historyFiltersChanged', handleHistoryFiltersChange);
  
  // 관리자 통계 이벤트
  document.addEventListener('loadAdminStats', handleLoadAdminStats);

  // 분석 데이터 업데이트 이벤트 리스너 추가
  document.addEventListener('analyticDataUpdated', (e) => {
    // 캐시된 데이터 업데이트
    if (e.detail && e.detail.data) {
      updateCachedData(e.detail.data);
      renderDashboard(); // 데이터로 대시보드 렌더링
    }
  });
}

/**
 * 캐시된 데이터 업데이트
 * @param {Object} data - 새로운 분석 데이터
 */
function updateCachedData(data) {
  if (data.attempts) cachedData.attempts = data.attempts;
  if (data.mockExamResults) cachedData.mockExamResults = data.mockExamResults;
  if (data.userProgress) cachedData.userProgress = data.userProgress;
  if (data.userStats) cachedData.userStats = data.userStats;
  cachedData.lastUpdated = new Date();
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
 * 탭 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleTabChange(e) {
  const { tab } = e.detail;
  console.log('[analytics-loader] 탭 변경:', tab);
  
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

/**
 * 문제풀이기록 필터 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleSetFiltersChange(e) {
  const { type, subject, year } = e.detail;
  console.log('[analytics-loader] 문제풀이기록 필터 변경:', { type, subject, year });
  
  // 필터 적용하여 문제풀이기록 다시 렌더링
  renderFilteredQuestionSets(type, subject, year);
}

/**
 * 기록 필터 변경 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleHistoryFiltersChange(e) {
  const { type, result } = e.detail;
  console.log('[analytics-loader] 기록 필터 변경:', { type, result });
  
  // 필터 적용하여 기록 다시 렌더링
  renderFilteredHistory(type, result);
}

/**
 * 관리자 통계 로드 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleLoadAdminStats(e) {
  const { set, year, subject } = e.detail;
  console.log('[analytics-loader] 관리자 통계 로드:', { set, year, subject });
  
  // 관리자 통계 로드 및 렌더링
  loadAndRenderAdminStats(set, year, subject);
}

/**
 * 대시보드 준비 완료 핸들러
 * @param {CustomEvent} e - 이벤트 객체
 */
function handleDashboardReady(e) {
  const { user } = e.detail;
  
  // 관리자 확인 및 관리자 탭 표시 여부 설정
  const isUserAdmin = checkIfAdmin(user);
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isUserAdmin ? 'block' : 'none';
  });
  
  // 아직 초기화되지 않은 경우만 실행
  if (!dashboardInitialized) {
    dashboardInitialized = true;
    
    // 자동 새로고침 사용 설정
    refreshDataIfNeeded(true);
  }
}

/**
 * 관리자 권한 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 관리자 여부
 */
function checkIfAdmin(user) {
  if (!user) return false;
  
  // 1. isAdmin 함수가 전역에 존재하는 경우 사용
  if (typeof window.isAdmin === 'function') {
    return window.isAdmin(user);
  }
  
  // 2. 로컬 스토리지의 값 확인
  if (localStorage.getItem('isAdmin') === 'true') {
    return true;
  }
  
  // 3. 사용자 이메일 확인 (백업 방법)
  const adminEmails = ['kspo0324@gmail.com', 'mingdy7283@gmail.com', 'sungsoo702@gmail.com'];
  return user.email && adminEmails.includes(user.email);
}

/**
 * 데이터 새로고침이 필요한지 확인하고 실행
 * @param {boolean} force - 강제 새로고침 여부
 */
async function refreshDataIfNeeded(force = false) {
  // 현재 로드 중이면 무시
  if (isDataLoading) return;
  
  // 마지막 새로고침으로부터 5분 이내면 무시 (강제가 아닌 경우)
  if (!force && lastRefreshTime && (Date.now() - lastRefreshTime) < 5 * 60 * 1000) {
    return;
  }
  
  // 데이터 로드 시작
  await loadAnalyticsData();
}

/**
 * 로그인 상태 확인 및 처리
 */
function checkLoginStatus() {
  const loggedIn = isUserLoggedIn();
  
  if (loggedIn) {
    // 로그인 상태: 대시보드 표시
    document.getElementById('login-required').style.display = 'none';
    document.getElementById('analytics-dashboard').style.display = 'block';
    
    // 대시보드 초기화 (첫 로드)
    if (!dashboardInitialized) {
      refreshDataIfNeeded(true);
    }
  } else {
    // 비로그인 상태: 로그인 필요 화면 표시
    document.getElementById('analytics-dashboard').style.display = 'none';
    document.getElementById('login-required').style.display = 'block';
  }
}

/**
 * 분석 데이터 로드
 * @param {Object} user - 현재 사용자 정보
 */
export async function loadAnalyticsData() {
  window.Logger?.info('[analytics-loader] 분석 데이터 로드 시작');
  
  try {
    // 로딩 상태 표시
    showLoading('학습 데이터를 불러오는 중...');
    isDataLoading = true;
    
    // 통합 API를 사용한 학습 상태 데이터 가져오기
    const userData = await getUserLearningStatus();
    
    if (!userData || !userData.success) {
      throw new Error(userData?.error || '데이터를 불러오는 중 오류가 발생했습니다.');
    }
    
    // 개별 데이터 추출
    cachedData = {
      attempts: userData.attempts || [],
      mockExamResults: userData.mockExamResults || [],
      userProgress: userData.userProgress || null,
      userStats: userData.userStats || null,
      lastUpdated: new Date()
    };
    
    // 문제풀이기록 데이터 가져오기 (아직 통합 API에 포함되지 않음)
    try {
      cachedData.questionSets = await getUserQuestionSets();
    } catch (setError) {
      window.Logger?.error('문제풀이기록 데이터 로드 오류:', setError);
      cachedData.questionSets = [];
    }
    
    window.Logger?.debug('데이터 로드 완료', {
      attempts: cachedData.attempts.length,
      mockExamResults: cachedData.mockExamResults.length,
      hasProgress: !!cachedData.userProgress,
      hasStats: !!cachedData.userStats,
      questionSets: cachedData.questionSets.length
    });
    
    // 마지막 새로고침 시간 업데이트
    lastRefreshTime = Date.now();
    
    // 대시보드 렌더링
    renderDashboard();
    
    // 이벤트 디스패치
    document.dispatchEvent(new CustomEvent('dashboardReady', {
      detail: { success: true }
    }));
    
    return true;
  } catch (error) {
    window.Logger?.error('분석 데이터 로드 오류:', error);
    
    // 오류 표시
    showError(error.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    
    document.dispatchEvent(new CustomEvent('dashboardError', {
      detail: { error: error.message }
    }));
    
    return false;
  } finally {
    // 로딩 상태 해제
    isDataLoading = false;
    hideLoading();
  }
}

/**
 * 대시보드 전체 렌더링
 */
function renderDashboard() {
  window.Logger?.debug('[analytics-loader] 대시보드 렌더링 시작');
  
  // 각 탭 렌더링 (현재 활성 탭 기준)
  const activeTabId = document.querySelector('.tab-button.active')?.dataset.tab || 'overview-tab';
  
  // 해당 탭 렌더링 함수 호출
  switch (activeTabId) {
    case 'overview-tab':
      renderOverviewTab();
      break;
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
    default:
      renderOverviewTab();
  }
  
  console.log('[analytics-loader] 대시보드 렌더링 완료');
}

/**
 * 학습 개요 탭 렌더링
 */
function renderOverviewTab() {
  console.log('[analytics-loader] 학습 개요 탭 렌더링...');
  
  // 개요 통계 렌더링
  renderOverviewStats();
  
  // 과목별 학습 현황 렌더링
  renderSubjectProgress();
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
  const filteredAttempts = filterAttemptsByCertificate(cachedData.attempts, currentCertType);
  
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
    // 고유 문제 ID 생성 (globalIndex 우선, 없으면 subject+number 조합)
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
    
    // 타임스탬프 비교 (최신 기록만 유지)
    const timestamp = attempt.timestamp?.toDate ? attempt.timestamp.toDate() : 
                      (attempt.timestamp instanceof Date ? attempt.timestamp : new Date(attempt.timestamp));
    
    if (!processedQuestions.has(questionId)) {
      processedQuestions.set(questionId, attempt);
    } else {
      const existingAttempt = processedQuestions.get(questionId);
      const existingTimestamp = existingAttempt.timestamp?.toDate ? existingAttempt.timestamp.toDate() : 
                                (existingAttempt.timestamp instanceof Date ? existingAttempt.timestamp : new Date(existingAttempt.timestamp));
      
      // 더 최신 기록으로 교체
      if (timestamp > existingTimestamp) {
        processedQuestions.set(questionId, attempt);
      }
    }
  }
  
  // 중복 제거된 배열 생성
  uniqueAttempts.push(...processedQuestions.values());
  
  console.log(`[개요 통계] 중복 제거: ${filteredAttempts.length}개 → ${uniqueAttempts.length}개 문제`);
  
  // 🎯 현재 자격증 통계 계산 (중복 제거된 데이터 사용)
  const totalAttempts = uniqueAttempts.length;
  const totalCorrect = uniqueAttempts.filter(attempt => attempt.isCorrect).length;
  const correctPercentage = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  
  // 모의고사 통계 제거 (간결화)
  
  // 최근 활동 (중복 제거된 데이터에서, 타임스탬프 기준 정렬)
  const sortedUniqueAttempts = [...uniqueAttempts].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : 
                   (a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp));
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : 
                   (b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp));
    return timeB - timeA; // 최신순
  });
  
  const lastActivity = sortedUniqueAttempts.length > 0 
    ? formatRelativeDate(sortedUniqueAttempts[0].timestamp)
    : '없음';
  
  // 통계 카드 HTML (테마 정돈, 핵심 3개 지표만 유지)
  const cardBase = `background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.06);`;
  const valueBase = `font-weight: 800; line-height: 1.1;`;
  const labelBase = `margin-top: 6px; color: #6b7280; font-weight: 600; letter-spacing: .2px;`;
  // 🎯 자격증 헤더 추가
  const certHeader = `
    <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, var(--penguin-navy), var(--penguin-skyblue)); border-radius: 12px; color: white; text-align: center;">
      <div style="font-size: 32px; margin-bottom: 8px;">${certEmoji}</div>
      <div style="font-size: 20px; font-weight: 700;">${certName}</div>
    </div>
  `;
  
  const html = certHeader + `
    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      <div class="stat-item" style="${cardBase}">
        <div class="stat-value" style="${valueBase}; color: var(--penguin-navy); font-size: 26px;">${totalAttempts}</div>
        <div class="stat-label" style="${labelBase}">풀이한 문제</div>
      </div>
      <div class="stat-item" style="${cardBase}">
        <div class="stat-value" style="${valueBase}; color: ${correctPercentage < 50 ? '#e11d48' : 'var(--penguin-navy)'}; font-size: 26px;">${correctPercentage}%</div>
        <div class="stat-label" style="${labelBase}">정답률</div>
      </div>
      <div class="stat-item" style="${cardBase}">
        <div class="stat-value" style="${valueBase}; color: var(--penguin-navy); font-size: 22px;">${lastActivity}</div>
        <div class="stat-label" style="${labelBase}">최근 학습일</div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * 최근 활동 차트 렌더링
 */
function renderRecentActivityChart() {
  const chartContainer = document.getElementById('recent-activity-chart');
  if (!chartContainer) return;
  
  // 기존 차트 정리
  if (cachedData.chartInstances?.recentActivity) {
    cachedData.chartInstances.recentActivity.destroy();
  }
  
  // 데이터 없는 경우 처리
  if (!cachedData.attempts || cachedData.attempts.length === 0) {
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
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const displayDate = `${date.getMonth() + 1}/${date.getDate()}`; // MM/DD
    
    dates.push(displayDate);
    attemptsData.push(0);
    correctData.push(0);
  }
  
  // 시도 데이터 집계
  cachedData.attempts.forEach(attempt => {
    const attemptDate = new Date(attempt.timestamp);
    const dayDiff = Math.floor((today - attemptDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff >= 0 && dayDiff < 30) {
      attemptsData[29 - dayDiff]++;
      
      if (attempt.isCorrect) {
        correctData[29 - dayDiff]++;
      }
    }
  });
  
  // 차트 생성
  const ctx = document.createElement('canvas');
  chartContainer.innerHTML = '';
  chartContainer.appendChild(ctx);
  
  cachedData.chartInstances = cachedData.chartInstances || {};
  cachedData.chartInstances.recentActivity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: '총 문제 풀이',
          data: attemptsData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.4
        },
        {
          label: '정답',
          data: correctData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
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
          text: '최근 30일 학습 활동',
          color: '#111827',
          font: { size: 14, weight: '700' }
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
            precision: 0,
            color: '#6b7280'
          },
          grid: { color: 'rgba(17, 24, 39, 0.06)' }
        }
      }
    }
  });
}
