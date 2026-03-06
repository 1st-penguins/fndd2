// quiz-repository.js - 퀴즈 데이터 저장소 모듈 (세션 기반 업데이트 버전)

import { db, auth, ensureAuthReady } from '../core/firebase-core.js';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { sessionManager } from './session-manager.js';

function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

const sessionCompatibilityCache = new Map();

function getAttemptContext(questionData = {}) {
  const isMock = questionData?.isFromMockExam === true || questionData?.type === 'mockexam';
  const year = String(questionData?.year || '');
  const hour = String(questionData?.hour || questionData?.mockExamHour || questionData?.examHour || '');
  const subject = String(questionData?.subject || '');
  return { isMock, year, hour, subject };
}

function isSessionCompatibleWithAttempt(sessionData = {}, attemptCtx) {
  if (!attemptCtx) return true;

  const sessionType = sessionData?.type === 'mockexam' ? 'mockexam' : 'regular';
  const sessionYear = String(sessionData?.year || '');
  const sessionHour = String(sessionData?.hour || sessionData?.mockExamPart || '');
  const sessionSubject = String(sessionData?.subject || '');

  if (attemptCtx.isMock) {
    if (sessionType !== 'mockexam') return false;
    if (attemptCtx.year && sessionYear && attemptCtx.year !== sessionYear) return false;
    if (attemptCtx.hour && sessionHour && attemptCtx.hour !== sessionHour) return false;
    return true;
  }

  if (sessionType === 'mockexam') return false;
  if (attemptCtx.year && sessionYear && attemptCtx.year !== sessionYear) return false;
  if (attemptCtx.subject && sessionSubject && attemptCtx.subject !== sessionSubject) return false;
  return true;
}

/**
 * 디바이스 타입 감지
 * @returns {string} 'mobile' | 'tablet' | 'desktop'
 */
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * 문제 풀이 시도를 Firebase에 저장하는 함수
 * @param {Object} questionData - 문제 데이터
 * @param {number} userAnswer - 사용자 답변 (0-3)
 * @param {boolean} isCorrect - 정답 여부
 */
