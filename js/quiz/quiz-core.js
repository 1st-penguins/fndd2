// quiz-core.js - 퀴즈 기능 핵심 코드

import { recordAttempt, batchRecordAttempts } from "../data/quiz-repository.js";
import { formatTimeFromSeconds } from "../utils/date-utils.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";
import { sessionManager } from '../data/session-manager.js';
import { auth } from "../core/firebase-core.js";
import { saveWrongAnswer, markAsResolved } from "./wrong-note-service.js";
import { saveBookmark, removeBookmark, isBookmarked } from "./bookmark-service.js";

/* ===== 전역 변수 설정 ===== */
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let perQuestionChecked = []; // 각 문제에서 정답 확인을 눌렀는지 여부
let timerInterval;
let totalTime = 20 * 60;    // 총 시간 (초 단위: 20분)
let timeRemaining = totalTime;
let reviewMode = false;     // 오답 리뷰 모드 여부
let firstAttemptTracking = []; // 문제별 첫 시도 추적 배열
let currentYear = '';
let currentSubject = '';

// HTML에서 접근할 수 있도록 전역 변수들을 window 객체에 추가
window.questions = questions;
window.currentQuestionIndex = currentQuestionIndex;
window.userAnswers = userAnswers;
window.timerInterval = timerInterval;
window.totalTime = totalTime;
window.timeRemaining = timeRemaining;
window.reviewMode = reviewMode;
window.firstAttemptTracking = firstAttemptTracking;

// 북마크 상태 캐시 (페이지 세션 내)
const _bookmarkCache = new Map();

function _getQuestionId(question, displayNum) {
  // 항상 연도+과목+번호로 고유 ID 생성 (자격증/과목 간 충돌 방지)
  const subject = question.subject || currentSubject || '';
  const year = question.year || currentYear || '';
  const num = question.id || displayNum;
  return `${year}_${subject}_${num}`;
}

function _renderBookmarkButton(question, displayNum) {
  const qNumEl = document.querySelector('.question-number');
  if (!qNumEl) return;

  // 기존 북마크 버튼 제거
  const existing = qNumEl.parentElement?.querySelector('.bookmark-btn');
  if (existing) existing.remove();

  const userId = auth?.currentUser?.uid || localStorage.getItem('userId');
  if (!userId) return;

  const questionId = _getQuestionId(question, displayNum);
  const btn = document.createElement('button');
  btn.className = 'bookmark-btn';
  btn.title = '북마크';
  btn.setAttribute('aria-label', '북마크');
  btn.textContent = '☆';

  // 캐시에서 상태 확인 후, 없으면 비동기 조회
  if (_bookmarkCache.has(questionId)) {
    btn.textContent = _bookmarkCache.get(questionId) ? '★' : '☆';
    btn.classList.toggle('active', _bookmarkCache.get(questionId));
  } else {
    const _certType = localStorage.getItem('currentCertificateType') || 'health-manager';
    isBookmarked(userId, questionId, _certType).then(marked => {
      _bookmarkCache.set(questionId, marked);
      btn.textContent = marked ? '★' : '☆';
      btn.classList.toggle('active', marked);
    }).catch(() => {});
  }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const marked = _bookmarkCache.get(questionId) || false;
    try {
      if (marked) {
        await removeBookmark(userId, questionId);
        _bookmarkCache.set(questionId, false);
        btn.textContent = '☆';
        btn.classList.remove('active');
      } else {
        const certType = localStorage.getItem('currentCertificateType') || 'health-manager';
        await saveBookmark(userId, question, `${currentYear}년 ${currentSubject}`, currentSubject, certType);
        _bookmarkCache.set(questionId, true);
        btn.textContent = '★';
        btn.classList.add('active');
      }
    } catch (err) {
      console.error('북마크 처리 실패:', err);
    }
  });

  qNumEl.parentElement.insertBefore(btn, qNumEl.nextSibling);
}

function getActiveSessionId() {
  return localStorage.getItem('currentSessionId')
    || localStorage.getItem('resumeSessionId')
    || '';
}

function getProgressStorageKey() {
  if (!currentYear || !currentSubject) return null;
  const sessionId = getActiveSessionId() || 'no-session';
  return `quiz_progress_${currentYear}_${encodeURIComponent(currentSubject)}_${sessionId}`;
}

function buildRegularSessionMetadata(year, subject, totalQuestions = 20) {
  return {
    type: 'regular',
    year: year || '',
    subject: subject || '',
    title: year && subject ? `${year}년 ${subject} 기출문제` : (subject || '일반 문제풀이'),
    totalQuestions: totalQuestions > 0 ? totalQuestions : 20,
    examType: '일반문제',
    isActive: true
  };
}

async function ensureRegularSessionForPage({ year, subject, isResume, resumeSessionId, totalQuestions = 20 }) {
  try {
    // 이어풀기 모드라면 기존 세션을 그대로 사용
    if (isResume && resumeSessionId) {
      localStorage.setItem('currentSessionId', resumeSessionId);
      return;
    }

    const manager = window.sessionManager || sessionManager;
    if (!manager || typeof manager.startNewSession !== 'function') {
      return;
    }

    const activeSessionId = typeof manager.getCurrentSessionId === 'function'
      ? manager.getCurrentSessionId()
      : (localStorage.getItem('currentSessionId') || '');
    const existingSession = manager.currentSession;
    const isSameRegularSession = !!(
      activeSessionId &&
      existingSession &&
      existingSession.id === activeSessionId &&
      existingSession.type === 'regular' &&
      existingSession.year === year &&
      existingSession.subject === subject &&
      existingSession.isActive !== false
    );

    // 다른 과목/연도의 세션을 재사용하지 않도록 현재 페이지 기준으로 새 세션 시작
    if (!isSameRegularSession) {
      const metadata = buildRegularSessionMetadata(year, subject, totalQuestions);
      await manager.startNewSession(metadata);
    }
  } catch (error) {
    window.Logger?.warn('일반문제 세션 준비 실패:', error);
  }
}

// 세션 ID 무관하게 과목/연도 기준 키 (세션 변경돼도 복원 가능)
function getProgressBaseKey() {
  if (!currentYear || !currentSubject) return null;
  return `quiz_progress_${currentYear}_${encodeURIComponent(currentSubject)}`;
}

function saveQuizProgress(lastQuestionIndex = currentQuestionIndex) {
  try {
    const storageKey = getProgressStorageKey();
    if (!storageKey) return;
    const data = JSON.stringify({
      answers: userAnswers,
      perQuestionChecked,
      lastQuestionIndex,
      timestamp: Date.now(),
      sessionId: getActiveSessionId()
    });
    localStorage.setItem(storageKey, data);
    // 세션 ID 없는 베이스 키로도 저장 (세션 변경 시 폴백용)
    const baseKey = getProgressBaseKey();
    if (baseKey) localStorage.setItem(baseKey, data);
  } catch (error) {
    window.Logger?.warn('진행 상태 로컬 저장 실패:', error);
  }
}

function restoreQuizProgress() {
  try {
    // 1차: 현재 세션 ID 기준 키로 복원
    const storageKey = getProgressStorageKey();
    if (storageKey) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.answers)) return parsed;
      }
    }
    // 2차: 세션 ID 없는 베이스 키로 폴백 (세션이 바뀌었을 때)
    const baseKey = getProgressBaseKey();
    if (baseKey) {
      const raw = localStorage.getItem(baseKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.answers)) {
          // 24시간 이내 데이터만 복원
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            window.Logger?.info('세션 변경 후 베이스 키로 진행 상태 복원');
            return parsed;
          }
        }
      }
    }
    return null;
  } catch (error) {
    window.Logger?.warn('진행 상태 로컬 복원 실패:', error);
    return null;
  }
}

/**
 * R2: 중단된 일반문제 진행 감지
 * @param {number} totalQuestions
 * @returns {Object|null} 중단된 데이터 또는 null
 */
