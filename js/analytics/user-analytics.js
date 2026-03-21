// user-analytics.js - 사용자 학습 분석 및 추천 기능 (패치 버전)

import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { getScoreColor, getWeaknessColor } from "./chart-utils.js";
import {
  filterAttemptsByCertificate,
  getDisplaySubjectName,
  groupBySubject,
  calculateCertificateStats
} from "../utils/certificate-utils.js";

/**
 * 🎯 사용자의 약점 분석 (자격증 완전 분리, 문제풀이 기록 + 모의고사 결과 통합)
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {Array} mockExamResults - 모의고사 결과 배열 (선택)
 * @param {string} certificateType - 분석할 자격증 타입 (필수)
 * @returns {Array} 약점 과목 배열 (오답률 높은 순)
 */
export function analyzeWeaknesses(attempts, mockExamResults = [], certificateType = 'health-manager') {
  // 🔒 1단계: 자격증으로 먼저 필터링 (완전 분리)
  const filteredAttempts = filterAttemptsByCertificate(attempts, certificateType);

  // 모의고사 결과 필터링 (자격증별)
  const filteredMockExamResults = (mockExamResults || []).filter(result => {
    const resultCertType = result.certificateType || 'health-manager';
    return resultCertType === certificateType;
  });

  console.log(`[약점 분석] ${certificateType} 데이터 분석 중...`);
  console.log(`  - 문제풀이 기록: ${filteredAttempts.length}개`);
  console.log(`  - 모의고사 결과: ${filteredMockExamResults.length}개`);

  // 과목별 통계 초기화
  const subjectStats = {};

  // 1. 문제풀이 시도 데이터 집계
  filteredAttempts.forEach(attempt => {
    let subject = attempt.questionData?.subject || attempt.subject;
    if (subject) {
      // ✅ 한글 인코딩 문제 해결: URL 인코딩된 경우 디코딩 (반복)
      try {
        let decoded = subject;
        for (let i = 0; i < 3; i++) {
          const temp = decodeURIComponent(decoded);
          if (temp === decoded) break;
          decoded = temp;
        }
        subject = decoded;
      } catch (e) {
        // 디코딩 실패 시 원본 유지
      }

      if (!subjectStats[subject]) {
        subjectStats[subject] = {
          certificateType,
          subject,
          displayName: getDisplaySubjectName(certificateType, subject, false),
          total: 0,
          incorrect: 0
        };
      }

      subjectStats[subject].total++;
      if (!attempt.isCorrect) {
        subjectStats[subject].incorrect++;
      }
    }
  });

  // 2. 모의고사 결과 데이터 집계 (subjectResults 활용)
  filteredMockExamResults.forEach(result => {
    const subjectResults = result.subjectResults || {};

    Object.keys(subjectResults).forEach(encodedSubject => {
      const subjectData = subjectResults[encodedSubject];

      // ✅ 한글 인코딩 문제 해결
      let subject = encodedSubject;
      try {
        if (subject.includes('%')) {
          subject = decodeURIComponent(subject);
        }
      } catch (e) {
        console.warn('과목명 디코딩 실패:', subject);
      }

      // 두 가지 형태의 데이터 구조 처리
      // 형태 1: { total: 20, correct: 18, accuracy: 90 }
      // 형태 2: { totalQuestions: 20, correctCount: 18, score: 90 }
      let total = subjectData.total || subjectData.totalQuestions || 0;
      let correct = subjectData.correct || subjectData.correctCount || 0;

      // accuracy나 score가 있는 경우 역산 (더 정확함)
      if (total === 0 && (subjectData.accuracy !== undefined || subjectData.score !== undefined)) {
        const accuracy = subjectData.accuracy || subjectData.score || 0;
        // 정확한 수치를 알 수 없으므로 추정치 사용 (모의고사는 보통 과목당 20문제)
        total = 20;
        correct = Math.round(total * (accuracy / 100));
      }

      if (total > 0 && subject) {
        if (!subjectStats[subject]) {
          subjectStats[subject] = {
            certificateType,
            subject,
            displayName: getDisplaySubjectName(certificateType, subject, false),
            total: 0,
            incorrect: 0
          };
        }

        // 모의고사 결과를 통계에 추가
        subjectStats[subject].total += total;
        subjectStats[subject].incorrect += (total - correct);
      }
    });
  });

  // 3. 오답률 계산 및 배열로 변환
  const weaknessData = Object.values(subjectStats)
    .filter(stat => stat.total >= 5) // 최소 5문제 이상 시도한 과목만
    .map(stat => {
      const { total, incorrect } = stat;
      const incorrectRate = total > 0 ? (incorrect / total) * 100 : 0;

      return {
        ...stat,
        incorrectRate: Math.round(incorrectRate * 10) / 10, // 소수점 첫째 자리까지
        color: getWeaknessColor(Math.round(incorrectRate))
      };
    });

  // 4. 오답률 높은 순으로 정렬
  const sorted = weaknessData.sort((a, b) => {
    // 오답률이 같으면 시도 수가 많은 순
    if (Math.abs(a.incorrectRate - b.incorrectRate) < 0.1) {
      return b.total - a.total;
    }
    return b.incorrectRate - a.incorrectRate;
  });

  console.log(`[약점 분석] ${certificateType} 약점 과목 ${sorted.length}개 발견`);

  // ✅ 최대 8개 과목만 표시 (건강운동관리사 기준)
  return sorted.slice(0, 8);
}

