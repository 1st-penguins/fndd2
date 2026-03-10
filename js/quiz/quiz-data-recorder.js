// quiz-data-recorder.js - 퀴즈 데이터 기록 모듈

import { recordAttempt } from "../data/quiz-repository.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";

// 자동 저장 간격 (밀리초)
const AUTO_SAVE_INTERVAL = 60000; // 1분
let autoSaveTimer = null;

/**
 * 퀴즈 데이터 기록 함수
 * @param {Object} result - 문제 풀이 결과 객체
 * @returns {Promise<Object>} 기록 결과
 */
export async function recordQuizData(result) {
  // 로그인 확인
  if (!isUserLoggedIn()) {
    return { success: false, reason: 'not-logged-in' };
  }
  
  try {
    // 현재 URL에서 과목 정보 추출
    const pathSegments = window.location.pathname.split('/');
    const filename = pathSegments[pathSegments.length - 1];
    const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
    
    let year = '2025';
    let subject = '운동생리학';
    
    if (filenameMatch) {
      year = filenameMatch[1];  // 추출된 년도 (예: 2024)
      subject = filenameMatch[2];  // 추출된 과목 (예: 운동생리학)
    }
    
    // 현재 문제의 정답 정보 추출
    const currentQ = window.questions?.[window.currentQuestionIndex];
    const correctAnswer = currentQ?.correctAnswer ?? currentQ?.correctOption ?? currentQ?.correct ?? null;

    // 문제 데이터 구성
    const questionData = {
      year: year,
      subject: subject,
      number: window.currentQuestionIndex + 1,
      isFromMockExam: subject.includes('모의고사'),
      mockExamPart: subject.includes('1교시') ? 1 : (subject.includes('2교시') ? 2 : null),
      certType: (window.QUIZ_DATA_FOLDER === 'sports') ? 'sports' : 'health',
      certificateType: window.location.pathname.includes('/exam-sports/')
        ? 'sports-instructor' : 'health-manager',
      correctAnswer: correctAnswer,
      timeSpent: window.__questionTimeSpent || 0,
      viewedExplanation: window.__questionViewedExplanation || false
    };
    // 플래그 리셋
    window.__questionTimeSpent = 0;
    window.__questionViewedExplanation = false;
    
    // 데이터 기록
    return await recordAttempt(
      questionData,
      result.userAnswer,
      result.isCorrect
    );
  } catch (error) {
    console.error('퀴즈 데이터 기록 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 자동 저장 초기화 함수
 */
export function initAutoSave() {
  // 이미 실행 중인 타이머가 있으면 제거
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  
  // 로그인 상태일 때만 자동 저장 활성화
  if (isUserLoggedIn()) {
    // 문제 풀이 이벤트에 대한 리스너 추가
    document.querySelectorAll('.option-button').forEach((button, index) => {
      button.addEventListener('click', () => {
        if (window.questions && window.currentQuestionIndex !== undefined && window.userAnswers) {
          const questionData = {
            year: extractYearFromURL(),
            subject: extractSubjectFromURL(),
            number: window.currentQuestionIndex + 1,
            isFromMockExam: false
          };
          
          // 정답 확인
          const currentQuestion = window.questions[window.currentQuestionIndex];
          const selectedAnswer = index;
          const correctAnswer = currentQuestion.correctAnswer !== undefined 
            ? currentQuestion.correctAnswer 
            : currentQuestion.correct;
          const isCorrect = selectedAnswer === correctAnswer;
          
          // 문제 풀이 결과 저장
          if (typeof recordAttempt === 'function') {
            recordAttempt(questionData, selectedAnswer, isCorrect)
              .catch(error => {
                console.error('문제 풀이 자동 저장 오류:', error);
              });
          }
        }
      });
    });
    
    // 기존 자동 저장 기능도 유지
    autoSaveTimer = setInterval(() => {
      const currentProgress = {
        currentQuestionIndex: window.currentQuestionIndex,
        userAnswers: window.userAnswers,
        timeRemaining: window.timeRemaining
      };
      
      // 로컬 스토리지에 진행 상황 저장
      localStorage.setItem('quizProgress', JSON.stringify(currentProgress));
    }, AUTO_SAVE_INTERVAL);
  }
}

// URL에서 년도 추출
function extractYearFromURL() {
  const pathSegments = window.location.pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
  
  return filenameMatch ? filenameMatch[1] : '2024';
}

// URL에서 과목 추출
function extractSubjectFromURL() {
  const pathSegments = window.location.pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
  
  let subject = filenameMatch ? filenameMatch[2] : '운동생리학';
  try {
    subject = decodeURIComponent(subject);
  } catch (error) {
    console.error('과목명 디코딩 오류:', error);
  }
  
  return subject;
}

/**
 * 자동 저장 중지 함수
 */
export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
    console.log('자동 저장이 중지되었습니다.');
  }
}

// 전역 함수로 노출
if (typeof window !== 'undefined') {
  window.recordQuizData = recordQuizData;
  window.initAutoSave = initAutoSave;
  window.stopAutoSave = stopAutoSave;
} 