function detectInterruptedProgress(totalQuestions) {
  try {
    const baseKey = getProgressBaseKey();
    if (!baseKey) return null;
    const raw = localStorage.getItem(baseKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const answers = data.answers || [];
    const answeredCount = answers.filter(a => a !== null && a !== undefined).length;
    const age = Date.now() - (data.timestamp || 0);
    if (answeredCount > 0 && answeredCount < totalQuestions && age < 24 * 60 * 60 * 1000) {
      return { ...data, answeredCount, baseKey };
    }
  } catch (e) { /* 무시 */ }
  return null;
}

/**
 * R2: 이어서 풀기 배너 표시 (Promise → 'resume' | 'fresh')
 * @param {{ answeredCount: number }} data
 * @returns {Promise<string>}
 */
function showResumeBanner(data) {
  return new Promise((resolve) => {
    // 중복 방지
    const existing = document.getElementById('resume-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'resume-banner';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1d2f4e; color: #fff;
      padding: 14px 20px;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 10px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease;
    `;
    banner.innerHTML = `
      <style>
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(0); } to { transform: translateY(-100%); } }
        #resume-banner-btns button {
          padding: 8px 18px; border-radius: 6px; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer;
          min-height: 40px; min-width: 80px;
        }
      </style>
      <span style="font-size:14px;">
        📌 이전에 <strong>${data.answeredCount}문제</strong>까지 풀었습니다. 이어서 하시겠어요?
      </span>
      <div id="resume-banner-btns" style="display:flex; gap:8px;">
        <button id="resume-btn-yes" style="background:#5fb2c9; color:#fff;">이어서 풀기</button>
        <button id="resume-btn-no" style="background:rgba(255,255,255,0.15); color:#fff;">처음부터</button>
      </div>
    `;

    document.body.prepend(banner);

    const close = (choice) => {
      banner.style.animation = 'slideUp 0.25s ease forwards';
      setTimeout(() => banner.remove(), 260);
      resolve(choice);
    };

    document.getElementById('resume-btn-yes').addEventListener('click', () => close('resume'));
    document.getElementById('resume-btn-no').addEventListener('click', () => close('fresh'));
  });
}

/**
 * 퀴즈 초기화 함수
 * @returns {Promise<boolean>} 초기화 성공 여부
 */
// ✅ 수정 완료: urlParams 중복 선언 제거 (2025-01-21 15:30)
// 버전: v2.1.0 - 캐시 무효화
export async function initializeQuiz() {
  try {
    window.Logger?.debug('퀴즈 초기화 시작');

    // URL 파라미터 확인 (이어서 풀기 모드 체크)
    const urlParams = new URLSearchParams(window.location.search);
    const isResume = urlParams.get('resume') === 'true';
    const resumeSessionId = urlParams.get('sessionId') || localStorage.getItem('resumeSessionId');

    // 세션 초기화: 이어풀기 세션만 우선 유지
    if (isResume && resumeSessionId) {
      window.Logger?.debug('이어서 풀기 모드: 기존 세션 사용:', resumeSessionId);
      localStorage.setItem('currentSessionId', resumeSessionId);
    }

    // 현재 파일 이름에서 년도와 과목 정보 추출
    const pathSegments = window.location.pathname.split('/');
    const filename = pathSegments[pathSegments.length - 1];
    const filenameMatch = filename.match(/(\d{4})_([^.]+)/);

    // URL 파라미터 (quiz.html?year=...&subject=... 형태로 진입 시 사용)
    const _urlParamsInit = new URLSearchParams(window.location.search);
    let year = _urlParamsInit.get('year') || '2025';
    let subject = _urlParamsInit.get('subject') || '운동생리학';

    if (filenameMatch) {
      year = filenameMatch[1];  // 추출된 년도 (예: 2024)
      subject = filenameMatch[2];  // 추출된 과목 (예: 운동생리학 or URL 인코딩)

      // ✅ 안전한 URL 디코딩 (여러 번 시도)
      try {
        // 이중 인코딩 대비 최대 3번 디코딩
        let decoded = subject;
        for (let i = 0; i < 3; i++) {
          const temp = decodeURIComponent(decoded);
          if (temp === decoded) break; // 더 이상 디코딩되지 않으면 중단
          decoded = temp;
        }
        subject = decoded;

        window.Logger?.debug(`과목명 디코딩: ${filenameMatch[2]} → ${subject}`);
      } catch (error) {
        window.Logger?.error('과목명 디코딩 오류:', error);
        // 디코딩 실패 시 원본 사용
      }
    } else {
      // quiz.html처럼 파일명 매칭 안 될 때 URL 파라미터 subject 디코딩
      try {
        let decoded = subject;
        for (let i = 0; i < 3; i++) {
          const temp = decodeURIComponent(decoded);
          if (temp === decoded) break;
          decoded = temp;
        }
        subject = decoded;
      } catch (e) { /* 원본 유지 */ }
    }
    currentYear = year;
    currentSubject = subject;

    // 일반문제 세션을 페이지 단위로 분리해 누적 혼합(예: 160/160) 방지
    // 모의고사 페이지는 mock-exam.js에서 mockexam 세션을 생성하므로 건너뜀
    if (!filename.includes('모의고사')) {
      await ensureRegularSessionForPage({
        year,
        subject,
        isResume,
        resumeSessionId,
        totalQuestions: 20
      });
    }

    // ✅ 일반 과목 시험인 경우 body에 data-current-subject 속성 추가
    // (CSS 스타일링을 위해 필요: indicators.css 등에서 사용)
    if (subject && !filename.includes('모의고사')) {
      document.body.setAttribute('data-current-subject', subject);
      window.Logger?.debug(`data-current-subject 속성 설정: ${subject}`);
    } else {
      // 모의고사인 경우 속성 제거 (모의고사 전용 스타일 적용을 위해)
      document.body.removeAttribute('data-current-subject');
    }

    // 헤더 타이틀 업데이트
    const titleEl = document.querySelector('.quiz-title h1');
    if (titleEl) {
      if (filename.includes('모의고사')) {
        const period = filename.includes('1교시') ? '1교시' : (filename.includes('2교시') ? '2교시' : '');
        titleEl.textContent = `${year}년 ${period} 모의고사`;
      } else {
        titleEl.textContent = `${year}년 ${subject} 기출문제`;
      }
    }

    window.Logger?.info(`로드할 데이터: ${year}년 ${subject}`);

    // 데이터 로드 시도 (스포츠: window.QUIZ_DATA_FOLDER 또는 URL 경로로 감지)
    let data;
    let dataFolder = window.QUIZ_DATA_FOLDER ? `${window.QUIZ_DATA_FOLDER}/` : '';
    if (!dataFolder) {
      const pathname = window.location.pathname;
      if (pathname.includes('-sports1/') || pathname.includes('sports1/')) {
        dataFolder = 'sports1/';
      } else if (pathname.includes('-sports/') || pathname.includes('exam-sports') || pathname.includes('subjects-sports')) {
        dataFolder = 'sports/';
      }
    }
    const dataUrl = `../data/${dataFolder}${year}_${subject}.json`;
    window.Logger?.debug('데이터 URL:', dataUrl);

    try {
      const response = await fetch(dataUrl);
      if (response.ok) {
        data = await response.json();
      } else {
        // 현재 년도의 데이터가 없으면 가장 최근 년도의 데이터를 사용
        const fallbackYear = await findLatestYear(subject);
        if (fallbackYear) {
          window.Logger?.warn(`${year}년 데이터가 없어 ${fallbackYear}년 데이터를 사용합니다.`);
          const fallbackResponse = await fetch(`../data/${dataFolder}${fallbackYear}_${subject}.json`);
          if (fallbackResponse.ok) {
            data = await fallbackResponse.json();
          } else {
            throw new Error(`${subject} 데이터를 불러오는데 실패했습니다.`);
          }
        } else {
          throw new Error(`${year}년 ${subject} 데이터를 찾을 수 없습니다.`);
        }
      }
    } catch (error) {
      window.Logger?.error('데이터 로드 오류:', error);
      throw new Error(`데이터 로드 실패: ${error.message}`);
    }

    window.Logger?.info(`로드된 문제 수: ${data.length}`);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('문제 데이터가 올바르지 않습니다.');
    }

    questions = data;
    userAnswers = new Array(questions.length).fill(null);
    perQuestionChecked = new Array(questions.length).fill(false);
    // 첫 시도 추적 배열 초기화
    firstAttemptTracking = new Array(questions.length).fill(true);
    window.perQuestionChecked = perQuestionChecked;

    // R2: 진행 상태 복원 (이어풀기 모드 or 배너 선택)
    let lastQuestionNumber = null;

    try {
      // isResume=true(analytics 이어풀기 버튼): 배너 없이 자동 복원
      // isResume=false: 중단 데이터 있으면 배너 표시 후 선택
      const interrupted = detectInterruptedProgress(questions.length);
      let shouldRestore = false;

      if (isResume) {
        // Analytics에서 이어풀기 버튼으로 진입 → 자동 복원
        shouldRestore = true;
      } else if (interrupted) {
        // 일반 진입인데 중단 데이터 있음 → 배너 물어보기
        const choice = await showResumeBanner(interrupted);
        if (choice === 'resume') {
          shouldRestore = true;
        } else {
          // 처음부터 → localStorage 클리어
          const baseKey = getProgressBaseKey();
          if (baseKey) localStorage.removeItem(baseKey);
          const sessionKey = getProgressStorageKey();
          if (sessionKey) localStorage.removeItem(sessionKey);
        }
      }

      if (shouldRestore) {
        const restoredProgress = restoreQuizProgress();
        if (restoredProgress) {
          const answeredCount = restoredProgress.answers.filter(a => a !== null && a !== undefined).length;
          const isRecent = restoredProgress.timestamp && (Date.now() - restoredProgress.timestamp < 24 * 60 * 60 * 1000);
          const isIncomplete = answeredCount > 0 && answeredCount < questions.length;

          if (isRecent && isIncomplete) {
            restoredProgress.answers.forEach((answer, index) => {
              if (index < userAnswers.length && answer !== null && answer !== undefined) {
                userAnswers[index] = answer;
              }
            });

            if (Array.isArray(restoredProgress.perQuestionChecked)) {
              restoredProgress.perQuestionChecked.forEach((checked, index) => {
                if (index < perQuestionChecked.length) {
                  perQuestionChecked[index] = !!checked;
                }
              });
              window.perQuestionChecked = perQuestionChecked;
            }

            if (typeof restoredProgress.lastQuestionIndex === 'number' && restoredProgress.lastQuestionIndex >= 0) {
              lastQuestionNumber = restoredProgress.lastQuestionIndex + 1;
            }

            window.Logger?.info(`진행 상태 복원: ${answeredCount}문제 답안`);
          }
        }

        // 이어풀기 모드에서 서버 폴백으로 마지막 위치 보정
        if (isResume && !lastQuestionNumber) {
          const sessionIdToRestore = resumeSessionId || localStorage.getItem('resumeSessionId');
          lastQuestionNumber = await getLastQuestionNumber(year, subject, sessionIdToRestore);
        }
      }

      // 마지막 문제 위치로 이동
      if (lastQuestionNumber && lastQuestionNumber > 0) {
        const targetIndex = lastQuestionNumber - 1;
        if (targetIndex >= 0 && targetIndex < questions.length) {
          currentQuestionIndex = targetIndex;
          window.currentQuestionIndex = currentQuestionIndex;
          window.Logger?.info(`진행 복원: ${currentQuestionIndex + 1}번 문제로 이동`);
        }
      }
    } catch (error) {
      window.Logger?.error('진행 상태 복원 오류:', error);
    }

    // 전역 변수 업데이트
    window.questions = questions;
    window.userAnswers = userAnswers;
    window.firstAttemptTracking = firstAttemptTracking;
    window.perQuestionChecked = perQuestionChecked;

    // 문제 초기화
    loadQuestion(currentQuestionIndex);
    initQuestionIndicators();

    // 복원된 답변이 있으면 인디케이터와 UI 반영
    if (userAnswers.some(a => a !== null)) {
      setTimeout(() => {
        updateSelectedOption();
        updateQuestionIndicators();
      }, 100);
    }

    startTimer();

    // 이벤트 리스너 등록
    document.getElementById('prev-button').addEventListener('click', goToPreviousQuestion);
    document.getElementById('next-button').addEventListener('click', goToNextQuestion);

    // 정답보기 버튼에 이벤트 리스너 등록
    const checkButton = document.getElementById('check-button');
    if (checkButton) {
      checkButton.addEventListener('click', showCurrentAnswer);
    }

    document.getElementById('submit-button').addEventListener('click', submitQuiz);

    // 정오표 기능: URL 파라미터에서 goto, question, number 값을 확인하여 특정 문제로 이동
    // ✅ urlParams는 이미 위에서 선언됨 (중복 선언 제거)
    let gotoQuestion = urlParams.get('goto') || urlParams.get('question') || urlParams.get('number');

    // ✅ 이어서 풀기 모드이고 question 파라미터가 없으면 마지막 풀었던 문제로 이동
    // 단, 이미 currentQuestionIndex가 설정되었으면 중복 이동하지 않음
    if (isResume && !gotoQuestion && lastQuestionNumber) {
      const targetIndex = lastQuestionNumber - 1;
      // currentQuestionIndex가 이미 마지막 문제로 설정되어 있으면 이동하지 않음
      if (currentQuestionIndex !== targetIndex) {
        gotoQuestion = lastQuestionNumber.toString();
        console.log('이어서 풀기: 마지막 풀었던 문제로 이동:', lastQuestionNumber);
      } else {
        // 이미 올바른 위치에 있으므로 답변만 다시 표시
        window.Logger?.debug('이어서 풀기: 이미 마지막 문제 위치에 있음, 답변만 복원');
        // loadQuestion이 이미 호출되었으므로 updateSelectedOption만 다시 호출
        // DOM이 완전히 준비된 후 업데이트 (안정성 향상)
        setTimeout(() => {
          updateSelectedOption();
          updateQuestionIndicators();
          saveQuizProgress(currentQuestionIndex);
          window.Logger?.info('이어서 풀기: 답변 및 인디케이터 복원 완료');
        }, 100);
      }
    }

    if (gotoQuestion) {
      // 문제 번호를 정수로 변환 (1부터 시작하는 번호)
      const targetNumber = parseInt(gotoQuestion);
      if (!isNaN(targetNumber) && targetNumber > 0 && targetNumber <= questions.length) {
        // 문제 번호는 1부터 시작하지만 인덱스는 0부터 시작하므로 변환
        const targetIndex = targetNumber - 1;

        // ✅ 이어서 풀기 모드에서는 이미 currentQuestionIndex가 설정되었을 수 있으므로 확인
        if (isResume && currentQuestionIndex === targetIndex) {
          // 이미 올바른 위치에 있으므로 답변만 다시 표시
          window.Logger?.debug('이어서 풀기: 이미 올바른 위치에 있음, 답변만 복원');
          // DOM이 완전히 준비된 후 업데이트 (안정성 향상)
          setTimeout(() => {
            updateSelectedOption();
            updateQuestionIndicators();
            saveQuizProgress(currentQuestionIndex);
            window.Logger?.info('이어서 풀기: 답변 및 인디케이터 복원 완료');
          }, 100);
        } else {
          // 화면이 모두 로드된 후 약간의 지연을 두고 이동 (안정성 향상)
          setTimeout(() => {
            window.Logger?.debug(`${isResume ? '이어서 풀기' : '정오표'}에서 이동: ${targetNumber}번 문제로 이동합니다.`);
            currentQuestionIndex = targetIndex;
            window.currentQuestionIndex = currentQuestionIndex;
            loadQuestion(currentQuestionIndex);
            updateQuestionIndicators();

            // 이어서 풀기 모드가 아닐 때만 자동으로 정답 표시 (정오표 기능)
            if (!isResume && document.getElementById('check-button')) {
              showCurrentAnswer();
            }
          }, 500);
        }
      } else {
        window.Logger?.warn(`유효하지 않은 문제 번호: ${gotoQuestion}`);
      }
    }

    // 키보드 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyboardNavigation);

    if (!window.__quizBeforeUnloadBound) {
      // R1: beforeunload — 저장만 (경고 없음, 세션 재진입 방식으로 대체)
      window.addEventListener('beforeunload', () => {
        saveQuizProgress(currentQuestionIndex);
      });

      // M3-A/pagehide: iOS Safari — 경고 없이 저장만 (beforeunload 미발생 대비)
      window.addEventListener('pagehide', () => {
        saveQuizProgress(currentQuestionIndex);
      });

      // M3-A: visibilitychange — 백그라운드 전환 시 타이머 일시정지 + 저장
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          saveQuizProgress(currentQuestionIndex);
          if (!reviewMode && timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            window.__quizTimerPausedAt = Date.now();
          }
        } else if (document.visibilityState === 'visible') {
          if (window.__quizTimerPausedAt && !reviewMode && timeRemaining > 0) {
            window.__quizTimerPausedAt = null;
            startTimer(); // 타이머 재시작 (잠금 시간 제외)
          }
        }
      });

      // M3-B: pageshow — iOS Safari bfcache 복원 시 타이머 재시작
      window.addEventListener('pageshow', (e) => {
        if (e.persisted && !reviewMode && timeRemaining > 0 && !timerInterval) {
          window.__quizTimerPausedAt = null;
          startTimer();
        }
      });

      window.__quizBeforeUnloadBound = true;
    }

    window.Logger?.info('퀴즈 초기화 완료');

    return true;
  } catch (error) {
    console.error('문제 로드 오류:', error);
    alert(error.message);

    // 오류 상태 표시
    document.getElementById('quiz-container').innerHTML = `
      <div class="error-message">
        <h2>문제 로드 실패</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()">다시 시도</button>
      </div>
    `;
    return false;
  }
}

/**
 * 문제 불러오기
 * @param {number} index - 문제 인덱스
 */
export function loadQuestion(index) {
  const question = questions[index];
  if (!question) {
    console.error('문제를 찾을 수 없습니다:', index);
    return;
  }

  // ✅ 문제별 소요 시간 측정: 문제가 표시되는 시각 기록
  window.__questionStartTime = Date.now();
  window.__questionTimeSpent = 0;
  window.__questionViewedExplanation = false;

  // 문제 번호 표시 (1-20번 순환)
  const displayNum = (index % 20) + 1;
  const qNumEl = document.querySelector('.question-number');
  if (qNumEl) {
    qNumEl.textContent = `${displayNum}번`;
  }

  // 북마크 버튼 렌더링
  _renderBookmarkButton(question, displayNum);

  // 태그 표시
  displayQuestionTags(question);

  const questionContainer = document.getElementById('question-container');
  questionContainer.innerHTML = '';

  // 공통 이미지가 있는 경우 - 문제 이미지보다 먼저 표시
  if (question.commonImage) {
    const commonImg = document.createElement('img');
    commonImg.src = `../${question.commonImage}`;
    commonImg.alt = '공통 이미지';
    commonImg.className = 'common-image';
    // 이미지 최적화 속성 추가
    commonImg.loading = 'lazy';
    commonImg.decoding = 'async';
    questionContainer.appendChild(commonImg);
  }

  // 이미지 문제 표시
  if (question.questionImage) {
    const img = document.createElement('img');
    const encodedPath = getEncodedImagePath(question.questionImage);

    img.src = encodedPath;
    img.alt = `문제 ${index + 1} 이미지`;
    img.className = 'question-image';

    // 이미지 최적화 속성 추가
    img.loading = 'lazy';
    img.decoding = 'async';

    // 첫 번째 문제는 즉시 로드 (중요 콘텐츠)
    if (index === 0 || index === currentQuestionIndex) {
      img.loading = 'eager';
    }

    // 이미지 로드 오류 처리
    img.onerror = function () {
      console.error(`[이미지 로드 실패] 원본 경로: ${question.questionImage}`);
      console.error(`[이미지 로드 실패] 시도한 경로: ${encodedPath}`);
      console.error(`[이미지 로드 실패] 문제 번호: ${index + 1}`);

      // 사용자에게 보이는 오류 메시지
      const errorDiv = document.createElement('div');
      errorDiv.className = 'image-load-error';
      errorDiv.innerHTML = `
        <div style="
          background-color: #ffebee;
          border: 2px solid #f44336;
          border-radius: 8px;
          padding: 20px;
          margin: 10px 0;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
          <div style="font-weight: bold; color: #d32f2f; margin-bottom: 8px;">
            이미지를 불러올 수 없습니다
          </div>
          <div style="font-size: 14px; color: #666;">
            문제 ${index + 1}번의 이미지 파일을 찾을 수 없습니다.<br>
            경로: ${question.questionImage}
          </div>
        </div>
      `;

      // 실패한 이미지를 오류 메시지로 교체
      img.replaceWith(errorDiv);

      // 텍스트 형식 문제가 있다면 표시
      if (question.questionText || question.question) {
        const textDiv = document.createElement('div');
        textDiv.className = 'question-text';
        textDiv.innerHTML = question.questionText || question.question;
        questionContainer.appendChild(textDiv);
      }
    };

    // 이미지 로드 성공 시 로그
    img.onload = function () {
      console.log(`[이미지 로드 성공] 문제 ${index + 1}: ${question.questionImage}`);
    };

    questionContainer.appendChild(img);
  }

  // 텍스트 문제가 있는 경우
  if (question.question) {
    const questionText = document.createElement('p');
    questionText.className = 'question-text';
    questionText.textContent = question.question;
    questionContainer.appendChild(questionText);
  }

  // 선택지 업데이트
  const optionButtons = document.querySelectorAll('.option-button');
  for (let i = 0; i < optionButtons.length; i++) {
    optionButtons[i].textContent = `${i + 1}`;
    if (question.options && question.options[i]) {
      optionButtons[i].textContent = `${i + 1}. ${question.options[i]}`;
    }
  }

  // ✅ 복원된 답변이 있으면 즉시 표시 (모바일 환경 대응)
  updateSelectedOption();
  updateNavButtons();
  updateQuestionIndicators();
  updateProgressDisplay();

  // ✅ 모바일 환경에서 복원된 답변이 제대로 표시되도록 추가 확인
  // DOM이 완전히 준비된 후 다시 한 번 확인 (이어서풀기 모드에서 특히 중요)
  if (userAnswers[index] !== null && userAnswers[index] !== undefined) {
    setTimeout(() => {
      updateSelectedOption();
      updateQuestionIndicators(); // 인디케이터도 함께 업데이트
      window.Logger?.debug(`문제 ${index + 1}번 복원된 답변 확인: ${userAnswers[index]}`);
    }, 100);

    // 추가 안전장치: 더 긴 지연 후 한 번 더 확인 (DOM 렌더링 완료 대기)
    setTimeout(() => {
      const optionButtons = document.querySelectorAll('.option-button');
      const currentAnswer = userAnswers[index];
      let found = false;

      optionButtons.forEach((button, btnIndex) => {
        if (btnIndex === currentAnswer) {
          if (!button.classList.contains('selected')) {
            button.classList.add('selected');
            found = true;
            window.Logger?.debug(`문제 ${index + 1}번: 지연 후 답변 복원 완료 (${btnIndex + 1}번 선택지)`);
          }
        }
      });

      if (found) {
        updateQuestionIndicators(); // 인디케이터도 다시 업데이트
      }
    }, 300);
  }

  // 피드백 초기화
  const feedback = document.getElementById('feedback');
  feedback.style.display = 'none';
  feedback.innerHTML = '';

  // ✅ 다음 문제들의 이미지 미리 로드 (성능 최적화)
  // 현재 문제 로드 후 약 500ms(사용자가 문제를 읽기 시작할 쯤) 뒤에 프리로드 시작
  setTimeout(() => {
    preloadImages(index, 3); // 다음 3개 문제의 이미지 미리 로드
  }, 500);
}

/**
 * 이미지 경로 인코딩 처리 헬퍼 함수
 * @param {string} rawPath - 원본 경로
 * @returns {string} 인코딩된 경로
 */
function getEncodedImagePath(rawPath) {
  if (!rawPath) return '';

  const imagePath = rawPath.startsWith('/')
    ? rawPath
    : `../${rawPath}`;

  // 경로의 각 부분을 인코딩 (전체 경로를 인코딩하면 슬래시도 인코딩되므로)
  const pathParts = imagePath.split('/');
  return pathParts.map((part, idx) =>
    idx === 0 && part === '..' ? part : encodeURIComponent(decodeURIComponent(part))
  ).join('/');
}

/**
 * 다음 문제의 이미지 미리 로드 (프리로딩) - 순차적으로 다운로드
 * @param {number} currentIndex - 현재 문제 인덱스
 * @param {number} count - 미리 로드할 문제 개수
 */
function preloadImages(currentIndex, count = 3) {
  if (!questions || questions.length === 0) return;

  const start = currentIndex + 1;
  const end = Math.min(start + count, questions.length);

  // 이미지 경로 수집 (문제 이미지 + 공통 이미지)
  const imageQueue = [];
  for (let i = start; i < end; i++) {
    const question = questions[i];
    if (!question) continue;

    // 문제 이미지 추가
    if (question.questionImage) {
      const encodedPath = getEncodedImagePath(question.questionImage);
      imageQueue.push({
        src: encodedPath,
        type: 'question',
        questionIndex: i + 1
      });
    }

    // 공통 이미지 추가
    if (question.commonImage) {
      imageQueue.push({
        src: question.commonImage.startsWith('/') ? question.commonImage : `../${question.commonImage}`,
        type: 'common',
        questionIndex: i + 1
      });
    }
  }

  // 순차적으로 이미지 로드
  let queueIndex = 0;
  
  function loadNextImage() {
    if (queueIndex >= imageQueue.length) {
      window.Logger?.debug(`[Preload] 총 ${imageQueue.length}개 이미지 순차 로드 완료`);
      return;
    }

    const imageInfo = imageQueue[queueIndex];
    const img = new Image();

    img.onload = function() {
      window.Logger?.debug(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 로드 완료: ${imageInfo.src}`);
      queueIndex++;
      // 다음 이미지 로드 (약간의 지연을 두어 네트워크 부하 분산)
      setTimeout(loadNextImage, 50);
    };

    img.onerror = function() {
      window.Logger?.warn(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 로드 실패: ${imageInfo.src}`);
      queueIndex++;
      // 실패해도 다음 이미지 계속 로드
      setTimeout(loadNextImage, 50);
    };

    img.src = imageInfo.src;
    window.Logger?.debug(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 미리 로드 시작: ${imageInfo.src}`);
  }

  // 첫 번째 이미지 로드 시작
  if (imageQueue.length > 0) {
    loadNextImage();
  }
}