/**
 * 🎯 최근 학습 활동 분석 (자격증 완전 분리)
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {string} certificateType - 분석할 자격증 타입
 * @param {number} days - 분석할 일수 (기본 30일)
 * @returns {Object} 날짜별 학습 활동 데이터
 */
export function analyzeRecentActivity(attempts, certificateType = 'health-manager', days = 30) {
  // 🔒 1단계: 자격증으로 먼저 필터링 (완전 분리)
  const filteredAttempts = filterAttemptsByCertificate(attempts, certificateType);
  // 날짜 형식 변환 함수
  const formatDate = date => date.toISOString().split('T')[0]; // YYYY-MM-DD

  // 현재 날짜
  const today = new Date();

  // 결과 객체 초기화 (최근 30일)
  const activityData = {
    dates: [],
    attemptsCount: [],
    correctCount: []
  };

  // 날짜 배열 및 데이터 초기화
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    activityData.dates.push(formatDate(date));
    activityData.attemptsCount.push(0);
    activityData.correctCount.push(0);
  }

  // 시도 데이터 집계 (필터링된 데이터 사용)
  filteredAttempts.forEach(attempt => {
    const attemptDate = new Date(attempt.timestamp);
    const dayDiff = Math.floor((today - attemptDate) / (1000 * 60 * 60 * 24));

    if (dayDiff >= 0 && dayDiff < days) {
      activityData.attemptsCount[days - 1 - dayDiff]++;

      if (attempt.isCorrect) {
        activityData.correctCount[days - 1 - dayDiff]++;
      }
    }
  });

  console.log(`[학습 활동] ${certificateType} 최근 ${days}일 데이터 분석 완료`);

  return activityData;
}

/**
 * 🎯 사용자 맞춤형 문제풀이기록 세트 추천 (자격증 완전 분리)
 * @param {Array} weaknesses - 약점 분석 결과
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {string} certificateType - 추천할 자격증 타입 (필수)
 * @returns {Promise<Array>} 추천 문제풀이기록 세트 배열
 */
