// exam-page.js - 문제 페이지 컨트롤러

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../core/firebase-core.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { updateLoginUI, updateRestrictedContent } from "../auth/auth-ui.js";
import { 
  initializeQuiz, loadQuestion, selectOption, 
  checkAnswer, calculateScore, getIncorrectQuestions, 
  goToNextQuestion, goToPreviousQuestion, submitQuiz, 
  showCurrentAnswer
} from "../quiz/quiz-core.js";

/**
 * 문제 페이지 초기화
 */
async function initExamPage() {
  console.log('문제 페이지 초기화...');
  
  // 현재 페이지에서 연도와 과목 정보 추출
  const year = document.body.getAttribute('data-year') || '';
  const subject = document.body.getAttribute('data-current-subject') || '';
  
  console.log(`현재 페이지: ${year}년 ${subject} 기출문제`);
  
  // 뒤로가기 링크 설정
  setupBackLink();
  
  // 로그인 상태에 따른 제한된 콘텐츠 처리
  updateRestrictedContent(isUserLoggedIn());
  
  // 이벤트 핸들러 등록
  setupEventHandlers();
  
  try {
    // 퀴즈 초기화
    console.log('퀴즈 초기화 중...');
    await initializeQuiz();
    console.log('퀴즈 초기화 완료');
  } catch (error) {
    console.error('퀴즈 초기화 실패:', error);
    alert('퀴즈를 로드하는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.');
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
  const checkBtn = document.getElementById('check-button');
  if (checkBtn) {
    // 라벨을 "이 문제 정답 보기"로 통일
    checkBtn.textContent = '이 문제 정답 보기';
    checkBtn.addEventListener('click', showCurrentAnswer);
  }
  
  // 결과 확인 버튼
  document.getElementById('submit-button').addEventListener('click', submitQuiz);
  
  // 데이터 속성을 사용한 액션 버튼들
  document.querySelectorAll('[data-action]').forEach(element => {
    element.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      switch (action) {
        case 'show-answer':
          showCurrentAnswer();
          break;
        // 필요한 경우 다른 액션 추가
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
      submitQuiz();
    } else {
      showCurrentAnswer();
    }
  }
}

/**
 * 뒤로가기 링크 설정
 */
function setupBackLink() {
  // URL 파라미터 읽기
  const searchParams = new URLSearchParams(window.location.search);
  const prevParam = searchParams.get('prev');   // 'year'?
  const yearParam = searchParams.get('year');   // '2024'?
  const subjectParam = searchParams.get('subject'); // '건강체력평가'?
  
  // 현재 과목명
  const currentSubject = document.body.getAttribute('data-current-subject') || '건강체력평가';
  
  const backLink = document.querySelector('.back-link');
  if (!backLink) return;
  
  // 만약 prev=year & year=2024 처럼 들어왔다면 → 연도별 페이지로 돌아가기
  if (prevParam === 'year' && yearParam) {
    backLink.href = `../years/year_${yearParam}.html`;
  } 
  // 아니면 과목 페이지로 돌아가기
  else if (prevParam === 'subject' && subjectParam) {
    backLink.href = `../subjects/subject_${subjectParam}.html`;
  } 
  // 기본값: 해당 과목 페이지
  else {
    backLink.href = `../subjects/subject_${currentSubject}.html`;
  }
}

/**
 * 인증 상태 변경 감지 및 처리
 */
function setupAuthStateListener() {
  onAuthStateChanged(auth, user => {
    console.log('인증 상태 변경:', user ? '로그인됨' : '로그아웃 상태');
    
    if (user) {
      // 로그인 상태 저장
      localStorage.setItem('userLoggedIn', 'true');
      localStorage.setItem('userName', user.displayName || user.email || '사용자');
    } else {
      // 로그아웃 상태 처리
      localStorage.removeItem('userLoggedIn');
      localStorage.removeItem('userName');
      
      // 제한된 페이지이므로 로그인 페이지로 리디렉션
      setTimeout(() => {
        if (!isUserLoggedIn()) {
          window.location.href = '../index.html';
        }
      }, 500);
    }
    
    // 로그인 UI 업데이트
    updateLoginUI();
    
    // 제한된 콘텐츠 업데이트
    updateRestrictedContent(!!user);
  });
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initExamPage();
  setupAuthStateListener();
});

// 전역으로 함수 노출 (기존 인라인 이벤트 핸들러와의 호환성 유지)
window.selectOption = selectOption;
window.checkAnswer = checkAnswer;
window.goToNextQuestion = goToNextQuestion;
window.goToPreviousQuestion = goToPreviousQuestion;
window.submitQuiz = submitQuiz;
window.showCurrentAnswer = showCurrentAnswer;