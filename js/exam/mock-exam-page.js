// mock-exam-page.js - 모의고사 페이지 컨트롤러
// ⚠️ DEPRECATED: 이 파일은 어떤 HTML에서도 로드되지 않는 고아 파일입니다.
// 실제 모의고사 로직은 js/quiz/mock-exam.js (IIFE)에 구현되어 있습니다.
// 이 파일을 수정해도 사용자에게 영향이 없습니다.

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../core/firebase-core.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { showLoginModal, closeLoginModal, updateLoginUI, updateRestrictedContent } from "../auth/auth-ui.js";
import { recordMockExamResults } from "../quiz/quiz-repository.js";
import { 
  initializeQuiz, loadQuestion, selectOption, 
  checkAnswer, calculateScore, getIncorrectQuestions, 
  goToNextQuestion, goToPreviousQuestion, submitQuiz, 
  showCurrentAnswer
} from "../quiz/quiz-core.js";

// 모의고사 전역 상태
let currentSubject = 'all';
let subjectQuestions = {};
let allQuestions = [];
let filteredQuestions = [];
let subjectCounts = {
  '운동생리학': 0,
  '건강체력평가': 0, 
  '운동처방론': 0, 
  '운동부하검사': 0
};

/**
 * 모의고사 페이지 초기화
 */
async function initMockExamPage() {
  console.log('모의고사 페이지 초기화...');
  
  // 현재 페이지에서 연도와 교시 정보 추출
  const year = document.body.getAttribute('data-year') || '';
  const hour = document.body.getAttribute('data-hour') || '';
  
  console.log(`현재 페이지: ${year}년 모의고사 ${hour}교시`);
  
  // 뒤로가기 링크 설정
  setupBackLink();
  
  // 로그인 상태에 따른 제한된 콘텐츠 처리
  updateRestrictedContent(isUserLoggedIn());
  
  // 이벤트 핸들러 등록
  setupEventHandlers();
  
  try {
    // 모의고사 초기화
    console.log('모의고사 초기화 중...');
    await initializeMockExam();
    console.log('모의고사 초기화 완료');
  } catch (error) {
    console.error('모의고사 초기화 실패:', error);
    alert('모의고사를 로드하는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.');
  }
}

/**
 * 모의고사 초기화 (문제 로드 및 UI 설정)
 */
async function initializeMockExam() {
  // 기본 퀴즈 초기화 (일반 함수 사용)
  await initializeQuiz();
  
  // 문제 로드 후 과목별로 분류
  categorizeQuestionsBySubject();
  
  // 과목 탭 초기화
  initSubjectTabs();
  
  // 전역 변수 노출
  window.filteredQuestions = filteredQuestions;
  window.allQuestions = allQuestions;
  window.subjectQuestions = subjectQuestions;
}

/**
 * 문제를 과목별로 분류
 */
function categorizeQuestionsBySubject() {
  // window.questions는 퀴즈 초기화에서 로드된 전체 문제
  allQuestions = window.questions || [];
  
  // 과목별로 문제 분류
  subjectQuestions = {
    '운동생리학': [],
    '건강체력평가': [],
    '운동처방론': [],
    '운동부하검사': []
  };
  
  // 각 문제를 과목별로 분류
  allQuestions.forEach((question, index) => {
    const subject = question.subject;
    if (subject && subjectQuestions[subject]) {
      subjectQuestions[subject].push({
        question: question,
        originalIndex: index
      });
      subjectCounts[subject]++;
    }
  });
  
  console.log('과목별 문제 분류 완료:', subjectCounts);
  
  // 기본적으로 전체 문제 표시
  filteredQuestions = allQuestions;
  window.questions = allQuestions;
}

/**
 * 과목 탭 초기화
 */
