/**
 * 문제 풀이 시도를 기록하는 개선된 함수
 * @param {Object} questionData - 문제 데이터
 * @param {number} userAnswer - 사용자 답변 (0-3)
 * @param {boolean} isCorrect - 정답 여부
 * @returns {Promise<string|null>} 저장된 시도 ID
 */
export async function recordQuestionAttempt(questionData, userAnswer, isCorrect) {
  try {
    console.log('문제 풀이 시도 기록 함수 호출:', {
      questionData,
      userAnswer,
      isCorrect
    });
    
    // 로그인 상태 확인
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    if (!isLoggedIn) {
      console.warn('로그인하지 않은 상태에서는 기록이 저장되지 않습니다.');
      return null;
    }
    
    // 사용자 ID 확인
    const userId = firebase.auth().currentUser?.uid || localStorage.getItem('userId');
    if (!userId) {
      console.warn('사용자 ID를 찾을 수 없습니다.');
      return null;
    }
    
    // 현재 세션 ID 가져오기
    let sessionId = null;
    
    // 방법 1: 세션 매니저에서 가져오기
    if (window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
      console.log('세션 매니저에서 세션 ID 가져옴:', sessionId);
    }
    
    // 방법 2: localStorage에서 가져오기
    if (!sessionId) {
      sessionId = localStorage.getItem('currentSessionId');
      console.log('localStorage에서 세션 ID 가져옴:', sessionId);
    }
    
    // 세션 ID가 없으면 새로 생성
    if (!sessionId) {
      console.log('세션 ID가 없어 새로 생성합니다.');
      
      try {
        if (window.sessionManager) {
          // ✅ questionData를 메타데이터로 전달하여 유효한 세션 생성
          const sessionMetadata = {
            subject: questionData?.subject,
            year: questionData?.year,
            type: questionData?.isFromMockExam ? 'mockexam' : 'regular',
            setId: questionData?.setId,
            questionNumber: questionData?.number
          };
          
          const session = await window.sessionManager.startNewSession(sessionMetadata);
          
          // ✅ 세션이 null이면 (유효성 검사 실패) 문제 풀이 기록만 저장하고 세션은 생성하지 않음
          if (!session || !session.id) {
            console.warn('세션 생성 실패: 유효하지 않은 정보입니다. 문제 풀이 기록만 저장합니다.');
            sessionId = null;
          } else {
            sessionId = session.id;
            console.log('새 세션 생성됨:', sessionId);
          }
        } else {
          // ✅ sessionManager가 없으면 세션 생성하지 않음 (빈 세션 방지)
          console.warn('세션 매니저가 없습니다. 세션 없이 진행합니다.');
          sessionId = null;
        }
      } catch (error) {
        console.error('세션 생성 오류:', error);
        // ✅ 에러 발생 시에도 임시 세션 생성하지 않음 (빈 세션 방지)
        sessionId = null;
      }
    }
    
    // 시도 기록 데이터 준비
    const attempt = {
      userId: userId,
      sessionId: sessionId,
      questionData: questionData,
      userAnswer: userAnswer,
      isCorrect: isCorrect,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('저장할 시도 기록:', attempt);
    
    // Firestore에 저장
    const result = await firebase.firestore().collection('attempts').add(attempt);
    console.log('시도 기록 저장 완료:', result.id);
    
    // 세션 문서 업데이트 (attemptCount 증가)
    try {
      await firebase.firestore().collection('sessions').doc(sessionId).update({
        attemptCount: firebase.firestore.FieldValue.increment(1),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('세션 문서 업데이트 완료');
    } catch (error) {
      console.warn('세션 문서 업데이트 오류 (무시됨):', error);
    }
    
    return result.id;
  } catch (error) {
    console.error('시도 기록 저장 오류:', error);
    return null;
  }
}

/**
 * 배치 방식으로 여러 문제 풀이 시도를 기록하는 함수
 * @param {Array} attempts - 시도 기록 배열
 * @returns {Object} 성공 여부 및 결과 정보
 */
export async function batchRecordAttempts(attempts) {
  try {
    console.log('배치 시도 기록 함수 호출:', attempts.length, '개 시도');
    
    // 로그인 상태 확인
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    if (!isLoggedIn) {
      console.warn('로그인하지 않은 상태에서는 기록이 저장되지 않습니다.');
      return { success: false, error: '로그인이 필요합니다.' };
    }
    
    // 사용자 ID 확인
    const userId = firebase.auth().currentUser?.uid || localStorage.getItem('userId');
    if (!userId) {
      console.warn('사용자 ID를 찾을 수 없습니다.');
      return { success: false, error: '사용자 ID를 찾을 수 없습니다.' };
    }
    
    // 현재 세션 ID 가져오기
    let sessionId = null;
    
    // 방법 1: 세션 매니저에서 가져오기
    if (window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
      console.log('세션 매니저에서 세션 ID 가져옴:', sessionId);
    }
    
    // 방법 2: localStorage에서 가져오기
    if (!sessionId) {
      sessionId = localStorage.getItem('currentSessionId');
      console.log('localStorage에서 세션 ID 가져옴:', sessionId);
    }
    
    // 세션 ID가 없으면 새로 생성
    if (!sessionId) {
      console.log('세션 ID가 없어 새로 생성합니다.');
      
      try {
        if (window.sessionManager) {
          // ✅ attempts 배열에서 첫 번째 attempt의 questionData 사용
          const firstAttempt = attempts && attempts.length > 0 ? attempts[0] : null;
          const questionData = firstAttempt?.questionData || {};
          
          const sessionMetadata = {
            subject: questionData?.subject,
            year: questionData?.year,
            type: questionData?.isFromMockExam ? 'mockexam' : 'regular',
            setId: questionData?.setId,
            questionNumber: questionData?.number
          };
          
          const session = await window.sessionManager.startNewSession(sessionMetadata);
          
          // ✅ 세션이 null이면 (유효성 검사 실패) 문제 풀이 기록만 저장하고 세션은 생성하지 않음
          if (!session || !session.id) {
            console.warn('세션 생성 실패: 유효하지 않은 정보입니다. 문제 풀이 기록만 저장합니다.');
            sessionId = null;
          } else {
            sessionId = session.id;
            console.log('새 세션 생성됨:', sessionId);
          }
        } else {
          // ✅ sessionManager가 없으면 세션 생성하지 않음 (빈 세션 방지)
          console.warn('세션 매니저가 없습니다. 세션 없이 진행합니다.');
          sessionId = null;
        }
      } catch (error) {
        console.error('세션 생성 오류:', error);
        // ✅ 에러 발생 시에도 임시 세션 생성하지 않음 (빈 세션 방지)
        sessionId = null;
      }
    }
    
    // 배치 처리 준비
    const batch = firebase.firestore().batch();
    const savedIds = [];
    
    // 각 시도 기록 추가
    attempts.forEach(attempt => {
      const docRef = firebase.firestore().collection('attempts').doc();
      
      // 시도 기록 데이터 보강
      const attemptData = {
        userId: userId,
        sessionId: sessionId,
        questionData: attempt.questionData || {},
        userAnswer: attempt.userAnswer,
        isCorrect: attempt.isCorrect,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      batch.set(docRef, attemptData);
      savedIds.push(docRef.id);
    });
    
    // 배치 커밋
    await batch.commit();
    console.log('배치 시도 기록 저장 완료:', savedIds.length, '개 시도');
    
    // 세션 문서 업데이트 (attemptCount 증가)
    try {
      await firebase.firestore().collection('sessions').doc(sessionId).update({
        attemptCount: firebase.firestore.FieldValue.increment(attempts.length),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('세션 문서 업데이트 완료');
    } catch (error) {
      console.warn('세션 문서 업데이트 오류 (무시됨):', error);
    }
    
    return {
      success: true,
      count: attempts.length,
      ids: savedIds,
      sessionId: sessionId
    };
  } catch (error) {
    console.error('배치 시도 기록 저장 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 수정된 퀴즈 제출 함수
 */
export async function submitQuiz() {
  try {
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
    
    // 결과 저장 시도
    console.log("퀴즈 결과 저장 시도");
    
    // 로그인 상태 확인
    if (isUserLoggedIn()) {
      try {
        // 각 문제별로 풀이 결과 준비
        const attemptsToSave = [];
        
        const pathSegments = window.location.pathname.split('/');
        const filename = pathSegments[pathSegments.length - 1];
        const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
        
        let year = '2025';
        let subject = '운동생리학';
        
        if (filenameMatch) {
          year = filenameMatch[1];
          subject = filenameMatch[2];
          try {
            subject = decodeURIComponent(subject);
          } catch (error) {
            console.error('과목명 디코딩 오류:', error);
          }
        }
        
        // 세션 ID 가져오기
        let sessionId = null;
        
        // 1. 세션 매니저 확인 및 세션 유효성 검사 추가
        if (window.sessionManager) {
          // 현재 세션이 없거나 유효하지 않은 경우 새 세션 시작
          if (!window.sessionManager.currentSession || !window.sessionManager.currentSession.id) {
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
          if (!sessionManager.currentSession || !sessionManager.currentSession.id) {
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
              const isCorrect = userAnswers[i] === correctAnswer;
              
              const questionData = {
                year,
                subject,
                number: i + 1,
                isFromMockExam: false,
                sessionId: sessionId,
                correctAnswer: correctAnswer // 정답 정보 추가
              };
              
              // 저장할 데이터 배열에 추가
              attemptsToSave.push({
                questionData,
                userAnswer: userAnswers[i],
                isCorrect
              });
            }
          }
        }
        
        console.log(`${attemptsToSave.length}개 문제 결과를 한 번에 저장합니다.`);
        
        // ****** 중요 수정 부분: 전역 함수 사용 방식 변경 ******
        
        // 우선 전역 batchRecordAttempts 함수 직접 참조 시도
        if (typeof window.batchRecordAttempts === 'function') {
          console.log('window.batchRecordAttempts 함수를 호출합니다.');
          const result = await window.batchRecordAttempts(attemptsToSave);
          console.log('배치 저장 완료 (window 직접 참조):', result);
        } 
        // 임포트된 batchRecordAttempts 함수 사용 시도
        else if (typeof batchRecordAttempts === 'function') {
          console.log('임포트된 batchRecordAttempts 함수를 호출합니다.');
          const result = await batchRecordAttempts(attemptsToSave);
          console.log('배치 저장 완료 (임포트 함수):', result);
        }
        // 직접 Firebase Firestore API 사용
        else {
          console.warn('배치 저장 함수를 찾을 수 없어 직접 Firebase API를 사용합니다.');
          
          // 배치 처리 준비
          const batch = firebase.firestore().batch();
          
          // 각 시도 기록 추가
          for (const attempt of attemptsToSave) {
            const docRef = firebase.firestore().collection('attempts').doc();
            
            const attemptData = {
              userId: firebase.auth().currentUser.uid,
              sessionId: sessionId,
              questionData: attempt.questionData,
              userAnswer: attempt.userAnswer,
              isCorrect: attempt.isCorrect,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            batch.set(docRef, attemptData);
          }
          
          // 배치 커밋
          await batch.commit();
          console.log(`${attemptsToSave.length}개 시도 기록 직접 저장 완료`);
          
          // 세션 문서 업데이트 (attemptCount 증가)
          try {
            await firebase.firestore().collection('sessions').doc(sessionId).update({
              attemptCount: firebase.firestore.FieldValue.increment(attemptsToSave.length),
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.warn('세션 문서 업데이트 오류 (무시됨):', error);
          }
        }
        
        // 세션 정보 업데이트 - 세션 매니저가 있는 경우에만 시도
        try {
          if (window.sessionManager && sessionId) {
            // 세션 통계 정보 업데이트
            const correctCount = attemptsToSave.filter(a => a.isCorrect).length;
            const sessionStats = {
              totalQuestions: questions.length,
              attemptedQuestions: attemptsToSave.length,
              correctAnswers: correctCount,
              accuracy: Math.round((correctCount / attemptsToSave.length) * 100),
              // 추가 메타데이터
              subject: subject,
              year: year,
              title: `${year} ${subject}`,
              completedAt: new Date()
            };
            
            // 세션 종료 (isActive = false로 변경)
            await window.sessionManager.endSession(sessionStats);
            console.log('세션 종료 및 통계 업데이트 완료:', sessionId);
          }
        } catch (error) {
          console.warn('세션 종료 오류 (무시됨):', error);
        }
      } catch (error) {
        console.error("퀴즈 결과 저장 중 오류 발생:", error);
      }
    } else {
      console.warn("사용자가 로그인하지 않아 결과가 저장되지 않습니다.");
    }
    
    // 결과 화면 표시
    showResults();
  } catch (error) {
    console.error('퀴즈 제출 오류:', error);
    showToast('퀴즈 제출 중 오류가 발생했습니다.');
  }
}

// window 객체에 노출
window.recordQuestionAttempt = recordQuestionAttempt;
window.batchRecordAttempts = batchRecordAttempts;

async function initializeQuiz() {
  try {
    // 세션 초기화 추가
    try {
      // 현재 파일 이름에서 년도와 과목 정보 추출
      const pathSegments = window.location.pathname.split('/');
      const filename = pathSegments[pathSegments.length - 1];
      
      // 파일명에서 년도와 과목 추출 (YYYY_과목명.html 형식)
      const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
      
      let year = '';
      let subject = '';
      
      if (filenameMatch) {
        year = filenameMatch[1];  // 추출된 년도 (예: 2024)
        subject = filenameMatch[2];  // 추출된 과목 (예: 운동생리학)
        try {
          subject = decodeURIComponent(subject);
        } catch (error) {
          console.error('과목명 디코딩 오류:', error);
        }
      }
      
      // ✅ 페이지 로드 시 세션 생성하지 않음 (실제 문제를 풀 때만 생성)
      // 이어풀기 모드인 경우에만 기존 세션 복구
      const urlParams = new URLSearchParams(window.location.search);
      const isResume = urlParams.get('resume') === 'true';
      const resumeSessionId = urlParams.get('sessionId') || localStorage.getItem('resumeSessionId');
      
      if (isResume && resumeSessionId && window.sessionManager) {
        // 이어풀기 모드: 기존 세션 ID만 설정 (세션은 이미 존재함)
        localStorage.setItem('currentSessionId', resumeSessionId);
        console.log('이어풀기 모드: 기존 세션 복구:', resumeSessionId);
      }
      // 일반 모드: 세션 생성하지 않음 (첫 문제 풀이 시 자동 생성됨)
    } catch (error) {
      console.error('세션 초기화 오류:', error);
      // 세션 초기화 실패는 치명적 오류가 아니므로 계속 진행
    }
    
    // 기존 퀴즈 초기화 코드 계속...
    // ...
  } catch (error) {
    console.error('퀴즈 초기화 오류:', error);
    showToast('퀴즈 초기화 중 오류가 발생했습니다.');
  }
} 