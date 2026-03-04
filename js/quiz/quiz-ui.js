// quiz-ui.js - 퀴즈 UI 관련 함수

/**
 * 선택된 옵션 UI 업데이트
 * @param {number} selectedIndex - 선택된 옵션 인덱스
 */
export function updateSelectedOptionUI(selectedIndex) {
  const optionButtons = document.querySelectorAll('.option-button');
  optionButtons.forEach((button, index) => {
    button.classList.remove('selected');
    if (index === selectedIndex) {
      button.classList.add('selected');
    }
  });
}

/**
 * 정답 확인 결과 표시
 * @param {Object} result - 결과 객체
 */
export function displayAnswerFeedback(result) {
  if (result.status === 'no-answer') {
    alert('답을 선택해주세요.');
    return;
  }
  
  // ✅ 임시: 구독 기능 완전 구현 전까지 모두에게 해설 표시
  const isPremium = true; // 임시로 모두에게 허용
  
  // 해설 표시
  let explanationHTML = `<div class="explanation">${result.explanation}</div>`;
  
  const feedback = document.getElementById('feedback');
  feedback.className = `answer-feedback ${result.isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`;
  feedback.innerHTML = `
    <div class="feedback-title">
      <span class="feedback-icon">${result.isCorrect ? '✓' : '✗'}</span>
      <span>${result.isCorrect ? '정답입니다!' : '오답입니다!'}</span>
    </div>
    ${!result.isCorrect ? `<div class="correct-answer">정답: ${result.correctAnswerText}번</div>` : ''}
    ${explanationHTML}
  `;
  feedback.style.display = 'block';
}

/**
 * 문제 인디케이터 초기화
 * @param {number} questionCount - 문제 수
 * @param {Function} onIndicatorClick - 인디케이터 클릭 핸들러
 */
export function initQuestionIndicators(questionCount, onIndicatorClick) {
  const container = document.getElementById('question-indicators');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < questionCount; i++) {
    const indicator = document.createElement('div');
    indicator.className = 'indicator';
    indicator.textContent = i + 1;
    indicator.setAttribute('data-index', i);
    
    indicator.addEventListener('click', () => {
      if (typeof onIndicatorClick === 'function') {
        onIndicatorClick(i);
      }
    });
    
    container.appendChild(indicator);
  }
}

/**
 * 문제 인디케이터 상태 업데이트
 * @param {number} currentIndex - 현재 문제 인덱스
 * @param {Array} userAnswers - 사용자 답변 배열
 * @param {boolean} reviewMode - 리뷰 모드 여부
 * @param {Array} questions - 문제 배열
 */
export function updateQuestionIndicators(currentIndex, userAnswers, reviewMode, questions) {
  const indicators = document.querySelectorAll('.indicator');
  if (!indicators) return;
  
  indicators.forEach((indicator, index) => {
    indicator.className = 'indicator';
    
    if (index === currentIndex) {
      indicator.classList.add('current');
    }
    
    if (userAnswers[index] !== null && userAnswers[index] !== undefined) {
      if (reviewMode && questions) {
        // 리뷰 모드에서는 정답/오답 표시
        const correctAnswer = questions[index].correctAnswer !== undefined 
          ? questions[index].correctAnswer 
          : (questions[index].correct !== undefined ? questions[index].correct : null);
        
        if (correctAnswer !== null) {
          indicator.classList.add(userAnswers[index] === correctAnswer ? 'correct' : 'incorrect');
        } else {
          indicator.classList.add('answered');
        }
      } else {
        // 일반 모드에서는 답변함 표시
        indicator.classList.add('answered');
      }
    }
  });
}

/**
 * 진행 상황 표시 업데이트
 * @param {number} currentIndex - 현재 문제 인덱스
 * @param {number} totalQuestions - 전체 문제 수
 */
export function updateProgressDisplay(currentIndex, totalQuestions) {
  const progressCount = document.getElementById('progress-count');
  const progressBar = document.getElementById('progress-bar');
  if (!progressCount || !progressBar) return;
  
  const currentNumber = currentIndex + 1;
  const progress = (currentNumber / totalQuestions) * 100;
  
  progressCount.textContent = `${currentNumber} / ${totalQuestions}`;
  progressBar.style.width = `${progress}%`;
}