/**
 * 문제 태그 표시
 * @param {Object} question - 문제 객체
 * 
 * ⚠️ 태그 기능은 현재 비활성화되어 있습니다.
 * 태그 기능이 완전히 구현되면 이 함수를 다시 활성화하세요.
 */
function displayQuestionTags(question) {
  const tagsContainer = document.getElementById('question-tags');
  if (!tagsContainer) return;

  // question.tags 필드 직접 사용
  const uniqueTags = (question.tags && Array.isArray(question.tags)) ? [...new Set(question.tags)] : [];

  if (uniqueTags.length === 0) {
    tagsContainer.innerHTML = '';
    tagsContainer.style.display = 'none';
    return;
  }

  tagsContainer.style.display = 'block';
  tagsContainer.innerHTML = `
    <div class="question-tags-label">태그:</div>
    <div class="question-tags-list">
      ${uniqueTags.slice(0, 8).map(tag => `
        <a href="../search-by-tags.html" class="question-tag" onclick="event.preventDefault(); window.open('search-by-tags.html', '_blank');">
          ${tag}
        </a>
      `).join('')}
    </div>
  `;
}

/**
 * explanation에서 태그 추출 (태그 검색과 동일한 로직)
 */
function extractTagsFromExplanation(explanation) {
  const tags = [];

  if (!explanation) return tags;

  // HTML 태그 제거
  const text = explanation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // 주요 패턴 추출
  const patterns = [
    // 이론명 (예: "격변이론", "탈진검사지(MBI)")
    /([가-힣]+이론|([가-힣]+)검사지|([가-힣]+)모형|([가-힣]+)원리|([가-힣]+)가설)/g,
    // 주요 개념 (예: "정서적 탈진", "비인격화")
    /([가-힣]{2,6})\s*(탈진|목표|훈련|응집력|의존성|상담|모형|이론|원리|가설)/g,
    // 괄호 안의 내용 (예: "(MBI)", "(선호 행동)")
    /\(([가-힣A-Z]+)\)/g,
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // 괄호 제거 및 정리
        const cleaned = match.replace(/[()]/g, '').trim();
        if (cleaned.length >= 2 && cleaned.length <= 10) {
          tags.push(cleaned);
        }
      });
    }
  });

  return tags;
}

/**
 * 선택지 선택 처리
 * @param {number} optionIndex - 선택한 옵션 인덱스
 * @param {number} [questionIndex=currentQuestionIndex] - 문제 인덱스
 * @param {Array} [answers=userAnswers] - 답변 배열
 * @returns {Array} 업데이트된 답변 배열
 */
export function selectOption(optionIndex, questionIndex = currentQuestionIndex, answers = userAnswers) {
  // 사용자가 선택한 실제 인덱스를 저장
  // optionIndex는 0부터 시작하는 인덱스로 전달됨 (UI에서는 1부터 시작)
  answers[questionIndex] = optionIndex;

  // 개발 디버깅용 - 개발 완료 후 삭제 예정
  console.log(`선택한 답변: UI 상 ${optionIndex + 1}번, 저장값: ${optionIndex}`);

  // window 객체 업데이트
  window.userAnswers = answers;
  saveQuizProgress(questionIndex);

  // 현재 문제에 대한 답변인 경우만 UI 업데이트
  if (questionIndex === currentQuestionIndex) {
    updateSelectedOption();
    updateQuestionIndicators();
    updateNavButtons();

    // 추가: 자동으로 정답 확인 시도 (선택적 기능)
    // autoShowAnswer가 true인 경우에만 실행 (모든 문제에 자동으로 정답을 표시하려면 true로 설정)
    const autoShowAnswer = false; // 기본값은 false
    if (autoShowAnswer && typeof showCurrentAnswer === 'function') {
      setTimeout(() => {
        showCurrentAnswer();
      }, 500); // 0.5초 후에 정답 표시
    }
  }

  return answers;
}

/**
 * 현재 문제의 정답 확인
 * @returns {Object} 정답 확인 결과
 */
export function checkAnswer() {
  if (!questions || currentQuestionIndex === null) {
    console.error('문제가 로드되지 않았습니다.');
    return { status: 'error', message: '문제가 로드되지 않았습니다.' };
  }

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestionIndex];

  if (selectedAnswer === undefined || selectedAnswer === null) {
    return { status: 'no-answer', message: '답을 선택해주세요.' };
  }

  // 정답 확인 (correctAnswer, correctOption, correct 필드 중 하나 사용)
  let correctAnswerIndex = null;
  if (typeof currentQuestion.correctAnswer !== 'undefined') {
    correctAnswerIndex = currentQuestion.correctAnswer;
  } else if (typeof currentQuestion.correctOption !== 'undefined') {
    correctAnswerIndex = currentQuestion.correctOption;
  } else if (typeof currentQuestion.correct !== 'undefined') {
    correctAnswerIndex = currentQuestion.correct;
  }

  if (correctAnswerIndex === null) {
    console.error('정답 정보를 찾을 수 없습니다.');
    return { status: 'error', message: '정답 정보를 찾을 수 없습니다.' };
  }

  // 배열 형태의 정답 처리
  let isCorrect = false;
  let correctAnswerText = '';

  if (Array.isArray(correctAnswerIndex)) {
    // 배열의 길이가 선택지 전체 개수와 같으면(모든 선택지가 정답일 때) 어떤 답을 선택해도 정답
    if (correctAnswerIndex.length === 4) { // 4개 선택지 기준
      isCorrect = selectedAnswer !== null; // 답을 선택했다면 정답
      correctAnswerText = "모든 선택지 정답";
    } else {
      // 일부만 정답인 경우 기존 로직 유지
      isCorrect = correctAnswerIndex.includes(selectedAnswer);
      correctAnswerText = correctAnswerIndex.map(idx => (idx + 1) + '번').join(' 또는 ');
    }
  } else {
    // 단일 값인 경우 기존 비교 방식 유지
    isCorrect = selectedAnswer === correctAnswerIndex;
    correctAnswerText = (correctAnswerIndex + 1) + '번';
  }

  // 설명에서 "이 문제의 정답은 X번입니다." 부분을 제거
  let explanation = currentQuestion.explanation || '';
  explanation = explanation.replace(/^\s*이\s*문제의\s*정답은\s*\d+번입니다\.\s*/i, '');

  // 정답 확인 결과 반환
  // ✅ 정답 확인 시 소요 시간 계산 (window.__questionStartTime 기준)
  if (window.__questionStartTime) {
    window.__questionTimeSpent = Math.floor((Date.now() - window.__questionStartTime) / 1000);
  }

  // 정답 확인 상태 기록 → updateQuestionIndicators가 checked-correct/checked-incorrect 클래스를 붙임
  perQuestionChecked[currentQuestionIndex] = true;
  window.perQuestionChecked = perQuestionChecked;
  updateQuestionIndicators();

  // ✅ 해설이 표시되면 viewedExplanation = true (해설 내용이 있을 때만)
  if (explanation && explanation.trim().length > 0) {
    window.__questionViewedExplanation = true;
  }

  const result = {
    status: 'answered',
    isCorrect,
    correctAnswerText: correctAnswerText,
    selectedAnswerText: (selectedAnswer + 1) + '번',
    explanation,
    userAnswer: selectedAnswer,
    correctAnswerIndex: Array.isArray(correctAnswerIndex) ? null : correctAnswerIndex
  };

  return result;
}

