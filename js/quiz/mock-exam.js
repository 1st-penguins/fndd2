// ✅ 수정 완료: async/await 및 urlParams 중복 선언 제거 (2025-01-21 15:30)
// 버전: v2.1.0 - 캐시 무효화
// IIFE로 전체 코드 감싸기
(function () {
  // 전역 변수에서 sessionManager 가져오기
  const sessionManager = window.sessionManager;

  /* ===== 전역 변수 설정 ===== */
  let questions = [];
  let allQuestions = [];      // 모든 과목 문제 리스트
  let subjectQuestions = {};  // 과목별 문제 저장 객체
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let timerInterval;
  let totalTime = 80 * 60;    // 총 시간 (초 단위: 80분)
  let timeRemaining = totalTime;
  let currentSubject = "all"; // 현재 선택된 과목 (기본값: 전체)
  let reviewMode = false;     // 오답 리뷰 모드 여부
  let subjectNames = [];      // 과목 이름 배열 - 동적으로 설정됨
  let subjectAccentColors = {}; // 과목별 색상 - 동적으로 설정됨
  let firstAttemptTracking = []; // 첫 시도 추적 배열
  let keyboardEventsRegistered = false; // 키보드 이벤트 등록 여부 추적
  let year = '2025'; // 모의고사 년도 (전역 변수)
  let hour = '1';    // 모의고사 교시 (전역 변수)

  // 개발 모드 확인
  const isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 현재 선택된 자격증 타입 추정 (분석 페이지 필터와 동일하게 맞추기 위함)
  function getActiveCertificateType() {
    const stored =
      localStorage.getItem('selectedCertificateType') ||
      localStorage.getItem('certificateType') ||
      'health-manager';
    return stored === 'sports-instructor' ? 'sports-instructor' : 'health-manager';
  }

  // 개발 모드에서만 로그 출력하는 유틸리티 함수
  const log = (message, type = 'log') => {
    // 개발 모드이고, 타입이 'debug'가 아니거나 명시적으로 디버그 모드가 활성화된 경우에만 로그 출력
    if (isDevMode && (type !== 'debug' || window.debugMode === true)) {
      console[type](message);
    }
  };

  // 개발 모드에서 firstAttemptTracking 노출 (디버깅용)
  if (isDevMode) {
    window.firstAttemptTracking = firstAttemptTracking;
  }

  // 키보드 이벤트 핸들러를 별도 함수로 분리
  function handleKeyboardEvent(event) {
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

    // 🔧 테스트용: Ctrl+Shift+A 로 모든 문제 1번으로 자동 선택
    if (event.ctrlKey && event.shiftKey && event.key === 'A') {
      event.preventDefault();
      console.log('🧪 테스트 모드: 모든 문제를 1번으로 자동 선택합니다...');

      // 모든 문제에 1번 답 선택 (0번 인덱스)
      allQuestions.forEach(q => {
        userAnswers[q.globalIndex] = 0; // 1번 = 인덱스 0
      });

      // 인디케이터 업데이트
      updateQuestionIndicators();

      // 현재 문제 선택 상태 업데이트
      updateSelectedOption();

      console.log('✅ 테스트 모드 완료: 80개 문제 모두 1번으로 선택됨');
      alert('테스트 모드: 모든 문제가 1번으로 선택되었습니다!');

      return;
    }

    // 퀴즈 컨테이너가 표시되어 있지 않으면 무시
    const quizContainer = document.getElementById('quiz-container');
    if (!quizContainer || quizContainer.style.display === 'none') {
      return;
    }

    // 키보드 입력 처리
    if (event.key >= '1' && event.key <= '4') {
      event.preventDefault();
      selectOption(parseInt(event.key) - 1);
      updateQuestionIndicators();
      log("키보드 숫자 입력 후 인디케이터 업데이트", 'debug');
    } else if (event.key === 'ArrowLeft') {
      // 왼쪽 화살표: 이전 문제
      const prevButton = document.getElementById('prev-button');
      if (prevButton && !prevButton.disabled) {
        event.preventDefault();
        log("왼쪽 화살표 키 입력 감지 - 이전 문제로 이동", 'debug');
        goToPreviousQuestion();
        // 인디케이터 업데이트를 위한 지연 추가
        setTimeout(() => {
          updateQuestionIndicators();
          log("왼쪽 화살표 후 인디케이터 업데이트", 'debug');
        }, 50);
      } else {
        log("왼쪽 화살표 입력되었지만 이전 버튼이 비활성화됨", 'debug');
      }
    } else if (event.key === 'ArrowRight') {
      // 오른쪽 화살표: 다음 문제
      const nextButton = document.getElementById('next-button');
      if (nextButton && 
          nextButton.style.display !== 'none' && 
          !nextButton.disabled) {
        event.preventDefault();
        log("오른쪽 화살표 키 입력 감지 - 다음 문제로 이동", 'debug');
        goToNextQuestion();
        // 인디케이터 업데이트를 위한 지연 추가
        setTimeout(() => {
          updateQuestionIndicators();
          log("오른쪽 화살표 후 인디케이터 업데이트", 'debug');
        }, 50);
      } else {
        log("오른쪽 화살표 입력되었지만 다음 버튼이 비활성화되거나 숨겨짐", 'debug');
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const submitButton = document.getElementById('submit-button');
      if (submitButton && submitButton.style.display !== 'none') {
        submitQuiz();
      } else if (questions[currentQuestionIndex] && 
                 userAnswers[questions[currentQuestionIndex].globalIndex] !== null) {
        checkAnswer();
        // 정답 확인 후 인디케이터 업데이트
        updateQuestionIndicators();
      }
    }
  }

  // 모의고사 정보 추출 함수
  function extractMockExamInfo() {
    const currentPath = window.location.pathname;
    const filename = currentPath.split('/').pop();

    let year = '2025'; // 기본값
    let hour = '1';    // 기본값

    // 1. 파일명에서 추출 시도
    const fileMatch = filename.match(/(\d{4}).*?(\d)교시/);
    if (fileMatch) {
      year = fileMatch[1];
      hour = fileMatch[2];
    }

    // 2. 페이지 제목에서 추출 시도 (파일명에서 실패했을 경우)
    if (year === '2025') {
      const titleElement = document.querySelector('.quiz-title h1');
      if (titleElement) {
        const titleMatch = titleElement.textContent.match(/(\d{4}).*?(\d)교시/);
        if (titleMatch) {
          year = titleMatch[1];
          hour = titleMatch[2];
        }
      }
    }

    // 3. URL 매개변수에서 추출 시도 (다른 방법이 실패했을 경우)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('year')) year = urlParams.get('year');
    if (urlParams.has('hour')) hour = urlParams.get('hour');

    return { year, hour };
  }

  /**
   * 모의고사 세션에서 이전 답변 복원 함수
   * @param {string} year - 년도
   * @param {string} hour - 교시
   */
  /**
   * 마지막 풀었던 문제 번호만 가져오기 (답변 복원 없음)
   * 이어풀기 기능 개선: 답변 복원 없이 마지막 위치로만 이동
   */
  async function getLastQuestionNumberForMockExam(year, hour) {
    try {
      // 현재 세션 ID 가져오기
      let sessionId = null;
      if (window.sessionManager) {
        sessionId = window.sessionManager.getCurrentSessionId();
      }

      if (!sessionId) {
        sessionId = localStorage.getItem('currentSessionId');
      }

      if (!sessionId) {
        log('세션 ID가 없어 마지막 문제 위치를 확인할 수 없습니다.');
        return null;
      }

      log('세션 ID로 마지막 문제 위치 확인:', sessionId);

      // Firebase에서 세션의 attempts 가져오기
      const { db, auth, ensureFirebase } = await import('../core/firebase-core.js');
      // ✅ Firebase 초기화 확인
      await ensureFirebase();

      const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

      const user = auth.currentUser;
      if (!user) {
        log('로그인이 필요합니다.');
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
        log('이전 답변이 없습니다.');
        return null;
      }

      let lastQuestionIndex = -1; // 마지막 풀었던 문제 인덱스

      // ✅ 마지막 풀었던 문제 번호만 찾기 (답변 복원은 하지 않음)
      attemptsSnapshot.forEach(doc => {
        const attempt = doc.data();
        const questionData = attempt.questionData || {};

        // 모의고사는 globalIndex로 매칭
        if (questionData.globalIndex !== undefined && questionData.globalIndex !== null) {
          const globalIndex = questionData.globalIndex;

          // 유효한 인덱스인 경우
          if (globalIndex >= 0 && globalIndex < questions.length) {
            // ✅ 마지막 풀었던 문제 인덱스 업데이트
            if (globalIndex > lastQuestionIndex) {
              lastQuestionIndex = globalIndex;
            }
          }
        }
      });

      log(`이어풀기: 마지막 문제 위치 확인 - 문제 ${lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : '없음'}번 (답변 복원 없음)`);

      // ✅ 마지막 풀었던 문제 번호 반환 (다음 문제로 이동하기 위해 +1)
      return lastQuestionIndex >= 0 ? lastQuestionIndex + 1 : null;

    } catch (error) {
      console.error('마지막 문제 위치 확인 오류:', error);
      throw error;
    }
  }

  /**
   * @deprecated 이 함수는 더 이상 사용되지 않습니다.
   * 대신 getLastQuestionNumberForMockExam 함수를 사용하여 마지막 문제 위치만 가져옵니다.
   * 이어풀기에서는 답변을 복원하지 않고 마지막 위치로만 이동합니다.
   */
  async function restorePreviousAnswersForMockExam(year, hour) {
    // 레거시 호환성을 위해 getLastQuestionNumberForMockExam 호출
    return await getLastQuestionNumberForMockExam(year, hour);
  }

  /* ===== DOMContentLoaded 이벤트 (초기화 및 데이터 로드) ===== */
  document.addEventListener('DOMContentLoaded', async function () {
    // 이미 등록되었으면 무시
    if (keyboardEventsRegistered) {
      log('키보드 이벤트가 이미 등록되어 있습니다.', 'debug');
      return;
    }

    // 키보드 이벤트 등록
    document.addEventListener('keydown', handleKeyboardEvent);

    // 등록 완료 표시
    keyboardEventsRegistered = true;
    log('키보드 이벤트 리스너가 등록되었습니다.');

    // 모의고사 정보 추출 및 전역 변수에 할당
    const mockExamInfo = extractMockExamInfo();
    year = mockExamInfo.year;
    hour = mockExamInfo.hour;
    log(`모의고사 정보: ${year}년도 ${hour}교시`);

    // 페이지 제목과 헤더 타이틀 업데이트
    document.title = `${year} 모의고사 ${hour}교시 - 퍼스트펭귄 건강운동관리사`;

    // 페이지 제목 업데이트 (quiz-title 또는 page-title)
    const titleElement = document.querySelector('.quiz-title h1') || document.querySelector('.page-title h1');
    if (titleElement) {
      titleElement.textContent = `${year} 모의고사 ${hour}교시`;
    }

    // 교시에 따른 과목 설정
    subjectNames = hour === '1' ?
      ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"] :
      ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];

    // 세션 초기화 시도
    try {
      // ✅ Firebase 초기화 먼저 수행
      const { auth, ensureFirebase } = await import('../core/firebase-core.js');
      await ensureFirebase();

      // 인증 상태 확인 함수
      const checkAuth = () => {
        return auth && auth.currentUser !== null;
      };

      // ✅ 페이지 로드 시 세션 생성하지 않음 (실제 문제를 풀 때만 생성)
      // 이어풀기 모드인 경우에만 기존 세션 복구
      const urlParams = new URLSearchParams(window.location.search);
      const isResume = urlParams.get('resume') === 'true';
      
      const startSessionIfAuth = async () => {
        if (checkAuth()) {
          if (window.sessionManager) {
            // 이어풀기 모드인 경우에만 기존 세션 복구 시도
            if (isResume) {
              const sessionMetadata = {
                year: year,
                hour: hour,
                type: 'mockexam',
                title: `${year}년 ${hour}교시 모의고사`,
                subjects: subjectNames,
                totalQuestions: 80,
                examType: '모의고사',
                isActive: true
              };
              
              // 기존 세션 복구 시도 (같은 년도, 같은 교시의 활성 세션이 있으면 재사용)
              const session = await window.sessionManager.startNewSession(sessionMetadata, true);
              if (session) {
                console.log('이어풀기 모드: 모의고사 세션 복구됨:', session.id);
              } else {
                console.log('이어풀기 모드: 복구할 세션이 없음');
              }
            } else {
              // 일반 모드: 세션 생성하지 않음 (첫 문제 풀이 시 자동 생성됨)
              console.log('일반 모드: 세션 생성하지 않음 (첫 문제 풀이 시 자동 생성)');
            }
          }
          return true;
        }
        return false;
      };

      // 바로 확인 시도
      let authVerified = await startSessionIfAuth();

      // 인증되지 않은 경우 짧은 간격으로 재시도
      if (!authVerified) {
        for (let i = 0; i < 6 && !authVerified; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          authVerified = await startSessionIfAuth();
        }
      }
    } catch (error) {
      console.error('세션 초기화 오류:', error);
    }

    // 과목별 데이터 경로 생성 (년도 포함)
    const subjectDataPaths = subjectNames.map(subject => `../data/${year}_${subject}.json`);

    // 과목 탭 동적 생성
    const subjectTabsContainer = document.querySelector('.subject-tabs');
    subjectTabsContainer.innerHTML = `
      <button class="subject-tab active" data-subject="all">전체 문제</button>
      ${subjectNames.map(subject =>
      `<button class="subject-tab" data-subject="${subject}">${subject}</button>`
    ).join('')}
    `;

    // 과목별 색상 설정
    subjectNames.forEach((subject, index) => {
      // 과목별 색상 배열 - 새로운 색상 코드 적용
      const colors = [
        "rgba(54, 129, 171, 0.2)",  // 운동생리학/운동상해 - 진한 파란색
        "rgba(174, 215, 237, 0.2)", // 건강체력평가/기능해부학 - 연한 하늘색
        "rgba(152, 155, 190, 0.2)", // 운동처방론/병태생리학 - 보라색
        "rgba(205, 198, 231, 0.2)"  // 운동부하검사/스포츠심리학 - 연한 라벤더색
      ];
      subjectAccentColors[subject] = colors[index % colors.length];
    });

    // 데이터 로드 - 오류 처리 강화
    Promise.all(
      subjectDataPaths.map(path =>
        fetch(path)
          .then(response => {
            if (!response.ok) {
              throw new Error(`${path} 로드 실패: ${response.status}`);
            }
            return response.json();
          })
          .catch(error => {
            console.error(`데이터 로드 오류 (${path}):`, error);
            // 오류 발생 시 빈 배열 반환하여 전체 Promise 실패 방지
            return [];
          })
      )
    )
      .then(async data => {
        let index = 0;
        subjectQuestions = {};

        // 각 과목별 문제 데이터 처리
        subjectNames.forEach((subject, i) => {
          // 데이터가 없는 경우 빈 배열로 처리
          const subjectData = data[i] || [];
          if (subjectData.length === 0) {
            log(`${subject} 과목의 데이터가 없습니다.`, 'warn');
          }

          subjectQuestions[subject] = subjectData.map(q => ({ ...q, subject: subject, globalIndex: index++ }));
        });

        // 모든 문제 배열 생성
        allQuestions = [];
        subjectNames.forEach(subject => {
          allQuestions = [...allQuestions, ...subjectQuestions[subject]];
        });

        // 문제가 하나도 없는 경우 처리
        if (allQuestions.length === 0) {
          alert(`${year}년도 ${hour}교시 문제 데이터를 찾을 수 없습니다.`);
          return;
        }

        questions = allQuestions;
        userAnswers = new Array(questions.length).fill(null);
        // 첫 시도 추적 배열 초기화
        firstAttemptTracking = new Array(allQuestions.length).fill(true);

        // ✅ 자동 복구: 세션에서 이전 답변 복원 (5분 이내 세션 자동 복구)
        const urlParams = new URLSearchParams(window.location.search);
        const isResume = urlParams.get('resume') === 'true';
        let lastQuestionNumber = null;

        // localStorage에서 빠른 복구 시도 (5분 이내 데이터)
        const localStorageKey = `mockexam_${year}_${hour}_answers`;
        const savedData = localStorage.getItem(localStorageKey);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            const savedTime = parsed.timestamp || 0;
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000; // 5분

            // 5분 이내 데이터면 빠르게 복구
            if (now - savedTime < fiveMinutes && parsed.answers) {
              log('localStorage에서 빠른 복구 중...');
              parsed.answers.forEach((answer, index) => {
                if (answer !== null && answer !== undefined) {
                  userAnswers[index] = answer;
                }
              });

              if (parsed.perQuestionChecked) {
                window.perQuestionChecked = parsed.perQuestionChecked;
              }

              if (parsed.lastQuestionIndex !== undefined) {
                lastQuestionNumber = parsed.lastQuestionIndex + 1;
              }

              log(`localStorage에서 ${parsed.answers.filter(a => a !== null).length}개 답변 복구 완료`);
            }
          } catch (error) {
            console.error('localStorage 복구 오류:', error);
          }
        }

        // Firebase에서 세션 복구 시도 (5분 이내 세션, localStorage에 데이터가 없거나 오래된 경우)
        const shouldRestoreFromFirebase = !savedData || (savedData && (() => {
          try {
            const parsed = JSON.parse(savedData);
            const savedTime = parsed.timestamp || 0;
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            return now - savedTime >= fiveMinutes; // 5분 이상 지났으면 Firebase에서 복구
          } catch {
            return true; // 파싱 실패 시 Firebase에서 복구
          }
        })());

        if (shouldRestoreFromFirebase) {
          log('Firebase 세션에서 마지막 문제 위치 확인 중...');
          try {
            // ✅ 답변 복원 없이 마지막 문제 번호만 가져오기
            const restoredLastQuestion = await getLastQuestionNumberForMockExam(year, hour);
            if (restoredLastQuestion && !lastQuestionNumber) {
              lastQuestionNumber = restoredLastQuestion;
              log('마지막 풀었던 문제 번호:', lastQuestionNumber);
            }

            // ✅ 이어서 풀기 모드에서 마지막 문제 번호로 currentQuestionIndex 초기화
            if (lastQuestionNumber && lastQuestionNumber > 0) {
              const targetIndex = lastQuestionNumber - 1; // 1-based → 0-based
              if (targetIndex >= 0 && targetIndex < questions.length) {
                currentQuestionIndex = targetIndex;
                log(`이어서 풀기: currentQuestionIndex를 ${currentQuestionIndex}로 설정 (답변 복원 없이 위치만 이동)`);
              }
            }

            // ✅ 답변 복원을 하지 않으므로 localStorage 저장도 위치 정보만 저장
            if (restoredLastQuestion) {
              try {
                const saveData = {
                  answers: userAnswers, // 빈 배열로 시작
                  perQuestionChecked: window.perQuestionChecked || new Array(questions.length).fill(false),
                  lastQuestionIndex: restoredLastQuestion - 1,
                  timestamp: Date.now()
                };
                localStorage.setItem(localStorageKey, JSON.stringify(saveData));
              } catch (error) {
                console.warn('localStorage 저장 오류:', error);
              }
            }
          } catch (error) {
            console.error('마지막 문제 위치 확인 오류:', error);
            // 오류 발생해도 계속 진행
          }
        } else if (lastQuestionNumber && lastQuestionNumber > 0) {
          // ✅ localStorage에서 복구한 경우에도 currentQuestionIndex 업데이트
          const targetIndex = lastQuestionNumber - 1; // 1-based → 0-based
          if (targetIndex >= 0 && targetIndex < questions.length) {
            currentQuestionIndex = targetIndex;
            log(`localStorage 복구: currentQuestionIndex를 ${currentQuestionIndex}로 설정`);
          }
        }

        loadQuestion(currentQuestionIndex);
        initQuestionIndicators();

        // ✅ 인디케이터 초기화 후 복구된 답변 반영
        updateQuestionIndicators();

        startTimer();

        // 이벤트 리스너 등록
        document.getElementById('prev-button').addEventListener('click', goToPreviousQuestion);
        document.getElementById('next-button').addEventListener('click', goToNextQuestion);
        document.getElementById('check-button').addEventListener('click', checkAnswer);
        document.getElementById('submit-button').addEventListener('click', submitQuiz);

        document.querySelectorAll('.subject-tab').forEach(tab => {
          tab.addEventListener('click', function () {
            changeSubject(this.dataset.subject);
          });
        });

        window.addEventListener('resize', function () {
          if (document.getElementById('question-indicators')) {
            initQuestionIndicators();
          }
        });

        // 인디케이터 확인 및 표시
        const indicatorsContainer = document.querySelector('.question-indicators-container');
        if (indicatorsContainer && indicatorsContainer.style.display === 'none') {
          indicatorsContainer.style.display = 'block';
        }

        updateProgressDisplay();

        // URL에서 goto 또는 question 파라미터 확인하여 특정 문제 번호로 이동
        // ✅ urlParams는 이미 위에서 선언됨 (중복 선언 제거)
        let gotoQuestion = urlParams.get('goto') || urlParams.get('question');

        // ✅ 세션 복구 시 자동으로 마지막 풀었던 문제로 이동 (isResume 조건 제거)
        if (!gotoQuestion && lastQuestionNumber) {
          const targetIndex = lastQuestionNumber - 1;
          // currentQuestionIndex가 이미 마지막 문제로 설정되어 있으면 이동하지 않음
          if (currentQuestionIndex !== targetIndex) {
            gotoQuestion = lastQuestionNumber.toString();
            log('세션 복구: 마지막 풀었던 문제로 이동:', lastQuestionNumber);
          } else {
            // 이미 올바른 위치에 있으므로 답변만 다시 표시
            log('세션 복구: 이미 마지막 문제 위치에 있음, 답변만 복원', 'debug');
            updateSelectedOption();
            updateQuestionIndicators();
          }
        }

        if (gotoQuestion) {
          // 문제 번호를 정수로 변환 (1부터 시작하는 번호)
          const targetNumber = parseInt(gotoQuestion);
          if (!isNaN(targetNumber) && targetNumber > 0 && targetNumber <= questions.length) {
            // 문제 번호는 1부터 시작하지만 인덱스는 0부터 시작하므로 변환
            const targetIndex = targetNumber - 1;

            // ✅ 이미 currentQuestionIndex가 설정되었으면 중복 이동하지 않음
            if (currentQuestionIndex === targetIndex) {
              // 이미 올바른 위치에 있으므로 답변만 다시 표시
              log('세션 복구: 이미 올바른 위치에 있음, 답변만 복원', 'debug');
              updateSelectedOption();
              updateQuestionIndicators();
              updateProgressDisplay();
            } else {
              // 화면이 모두 로드된 후 약간의 지연을 두고 이동 (안정성 향상)
              setTimeout(() => {
                log(`세션 복구에서 이동: ${targetNumber}번 문제로 이동합니다.`);
                currentQuestionIndex = targetIndex;
                loadQuestion(currentQuestionIndex);
                updateQuestionIndicators();
                updateProgressDisplay();
              }, 300);
            }
          } else {
            log(`유효하지 않은 문제 번호: ${gotoQuestion}`);
          }
        }
      })
      .catch(error => {
        console.error('문제 로드 오류:', error);
        alert(`모의고사 데이터를 불러오는 데 실패했습니다. (${year}년도 ${hour}교시)\n오류: ${error.message}`);
      });

    setBackLink(year);
  });

  /* ===== 데이터/이벤트 핸들러 관련 함수 ===== */

  function changeSubject(subject) {
    document.querySelectorAll('.subject-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.subject === subject);
    });

    // 리뷰 모드 상태 저장
    const wasInReviewMode = reviewMode;

    // 원래 과목 저장
    const previousSubject = currentSubject;

    // 현재 과목 변경
    currentSubject = subject;

    if (subject === 'all') {
      // 전체 문제 모드
      questions = allQuestions;

      // 리뷰 모드인 경우 전체 오답 다시 수집
      if (wasInReviewMode) {
        // 현재 리뷰 중인 오답의 globalIndex 저장
        const currentIncorrectGlobalIndex = window.incorrectGlobalIndices ?
          window.incorrectGlobalIndices[window.currentIncorrectIndex] : null;

        // 전체 문제에서 오답 다시 수집
        const allIncorrectIndices = [];
        const allIncorrectGlobalIndices = [];

        for (let i = 0; i < allQuestions.length; i++) {
          const question = allQuestions[i];
          if (userAnswers[question.globalIndex] !== null) {
            const userAnswer = userAnswers[question.globalIndex];
            const correctAnswer = question.correctAnswer;

            // 정답 확인 로직 개선
            let isCorrect = false;

            if (Array.isArray(correctAnswer)) {
              // 배열인 경우 (다중 정답)
              if (correctAnswer.length === 4) {
                // 모든 선택지가 정답인 경우
                isCorrect = true; // 답을 선택했다면 정답
              } else {
                // 일부 선택지만 정답인 경우
                isCorrect = correctAnswer.includes(userAnswer);
              }
            } else {
              // 단일 정답인 경우
              isCorrect = userAnswer === correctAnswer;
            }

            // 틀린 문제만 추가
            if (!isCorrect) {
              allIncorrectIndices.push(i);
              allIncorrectGlobalIndices.push(question.globalIndex);
            }
          }
        }

        // 전체 오답 인덱스로 업데이트
        window.incorrectIndices = allIncorrectIndices;
        window.incorrectGlobalIndices = allIncorrectGlobalIndices;

        // 현재 리뷰 중인 오답 위치 찾기
        if (currentIncorrectGlobalIndex !== null) {
          const newIndex = allIncorrectGlobalIndices.indexOf(currentIncorrectGlobalIndex);
          if (newIndex !== -1) {
            window.currentIncorrectIndex = newIndex;
            currentQuestionIndex = allIncorrectIndices[newIndex];
          } else {
            window.currentIncorrectIndex = 0;
            currentQuestionIndex = allIncorrectIndices[0];
          }
        } else {
          window.currentIncorrectIndex = 0;
          currentQuestionIndex = allIncorrectIndices[0];
        }
      } else {
        // 일반 모드일 경우
        // 전체 모드에서 풀지 않은 첫 번째 문제 찾기
        let firstUnansweredIndex = questions.findIndex(q => userAnswers[q.globalIndex] === null);
        currentQuestionIndex = firstUnansweredIndex !== -1 ? firstUnansweredIndex : 0;
      }
    } else {
      // 과목별 모드
      questions = subjectQuestions[subject] || [];

      // 과목 데이터가 없는 경우 처리
      if (questions.length === 0) {
        alert(`${subject} 과목의 문제 데이터가 없습니다.`);
        return;
      }

      // 리뷰 모드일 경우
      if (wasInReviewMode) {
        // 현재 전체 오답 인덱스 저장
        const originalIncorrectIndices = window.incorrectIndices || [];
        const originalGlobalIndices = window.incorrectGlobalIndices || [];

        // 현재 과목의 오답 필터링 (전체 문제 기준)
        const subjectIncorrectGlobalIndices = [];
        const subjectIncorrectIndices = [];

        // 현재 과목의 오답 문제 인덱스 수집
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const globalIndex = question.globalIndex;
          const userAnswer = userAnswers[globalIndex];

          // 답변하지 않은 문제는 건너뛰기
          if (userAnswer === null) {
            continue;
          }

          // 정답 확인 로직 (배열 정답 지원)
          const correctAnswer = question.correctAnswer !== undefined
            ? question.correctAnswer
            : question.correct;

          let isCorrect = false;
          if (Array.isArray(correctAnswer)) {
            if (correctAnswer.length === 4) {
              // 모든 선택지가 정답인 경우
              isCorrect = userAnswer !== null;
            } else {
              // 일부 선택지만 정답인 경우
              isCorrect = correctAnswer.includes(userAnswer);
            }
          } else {
            // 단일 정답인 경우
            isCorrect = userAnswer === correctAnswer;
          }

          // 틀린 문제만 추가
          if (!isCorrect) {
            subjectIncorrectIndices.push(i); // 과목 내 인덱스
            subjectIncorrectGlobalIndices.push(globalIndex); // 전체 문제 내 인덱스
          }
        }

        console.log(`📊 과목별 오답 확인 (${subject}):`, {
          전체문제수: questions.length,
          틀린문제수: subjectIncorrectIndices.length
        });

        // 현재 과목에 오답이 있으면 첫 번째 오답으로 이동
        if (subjectIncorrectIndices.length > 0) {
          // 첫 번째 오답으로 이동 (과목 내 첫 번째 오답)
          currentQuestionIndex = subjectIncorrectIndices[0];

          // 현재 과목의 오답 인덱스로 전역 변수 업데이트
          window.incorrectIndices = subjectIncorrectIndices;
          window.incorrectGlobalIndices = subjectIncorrectGlobalIndices;
          window.currentIncorrectIndex = 0;

          // 네비게이션 버튼 상태 설정
          const prevButton = document.getElementById('prev-button');
          const nextButton = document.getElementById('next-button');

          prevButton.disabled = true;
          nextButton.disabled = subjectIncorrectIndices.length <= 1;

          // 오답 카운터 업데이트
          if (document.querySelector('.review-mode-message')) {
            updateIncorrectCounter(subjectIncorrectIndices.length);
          }
        } else {
          // 현재 과목에 오답이 없는 경우: 리뷰 모드 유지, 카운터만 0으로 업데이트
          if (document.querySelector('.review-mode-message')) {
            updateIncorrectCounter(0);
          }
          // 첫 번째 문제로 이동(과목 내)
          currentQuestionIndex = 0;
          window.currentIncorrectIndex = 0;
          window.incorrectIndices = [];
          window.incorrectGlobalIndices = [];
        }
      } else {
        // 일반 모드에서 과목 변경
        // 과목별 모드에서 풀지 않은 첫 번째 문제 찾기
        let firstUnansweredIndex = questions.findIndex(q => userAnswers[q.globalIndex] === null);
        currentQuestionIndex = firstUnansweredIndex !== -1 ? firstUnansweredIndex : 0;
      }
    }

    // 피드백 숨기기
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'none';
    feedback.innerHTML = '';

    // 결과 화면 표시 여부 확인
    const isResultsShown = document.getElementById('results-summary').style.display === 'block';

    loadQuestion(currentQuestionIndex);

    // 인디케이터 초기화 후, 리뷰 모드면 현재 상태에 맞게 복구
    initQuestionIndicators();
    if (wasInReviewMode && window.incorrectGlobalIndices && window.incorrectGlobalIndices.length >= 0) {
      // 현재 과목의 인디케이터들에 대해 사용자 답 기준으로 correct/incorrect 반영
      const indicators = document.querySelectorAll('.indicator');
      indicators.forEach((indicator, idx) => {
        const question = questions[idx];
        const globalIndex = question.globalIndex;
        const answer = userAnswers[globalIndex];
        if (answer !== null) {
          const correctAnswer = question.correctAnswer !== undefined ? question.correctAnswer : question.correct;
          let isCorrect = false;
          if (Array.isArray(correctAnswer)) {
            if (correctAnswer.length === 4) {
              isCorrect = answer !== null;
            } else {
              isCorrect = correctAnswer.includes(answer);
            }
          } else {
            isCorrect = answer === correctAnswer;
          }
          indicator.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
      });
    }

    // 결과 화면이 표시된 이후라면 정답/오답 표시 복구
    if (isResultsShown) {
      updateResultIndicators();
    }

    // 리뷰 모드 UI 업데이트 (과목 변경 시에도 유지)
    if (wasInReviewMode) {
      // 리뷰 모드 UI가 아직 없으면 추가
      if (!document.querySelector('.review-mode-message')) {
        const incorrectCount = window.incorrectIndices ? window.incorrectIndices.length : 0;
        addReviewModeUI(incorrectCount, subject);
      } else {
        // UI는 있지만 카운터 업데이트
        updateIncorrectCounter();
      }

      // 네비게이션 버튼 이벤트 리스너 설정 (과목 변경 시에도 오답 이동 유지)
      const prevButton = document.getElementById('prev-button');
      const nextButton = document.getElementById('next-button');

      // 기존 이벤트 리스너 제거
      prevButton.removeEventListener('click', goToPreviousQuestion);
      nextButton.removeEventListener('click', goToNextQuestion);
      prevButton.removeEventListener('click', goToPreviousIncorrect);
      nextButton.removeEventListener('click', goToNextIncorrect);

      // 오답 이동 이벤트 리스너 설정
      prevButton.addEventListener('click', goToPreviousIncorrect);
      nextButton.addEventListener('click', goToNextIncorrect);

      // 버튼 상태 설정
      if (window.incorrectIndices) {
        prevButton.disabled = window.currentIncorrectIndex === 0;
        nextButton.disabled = window.currentIncorrectIndex >= window.incorrectIndices.length - 1;
      }

      // 정답/해설 표시
      if (questions[currentQuestionIndex]) {
        showCurrentAnswer(questions[currentQuestionIndex]);
      }
    } else {
      // 일반 모드에서는 기본 이벤트 리스너로 복원
      const prevButton = document.getElementById('prev-button');
      const nextButton = document.getElementById('next-button');

      // 기존 이벤트 리스너 제거
      prevButton.removeEventListener('click', goToPreviousQuestion);
      nextButton.removeEventListener('click', goToNextQuestion);
      prevButton.removeEventListener('click', goToPreviousIncorrect);
      nextButton.removeEventListener('click', goToNextIncorrect);

      // 기본 이벤트 리스너 설정
      prevButton.addEventListener('click', goToPreviousQuestion);
      nextButton.addEventListener('click', goToNextQuestion);
    }

    updateProgressDisplay();
  }

  function loadQuestion(index) {
    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0 || !questions[index]) {
      log('문제 데이터가 없습니다.', 'error');
      return;
    }

    const question = questions[index];

    // 과목별 문제 번호 계산 (1~20)
    let displayNumber;
    if (currentSubject === "all") {
      // 전체 문제 모드에서는 그대로 1~80 표시
      displayNumber = index + 1;
    } else {
      // 과목별 모드에서는 1~20 표시
      displayNumber = index + 1;
    }

    // 과목 배지 색상 설정 - 선택된 과목 색상과 일치하도록
    const subjectBadge = document.getElementById('subject-badge');
    subjectBadge.textContent = question.subject;

    // 배지 기본 스타일 설정 - 절대 위치로 변경하여 잘림 방지 (우측 상단)
    subjectBadge.style.position = "absolute";
    subjectBadge.style.top = "16px";
    subjectBadge.style.right = "24px";
    subjectBadge.style.display = "inline-flex"; // 내용을 감싸도록 변경
    subjectBadge.style.alignItems = "center";
    subjectBadge.style.justifyContent = "center";
    subjectBadge.style.fontWeight = "600";
    subjectBadge.style.padding = "5px 12px";
    subjectBadge.style.borderRadius = "20px";
    subjectBadge.style.fontSize = "0.8rem";
    subjectBadge.style.zIndex = "5"; // 다른 요소 위에 표시

    // 과목별 배지 색상 - 투명도 적용 (0.85)
    if (question.subject === "운동생리학" || question.subject === "운동상해") {
      // 1번 과목 - 진한 파란색
      subjectBadge.style.backgroundColor = "rgba(54, 129, 171, 0.85)"; // #3681AB
      subjectBadge.style.color = "white";
      subjectBadge.style.boxShadow = "0 2px 8px rgba(54, 129, 171, 0.3)";
      subjectBadge.style.border = "1px solid rgba(43, 111, 150, 0.5)";
    }
    else if (question.subject === "건강체력평가" || question.subject === "기능해부학") {
      // 2번 과목 - 하늘색
      subjectBadge.style.backgroundColor = "rgba(107, 174, 205, 0.85)"; // #6BAECD
      subjectBadge.style.color = "white";
      subjectBadge.style.boxShadow = "0 2px 8px rgba(107, 174, 205, 0.3)";
      subjectBadge.style.border = "1px solid rgba(86, 151, 182, 0.5)";
    }
    else if (question.subject === "운동처방론" || question.subject === "병태생리학") {
      // 3번 과목 - 보라색
      subjectBadge.style.backgroundColor = "rgba(123, 126, 171, 0.85)"; // #7B7EAB
      subjectBadge.style.color = "white";
      subjectBadge.style.boxShadow = "0 2px 8px rgba(123, 126, 171, 0.3)";
      subjectBadge.style.border = "1px solid rgba(106, 109, 151, 0.5)";
    }
    else if (question.subject === "운동부하검사" || question.subject === "스포츠심리학") {
      // 4번 과목 - 라벤더색
      subjectBadge.style.backgroundColor = "rgba(155, 146, 187, 0.85)"; // #9B92BB
      subjectBadge.style.color = "white";
      subjectBadge.style.boxShadow = "0 2px 8px rgba(155, 146, 187, 0.3)";
      subjectBadge.style.border = "1px solid rgba(135, 128, 167, 0.5)";
    }
    else {
      // 기본 색상
      subjectBadge.style.backgroundColor = "rgba(95, 178, 201, 0.85)";
      subjectBadge.style.color = "white";
      subjectBadge.style.boxShadow = "0 2px 8px rgba(95, 178, 201, 0.3)";
      subjectBadge.style.border = "none";
    }

    document.querySelector('.question-number').textContent = `문제 ${displayNumber}`;
    document.getElementById('subject-badge').textContent = question.subject;

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = '';

    // 이미지 경로 처리 - 상대 경로 지원 강화
    if (question.commonImage) {
      const commonImg = document.createElement('img');
      // 이미지 경로가 이미 절대 경로인지 확인
      commonImg.src = question.commonImage.startsWith('/') ? question.commonImage : "../" + question.commonImage;
      commonImg.alt = "공통 그림";
      commonImg.className = "common-image";
      // 이미지 최적화 속성 추가
      commonImg.loading = 'lazy';
      commonImg.decoding = 'async';
      // 이미지 로드 오류 처리
      commonImg.onerror = function () {
        log(`공통 이미지 로드 실패: ${commonImg.src}`, 'warn');
        commonImg.src = "../images/image-placeholder.png"; // 플레이스홀더 이미지
        commonImg.alt = "이미지 로드 실패";
      };
      questionContainer.appendChild(commonImg);
    }

    // 문제 이미지 추가
    if (question.questionImage) {
      const questionImg = document.createElement('img');
      questionImg.src = question.questionImage.startsWith('/') ? question.questionImage : "../" + question.questionImage;
      questionImg.alt = `문제 ${index + 1}`;
      questionImg.className = "question-image";
      // 이미지 최적화 속성 추가
      questionImg.loading = 'lazy';
      questionImg.decoding = 'async';
      // 첫 번째 문제는 즉시 로드 (중요 콘텐츠)
      if (index === 0 || index === currentQuestionIndex) {
        questionImg.loading = 'eager';
      }
      // 이미지 로드 오류 처리
      questionImg.onerror = function () {
        log(`문제 이미지 로드 실패: ${questionImg.src}`, 'warn');
        questionImg.src = "../images/image-placeholder.png"; // 플레이스홀더 이미지
        questionImg.alt = "이미지 로드 실패";

        // 텍스트 형식 문제 지원 (이미지가 없는 경우)
        if (question.questionText) {
          const textDiv = document.createElement('div');
          textDiv.className = "question-text";
          textDiv.innerHTML = question.questionText;
          questionContainer.appendChild(textDiv);
        }
      };
      questionContainer.appendChild(questionImg);
    } else if (question.questionText) {
      // 텍스트 형식 문제 지원
      const textDiv = document.createElement('div');
      textDiv.className = "question-text";
      textDiv.innerHTML = question.questionText;
      questionContainer.appendChild(textDiv);
    }

    updateSelectedOption();
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'none';
    feedback.innerHTML = '';
    updateNavButtons();

    // 추가
    updateQuestionIndicators();
    log("loadQuestion에서 인디케이터 업데이트", 'debug');

    // ✅ 모바일 환경에서 복원된 답변이 제대로 표시되도록 추가 확인
    if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
      return;
    }
    const currentQuestion = questions[currentQuestionIndex];
    const globalIndex = currentQuestion.globalIndex;
    if (userAnswers[globalIndex] !== null && userAnswers[globalIndex] !== undefined) {
      setTimeout(() => {
        updateSelectedOption();
        log(`문제 ${globalIndex + 1}번 복원된 답변 확인: ${userAnswers[globalIndex]}`, 'debug');
      }, 100);
    }

    // ✅ 다음 문제들의 이미지 미리 로드 (성능 최적화) - 순차적으로 다운로드
    // 현재 문제 로드 후 약 500ms(사용자가 문제를 읽기 시작할 쯤) 뒤에 프리로드 시작
    setTimeout(() => {
      preloadImages(index, 3); // 다음 3개 문제의 이미지 미리 로드
    }, 500);
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
        const imagePath = question.questionImage.startsWith('/') ? question.questionImage : "../" + question.questionImage;
        imageQueue.push({
          src: imagePath,
          type: 'question',
          questionIndex: question.globalIndex !== undefined ? question.globalIndex + 1 : i + 1
        });
      }

      // 공통 이미지 추가
      if (question.commonImage) {
        const commonPath = question.commonImage.startsWith('/') ? question.commonImage : `../${question.commonImage}`;
        imageQueue.push({
          src: commonPath,
          type: 'common',
          questionIndex: question.globalIndex !== undefined ? question.globalIndex + 1 : i + 1
        });
      }
    }

    // 순차적으로 이미지 로드
    let queueIndex = 0;
    
    function loadNextImage() {
      if (queueIndex >= imageQueue.length) {
        log(`[Preload] 총 ${imageQueue.length}개 이미지 순차 로드 완료`, 'debug');
        return;
      }

      const imageInfo = imageQueue[queueIndex];
      const img = new Image();

      img.onload = function() {
        log(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 로드 완료: ${imageInfo.src}`, 'debug');
        queueIndex++;
        // 다음 이미지 로드 (약간의 지연을 두어 네트워크 부하 분산)
        setTimeout(loadNextImage, 50);
      };

      img.onerror = function() {
        log(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 로드 실패: ${imageInfo.src}`, 'warn');
        queueIndex++;
        // 실패해도 다음 이미지 계속 로드
        setTimeout(loadNextImage, 50);
      };

      img.src = imageInfo.src;
      log(`[Preload] 문제 ${imageInfo.questionIndex} ${imageInfo.type} 이미지 미리 로드 시작: ${imageInfo.src}`, 'debug');
    }

    // 첫 번째 이미지 로드 시작
    if (imageQueue.length > 0) {
      loadNextImage();
    }
  }

  function updateSelectedOption() {
    const optionButtons = document.querySelectorAll('.option-button');
    if (!optionButtons || optionButtons.length === 0) {
      log('updateSelectedOption: 선택지 버튼을 찾을 수 없습니다.', 'warn');
      return;
    }

    optionButtons.forEach(button => button.classList.remove('selected'));

    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const globalIndex = currentQuestion.globalIndex;
    const selectedAnswer = userAnswers[globalIndex];
    log(`updateSelectedOption: 문제 ${globalIndex + 1}번, 복원된 답변: ${selectedAnswer}`, 'debug');

    if (selectedAnswer !== null && selectedAnswer !== undefined && selectedAnswer >= 0 && selectedAnswer < optionButtons.length) {
      optionButtons[selectedAnswer].classList.add('selected');
      log(`updateSelectedOption: ${selectedAnswer + 1}번 선택지에 'selected' 클래스 추가`, 'debug');
    }
  }

  function selectOption(optionIndex) {
    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const globalIndex = currentQuestion.globalIndex;
    userAnswers[globalIndex] = optionIndex;
    updateSelectedOption();

    // 화면 업데이트 - 모든 인디케이터 다시 그리기
    updateQuestionIndicators();

    // ✅ localStorage에 빠른 저장 (5분 이내 복구용)
    try {
      const localStorageKey = `mockexam_${year}_${hour}_answers`;
      const saveData = {
        answers: userAnswers,
        perQuestionChecked: window.perQuestionChecked || new Array(questions.length).fill(false),
        lastQuestionIndex: currentQuestionIndex,
        timestamp: Date.now()
      };
      localStorage.setItem(localStorageKey, JSON.stringify(saveData));
    } catch (error) {
      console.warn('localStorage 저장 오류:', error);
    }

    // ✅ Firebase에 답변 선택 기록 저장 (이어서 풀기 기능을 위해)
    // 정답 확인 전이므로 isCorrect는 false로 저장 (나중에 checkAnswer에서 업데이트)
    if (typeof window.recordAttempt === 'function') {
      const questionData = {
        year: year,
        hour: hour,
        type: 'mockexam',
        number: globalIndex + 1, // 1-based
        globalIndex: globalIndex,
        subject: currentQuestion.subject || '모의고사',
        questionText: currentQuestion.question || '',
        options: currentQuestion.options || []
      };

      // 비동기로 저장 (블로킹하지 않음)
      window.recordAttempt(questionData, optionIndex, false)
        .then(result => {
          if (result && result.success) {
            log(`답변 선택 저장 완료: 문제 ${globalIndex + 1}`, 'debug');
          }
        })
        .catch(error => {
          console.warn('답변 선택 저장 오류:', error);
        });
    }

    checkAllAnswered();
    updateProgressDisplay();
  }

  function checkAnswer() {
    const selectedAnswer = userAnswers[questions[currentQuestionIndex].globalIndex];
    if (selectedAnswer === null) {
      alert('답을 선택해주세요.');
      return;
    }
    const currentQuestion = questions[currentQuestionIndex];

    // 정답 확인 로직 개선
    let isCorrect;
    let correctAnswerText;

    if (Array.isArray(currentQuestion.correctAnswer)) {
      // 배열인 경우 (다중 정답)
      if (currentQuestion.correctAnswer.length === 4) {
        // 모든 선택지가 정답인 경우
        isCorrect = true;
        correctAnswerText = "모든 보기가 정답";
      } else {
        // 일부 선택지만 정답인 경우
        isCorrect = currentQuestion.correctAnswer.includes(selectedAnswer);
        correctAnswerText = currentQuestion.correctAnswer.map(idx => (idx + 1) + '번').join(' 또는 ');
      }
    } else {
      // 단일 정답인 경우
      isCorrect = (selectedAnswer === currentQuestion.correctAnswer);
      correctAnswerText = (currentQuestion.correctAnswer + 1) + '번';
    }

    // 피드백
    const feedback = document.getElementById('feedback');
    feedback.className = `answer-feedback ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`;
    feedback.innerHTML = `
      <div class="feedback-title">
        <span class="feedback-icon">${isCorrect ? '✓' : '✗'}</span>
        <span>${isCorrect ? '정답입니다!' : '오답입니다!'}</span>
      </div>
      ${!isCorrect ? `<div class="correct-answer">정답: ${correctAnswerText}</div>` : ''}
      <div class="explanation">${currentQuestion.explanation || '해설 정보가 없습니다.'}</div>
    `;
    feedback.style.display = 'block';

    // ✅ 정답체크 상태 업데이트 (perQuestionChecked)
    if (!window.perQuestionChecked) {
      window.perQuestionChecked = new Array(questions.length).fill(false);
    }
    window.perQuestionChecked[currentQuestion.globalIndex] = true;

    // ✅ localStorage에 빠른 저장 (정답체크 상태 포함)
    try {
      const localStorageKey = `mockexam_${year}_${hour}_answers`;
      const saveData = {
        answers: userAnswers,
        perQuestionChecked: window.perQuestionChecked,
        lastQuestionIndex: currentQuestionIndex,
        timestamp: Date.now()
      };
      localStorage.setItem(localStorageKey, JSON.stringify(saveData));
    } catch (error) {
      console.warn('localStorage 저장 오류:', error);
    }

    // ✅ Firebase에 정답 여부 업데이트 (이어서 풀기 기능을 위해)
    if (typeof window.recordAttempt === 'function') {
      const questionData = {
        year: year,
        hour: hour,
        type: 'mockexam',
        number: currentQuestion.globalIndex + 1, // 1-based
        globalIndex: currentQuestion.globalIndex,
        subject: currentQuestion.subject || '모의고사',
        questionText: currentQuestion.question || '',
        options: currentQuestion.options || []
      };

      // 정답 확인 후 정답 여부 업데이트
      window.recordAttempt(questionData, selectedAnswer, isCorrect)
        .then(result => {
          if (result && result.success) {
            log(`정답 확인 저장 완료: 문제 ${currentQuestion.globalIndex + 1} (${isCorrect ? '정답' : '오답'})`, 'debug');
          }
        })
        .catch(error => {
          console.warn('정답 확인 저장 오류:', error);
        });
    }

    // 인디케이터 채점 표시
    const indicators = document.querySelectorAll('.indicator');
    if (indicators && indicators[currentQuestionIndex]) {
      indicators[currentQuestionIndex].classList.remove('correct', 'incorrect', 'checked-correct', 'checked-incorrect');
      // 정답체크 상태 표시 (배지만 보이는 상태)
      indicators[currentQuestionIndex].classList.add(isCorrect ? 'checked-correct' : 'checked-incorrect');

      // 인디케이터 완전히 업데이트
      updateQuestionIndicators();
    }

    // 첫 시도 여부 업데이트 (저장은 최종 제출 시에만)
    if (firstAttemptTracking[currentQuestion.globalIndex]) {
      // 첫 시도 플래그 업데이트
      firstAttemptTracking[currentQuestion.globalIndex] = false;
      log('첫 시도 상태 업데이트: 이 문제는 이제 첫 시도가 아닙니다', 'log');
    } else {
      log('이미 풀어본 문제입니다. 첫 시도만 저장됩니다.', 'log');
    }
  }

  // 인디케이터 초기화 함수 - 완전히 새로 작성
  function initQuestionIndicators() {
    const container = document.getElementById('question-indicators');
    if (!container) return;

    // 기존 스타일과 컨텐츠 초기화
    clearAllStyles();
    container.innerHTML = '';

    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0) {
      return;
    }

    // 화면 너비에 따라 그리드 레이아웃 조정
    const windowWidth = window.innerWidth;
    let numColumns = 20; // 기본값: 데스크톱

    if (windowWidth <= 480) {
      numColumns = 5;
    } else if (windowWidth <= 768) {
      numColumns = 10;
    }

    // 인디케이터 그리드 컨테이너 생성
    const gridContainer = document.createElement('div');
    gridContainer.className = 'question-indicators';
    // CSS에서 스타일 관리하므로 인라인 스타일 제거

    // 스크롤 제거
    container.style.overflowX = 'visible';
    container.style.overflowY = 'visible';

    // 과목별 색상 매핑 객체 - 전역 변수로 설정
    window.subjectColors = {
      "운동생리학": { bg: "#3681AB", border: "#3681AB" },
      "운동상해": { bg: "#3681AB", border: "#3681AB" },
      "건강체력평가": { bg: "#6BAECD", border: "#6BAECD" },
      "기능해부학": { bg: "#6BAECD", border: "#6BAECD" },
      "운동처방론": { bg: "#7B7EAB", border: "#7B7EAB" },
      "병태생리학": { bg: "#7B7EAB", border: "#7B7EAB" },
      "운동부하검사": { bg: "#9B92BB", border: "#9B92BB" },
      "스포츠심리학": { bg: "#9B92BB", border: "#9B92BB" }
    };

    // 모든 인디케이터를 순서대로 추가
    for (let i = 0; i < questions.length; i++) {
      const indicator = document.createElement('div');
      indicator.className = 'indicator';
      const subject = questions[i].subject;
      const globalIndex = questions[i].globalIndex;
      const isAnswered = userAnswers[globalIndex] !== null;
      const isCurrent = i === currentQuestionIndex;

      // data 속성 추가
      indicator.setAttribute('data-subject', subject);
      indicator.setAttribute('data-index', i);
      indicator.setAttribute('data-answered', isAnswered);
      indicator.setAttribute('data-current', isCurrent);
      indicator.setAttribute('role', 'button');
      indicator.setAttribute('aria-label', `문제 ${i + 1}로 이동`);

      // CSS에서 모든 스타일 관리 (inline 스타일 제거)

      // 과목별 번호 표시
      let displayNumber;
      if (currentSubject === "all") {
        const subjectIndex = subjectNames.indexOf(subject);
        if (subjectIndex !== -1) {
          const subjectQuestions = questions.filter(q => q.subject === subject);
          const subjectQuestionIndex = subjectQuestions.findIndex(q => q.globalIndex === questions[i].globalIndex);
          displayNumber = subjectQuestionIndex >= 0 ? subjectQuestionIndex + 1 : i + 1;
        } else {
          displayNumber = i + 1;
        }
      } else {
        displayNumber = i + 1;
      }

      indicator.textContent = displayNumber;

      // CSS 클래스만 추가 (모든 스타일은 CSS에서 처리)
      if (isAnswered) indicator.classList.add('answered');
      if (isCurrent) indicator.classList.add('current');

      // 클릭 이벤트
      indicator.addEventListener('click', function () {
        currentQuestionIndex = i;

        if (reviewMode && window.incorrectIndices) {
          const clickedGlobalIndex = questions[i].globalIndex;
          const newIndex = window.incorrectGlobalIndices?.indexOf(clickedGlobalIndex);

          if (newIndex !== -1) {
            window.currentIncorrectIndex = newIndex;

            const prevButton = document.getElementById('prev-button');
            const nextButton = document.getElementById('next-button');

            prevButton.disabled = window.currentIncorrectIndex === 0;
            nextButton.disabled = window.currentIncorrectIndex >= window.incorrectIndices.length - 1;

            updateIncorrectCounter();
          }
        }

        loadQuestion(currentQuestionIndex);
        updateQuestionIndicators();

        if (reviewMode) {
          showCurrentAnswer(questions[i]);
        }

        checkAllAnswered();
      });

      gridContainer.appendChild(indicator);
    }

    container.appendChild(gridContainer);

    if (reviewMode) {
      addReviewModeStyles();
    }
  }

  // 문제 인디케이터 상태 업데이트 함수 (CSS 기반)
  function updateQuestionIndicators() {
    const indicators = document.querySelectorAll('.indicator');
    if (!indicators || indicators.length === 0) {
      initQuestionIndicators();
      return;
    }

    indicators.forEach((indicator, i) => {
      const index = parseInt(indicator.getAttribute('data-index'));
      if (isNaN(index)) return;

      const globalIndex = questions[index]?.globalIndex;
      if (globalIndex === undefined) return;

      const isAnswered = userAnswers[globalIndex] !== null;
      const isCurrent = index === currentQuestionIndex;

      // 기존 체크마크 제거 (CSS :after로 처리)
      const existingCheckmark = indicator.querySelector('.simple-checkmark');
      if (existingCheckmark) existingCheckmark.remove();

      // 인라인 스타일 완전 제거 (CSS로 처리)
      indicator.style.backgroundColor = '';
      indicator.style.color = '';
      indicator.style.borderColor = '';
      indicator.style.boxShadow = '';
      indicator.style.transform = '';
      indicator.style.opacity = '';
      indicator.style.filter = '';

      // 클래스만 업데이트 (CSS가 스타일 처리)
      indicator.classList.remove('answered', 'current', 'correct', 'incorrect', 'checked-correct', 'checked-incorrect');
      if (isAnswered) indicator.classList.add('answered');
      if (isCurrent) indicator.classList.add('current');

      // ✅ 정답체크 상태 표시 (perQuestionChecked 사용)
      if (isAnswered && !reviewMode && window.perQuestionChecked && window.perQuestionChecked[globalIndex]) {
        const question = questions.find(q => q.globalIndex === globalIndex);
        if (question) {
          const correctAnswer = question.correctAnswer !== undefined ?
            question.correctAnswer :
            question.correct;

          let isCorrect = false;
          if (Array.isArray(correctAnswer)) {
            if (correctAnswer.length === 4) {
              isCorrect = userAnswers[globalIndex] !== null;
            } else {
              isCorrect = correctAnswer.includes(userAnswers[globalIndex]);
            }
          } else {
            isCorrect = userAnswers[globalIndex] === correctAnswer;
          }

          // 배지만 보이는 상태 클래스
          indicator.classList.add(isCorrect ? 'checked-correct' : 'checked-incorrect');
        }
      }
    });

    // 리뷰 모드이거나 결과 화면 이후에는 정답/오답 스타일 유지
    if (reviewMode || document.getElementById('results-summary').style.display === 'block') {
      updateResultIndicators();
    }
  }

  // 모든 스타일 초기화
  function clearAllStyles() {
    const stylesToRemove = document.querySelectorAll('style[id^="indicator-"], style[id^="checkmark-"]');
    stylesToRemove.forEach(style => style.remove());
  }

  // 기존 함수와의 호환성 유지
  function addPersistentCheckmarkStyle() {
    // 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
    // 비워두고 clearAllStyles() 호출
    clearAllStyles();
  }

  function addIndicatorStyles() {
    // 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
    clearAllStyles();
  }

  // 인디케이터 상태 업데이트 함수 (특정 인디케이터만 업데이트)
  function updateIndicatorState(index, isAnswered) {
    // 인디케이터를 전부 다시 그리는 방식으로 변경
    updateQuestionIndicators();
  }

  /* ===== 진행/네비게이션 관련 함수 ===== */

  function checkAllAnswered() {
    // 현재 표시 중인 과목의 모든 문제가 답변되었는지 확인
    const allAnswered = questions.every(q => userAnswers[q.globalIndex] !== null);

    const submitButton = document.getElementById('submit-button');
    const nextButton = document.getElementById('next-button');

    if (reviewMode) {
      // 리뷰 모드에서는 다음 버튼만 표시
      nextButton.style.display = 'inline-block';
      submitButton.style.display = 'none';
    } else {
      // 모든 문제에 답변했으면 결과 확인 버튼 표시, 아니면 다음 버튼 표시
      if (allAnswered) {
        submitButton.style.display = 'inline-block';
        nextButton.style.display = 'none';
      } else {
        nextButton.style.display = 'inline-block';
        submitButton.style.display = 'none';
      }
    }
  }

  function updateNavButtons() {
    const prevButton = document.getElementById('prev-button');
    prevButton.disabled = (currentQuestionIndex === 0);
    prevButton.classList.toggle('disabled', currentQuestionIndex === 0);
    checkAllAnswered();
  }

  // 수정된 오답 리뷰 모드의 이전/다음 이동 함수
  function goToPreviousQuestion() {
    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0) {
      return;
    }

    if (reviewMode) {
      // 리뷰 모드인 경우, 이전 오답 문제로 이동
      let prevIncorrectIndex = -1;
      for (let i = currentQuestionIndex - 1; i >= 0; i--) {
        if (questions[i] && userAnswers[questions[i].globalIndex] !== null &&
          userAnswers[questions[i].globalIndex] !== questions[i].correctAnswer) {
          prevIncorrectIndex = i;
          break;
        }
      }
      if (prevIncorrectIndex !== -1) {
        currentQuestionIndex = prevIncorrectIndex;
        loadQuestion(currentQuestionIndex);
        updateQuestionIndicators();
        console.log("인디케이터 업데이트 함수 호출됨 - 이전 문제 (리뷰 모드)");
      } else {
        alert("더 이전의 오답 문제는 없습니다.");
      }
    } else {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion(currentQuestionIndex);
        updateQuestionIndicators();
        console.log("인디케이터 업데이트 함수 호출됨 - 이전 문제");
        checkAllAnswered();
      }
    }
  }
  function goToNextQuestion() {
    // 문제가 없는 경우 처리
    if (!questions || questions.length === 0) {
      return;
    }

    if (reviewMode) {
      // 리뷰 모드인 경우, 다음 오답 문제로 이동
      let nextIncorrectIndex = -1;
      for (let i = currentQuestionIndex + 1; i < questions.length; i++) {
        if (questions[i] && userAnswers[questions[i].globalIndex] !== null &&
          userAnswers[questions[i].globalIndex] !== questions[i].correctAnswer) {
          nextIncorrectIndex = i;
          break;
        }
      }
      if (nextIncorrectIndex !== -1) {
        currentQuestionIndex = nextIncorrectIndex;
        loadQuestion(currentQuestionIndex);
        updateQuestionIndicators();
        log("인디케이터 업데이트 함수 호출됨 - 다음 문제 (리뷰 모드)", 'debug');
      } else {
        alert("모든 오답을 검토하였습니다.");
      }
    } else {
      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
        updateQuestionIndicators();
        log("인디케이터 업데이트 함수 호출됨 - 다음 문제", 'debug');
        checkAllAnswered();
      } else if (currentSubject !== "all") {
        // 과목 모드에서 마지막 문제에 도달했을 때, 다음 과목으로 자연스럽게 넘어감
        const currentSubjectIndex = subjectNames.indexOf(currentSubject);
        if (currentSubjectIndex < subjectNames.length - 1) {
          const nextSubject = subjectNames[currentSubjectIndex + 1];
          changeSubject(nextSubject);
        } else {
          // 마지막 과목이면 전체 문제 모드로 돌아감
          changeSubject("all");
        }
      } else {
        // "전체 문제" 모드에서 마지막 문제일 경우
        // 결과 확인 버튼 표시
        document.getElementById('next-button').style.display = 'none';
        document.getElementById('submit-button').style.display = 'block';
      }
    }
  }

  /* ===== 진행바/문제 인디케이터 관련 함수 ===== */

  // 창 크기 변경 시 인디케이터 다시 초기화
  window.addEventListener('resize', function () {
    if (document.getElementById('question-indicators')) {
      initQuestionIndicators();
    }
  });

  /* ===== 진행 상황 업데이트 ===== */
  function updateProgressDisplay() {
    // 문제가 없는 경우 처리
    if (!allQuestions || allQuestions.length === 0) {
      return;
    }

    const answeredCount = userAnswers.filter(answer => answer !== null).length;
    const progressCount = document.getElementById('progress-count');
    const progressBar = document.getElementById('progress-bar');

    if (progressCount) {
      progressCount.textContent = `${answeredCount} / ${allQuestions.length}`;
    }

    if (progressBar) {
      progressBar.style.width = `${(answeredCount / allQuestions.length) * 100}%`;
    }
  }

  /* ===== 타이머 관련 함수 ===== */
  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      timeRemaining--;
      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        submitQuiz();
      }
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const timer = document.getElementById('timer');
    if (!timer) return;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /* ===== 최종 결과 및 제출 함수 ===== */
  function submitQuiz() {
    clearInterval(timerInterval);

    // 미응답 문제 확인
    const unansweredCount = questions.filter(q => userAnswers[q.globalIndex] === null).length;
    if (unansweredCount > 0) {
      const confirmed = confirm(`아직 ${unansweredCount}문제를 풀지 않았습니다. 정말 제출하시겠습니까?`);
      if (!confirmed) {
        startTimer();
        return;
      }
    }

    // 개별 탭에서 전체 탭으로 전환
    if (currentSubject !== 'all') {
      currentSubject = 'all';
      questions = allQuestions;

      // 탭 UI 업데이트
      document.querySelectorAll('.subject-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.subject === 'all') {
          tab.classList.add('active');
        }
      });

      initQuestionIndicators();
    }

    // 결과 표시
    showResults();

    // 모의고사 결과를 한 번에 저장
    saveMockExamResults();
  }

  /**
   * 모의고사 결과를 한 번에 Firebase에 저장하는 함수
   */
  async function saveMockExamResults() {
    // 로그인 확인
    const userLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    if (!userLoggedIn) {
      log("로그인이 필요합니다. 모의고사 결과가 저장되지 않습니다.", 'warn');
      return false;
    }

    // 사용자 ID 확인 (Firebase auth 객체 직접 사용)
    let userId = null;
    let userName = localStorage.getItem('userName') || '익명';

    // 방법 1: localStorage에서 사용자 ID 가져오기 시도
    userId = localStorage.getItem('userId');

    // 방법 2: Firebase auth 객체에서 직접 가져오기 시도
    if (!userId && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
          userId = currentUser.uid;
          log("Firebase에서 사용자 ID를 가져왔습니다:", userId);
          // userId를 localStorage에 저장하여 다음 요청에서 사용
          localStorage.setItem('userId', userId);
        }
      } catch (error) {
        log("Firebase에서 사용자 ID 가져오기 실패:", error, 'error');
      }
    }

    // 마지막 검사
    if (!userId) {
      log("사용자 ID를 찾을 수 없습니다. 모의고사 결과가 저장되지 않습니다.", 'warn');
      return false;
    }

    // 세션 ID 가져오기
    let sessionId = null;
    try {
      if (window.sessionManager) {
        sessionId = window.sessionManager.getCurrentSessionId();
      } else if (sessionManager) {
        sessionId = sessionManager.getCurrentSessionId();
      }

      if (!sessionId) {
        // 세션 ID가 없으면 새로 생성 시도
        if (window.sessionManager) {
          const newSession = await window.sessionManager.startNewSession();
          sessionId = newSession.id;
        } else if (sessionManager) {
          const newSession = await sessionManager.startNewSession();
          sessionId = newSession.id;
        }
      }
    } catch (error) {
      console.log('세션 ID 가져오기 오류:', error);
      // 오류 발생 시 임시 세션 ID 생성
      sessionId = 'temp-session-' + Date.now();
    }

    // 현재 파일 이름에서 모의고사 정보 추출
    const currentPath = window.location.pathname;
    const filename = currentPath.split('/').pop();

    // 모의고사 정보 추출
    let year = '2025';
    let hour = '1';

    const fileMatch = filename.match(/(\d{4}).*?(\d)교시/);
    if (fileMatch) {
      year = fileMatch[1];
      hour = fileMatch[2];
    } else {
      const titleElement = document.querySelector('.quiz-title h1');
      if (titleElement) {
        const titleMatch = titleElement.textContent.match(/(\d{4}).*?(\d)교시/);
        if (titleMatch) {
          year = titleMatch[1];
          hour = titleMatch[2];
        }
      }
    }

    // HTML URL에서 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('year')) {
      year = urlParams.get('year');
    }
    if (urlParams.has('hour')) {
      hour = urlParams.get('hour');
    }

    console.log(`모의고사 정보: ${year}년도 ${hour}교시`);

    // 교시에 따른 과목 설정
    let subjectNames = [];
    if (hour === '1') {
      subjectNames = ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"];
    } else {
      subjectNames = ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];
    }

    // 과목별 결과 처리를 위한 객체
    const subjectResults = {};
    subjectNames.forEach(subject => {
      subjectResults[subject] = {
        total: 20, // 각 과목별 20문제
        correct: 0,
        score: 0
      };
    });

    // 각 문제별로 저장할 데이터 준비
    const attemptsToSave = [];

    // 한 과목당 문제 수 (일반적으로 모의고사는 과목당 20문제)
    const questionsPerSubject = 20;

    // 모든 문제 루프
    for (let globalIndex = 0; globalIndex < questions.length; globalIndex++) {
      // 현재 과목과 과목 내 문제 번호 계산
      const subjectIndex = Math.floor(globalIndex / questionsPerSubject);

      // 과목 범위 벗어난 경우 스킵
      if (subjectIndex >= subjectNames.length) {
        console.warn(`문제 ${globalIndex}의 과목 인덱스(${subjectIndex})가 범위를 벗어났습니다.`);
        continue;
      }

      const subject = subjectNames[subjectIndex];
      const questionNumberInSubject = (globalIndex % questionsPerSubject) + 1; // 1부터 20까지

      // 사용자 답변 확인
      if (globalIndex >= userAnswers.length) {
        console.warn(`문제 ${globalIndex}에 대한 사용자 답변이 없습니다. (인덱스 범위 초과)`);
        continue;
      }

      const userAnswer = userAnswers[globalIndex];
      if (userAnswer === null || userAnswer === undefined) {
        console.log(`문제 ${globalIndex}에 대한 사용자 답변이 없습니다. (null/undefined)`);
        continue;
      }

      // 문제 정보 가져오기
      const question = questions[globalIndex];
      if (!question) {
        console.warn(`문제 ${globalIndex}을 찾을 수 없습니다.`);
        continue;
      }

      // 정답 확인
      const correctAnswer = question.correctAnswer !== undefined ?
        question.correctAnswer :
        question.correct; // 두 가지 필드명 모두 지원

      if (correctAnswer === undefined) {
        console.warn(`문제 ${globalIndex}의 정답 정보가 없습니다.`);
        continue;
      }

      // 정답 확인 로직 개선
      let isCorrect = false;

      if (Array.isArray(correctAnswer)) {
        // 배열인 경우 (다중 정답)
        if (correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우
          isCorrect = userAnswer !== null; // 답을 선택했다면 정답
        } else {
          // 일부 선택지만 정답인 경우
          isCorrect = correctAnswer.includes(userAnswer);
        }
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswer === correctAnswer;
      }

      // 과목별 정답 개수 업데이트
      if (isCorrect) {
        subjectResults[subject].correct++;
      }

      // ✅ 정답체크 상태 확인 (perQuestionChecked)
      const viewedExplanation = window.perQuestionChecked && window.perQuestionChecked[globalIndex] ? true : false;

      // 문제 데이터 구성
      const questionData = {
        year: year,
        subject: subject,
        number: questionNumberInSubject, // 핵심: 명시적 값 할당
        isFromMockExam: true,
        mockExamHour: hour,
        examHour: hour,
        sessionId: sessionId,
        correctAnswer: correctAnswer,
        globalIndex: globalIndex,
        timestamp: new Date(),
        viewedExplanation: viewedExplanation  // ✅ 정답체크 상태 저장
      };

      // 저장 데이터 추가
      attemptsToSave.push({
        questionData,
        userAnswer,
        isCorrect
      });
    }

    // 과목별 점수 계산
    subjectNames.forEach(subject => {
      const result = subjectResults[subject];
      if (result.total > 0) {
        result.score = Math.round((result.correct / result.total) * 100);
      }
    });

    // 전체 점수 계산
    const totalCorrect = attemptsToSave.filter(a => a.isCorrect).length;
    const totalQuestions = attemptsToSave.length;
    const score = totalQuestions > 0 ?
      Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // 배치 저장 시도
    if (typeof window.batchRecordAttempts === 'function' && attemptsToSave.length > 0) {
      try {
        console.log(`${attemptsToSave.length}개 문제 결과를 배치 저장합니다.`);
        const result = await window.batchRecordAttempts(attemptsToSave);
        console.log('배치 저장 완료:', result);
      } catch (error) {
        console.error("배치 저장 오류:", error);

        // 개별 저장 시도
        console.log("개별 저장 방식으로 다시 시도합니다...");
        let savedCount = 0;

        for (let i = 0; i < attemptsToSave.length; i++) {
          try {
            const attempt = attemptsToSave[i];

            if (typeof window.recordAttempt === 'function') {
              await window.recordAttempt(
                attempt.questionData,
                attempt.userAnswer,
                attempt.isCorrect
              );
              savedCount++;
            }
          } catch (individualError) {
            console.error(`문제 ${i} 개별 저장 오류:`, individualError);
          }
        }

        console.log(`개별 저장 결과: ${savedCount}/${attemptsToSave.length}개 성공`);
      }
    } else {
      console.warn('배치 저장 함수를 찾을 수 없거나 저장할 데이터가 없습니다.');
    }

    // ✅ 모의고사 결과를 mockExamResults 컬렉션에 저장
    try {
      if (typeof window.recordMockExamResults === 'function') {
        // 완료 시간 계산 (사용한 시간 = 전체 시간 - 남은 시간)
        const elapsedSeconds = totalTime - timeRemaining;
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;
        const completionTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const mockExamResultData = {
          year: year,
          hour: hour,
          mockExamHour: hour,
          totalQuestions: totalQuestions,
          correctCount: totalCorrect,
          score: score,
          subjectResults: subjectResults,
          completionTime: completionTime,
          examTitle: `${year}년 ${hour}교시 모의고사`,
          certificateType: getActiveCertificateType()
        };

        console.log('모의고사 결과를 mockExamResults에 저장합니다:', mockExamResultData);
        const saveResult = await window.recordMockExamResults(mockExamResultData);
        
        if (saveResult && saveResult.success) {
          console.log('모의고사 결과 저장 성공:', saveResult);
        } else {
          console.warn('모의고사 결과 저장 실패:', saveResult);
        }
      } else {
        console.warn('recordMockExamResults 함수를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('모의고사 결과 저장 오류:', error);
    }

    // 세션 종료 및 메타데이터 업데이트
    try {
      if (window.sessionManager && sessionId) {
        // 세션 통계 정보 업데이트
        const sessionStats = {
          totalQuestions: questions.length,
          attemptedQuestions: attemptsToSave.length,
          correctAnswers: totalCorrect,
          accuracy: score,
          // 추가 메타데이터
          title: `${year}년 ${hour}교시 모의고사`,
          year: year,
          hour: hour,
          type: 'mockexam',
          subjectResults: subjectResults,
          completedAt: new Date()
        };

        // 세션 종료
        await window.sessionManager.endSession(sessionStats);
        console.log('모의고사 세션이 종료되었습니다.');
      }
    } catch (error) {
      console.warn('세션 종료 오류 (무시됨):', error);
    }

    return true; // 저장 완료
  }

  // 새로운 함수 추가: 결과 화면에서 정답/오답 인디케이터 업데이트
  function updateResultIndicators() {
    // 결과 화면이 표시되고 있는지 확인
    const isResultsShown = document.getElementById('results-summary').style.display === 'block';
    const isInReviewMode = reviewMode === true;

    // 결과 화면이 표시되고 있거나 리뷰 모드일 때만 정답/오답 표시 적용
    if (!isResultsShown && !isInReviewMode) {
      return; // 결과 화면이 아니고 리뷰 모드도 아니면 아무것도 하지 않음
    }

    // 인디케이터 개별 업데이트 대신 완전히 다시 그리기
    initQuestionIndicators();

    // 모든 인디케이터에 정답/오답 스타일 적용
    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach((indicator) => {
      const index = parseInt(indicator.getAttribute('data-index'));
      if (isNaN(index) || !questions[index]) return;

      const question = questions[index];
      const userAnswer = userAnswers[question.globalIndex];

      // 사용자가 답변한 문제에 대해서만 정답/오답 표시
      if (userAnswer !== null) {
        // 정답 확인 로직 개선
        let isCorrect = false;

        if (Array.isArray(question.correctAnswer)) {
          // 배열인 경우 (다중 정답)
          if (question.correctAnswer.length === 4) {
            // 모든 선택지가 정답인 경우
            isCorrect = true; // 답을 선택했다면 정답
          } else {
            // 일부 선택지만 정답인 경우
            isCorrect = question.correctAnswer.includes(userAnswer);
          }
        } else {
          // 단일 정답인 경우
          isCorrect = userAnswer === question.correctAnswer;
        }

        // 기존 JavaScript로 추가된 체크마크 제거 (CSS :after와 충돌 방지)
        const existingCheckmark = indicator.querySelector('.simple-checkmark');
        if (existingCheckmark) {
          existingCheckmark.remove();
        }

        // 인라인 스타일 제거 (CSS로 처리)
        indicator.style.backgroundColor = '';
        indicator.style.color = '';
        indicator.style.borderColor = '';
        indicator.style.boxShadow = '';
        indicator.style.transform = '';
        indicator.style.opacity = '';
        indicator.style.filter = '';

        // 정답/오답 클래스만 추가 (CSS에서 스타일 처리)
        indicator.classList.remove('correct', 'incorrect', 'answered');
        indicator.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
    });
  }

  // 리뷰 모드 스타일 추가 함수 (더 이상 사용하지 않음 - CSS로 처리)
  function addReviewModeStyles() {
    // CSS로 처리하므로 빈 함수
  }

  // 점수 평가 메시지
  function getScoreComment(score) {
    if (score >= 90) return '훌륭합니다! 합격이 확실해 보여요!';
    if (score >= 80) return '잘했어요! 합격권에 있습니다.';
    if (score >= 70) return '좋은 점수입니다. 조금만 더 노력하세요!';
    if (score >= 60) return '합격 가능성이 있어요. 취약 과목을 보완하세요.';
    return '아쉽네요. 다시 한 번 준비해보세요.';
  }

  // 점수 계산
  function calculateScore() {
    let correctCount = 0;

    // 현재 표시 중인 과목의 문제들만 검사
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = userAnswers[q.globalIndex];

      // 정답 확인 로직 개선
      let isCorrect = false;

      if (Array.isArray(q.correctAnswer)) {
        // 배열인 경우 (다중 정답)
        if (q.correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우
          isCorrect = userAnswer !== null; // 답을 선택했다면 정답
        } else {
          // 일부 선택지만 정답인 경우
          isCorrect = q.correctAnswer.includes(userAnswer);
        }
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswer === q.correctAnswer;
      }

      if (isCorrect) {
        correctCount++;
      }
    }

    return {
      totalCorrect: correctCount,
      totalScore: Math.round((correctCount / questions.length) * 100),
      subjectScores: subjectNames.reduce((acc, subject) => {
        const subjectQs = subjectQuestions[subject] || [];
        const subjectCorrect = subjectQs.filter(q => {
          const userAnswer = userAnswers[q.globalIndex];

          // 정답 확인 로직 개선
          if (Array.isArray(q.correctAnswer)) {
            // 배열인 경우 (다중 정답)
            if (q.correctAnswer.length === 4) {
              // 모든 선택지가 정답인 경우
              return userAnswer !== null; // 답을 선택했다면 정답
            } else {
              // 일부 선택지만 정답인 경우
              return q.correctAnswer.includes(userAnswer);
            }
          } else {
            // 단일 정답인 경우
            return userAnswer === q.correctAnswer;
          }
        }).length;

        acc[subject] = {
          score: Math.round((subjectCorrect / subjectQs.length) * 100),
          correct: subjectCorrect,
          totalQuestions: subjectQs.length
        };
        return acc;
      }, {})
    };
  }

  // 오답 카운터 업데이트
  function updateIncorrectCounter(totalIncorrect) {
    const infoElement = document.querySelector('.review-mode-info');
    if (infoElement) {
      const total = totalIncorrect || (window.incorrectIndices ? window.incorrectIndices.length : 0);
      const current = window.currentIncorrectIndex + 1;

      // 현재 과목 표시 추가
      if (currentSubject !== 'all') {
        infoElement.textContent = `${currentSubject}: 틀린 ${total}문제 중 ${current}번째 (전체 오답: ${window.incorrectGlobalIndices ? window.incorrectGlobalIndices.length : total}개)`;
      } else {
        infoElement.textContent = `틀린 ${total}문제 중 ${current}번째`;
      }
    }
  }

  // 전체 오답 리뷰 시작 (모의고사용)
  function reviewQuiz() {
    reviewMode = true;

    // 전체 문제에서 오답만 필터링
    const allIncorrectIndices = [];
    const allIncorrectGlobalIndices = [];

    allQuestions.forEach((question, index) => {
      const globalIndex = question.globalIndex;
      const userAnswer = userAnswers[globalIndex];

      // 답변하지 않은 문제는 건너뛰기
      if (userAnswer === null || userAnswer === undefined) {
        return;
      }

      // 정답 확인 로직 (배열 정답 지원)
      const correctAnswer = question.correctAnswer !== undefined
        ? question.correctAnswer
        : question.correct;

      let isCorrect = false;
      if (Array.isArray(correctAnswer)) {
        if (correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우
          isCorrect = userAnswer !== null;
        } else {
          // 일부 선택지만 정답인 경우
          isCorrect = correctAnswer.includes(userAnswer);
        }
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswer === correctAnswer;
      }

      // 틀린 문제만 추가
      if (!isCorrect) {
        allIncorrectIndices.push(index);
        allIncorrectGlobalIndices.push(globalIndex);
      }
    });

    console.log('📊 전체 오답 확인:', {
      전체문제수: allQuestions.length,
      답변한문제수: userAnswers.filter(a => a !== null && a !== undefined).length,
      틀린문제수: allIncorrectIndices.length
    });

    if (allIncorrectIndices.length === 0) {
      alert('모든 문제를 맞추셨습니다! 🎉');
      return;
    }

    // 오답 인덱스 배열을 전역 변수에 저장
    window.incorrectIndices = allIncorrectIndices;
    window.incorrectGlobalIndices = allIncorrectGlobalIndices;
    window.currentIncorrectIndex = 0;

    // 네비게이션 버튼 함수 백업 및 설정
    if (!window.originalNextFunction) {
      window.originalNextFunction = goToNextQuestion;
      window.originalPrevFunction = goToPreviousQuestion;
    }

    // 네비게이션 버튼 이벤트 리스너 변경
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    prevButton.removeEventListener('click', goToPreviousQuestion);
    nextButton.removeEventListener('click', goToNextQuestion);

    prevButton.addEventListener('click', goToPreviousIncorrect);
    nextButton.addEventListener('click', goToNextIncorrect);

    // 네비게이션 버튼 초기 상태 설정
    prevButton.disabled = true;
    nextButton.disabled = allIncorrectIndices.length <= 1;

    // 리뷰 모드 UI 추가
    addReviewModeUI(allIncorrectIndices.length);

    // 전체 탭 모드로 변경하고 첫 번째 오답 문제로 이동
    currentSubject = 'all';
    currentQuestionIndex = allIncorrectIndices[0];
    questions = allQuestions;

    // 탭 UI 업데이트
    document.querySelectorAll('.subject-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.subject === 'all');
    });

    // 문제 화면 표시 및 결과 화면 숨기기
    document.getElementById('quiz-container').style.display = 'block';
    document.querySelector('.navigation-buttons').style.display = 'flex';
    document.getElementById('results-summary').style.display = 'none';

    // 인디케이터 초기화 및 문제 로드
    initQuestionIndicators();
    updateResultIndicators(); // 추가: 정답/오답 표시 적용
    loadQuestion(currentQuestionIndex);

    // 정답 표시
    showCurrentAnswer(questions[currentQuestionIndex]);
  }

  // 특정 과목의 오답 리뷰 시작
  function reviewSubjectIncorrect(subject) {
    reviewMode = true;

    // 전체 문제에서 해당 과목의 오답만 필터링
    const allIncorrectIndices = [];
    const allIncorrectGlobalIndices = [];

    // 해당 과목의 문제만 필터링
    const subjectQuestionIndices = [];
    allQuestions.forEach((q, index) => {
      if (q.subject === subject) {
        subjectQuestionIndices.push(index);
      }
    });

    // 필터링된 과목 문제에서 오답만 찾기
    subjectQuestionIndices.forEach(index => {
      const question = allQuestions[index];
      const globalIndex = question.globalIndex;
      const userAnswer = userAnswers[globalIndex];

      // 답변하지 않은 문제는 건너뛰기
      if (userAnswer === null) {
        return;
      }

      // 정답 확인 로직 (배열 정답 지원)
      const correctAnswer = question.correctAnswer !== undefined
        ? question.correctAnswer
        : question.correct;

      let isCorrect = false;
      if (Array.isArray(correctAnswer)) {
        if (correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우
          isCorrect = userAnswer !== null;
        } else {
          // 일부 선택지만 정답인 경우
          isCorrect = correctAnswer.includes(userAnswer);
        }
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswer === correctAnswer;
      }

      // 틀린 문제만 추가
      if (!isCorrect) {
        allIncorrectIndices.push(index);
        allIncorrectGlobalIndices.push(globalIndex);
      }
    });

    console.log(`📊 ${subject} 과목 오답 확인:`, {
      전체문제수: subjectQuestionIndices.length,
      틀린문제수: allIncorrectIndices.length
    });

    if (allIncorrectIndices.length === 0) {
      log(`${subject} 과목에 틀린 문제가 없습니다!`, 'error');
      return;
    }

    // 오답 인덱스 배열을 전역 변수에 저장
    window.incorrectIndices = allIncorrectIndices;
    window.incorrectGlobalIndices = allIncorrectGlobalIndices;
    window.currentIncorrectIndex = 0;

    // 네비게이션 버튼 함수 백업 및 설정
    if (!window.originalNextFunction) {
      window.originalNextFunction = goToNextQuestion;
      window.originalPrevFunction = goToPreviousQuestion;
    }

    // 네비게이션 버튼 이벤트 리스너 변경
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    prevButton.removeEventListener('click', goToPreviousQuestion);
    nextButton.removeEventListener('click', goToNextQuestion);

    prevButton.addEventListener('click', goToPreviousIncorrect);
    nextButton.addEventListener('click', goToNextIncorrect);

    // 네비게이션 버튼 초기 상태 설정
    prevButton.disabled = true;
    nextButton.disabled = allIncorrectIndices.length <= 1;

    // 리뷰 모드 UI 추가
    addReviewModeUI(allIncorrectIndices.length, subject);

    // 전체 탭 모드로 변경하고 첫 번째 오답 문제로 이동
    currentSubject = 'all';
    currentQuestionIndex = allIncorrectIndices[0];
    questions = allQuestions;

    // 탭 UI 업데이트
    document.querySelectorAll('.subject-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.subject === 'all');
    });

    // 문제 화면 표시 및 결과 화면 숨기기
    document.getElementById('quiz-container').style.display = 'block';
    document.querySelector('.navigation-buttons').style.display = 'flex';
    document.getElementById('results-summary').style.display = 'none';

    // 인디케이터 초기화 및 문제 로드
    initQuestionIndicators();
    updateResultIndicators(); // 추가: 정답/오답 표시 적용
    loadQuestion(currentQuestionIndex);

    // 정답 표시
    showCurrentAnswer(questions[currentQuestionIndex]);
  }

  // 필요한 함수들을 window 객체에 노출
  window.selectOption = selectOption;
  window.checkAnswer = checkAnswer;
  window.resetQuiz = resetQuiz;
  window.reviewQuiz = reviewQuiz;
  window.goToPreviousQuestion = goToPreviousQuestion;
  window.goToNextQuestion = goToNextQuestion;
  window.submitQuiz = submitQuiz;
  window.reviewSubjectIncorrect = reviewSubjectIncorrect;
  window.exitReviewMode = exitReviewMode;

  // 개발 모드에서만 추가 디버깅 함수 노출
  if (isDevMode) {
    window.questions = questions;
    window.allQuestions = allQuestions;
    window.subjectQuestions = subjectQuestions;
    window.currentQuestionIndex = currentQuestionIndex;
    window.userAnswers = userAnswers;
    window.firstAttemptTracking = firstAttemptTracking; // 추가
  }

  function setBackLink(year) {
    const backLink = document.querySelector('.back-link');
    if (!backLink) return;

    const params = new URLSearchParams(window.location.search);
    const fromPage = params.get('from');
    backLink.href = fromPage ? fromPage : `../years/year_${year}.html`;
  }

  // 과목별 카드 생성 함수 추가
  function createSubjectCards(subjectResults) {
    let cardsHTML = '';

    subjectNames.forEach((subject, index) => {
      const result = subjectResults[subject] || { correct: 0, totalQuestions: 20, score: 0 };

      // 점수 계산 (정답 개수 × 5점 = 100점 만점)
      const scorePoints = result.correct * 5;

      // 과락 기준 색상 (40점 미만: 빨강, 40-59점: 주황, 60점 이상: 초록)
      let scoreClass = '';
      if (scorePoints >= 60) {
        scoreClass = 'score-high';
      } else if (scorePoints >= 40) {
        scoreClass = 'score-medium';
      } else {
        scoreClass = 'score-low';
      }

      cardsHTML += `
        <div class="subject-card">
          <div class="subject-label">${index + 1}과목</div>
          <div class="subject-name-small">${subject}</div>
          <div class="subject-score ${scoreClass}">${scorePoints}점</div>
          <div class="subject-detail">${result.correct}/${result.totalQuestions}문제</div>
          ${result.incorrect && result.incorrect.length > 0 ?
          `<button onclick="reviewSubjectIncorrect('${subject}')" class="review-subject-button">
              오답 확인 (${result.incorrect.length}문제)
             </button>` :
          `<div class="perfect-subject">모두 정답!</div>`
        }
        </div>
      `;
    });

    return cardsHTML;
  }

  function showResults() {
    // 점수 계산
    const scoreData = calculateScore();
    const totalQuestions = questions.length;
    const correctAnswers = scoreData.totalCorrect;

    // 점수 계산 방식 - 퍼센트에서 실제 점수로
    const pointsPerQuestion = 5; // 각 문제당 5점
    const earnedPoints = correctAnswers * pointsPerQuestion; // 획득한 점수
    const maxPoints = totalQuestions * pointsPerQuestion; // 최대 가능 점수

    // 과목별 결과
    const subjectResults = {};

    subjectNames.forEach(subject => {
      const subjectQs = subjectQuestions[subject] || [];
      if (subjectQs.length > 0) {
        const correctQs = [];
        const incorrectQs = [];

        subjectQs.forEach(q => {
          const userAnswer = userAnswers[q.globalIndex];
          const correctAnswer = q.correctAnswer;

          // 정답 확인 로직 개선
          let isCorrect = false;

          if (Array.isArray(correctAnswer)) {
            // 배열인 경우 (다중 정답)
            if (correctAnswer.length === 4) {
              // 모든 선택지가 정답인 경우
              isCorrect = userAnswer !== null; // 답을 선택했다면 정답
            } else {
              // 일부 선택지만 정답인 경우
              isCorrect = correctAnswer.includes(userAnswer);
            }
          } else {
            // 단일 정답인 경우
            isCorrect = userAnswer === correctAnswer;
          }

          if (isCorrect) {
            correctQs.push(q);
          } else if (userAnswer !== null) {
            incorrectQs.push(q);
          }
        });

        subjectResults[subject] = {
          score: Math.round((correctQs.length / subjectQs.length) * 100),
          correct: correctQs.length,
          totalQuestions: subjectQs.length,
          incorrect: incorrectQs
        };
      }
    });

    // 오답 문제 수집
    const incorrectIndices = [];
    const incorrectGlobalIndices = [];

    questions.forEach((q, i) => {
      const userAnswer = userAnswers[q.globalIndex];
      const correctAnswer = q.correctAnswer;

      // 정답 확인 로직 개선
      let isCorrect = false;

      if (Array.isArray(correctAnswer)) {
        // 배열인 경우 (다중 정답)
        if (correctAnswer.length === 4) {
          // 모든 선택지가 정답인 경우
          isCorrect = userAnswer !== null; // 답을 선택했다면 정답
        } else {
          // 일부 선택지만 정답인 경우
          isCorrect = correctAnswer.includes(userAnswer);
        }
      } else {
        // 단일 정답인 경우
        isCorrect = userAnswer === correctAnswer;
      }

      if (!isCorrect && userAnswer !== null) {
        incorrectIndices.push(i);
        incorrectGlobalIndices.push(q.globalIndex);
      }
    });

    // 결과 화면 생성
    const resultsContainer = document.getElementById('results-summary');
    
    // 타이머 요소에서 시간 가져오기 (없으면 timeRemaining 변수 사용)
    let timeDisplay = '00:00';
    const timerElement = document.getElementById('timer');
    if (timerElement && timerElement.textContent) {
      timeDisplay = timerElement.textContent;
    } else {
      // timeRemaining 변수 사용 (초 단위를 mm:ss 형식으로 변환)
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    resultsContainer.innerHTML = `
      <div class="results-container">
        <h2 class="results-title">모의고사 결과</h2>
        
        <div class="score-overview">
          <div class="total-score">
            <div class="score-label">총점</div>
            <div class="score-value">${earnedPoints}<span class="score-max">/${maxPoints}점</span></div>
            <div class="score-count">${correctAnswers}/${totalQuestions}문제</div>
          </div>
          <div class="time-info">
            <div class="time-label">남은 시간</div>
            <div class="time-value">${timeDisplay}</div>
          </div>
        </div>
        
        <div class="subject-scores-section">
          <h3 class="section-title">과목별 점수</h3>
          <div class="subject-grid">
            ${createSubjectCards(subjectResults)}
          </div>
        </div>
        
        <div class="results-message">
          <p>${getScoreComment(scoreData.totalScore)}</p>
        </div>
        
        <div class="results-actions" id="results-actions">
          <!-- 여기에 버튼 추가, 모든 문제 맞았을 때는 다르게 표시 -->
        </div>
      </div>
    `;

    // 화면 표시 상태 설정
    document.getElementById('quiz-container').style.display = 'none';
    document.querySelector('.navigation-buttons').style.display = 'none';
    resultsContainer.style.display = 'block';

    // 인디케이터 업데이트
    updateResultIndicators();

    // 버튼 영역 업데이트
    const resultsActions = document.getElementById('results-actions');

    // 모든 문제 맞았는지 확인
    if (incorrectIndices.length === 0) {
      // 모든 문제 맞은 경우
      resultsActions.innerHTML = `
        <div class="success-message">
          <p>모든 문제를 맞혔습니다! 축하합니다! 🎉</p>
        </div>
        <div class="action-buttons">
          <button onclick="location.href='../index.html'" class="action-button">처음으로 돌아가기</button>
          <button onclick="resetQuiz()" class="action-button retry-button">다시 풀기</button>
        </div>
      `;
    } else {
      // 틀린 문제가 있는 경우
      resultsActions.innerHTML = `
        <button onclick="reviewQuiz()" class="action-button review-button">전체 오답 확인</button>
        <div class="action-buttons">
          <button onclick="location.href='../index.html'" class="action-button">처음으로 돌아가기</button>
          <button onclick="resetQuiz()" class="action-button retry-button">다시 풀기</button>
        </div>
      `;

      // 오답 인덱스 저장
      window.incorrectIndices = incorrectIndices;
      window.incorrectGlobalIndices = incorrectGlobalIndices;
      window.currentIncorrectIndex = 0;
    }

    // CSS 스타일 추가
    addResultsStyles();
  }

  // 결과 화면 스타일 추가 함수
  function addResultsStyles() {
    // 기존 스타일이 있으면 제거
    const existingStyle = document.getElementById('results-styles');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'results-styles';
    style.textContent = `
      .results-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px;
        background-color: #ffffff;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      
      .results-title {
        text-align: center;
        margin-bottom: 32px;
        color: #1a1a1a;
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      
      .score-overview {
        display: flex;
        justify-content: space-between;
        margin-bottom: 40px;
        padding: 24px;
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        border-radius: 12px;
        border: 1px solid #e9ecef;
      }
      
      .total-score {
        text-align: center;
        flex: 1;
      }
      
      .score-label, .time-label {
        font-size: 0.875rem;
        margin-bottom: 8px;
        color: #6c757d;
        font-weight: 500;
        letter-spacing: 0.01em;
      }
      
      .score-value {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1a1a1a;
        letter-spacing: -0.03em;
        line-height: 1.2;
      }
      
      .score-max {
        font-size: 1rem;
        color: #868e96;
        font-weight: 400;
        margin-left: 4px;
      }
      
      .score-count {
        margin-top: 8px;
        color: #6c757d;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .time-info {
        text-align: center;
        flex: 1;
        border-left: 1px solid #e9ecef;
        padding-left: 24px;
      }
      
      .time-value {
        font-size: 2rem;
        font-weight: 700;
        color: #495057;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }
      
      .subject-scores-section {
        margin-bottom: 40px;
      }
      
      .section-title {
        margin-bottom: 24px;
        color: #1a1a1a;
        font-size: 1.125rem;
        font-weight: 600;
        text-align: center;
        letter-spacing: -0.01em;
      }
      
      .subject-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        max-width: 700px;
        margin: 0 auto;
      }
      
      .subject-card {
        padding: 24px 20px;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e9ecef;
        text-align: center;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .subject-card:hover {
        border-color: #dee2e6;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        transform: translateY(-2px);
      }
      
      .subject-label {
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #868e96;
      }
      
      .subject-name-small {
        font-size: 1rem;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 16px;
        letter-spacing: -0.01em;
      }
      
      .subject-name {
        font-weight: 600;
        margin-bottom: 10px;
        color: #1a1a1a;
        font-size: 1rem;
      }
      
      .subject-score {
        font-size: 2.25rem;
        font-weight: 700;
        margin-bottom: 12px;
        letter-spacing: -0.03em;
        line-height: 1.2;
      }
      
      .score-high {
        color: #28a745;
      }
      
      .score-medium {
        color: #ffc107;
      }
      
      .score-low {
        color: #dc3545;
      }
      
      .subject-detail {
        margin-bottom: 16px;
        color: #6c757d;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .review-subject-button {
        background: #ffffff;
        color: #dc3545;
        border: 1.5px solid #dc3545;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 600;
        margin-top: 8px;
        transition: all 0.2s ease;
        width: 100%;
      }
      
      .review-subject-button:hover {
        background: #dc3545;
        color: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
      }
      
      .perfect-subject {
        padding: 10px 20px;
        background: #f0f9f4;
        border: 1.5px solid #28a745;
        border-radius: 8px;
        color: #28a745;
        font-weight: 600;
        font-size: 0.875rem;
        margin-top: 8px;
      }
      
      .results-message {
        text-align: center;
        margin: 40px auto 32px;
        padding: 20px 24px;
        background: #f8f9fa;
        border-radius: 12px;
        border: 1px solid #e9ecef;
        font-size: 1rem;
        font-weight: 500;
        color: #495057;
        max-width: 600px;
        line-height: 1.6;
      }
      
      .results-actions {
        margin-top: 32px;
        text-align: center;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      
      .success-message {
        margin-bottom: 25px;
        padding: 20px;
        background: #f0f9f4;
        border-radius: 12px;
        border: 1px solid #28a745;
        color: #155724;
        font-size: 1.125rem;
        font-weight: 600;
      }
      
      .action-buttons {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 0;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .action-button {
        flex: 1;
        min-width: 140px;
        max-width: 180px;
        padding: 12px 20px;
        border: 1.5px solid #e9ecef;
        border-radius: 8px;
        font-size: 0.9375rem;
        font-weight: 600;
        line-height: 1.4;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #ffffff;
        color: #495057;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .action-button:hover {
        background: #f8f9fa;
        border-color: #dee2e6;
        transform: translateY(-1px);
      }
      
      .review-button {
        width: 100%;
        max-width: 100%;
        padding: 14px 24px;
        background: #dc3545;
        color: white;
        font-weight: 600;
        font-size: 0.9375rem;
        line-height: 1.4;
        margin-bottom: 12px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .review-button:hover {
        background: #c82333;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.25);
      }
      
      .retry-button {
        background: #1a1a1a;
        color: white;
        border-color: #1a1a1a;
      }
      
      .retry-button:hover {
        background: #000000;
        border-color: #000000;
      }
      
      /* 처음으로 버튼 */
      .action-button:first-child:not(.retry-button) {
        background: #6c757d;
        color: white;
        border-color: #6c757d;
      }
      
      .action-button:first-child:not(.retry-button):hover {
        background: #5a6268;
        border-color: #5a6268;
      }
      
      /* 모바일 반응형 */
      @media (max-width: 768px) {
        .results-container {
          padding: 24px 16px;
        }
        
        .results-title {
          font-size: 1.5rem;
          margin-bottom: 24px;
        }
        
        .score-overview {
          padding: 20px;
          margin-bottom: 32px;
        }
        
        .score-value {
          font-size: 2rem;
        }
        
        .time-value {
          font-size: 1.75rem;
        }
        
        .subject-grid {
          gap: 12px;
          max-width: 100%;
        }
        
        .subject-card {
          padding: 20px 16px;
        }
        
        .subject-score {
          font-size: 1.875rem;
        }
        
        .action-buttons {
          flex-direction: column;
          gap: 10px;
        }
        
        .action-button {
          max-width: 100%;
          min-width: 100%;
        }
      }
      
      @media (max-width: 480px) {
        .subject-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        
        .results-message {
          padding: 16px 20px;
          font-size: 0.9375rem;
        }
        
        .score-overview {
          flex-direction: column;
          gap: 20px;
        }
        
        .time-info {
          border-left: none;
          border-top: 1px solid #e9ecef;
          padding-left: 0;
          padding-top: 20px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // 이전 오답 문제로 이동 함수
  function goToPreviousIncorrect() {
    if (window.currentIncorrectIndex > 0) {
      window.currentIncorrectIndex--;
      currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];

      // 버튼 상태 업데이트
      document.getElementById('prev-button').disabled = window.currentIncorrectIndex === 0;
      document.getElementById('next-button').disabled = false;

      loadQuestion(currentQuestionIndex);
      updateQuestionIndicators();
      showCurrentAnswer(questions[currentQuestionIndex]);
      updateIncorrectCounter();
    }
  }

  // 다음 오답 문제로 이동 함수
  function goToNextIncorrect() {
    if (window.currentIncorrectIndex < window.incorrectIndices.length - 1) {
      window.currentIncorrectIndex++;
      currentQuestionIndex = window.incorrectIndices[window.currentIncorrectIndex];

      // 버튼 상태 업데이트
      document.getElementById('prev-button').disabled = false;
      document.getElementById('next-button').disabled = window.currentIncorrectIndex >= window.incorrectIndices.length - 1;

      loadQuestion(currentQuestionIndex);
      updateQuestionIndicators();
      showCurrentAnswer(questions[currentQuestionIndex]);
      updateIncorrectCounter();
    }
  }

  // 리뷰 모드 UI 추가 함수 (일반 문제 스타일)
  function addReviewModeUI(incorrectCount, subject = '전체') {
    // 기존 리뷰 UI 제거
    const existingMsg = document.querySelector('.review-mode-message');
    if (existingMsg) existingMsg.remove();

    // 리뷰 모드 메시지 생성
    const reviewMessage = document.createElement('div');
    reviewMessage.className = 'review-mode-message';
    reviewMessage.innerHTML = `
      <div class="review-mode-title">📝 오답 리뷰 모드</div>
      <div class="review-mode-info">틀린 ${incorrectCount}문제를 확인하세요 (1/${incorrectCount})</div>
    `;

    // 리뷰 모드 스타일은 CSS 파일에서 관리 (인라인 스타일 제거)
    // CSS 파일의 .review-mode-message 스타일이 적용됩니다

    // 메시지 추가
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.insertBefore(reviewMessage, progressContainer.firstChild);
    } else {
      const quizContainer = document.getElementById('quiz-container');
      quizContainer.insertBefore(reviewMessage, quizContainer.firstChild);
    }

    // 네비게이션에 종료 버튼 추가
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

  // 리뷰 모드 종료 함수
  function exitReviewMode() {
    // 리뷰 모드 플래그 해제
    reviewMode = false;

    // 리뷰 모드 UI 제거
    const reviewMessage = document.querySelector('.review-mode-message');
    if (reviewMessage) reviewMessage.remove();

    // 종료 버튼 제거
    const exitButton = document.querySelector('.exit-review-button');
    if (exitButton) exitButton.remove();

    // 네비게이션 버튼 이벤트 리스너 복원
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    prevButton.removeEventListener('click', goToPreviousIncorrect);
    nextButton.removeEventListener('click', goToNextIncorrect);

    prevButton.addEventListener('click', window.originalPrevFunction || goToPreviousQuestion);
    nextButton.addEventListener('click', window.originalNextFunction || goToNextQuestion);

    // 버튼 상태 초기화
    prevButton.disabled = currentQuestionIndex === 0;
    nextButton.disabled = currentQuestionIndex >= questions.length - 1;

    // 결과 화면으로 돌아가기
    document.getElementById('quiz-container').style.display = 'none';
    document.querySelector('.navigation-buttons').style.display = 'none';
    document.getElementById('results-summary').style.display = 'block';

    // 인디케이터 업데이트
    updateResultIndicators();
  }

  // 현재 문제의 정답 표시 함수
  function showCurrentAnswer(question) {
    const feedback = document.getElementById('feedback');
    if (!feedback) return;

    const userAnswer = userAnswers[question.globalIndex];

    // 정답 확인 로직 개선
    let isCorrect;
    let correctAnswerText;

    if (Array.isArray(question.correctAnswer)) {
      // 배열인 경우 (다중 정답)
      if (question.correctAnswer.length === 4) {
        // 모든 선택지가 정답인 경우
        isCorrect = userAnswer !== null; // 답을 선택했다면 정답
        correctAnswerText = "모든 보기가 정답";
      } else {
        // 일부 선택지만 정답인 경우
        isCorrect = question.correctAnswer.includes(userAnswer);
        correctAnswerText = question.correctAnswer.map(idx => (idx + 1) + '번').join(' 또는 ');
      }
    } else {
      // 단일 정답인 경우
      isCorrect = (userAnswer === question.correctAnswer);
      correctAnswerText = (question.correctAnswer + 1) + '번';
    }

    // ✅ 임시: 구독 기능 완전 구현 전까지 모두에게 해설 표시
    const isPremium = true; // 임시로 모두에게 허용

    // 해설 표시
    let explanationHTML = `<div class="explanation">${question.explanation || '해설 정보가 없습니다.'}</div>`;

    feedback.className = `answer-feedback ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`;
    feedback.innerHTML = `
      <div class="feedback-title">
        <span class="feedback-icon">${isCorrect ? '✓' : '✗'}</span>
        <span>${isCorrect ? '정답입니다!' : '오답입니다!'}</span>
      </div>
      ${!isCorrect ? `<div class="correct-answer">정답: ${correctAnswerText}</div>` : ''}
      ${explanationHTML}
    `;
    feedback.style.display = 'block';
  }
})();