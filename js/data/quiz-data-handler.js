// quiz-data-handler.js - 퀴즈 데이터 처리 및 기록 핸들러 (패치 버전)

import { recordAttempt, recordMockExamResults } from './quiz-data-service.js';

/**
 * 퀴즈 데이터 기록 - 단일 문제용
 * @param {Object} result - 문제 풀이 결과 객체
 * @returns {Promise<Object>} 기록 결과
 */
export async function recordQuizData(result) {
  try {
    console.log('[quiz-data-handler] 문제 풀이 기록 중...', result);
    
    // 현재 URL에서 과목과 연도 정보 추출
    const { year, subject, setId, setType } = extractQuizContext();
    
    // 문제 데이터 구성
    const isFromMockExam = isMockExamPage();
    let mockExamPart = null;
    
    // 모의고사인 경우 교시 정보 추출
    if (isFromMockExam) {
      mockExamPart = extractMockExamPart();
    }
    
    // 문제 풀이 번호 (현재 index + 1)
    const questionNumber = window.currentQuestionIndex !== undefined ? window.currentQuestionIndex + 1 : 1;
    
    // 문제 데이터 구성
    const questionData = {
      year: year,
      subject: subject,
      number: questionNumber,
      isFromMockExam: isFromMockExam,
      mockExamPart: mockExamPart,
      setId: setId,
      setType: setType || (isFromMockExam ? 'mockexam' : 'regular')
    };
    
    // 데이터 기록
    return await recordAttempt(
      questionData,
      result.userAnswer,
      result.isCorrect
    );
  } catch (error) {
    console.error('[quiz-data-handler] 퀴즈 데이터 기록 오류:', error);
    
    // 오류 발생 시 재시도 
    if (error.message.includes('Firebase') || error.message.includes('network')) {
      // Firebase 네트워크 오류는 로컬 저장소에 기록 후 나중에 동기화
      storeLocalAttempt({
        timestamp: new Date(),
        questionData: extractQuizContext(),
        userAnswer: result.userAnswer, 
        isCorrect: result.isCorrect
      });
      
      return { success: false, error: error.message, localSaved: true };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * 퀴즈 컨텍스트 정보 추출 (현재 페이지 정보)
 * @returns {Object} 퀴즈 컨텍스트 정보 (연도, 과목 등)
 */
function extractQuizContext() {
  const context = {
    year: getCurrentYearFromPage(),
    subject: getCurrentSubjectFromPage(),
    setId: getQueryParam('set') || null,
    setType: getQueryParam('type') || null,
    isFromMockExam: isMockExamPage()
  };
  
  return context;
}

/**
 * 현재 페이지가 모의고사 페이지인지 확인
 * @returns {boolean} 모의고사 페이지 여부
 */
function isMockExamPage() {
  // URL에 "모의고사" 또는 "mock"이 포함되어 있는지 확인
  const url = window.location.pathname.toLowerCase();
  return url.includes('모의고사') || url.includes('mock');
}

/**
 * 모의고사 교시 정보 추출
 * @returns {string|null} 교시 정보 (1 또는 2)
 */
function extractMockExamPart() {
  // URL 또는 제목에서 교시 정보 추출
  const url = window.location.pathname.toLowerCase();
  const titleElement = document.querySelector('.quiz-title h1');
  const titleText = titleElement ? titleElement.textContent : '';
  
  // URL에서 교시 정보 추출 시도
  if (url.includes('1교시') || url.includes('1_hour')) {
    return '1';
  } else if (url.includes('2교시') || url.includes('2_hour')) {
    return '2';
  }
  
  // 제목에서 교시 정보 추출 시도
  if (titleText.includes('1교시')) {
    return '1';
  } else if (titleText.includes('2교시')) {
    return '2';
  }
  
  // 과목 기반으로 교시 유추
  const subject = getCurrentSubjectFromPage().toLowerCase();
  
  // 1교시 과목 목록
  const hour1Subjects = ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'];
  
  // 2교시 과목 목록
  const hour2Subjects = ['운동상해', '기능해부학', '병태생리학', '스포츠심리학'];
  
  if (hour1Subjects.some(s => subject.includes(s.toLowerCase()))) {
    return '1';
  } else if (hour2Subjects.some(s => subject.includes(s.toLowerCase()))) {
    return '2';
  }
  
  // 기본값
  return '1';
}

/**
 * URL 파라미터 값 가져오기
 * @param {string} name - 파라미터 이름
 * @returns {string|null} 파라미터 값
 */
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * 현재 페이지에서 과목 정보 추출
 * @returns {string} 과목명
 */
function getCurrentSubjectFromPage() {
  // 1. body 데이터 속성 확인
  const bodySubject = document.body.getAttribute('data-current-subject');
  if (bodySubject) {
    return bodySubject;
  }
  
  // 2. 제목에서 추출 시도
  const titleElement = document.querySelector('.quiz-title h1, .quiz-title, h1');
  if (titleElement) {
    const titleText = titleElement.textContent;
    
    // 과목명 패턴 검색
    const subjects = [
      '운동생리학', '건강체력평가', '운동처방론', '운동부하검사',
      '운동상해', '기능해부학', '병태생리학', '스포츠심리학'
    ];
    
    for (const subject of subjects) {
      if (titleText.includes(subject)) {
        return subject;
      }
    }
  }
  
  // 3. URL에서 추출 시도
  const url = window.location.pathname;
  
  for (const subject of [
    '운동생리학', '건강체력평가', '운동처방론', '운동부하검사',
    '운동상해', '기능해부학', '병태생리학', '스포츠심리학'
  ]) {
    if (url.includes(encodeURIComponent(subject)) || url.includes(subject)) {
      return subject;
    }
  }
  
  // 4. 페이지 내 과목 표시 확인
  const subjectBadge = document.getElementById('subject-badge');
  if (subjectBadge && subjectBadge.textContent) {
    return subjectBadge.textContent.trim();
  }
  
  // 5. 모의고사인 경우 현재 문제 과목 확인
  if (isMockExamPage() && window.questions && window.currentQuestionIndex !== undefined) {
    const currentQuestion = window.questions[window.currentQuestionIndex];
    if (currentQuestion && currentQuestion.subject) {
      return currentQuestion.subject;
    }
  }
  
  // 기본값으로 '알 수 없음' 반환
  return '알 수 없음';
}

/**
 * 현재 페이지에서 연도 정보 추출
 * @returns {string} 연도
 */
function getCurrentYearFromPage() {
  // 1. body 데이터 속성 확인
  const bodyYear = document.body.getAttribute('data-year');
  if (bodyYear) {
    return bodyYear;
  }
  
  // 2. 제목에서 추출 시도
  const titleElement = document.querySelector('.quiz-title h1, .quiz-title, h1');
  if (titleElement) {
    const titleText = titleElement.textContent;
    const yearMatch = titleText.match(/20\d\d/);
    if (yearMatch) {
      return yearMatch[0];
    }
  }
  
  // 3. URL에서 추출 시도
  const url = window.location.pathname;
  const urlYearMatch = url.match(/20\d\d/);
  if (urlYearMatch) {
    return urlYearMatch[0];
  }
  
  // 4. 쿼리 파라미터 확인
  const yearParam = getQueryParam('year');
  if (yearParam) {
    return yearParam;
  }
  
  // 기본값으로 현재 연도 반환
  return new Date().getFullYear().toString();
}

/**
 * 로컬 스토리지에 임시 저장
 * @param {Object} attemptData - 저장할 시도 데이터
 */
function storeLocalAttempt(attemptData) {
  try {
    // 기존 데이터 불러오기
    const localAttempts = JSON.parse(localStorage.getItem('pendingAttempts') || '[]');
    
    // 새로운 데이터 추가
    localAttempts.push({
      ...attemptData,
      timestamp: new Date().toISOString()
    });
    
    // 다시 저장
    localStorage.setItem('pendingAttempts', JSON.stringify(localAttempts));
    console.log('[quiz-data-handler] 로컬 저장소에 임시 저장됨:', attemptData);
    
    return true;
  } catch (error) {
    console.error('[quiz-data-handler] 로컬 저장 오류:', error);
    return false;
  }
}

/**
 * 로컬에 저장된 시도 데이터 동기화
 * @returns {Promise<Object>} 동기화 결과
 */
export async function syncLocalAttempts() {
  try {
    // 로컬 데이터 불러오기
    const localAttempts = JSON.parse(localStorage.getItem('pendingAttempts') || '[]');
    
    if (localAttempts.length === 0) {
      console.log('[quiz-data-handler] 동기화할 로컬 데이터가 없습니다.');
      return { success: true, count: 0 };
    }
    
    console.log(`[quiz-data-handler] ${localAttempts.length}개의 로컬 데이터 동기화 시작...`);
    
    // 각 항목 동기화
    const results = [];
    const newPendingAttempts = [];
    
    for (const attempt of localAttempts) {
      try {
        const result = await recordAttempt(
          attempt.questionData,
          attempt.userAnswer,
          attempt.isCorrect
        );
        
        if (result.success) {
          results.push({ success: true, id: result.attemptId });
        } else {
          results.push({ success: false, error: result.error });
          newPendingAttempts.push(attempt);
        }
      } catch (error) {
        results.push({ success: false, error: error.message });
        newPendingAttempts.push(attempt);
      }
    }
    
    // 실패한 항목만 다시 저장
    localStorage.setItem('pendingAttempts', JSON.stringify(newPendingAttempts));
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[quiz-data-handler] 동기화 완료: ${successCount}/${localAttempts.length} 성공`);
    
    return { 
      success: true, 
      count: localAttempts.length, 
      successCount: successCount,
      pendingCount: newPendingAttempts.length
    };
  } catch (error) {
    console.error('[quiz-data-handler] 로컬 데이터 동기화 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 자동 저장 초기화 - 업데이트된 버전
 */
export function initAutoSave() {
  console.log('[quiz-data-handler] 자동 저장 기능 초기화...');
  
  // 30초마다 동기화 시도
  setInterval(async () => {
    await syncLocalAttempts();
  }, 30000);
  
  // 페이지 로드 시 바로 동기화 시도
  setTimeout(async () => {
    await syncLocalAttempts();
  }, 3000);
  
  // 문제 풀이 이벤트에 대한 리스너 자동 설정
  autoSetupQuizEventListeners();
  
  console.log('[quiz-data-handler] 자동 저장 기능 초기화 완료');
}

/**
 * 퀴즈 이벤트 리스너 자동 설정
 */
function autoSetupQuizEventListeners() {
  // 옵션 버튼 클릭 감지
  document.querySelectorAll('.option-button').forEach((button, index) => {
    // 이미 이벤트 핸들러가 있는지 확인
    if (!button.getAttribute('data-handler-added')) {
      button.setAttribute('data-handler-added', 'true');
      
      button.addEventListener('click', () => {
        if (window.questions && window.currentQuestionIndex !== undefined && window.userAnswers) {
          const questionData = {
            year: getCurrentYearFromPage(),
            subject: getCurrentSubjectFromPage(),
            number: window.currentQuestionIndex + 1,
            isFromMockExam: isMockExamPage(),
            mockExamPart: isMockExamPage() ? extractMockExamPart() : null
          };
          
          // 정답 확인 (다양한 필드명 처리)
          const currentQuestion = window.questions[window.currentQuestionIndex];
          const selectedAnswer = index;
          let correctAnswer;
          
          // correctAnswer, correctOption, correct 필드 중 하나 사용
          if (currentQuestion.correctAnswer !== undefined) {
            correctAnswer = currentQuestion.correctAnswer;
          } else if (currentQuestion.correctOption !== undefined) {
            correctAnswer = currentQuestion.correctOption;
          } else if (currentQuestion.correct !== undefined) {
            correctAnswer = currentQuestion.correct;
          } else {
            correctAnswer = null;
          }
          
          const isCorrect = correctAnswer !== null && selectedAnswer === correctAnswer;
          
          // 문제 풀이 결과 저장
          recordAttempt(questionData, selectedAnswer, isCorrect)
            .then(result => {
              console.log('[quiz-data-handler] 문제 풀이 자동 저장됨:', result);
            })
            .catch(error => {
              console.error('[quiz-data-handler] 문제 풀이 자동 저장 오류:', error);
              // 오류 시 로컬 저장
              storeLocalAttempt({
                questionData,
                userAnswer: selectedAnswer,
                isCorrect
              });
            });
        }
      });
    }
  });
  
  // 정답 확인 버튼에 이벤트 추가
  const checkButton = document.getElementById('check-button');
  if (checkButton && !checkButton.getAttribute('data-handler-added')) {
    checkButton.setAttribute('data-handler-added', 'true');
    
    // 원래 이벤트 핸들러 백업
    const originalOnClick = checkButton.onclick;
    
    // 새 이벤트 핸들러 설정
    checkButton.onclick = function() {
      // 원래 함수 호출
      if (typeof originalOnClick === 'function') {
        originalOnClick.call(this);
      } else if (typeof window.checkAnswer === 'function') {
        window.checkAnswer();
      } else if (typeof window.showCurrentAnswer === 'function') {
        window.showCurrentAnswer();
      }
      
      // 데이터 자동 저장 시도 - 피드백 내용 사용
      try {
        const feedback = document.getElementById('feedback');
        if (feedback && feedback.style.display !== 'none') {
          const isCorrect = feedback.classList.contains('correct-feedback');
          
          if (window.questions && window.currentQuestionIndex !== undefined) {
            const questionData = {
              year: getCurrentYearFromPage(),
              subject: getCurrentSubjectFromPage(),
              number: window.currentQuestionIndex + 1,
              isFromMockExam: isMockExamPage(),
              mockExamPart: isMockExamPage() ? extractMockExamPart() : null
            };
            
            const userAnswer = window.userAnswers?.[window.currentQuestionIndex] ?? 0;
            
            recordAttempt(questionData, userAnswer, isCorrect)
              .then(result => {
                console.log('[quiz-data-handler] 정답 확인 후 자동 저장됨:', result);
              })
              .catch(error => {
                console.error('[quiz-data-handler] 정답 확인 후 자동 저장 오류:', error);
                storeLocalAttempt({
                  questionData,
                  userAnswer,
                  isCorrect
                });
              });
          }
        }
      } catch (error) {
        console.error('[quiz-data-handler] 정답 확인 핸들러 오류:', error);
      }
    };
  }
}

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.recordQuizData = recordQuizData;
  window.initAutoSave = initAutoSave;
  window.syncLocalAttempts = syncLocalAttempts;
}

export default {
  recordQuizData,
  initAutoSave,
  syncLocalAttempts
};