/**
 * 점수 계산
 * @param {Array} [questionSet=questions] - 문제 배열
 * @param {Array} [answers=userAnswers] - 답변 배열
 * @returns {number} 정답 개수
 */
export function calculateScore(questionSet = questions, answers = userAnswers) {
  return answers.filter((answer, index) => {
    const correctAnswer = questionSet[index].correctAnswer !== undefined
      ? questionSet[index].correctAnswer
      : questionSet[index].correct;

    // 배열인 경우 모든 선택지가 정답인지 확인
    if (Array.isArray(correctAnswer) && correctAnswer.length === 4) {
      return answer !== null; // 답을 선택했다면 정답
    }

    // 일반적인 경우 기존 로직 유지
    return answer === correctAnswer || (Array.isArray(correctAnswer) && correctAnswer.includes(answer));
  }).length;
}

/**
 * 오답 문제 가져오기
 * @returns {Array} 오답 문제 배열
 */
export function getIncorrectQuestions() {
  return userAnswers.map((answer, index) => {
    const correctAnswer = questions[index].correctAnswer !== undefined
      ? questions[index].correctAnswer
      : questions[index].correct;
    if (answer !== correctAnswer) {
      return { index, question: questions[index] };
    }
    return null;
  }).filter(item => item !== null);
}

/**
 * 선택된 옵션 업데이트
 */
function updateSelectedOption() {
  const optionButtons = document.querySelectorAll('.option-button');
  if (!optionButtons || optionButtons.length === 0) {
    window.Logger?.warn('updateSelectedOption: 선택지 버튼을 찾을 수 없습니다.');
    return;
  }

  const currentAnswer = userAnswers[currentQuestionIndex];
  window.Logger?.debug(`updateSelectedOption: 문제 ${currentQuestionIndex + 1}번, 복원된 답변: ${currentAnswer}`);

  let foundSelected = false;
  optionButtons.forEach((button, index) => {
    button.classList.remove('selected');
    if (currentAnswer !== null && currentAnswer !== undefined && currentAnswer === index) {
      button.classList.add('selected');
      foundSelected = true;
      window.Logger?.debug(`updateSelectedOption: ${index + 1}번 선택지에 'selected' 클래스 추가`);
    }
  });

  // ✅ 이어서풀기 모드에서 답변이 복원되었는데 선택되지 않았다면 경고
  if (currentAnswer !== null && currentAnswer !== undefined && !foundSelected) {
    window.Logger?.warn(`이어서풀기: 문제 ${currentQuestionIndex + 1}번 답변 ${currentAnswer}이 복원되었지만 UI에 표시되지 않았습니다.`);
  }
}

/**
 * 모든 문제 답변 여부 확인
 */
export function checkAllAnswered() {
  const allAnswered = userAnswers.every(answer => answer !== null);
  const submitButton = document.getElementById('submit-button');
  const nextButton = document.getElementById('next-button');

  if (reviewMode) {
    nextButton.style.display = 'inline-block';
    submitButton.style.display = 'none';
  } else {
    if (allAnswered) {
      submitButton.style.display = 'inline-block';
      nextButton.style.display = 'none';
    } else {
      nextButton.style.display = 'inline-block';
      submitButton.style.display = 'none';
    }
  }
}

/**
 * 네비게이션 버튼 상태 업데이트
 */
function updateNavButtons() {
  const prevButton = document.getElementById('prev-button');
  const nextButton = document.getElementById('next-button');

  prevButton.disabled = currentQuestionIndex === 0;
  nextButton.disabled = currentQuestionIndex === questions.length - 1;

  checkAllAnswered();
}

/**
 * 이전 문제로 이동
 */
export function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    window.currentQuestionIndex = currentQuestionIndex;
    saveQuizProgress(currentQuestionIndex);
    loadQuestion(currentQuestionIndex);
  }
}

/**
 * 다음 문제로 이동
 */
export function goToNextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    window.currentQuestionIndex = currentQuestionIndex;
    saveQuizProgress(currentQuestionIndex);
    loadQuestion(currentQuestionIndex);
  }
}

/**
 * 문제 인디케이터 초기화
 */
function initQuestionIndicators() {
  const container = document.getElementById('question-indicators');
  container.innerHTML = '';

  // 과목 정보 가져오기 (URL에서 또는 첫 번째 문제에서)
  let subject = '';

  // URL에서 과목 정보 추출 시도
  const filename = window.location.pathname.split('/').pop();
  const filenameMatch = filename.match(/(\d{4})_([^.]+)/);

  if (filenameMatch) {
    try {
      subject = decodeURIComponent(filenameMatch[2]);
      console.log(`일반 퀴즈 과목명: ${subject}`);
    } catch (error) {
      console.error('과목명 디코딩 오류:', error);
      subject = filenameMatch[2];
    }
  }

  // URL에서 추출 실패 시 첫 번째 문제에서 가져오기
  if (!subject) {
    subject = questions[0]?.subject || '';
  }

  questions.forEach((question, index) => {
    const indicator = document.createElement('div');
    indicator.className = 'indicator';
    indicator.textContent = index + 1;

    // 과목 정보 추가 (모의고사와 동일)
    indicator.setAttribute('data-subject', subject);
    indicator.setAttribute('data-index', index);

    indicator.addEventListener('click', () => {
      currentQuestionIndex = index;
      window.currentQuestionIndex = currentQuestionIndex;
      loadQuestion(currentQuestionIndex);
    });
    container.appendChild(indicator);
  });

  updateQuestionIndicators();
}

/**
 * 문제 인디케이터 업데이트 (CSS 기반 - 모의고사와 동일)
 */
function updateQuestionIndicators() {
  const indicators = document.querySelectorAll('.indicator');

  indicators.forEach((indicator, index) => {
    // 인라인 스타일 완전 제거 (CSS로 처리)
    indicator.style.backgroundColor = '';
    indicator.style.color = '';
    indicator.style.borderColor = '';
    indicator.style.boxShadow = '';
    indicator.style.transform = '';
    indicator.style.opacity = '';
    indicator.style.filter = '';

    // 클래스 초기화
    indicator.classList.remove('answered', 'current', 'correct', 'incorrect', 'checked-correct', 'checked-incorrect');

    // 과목 정보 복원 (initQuestionIndicators에서 설정한 것 유지)
    const subject = indicator.getAttribute('data-subject');
    if (subject) {
      indicator.setAttribute('data-subject', subject);
    }

    if (index === currentQuestionIndex) {
      indicator.classList.add('current');
    }

    if (userAnswers[index] !== null) {
      if (reviewMode) {
        const correctAnswer = questions[index].correctAnswer !== undefined
          ? questions[index].correctAnswer
          : questions[index].correct;

        // 배열인 경우 모든 선택지가 정답인지 확인
        let isCorrect = false;
        if (Array.isArray(correctAnswer) && correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우, 사용자가 답을 선택했으면 정답
          isCorrect = userAnswers[index] !== null;
        } else if (Array.isArray(correctAnswer)) {
          // 일부 선택지만 정답인 경우, 사용자 답변이 정답 배열에 포함되어 있는지 확인
          isCorrect = correctAnswer.includes(userAnswers[index]);
        } else {
          // 단일 정답인 경우
          isCorrect = userAnswers[index] === correctAnswer;
        }

        indicator.classList.add(isCorrect ? 'correct' : 'incorrect');
      } else if (perQuestionChecked[index]) {
        const correctAnswer = questions[index].correctAnswer !== undefined
          ? questions[index].correctAnswer
          : questions[index].correct;
        let isCorrect = false;
        if (Array.isArray(correctAnswer) && correctAnswer.length === 4) {
          isCorrect = userAnswers[index] !== null;
        } else if (Array.isArray(correctAnswer)) {
          isCorrect = correctAnswer.includes(userAnswers[index]);
        } else {
          isCorrect = userAnswers[index] === correctAnswer;
        }
        // 배지만 보이는 상태 클래스
        indicator.classList.add(isCorrect ? 'checked-correct' : 'checked-incorrect');
      } else {
        indicator.classList.add('answered');
      }
    } else if (perQuestionChecked[index]) {
      // 정답보기만 누르고 넘어간 경우(선택 없이): 풀린 문제로 표시
      indicator.classList.add('answered');
      indicator.classList.add('checked-correct');
    }
  });
}

/**
 * 모든 문제 인디케이터 업데이트
 */
function updateAllAnswerIndicators() {
  const indicators = document.querySelectorAll('.indicator');

  indicators.forEach((indicator, index) => {
    indicator.className = 'indicator';

    if (userAnswers[index] !== null) {
      const correctAnswer = questions[index].correctAnswer !== undefined
        ? questions[index].correctAnswer
        : questions[index].correct;

      // 배열인 경우 모든 선택지가 정답인지 확인
      let isCorrect = false;
      if (Array.isArray(correctAnswer) && correctAnswer.length === 4) {
        // 모든 선택지가 정답인 경우, 사용자가 답을 선택했으면 정답
        isCorrect = userAnswers[index] !== null;
      } else if (Array.isArray(correctAnswer)) {
        // 일부 선택지만 정답인 경우, 사용자 답변이 정답 배열에 포함되어 있는지 확인
        isCorrect = correctAnswer.includes(userAnswers[index]);
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswers[index] === correctAnswer;
      }

      indicator.classList.add(isCorrect ? 'correct' : 'incorrect');
    }

    if (index === currentQuestionIndex) {
      indicator.classList.add('current');
    }
  });
}

/**
 * 진행 상황 표시 업데이트
 */
function updateProgressDisplay() {
  const progressCount = document.getElementById('progress-count');
  const progressBar = document.getElementById('progress-bar');

  const answeredCount = userAnswers.filter(a => a !== null).length;
  const totalQuestions = questions.length;
  const progress = (answeredCount / totalQuestions) * 100;

  progressCount.textContent = `${answeredCount} / ${totalQuestions}`;
  progressBar.style.width = `${progress}%`;
}

/**
 * 타이머 시작
 */
export function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
    }
  }, 1000);
}

/**
 * 타이머 표시 업데이트
 */
function updateTimerDisplay() {
  const timerElement = document.getElementById('timer');
  if (!timerElement) return; // timer 요소가 없으면 함수 종료
  timerElement.textContent = formatTimeFromSeconds(timeRemaining);
}

/**
 * 퀴즈 제출
 */
