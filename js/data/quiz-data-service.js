// quiz-data-service.js - 통합 학습 데이터 및 분석 서비스 (패치 버전)

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { db, auth } from "../core/firebase-core.js";
import { isUserLoggedIn } from "../auth/auth-utils.js";

function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

/**
 * 단일 문제 풀이 결과 기록 (향상된 버전)
 * @param {Object} questionData - 문제 데이터 (과목, 번호 등)
 * @param {number} userAnswer - 사용자가 선택한 답변 (0부터 시작)
 * @param {boolean} isCorrect - 정답 여부
 * @returns {Promise<Object>} 성공 여부 및 결과 데이터
 */
export async function recordAttempt(questionData, userAnswer, isCorrect) {
  try {
    console.log('[quiz-data-service] 문제 풀이 저장 시도:', { questionData, userAnswer, isCorrect });

    // 사용자 인증 확인
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 문제 풀이 저장 실패: 사용자가 로그인하지 않았습니다.');
      return { success: false, error: "사용자가 로그인하지 않았습니다." };
    }

    // 필수 데이터 유효성 검사
    if (!questionData) {
      console.error('[quiz-data-service] 문제 풀이 저장 실패: 필수 데이터가 누락되었습니다.');
      return { success: false, error: "필수 데이터가 누락되었습니다." };
    }

    const detectedMockExam =
      questionData.isFromMockExam === true ||
      questionData.type === "mockexam" ||
      questionData.mockExamHour != null ||
      questionData.mockExamPart != null ||
      questionData.hour != null ||
      questionData.examHour != null;

    const normalizedHour = String(
      questionData.mockExamHour ??
      questionData.mockExamPart ??
      questionData.hour ??
      questionData.examHour ??
      ""
    );

    // 필드 데이터 정규화 (undefined 및 null 값 처리)
    const normalizedData = {
      year: questionData.year || new Date().getFullYear().toString(),
      subject: questionData.subject || "알 수 없음",
      number: questionData.number || 0,
      isFromMockExam: detectedMockExam,
      mockExamPart: normalizedHour || null,
      mockExamHour: normalizedHour || null,
      hour: normalizedHour || null,
      type: detectedMockExam ? "mockexam" : "regular",
      globalIndex: questionData.globalIndex ?? null
    };

    // ✅ 세션 ID 가져오기 (같은 세션에서 업데이트하기 위해 필요)
    let sessionId = null;
    if (window.sessionManager) {
      sessionId = window.sessionManager.getCurrentSessionId();
    }
    if (!sessionId) {
      sessionId = localStorage.getItem('currentSessionId');
    }
    if (!sessionId && window.sessionManager?.startNewSession) {
      const sessionMetadata = compactObject({
        subject: normalizedData.subject,
        year: normalizedData.year,
        type: detectedMockExam ? "mockexam" : "regular",
        hour: normalizedHour || undefined,
        certificateType: questionData.certificateType || "health-manager",
        setId: questionData.setId,
        questionNumber: normalizedData.number
      });
      try {
        const session = await window.sessionManager.startNewSession(sessionMetadata);
        if (session?.id) {
          sessionId = session.id;
        }
      } catch (sessionError) {
        console.warn("[quiz-data-service] 세션 생성 실패, 세션 없이 시도 기록 저장:", sessionError);
      }
    }

    // ✅ 첫 시도 여부 확인
    const isFirstAttempt = questionData?.isFirstAttempt !== false &&
      (window.firstAttemptTracking === undefined ||
        window.firstAttemptTracking[questionData?.number - 1] !== false);

    // 문제 풀이 기록 생성
    const attemptData = {
      userId: user.uid,
      timestamp: serverTimestamp(),
      questionData: normalizedData,
      userAnswer: userAnswer !== undefined ? userAnswer : -1, // -1은 미응답
      isCorrect: !!isCorrect, // Boolean으로 강제 변환
      sessionId: sessionId, // ✅ 세션 ID 추가
      // ✅ 첫 시도 답변 저장 (통계 정확성을 위해)
      isFirstAttempt: isFirstAttempt,
      ...(isFirstAttempt ? {
        firstAttemptAnswer: userAnswer !== undefined ? userAnswer : -1,
        firstAttemptIsCorrect: !!isCorrect
      } : {}),
      // 메타데이터
      userName: user.displayName || user.email || "알 수 없음",
      userEmail: user.email || "",
      device: navigator.userAgent,
      source: window.location.pathname,
      // 세트 데이터 - 있을 경우 문제풀이기록 세트 정보 기록
      setId: questionData.setId || null,
      setType: questionData.setType || (detectedMockExam ? "mockexam" : "regular")
    };

    console.log('[quiz-data-service] Firestore에 저장할 데이터:', attemptData);

    // ✅ 같은 세션, 같은 문제의 기존 attempt 찾기 (답변 변경 시 업데이트)
    let existingAttemptId = null;
    try {
      const attemptsRef = collection(db, "attempts");

      // 일반 문제는 number로 찾기 (quiz-data-service는 주로 일반 문제용)
      // 세션 ID가 있으면 세션으로 필터링, 없으면 전체에서 찾기
      let findQuery;
      if (sessionId) {
        // 세션 ID가 있으면 세션으로 필터링
        findQuery = query(
          attemptsRef,
          where("userId", "==", user.uid),
          where("sessionId", "==", sessionId),
          where("questionData.year", "==", normalizedData.year),
          where("questionData.subject", "==", normalizedData.subject),
          where("questionData.number", "==", normalizedData.number),
          orderBy("timestamp", "desc"),
          limit(1)
        );
      } else {
        // 세션 ID가 없으면 전체에서 찾기
        findQuery = query(
          attemptsRef,
          where("userId", "==", user.uid),
          where("questionData.year", "==", normalizedData.year),
          where("questionData.subject", "==", normalizedData.subject),
          where("questionData.number", "==", normalizedData.number),
          orderBy("timestamp", "desc"),
          limit(1)
        );
      }

      const existingSnapshot = await getDocs(findQuery);
      if (!existingSnapshot.empty) {
        existingAttemptId = existingSnapshot.docs[0].id;
        console.log('[quiz-data-service] 기존 attempt 발견, 업데이트합니다:', existingAttemptId);
      }
    } catch (error) {
      // 쿼리 실패 시 (인덱스 없음 등) 새로 생성
      console.warn('[quiz-data-service] 기존 attempt 찾기 실패, 새로 생성합니다:', error.message);
    }

    // 기존 attempt가 있으면 업데이트, 없으면 새로 생성
    let attemptId;
    if (existingAttemptId) {
      // 기존 attempt 업데이트 (첫 시도 답변은 유지)
      const existingAttemptRef = doc(db, "attempts", existingAttemptId);
      const existingAttemptDoc = await getDoc(existingAttemptRef);
      const existingData = existingAttemptDoc.data();

      // 첫 시도 답변이 없으면 현재 답변을 첫 시도로 저장
      const updateData = {
        userAnswer: userAnswer !== undefined ? userAnswer : -1,
        isCorrect: !!isCorrect,
        timestamp: serverTimestamp()
      };

      // 첫 시도 답변이 없으면 현재 답변을 첫 시도로 저장
      if (!existingData.firstAttemptAnswer && isFirstAttempt) {
        updateData.firstAttemptAnswer = userAnswer !== undefined ? userAnswer : -1;
        updateData.firstAttemptIsCorrect = !!isCorrect;
        updateData.isFirstAttempt = true;
      }

      await updateDoc(existingAttemptRef, updateData);
      attemptId = existingAttemptId;
      console.log('[quiz-data-service] 기존 시도 기록 업데이트 완료 (첫 시도 답변 유지):', attemptId);
    } else {
      // 새 attempt 생성
      const attemptRef = await addDoc(collection(db, "attempts"), attemptData);
      attemptId = attemptRef.id;
      console.log('[quiz-data-service] 새 시도 기록 저장 완료:', attemptId);
    }

    console.log('[quiz-data-service] Firebase에 문제 풀이 결과 저장 성공:', { attemptId: attemptId });

    // 사용자 통계 업데이트
    await updateUserStatistics(user.uid, normalizedData.subject, isCorrect);
    console.log('[quiz-data-service] 사용자 통계 업데이트 완료', { subject: normalizedData.subject, isCorrect });

    // 문제풀이기록 세트 진행 상황 업데이트 (세트 ID가 있는 경우)
    if (questionData.setId) {
      await updateQuestionSetProgress(user.uid, questionData.setId, isCorrect);
      console.log('[quiz-data-service] 문제풀이기록 세트 진행 상황 업데이트 완료', { setId: questionData.setId });
    }

    // 이벤트 디스패치 - 다른 모듈 알림
    document.dispatchEvent(new CustomEvent('attemptSaved', {
      detail: {
        attemptId: attemptId,
        ...attemptData
      }
    }));

    return {
      success: true,
      attemptId: attemptId,
      data: attemptData,
      updated: !!existingAttemptId
    };
  } catch (error) {
    console.error("[quiz-data-service] 문제 풀이 기록 오류:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 사용자 통계 업데이트 (수정된 버전)
 * @param {string} userId - 사용자 ID
 * @param {string} subject - 과목명
 * @param {boolean} isCorrect - 정답 여부
 */
async function updateUserStatistics(userId, subject, isCorrect) {
  try {
    if (!subject || typeof subject !== 'string') {
      console.warn('[quiz-data-service] 유효하지 않은 과목명:', subject);
      subject = '알 수 없음';
    }

    // 현재 사용자 통계 데이터 가져오기
    const userStatRef = doc(db, "userStatistics", userId);
    const userStatDoc = await getDoc(userStatRef);

    let userData;
    let subjectStats = {};
    let totalStats = { totalAttempts: 0, correctAttempts: 0 };

    // 기존 데이터가 있으면 활용
    if (userStatDoc.exists()) {
      userData = userStatDoc.data();
      subjectStats = userData.subjectStats || {};
      totalStats = userData.totalStats || totalStats;
    }

    // 과목별 통계 업데이트
    const currentSubjectStats = subjectStats[subject] || {
      totalAttempts: 0,
      correctAttempts: 0,
      lastAttempt: null
    };

    // 통계 업데이트
    currentSubjectStats.totalAttempts += 1;
    if (isCorrect) {
      currentSubjectStats.correctAttempts += 1;
    }
    currentSubjectStats.lastAttempt = serverTimestamp();

    // 정답률 계산
    currentSubjectStats.accuracyRate =
      Math.round((currentSubjectStats.correctAttempts / currentSubjectStats.totalAttempts) * 100);

    // 새로운 과목 통계로 업데이트
    subjectStats[subject] = currentSubjectStats;

    // 총 통계 업데이트
    totalStats.totalAttempts += 1;
    if (isCorrect) {
      totalStats.correctAttempts += 1;
    }
    totalStats.accuracyRate =
      Math.round((totalStats.correctAttempts / totalStats.totalAttempts) * 100);

    // 문서 업데이트 또는 생성 (setDoc 사용으로 수정)
    await setDoc(userStatRef, {
      userId: userId,
      subjectStats: subjectStats,
      totalStats: totalStats,
      lastUpdated: serverTimestamp(),
      createdAt: userData?.createdAt || serverTimestamp()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("[quiz-data-service] 사용자 통계 업데이트 오류:", error);
    return false;
  }
}

/**
 * 문제풀이기록 세트 진행 상황 업데이트 (수정된 버전)
 * @param {string} userId - 사용자 ID
 * @param {string} setId - 문제풀이기록 세트 ID
 * @param {boolean} isCorrect - 정답 여부
 */
async function updateQuestionSetProgress(userId, setId, isCorrect) {
  try {
    // 문제풀이기록 세트 참조
    const setRef = doc(db, "questionSets", setId);
    const setDoc = await getDoc(setRef);

    if (!setDoc.exists()) {
      console.warn(`[quiz-data-service] 문제풀이기록 세트를 찾을 수 없습니다: ${setId}`);
      return false;
    }

    // 기존 데이터 가져오기
    const setData = setDoc.data();

    // 사용자별 진행 상황이 없으면 생성
    if (!setData.userProgress) {
      setData.userProgress = {};
    }

    // 해당 사용자의 진행 상황이 없으면 초기화
    if (!setData.userProgress[userId]) {
      setData.userProgress[userId] = {
        completed: 0,
        correct: 0,
        lastUpdated: null
      };
    }

    // 진행 상황 업데이트
    const userProgress = setData.userProgress[userId];
    userProgress.completed += 1;
    if (isCorrect) {
      userProgress.correct += 1;
    }
    userProgress.lastUpdated = serverTimestamp();

    // 정확도 계산
    if (userProgress.completed > 0) {
      userProgress.accuracy = Math.round((userProgress.correct / userProgress.completed) * 100);
    }

    // updateDoc 사용하여 업데이트
    await updateDoc(setRef, {
      [`userProgress.${userId}`]: userProgress
    });

    return true;
  } catch (error) {
    console.error("[quiz-data-service] 문제풀이기록 세트 진행 상황 업데이트 오류:", error);
    return false;
  }
}

/**
 * 모의고사 결과를 한번에 기록 (개선된 버전)
 * @param {Object} resultData - 모의고사 결과 데이터
 * @returns {Promise<Object>} 성공 여부 및 결과 ID
 */
export async function recordMockExamResults(resultData) {
  try {
    console.log('[quiz-data-service] 모의고사 결과 저장 시도:', resultData);

    // 사용자 인증 확인
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 모의고사 결과 저장 실패: 사용자가 로그인하지 않았습니다.');
      return { success: false, error: "사용자가 로그인하지 않았습니다." };
    }

    // 필수 데이터 유효성 검사
    if (!resultData || !resultData.subjectResults) {
      console.error('[quiz-data-service] 모의고사 결과 저장 실패: 필수 데이터가 누락되었습니다.');
      return { success: false, error: "필수 모의고사 데이터가 누락되었습니다." };
    }

    // 고유 ID 생성
    const timestamp = Date.now();
    const examId = resultData.examId || `mockexam_${resultData.year || new Date().getFullYear()}_${resultData.hour || 1}_${timestamp}`;

    // 모의고사 결과 데이터 구성
    const mockExamData = {
      userId: user.uid,
      userName: user.displayName || user.email || "사용자",
      timestamp: serverTimestamp(),
      title: resultData.examTitle || `모의고사 ${new Date().toLocaleDateString()}`,
      type: "mockExam",
      reference: `${resultData.year}_${resultData.mockExamHour || resultData.hour}교시`,
      totalQuestions: resultData.totalQuestions || 0,
      correctCount: resultData.correctCount || 0,
      score: resultData.score || 0,
      duration: calculateDurationFromCompletionTime(resultData.completionTime),
      completed: true,
      // 모의고사 특정 데이터
      examId: examId,
      year: resultData.year || new Date().getFullYear().toString(),
      mockExamHour: resultData.hour || "1",
      certificateType: resultData.certificateType || "health-manager",
      completionTime: resultData.completionTime || "00:00",
      subjectResults: resultData.subjectResults || {},
      subjects: resultData.subjects || []
    };

    // Firestore에 저장
    const examResultRef = await addDoc(collection(db, "mockExamResults"), mockExamData);
    console.log('[quiz-data-service] 모의고사 결과 저장 성공:', examResultRef.id);

    // 사용자 학습 진행률 업데이트
    await updateUserProgress(user.uid, mockExamData);
    console.log('[quiz-data-service] 사용자 학습 진행률 업데이트 완료');

    // 이벤트 디스패치 - 다른 모듈 알림
    document.dispatchEvent(new CustomEvent('mockExamResultSaved', {
      detail: {
        examId: examId,
        resultId: examResultRef.id,
        ...mockExamData
      }
    }));

    return {
      success: true,
      examId: examId,
      resultId: examResultRef.id
    };
  } catch (error) {
    console.error("[quiz-data-service] 모의고사 결과 저장 오류:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 사용자의 학습 상태 정보 가져오기 (개선됨)
 * @returns {Promise<Object>} 사용자 학습 상태 정보
 */
export async function getUserLearningStatus() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 학습 상태 조회 실패: 사용자가 로그인하지 않았습니다.');
      return { success: false, error: "사용자가 로그인하지 않았습니다." };
    }

    // 모든 쿼리를 한 번에 병렬 실행 (순차 호출 제거)
    const [attempts, mockExamResults, userProgress, userStats, questionSets] = await Promise.all([
      getUserAttempts(60),         // 100 → 60: 분석에 충분하며 payload 감소
      getUserMockExamResults(20),
      getUserProgress(),
      getUserStatistics(),
      getUserQuestionSets()         // 기존: 별도 순차 호출 → 병렬로 통합
    ]);

    return {
      success: true,
      attempts,
      mockExamResults,
      userProgress,
      userStats,
      questionSets,                 // questionSets도 함께 반환
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error("[quiz-data-service] 학습 상태 정보 조회 오류:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 사용자의 문제 풀이 기록 가져오기 (페이지네이션, 최대 3000개)
 * @param {number} count - 가져올 기록 수 (certificateType 필터 적용 후 기준)
 * @param {string|null} certificateType - 필터링할 자격증 타입 (null이면 모두 가져옴)
 * @returns {Promise<Array>} 문제 풀이 기록 배열
 */
export async function getUserAttempts(count = 50, certificateType = null) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 문제 풀이 기록 조회 실패: 사용자가 로그인하지 않았습니다.');
      return [];
    }

    // ⚠️ certificateType 필터는 클라이언트에서 적용 (기존 데이터 호환)
    // 페이지네이션: 500개씩 최대 3000개까지 읽어 필터 후 count개 반환
    const PAGE_SIZE = 500;
    const MAX_FETCH = 3000;
    const results = [];
    let lastDoc = null;
    let totalFetched = 0;

    while (totalFetched < MAX_FETCH) {
      const constraints = [
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        ...(lastDoc ? [startAfter(lastDoc)] : []),
        limit(PAGE_SIZE)
      ];

      const snapshot = await getDocs(query(collection(db, "attempts"), ...constraints));
      if (snapshot.empty) break;

      totalFetched += snapshot.docs.length;

      for (const d of snapshot.docs) {
        const data = d.data();
        const attempt = { id: d.id, ...data, timestamp: data.timestamp?.toDate() || new Date() };
        if (!certificateType || (attempt.certificateType || 'health-manager') === certificateType) {
          results.push(attempt);
          if (results.length >= count) break;
        }
      }

      if (results.length >= count) break;
      if (snapshot.docs.length < PAGE_SIZE) break; // 마지막 페이지

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    if (totalFetched >= MAX_FETCH && results.length < count) {
      console.warn(`[quiz-data-service] 최대 조회 한도(${MAX_FETCH}개) 도달. ${results.length}개 반환 (요청: ${count}개)`);
    }

    console.log(`[quiz-data-service] 문제 풀이 기록 ${results.length}개 로드 (Firestore 읽기: ${totalFetched}개${certificateType ? `, 자격증: ${certificateType}` : ''})`);
    return results;
  } catch (error) {
    console.error("[quiz-data-service] 문제 풀이 기록 조회 오류:", error);
    return [];
  }
}

/**
 * 사용자의 최근 모의고사 결과 가져오기 (수정)
 * @param {number} count - 가져올 결과 수
 * @param {string|null} certificateType - 필터링할 자격증 타입 (null이면 모두 가져옴)
 * @returns {Promise<Array>} 모의고사 결과 배열
 */
export async function getUserMockExamResults(count = 10, certificateType = null) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 모의고사 결과 조회 실패: 사용자가 로그인하지 않았습니다.');
      return [];
    }

    // 🔧 쿼리 구성 (certificateType 필터는 클라이언트에서 적용)
    const resultsQuery = query(
      collection(db, "mockExamResults"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(certificateType ? count * 2 : count)  // 필터링할 경우 더 많이 가져옴
    );

    const snapshot = await getDocs(resultsQuery);

    if (snapshot.empty) {
      console.log('[quiz-data-service] 모의고사 결과 기록이 없습니다.');
      return [];
    }

    // 결과 변환
    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }));

    // 🔧 클라이언트 필터링: certificateType 처리 (기존 데이터 호환)
    if (certificateType) {
      results = results.filter(result => {
        const resultCertType = result.certificateType || 'health-manager';  // 기본값 처리
        return resultCertType === certificateType;
      });

      // 원하는 개수만큼 자르기
      results = results.slice(0, count);

      console.log(`[quiz-data-service] ${results.length}개의 ${certificateType} 모의고사 결과를 로드했습니다.`);
    } else {
      console.log(`[quiz-data-service] ${results.length}개의 모의고사 결과를 로드했습니다.`);
    }

    return results;
  } catch (error) {
    console.error("[quiz-data-service] 모의고사 결과 조회 오류:", error);
    return [];
  }
}