export async function generateRecommendations(weaknesses, attempts, certificateType = 'health-manager') {
  try {
    // 추천 결과 배열
    const recommendations = [];

    // 데이터가 너무 적은 경우 처리
    if (!attempts || attempts.length < 5) {
      return [];
    }

    const user = auth.currentUser;
    if (!user) {
      return [];
    }

    // 약점 기반 세트 생성 (상위 3개 약점만)
    for (let i = 0; i < Math.min(3, weaknesses.length); i++) {
      const weakness = weaknesses[i];

      if (weakness.total >= 5 && weakness.incorrectRate >= 30) { // 최소 시도 수와 오답률이 충족되는 경우만
        // 🔒 이 과목에서 틀린 문제들 찾기 (같은 자격증 내에서만)
        const incorrectQuestions = filterAttemptsByCertificate(attempts, certificateType).filter(attempt =>
          attempt.questionData?.subject === weakness.subject &&
          !attempt.isCorrect
        );

        if (incorrectQuestions.length > 0) {
          // 틀린 문제들의 ID 추출
          const questionIds = incorrectQuestions.map(q =>
            q.questionData?.questionId || `${q.questionData?.year}_${q.questionData?.subject}_${q.questionData?.number}`
          );

          // 🎯 추천 세트 생성 및 Firestore에 저장 (자격증 정보 포함)
          const setRef = await addDoc(collection(db, "recommendedSets"), {
            userId: user.uid,
            certificateType: certificateType,  // 자격증 정보 필수
            title: `${weakness.displayName} 약점 문제풀이기록`,
            type: 'custom',
            subject: weakness.subject,
            questions: Math.min(15, incorrectQuestions.length),
            difficulty: weakness.incorrectRate >= 60 ? '어려움' : '중간',
            reasonText: `${weakness.displayName}에서 ${weakness.incorrectRate}%의 오답률을 보이는 문제들로 구성된 세트입니다.`,
            questionIds: questionIds.slice(0, 15), // 최대 15문제만
            createdAt: serverTimestamp()
          });

          // 추천 세트 객체 생성
          recommendations.push({
            id: setRef.id,
            certificateType: certificateType,
            title: `${weakness.displayName} 약점 문제풀이기록`,
            type: 'custom',
            questions: Math.min(15, incorrectQuestions.length),
            difficulty: weakness.incorrectRate >= 60 ? '어려움' : '중간',
            reasonText: `${weakness.displayName}에서 ${weakness.incorrectRate}%의 오답률을 보이는 문제들로 구성된 세트입니다.`
          });
        }
      }
    }

    // 모의고사 오답 세트 (모의고사 결과가 있는 경우)
    const mockExams = attempts.filter(attempt => attempt.questionData?.isFromMockExam);
    if (mockExams.length > 0) {
      // 모의고사에서 틀린 문제들 찾기
      const incorrectMockQuestions = mockExams.filter(attempt => !attempt.isCorrect);

      if (incorrectMockQuestions.length > 0) {
        // 가장 최근 응시한 모의고사 연도와 교시 찾기
        const latestMockExam = mockExams.reduce((latest, current) =>
          new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest, mockExams[0]);

        const mockYear = latestMockExam.questionData?.year || new Date().getFullYear().toString();
        const mockPart = latestMockExam.questionData?.mockExamPart || '1';

        // 이 모의고사에서 틀린 문제들의 ID 추출
        const questionIds = incorrectMockQuestions
          .filter(q =>
            q.questionData?.year === mockYear &&
            q.questionData?.mockExamPart === mockPart
          )
          .map(q =>
            q.questionData?.questionId || `${q.questionData?.year}_${q.questionData?.subject}_${q.questionData?.number}`
          );

        if (questionIds.length > 0) {
          // 추천 세트 생성 및 Firestore에 저장
          const setRef = await addDoc(collection(db, "recommendedSets"), {
            userId: user.uid,
            title: `${mockYear} 모의고사 ${mockPart}교시 오답 복습`,
            type: 'mockexam',
            year: mockYear,
            mockExamPart: mockPart,
            questions: questionIds.length,
            difficulty: '중간',
            reasonText: `${mockYear}년 모의고사 ${mockPart}교시에서 틀린 문제들을 다시 풀어볼 수 있습니다.`,
            questionIds: questionIds,
            createdAt: serverTimestamp()
          });

          // 추천 세트 객체 생성
          recommendations.push({
            id: setRef.id,
            title: `${mockYear} 모의고사 ${mockPart}교시 오답 복습`,
            type: 'mockexam',
            questions: questionIds.length,
            difficulty: '중간',
            reasonText: `${mockYear}년 모의고사 ${mockPart}교시에서 틀린 문제들을 다시 풀어볼 수 있습니다.`
          });
        }
      }
    }

    // 일반 문제 복습 세트 (모든 과목에서 가장 최근 틀린 문제들)
    const recentIncorrect = attempts
      .filter(attempt => !attempt.isCorrect && !attempt.questionData?.isFromMockExam)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    if (recentIncorrect.length >= 5) {
      // 최근 틀린 문제들의 ID 추출
      const questionIds = recentIncorrect.map(q =>
        q.questionData?.questionId || `${q.questionData?.year}_${q.questionData?.subject}_${q.questionData?.number}`
      );

      // 추천 세트 생성 및 Firestore에 저장
      const setRef = await addDoc(collection(db, "recommendedSets"), {
        userId: user.uid,
        title: '최근 오답 복습 세트',
        type: 'custom',
        questions: questionIds.length,
        difficulty: '중간',
        reasonText: '최근에 틀린 문제들을 모아 복습할 수 있는 세트입니다.',
        questionIds: questionIds,
        createdAt: serverTimestamp()
      });

      // 추천 세트 객체 생성
      recommendations.push({
        id: setRef.id,
        title: '최근 오답 복습 세트',
        type: 'custom',
        questions: questionIds.length,
        difficulty: '중간',
        reasonText: '최근에 틀린 문제들을 모아 복습할 수 있는 세트입니다.'
      });
    }

    return recommendations;
  } catch (error) {
    console.error('추천 세트 생성 오류:', error);
    return [];
  }
}