let _submitInProgress = false;
export async function submitQuiz() {
  // 중복 제출 방지
  if (_submitInProgress) {
    console.warn('이미 제출 처리 중입니다.');
    return;
  }
  _submitInProgress = true;

  // 타이머 중지
  clearInterval(timerInterval);

  console.log("결과 확인 버튼이 클릭되었습니다.");

  if (!userAnswers.every(answer => answer !== null)) {
    const confirmed = confirm('아직 풀지 않은 문제가 있습니다. 정말 제출하시겠습니까?');
    if (!confirmed) {
      // 취소한 경우 타이머 재시작
      startTimer();
      return;
    }
  }

  // 리뷰 모드 활성화 (인디케이터에 정답/오답 표시 목적)
  reviewMode = true;
  window.reviewMode = true;

  // 인디케이터 업데이트하여 정답/오답 표시
  updateAllAnswerIndicators();

  // 제출 완료 후 로컬 진행 데이터 정리 (다음 진입 시 새로 시작하도록)
  try {
    const storageKey = getProgressStorageKey();
    if (storageKey) localStorage.removeItem(storageKey);
    const baseKey = getProgressBaseKey();
    if (baseKey) localStorage.removeItem(baseKey);
  } catch (_) {}

  // 결과 화면 즉시 표시 (저장보다 먼저)
  showResults();

  // 이하 모든 저장/세션 처리는 백그라운드 (결과 화면 차단 안 함)
  console.log("퀴즈 결과 저장 시도 (백그라운드)");

  // M3-D: 오프라인 상태 확인 → localStorage에 임시 저장
  if (!navigator.onLine) {
    console.warn('오프라인 상태 — 결과를 임시 저장합니다.');
    try {
      const pathMatch = window.location.pathname.split('/').pop().match(/(\d{4})_([^.]+)/);
      localStorage.setItem('pendingQuizSave', JSON.stringify({
        year: pathMatch ? pathMatch[1] : '2025',
        subject: pathMatch ? pathMatch[2] : 'unknown',
        savedAt: Date.now()
      }));
    } catch (e) { /* 무시 */ }
  }

  // 로그인 상태 확인
  if (isUserLoggedIn()) {
    try {
      // 인증 상태 보장 (백그라운드, isUserLoggedIn() 통과했으므로 이미 준비됨)
      import('../core/firebase-core.js').then(({ ensureAuthReady }) => ensureAuthReady()).catch(() => {});

      // 각 문제별로 풀이 결과 준비
      const attemptsToSave = [];

      const pathSegments = window.location.pathname.split('/');
      const filename = pathSegments[pathSegments.length - 1];
      const filenameMatch = filename.match(/(\d{4})_([^.]+)/);

      const _urlParamsSave = new URLSearchParams(window.location.search);
      let year = _urlParamsSave.get('year') || '2025';
      let subject = _urlParamsSave.get('subject') || '운동생리학';

      if (filenameMatch) {
        year = filenameMatch[1];
        subject = filenameMatch[2];
        try {
          subject = decodeURIComponent(subject);
        } catch (error) {
          console.error('과목명 디코딩 오류:', error);
        }
      } else {
        try {
          let decoded = subject;
          for (let i = 0; i < 3; i++) {
            const temp = decodeURIComponent(decoded);
            if (temp === decoded) break;
            decoded = temp;
          }
          subject = decoded;
        } catch (e) { /* 원본 유지 */ }
      }

      // 세션 ID 가져오기
      let sessionId = null;

      // 1. 세션 매니저 확인 및 세션 유효성 검사 추가
      if (window.sessionManager) {
        // 현재 세션이 없거나 유효하지 않은 경우 새 세션 시작
        const current = window.sessionManager.currentSession;
        const currentSessionId = window.sessionManager.getCurrentSessionId?.() || localStorage.getItem('currentSessionId');
        const needsNewSession = !current || !current.id || !currentSessionId;

        if (needsNewSession) {
          console.log("유효한 세션이 없어 새로 시작합니다.");
          try {
            await window.sessionManager.startNewSession();
          } catch (sessionError) {
            console.error("세션 시작 오류:", sessionError);
          }
        }

        sessionId = window.sessionManager.getCurrentSessionId();

        if (!sessionId) {
          console.warn("세션 ID가 없어 로컬 스토리지에서 확인합니다.");
          sessionId = localStorage.getItem('currentSessionId');

          // 여전히 세션 ID가 없으면 새로 생성
          if (!sessionId) {
            console.warn("로컬 스토리지에도 세션 ID가 없어 새로 생성합니다.");
            sessionId = generateSessionId();
            localStorage.setItem('currentSessionId', sessionId);
          }
        }

        console.log("저장에 사용할 세션 ID:", sessionId);
      } else if (sessionManager) {
        // 임포트된 객체를 사용하는 경우
        const current = sessionManager.currentSession;
        const currentSessionId = sessionManager.getCurrentSessionId?.() || localStorage.getItem('currentSessionId');
        const needsNewSession = !current || !current.id || !currentSessionId;

        if (needsNewSession) {
          console.log("유효한 세션이 없어 새로 시작합니다 (임포트된 객체 사용).");
          try {
            await sessionManager.startNewSession();
          } catch (sessionError) {
            console.error("세션 시작 오류 (임포트된 객체):", sessionError);
          }
        }

        sessionId = sessionManager.getCurrentSessionId();

        if (!sessionId) {
          console.warn("세션 ID가 없어 로컬 스토리지에서 확인합니다 (임포트된 객체).");
          sessionId = localStorage.getItem('currentSessionId');

          // 여전히 세션 ID가 없으면 새로 생성
          if (!sessionId) {
            console.warn("로컬 스토리지에도 세션 ID가 없어 새로 생성합니다.");
            sessionId = generateSessionId();
            localStorage.setItem('currentSessionId', sessionId);
          }
        }

        console.log("저장에 사용할 세션 ID (임포트된 객체):", sessionId);
      } else {
        // 세션 매니저가 없는 경우 로컬 스토리지에서 확인
        console.warn("세션 매니저를 찾을 수 없어 로컬 스토리지에서 확인합니다.");
        sessionId = localStorage.getItem('currentSessionId');

        // 로컬 스토리지에도 없으면 새로 생성
        if (!sessionId) {
          sessionId = generateSessionId();
          localStorage.setItem('currentSessionId', sessionId);
        }

        console.log("저장에 사용할 세션 ID (로컬 스토리지):", sessionId);
      }

      // 각 문제별로 저장할 데이터 준비
      const resolveIds = []; // 정답 문제 ID 모아서 일괄 처리
      for (let i = 0; i < questions.length; i++) {
        if (userAnswers[i] !== null) {
          const question = questions[i];

          // 정답 확인
          let correctAnswer = null;
          if (question.correctAnswer !== undefined) {
            correctAnswer = question.correctAnswer;
          } else if (question.correctOption !== undefined) {
            correctAnswer = question.correctOption;
          } else if (question.correct !== undefined) {
            correctAnswer = question.correct;
          }

          if (correctAnswer !== null) {
            // 배열인 경우 모든 선택지가 정답인지 확인
            let isCorrect = false;
            if (Array.isArray(correctAnswer) && correctAnswer.length === 4) {
              // 모든 선택지가 정답인 경우, 사용자가 답을 선택했으면 정답
              isCorrect = userAnswers[i] !== null;
            } else if (Array.isArray(correctAnswer)) {
              // 일부 선택지만 정답인 경우, 사용자 답변이 정답 배열에 포함되어 있는지 확인
              isCorrect = correctAnswer.includes(userAnswers[i]);
            } else {
              // 단일 정답인 경우
              isCorrect = userAnswers[i] === correctAnswer;
            }

            // 🎯 certificateType 추론 (URL 또는 localStorage)
            let certificateType = 'health-manager';  // 기본값

            // URL로부터 파일 경로 확인 (sports 폴더면 sports-instructor)
            if (window.location.pathname.includes('/exam-sports/') ||
              window.location.pathname.includes('/data-sports/')) {
              certificateType = 'sports-instructor';
            } else if (localStorage.getItem('currentCertificateType')) {
              certificateType = localStorage.getItem('currentCertificateType');
            }

            // ✅ 정답체크 상태 확인 (perQuestionChecked)
            const viewedExplanation = window.perQuestionChecked && window.perQuestionChecked[i] ? true : false;

            const questionData = {
              year,
              subject,
              number: i + 1,
              isFromMockExam: false,
              sessionId: sessionId,
              correctAnswer: correctAnswer, // 정답 정보 추가
              certificateType: certificateType,  // 🎯 자격증 정보 추가
              viewedExplanation: viewedExplanation  // ✅ 정답체크 상태 저장
            };

            // 저장할 데이터 배열에 추가
            attemptsToSave.push({
              questionData,
              userAnswer: userAnswers[i],
              isCorrect
            });

            // 오답노트: 고유 ID 부여 (연도_과목_번호)
            const wrongNoteId = `${year}_${subject}_${i + 1}`;
            const questionWithId = { ...question, id: wrongNoteId, userAnswer: userAnswers[i] };

            if (!isCorrect && auth.currentUser) {
              // ❌ 오답 → 오답노트에 저장 (사용자 선택 답 포함)
              const examNameVal = `${year}년 ${subject}`;
              saveWrongAnswer(auth.currentUser.uid, questionWithId, examNameVal, subject, certificateType)
                .catch(err => console.error("오답 자동 저장 실패:", err));
            } else if (isCorrect && auth.currentUser) {
              // ✅ 정답 → 오답노트 해결 대상으로 수집 (루프 후 일괄 처리)
              resolveIds.push(wrongNoteId);
            }
          }
        }
      }

      // 정답 문제 오답노트 해결 처리 (fire-and-forget, 결과 표시 차단 안 함)
      if (resolveIds.length > 0 && auth.currentUser) {
        const uid = auth.currentUser.uid;
        Promise.allSettled(resolveIds.map(id => markAsResolved(uid, id)))
          .catch(() => {});
      }

      console.log(`${attemptsToSave.length}개 문제 결과를 한 번에 저장합니다.`);

      // 배치 저장 (fire-and-forget — 결과 화면 표시를 차단하지 않음)
      const _batchFn = typeof window.batchRecordAttempts === 'function'
        ? window.batchRecordAttempts
        : typeof batchRecordAttempts === 'function'
          ? batchRecordAttempts
          : null;

      if (_batchFn) {
        _batchFn(attemptsToSave).then(result => {
          if (result?.success) {
            console.log('배치 저장 완료:', result);
          } else {
            console.warn('배치 저장 실패:', result?.error);
            if (typeof window.showToast === 'function') {
              window.showToast('풀이 기록 일부가 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.', 'error');
            }
          }
        }).catch(err => console.error('배치 저장 오류:', err));
      } else {
        console.warn('배치 저장 함수를 찾을 수 없어 개별 저장으로 진행합니다.');
        Promise.allSettled(
          attemptsToSave.map(a => recordAttempt(a.questionData, a.userAnswer, a.isCorrect))
        ).catch(err => console.error('개별 저장 오류:', err));
      }
    } catch (error) {
      console.error("퀴즈 결과 저장 중 오류 발생:", error);
    }
  } else {
    console.warn("사용자가 로그인하지 않아 결과가 저장되지 않습니다.");
  }

  // 세션 종료 (백그라운드)
  try {
    const manager = window.sessionManager || sessionManager;
    if (manager && typeof manager.endSession === 'function') {
      const correctAnswers = calculateScore();
      const totalQuestions = questions.length;
      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      manager.endSession({
        totalQuestions,
        attemptedQuestions: userAnswers.filter(answer => answer !== null).length,
        correctAnswers,
        accuracy: score,
        title: `${currentYear}년 ${currentSubject} 기출문제`,
        year: currentYear,
        subject: currentSubject,
        type: 'regular',
        completedAt: new Date()
      }).catch(err => console.warn('세션 종료 오류 (무시됨):', err));
    }
  } catch (error) {
    console.warn('세션 종료 오류 (무시됨):', error);
  }
}

/**
 * 세션 ID 생성 헬퍼 함수
 * @returns {string} 세션 ID (YYYYMMDD_HHMMSS_RANDOM 형식)
 */
function generateSessionId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // 난수 생성 (6자리 영숫자)
  const randomPart = Math.random().toString(36).substring(2, 8);

  return `${year}${month}${day}_${hours}${minutes}${seconds}_${randomPart}`;
}

/**
 * 퀴즈 재시작
 */
export function resetQuiz() {
  // 제출 상태 초기화 (재도전 가능)
  _submitInProgress = false;
  // 재도전 시 새로운 일반문제 세션 시작
  try {
    const manager = window.sessionManager || sessionManager;
    if (manager && typeof manager.startNewSession === 'function') {
      const metadata = buildRegularSessionMetadata(currentYear, currentSubject, questions.length || 20);
      manager.startNewSession(metadata).catch(error => {
        window.Logger?.warn('재도전 세션 시작 실패:', error);
      });
    }
  } catch (error) {
    window.Logger?.warn('재도전 세션 준비 오류:', error);
  }

  currentQuestionIndex = 0;
  userAnswers = new Array(questions.length).fill(null);
  timeRemaining = totalTime;
  reviewMode = false;

  // window 객체 업데이트
  window.currentQuestionIndex = currentQuestionIndex;
  window.userAnswers = userAnswers;
  window.timeRemaining = timeRemaining;
  window.reviewMode = reviewMode;

  clearInterval(timerInterval);
  startTimer();

  const resultsContainer = document.getElementById('results-summary');
  resultsContainer.style.display = 'none';

  document.getElementById('quiz-container').style.display = 'block';

  loadQuestion(currentQuestionIndex);
  updateQuestionIndicators();
}

/**
 * 오답 리뷰 시작
 */