/**
 * 사용자 학습 진행률 가져오기 (수정)
 * @returns {Promise<Object>} 학습 진행률 데이터
 */
export async function getUserProgress() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 학습 진행률 조회 실패: 사용자가 로그인하지 않았습니다.');
      return null;
    }

    const progressRef = doc(db, "userProgress", user.uid);
    const progressDoc = await getDoc(progressRef);

    if (progressDoc.exists()) {
      const data = progressDoc.data();
      console.log('[quiz-data-service] 학습 진행률 데이터 로드 완료');
      return data;
    } else {
      console.log('[quiz-data-service] 학습 진행률 데이터가 없습니다.');
      return {
        userId: user.uid,
        yearlyMockExams: {},
        subjectProgress: {},
        lastUpdated: null,
        createdAt: null
      };
    }
  } catch (error) {
    console.error("[quiz-data-service] 학습 진행률 조회 오류:", error);
    return null;
  }
}

/**
 * 사용자 통계 정보 가져오기 (신규)
 * @returns {Promise<Object>} 사용자 통계 정보
 */
export async function getUserStatistics() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 사용자 통계 조회 실패: 사용자가 로그인하지 않았습니다.');
      return null;
    }

    const userStatRef = doc(db, "userStatistics", user.uid);
    const userStatDoc = await getDoc(userStatRef);

    if (userStatDoc.exists()) {
      const data = userStatDoc.data();
      console.log('[quiz-data-service] 사용자 통계 데이터 로드 완료');
      return data;
    } else {
      console.log('[quiz-data-service] 사용자 통계 데이터가 없습니다.');
      return {
        userId: user.uid,
        subjectStats: {},
        totalStats: {
          totalAttempts: 0,
          correctAttempts: 0,
          accuracyRate: 0
        },
        lastUpdated: null
      };
    }
  } catch (error) {
    console.error("[quiz-data-service] 사용자 통계 조회 오류:", error);
    return null;
  }
}

