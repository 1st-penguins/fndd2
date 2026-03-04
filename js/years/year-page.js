// year-page.js - 연도별 기출문제 페이지 컨트롤러

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { ensureFirebase } from "../core/firebase-core.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { showLoginModal, closeLoginModal, updateLoginUI, updateRestrictedContent } from "../auth/auth-ui.js";
import { navigateWithAccessGuard, setupRestrictedLinkDelegation } from "../auth/access-guard.js";
import { addScrollUpButton } from "../utils/ui-utils.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/**
 * 연도별 기출문제 페이지 초기화
 */
function initYearPage() {
  // 현재 URL에서 연도 정보 추출
  const pathSegments = window.location.pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  const yearMatch = filename.match(/year_(\d{4})\.html/);

  if (yearMatch) {
    const year = yearMatch[1];
    document.title = `${year}년 기출문제 - 퍼스트펭귄 건강운동관리사`;
  }

  // 로그인 상태에 따른 제한된 콘텐츠 처리
  const isLoggedIn = isUserLoggedIn();
  updateRestrictedContent(isLoggedIn);

  // 보안: 인라인 onclick 이벤트 및 레거시 함수 가로채기
  startSecurityInterception();

  // 제한된 링크에 이벤트 핸들러 등록 (데이터 속성 기반)
  setupRestrictedLinks();

  // 로그인 모달 이벤트 리스너 등록
  setupLoginModalEvents();

  // 스크롤 업 버튼 추가
  addScrollUpButton();

  // 모의고사 시도 횟수 및 완료 상태 표시
  if (isUserLoggedIn()) {
    loadMockExamStats();
  }
}

/**
 * 보안: 인라인 이벤트 및 글로벌 함수 가로채기
 * HTML에 하드코딩된 onclick="window.location..." 및 startQuiz() 호출을 안전하게 제어
 */
function startSecurityInterception() {
  // 1. 인라인 onclick 제거 및 이벤트 리스너로 교체
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

  // 2. 글로벌 함수 오버라이딩 (Monkey Patching)
  // years-sports/year_2024.html 등에서 사용하는 startQuiz, startMockExam 가로채기

  // 기존 함수 백업 후 재정의
  const originalStartQuiz = window.startQuiz;
  window.startQuiz = function (year, subject) {
    if (isUserLoggedIn()) {
      // 로그인 상태면 원래 로직 수행 (또는 직접 이동)
      if (typeof originalStartQuiz === 'function') {
        originalStartQuiz(year, subject);
      } else {
        // Fallback
        window.location.href = `../exam-sports/${year}_${subject}.html`;
      }
    } else {
      showLoginModal();
    }
  };

  const originalStartMockExam = window.startMockExam;
  window.startMockExam = function (year, hour) {
    if (isUserLoggedIn()) {
      if (typeof originalStartMockExam === 'function') {
        originalStartMockExam(year, hour);
      } else {
        window.location.href = `../exam-sports/${year}_모의고사_${hour}교시.html`;
      }
    } else {
      showLoginModal();
    }
  };
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
async function setupAuthStateListener() {
  try {
    // Firebase 초기화 보장
    const { auth } = await ensureFirebase();
    
    if (!auth) {
      console.error('Firebase auth가 초기화되지 않았습니다.');
      return;
    }
    
    onAuthStateChanged(auth, user => {
      updateLoginUI();
      updateRestrictedContent(!!user);
      // 로그인 상태가 변경되면 모의고사 통계 다시 로드
      if (user) {
        loadMockExamStats();
      } else {
        clearMockExamStats();
      }
    });
  } catch (error) {
    console.error('인증 상태 리스너 설정 오류:', error);
  }
}

/**
 * 모의고사 시도 횟수 및 완료 상태 가져오기
 */
async function loadMockExamStats() {
  try {
    const { db, auth } = await ensureFirebase();
    const user = auth?.currentUser;
    
    if (!user || !db) {
      return;
    }

    // 현재 페이지의 연도 추출
    const pathSegments = window.location.pathname.split('/');
    const filename = pathSegments[pathSegments.length - 1];
    const yearMatch = filename.match(/year_(\d{4})\.html/);
    
    if (!yearMatch) {
      return;
    }
    
    const year = yearMatch[1];
    
    // 모의고사 결과 가져오기 (완료 여부 확인용)
    const mockExamResultsRef = collection(db, 'mockExamResults');
    const resultsQuery = query(
      mockExamResultsRef,
      where('userId', '==', user.uid),
      where('year', '==', year)
    );
    const resultsSnapshot = await getDocs(resultsQuery);
    
    const completedExams = {};
    resultsSnapshot.forEach(doc => {
      const data = doc.data();
      const hour = String(data.hour || data.mockExamHour || data.mockExamPart || '1');
      const key = `${year}_${hour}`;
      // 모의고사 결과가 있고, 80문제 모두 풀었는지 확인
      // mockExamResults에 결과가 저장되었다는 것은 제출이 완료되었다는 의미
      // totalQuestions가 80이면 완료로 간주
      const totalQuestions = data.totalQuestions || 0;
      if (totalQuestions === 80) {
        completedExams[key] = true;
      }
    });
    
    // 세션 수 가져오기 (시도 횟수 확인용)
    const sessionsRef = collection(db, 'sessions');
    const sessionsQuery = query(
      sessionsRef,
      where('userId', '==', user.uid),
      where('year', '==', year),
      where('type', '==', 'mockexam')
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    const attemptCounts = {};
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      const hour = String(data.hour || data.mockExamHour || data.mockExamPart || '1');
      const key = `${year}_${hour}`;
      attemptCounts[key] = (attemptCounts[key] || 0) + 1;
    });
    
    // HTML에 표시
    updateMockExamDisplay(year, attemptCounts, completedExams);
    
  } catch (error) {
    console.error('모의고사 통계 로드 오류:', error);
  }
}