export function reviewQuiz() {
  reviewMode = true;
  window.reviewMode = true;

  // 모든 오답 인덱스 수집
  const incorrectIndices = [];
  for (let i = 0; i < questions.length; i++) {
    const userAnswer = userAnswers[i];

    // 답변하지 않은 문제는 건너뛰기
    if (userAnswer === null) {
      continue;
    }

    const correctAnswer = questions[i].correctAnswer !== undefined
      ? questions[i].correctAnswer
      : questions[i].correct;

    // 배열인 경우 정답 확인
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

    if (!isCorrect) {
      incorrectIndices.push(i);
    }
  }

  console.log('📊 오답 확인 결과:', {
    전체문제수: questions.length,
    답변한문제수: userAnswers.filter(a => a !== null).length,
    틀린문제수: incorrectIndices.length
  });

  // 오답이 없는 경우
  if (incorrectIndices.length === 0) {
    alert('틀린 문제가 없습니다!');
    return;
  }

  // 첫 번째 오답으로 이동
  currentQuestionIndex = incorrectIndices[0];
  window.currentQuestionIndex = currentQuestionIndex;

  // 오답 인덱스 배열을 전역으로 저장
  window.incorrectIndices = incorrectIndices;
  window.currentIncorrectIndex = 0;

  // 네비게이션 버튼 함수 백업
  if (!window.originalNextFunction) {
    window.originalNextFunction = goToNextQuestion;
    window.originalPrevFunction = goToPreviousQuestion;
  }

  // 네비게이션 버튼 표시 (필수: showResults에서 none으로 설정된 후 복구)
  const navButtons = document.querySelector('.navigation-buttons');
  if (navButtons) {
    navButtons.style.display = 'flex';
  }

  // 네비게이션 버튼 — 기존 리스너 완전 교체 (cloneNode로 확실히 제거)
  const oldPrev = document.getElementById('prev-button');
  const oldNext = document.getElementById('next-button');
  const prevButton = oldPrev.cloneNode(true);
  const nextButton = oldNext.cloneNode(true);
  oldPrev.parentNode.replaceChild(prevButton, oldPrev);
  oldNext.parentNode.replaceChild(nextButton, oldNext);

  // disabled 클래스 제거 (pointer-events: none 방지) — disabled 속성으로만 제어
  prevButton.classList.remove('disabled');
  nextButton.classList.remove('disabled');

  prevButton.addEventListener('click', goToPreviousIncorrect);
  nextButton.addEventListener('click', goToNextIncorrect);

  // 네비게이션 버튼 초기 상태 설정
  prevButton.disabled = true;
  nextButton.disabled = incorrectIndices.length <= 1;

  // 리뷰 모드 UI 변경
  addReviewModeUI(incorrectIndices.length);

  // 인디케이터 강조 스타일 추가
  addIncorrectIndicatorStyle();

  document.getElementById('quiz-container').style.display = 'block';
  document.getElementById('results-summary').style.display = 'none';

  loadQuestion(currentQuestionIndex);
  updateQuestionIndicators();

  // 정답 표시
  showCurrentAnswer();

  // 인디케이터 영역으로 스크롤 (리뷰 메시지에 의해 밀려 잘리는 문제 방지)
  const indicatorContainer = document.querySelector('.question-indicators-container');
  if (indicatorContainer) {
    setTimeout(() => indicatorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

/**
 * 인디케이터 스타일 추가 (더 이상 사용 안 함 - CSS로 처리)
 */
function addIncorrectIndicatorStyle() {
  // CSS로 처리하므로 빈 함수
  /* 기존 동적 스타일 제거됨 - indicators.css에서 처리
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
  */
}

/**
 * 오답 모드에서 이전 오답으로 이동
 */
export function goToPreviousIncorrect() {
  if (window.currentIncorrectIndex > 0) {
    window.currentIncorrectIndex--;
    currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];
    window.currentQuestionIndex = currentQuestionIndex;

    // 버튼 상태 업데이트
    document.getElementById('prev-button').disabled = window.currentIncorrectIndex === 0;
    document.getElementById('next-button').disabled = false;

    // 오답 카운터 업데이트
    updateIncorrectCounter();

    loadQuestion(currentQuestionIndex);
    updateQuestionIndicators();

    // 정답 표시
    showCurrentAnswer();
  }
}

/**
 * 오답 모드에서 다음 오답으로 이동
 */
export function goToNextIncorrect() {
  if (window.currentIncorrectIndex < window.incorrectIndices.length - 1) {
    window.currentIncorrectIndex++;
    currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];
    window.currentQuestionIndex = currentQuestionIndex;

    // 버튼 상태 업데이트
    document.getElementById('next-button').disabled = window.currentIncorrectIndex === window.incorrectIndices.length - 1;
    document.getElementById('prev-button').disabled = false;

    // 오답 카운터 업데이트
    updateIncorrectCounter();

    loadQuestion(currentQuestionIndex);
    updateQuestionIndicators();

    // 정답 표시
    showCurrentAnswer();
  }
}

/**
 * 오답 카운터 업데이트
 */
function updateIncorrectCounter() {
  const infoElement = document.querySelector('.review-mode-info');
  if (infoElement && window.incorrectIndices) {
    const total = window.incorrectIndices.length;
    const current = window.currentIncorrectIndex + 1;
    infoElement.textContent = `틀린 ${total}문제를 확인하세요 (${current}/${total})`;
  }
}

/**
 * 리뷰 모드 UI 추가
 * @param {number} incorrectCount - 오답 개수
 */
function addReviewModeUI(incorrectCount) {
  // 리뷰 모드 메시지 추가
  const progressContainer = document.querySelector('.progress-container');
  const existingMsg = document.querySelector('.review-mode-message');
  if (existingMsg) existingMsg.remove();

  const reviewMessage = document.createElement('div');
  reviewMessage.className = 'review-mode-message';
  reviewMessage.innerHTML = `
    <div class="review-mode-title">📝 오답 리뷰 모드</div>
    <div class="review-mode-info">틀린 ${incorrectCount}문제를 확인하세요 (${window.currentIncorrectIndex + 1}/${incorrectCount})</div>
  `;
  progressContainer.prepend(reviewMessage);

  // 리뷰 모드 스타일은 CSS 파일에서 관리 (인라인 스타일 제거)
  // CSS 파일의 .review-mode-message 스타일이 적용됩니다

  // 리뷰 종료 버튼 추가
  const navButtons = document.querySelector('.navigation-buttons');
  let exitButton = document.querySelector('.exit-review-button');
  if (!exitButton) {
    exitButton = document.createElement('button');
    exitButton.className = 'nav-button exit-review-button';
    exitButton.textContent = '리뷰 종료';
    navButtons.appendChild(exitButton);
  }

  exitButton.onclick = exitReviewMode;
}

/**
 * 리뷰 모드 종료
 */
export function exitReviewMode() {
  reviewMode = false;
  window.reviewMode = false;

  // 네비게이션 버튼 숨기기 (결과 화면으로 돌아가므로)
  const navButtons = document.querySelector('.navigation-buttons');
  if (navButtons) {
    navButtons.style.display = 'none';
  }

  // 네비게이션 버튼 원래 기능으로 복원 (cloneNode로 리뷰 리스너 제거)
  const oldPrev = document.getElementById('prev-button');
  const oldNext = document.getElementById('next-button');
  const prevButton = oldPrev.cloneNode(true);
  const nextButton = oldNext.cloneNode(true);
  oldPrev.parentNode.replaceChild(prevButton, oldPrev);
  oldNext.parentNode.replaceChild(nextButton, oldNext);

  prevButton.addEventListener('click', goToPreviousQuestion);
  nextButton.addEventListener('click', goToNextQuestion);

  // 리뷰 모드 메시지 제거
  const reviewMessage = document.querySelector('.review-mode-message');
  if (reviewMessage) reviewMessage.remove();

  // 리뷰 종료 버튼 제거
  const exitButton = document.querySelector('.exit-review-button');
  if (exitButton) exitButton.remove();

  // 인디케이터 스타일 제거
  const indicatorStyle = document.getElementById('incorrect-indicators-style');
  if (indicatorStyle) indicatorStyle.remove();

  // 결과 화면으로 돌아가기
  document.getElementById('quiz-container').style.display = 'none';
  document.getElementById('results-summary').style.display = 'block';
}

/**
 * 뒤로가기 링크 설정
 * @param {string} year - 연도
 */
export function setBackLink(year) {
  const backLink = document.querySelector('.back-link');
  if (backLink) {
    backLink.href = `../years/year_${year}.html`;
  }
}

/**
 * 결과 화면 표시
 */
export function showResults() {
  const correctAnswers = calculateScore();
  const totalQuestions = questions.length;
  const answeredQuestions = userAnswers.filter(answer => answer !== null).length;
  const score = correctAnswers * 5; // 개당 5점씩
  const maxScore = totalQuestions * 5; // 만점
  const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100); // 백분율 점수

  // 년도와 과목 정보 추출
  const pathSegments = window.location.pathname.split('/');
  const filename = pathSegments[pathSegments.length - 1];
  const filenameMatch = filename.match(/(\d{4})_([^.]+)/);

  const _urlParamsResult = new URLSearchParams(window.location.search);
  let year = _urlParamsResult.get('year') || '2025';
  let subject = _urlParamsResult.get('subject') || '운동생리학';

  if (filenameMatch) {
    year = filenameMatch[1];  // 추출된 년도 (예: 2024)
    subject = filenameMatch[2];  // 추출된 과목 (예: 운동생리학)
    // URL 디코딩을 통해 한글 과목명이 올바르게 표시되도록 함
    try {
      subject = decodeURIComponent(subject);
    } catch (error) {
      console.error('과목명 디코딩 오류:', error);
    }
  } else {
    try {
      let decoded = subject;
      for (let i = 0; i < 3; i++) {
        const temp = decodeURIComponent(decoded);
        if (temp === decoded) break;
        decoded = temp;
      }
      subject = decoded;
    } catch (e) { /* 원본 유지 */ }
  }

  // 현재 날짜 
  const today = new Date();
  const date = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  // 네비게이션 버튼 가리기 (존재하는 경우에만)
  const navButtons = document.querySelector('.navigation-buttons');
  if (navButtons) navButtons.style.display = 'none';

  // 점수에 따른 메시지 생성
  let scoreMessage = '';

  // 점수에 따른 메시지 생성 (getScoreComment 함수 사용)
  scoreMessage = getScoreComment(scorePercentage);

  // 결과 화면 컨테이너 준비
  const resultsContainer = document.getElementById('results-summary');
  
  // 타이머 요소에서 시간 가져오기 (없으면 timeRemaining 변수 사용)
  let timerText = '00:00';
  const timerElement = document.getElementById('timer');
  if (timerElement && timerElement.textContent) {
    timerText = timerElement.textContent;
  } else {
    // timeRemaining 변수 사용 (초 단위를 mm:ss 형식으로 변환)
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  resultsContainer.innerHTML = `
    <h2 class="results-title">학습이 완료되었습니다!</h2>
    
    <div class="score-display">
      <div class="score-card">
        <div class="score-label">내 점수</div>
        <div class="score-value">${score}</div>
        <div class="score-subvalue">총점 ${maxScore}점 기준</div>
        <div class="score-percent">정답률 ${scorePercentage}%</div>
      </div>
    </div>

    <div class="time-taken">
      <span>⏱️ 소요 시간:</span>
      <strong>${timerText}</strong>
    </div>

    <div class="results-message">
      <p>${scoreMessage}</p>
      <div style="margin-top: 12px; font-size: 0.95rem; opacity: 0.8;">
        정답: ${correctAnswers} / 전체: ${totalQuestions} 문항
      </div>
    </div>

    <div class="results-criteria">
      <div class="results-criteria__title">채점 기준 안내</div>
      <div class="results-criteria__item">합격 기준: 60점 이상</div>
      <div class="results-criteria__item">과락 기준: 40점 미만</div>
      <div class="results-criteria__item">현재 점수: ${score}점 (${scorePercentage}%)</div>
    </div>
    
    <div class="results-actions">
      <button onclick="reviewQuiz()" class="action-button review-button">오답 리뷰</button>
      <button onclick="(function(){var p=location.pathname;location.href=p.includes('-sports1')?'../si1.html':p.includes('-sports')?'../si2.html':'../cft.html'})()" class="action-button home-button">홈으로</button>
    </div>
  `;

  // 화면 표시 상태 설정
  document.getElementById('quiz-container').style.display = 'none';
  resultsContainer.style.display = 'block';
}

/**
 * 점수 코멘트 가져오기
 * @param {number} scorePercentage - 백분율 점수
 * @returns {string} 코멘트
 */
function getScoreComment(scorePercentage) {
  if (scorePercentage >= 90) return '훌륭합니다! 거의 완벽하게 풀었습니다.';
  if (scorePercentage >= 80) return '잘했습니다! 합격이고 높은 점수를 받았습니다.';
  if (scorePercentage >= 60) return '합격입니다! 60점이 합격 기준이니 통과했습니다.';
  if (scorePercentage >= 40) return '아쉽습니다. 60점이 합격 기준인데 조금 더 노력해보세요.';
  return '다시 도전해보세요. 더 많은 연습이 필요합니다.';
}

/**
 * 특정 과목의 가장 최근 년도를 찾는 함수
 * @param {string} subject - 과목명
 * @returns {Promise<string|null>} 최근 연도
 */
async function findLatestYear(subject) {
  let dataFolder = window.QUIZ_DATA_FOLDER ? `${window.QUIZ_DATA_FOLDER}/` : '';
  if (!dataFolder && (window.location.pathname.includes('exam-sports') || window.location.pathname.includes('subjects-sports'))) {
    dataFolder = 'sports/';
  }
  // 확인할 년도 범위 (현재부터 과거)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= 2019; year--) {
    years.push(year);
  }

  // 년도를 하나씩 확인하며 데이터 존재 여부 확인
  for (const year of years) {
    try {
      const response = await fetch(`../data/${dataFolder}${year}_${subject}.json`);
      if (response.ok) {
        return year.toString();
      }
    } catch (error) {
      console.error(`${year}년 데이터 확인 중 오류:`, error);
    }
  }

  return null; // 찾을 수 없는 경우
}

/**
 * 현재 문제의 정답을 보여주는 함수
 */