/**
 * 네비게이션 버튼 상태 업데이트
 * @param {number} currentIndex - 현재 문제 인덱스
 * @param {number} totalQuestions - 전체 문제 수
 * @param {boolean} allAnswered - 모든 문제 답변 여부
 */
export function updateNavButtons(currentIndex, totalQuestions, allAnswered) {
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');
  const submitButton = document.getElementById('submit-button');
  
  if (!prevButton || !nextButton || !submitButton) return;
  
  prevButton.disabled = currentIndex === 0;
  prevButton.classList.toggle('disabled', currentIndex === 0);
  
  nextButton.disabled = currentIndex === totalQuestions - 1;
  nextButton.classList.toggle('disabled', currentIndex === totalQuestions - 1);
  
  // 모든 문제에 답변했으면 제출 버튼 표시
  if (allAnswered) {
    submitButton.style.display = 'inline-block';
    nextButton.style.display = 'none';
  } else {
    nextButton.style.display = 'inline-block';
    submitButton.style.display = 'none';
  }
}

/**
 * 타이머 표시 업데이트
 * @param {number} timeRemaining - 남은 시간(초)
 */
export function updateTimerDisplay(timeRemaining) {
  const timerElement = document.getElementById('timer');
  if (!timerElement) return;
  
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  
  timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // 시간이 얼마 남지 않았을 때 경고 스타일 적용
  if (timeRemaining <= 60) {
    timerElement.classList.add('timer-warning');
  } else {
    timerElement.classList.remove('timer-warning');
  }
}

/**
 * 결과 화면 표시
 * @param {number} correctCount - 정답 개수
 * @param {number} totalQuestions - 전체 문제 수
 * @param {number} answeredCount - 답변한 문제 수
 * @param {string} timeRemaining - 남은 시간
 */
export function showResultsUI(correctCount, totalQuestions, answeredCount, timeRemaining) {
  // 점수 계산 (문제당 5점)
  const score = correctCount * 5;
  const maxScore = totalQuestions * 5;
  
  // 현재 페이지에서 연도와 과목 정보 추출
  const year = document.body.getAttribute('data-year') || new Date().getFullYear();
  const subject = document.body.getAttribute('data-current-subject') || '미지정';
  
  // 현재 날짜
  const today = new Date();
  const dateString = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  
  const resultsContainer = document.getElementById('results-summary');
  if (!resultsContainer) return;
  
  resultsContainer.innerHTML = `
    <div class="results-title">📘 문제 풀이 결과</div>
    <div class="results-details">
      <div class="result-row"><span>과목:</span> <strong>${subject}</strong></div>
      <div class="result-row"><span>년도:</span> <strong>${year}년</strong></div>
      <div class="result-row"><span>풀이 날짜:</span> <strong>${dateString}</strong></div>
      <div class="result-row"><span>풀이 완료:</span> <strong>${answeredCount}문제</strong> (총 ${totalQuestions}문제 중)</div>
      <div class="result-row result-score"><span>총점:</span> <strong>${score}점</strong> (${maxScore}점 만점)</div>
    </div>
    <div class="score-display">
      <div class="score-card">
        <div class="score-label">점수</div>
        <div class="score-value">${score}<span class="score-point">점</span></div>
      </div>
    </div>
    <div class="time-taken">
      남은 시간: ${timeRemaining}
    </div>
    <div class="results-message">
      총 ${totalQuestions}문제 중 ${correctCount}문제 맞췄어요! (${score}점)
      <p>${getScoreComment(score)}</p>
    </div>
    <div class="results-actions">
      <button id="review-button" class="action-button review-button">오답 확인하기</button>
      <button id="retry-button" class="action-button retry-button">다시 풀어볼래요</button>
    </div>
  `;
  
  // 퀴즈 컨테이너 숨기기 및 결과 표시
  document.getElementById('quiz-container').style.display = 'none';
  resultsContainer.style.display = 'block';
  
  // 리뷰 및 재시도 버튼에 이벤트 리스너 추가
  const reviewButton = document.getElementById('review-button');
  const retryButton = document.getElementById('retry-button');
  
  if (reviewButton) {
    reviewButton.addEventListener('click', () => {
      if (typeof window.reviewQuiz === 'function') {
        window.reviewQuiz();
      }
    });
  }
  
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      if (typeof window.resetQuiz === 'function') {
        window.resetQuiz();
      }
    });
  }
}