/**
 * 모의고사 통계 표시 업데이트
 */
function updateMockExamDisplay(year, attemptCounts, completedExams) {
  // 모의고사 항목 찾기
  const mockExamItems = document.querySelectorAll('.mock-exam-section .year-item');
  
  mockExamItems.forEach(item => {
    const header = item.querySelector('.year-header');
    if (!header) return;
    
    // 교시 정보 추출 (예: "모의고사 - 1교시"에서 "1" 추출)
    const hourMatch = header.textContent.match(/(\d)교시/);
    if (!hourMatch) return;
    
    const hour = hourMatch[1];
    const key = `${year}_${hour}`;
    const attemptCount = attemptCounts[key] || 0;
    const isCompleted = completedExams[key] || false;
    
    // 기존 통계 제거
    const existingStats = item.querySelector('.mock-exam-stats');
    if (existingStats) {
      existingStats.remove();
    }
    
    // 통계 컨테이너 생성
    const statsContainer = document.createElement('div');
    statsContainer.className = 'mock-exam-stats';
    statsContainer.style.cssText = 'margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
    
    // 시도 횟수 표시
    if (attemptCount > 0) {
      const attemptBadge = document.createElement('span');
      attemptBadge.className = 'attempt-count-badge';
      attemptBadge.textContent = `시도 ${attemptCount}회`;
      attemptBadge.style.cssText = 'font-size: 12px; color: #666; background: #f0f0f0; padding: 4px 8px; border-radius: 12px;';
      statsContainer.appendChild(attemptBadge);
    }
    
    // 완료 뱃지 표시
    if (isCompleted) {
      const completedBadge = document.createElement('span');
      completedBadge.className = 'completed-badge';
      completedBadge.textContent = '✓ 응시완료';
      completedBadge.style.cssText = 'font-size: 12px; color: #fff; background: #4caf50; padding: 4px 8px; border-radius: 12px; font-weight: 500;';
      statsContainer.appendChild(completedBadge);
    }
    
    // year-content에 추가
    const yearContent = item.querySelector('.year-content');
    if (yearContent) {
      yearContent.appendChild(statsContainer);
    }
  });
}

/**
 * 모의고사 통계 초기화 (로그아웃 시)
 */
function clearMockExamStats() {
  document.querySelectorAll('.mock-exam-stats').forEach(el => el.remove());
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  initYearPage();
  await setupAuthStateListener();
});

// 전역으로 함수 노출
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.checkLoginBeforeRedirect = secureNavigate;