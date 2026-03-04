// analytics-utils.js - 애널리틱스 이벤트 추적 유틸리티

import { analytics } from "./core/firebase-core.js";
import { logEvent, setUserProperties } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

/**
 * 사용자 속성 설정
 * @param {Object} user - 사용자 객체
 */
export function setUserData(user) {
  try {
    if (!analytics || !user) return;
    
    // 사용자 기본 속성 설정
    setUserProperties(analytics, {
      user_type: user.isAdmin ? 'admin' : 'standard_user',
      account_created_at: user.createdAt ? new Date(user.createdAt).toISOString() : undefined
    });
    
    console.log('사용자 속성이 설정되었습니다.');
  } catch (error) {
    console.error('사용자 속성 설정 오류:', error);
  }
}

/**
 * 문제 풀이 시도 이벤트
 * @param {Object} questionData - 문제 정보
 * @param {number} userAnswer - 사용자 답변
 * @param {boolean} isCorrect - 정답 여부
 * @param {string} source - 출처 정보
 */
export function trackProblemAttempt(questionData, userAnswer, isCorrect, source) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "problem_attempt", {
      problem_id: `${questionData.year}_${questionData.subject}_${questionData.number}`,
      year: questionData.year,
      subject: questionData.subject,
      number: questionData.number,
      is_correct: isCorrect,
      user_answer: userAnswer !== undefined ? userAnswer : -1,
      source: source || 'regular',
      is_from_mock_exam: questionData.isFromMockExam || false,
      mock_exam_part: questionData.mockExamPart || null
    });
  } catch (error) {
    console.error('문제 풀이 추적 오류:', error);
  }
}

/**
 * 모의고사 완료 이벤트
 * @param {Object} mockExamData - 모의고사 결과 데이터
 */
export function trackMockExamCompleted(mockExamData) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "mock_exam_completed", {
      mock_exam_id: `${mockExamData.year}_${mockExamData.hour}`,
      year: mockExamData.year,
      hour: mockExamData.hour,
      score: mockExamData.score,
      correct_count: mockExamData.correctCount,
      total_questions: mockExamData.totalQuestions
    });
  } catch (error) {
    console.error('모의고사 완료 추적 오류:', error);
  }
}

/**
 * 학습 세션 시작 이벤트
 * @param {string} sessionId - 세션 ID
 * @param {string} type - 세션 유형
 * @param {string} subject - 과목
 */
export function trackStudySessionStart(sessionId, type, subject) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "study_session_start", {
      session_id: sessionId,
      session_type: type, // 'regular', 'mockexam'
      subject: subject
    });
  } catch (error) {
    console.error('학습 세션 시작 추적 오류:', error);
  }
}

/**
 * 학습 세션 종료 이벤트
 * @param {string} sessionId - 세션 ID
 * @param {number} duration - 세션 지속 시간(초)
 * @param {number} problemCount - 문제 수
 * @param {number} correctCount - 정답 수
 */
export function trackStudySessionEnd(sessionId, duration, problemCount, correctCount) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "study_session_end", {
      session_id: sessionId,
      duration_seconds: duration,
      problem_count: problemCount,
      correct_count: correctCount,
      accuracy: problemCount > 0 ? (correctCount / problemCount) : 0
    });
  } catch (error) {
    console.error('학습 세션 종료 추적 오류:', error);
  }
}

/**
 * 페이지 조회 이벤트
 * @param {string} pageName - 페이지 이름
 * @param {Object} pageParams - 추가 파라미터
 */
export function trackPageView(pageName, pageParams = {}) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "page_view", {
      page_name: pageName,
      ...pageParams
    });
  } catch (error) {
    console.error('페이지 조회 추적 오류:', error);
  }
}

/**
 * UI 요소 클릭 이벤트
 * @param {string} elementName - 요소 이름
 * @param {string} context - 컨텍스트 정보
 */
export function trackUIInteraction(elementName, context) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, "ui_interaction", {
      element_name: elementName,
      context: context
    });
  } catch (error) {
    console.error('UI 상호작용 추적 오류:', error);
  }
}

/**
 * 주요 성공 이벤트
 * @param {string} eventName - 이벤트 이름
 * @param {Object} params - 추가 파라미터
 */
export function trackSuccessEvent(eventName, params = {}) {
  try {
    if (!analytics) return;
    
    logEvent(analytics, eventName, params);
  } catch (error) {
    console.error('성공 이벤트 추적 오류:', error);
  }
}

// 자동 페이지 뷰 추적 설정
export function setupAutomaticPageTracking() {
  // 현재 페이지 추적
  trackCurrentPage();
  
  // 히스토리 변경 이벤트 리스너
  window.addEventListener('popstate', () => {
    trackCurrentPage();
  });
}

// 현재 페이지 추적
function trackCurrentPage() {
  const path = window.location.pathname;
  const pageName = path === '/' ? 'home' : path.split('/').filter(Boolean).join('_');
  
  trackPageView(pageName, {
    url: window.location.href,
    referrer: document.referrer
  });
}

// 기본 내보내기
export default {
  setUserData,
  trackProblemAttempt,
  trackMockExamCompleted,
  trackStudySessionStart,
  trackStudySessionEnd,
  trackPageView,
  trackUIInteraction,
  trackSuccessEvent,
  setupAutomaticPageTracking
};