/**
 * 문제풀이기록 세트 목록 가져오기 (신규)
 * @returns {Promise<Array>} 문제풀이기록 세트 배열
 */
export async function getUserQuestionSets() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('[quiz-data-service] 문제풀이기록 세트 조회 실패: 사용자가 로그인하지 않았습니다.');
      return [];
    }

    // 쿼리 구성
    const setsQuery = query(
      collection(db, "questionSets"),
      where(`userProgress.${user.uid}`, "!=", null)
    );

    const snapshot = await getDocs(setsQuery);

    if (snapshot.empty) {
      console.log('[quiz-data-service] 사용자 문제풀이기록 세트가 없습니다.');
      return [];
    }

    // 결과 변환
    const sets = snapshot.docs.map(doc => {
      const data = doc.data();
      const userProgressData = data.userProgress?.[user.uid] || {};

      return {
        id: doc.id,
        title: data.title || '제목 없음',
        type: data.type || 'regular',
        subject: data.subject || '알 수 없음',
        year: data.year || '',
        total: data.totalQuestions || 0,
        completed: userProgressData.completed || 0,
        correct: userProgressData.correct || 0,
        score: userProgressData.accuracy || 0,
        lastUpdated: userProgressData.lastUpdated?.toDate() || null
      };
    });

    console.log(`[quiz-data-service] ${sets.length}개의 문제풀이기록 세트를 로드했습니다.`);
    return sets;
  } catch (error) {
    console.error("[quiz-data-service] 문제풀이기록 세트 조회 오류:", error);
    return [];
  }
}