export async function recordAttempt(questionData, userAnswer, isCorrect) {
  try {
    // 사용자 정보 확인 (Firebase auth 초기 복원 타이밍 보정)
    let user = auth?.currentUser || null;
    if (!user) {
      try {
        user = await ensureAuthReady();
      } catch (authError) {
        window.Logger?.warn('인증 상태 확인 실패:', authError);
      }
    }

    if (!user) {
      // 로그인 UI 상태와 Firebase 인증 복원 타이밍이 어긋날 수 있어 warning 대신 debug 처리
      window.Logger?.debug('recordAttempt 스킵: 인증 사용자 없음');
      return { success: false, reason: 'not-logged-in' };
    }

    // 현재 세션 ID 확인
    let sessionId = null;
    if (window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
      window.Logger?.debug('현재 세션 ID:', sessionId);
    }

    const attemptCtx = getAttemptContext(questionData);
    const attemptCtxKey = `${attemptCtx.isMock ? 'mock' : 'regular'}|${attemptCtx.year}|${attemptCtx.hour}|${attemptCtx.subject}`;

    // 기존 세션이 있어도 현재 문제 문맥과 맞지 않으면 새 세션으로 교체
    if (sessionId) {
      const cacheKey = `${sessionId}|${attemptCtxKey}`;
      const cachedCompatibility = sessionCompatibilityCache.get(cacheKey);
      let isCompatible = cachedCompatibility;

      if (typeof isCompatible !== 'boolean') {
        try {
          const sessionRef = doc(db, 'sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          if (!sessionSnap.exists()) {
            isCompatible = false;
          } else {
            const sessionData = sessionSnap.data();
            isCompatible = isSessionCompatibleWithAttempt(sessionData, attemptCtx);
          }
        } catch (sessionReadError) {
          window.Logger?.warn('기존 세션 검증 실패, 새 세션 생성으로 진행:', sessionReadError);
          isCompatible = false;
        }
        sessionCompatibilityCache.set(cacheKey, isCompatible);
      }

      if (!isCompatible) {
        window.Logger?.warn('기존 세션이 현재 문제 문맥과 맞지 않아 새 세션을 생성합니다.', {
          sessionId,
          attemptCtx
        });
        sessionId = null;
      }
    }

    if (!sessionId) {
      window.Logger?.warn('유효한 세션 ID가 없습니다. 세션을 시작합니다.');
      try {
        const isMockExam = attemptCtx.isMock;
        // ✅ questionData를 메타데이터로 전달하여 유효한 세션 생성
        const sessionMetadata = compactObject({
          subject: questionData?.subject,
          year: questionData?.year,
          type: isMockExam ? 'mockexam' : 'regular',
          hour: questionData?.hour || questionData?.mockExamHour || questionData?.examHour,
          certificateType: questionData?.certificateType || 'health-manager',
          setId: questionData?.setId,
          questionNumber: questionData?.number
        });
        
        const session = await window.sessionManager.startNewSession(sessionMetadata);
        
        // ✅ 세션이 null이면 (유효성 검사 실패) 문제 풀이 기록만 저장하고 세션은 생성하지 않음
        if (!session || !session.id) {
          window.Logger?.warn('세션 생성 실패: 유효하지 않은 정보입니다. 문제 풀이 기록만 저장합니다.');
          // 세션 없이 진행 (임시 세션 ID 사용하지 않음)
          sessionId = null;
        } else {
          sessionId = session.id;
          window.Logger?.debug('새 세션 시작됨:', sessionId);
        }
      } catch (sessionError) {
        window.Logger?.error('세션 시작 오류:', sessionError);
        // ✅ 에러 발생 시에도 임시 세션 생성하지 않음 (빈 세션 방지)
        sessionId = null;
      }
    }

    // ✅ 첫 시도 여부 확인 (firstAttemptTracking 배열 확인)
    const isFirstAttempt = questionData?.isFirstAttempt !== false &&
      (window.firstAttemptTracking === undefined ||
        window.firstAttemptTracking[questionData?.globalIndex ?? questionData?.number - 1] !== false);

    // 시도 기록 데이터 구성
    // 시도 기록 데이터 생성 (평탄화 최적화)
    const attemptData = {
      userId: user.uid,
      userName: user.displayName || user.email || '익명',
      userEmail: user.email || '',
      sessionId: sessionId,

      // ✅ 평탄화된 필드 (쿼리 최적화용)
      year: questionData?.year || '2025',
      subject: questionData?.subject || '과목없음',
      number: questionData?.number || 1,

      // 🎓 자격증 구분 필드 (NEW)
      certificateType: questionData?.certificateType || 'health-manager',  // 'health-manager' | 'sports-instructor'

      // 원본 유지 (호환성)
      questionData: questionData || {},

      userAnswer: userAnswer,
      isCorrect: isCorrect,
      timestamp: serverTimestamp(),

      // ✅ 첫 시도 답변 저장 (통계 정확성을 위해)
      isFirstAttempt: isFirstAttempt,
      ...(isFirstAttempt ? {
        firstAttemptAnswer: userAnswer,
        firstAttemptIsCorrect: isCorrect
      } : {}),

      // 📊 학습 분석용 추가 데이터
      timeSpent: questionData?.timeSpent || 0,  // 문제 풀이 소요 시간 (초)
      deviceType: getDeviceType(),  // 디바이스 타입
      viewedExplanation: questionData?.viewedExplanation || false  // 해설 조회 여부
    };

    console.log('시도 기록 저장 중:', attemptData);

    // ✅ 같은 세션, 같은 문제의 기존 attempt 찾기 (답변 변경 시 업데이트)
    let existingAttemptId = null;
    try {
      const attemptsRef = collection(db, 'attempts');

      // 모의고사는 globalIndex로, 일반 문제는 number로 찾기
      let findQuery;
      if (questionData?.globalIndex !== undefined && questionData?.globalIndex !== null) {
        // 모의고사: globalIndex 사용
        findQuery = query(
          attemptsRef,
          where('userId', '==', user.uid),
          where('sessionId', '==', sessionId),
          where('questionData.globalIndex', '==', questionData.globalIndex),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
      } else {
        // 일반 문제: number 사용
        findQuery = query(
          attemptsRef,
          where('userId', '==', user.uid),
          where('sessionId', '==', sessionId),
          where('year', '==', attemptData.year),
          where('subject', '==', attemptData.subject),
          where('number', '==', attemptData.number),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
      }

      const existingSnapshot = await getDocs(findQuery);
      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data();

        // ✅ 이어하기 기능: resumeStartTime 이후의 attempt만 업데이트 (데이터 오염 방지)
        // 이어하기 이전에 저장된 attempt는 건드리지 않고, 이어하기 이후에 새로 선택한 답변만 저장
        if (window.resumeStartTime) {
          const existingTimestamp = existingData.timestamp?.toDate ?
            existingData.timestamp.toDate().getTime() :
            (existingData.timestamp?.seconds ? existingData.timestamp.seconds * 1000 : 0);

          // 이어하기 이전에 저장된 attempt는 건드리지 않음 (새로 생성)
          if (existingTimestamp < window.resumeStartTime) {
            console.log('이어하기 이전의 attempt 발견, 새로 생성합니다 (데이터 오염 방지)');
            existingAttemptId = null; // 새로 생성하도록 설정
          } else {
            existingAttemptId = existingDoc.id;
            console.log('이어하기 이후의 attempt 발견, 업데이트합니다:', existingAttemptId);
          }
        } else {
          // resumeStartTime이 없으면 기존 로직대로 진행
          existingAttemptId = existingDoc.id;
          console.log('기존 attempt 발견, 업데이트합니다:', existingAttemptId);
        }
      }
    } catch (error) {
      // 쿼리 실패 시 (인덱스 없음 등) 새로 생성
      console.warn('기존 attempt 찾기 실패, 새로 생성합니다:', error.message);
    }

    // 기존 attempt가 있으면 업데이트, 없으면 새로 생성
    let resultId;
    if (existingAttemptId) {
      // 기존 attempt 업데이트 (첫 시도 답변은 유지)
      const existingAttemptRef = doc(db, 'attempts', existingAttemptId);
      const existingAttemptDoc = await getDoc(existingAttemptRef);
      const existingData = existingAttemptDoc.data();

      // 첫 시도 답변이 없으면 현재 답변을 첫 시도로 저장
      const updateData = {
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        timestamp: serverTimestamp(),
        timeSpent: attemptData.timeSpent,
        viewedExplanation: attemptData.viewedExplanation
      };

      // 첫 시도 답변이 없으면 현재 답변을 첫 시도로 저장
      if (!existingData.firstAttemptAnswer && isFirstAttempt) {
        updateData.firstAttemptAnswer = userAnswer;
        updateData.firstAttemptIsCorrect = isCorrect;
        updateData.isFirstAttempt = true;
      }

      await updateDoc(existingAttemptRef, updateData);
      resultId = existingAttemptId;
      window.Logger?.debug('기존 시도 기록 업데이트 완료 (첫 시도 답변 유지):', resultId);
    } else {
      // 새 attempt 생성
      const attemptsRef = collection(db, 'attempts');
      const result = await addDoc(attemptsRef, attemptData);
      resultId = result.id;
      window.Logger?.debug('새 시도 기록 저장 완료:', resultId);
    }

    return { success: true, id: resultId, updated: !!existingAttemptId };
  } catch (error) {
    window.Logger?.error('시도 기록 저장 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 문제 풀이 시도를 배치로 저장하는 함수
 * @param {Array} attempts - 시도 기록 배열
 */
export async function batchRecordAttempts(attempts) {
  try {
    // 사용자 정보 확인
    const user = auth.currentUser;
    if (!user) {
      console.warn('사용자가 로그인되어 있지 않습니다.');
      return { success: false, error: '인증 필요' };
    }

    // 현재 세션 ID 확인
    let sessionId = null;
    if (window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
      console.log('배치 처리 세션 ID:', sessionId);
    }

    if (!sessionId) {
      console.warn('유효한 세션 ID가 없습니다. 배치 저장에 임시 세션 ID 사용');
      sessionId = `temp_batch_${Date.now()}_${user.uid.substring(0, 6)}`;
    }

    // 유효성 검사 및 필드 보정
    const validAttempts = [];

    for (const attempt of attempts) {
      // 기본 유효성 검사
      if (!attempt.questionData) {
        console.warn('questionData가 없는 항목 제외');
        continue;
      }

      // number 필드 유효성 검사 및 보정
      if (attempt.questionData.number === undefined) {
        console.warn('number 필드가 undefined인 항목 발견, 기본값 할당');
        attempt.questionData.number = 1; // 기본값 할당
      }

      // 다른 필수 필드 유효성 검사
      if (attempt.questionData.subject === undefined) {
        attempt.questionData.subject = "과목없음";
      }

      if (attempt.questionData.year === undefined) {
        attempt.questionData.year = "2025";
      }

      validAttempts.push(attempt);
    }

    // 유효한 항목이 없으면 종료
    if (validAttempts.length === 0) {
      console.warn('저장할 유효한 데이터가 없습니다.');
      return { success: false, error: '저장할 유효한 데이터가 없습니다' };
    }

    // 배치 객체 생성
    const batch = writeBatch(db);
    const savedIds = [];

    // 각 시도 데이터에 대해
    validAttempts.forEach(attempt => {
      // 고유 ID 생성
      const attemptRef = doc(collection(db, 'attempts'));

      // ✅ 첫 시도 여부 확인 (배치 저장 시에도 적용)
      const isFirstAttempt = attempt.isFirstAttempt !== false &&
        (window.firstAttemptTracking === undefined ||
          window.firstAttemptTracking[attempt.questionData?.globalIndex ?? attempt.questionData?.number - 1] !== false);

      // 시도 데이터 보강 (평탄화 최적화)
      const attemptData = {
        userId: user.uid,
        userName: user.displayName || user.email || '익명',
        userEmail: user.email || '',
        sessionId: sessionId, // 세션 ID 명시적 설정

        // ✅ 평탄화된 필드 (쿼리 최적화용)
        year: attempt.questionData?.year || '2025',
        subject: attempt.questionData?.subject || '과목없음',
        number: attempt.questionData?.number || 1,

        // 🎓 자격증 구분 필드 (NEW)
        certificateType: attempt.questionData?.certificateType || 'health-manager',  // 'health-manager' | 'sports-instructor'

        // 원본 유지 (호환성)
        questionData: attempt.questionData || {},

        userAnswer: attempt.userAnswer,
        isCorrect: attempt.isCorrect,
        timestamp: serverTimestamp(),

        // ✅ 첫 시도 답변 저장 (통계 정확성을 위해)
        isFirstAttempt: isFirstAttempt,
        ...(isFirstAttempt ? {
          firstAttemptAnswer: attempt.userAnswer,
          firstAttemptIsCorrect: attempt.isCorrect
        } : {}),

        // 📊 학습 분석용 추가 데이터
        timeSpent: attempt.timeSpent || 0,  // 문제 풀이 소요 시간 (초)
        deviceType: getDeviceType(),  // 디바이스 타입
        viewedExplanation: attempt.viewedExplanation || false  // 해설 조회 여부
      };

      // 배치에 추가
      batch.set(attemptRef, attemptData);
      savedIds.push(attemptRef.id);
    });

    // 배치 실행 (성능 측정)
    const startTime = performance.now();
    await batch.commit();
    const duration = (performance.now() - startTime).toFixed(0);

    console.log(`⚡ ${validAttempts.length}개 시도 기록 배치 저장 완료: ${duration}ms`);

    // 세션 업데이트 - 배치 기록 이후 세션에 문제 시도 수 업데이트
    try {
      if (window.sessionManager && sessionId) {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          attemptCount: increment(validAttempts.length),
          lastUpdated: serverTimestamp()
        });
        console.log('세션 정보 업데이트 완료:', sessionId);
      }
    } catch (sessionUpdateError) {
      console.warn('세션 업데이트 오류 (무시됨):', sessionUpdateError);
    }

    return {
      success: true,
      count: validAttempts.length,
      ids: savedIds,
      sessionId: sessionId
    };
  } catch (error) {
    console.error('배치 저장 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 사용자 진행 정보 업데이트
 * @param {Object} questionData - 문제 데이터
 * @param {boolean} isCorrect - 정답 여부
 * @param {string} sessionId - 세션 ID
 * @private
 */
async function updateUserProgress(questionData, isCorrect, sessionId) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 사용자 진행 정보 문서 참조
    const progressRef = doc(db, 'userProgress', user.uid);

    // 문서 존재 여부 확인
    const progressDoc = await getDoc(progressRef);

    // 현재 시간
    const now = new Date();

    if (!progressDoc.exists()) {
      // 문서가 없으면 기본 구조로 생성
      await setDoc(progressRef, {
        userId: user.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        subjectProgress: {},
        yearlyMockExams: {}
      });
    }

    // 문제 데이터에서 필요한 정보 추출
    const year = questionData.year || now.getFullYear().toString();
    const subject = questionData.subject || '알 수 없음';
    const isFromMockExam = questionData.isFromMockExam || false;
    const mockExamPart = questionData.mockExamPart || '1';

    // 업데이트 데이터 생성
    const updateData = {
      lastUpdated: serverTimestamp()
    };

    if (isFromMockExam) {
      // 모의고사인 경우 yearlyMockExams 업데이트
      const yearKey = `yearlyMockExams.${year}`;
      const partKey = `교시${mockExamPart}`;
      const mockExamKey = `${yearKey}.${partKey}`;

      // 모의고사 진행 정보 업데이트
      updateData[`${mockExamKey}.completed`] = true;
      updateData[`${mockExamKey}.lastAttempted`] = serverTimestamp();

      // 정답 여부에 따른 필드 업데이트
      if (isCorrect) {
        updateData[`${mockExamKey}.correctCount`] = increment(1);
      }
      updateData[`${mockExamKey}.totalQuestions`] = increment(1);

      // 최근 세션 정보 업데이트
      updateData[`${mockExamKey}.recentSessions`] = [
        {
          sessionId: sessionId,
          timestamp: now.toISOString()
        }
      ];

      // 정확도 필드는 외부에서 업데이트
    } else {
      // 일반 문제인 경우 subjectProgress 업데이트
      const subjectKey = `${year}_${subject}`;
      const progressKey = `subjectProgress.${subjectKey}`;

      // 기본 필드 업데이트
      updateData[`${progressKey}.lastAccessed`] = serverTimestamp();
      updateData[`${progressKey}.completed`] = increment(1);

      // 정답 여부에 따른 필드 업데이트
      if (isCorrect) {
        updateData[`${progressKey}.correctCount`] = increment(1);
      }

      // 최근 세션 정보 업데이트
      updateData[`${progressKey}.recentSessions`] = [
        {
          sessionId: sessionId,
          timestamp: now.toISOString()
        }
      ];
    }

    // Firestore 업데이트
    await updateDoc(progressRef, updateData);
  } catch (error) {
    console.error('사용자 진행 정보 업데이트 오류:', error);
  }
}

/**
 * 사용자 통계 정보 업데이트
 * @param {Object} questionData - 문제 데이터
 * @param {boolean} isCorrect - 정답 여부
 * @private
 */
async function updateUserStatistics(questionData, isCorrect) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 사용자 통계 정보 문서 참조
    const statsRef = doc(db, 'userStatistics', user.uid);

    // 문서 존재 여부 확인
    const statsDoc = await getDoc(statsRef);

    if (!statsDoc.exists()) {
      // 문서가 없으면 기본 구조로 생성
      await setDoc(statsRef, {
        userId: user.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        totalAttempts: 0,
        totalCorrect: 0,
        accuracyRate: 0,
        subjectStats: {},
        recentActivities: []
      });
    }

    // 문제 데이터에서 필요한 정보 추출
    const subject = questionData.subject || '알 수 없음';
    const isFromMockExam = questionData.isFromMockExam || false;

    // 과목 키 결정 (모의고사는 접두어 추가)
    const subjectKey = isFromMockExam ? `mock_${subject}` : subject;

    // 업데이트 데이터 생성
    const updateData = {
      lastUpdated: serverTimestamp(),
      totalAttempts: increment(1)
    };

    // 정답 여부에 따른 필드 업데이트
    if (isCorrect) {
      updateData.totalCorrect = increment(1);
    }

    // 과목별 통계 업데이트
    updateData[`subjectStats.${subjectKey}.attempts`] = increment(1);
    if (isCorrect) {
      updateData[`subjectStats.${subjectKey}.correct`] = increment(1);
    }

    // 최근 활동 추가 (필드 배열 업데이트는 별도 로직 필요)

    // Firestore 업데이트
    await updateDoc(statsRef, updateData);

    // 정확도 업데이트 (증가 연산 후 계산 필요)
    const updatedDoc = await getDoc(statsRef);
    if (updatedDoc.exists()) {
      const data = updatedDoc.data();

      // 전체 정확도 계산
      const totalAccuracy = data.totalAttempts > 0
        ? Math.round((data.totalCorrect / data.totalAttempts) * 100)
        : 0;

      // 과목별 정확도 계산
      const subjectData = data.subjectStats[subjectKey] || { attempts: 0, correct: 0 };
      const subjectAccuracy = subjectData.attempts > 0
        ? Math.round((subjectData.correct / subjectData.attempts) * 100)
        : 0;

      // 정확도 필드 업데이트
      await updateDoc(statsRef, {
        accuracyRate: totalAccuracy,
        [`subjectStats.${subjectKey}.accuracyRate`]: subjectAccuracy
      });
    }
  } catch (error) {
    console.error('사용자 통계 정보 업데이트 오류:', error);
  }
}

/**
 * 세션 통계 업데이트
 * @param {string} sessionId - 세션 ID
 * @private
 */
async function updateSessionStatistics(sessionId) {
  // 세션 업데이트 일시 중단
  return; // 일시적으로 함수 실행 건너뛰기

  // 기존 로직은 유지하되 실행되지 않도록 함
  if (!sessionId) return;

  try {
    // 세션 문서 참조
    const sessionRef = doc(db, 'sessions', sessionId);

    // 세션에 속한 모든 시도 쿼리
    const attemptsQuery = query(
      collection(db, 'attempts'),
      where('sessionId', '==', sessionId)
    );

    // 쿼리 실행
    const snapshot = await getDocs(attemptsQuery);

    // 통계 계산
    let attemptedQuestions = 0;
    let correctAnswers = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      attemptedQuestions++;
      if (data.isCorrect) {
        correctAnswers++;
      }
    });

    // 세션 업데이트
    await updateDoc(sessionRef, {
      totalQuestions: attemptedQuestions,
      attemptedQuestions: attemptedQuestions,
      correctAnswers: correctAnswers,
      accuracy: attemptedQuestions > 0 ? Math.round((correctAnswers / attemptedQuestions) * 100) : 0,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error('세션 통계 업데이트 오류:', error);
  }
}

/**
 * 모의고사 결과 기록
 * @param {Object} resultData - 모의고사 결과 데이터
 * @returns {Promise<Object>} 기록 결과
 */
export async function recordMockExamResults(resultData) {
  try {
    // 유저 정보 확인
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인 상태가 아닙니다. 모의고사 결과가 저장되지 않습니다.');
      return { success: false, reason: 'not-logged-in' };
    }

    // 현재 세션 ID 가져오기 (없으면 새로 생성)
    let sessionId = sessionManager.getCurrentSessionId();
    if (!sessionId) {
      const newSession = await sessionManager.startNewSession();
      sessionId = newSession.id;
    }

    // 기본 결과 데이터 구성
    const mockExamResultData = {
      ...resultData,
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || resultData.userName || '익명',
      sessionId: sessionId,
      // 🎓 자격증 구분 필드 (NEW)
      certificateType: resultData.certificateType || 'health-manager',  // 'health-manager' | 'sports-instructor'
      timestamp: serverTimestamp(),
      submittedAt: new Date().toISOString()
    };

    // subjectResults가 있는 경우 과목별 정답률 계산
    if (mockExamResultData.subjectResults) {
      const subjectResults = mockExamResultData.subjectResults;

      Object.keys(subjectResults).forEach(subject => {
        const subjectData = subjectResults[subject];
        if (subjectData.total > 0) {
          subjectData.accuracy = Math.round((subjectData.correct / subjectData.total) * 100);
        } else {
          subjectData.accuracy = 0;
        }
      });
    }

    // Firestore에 결과 저장
    const resultRef = await addDoc(collection(db, 'mockExamResults'), mockExamResultData);

    // 세션 종료 처리
    await sessionManager.endSession({
      totalQuestions: mockExamResultData.totalQuestions,
      attemptedQuestions: mockExamResultData.totalQuestions, // 모의고사는 모든 문제 시도로 간주
      correctAnswers: mockExamResultData.correctCount,
      mockExamResultId: resultRef.id
    });

    // 사용자 진행 정보 업데이트
    await updateMockExamProgress(mockExamResultData);

    return {
      success: true,
      id: resultRef.id,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('모의고사 결과 기록 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 모의고사 진행 정보 업데이트
 * @param {Object} resultData - 모의고사 결과 데이터
 * @private
 */
async function updateMockExamProgress(resultData) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 사용자 진행 정보 문서 참조
    const progressRef = doc(db, 'userProgress', user.uid);

    // 문서 존재 여부 확인
    const progressDoc = await getDoc(progressRef);

    if (!progressDoc.exists()) {
      // 문서가 없으면 기본 구조로 생성
      await setDoc(progressRef, {
        userId: user.uid,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        subjectProgress: {},
        yearlyMockExams: {}
      });
    }

    // 결과 데이터에서 필요한 정보 추출
    const year = resultData.year || new Date().getFullYear().toString();
    // ✅ 기존 데이터 호환성: 여러 필드명 확인 및 문자열 변환
    const hour = String(resultData.hour || resultData.mockExamHour || resultData.mockExamPart || '1');

    // 업데이트 데이터 생성
    const updateData = {
      lastUpdated: serverTimestamp()
    };

    // 모의고사 진행 정보 업데이트
    const yearKey = `yearlyMockExams.${year}`;
    const partKey = `교시${hour}`;
    const mockExamKey = `${yearKey}.${partKey}`;

    updateData[`${mockExamKey}.completed`] = true;
    updateData[`${mockExamKey}.lastAttempted`] = serverTimestamp();
    updateData[`${mockExamKey}.score`] = resultData.score;
    updateData[`${mockExamKey}.correctCount`] = resultData.correctCount;
    updateData[`${mockExamKey}.totalQuestions`] = resultData.totalQuestions;
    updateData[`${mockExamKey}.accuracy`] = resultData.score;

    // 과목별 결과 추가
    if (resultData.subjectResults) {
      updateData[`${mockExamKey}.subjects`] = resultData.subjectResults;
    }

    // 최근 세션 정보 업데이트
    if (resultData.sessionId) {
      updateData[`${mockExamKey}.recentSessions`] = [
        {
          sessionId: resultData.sessionId,
          timestamp: new Date().toISOString(),
          score: resultData.score
        }
      ];
    }

    // Firestore 업데이트
    await updateDoc(progressRef, updateData);
  } catch (error) {
    console.error('모의고사 진행 정보 업데이트 오류:', error);
  }
}

// == 데이터 조회 함수 ==

/**
 * 사용자의 문제 풀이 시도 기록 가져오기
 * @param {number} [maxCount=50] - 가져올 기록 수
 * @returns {Promise<Array>} 시도 기록 배열
 */
export async function getUserAttempts(maxCount = 50) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return [];
    }

    // 시도 기록 쿼리 (limit 제거)
    const attemptsQuery = query(
      collection(db, 'attempts'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    // 쿼리 실행
    const snapshot = await getDocs(attemptsQuery);

    // 결과 변환 (JavaScript에서 제한)
    const attempts = [];
    let count = 0;

    snapshot.forEach(doc => {
      // 최대 개수 제한 확인
      if (count >= maxCount) return;

      const data = doc.data();
      // 타임스탬프 처리
      const timestamp = data.timestamp?.toDate?.() || new Date();

      attempts.push({
        id: doc.id,
        ...data,
        timestamp: timestamp
      });

      count++;
    });

    return attempts;
  } catch (error) {
    console.error('시도 기록 조회 오류:', error);
    return [];
  }
}

/**
 * 사용자의 모의고사 결과 가져오기
 * @param {number} [maxCount=10] - 가져올 결과 수
 * @returns {Promise<Array>} 모의고사 결과 배열
 */
export async function getUserMockExamResults(maxCount = 10) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return [];
    }

    // 모의고사 결과 쿼리 (limit 제거)
    const resultsQuery = query(
      collection(db, 'mockExamResults'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    // 쿼리 실행
    const snapshot = await getDocs(resultsQuery);

    // 결과 변환 (JavaScript에서 제한)
    const results = [];
    let count = 0;

    snapshot.forEach(doc => {
      // 최대 개수 제한 확인
      if (count >= maxCount) return;

      const data = doc.data();
      // 타임스탬프 처리
      const timestamp = data.timestamp?.toDate?.() || new Date();

      results.push({
        id: doc.id,
        ...data,
        timestamp: timestamp
      });

      count++;
    });

    return results;
  } catch (error) {
    console.error('모의고사 결과 조회 오류:', error);
    return [];
  }
}

