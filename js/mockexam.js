/**
 * ⚠️ DEPRECATED: 이 파일(js/mockexam.js)은 어떤 HTML에서도 로드되지 않는 고아 파일입니다.
 * 실제 모의고사 로직은 js/quiz/mock-exam.js (IIFE)에 구현되어 있습니다.
 * 이 파일을 수정해도 사용자에게 영향이 없습니다. 향후 삭제 예정.
 */

/**
 * 모의고사 세션 초기화 함수
 */
async function initializeMockExam() {
  try {
    console.log('모의고사 초기화 시작');
    
    // 세션 초기화 추가
    try {
      // 현재 파일 이름에서 년도와 교시 정보 추출
      const currentPath = window.location.pathname;
      const filename = currentPath.split('/').pop();
      
      // 년도와 교시 추출 (유연한 정규식 사용)
      let year = '2025'; // 기본값
      let hour = '1';    // 기본값
      
      // 파일명에서 추출 시도
      const fileMatch = filename.match(/(\d{4}).*?(\d)교시/);
      if (fileMatch) {
        year = fileMatch[1];
        hour = fileMatch[2];
      }
      
      console.log(`모의고사 정보: ${year}년도 ${hour}교시`);
      
      // 교시에 따른 과목 설정
      let subjectNames = [];
      if (hour === '1') {
        subjectNames = ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"];
      } else {
        subjectNames = ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];
      }

      // ✅ 페이지 로드 시 세션 생성하지 않음 (실제 문제를 풀 때만 생성)
      // 이어풀기 모드인 경우에만 기존 세션 복구
      const urlParams = new URLSearchParams(window.location.search);
      const isResume = urlParams.get('resume') === 'true';
      
      const sessionManager = window.sessionManager;
      if (sessionManager) {
        if (isResume) {
          // 이어풀기 모드: 기존 세션 복구 시도
          const sessionMetadata = {
            year: year,
            hour: hour,
            type: 'mockexam',
            title: `${year}년 ${hour}교시 모의고사`,
            subjects: subjectNames.join(', '),
            totalQuestions: 80,
            examType: '모의고사',
            isActive: true
          };
          
          const session = await sessionManager.startNewSession(sessionMetadata, true);
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
    } catch (error) {
      console.error('세션 초기화 오류:', error);
    }
    
    // 나머지 모의고사 초기화 코드...
    
    return true;
  } catch (error) {
    console.error('모의고사 초기화 오류:', error);
    return false;
  }
}

/**
 * 모의고사 제출 함수
 */
async function submitMockExam() {
  // 타이머 중지
  clearInterval(timerInterval);
  
  console.log("모의고사 제출 버튼이 클릭되었습니다.");
  
  // 미응답 문제 확인
  if (!userAnswers.every(answer => answer !== null)) {
    const confirmed = confirm('아직 풀지 않은 문제가 있습니다. 정말 제출하시겠습니까?');
    if (!confirmed) {
      startTimer();
      return;
    }
  }
  
  // 리뷰 모드 활성화
  reviewMode = true;
  window.reviewMode = true;
  
  // 인디케이터 업데이트하여 정답/오답 표시
  updateAllAnswerIndicators();
  
  // 결과 저장 시도
  console.log("모의고사 결과 저장 시도");
  
  if (isUserLoggedIn()) {
    try {
      // 모의고사 정보 추출
      const _urlParams = new URLSearchParams(window.location.search);
      const _pathMatch = window.location.pathname.split('/').pop().match(/(\d{4}).*?(\d)교시/) || [];
      const year = _urlParams.get('year') || _pathMatch[1] || '2025';
      const hour = _urlParams.get('hour') || _pathMatch[2] || '1';
      
      // 과목별 문제 분류
      const subjectNames = hour === '1' ? 
        ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"] : 
        ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];
      
      // 세션 ID 가져오기
      let sessionId = sessionManager ? 
        sessionManager.getCurrentSessionId() : 
        localStorage.getItem('currentSessionId');
      
      // 각 문제별로 저장할 데이터 준비
      const attemptsToSave = [];
      
      // 과목별 결과 처리를 위한 객체
      const subjectResults = {};
      subjectNames.forEach(subject => {
        subjectResults[subject] = {
          total: 20, // 각 과목별 20문제
          correct: 0,
          score: 0
        };
      });
      
      // 각 문제 처리
      for (let i = 0; i < questions.length; i++) {
        try {
          // 문제 과목 확인 (4개 과목 중 어디에 속하는지)
          const question = questions[i];
          const subject = question.subject;
          
          if (!subject) {
            console.warn(`문제 ${i}에 subject 정보가 없습니다.`, question);
            continue;  // 이 문제 건너뛰기
          }
          
          const subjectIndex = subjectNames.indexOf(subject);
          
          // 과목 내 문제 번호 계산 (1~20)
          // 이 부분이 중요: undefined 오류 방지를 위해 number 필드 설정
          let subjectQuestionNumber;
          
          if (question.number !== undefined) {
            // 문제 객체에 이미 번호가 있으면 그대로 사용
            subjectQuestionNumber = question.number;
          } else {
            // 아니면 과목별로 1~20 사이 번호 계산
            // 각 과목별로 문제를 그룹화하고 인덱스 찾기
            const subjectQuestions = questions.filter(q => q.subject === subject);
            const questionIndexInSubject = subjectQuestions.findIndex(q => q === question);
            subjectQuestionNumber = questionIndexInSubject + 1;
            
            // 위 방법이 실패하면 대체 방법 사용
            if (isNaN(subjectQuestionNumber) || questionIndexInSubject === -1) {
              // 인덱스에 기반한 계산법 (더 안전함)
              subjectQuestionNumber = (i % 20) + 1;
            }
          }
          
          // 사용자 답변 확인
          const userAnswer = userAnswers[i];
          // 답변이 없는 경우 건너뛰기
          if (userAnswer === null || userAnswer === undefined) {
            console.warn(`문제 ${i}에 사용자 답변이 없습니다.`);
            continue;
          }
          
          const isCorrect = userAnswer === question.correctAnswer;
          
          // 과목별 결과 업데이트
          if (subjectResults[subject]) {
            if (isCorrect) {
              subjectResults[subject].correct++;
            }
          }
          
          // 문제 데이터 구성
          const questionData = {
            year: year || '2024',
            subject: subject,
            number: subjectQuestionNumber, // 확인된 번호 사용
            isFromMockExam: true,
            mockExamHour: hour || '1',
            sessionId: sessionId,
            correctAnswer: question.correctAnswer
          };
          
          // 저장 전 모든 필드가 정의되었는지 확인
          if (questionData.number === undefined) {
            console.error(`문제 ${i}의 number 필드가 undefined입니다. 저장을 건너뜁니다.`);
            continue;
          }
          
          // 저장 데이터 추가
          attemptsToSave.push({
            questionData,
            userAnswer,
            isCorrect
          });
        } catch (error) {
          console.error(`문제 ${i} 처리 중 오류:`, error);
          // 한 문제에서 오류가 발생해도 계속 진행
        }
      }
      
      // 과목별 점수 계산
      subjectNames.forEach(subject => {
        const result = subjectResults[subject];
        result.score = Math.round((result.correct / result.total) * 100);
      });
      
      // 전체 점수 계산
      const totalCorrect = attemptsToSave.filter(a => a.isCorrect).length;
      const score = Math.round((totalCorrect / attemptsToSave.length) * 100);
      
      console.log(`${attemptsToSave.length}개 문제 결과를 배치 저장합니다.`);
      
      // 배치 저장 함수 호출
      if (typeof window.batchRecordAttempts === 'function' && attemptsToSave.length > 0) {
        try {
          const result = await window.batchRecordAttempts(attemptsToSave);
          console.log('배치 저장 완료:', result);
        } catch (error) {
          console.error("배치 저장 오류:", error);
          // 배치 저장 실패 시 개별 저장 시도
          console.log('개별 저장 시도...');
          for (const attempt of attemptsToSave) {
            try {
              if (typeof window.recordAttempt === 'function') {
                await window.recordAttempt(attempt.questionData, attempt.userAnswer, attempt.isCorrect);
              }
            } catch (individualError) {
              console.error('개별 저장 오류:', individualError);
            }
          }
        }
      } else {
        console.warn('배치 저장 함수를 찾을 수 없거나 저장할 데이터가 없습니다.');
      }
      
      // 세션 종료 및 메타데이터 업데이트
      try {
        if (sessionManager && sessionId) {
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
          await sessionManager.endSession(sessionStats);
          console.log('모의고사 세션 종료 및 통계 업데이트 완료:', sessionId);
        }
      } catch (error) {
        console.warn('세션 종료 오류 (무시됨):', error);
      }
    } catch (error) {
      console.error("모의고사 결과 저장 중 오류 발생:", error);
    }
  }
  
  // 결과 화면 표시
  showResults();
}