function initSubjectTabs() {
  const tabs = document.querySelectorAll('.subject-tab');
  
  // 과목 탭 클릭 이벤트 추가
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // 탭 활성화 상태 변경
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // 과목 필터링
      const subject = this.getAttribute('data-subject');
      filterQuestionsBySubject(subject);
    });
    
    // 과목별 문제 개수 업데이트
    const subject = tab.getAttribute('data-subject');
    if (subject !== 'all') {
      const count = subjectCounts[subject] || 0;
      if (count > 0) {
        // 탭에 문제 개수 표시
        const countBadge = document.createElement('span');
        countBadge.className = 'subject-count';
        countBadge.textContent = count;
        tab.appendChild(countBadge);
      }
    }
  });
}

/**
 * 과목별 문제 필터링
 * @param {string} subject - 과목명 ('all'이면 전체 문제)
 */
function filterQuestionsBySubject(subject) {
  currentSubject = subject;
  
  // 모든 문제 표시 모드
  if (subject === 'all') {
    filteredQuestions = allQuestions;
    window.questions = allQuestions;
    window.currentQuestionIndex = 0;
    loadQuestion(0);
    
    // 인디케이터 업데이트
    updateQuestionIndicators();
    return;
  }
  
  // 특정 과목 필터링
  if (subjectQuestions[subject]) {
    filteredQuestions = subjectQuestions[subject].map(item => item.question);
    
    // 과목 필터링 시 관련 인덱스 매핑 업데이트
    window.questionIndexMap = subjectQuestions[subject].map(item => item.originalIndex);
    window.questions = filteredQuestions;
    window.currentQuestionIndex = 0;
    
    // 첫 번째 문제 로드
    loadQuestion(0);
    
    // 인디케이터 업데이트
    updateQuestionIndicators();
    
    // 과목 배지 업데이트
    updateSubjectBadge(subject);
  }
}

/**
 * 과목 배지 업데이트
 * @param {string} subject - 과목명
 */
function updateSubjectBadge(subject) {
  const badge = document.getElementById('subject-badge');
  if (badge) {
    badge.textContent = subject;
    badge.style.display = (subject === 'all') ? 'none' : 'block';
  }
}

/**
 * 문제 인디케이터 업데이트 (확장 버전)
 */
function updateQuestionIndicators() {
  const container = document.getElementById('question-indicators');
  if (!container) return;
  
  // 인디케이터 컨테이너 초기화
  container.innerHTML = '';
  
  // 현재 필터링된 문제 배열 사용
  const questions = filteredQuestions || [];
  
  for (let i = 0; i < questions.length; i++) {
    const indicator = document.createElement('div');
    indicator.className = 'indicator';
    if (i === window.currentQuestionIndex) {
      indicator.classList.add('current');
    }
    
    // 답변한 문제 표시
    if (window.userAnswers[i] !== null && window.userAnswers[i] !== undefined) {
      indicator.classList.add('answered');
    }
    
    indicator.textContent = i + 1;
    
    // 클릭 이벤트
    indicator.addEventListener('click', () => {
      window.currentQuestionIndex = i;
      loadQuestion(i);
      updateQuestionIndicators();
    });
    
    container.appendChild(indicator);
  }
  
  // 과목 배지 업데이트
  if (currentSubject !== 'all') {
    updateSubjectBadge(currentSubject);
  } else {
    // 전체 보기 모드에서는 현재 문제의 과목 표시
    const currentQuestion = questions[window.currentQuestionIndex];
    if (currentQuestion && currentQuestion.subject) {
      updateSubjectBadge(currentQuestion.subject);
    }
  }
}

/**
 * 이벤트 핸들러 등록
 */