export function showCurrentAnswer() {
  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    console.error('현재 문제를 찾을 수 없습니다.');
    return;
  }

  // 정답 확인 (correctAnswer, correctOption, correct 필드 중 하나 사용)
  let correctAnswerIndex = null;
  if (typeof currentQuestion.correctAnswer !== 'undefined') {
    correctAnswerIndex = currentQuestion.correctAnswer;
  } else if (typeof currentQuestion.correctOption !== 'undefined') {
    correctAnswerIndex = currentQuestion.correctOption;
  } else if (typeof currentQuestion.correct !== 'undefined') {
    correctAnswerIndex = currentQuestion.correct;
  }

  if (correctAnswerIndex === null) {
    console.error('정답 정보를 찾을 수 없습니다.');
    return;
  }

  const selectedAnswer = userAnswers[currentQuestionIndex];

  // 정답 확인 로직 수정
  let isCorrect = false;
  let correctAnswerText = '';

  // 배열 형태의 정답 처리
  if (Array.isArray(correctAnswerIndex)) {
    // 배열의 길이가 선택지 전체 개수와 같으면(모든 선택지가 정답일 때) 어떤 답을 선택해도 정답
    if (correctAnswerIndex.length === 4) { // 4개 선택지 기준
      isCorrect = selectedAnswer !== null; // 답을 선택했다면 정답
      correctAnswerText = "모든 선택지 정답";
    } else {
      // 일부만 정답인 경우 기존 로직 유지
      isCorrect = correctAnswerIndex.includes(selectedAnswer);
      correctAnswerText = correctAnswerIndex.map(idx => (idx + 1) + '번').join(' 또는 ');
    }
  } else {
    // 단일 값인 경우 기존 비교 방식 유지
    isCorrect = selectedAnswer === correctAnswerIndex;
    correctAnswerText = (correctAnswerIndex + 1) + '번';
  }

  // 피드백
  const feedback = document.getElementById('feedback');
  feedback.className = `answer-feedback ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`;

  // ✅ 임시: 구독 기능 완전 구현 전까지 모두에게 해설 표시
  const isPremium = true; // 임시로 모두에게 허용

  // 해설 표시
  let explanationHTML = `<div class="explanation">${currentQuestion.explanation || ''}</div>`;

  // 수정된 정답 표시 사용
  feedback.innerHTML = `
    <div class="feedback-title">
      <span class="feedback-icon">${isCorrect ? '✓' : '✗'}</span>
      <span>${isCorrect ? '정답입니다!' : '오답입니다!'}</span>
    </div>
    ${!isCorrect ? `<div class="correct-answer">정답: ${correctAnswerText}</div>` : ''}
    ${explanationHTML}
  `;
  feedback.style.display = 'block';

  // 현재 문제를 '확인됨'으로 표시하고 인디케이터에 즉시 반영
  perQuestionChecked[currentQuestionIndex] = true;
  window.perQuestionChecked = perQuestionChecked;
  saveQuizProgress(currentQuestionIndex);
  updateQuestionIndicators();
}

export function handleKeyboardNavigation(event) {
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
  if (document.querySelector('.modal.show')) {
    return;
  }

  // 퀴즈 컨테이너가 표시되어 있지 않으면 무시
  const quizContainer = document.getElementById('quiz-container');
  if (!quizContainer || quizContainer.style.display === 'none') {
    return;
  }

  // 🔧 테스트용: Ctrl+Shift+A 로 모든 문제 1번으로 자동 선택
  if (event.ctrlKey && event.shiftKey && event.key === 'A') {
    event.preventDefault();
    console.log('🧪 테스트 모드: 모든 문제를 1번으로 자동 선택합니다...');

    // 모든 문제에 1번 답 선택 (0번 인덱스)
    questions.forEach((q, index) => {
      userAnswers[index] = 0; // 1번 = 인덱스 0
    });

    // 인디케이터 업데이트
    updateQuestionIndicators();

    // 현재 문제 선택 상태 업데이트
    updateSelectedOption();

    // 진행 상황 업데이트
    checkAllAnswered();
    updateProgressDisplay();

    console.log('✅ 테스트 모드 완료: 모든 문제 1번으로 선택됨');
    alert(`테스트 모드: 모든 문제(${questions.length}개)가 1번으로 선택되었습니다!`);

    return;
  }

  // 키보드 입력 처리
  if (event.key >= '1' && event.key <= '4') {
    event.preventDefault();
    selectOption(parseInt(event.key) - 1);
    window.Logger?.debug(`키보드 숫자 ${event.key} 입력 - 선택지 선택`);
  } else if (event.key === 'ArrowLeft') {
    // 왼쪽 화살표: 이전 문제
    const prevButton = document.getElementById('prev-button');
    if (prevButton && !prevButton.disabled) {
      event.preventDefault();
      window.Logger?.debug("왼쪽 화살표 키 입력 감지 - 이전 문제로 이동");
      // 리뷰 모드에서는 이전 오답으로, 아니면 이전 문제로
      if (window.reviewMode && window.incorrectIndices) {
        goToPreviousIncorrect();
      } else {
        goToPreviousQuestion();
      }
    } else {
      window.Logger?.debug("왼쪽 화살표 입력되었지만 이전 버튼이 비활성화됨");
    }
  } else if (event.key === 'ArrowRight') {
    // 오른쪽 화살표: 다음 문제
    const nextButton = document.getElementById('next-button');
    if (nextButton && !nextButton.disabled) {
      event.preventDefault();
      window.Logger?.debug("오른쪽 화살표 키 입력 감지 - 다음 문제로 이동");
      // 리뷰 모드에서는 다음 오답으로, 아니면 다음 문제로
      if (window.reviewMode && window.incorrectIndices) {
        goToNextIncorrect();
      } else {
        goToNextQuestion();
      }
    } else {
      window.Logger?.debug("오른쪽 화살표 입력되었지만 다음 버튼이 비활성화되거나 숨겨짐");
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    if (submitButton && submitButton.style.display !== 'none') {
      submitQuiz();
    } else if (userAnswers[currentQuestionIndex] !== null) {
      showCurrentAnswer();
    }
  }
}

// 함수들을 window 객체에 추가하여 HTML에서 직접 호출 가능하게 함
window.reviewQuiz = reviewQuiz;
window.resetQuiz = resetQuiz;
window.goToPreviousQuestion = goToPreviousQuestion;
window.goToNextQuestion = goToNextQuestion;
window.goToPreviousIncorrect = goToPreviousIncorrect;
window.goToNextIncorrect = goToNextIncorrect;
window.exitReviewMode = exitReviewMode;
window.showCurrentAnswer = showCurrentAnswer;
window.updateAllAnswerIndicators = updateAllAnswerIndicators;

// 디버깅 함수 추가
window.testRecordAttempt = function () {
  console.log('문제 저장 테스트 시작...');

  const testData = {
    year: '2024',
    subject: '운동생리학',
    number: 1,
    isFromMockExam: false
  };

  if (typeof window.recordAttempt === 'function') {
    console.log('window.recordAttempt 함수를 사용하여 테스트합니다.');
    window.recordAttempt(testData, 0, true)
      .then(result => {
        console.log('문제 저장 테스트 결과:', result);
        alert('테스트 성공: ' + JSON.stringify(result));
      })
      .catch(error => {
        console.error('문제 저장 테스트 오류:', error);
        alert('테스트 실패: ' + error.message);
      });
  } else if (typeof recordAttempt === 'function') {
    console.log('recordAttempt 함수를 사용하여 테스트합니다.');
    recordAttempt(testData, 0, true)
      .then(result => {
        console.log('문제 저장 테스트 결과:', result);
        alert('테스트 성공: ' + JSON.stringify(result));
      })
      .catch(error => {
        console.error('문제 저장 테스트 오류:', error);
        alert('테스트 실패: ' + error.message);
      });
  } else {
    console.error('recordAttempt 함수를 찾을 수 없습니다.');
    alert('recordAttempt 함수를 찾을 수 없습니다.');
  }
};

window.checkGlobalFunctions = function () {
  console.log('전역 함수 확인:');

  const functionInfo = {
    'window.recordAttempt': typeof window.recordAttempt,
    'recordAttempt': typeof recordAttempt,
    'window.recordMockExamResults': typeof window.recordMockExamResults,
    'window.sessionManager': window.sessionManager ? '존재함' : '없음',
    'sessionId': window.sessionManager ? window.sessionManager.getCurrentSessionId() : '없음'
  };

  console.log(functionInfo);
  alert('전역 함수 확인: ' + JSON.stringify(functionInfo, null, 2));

  return functionInfo;
};

/**
 * 오답노트 모드 초기화 함수
 * @param {Object} sessionData - 오답노트 세션 데이터
 * @returns {Promise<boolean>} 초기화 성공 여부
 */
async function initializeIncorrectMode(sessionData) {
  try {
    console.log('오답노트 모드 초기화:', sessionData);

    // 헤더 타이틀 변경
    const titleElement = document.querySelector('.quiz-title h1');
    if (titleElement) {
      titleElement.textContent = `${sessionData.subject} 오답 학습`;
    }

    // 서브타이틀 변경
    const subtitleElement = document.querySelector('.quiz-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = `총 ${sessionData.questionsCount}문항 | 오답 복습`;
    }

    // 로딩 메시지 표시
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
      <div class="loading-message">
        <div class="spinner"></div>
        <p>오답 문제를 불러오는 중...</p>
      </div>
    `;

    // 문제 로드
    const loadedQuestions = [];

    // 각 문제에 대해 JSON 데이터 로드
    for (const questionInfo of sessionData.questions) {
      const year = questionInfo.year;
      const questionNumber = questionInfo.number;

      try {
        // JSON 파일 경로 구성
        const jsonPath = `../data/${year}_${sessionData.subject}.json`;
        console.log(`JSON 로드 시도: ${jsonPath} 중 ${questionNumber}번 문제`);

        // JSON 파일 로드
        const response = await fetch(jsonPath);

        if (!response.ok) {
          console.error(`JSON 로드 실패: ${jsonPath}`);
          continue;
        }

        const questionSet = await response.json();

        // 문제 번호에 해당하는 문제 찾기 (인덱스는 0부터 시작)
        const questionIndex = questionNumber - 1;

        if (questionIndex >= 0 && questionIndex < questionSet.length) {
          // 문제 데이터에 메타정보 추가
          const question = questionSet[questionIndex];
          loadedQuestions.push({
            ...question,
            year,
            subject: sessionData.subject,
            number: questionNumber,
            isFromIncorrectNotes: true
          });

          console.log(`문제 로드 성공: ${year}년 ${sessionData.subject} ${questionNumber}번`);
        } else {
          console.warn(`유효하지 않은 문제 번호: ${questionNumber} (${jsonPath})`);
        }
      } catch (error) {
        console.error(`문제 로드 오류:`, error);
      }
    }

    console.log(`총 ${loadedQuestions.length}개 오답 문제 로드됨`);

    // 로드된 문제가 없는 경우
    if (loadedQuestions.length === 0) {
      quizContainer.innerHTML = `
        <div class="error-message">
          <h3>오답 문제를 불러올 수 없습니다</h3>
          <p>해당 과목의 오답 문제를 찾을 수 없습니다. 다시 시도해 주세요.</p>
          <button onclick="window.close()">창 닫기</button>
        </div>
      `;
      return false;
    }

    // 전역 변수 초기화
    questions = loadedQuestions;
    userAnswers = new Array(questions.length).fill(null);
    currentQuestionIndex = 0;

    // 첫 시도 추적 초기화
    firstAttemptTracking = new Array(questions.length).fill(true);

    // 리뷰 모드로 시작 (이미 틀린 문제니까)
    reviewMode = true;

    // 전역 변수 window 객체에 동기화
    window.questions = questions;
    window.userAnswers = userAnswers;
    window.currentQuestionIndex = currentQuestionIndex;
    window.firstAttemptTracking = firstAttemptTracking;
    window.reviewMode = reviewMode;

    // 오답노트 모드 UI 추가
    addIncorrectModeUI();

    // 첫 문제 로드
    loadQuestion(currentQuestionIndex);
    initQuestionIndicators();

    // 자동 타이머 중지 (오답노트 모드에서는 시간 제한 없음)
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
    }

    // 타이머 UI 업데이트
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.parentElement.innerHTML = `
        <span class="timer-icon">📝</span>
        <span id="timer" class="incorrect-mode-timer">오답 학습</span>
      `;
    }

    // 점수 계산 방식 오버라이드 (오답노트 모드에서는 문제 개별 평가)
    window.originalCalculateScore = window.calculateScore;
    window.calculateScore = function () {
      return userAnswers.filter((answer, index) => {
        const correctAnswer = questions[index].correctAnswer !== undefined
          ? questions[index].correctAnswer
          : questions[index].correct;
        return answer === correctAnswer;
      }).length;
    };

    return true;
  } catch (error) {
    console.error('오답노트 모드 초기화 오류:', error);

    // 오류 표시
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
      <div class="error-message">
        <h3>오답노트 초기화 오류</h3>
        <p>${error.message}</p>
        <button onclick="window.close()">창 닫기</button>
      </div>
    `;

    return false;
  }
}

/**
 * 오답 복습 퀴즈 모드 초기화
 * wrong-note.html에서 체크한 문제들을 sessionStorage에서 읽어 퀴즈로 구성
 */
async function initializeWrongReviewMode() {
  try {
    const raw = sessionStorage.getItem('wrongReviewQuestions');
    if (!raw) {
      throw new Error('복습할 문제 데이터가 없습니다. 오답노트에서 문제를 선택해주세요.');
    }

    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('선택된 문제가 없습니다.');
    }

    console.log(`오답 복습 퀴즈: ${items.length}문제 로드`);

    // 헤더 타이틀 변경
    const titleElement = document.querySelector('.quiz-title h1');
    if (titleElement) {
      titleElement.textContent = '오답 복습 퀴즈';
    }
    const subtitleElement = document.querySelector('.quiz-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = `총 ${items.length}문항 | 오답 복습`;
    }

    // 뒤로가기 링크 → 오답노트로
    const backLink = document.querySelector('.back-link');
    if (backLink) {
      backLink.href = '../wrong-note.html';
    }

    // questionData에서 퀴즈용 배열 구성
    const loadedQuestions = items.map((item, idx) => {
      const qData = item.questionData || {};
      return {
        ...qData,
        // 메타 정보 보강
        year: qData.year || extractYearFromExamName(item.examName),
        subject: item.section || qData.subject || '',
        number: qData.id || qData.number || (idx + 1),
        isFromWrongReview: true,
        wrongNoteDocId: item.docId,
        wrongNoteQuestionId: item.questionId
      };
    });

    // 전역 변수 초기화
    questions = loadedQuestions;
    userAnswers = new Array(questions.length).fill(null);
    perQuestionChecked = new Array(questions.length).fill(false);
    currentQuestionIndex = 0;
    firstAttemptTracking = new Array(questions.length).fill(true);
    reviewMode = false; // 복습이지만 실제로 풀어야 하므로 false

    // 세션 생성 (wrong-review 타입)
    try {
      const manager = window.sessionManager || sessionManager;
      if (manager && typeof manager.startNewSession === 'function') {
        await manager.startNewSession({
          type: 'wrong-review',
          title: `오답 복습 (${items.length}문제)`,
          totalQuestions: items.length,
          subject: 'mixed',
          year: 'mixed'
        });
      }
    } catch (e) {
      console.warn('오답 복습 세션 생성 실패 (무시):', e);
    }

    // window 동기화
    window.questions = questions;
    window.userAnswers = userAnswers;
    window.currentQuestionIndex = currentQuestionIndex;
    window.firstAttemptTracking = firstAttemptTracking;
    window.reviewMode = reviewMode;

    // UI 초기화
    addIncorrectModeUI(); // 배너 스타일 재사용

    // 첫 문제 로드
    loadQuestion(currentQuestionIndex);
    initQuestionIndicators();

    // 타이머 중지 (오답 복습은 시간 제한 없음)
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
    }
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.parentElement.innerHTML = `
        <span class="timer-icon">&#128221;</span>
        <span id="timer" class="incorrect-mode-timer">오답 복습</span>
      `;
    }

    // sessionStorage 정리 (재진입 방지)
    sessionStorage.removeItem('wrongReviewQuestions');

    return true;
  } catch (error) {
    console.error('오답 복습 퀴즈 초기화 오류:', error);
    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer) {
      quizContainer.innerHTML = `
        <div class="error-message">
          <h3>오답 복습 문제를 불러올 수 없습니다</h3>
          <p>${error.message}</p>
          <a href="../wrong-note.html" style="display:inline-block; margin-top:12px; padding:10px 20px; background:var(--penguin-navy); color:white; border-radius:8px; text-decoration:none;">오답 노트로 돌아가기</a>
        </div>
      `;
    }
    return false;
  }
}