/**
 * 오답 리뷰 UI 준비
 * @param {number} incorrectCount - 오답 문제 수
 * @param {number} currentIndex - 현재 인덱스 (0부터 시작)
 */
export function setupReviewModeUI(incorrectCount, currentIndex) {
  // 리뷰 모드 메시지 추가
  const progressContainer = document.querySelector('.progress-container');
  const existingMsg = document.querySelector('.review-mode-message');
  
  if (existingMsg) existingMsg.remove();
  
  // 진행 컨테이너가 없으면 종료
  if (!progressContainer) return;
  
  const reviewMessage = document.createElement('div');
  reviewMessage.className = 'review-mode-message';
  reviewMessage.innerHTML = `
    <div class="review-mode-title">📝 오답 리뷰 모드</div>
    <div class="review-mode-info">틀린 ${incorrectCount}문제를 확인하세요 (${currentIndex + 1}/${incorrectCount})</div>
  `;
  
  progressContainer.prepend(reviewMessage);
  
  // 리뷰 종료 버튼 추가
  const navButtons = document.querySelector('.navigation-buttons');
  if (!navButtons) return;
  
  let exitButton = document.querySelector('.exit-review-button');
  if (!exitButton) {
    exitButton = document.createElement('button');
    exitButton.className = 'nav-button exit-review-button';
    exitButton.textContent = '리뷰 종료';
    
    exitButton.addEventListener('click', () => {
      if (typeof window.exitReviewMode === 'function') {
        window.exitReviewMode();
      }
    });
    
    navButtons.appendChild(exitButton);
  }
}

/**
 * 오답 인디케이터 스타일 추가
 */
export function addIncorrectIndicatorStyle() {
  const styleId = 'incorrect-indicators-style';
  let indicatorStyle = document.getElementById(styleId);
  
  if (!indicatorStyle) {
    indicatorStyle = document.createElement('style');
    indicatorStyle.id = styleId;
    indicatorStyle.innerHTML = `
      .indicator.incorrect {
        background-color: #ffcdd2 !important;
        border: 2px solid #f44336 !important;
        color: #d32f2f !important;
      }
      .indicator.incorrect.current {
        background-color: #f44336 !important;
        color: white !important;
        border: 2px solid #d32f2f !important;
        transform: scale(1.15);
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
      }
      .indicator:not(.incorrect) {
        opacity: 0.4;
      }
    `;
    
    document.head.appendChild(indicatorStyle);
  }
}

/**
 * 결과 화면 스타일 추가
 */
export function addResultsStyle() {
  const styleId = 'results-style';
  let resultStyle = document.getElementById(styleId);
  
  if (!resultStyle) {
    resultStyle = document.createElement('style');
    resultStyle.id = styleId;
    resultStyle.innerHTML = `
      .results-details {
        background-color: #f5f5f5;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 20px;
        border-left: 4px solid #4285f4;
      }
      .result-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #eaeaea;
      }
      .result-row:last-child {
        border-bottom: none;
      }
      .result-row span {
        color: #555;
        font-weight: bold;
      }
      .result-score {
        font-size: 1.2em;
        color: #4285f4;
        margin-top: 5px;
      }
      .result-score strong {
        color: #4285f4;
      }
    `;
    
    document.head.appendChild(resultStyle);
  }
}

/**
 * 점수에 따른 코멘트 반환
 * @param {number} score - 획득 점수
 * @returns {string} 코멘트
 */
function getScoreComment(score) {
  if (score >= 90) return '와~ 정말 대단해요! 거의 완벽하게 풀었네요!';
  if (score >= 80) return '잘했어요! 합격이고 높은 점수를 받았어요~';
  if (score >= 60) return '합격이에요! 60점이 합격 기준이니 통과했어요. 조금 더 연습하면 좋을 것 같아요.';
  if (score >= 40) return '아쉽게도 탈락이에요. 60점이 합격 기준인데 조금 더 노력해봐요!';
  return '40점 미만은 시험 탈락 기준이에요. 다시 공부해서 도전해보는 건 어떨까요?';
}

export default {
  updateSelectedOptionUI,
  displayAnswerFeedback,
  initQuestionIndicators,
  updateQuestionIndicators,
  updateProgressDisplay,
  updateNavButtons,
  updateTimerDisplay,
  showResultsUI,
  setupReviewModeUI,
  addIncorrectIndicatorStyle,
  addResultsStyle
};