function setupEventHandlers() {
  // 선택지 버튼에 이벤트 리스너 등록
  document.querySelectorAll('.option-button').forEach(button => {
    button.addEventListener('click', function() {
      const optionIndex = parseInt(this.getAttribute('data-option'));
      selectOption(optionIndex);
    });
  });
  
  // 이전/다음 버튼
  document.getElementById('prev-button').addEventListener('click', goToPreviousQuestion);
  document.getElementById('next-button').addEventListener('click', goToNextQuestion);
  
  // 정답 보기 버튼
  document.getElementById('check-button').addEventListener('click', showCurrentAnswer);
  
  // 결과 확인 버튼
  document.getElementById('submit-button').addEventListener('click', submitMockExam);
  
  // 데이터 속성을 사용한 액션 버튼들
  document.querySelectorAll('[data-action]').forEach(element => {
    element.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      switch (action) {
        case 'show-answer':
          showCurrentAnswer();
          break;
        case 'close-modal':
          closeLoginModal();
          break;
        case 'show-login':
          showLoginModal();
          break;
      }
    });
  });
  
  // 키보드 내비게이션
  document.addEventListener('keydown', handleKeyboardNavigation);
}

/**
 * 키보드 입력 처리
 * @param {KeyboardEvent} event - 키보드 이벤트
 */
function handleKeyboardNavigation(event) {
  // 편집 가능한 요소(input, textarea, contenteditable)에 포커스가 있으면 무시
  const activeElement = document.activeElement;
  const isEditable = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable ||
    activeElement.contentEditable === 'true'
  );
  
  if (isEditable) {
    return; // 편집 가능한 요소에 포커스가 있으면 키보드 이벤트 무시
  }

  // 모달이 열려있으면 무시
  if (document.querySelector('.modal.show')) return;
  
  // 결과 화면이 표시된 경우 무시
  const quizContainer = document.getElementById('quiz-container');
  if (!quizContainer || quizContainer.style.display === 'none') return;
  
  if (event.key >= '1' && event.key <= '4') {
    // 1-4 키: 해당 번호의 보기 선택
    event.preventDefault();
    selectOption(parseInt(event.key) - 1);
  } else if (event.key === 'ArrowLeft') {
    // 왼쪽 화살표: 이전 문제
    const prevButton = document.getElementById('prev-button');
    if (prevButton && !prevButton.disabled) {
      event.preventDefault();
      goToPreviousQuestion();
    }
  } else if (event.key === 'ArrowRight') {
    // 오른쪽 화살표: 다음 문제
    const nextButton = document.getElementById('next-button');
    if (nextButton && !nextButton.disabled) {
      event.preventDefault();
      goToNextQuestion();
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    // Enter 또는 Space: 정답 확인 또는 제출
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    if (submitButton && submitButton.style.display !== 'none') {
      submitMockExam();
    } else {
      showCurrentAnswer();
    }
  }
}

/**
 * 모의고사 제출 (결과 저장 추가)
 */
function submitMockExam() {
  // 기본 제출 함수 호출
  submitQuiz();
  
  // 과목별 결과 계산 및 저장
  saveMockExamResults();
}

/**
 * 모의고사 결과 저장
 */