/**
 * examName에서 년도 추출 (예: "2024년 기능해부학" → "2024")
 */
function extractYearFromExamName(examName) {
  if (!examName) return '';
  const match = examName.match(/(\d{4})/);
  return match ? match[1] : '';
}

/**
 * 오답노트 모드 UI 추가
 */
function addIncorrectModeUI() {
  // 오답노트 모드 스타일 추가
  const styleId = 'incorrect-mode-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .incorrect-mode-banner {
        background-color: #ffebee;
        color: #d32f2f;
        padding: 10px 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 500;
        border-left: 4px solid #f44336;
      }
      
      .incorrect-mode-timer {
        background-color: #ffebee;
        color: #d32f2f;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .exit-incorrect-mode {
        background-color: #f44336;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .exit-incorrect-mode:hover {
        background-color: #d32f2f;
      }
      
      .loading-message {
        text-align: center;
        padding: 40px 0;
      }
      
      .spinner {
        width: 40px;
        height: 40px;
        margin: 0 auto 20px;
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        border-top-color: #0D5C80;
        animation: spin 1s ease-in-out infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .error-message {
        text-align: center;
        padding: 30px;
        background-color: #ffebee;
        border-radius: 8px;
        margin: 20px 0;
      }
      
      .error-message h3 {
        color: #d32f2f;
        margin-bottom: 10px;
      }
      
      .error-message button {
        background-color: #0D5C80;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 15px;
      }
    `;
    document.head.appendChild(style);
  }

  // 오답노트 모드 배너 추가
  const progressContainer = document.querySelector('.progress-container');
  if (progressContainer) {
    const banner = document.createElement('div');
    banner.className = 'incorrect-mode-banner';
    banner.innerHTML = `
      <div>📝 오답노트 학습 모드</div>
      <button class="exit-incorrect-mode" onclick="window.close()">학습 종료</button>
    `;
    progressContainer.prepend(banner);
  }
}

// 기존 initializeQuiz 함수 확장을 위해 원본 함수 백업
export const originalInitializeQuiz = window.initializeQuiz || initializeQuiz;

/**
 * 확장된 퀴즈 초기화 함수 (기존 initializeQuiz 함수를 오버라이드)
 */
export async function extendedInitializeQuiz() {
  try {
    window.Logger?.debug('확장된 퀴즈 초기화 시작');

    // URL 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // 오답노트 모드인 경우
    if (mode === 'incorrect') {
      window.Logger?.debug('오답노트 모드 감지됨');

      const questions = urlParams.get('questions');  // data 대신 questions 사용
      if (!questions) {
        throw new Error('오답노트 데이터가 없습니다.');
      }

      try {
        const subject = urlParams.get('subject') || '운동심리학';
        const count = urlParams.get('count') || '0';
        const year = urlParams.get('year') || '2024';

        // 세션 데이터 구성
        const incorrectSessionData = {
          mode: 'incorrect',
          subject: subject,
          questionsCount: parseInt(count),
          questions: JSON.parse(decodeURIComponent(questions))
        };

        // 오답노트 모드 초기화
        return await initializeIncorrectMode(incorrectSessionData);
      } catch (error) {
        window.Logger?.error('오답노트 데이터 파싱 오류:', error);
        throw new Error('오답노트 데이터 형식이 올바르지 않습니다: ' + error.message);
      }
    }

    // 오답 복습 퀴즈 모드 (wrong-note.html에서 체크한 문제들)
    if (mode === 'wrong-review') {
      window.Logger?.debug('오답 복습 퀴즈 모드 감지됨');
      return await initializeWrongReviewMode();
    }

    // 기존 초기화 함수 호출 (일반 모드)
    return await originalInitializeQuiz();
  } catch (error) {
    window.Logger?.error('퀴즈 초기화 오류:', error);

    // 오류 표시
    document.getElementById('quiz-container').innerHTML = `
      <div class="error-message">
        <h3>문제 로드 실패</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()">다시 시도</button>
      </div>
    `;

    return false;
  }
}

/**
 * 세션에서 이전 답변 복원 함수
 * @param {string} year - 년도
 * @param {string} subject - 과목명
 * @param {string} sessionIdToRestore - 복원할 세션 ID (선택사항)
 */
/**
 * 마지막 풀었던 문제 번호만 가져오기 (답변 복원 없음)
 * 이어풀기 기능 개선: 답변 복원 없이 마지막 위치로만 이동
 */
async function getLastQuestionNumber(year, subject, sessionIdToRestore = null) {
  try {
    // 세션 ID 가져오기 (우선순위: 파라미터 > 로컬 스토리지 > 세션 매니저)
    let sessionId = sessionIdToRestore;

    if (!sessionId) {
      sessionId = localStorage.getItem('resumeSessionId');
    }

    if (!sessionId && window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
    }

    if (!sessionId) {
      sessionId = localStorage.getItem('currentSessionId');
    }

    if (!sessionId) {
      console.log('세션 ID가 없어 마지막 문제 위치를 확인할 수 없습니다.');
      return null;
    }

    console.log('세션 ID로 마지막 문제 위치 확인:', sessionId);

    // Firebase에서 세션의 attempts 가져오기
    const { db } = await import('../core/firebase-core.js');
    const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const { auth } = await import('../core/firebase-core.js');

    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return null;
    }

    const attemptsRef = collection(db, 'attempts');
    const attemptsQuery = query(
      attemptsRef,
      where('userId', '==', user.uid),
      where('sessionId', '==', sessionId),
      orderBy('timestamp', 'asc')
    );

    const attemptsSnapshot = await getDocs(attemptsQuery);

    if (attemptsSnapshot.empty) {
      console.log('이전 답변이 없습니다.');
      return null;
    }

    let lastQuestionIndex = -1; // 마지막 풀었던 문제 인덱스

    // ✅ 마지막 풀었던 문제 번호만 찾기 (답변 복원은 하지 않음)
    attemptsSnapshot.forEach(doc => {
      const attempt = doc.data();
      const questionData = attempt.questionData || {};

      // 문제 번호 매칭
      let questionIndex = -1;

      // 일반 문제: number로 매칭
      if (questionData.number !== undefined && questionData.number !== null) {
        questionIndex = questionData.number - 1; // 1-based → 0-based
      }
      // 모의고사: globalIndex로 매칭
      else if (questionData.globalIndex !== undefined && questionData.globalIndex !== null) {
        questionIndex = questionData.globalIndex; // 이미 0-based
      }

      // 유효한 인덱스인 경우
      if (questionIndex >= 0 && questionIndex < questions.length) {
        // ✅ 마지막 풀었던 문제 인덱스 업데이트
        if (questionIndex > lastQuestionIndex) {
          lastQuestionIndex = questionIndex;
        }
      }
    });

    window.Logger?.info(`이어풀기: 마지막 문제 위치 확인 - 문제 ${lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : '없음'}번`);
    console.log(`[이어서풀기] 마지막 문제: ${lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : '없음'} (답변 복원 없음)`);

    // ✅ 마지막 풀었던 문제 번호 반환 (다음 문제로 이동하기 위해 +1)
    return lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : null;

  } catch (error) {
    console.error('마지막 문제 위치 확인 오류:', error);
    throw error;
  }
}

/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다.
 * 대신 getLastQuestionNumber 함수를 사용하여 마지막 문제 위치만 가져옵니다.
 * 이어풀기에서는 답변을 복원하지 않고 마지막 위치로만 이동합니다.
 */
async function restorePreviousAnswers(year, subject, sessionIdToRestore = null) {
  // 레거시 호환성을 위해 getLastQuestionNumber 호출
  return await getLastQuestionNumber(year, subject, sessionIdToRestore);
}

// 전역 함수 오버라이드
window.initializeQuiz = extendedInitializeQuiz;

/**
 * 슬림한 레이아웃 적용 함수
 * 진행상황과 시계를 한 줄로 배치
 */
function applySlimLayout() {
  const progressContainer = document.querySelector('.progress-container');
  if (progressContainer) {
    const progressInfo = progressContainer.querySelector('.progress-info');
    const timerContainer = progressContainer.querySelector('.timer-container');

    if (progressInfo && timerContainer && !document.querySelector('.progress-header')) {
      // progress-header 컨테이너 생성
      const progressHeader = document.createElement('div');
      progressHeader.className = 'progress-header';
      progressHeader.style.display = 'flex';
      progressHeader.style.justifyContent = 'space-between';
      progressHeader.style.alignItems = 'center';
      progressHeader.style.marginBottom = '8px';
      progressHeader.style.height = '40px'; // 고정 높이로 정렬 개선

      // progress-info 스타일 개선
      progressInfo.style.display = 'flex';
      progressInfo.style.alignItems = 'center';
      progressInfo.style.gap = '8px';
      progressInfo.style.height = '40px';

      // timer-container 스타일 개선
      timerContainer.style.display = 'flex';
      timerContainer.style.alignItems = 'center';
      timerContainer.style.gap = '8px';
      timerContainer.style.height = '40px';

      // 진행상황 텍스트 스타일 개선
      const progressText = progressInfo.querySelector('div:first-child');
      if (progressText) {
        progressText.style.fontSize = '14px';
        progressText.style.fontWeight = '500';
        progressText.style.color = '#5e6ad2';
      }

      // 진행상황 카운트 스타일 개선
      const progressCount = progressInfo.querySelector('.progress-count');
      if (progressCount) {
        progressCount.style.fontSize = '16px';
        progressCount.style.fontWeight = '600';
        progressCount.style.color = '#2c3e50';
        progressCount.style.backgroundColor = '#f8f9fa';
        progressCount.style.padding = '4px 8px';
        progressCount.style.borderRadius = '6px';
        progressCount.style.border = '1px solid #e9ecef';
      }

      // 시계 아이콘 스타일 개선
      const timerIcon = timerContainer.querySelector('.timer-icon');
      if (timerIcon) {
        timerIcon.style.fontSize = '16px';
      }

      // 시계 텍스트 스타일 개선
      const timerText = timerContainer.querySelector('#timer');
      if (timerText) {
        timerText.style.fontSize = '16px';
        timerText.style.fontWeight = '600';
        timerText.style.color = '#2c3e50';
        timerText.style.backgroundColor = '#fff3cd';
        timerText.style.padding = '4px 8px';
        timerText.style.borderRadius = '6px';
        timerText.style.border = '1px solid #ffeaa7';
      }

      // progress-info와 timer-container를 progress-header로 이동
      progressHeader.appendChild(progressInfo);
      progressHeader.appendChild(timerContainer);

      // progress-container의 첫 번째 자식으로 추가
      progressContainer.insertBefore(progressHeader, progressContainer.firstChild);

      console.log('개선된 슬림한 레이아웃 적용 완료');
    }
  }
}

// DOM 로드 완료 후 슬림한 레이아웃 적용
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applySlimLayout);
} else {
  applySlimLayout();
}

// MutationObserver로 동적으로 추가되는 경우에도 적용
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      const progressContainer = document.querySelector('.progress-container');
      if (progressContainer && !document.querySelector('.progress-header')) {
        applySlimLayout();
        break;
      }
    }
  }
});

// body 감시 시작
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}