/**
 * 사용자의 학습 진행률 가져오기
 * @returns {Promise<Object|null>} 진행률 데이터
 */
export async function getUserProgress() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return null;
    }

    // 진행 정보 문서 가져오기
    const progressDoc = await getDoc(doc(db, 'userProgress', user.uid));

    if (!progressDoc.exists()) {
      return null;
    }

    return progressDoc.data();
  } catch (error) {
    // 권한 오류인 경우 조용히 처리 (Firestore 보안 규칙 문제일 수 있음)
    if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
      console.log('진행률 조회 권한이 없습니다.');
      return null;
    }
    console.error('진행률 조회 오류:', error);
    return null;
  }
}

/**
 * 사용자의 학습 통계 가져오기
 * @returns {Promise<Object|null>} 통계 데이터
 */
export async function getUserStatistics() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return null;
    }

    // 통계 정보 문서 가져오기
    const statsDoc = await getDoc(doc(db, 'userStatistics', user.uid));

    if (!statsDoc.exists()) {
      return null;
    }

    return statsDoc.data();
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return null;
  }
}

/**
 * 사용자의 문제풀이기록(세트) 목록 가져오기
 * @returns {Promise<Array>} 문제풀이기록 세트 배열
 */
export async function getUserQuestionSets() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('로그인이 필요합니다.');
      return [];
    }

    // 세션 목록 가져오기 (문제풀이기록 세트 정보로 사용)
    const sessions = await sessionManager.getUserSessions(20);

    // 세션 기반 문제풀이기록 세트 그룹화
    const setMap = {};

    for (const session of sessions) {
      // 세션 정보로 세트 키 생성
      const year = session.year || 'unknown';
      const subject = session.subject || 'unknown';
      const isFromMockExam = session.type === 'mockexam';
      const mockExamPart = session.mockExamPart || '1';

      // 세트 키 (모의고사는 별도 형식)
      const setKey = isFromMockExam
        ? `${year}_모의고사_${mockExamPart}교시`
        : `${year}_${subject}`;

      // 세트 맵에 추가
      if (!setMap[setKey]) {
        setMap[setKey] = {
          id: setKey,
          year: year,
          subject: isFromMockExam ? `모의고사 ${mockExamPart}교시` : subject,
          title: isFromMockExam ? `${year}년 모의고사 ${mockExamPart}교시` : `${year}년 ${subject}`,
          type: isFromMockExam ? 'mockexam' : 'regular',
          mockExamPart: isFromMockExam ? mockExamPart : null,
          isFromMockExam: isFromMockExam,
          sessions: [],
          lastAttempted: new Date(0)
        };
      }

      // 세션 정보 추가
      setMap[setKey].sessions.push({
        sessionId: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        totalQuestions: session.totalQuestions || 0,
        correctAnswers: session.correctAnswers || 0,
        accuracy: session.accuracy || 0
      });

      // 최근 시도 시간 업데이트
      const sessionTime = session.startTime?.toDate?.() || session.startTime || new Date(0);
      if (sessionTime > setMap[setKey].lastAttempted) {
        setMap[setKey].lastAttempted = sessionTime;
      }
    }

    // 세트 배열로 변환 및 정렬
    const sets = Object.values(setMap);
    sets.sort((a, b) => b.lastAttempted - a.lastAttempted);

    return sets;
  } catch (error) {
    console.error('문제풀이기록 세트 조회 오류:', error);
    return [];
  }
}