// 데이터 유효성 검사 함수
function validateQuestionData(questionData, index) {
  const issues = [];
  
  if (!questionData) {
    return ["questionData is null or undefined"];
  }
  
  // 필수 필드 검사
  if (questionData.number === undefined) issues.push("number is undefined");
  if (questionData.subject === undefined) issues.push("subject is undefined");
  if (questionData.year === undefined) issues.push("year is undefined");
  if (questionData.sessionId === undefined) issues.push("sessionId is undefined");
  
  return issues;
}

async function saveMockExamResults() {
  // 디버깅 정보
  console.log("모의고사 결과 저장 시도...");
  console.log("총 문제 수:", questions.length);
  console.log("사용자 답변 수:", userAnswers.length);
  
  // 로그인 확인
  const userLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
  if (!userLoggedIn) {
    console.warn("로그인이 필요합니다. 모의고사 결과가 저장되지 않습니다.");
    return false;
  }
  
  // 현재 파일 이름에서 모의고사 정보 추출
  const currentPath = window.location.pathname;
  const filename = currentPath.split('/').pop();
  console.log("현재 파일명:", filename);
  
  // 모의고사 정보 추출
  let year = '2025';
  let hour = '1';
  
  // 파일명에서 추출 시도
  const fileMatch = filename.match(/(\d{4}).*?(\d)교시/);
  if (fileMatch) {
    year = fileMatch[1];
    hour = fileMatch[2];
  } else {
    // 제목에서 추출 시도
    const titleElement = document.querySelector('.quiz-title h1');
    if (titleElement) {
      const titleMatch = titleElement.textContent.match(/(\d{4}).*?(\d)교시/);
      if (titleMatch) {
        year = titleMatch[1];
        hour = titleMatch[2];
      }
    }
  }
  
  // URL 파라미터에서 추출 시도
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('year')) {
    year = urlParams.get('year');
  }
  if (urlParams.has('hour')) {
    hour = urlParams.get('hour');
  }
  
  console.log(`모의고사 정보: ${year}년도 ${hour}교시`);
  
  // 세션 ID 가져오기
  let sessionId = null;
  
  if (window.sessionManager) {
    sessionId = window.sessionManager.getCurrentSessionId();
    console.log("세션 매니저에서 sessionId 가져옴:", sessionId);
  }
  
  if (!sessionId) {
    sessionId = localStorage.getItem('currentSessionId');
    console.log("localStorage에서 sessionId 가져옴:", sessionId);
  }
  
  if (!sessionId) {
    // 세션 ID가 없으면 임시 ID 생성
    sessionId = `temp_${Date.now()}`;
    console.log("임시 sessionId 생성:", sessionId);
  }
  
  console.log("최종 사용 sessionId:", sessionId);

  // 교시에 따른 과목 설정
  let subjectNames = [];
  if (hour === '1') {
    subjectNames = ["운동생리학", "건강체력평가", "운동처방론", "운동부하검사"];
  } else {
    subjectNames = ["운동상해", "기능해부학", "병태생리학", "스포츠심리학"];
  }
  
  // 각 문제별로 저장할 데이터 준비
  const attemptsToSave = [];
  
  // 과목별 결과 처리를 위한 객체
  const subjectResults = {};
  subjectNames.forEach(subject => {
    subjectResults[subject] = {
      total: 20,  // 각 과목별 20문제
      correct: 0, // 정답 개수
      score: 0    // 점수
    };
  });
  
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
    
    console.log(`문제 ${globalIndex}: 과목=${subject}, 번호=${questionNumberInSubject}`);
    
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
    
    const isCorrect = userAnswer === correctAnswer;
    
    // 과목별 정답 개수 업데이트
    if (isCorrect) {
      subjectResults[subject].correct++;
    }
    
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
      timestamp: new Date()
    };
    
    // 유효성 검사 실행
    const issues = validateQuestionData(questionData, globalIndex);
    if (issues.length > 0) {
      console.error(`문제 ${globalIndex} 데이터 유효성 검사 실패:`, issues);
      console.error("문제 데이터:", questionData);
      // 오류가 있지만 계속 진행 (다른 데이터가 저장될 수 있도록)
    }
    
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
  
  // 디버깅: 저장 전 데이터 확인
  console.log("저장할 데이터 수:", attemptsToSave.length);
  console.log("첫 번째 데이터 샘플:", JSON.stringify(attemptsToSave[0], null, 2));
  
  // 배치 저장 시도
  if (typeof window.batchRecordAttempts === 'function' && attemptsToSave.length > 0) {
    try {
      console.log(`${attemptsToSave.length}개 문제 결과 배치 저장 시도...`);
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
          
          // 오류 항목 건너뛰기
          if (!attempt.questionData || attempt.questionData.number === undefined) {
            console.warn(`문제 ${i}의 데이터가 유효하지 않아 건너뜁니다.`);
            continue;
          }
          
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

async function submitQuiz() {
  // 타이머 중지
  clearInterval(timerInterval);
  
  console.log("모의고사 제출 버튼이 클릭되었습니다.");
  
  // 미응답 문제 확인
  if (!userAnswers.every(answer => answer !== null)) {
    const confirmed = confirm('아직 풀지 않은 문제가 있습니다. 정말 제출하시겠습니까?');
    if (!confirmed) {
      startTimer();
      return;
    }
  }
  
  // 리뷰 모드 활성화
  reviewMode = true;
  window.reviewMode = true;
  
  // 인디케이터 업데이트하여 정답/오답 표시
  updateAllAnswerIndicators();
  
  // 결과 저장 시도
  console.log("모의고사 결과 저장 시도");
  
  // 배치 처리 함수 확인
  if (typeof window.batchRecordAttempts !== 'function') {
    console.error("batchRecordAttempts 함수를 찾을 수 없습니다. 전역으로 노출되어 있는지 확인하세요.");
    
    // 서버 코드 출력
    if (typeof quizRepository !== 'undefined') {
      console.log("quizRepository 상태:", quizRepository);
    }
  }
  
  // 로그인 상태 확인 후 저장
  if (typeof isUserLoggedIn === 'function' && isUserLoggedIn()) {
    try {
      // 향상된 저장 함수 호출
      const saved = await saveMockExamResults();
      if (saved) {
        console.log("모의고사 결과가 성공적으로 저장되었습니다.");
      }
    } catch (error) {
      console.error("모의고사 결과 저장 중 오류 발생:", error);
    }
  } else {
    console.warn("사용자가 로그인하지 않아 결과가 저장되지 않습니다.");
  }
  
  // 결과 화면 표시
  showResults();
}

// 함수를 전역으로 노출
window.initializeMockExam = initializeMockExam;
window.submitMockExam = submitMockExam;
window.saveMockExamResults = saveMockExamResults;
window.submitQuiz = submitQuiz; 