async function saveMockExamResults() {
  try {
    // 모의고사 정보 수집
    const year = document.body.getAttribute('data-year') || new Date().getFullYear().toString();
    const hour = document.body.getAttribute('data-hour') || '1';
    
    // 모의고사 결과 데이터 준비
    const totalQuestions = allQuestions.length;
    const correctCount = calculateScore();
    const score = Math.round((correctCount / totalQuestions) * 100);
    
    // 과목별 결과 계산
    const subjectResults = {};
    
    Object.keys(subjectCounts).forEach(subject => {
      const subjectQuestionIndices = subjectQuestions[subject].map(item => item.originalIndex);
      const subjectAnswers = subjectQuestionIndices.map(index => window.userAnswers[index]);
      const subjectCorrectCount = subjectAnswers.filter((answer, i) => {
        const question = allQuestions[subjectQuestionIndices[i]];
        const correctAnswer = question.correctAnswer !== undefined ? 
                             question.correctAnswer : 
                             (question.correct !== undefined ? question.correct : null);
        return answer === correctAnswer;
      }).length;
      
      subjectResults[subject] = {
        totalQuestions: subjectCounts[subject],
        correctCount: subjectCorrectCount,
        score: Math.round((subjectCorrectCount / subjectCounts[subject]) * 100)
      };
    });
    
    // 타이머에서 남은 시간 가져오기
    const timerElement = document.getElementById('timer');
    const completionTime = timerElement ? timerElement.textContent : '00:00';
    
    // 모의고사 결과 데이터
    const resultData = {
      examId: `mockexam_${year}_${hour}`,
      examTitle: `${year}년 모의고사 ${hour}교시`,
      year,
      hour,
      totalQuestions,
      correctCount,
      score,
      completionTime,
      subjectResults,
      subjects: Object.keys(subjectCounts)
    };
    
    // 결과 저장
    const saveResult = await recordMockExamResults(resultData);
    
    if (saveResult.success) {
      console.log('모의고사 결과가 성공적으로 저장되었습니다:', saveResult);
      
      // 이벤트 발생 (결과 저장 완료)
      document.dispatchEvent(new CustomEvent('mockExamCompleted', {
        detail: {
          examId: saveResult.examId,
          resultId: saveResult.resultId,
          ...resultData
        }
      }));
    } else {
      console.error('모의고사 결과 저장 실패:', saveResult.error);
    }
  } catch (error) {
    console.error('모의고사 결과 저장 중 오류:', error);
  }
}

/**
 * 뒤로가기 링크 설정
 */
function setupBackLink() {
  const backLink = document.querySelector('.back-link');
  if (!backLink) return;

  // referrer가 index.html이면 학습진행률 탭으로 돌아가기
  const referrer = document.referrer || '';
  if (referrer.includes('index.html') || referrer.endsWith('/') || referrer.endsWith('.com')) {
    backLink.href = '../index.html#analytics-tab';
    return;
  }

  // 그 외: 연도 페이지로
  const year = document.body.getAttribute('data-year');
  if (year) {
    backLink.href = `../years/year_${year}.html`;
  } else {
    backLink.href = '../index.html';
  }
}

/**
 * 인증 상태 변경 감지 및 처리
 */
async function setupAuthStateListener() {
  // Firebase 초기화 확인
  const { ensureFirebase } = await import('../core/firebase-core.js');
  const firebase = await ensureFirebase().catch(() => null);
  const authInstance = firebase ? firebase.auth : auth;
  
  if (!authInstance) {
    console.warn('Firebase 인증이 초기화되지 않았습니다. 인증 상태 감지를 건너뜁니다.');
    return;
  }
  
  onAuthStateChanged(authInstance, user => {
    console.log('인증 상태 변경:', user ? '로그인됨' : '로그아웃 상태');
    
    if (user) {
      // 로그인 상태 저장
      localStorage.setItem('userLoggedIn', 'true');
      localStorage.setItem('userName', user.displayName || user.email || '사용자');
    } else {
      // 로그아웃 상태 처리
      localStorage.removeItem('userLoggedIn');
      localStorage.removeItem('userName');
      
      // 제한된 페이지에서는 모달 표시만 하고 리디렉션은 하지 않음
      const modal = document.getElementById('login-required-modal');
      if (modal) modal.style.display = 'flex';
    }
    
    // 로그인 UI 업데이트
    updateLoginUI();
    
    // 제한된 콘텐츠 업데이트
    updateRestrictedContent(!!user);
  });
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initMockExamPage();
  setupAuthStateListener();
});

// 전역으로 함수 노출 (기존 인라인 이벤트 핸들러와의 호환성 유지)
window.selectOption = selectOption;
window.checkAnswer = checkAnswer;
window.goToNextQuestion = goToNextQuestion;
window.goToPreviousQuestion = goToPreviousQuestion;
// ⚠️ window.submitQuiz 덮어쓰기 제거 — mock-exam.js IIFE의 submitQuiz가 단독 진입점
// window.submitQuiz = submitMockExam;  ← 제거됨 (M1)
window.showCurrentAnswer = showCurrentAnswer;
window.filterQuestionsBySubject = filterQuestionsBySubject;