/**
 * 사용자의 모든 학습 데이터 가져오기 (통합 API)
 * @returns {Promise<Object>} 통합 학습 데이터
 */
export async function getUserLearningStatus() {
  try {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: '로그인이 필요합니다.'
      };
    }

    // 병렬로 모든 데이터 가져오기
    const [attempts, mockExamResults, userProgress, userStats] = await Promise.all([
      getUserAttempts(100),
      getUserMockExamResults(20),
      getUserProgress(),
      getUserStatistics()
    ]);

    return {
      success: true,
      userId: user.uid,
      userName: user.displayName,
      timestamp: new Date(),
      attempts,
      mockExamResults,
      userProgress,
      userStats
    };
  } catch (error) {
    console.error('학습 데이터 조회 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 기능을 바로 사용하도록 전역 변수로 등록
if (typeof window !== 'undefined') {
  window.recordAttempt = recordAttempt;
  window.recordMockExamResults = recordMockExamResults;
  window.getUserLearningStatus = getUserLearningStatus;
  window.batchRecordAttempts = batchRecordAttempts;
  if (window.isDevMode && window.isDevMode()) {
    console.log('quiz-repository 함수들이 전역에 노출되었습니다:', {
      recordAttempt: typeof recordAttempt,
      recordMockExamResults: typeof recordMockExamResults,
      batchRecordAttempts: typeof batchRecordAttempts
    });
  }
}