/**
 * 개선 중인 과목 찾기 (정답률이 향상되고 있는 과목)
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @returns {Array} 개선 중인 과목 배열
 */
function findImprovingSubjects(attempts) {
  // 과목별, 날짜별 정답률 계산
  const subjectData = {};

  // 최근 날짜 기준 정렬
  const sortedAttempts = [...attempts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 과목별 시간에 따른 정답률 변화 추적
  sortedAttempts.forEach(attempt => {
    const subject = attempt.questionData?.subject;
    if (!subject) return;

    // 날짜 기준으로 데이터 구분 (주 단위)
    const date = new Date(attempt.timestamp);
    const weekKey = `${date.getFullYear()}-${Math.floor(date.getDate() / 7)}`;

    if (!subjectData[subject]) {
      subjectData[subject] = {};
    }

    if (!subjectData[subject][weekKey]) {
      subjectData[subject][weekKey] = { total: 0, correct: 0 };
    }

    subjectData[subject][weekKey].total++;
    if (attempt.isCorrect) {
      subjectData[subject][weekKey].correct++;
    }
  });

  // 개선 중인 과목 찾기 (최소 2개 이상의 데이터 포인트가 있는 경우만)
  const improving = [];

  Object.keys(subjectData).forEach(subject => {
    const weekData = subjectData[subject];
    const weeks = Object.keys(weekData).sort();

    if (weeks.length >= 2) {
      // 첫 주와 마지막 주의 정답률 비교
      const firstWeek = weekData[weeks[0]];
      const lastWeek = weekData[weeks[weeks.length - 1]];

      const firstRate = firstWeek.total > 0 ? (firstWeek.correct / firstWeek.total) * 100 : 0;
      const lastRate = lastWeek.total > 0 ? (lastWeek.correct / lastWeek.total) * 100 : 0;

      // 10% 이상 개선된 경우
      if (lastRate - firstRate >= 10) {
        improving.push({
          subject,
          improvement: lastRate - firstRate
        });
      }
    }
  });

  // 개선율 기준 정렬
  improving.sort((a, b) => b.improvement - a.improvement);

  return improving.map(item => item.subject);
}

/**
 * 학습 통계 요약 생성
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {Array} mockExamResults - 모의고사 결과 배열
 * @returns {Object} 학습 통계 요약
 */
export function generateStatsSummary(attempts, mockExamResults) {
  // 전체 통계 계산
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter(attempt => attempt.isCorrect).length;
  const correctPercentage = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  // 모의고사 통계
  const completedMockExams = mockExamResults.length;
  const avgMockExamScore = completedMockExams > 0
    ? Math.round(mockExamResults.reduce((sum, result) => sum + (result.score || 0), 0) / completedMockExams)
    : 0;

  // 최근 활동 계산
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const recentAttempts = attempts.filter(attempt => new Date(attempt.timestamp) >= weekAgo);
  const recentCorrect = recentAttempts.filter(attempt => attempt.isCorrect).length;
  const recentPercentage = recentAttempts.length > 0 ? Math.round((recentCorrect / recentAttempts.length) * 100) : 0;

  // 최근 학습일
  const lastActivity = attempts.length > 0
    ? new Date(attempts.reduce((latest, attempt) => {
      return new Date(attempt.timestamp) > new Date(latest.timestamp) ? attempt : latest;
    }, attempts[0]).timestamp).toLocaleDateString()
    : '없음';

  return {
    totalAttempts,
    correctPercentage,
    completedMockExams,
    avgMockExamScore,
    recentAttempts: recentAttempts.length,
    recentPercentage,
    lastActivity,
    // 점수 색상
    scoreColor: getScoreColor(correctPercentage)
  };
}

export default {
  analyzeWeaknesses,
  analyzeRecentActivity,
  generateRecommendations,
  generateStatsSummary
};