// 완료 시간을 초 단위로 변환하는 유틸리티 함수
function calculateDurationFromCompletionTime(completionTime) {
  if (!completionTime) return 0;

  const parts = completionTime.split(':').map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60) + seconds;
  }
  return 0;
}

/**
 * 사용자 학습 진행률 업데이트
 * @param {string} userId - 사용자 ID
 * @param {Object} mockExamData - 모의고사 결과 데이터
 */
async function updateUserProgress(userId, mockExamData) {
  try {
    // 레거시/혼합 포맷 대응: "1", 1, "1교시", "교시1" -> "1"/"2"
    const normalizeMockHour = (value) => {
      if (value == null) return "1";
      const str = String(value).trim();
      const match = str.match(/[12]/);
      return match ? match[0] : "1";
    };

    const progressRef = doc(db, "userProgress", userId);
    const progressDoc = await getDoc(progressRef);

    // 기존 데이터 가져오기 또는 빈 객체 초기화
    const progressData = progressDoc.exists() ? progressDoc.data() : {};

    // 연도별 모의고사 진행 데이터
    const yearlyMockExams = progressData.yearlyMockExams || {};
    const year = mockExamData.year || new Date().getFullYear().toString();
    // ✅ 기존 데이터 호환성: 여러 필드명 확인 (mockExamHour, hour, mockExamPart 등)
    const mockHour = normalizeMockHour(mockExamData.mockExamHour || mockExamData.hour || mockExamData.mockExamPart);

    // 해당 연도 데이터가 없으면 생성
    if (!yearlyMockExams[year]) {
      yearlyMockExams[year] = {};
    }

    // 모의고사 완료 데이터 및 최고 점수 관리
    const existingSession = yearlyMockExams[year]?.[`교시${mockHour}`];
    const newScore = mockExamData.score || 0;

    // 처음이거나 기존 점수보다 높을 때만 업데이트
    if (!existingSession || newScore >= (existingSession.score || 0)) {
      yearlyMockExams[year][`교시${mockHour}`] = {
        completed: true,
        score: newScore,
        totalQuestions: mockExamData.totalQuestions || 0,
        timestamp: serverTimestamp(),
        examId: mockExamData.examId
      };
    }

    // 과목별 진행률 업데이트
    const subjectProgress = progressData.subjectProgress || {};

    // 모의고사에서 다룬 과목별로 진행률 업데이트
    if (mockExamData.subjectResults && typeof mockExamData.subjectResults === 'object') {
      Object.entries(mockExamData.subjectResults).forEach(([subject, result]) => {
        // 과목 이름이 비어있지 않은지 확인
        if (subject && subject.trim() !== '') {
          // 기존 과목 데이터 가져오기 또는 초기화
          const subjectKey = `${year}_${subject}`;
          const subjectData = subjectProgress[subjectKey] || {};

          // 필드를 안전하게 업데이트
          const completedCount = result && typeof result === 'object' && 'totalQuestions' in result ? result.totalQuestions : 0;
          const totalCount = result && typeof result === 'object' && 'totalQuestions' in result ? result.totalQuestions : 0;

          // null이나 undefined가 아닌 실제 값으로 설정
          subjectProgress[subjectKey] = {
            completed: completedCount,
            total: totalCount,
            lastUpdated: serverTimestamp(),
            // 추가 메타데이터
            correctCount: result && typeof result === 'object' && 'correctCount' in result ? result.correctCount : 0,
            lastExamId: mockExamData.examId || null
          };
        }
      });
    }

    // 업데이트할 데이터 준비 (중첩 객체 구조 유지)
    const updateData = {
      userId: userId,
      yearlyMockExams: yearlyMockExams,
      subjectProgress: subjectProgress,
      lastUpdated: serverTimestamp()
    };

    // 첫 생성인 경우 createdAt 추가
    if (!progressDoc.exists()) {
      updateData.createdAt = serverTimestamp();
    }

    // Firestore에 안전하게 업데이트 (setDoc 사용으로 수정)
    await setDoc(progressRef, updateData, { merge: true });

    console.log(`[quiz-data-service] 사용자 ${userId}의 학습 진행률이 업데이트되었습니다.`);

    // 이벤트 디스패치 - 다른 모듈 알림
    document.dispatchEvent(new CustomEvent('userProgressUpdated', {
      detail: updateData
    }));

    return true;
  } catch (error) {
    console.error("[quiz-data-service] 학습 진행률 업데이트 오류:", error);
    return false;
  }
}

// 모듈 내보내기
export default {
  recordAttempt,
  recordMockExamResults,
  getUserAttempts,
  getUserMockExamResults,
  getUserProgress,
  getUserStatistics,
  getUserQuestionSets,
  getUserLearningStatus
};

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.recordAttempt = recordAttempt;
  window.recordMockExamResults = recordMockExamResults;
  window.getUserAttempts = getUserAttempts;
  window.getUserMockExamResults = getUserMockExamResults;
  window.getUserProgress = getUserProgress;
  window.getUserStatistics = getUserStatistics;
  window.getUserQuestionSets = getUserQuestionSets;
  window.getUserLearningStatus = getUserLearningStatus;
}