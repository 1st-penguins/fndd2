// quiz-utils.js - 퀴즈 관련 유틸리티 함수들

/**
 * URL에서 연도와 과목 정보 추출
 * @param {string} pathname - window.location.pathname 또는 파일 경로
 * @returns {Object} { year, subject } 객체
 */
export function extractYearAndSubject(pathname = window.location.pathname) {
  const pathSegments = pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  
  // 파일명에서 년도와 과목 추출 (YYYY_과목명.html 형식)
  const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
  
  let year = '';
  let subject = '';
  
  if (filenameMatch) {
    year = filenameMatch[1];  // 예: 2024
    subject = filenameMatch[2];  // 예: 운동생리학
    
    // URL 디코딩 시도
    try {
      subject = decodeURIComponent(subject);
    } catch (error) {
      window.Logger?.warn('과목명 디코딩 오류', error);
    }
  }
  
  return { year, subject };
}

/**
 * 세션 ID 생성
 * @param {string} userId - 사용자 ID (선택)
 * @returns {string} 생성된 세션 ID
 */
export function generateSessionId(userId = null) {
  const now = new Date();
  const dateStr = now.getFullYear() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');
  const timeStr = now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0') +
                now.getSeconds().toString().padStart(2, '0');
  
  if (userId) {
    const userIdShort = userId.substring(0, 6);
    return `${dateStr}_${timeStr}_${userIdShort}`;
  }
  
  return `${dateStr}_${timeStr}`;
}

/**
 * 퀴즈 결과 계산
 * @param {Array} userAnswers - 사용자 답변 배열
 * @param {Array} questions - 문제 배열
 * @returns {Object} { correct, total, percentage }
 */
export function calculateQuizResult(userAnswers, questions) {
  let correctCount = 0;
  let totalCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    if (userAnswers[i] !== null) {
      totalCount++;
      
      const question = questions[i];
      const correctAnswer = question.correctAnswer ?? question.correctOption ?? question.correct;
      
      if (userAnswers[i] === correctAnswer) {
        correctCount++;
      }
    }
  }
  
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  
  return {
    correct: correctCount,
    total: totalCount,
    percentage
  };
}

/**
 * 문제에서 정답 추출 (다양한 필드명 지원)
 * @param {Object} question - 문제 객체
 * @returns {number|null} 정답 인덱스 (0-3) 또는 null
 */
export function getCorrectAnswer(question) {
  return question.correctAnswer ?? question.correctOption ?? question.correct ?? null;
}

// 전역 객체에 노출 (호환성)
if (typeof window !== 'undefined') {
  window.extractYearAndSubject = extractYearAndSubject;
  window.generateSessionId = generateSessionId;
  window.calculateQuizResult = calculateQuizResult;
  window.getCorrectAnswer = getCorrectAnswer;
}

