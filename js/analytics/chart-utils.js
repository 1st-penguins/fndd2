// chart-utils.js - 차트 관련 유틸리티 함수

/**
 * 점수에 따른 색상 코드 반환
 * @param {number} score - 점수 (0-100)
 * @returns {string} 색상 코드
 */
export function getScoreColor(score) {
  if (score >= 90) return '#4CAF50'; // 우수 (초록)
  if (score >= 70) return '#2196F3'; // 양호 (파랑)
  if (score >= 60) return '#FF9800'; // 보통 (주황)
  return '#F44336'; // 미흡 (빨강)
}

/**
 * 오답률에 따른 색상 코드 반환
 * @param {number} rate - 오답률 (0-100)
 * @returns {string} 색상 코드
 */
export function getWeaknessColor(rate) {
  if (rate >= 70) return '#F44336'; // 심각 (빨강)
  if (rate >= 50) return '#FF9800'; // 주의 (주황)
  if (rate >= 30) return '#FFC107'; // 보통 (노랑)
  return '#4CAF50'; // 양호 (초록)
}

/**
 * 랜덤 색상 생성
 * @param {number} alpha - 투명도 (0-1)
 * @returns {string} RGBA 색상 문자열
 */
export function getRandomColor(alpha = 1) {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 차트 옵션 생성 (공통 옵션)
 * @param {string} title - 차트 제목
 * @returns {Object} 차트 옵션 객체
 */
export function createChartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: !!title,
        text: title || '',
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        position: 'bottom'
      }
    }
  };
}

/**
 * 날짜 형식 변환
 * @param {Date|string} date - 날짜 객체 또는 날짜 문자열
 * @param {string} format - 원하는 형식 ('short', 'medium', 'long')
 * @returns {string} 형식화된 날짜 문자열
 */
export function formatDate(date, format = 'medium') {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj)) {
    return 'Invalid Date';
  }
  
  switch (format) {
    case 'short':
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    case 'medium':
      return dateObj.toLocaleDateString();
    case 'long':
      return dateObj.toLocaleString();
    default:
      return dateObj.toLocaleDateString();
  }
}

/**
 * 특정 기간의 날짜 범위 생성
 * @param {number} days - 일수
 * @returns {Array} 날짜 객체 배열
 */
export function getDateRange(days) {
  const dates = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    dates.push(date);
  }
  
  return dates;
}

/**
 * 주어진 날짜 배열을 더 읽기 쉬운 라벨로 변환
 * @param {Array} dates - 날짜 객체 배열
 * @param {string} format - 원하는 형식 ('short', 'medium')
 * @returns {Array} 형식화된 날짜 문자열 배열
 */
export function formatDateLabels(dates, format = 'short') {
  return dates.map(date => formatDate(date, format));
}

/**
 * 일수별 학습 통계 계산
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {Array} dates - 날짜 객체 배열
 * @returns {Object} 날짜별 통계 객체
 */
export function calculateDailyStats(attempts, dates) {
  // 날짜별 시도 및 정답 횟수 초기화
  const stats = {};
  
  dates.forEach(date => {
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    stats[dateString] = {
      attempts: 0,
      correct: 0
    };
  });
  
  // 시도 데이터 집계
  attempts.forEach(attempt => {
    const attemptDate = new Date(attempt.timestamp);
    const dateString = attemptDate.toISOString().split('T')[0];
    
    if (stats[dateString]) {
      stats[dateString].attempts++;
      
      if (attempt.isCorrect) {
        stats[dateString].correct++;
      }
    }
  });
  
  return stats;
}

/**
 * 과목별 학습 통계 계산
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @param {Array} subjects - 과목 목록
 * @returns {Object} 과목별 통계 객체
 */
export function calculateSubjectStats(attempts, subjects) {
  // 과목별 통계 초기화
  const stats = {};
  
  subjects.forEach(subject => {
    stats[subject] = {
      attempts: 0,
      correct: 0,
      percentage: 0
    };
  });
  
  // 시도 데이터 집계
  attempts.forEach(attempt => {
    const subject = attempt.questionData?.subject;
    if (subject && stats[subject]) {
      stats[subject].attempts++;
      
      if (attempt.isCorrect) {
        stats[subject].correct++;
      }
    }
  });
  
  // 백분율 계산
  Object.keys(stats).forEach(subject => {
    const { attempts, correct } = stats[subject];
    stats[subject].percentage = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  });
  
  return stats;
}

/**
 * 난이도별 문제 분포 계산
 * @param {Array} questionStats - 문제별 통계 배열
 * @returns {Object} 난이도별 문제 수
 */
export function calculateDifficultyDistribution(questionStats) {
  const distribution = {
    easy: 0,   // 정답률 70% 이상
    medium: 0, // 정답률 40-70%
    hard: 0    // 정답률 40% 미만
  };
  
  questionStats.forEach(stat => {
    const percentage = stat.correct / stat.attempts * 100;
    
    if (percentage >= 70) {
      distribution.easy++;
    } else if (percentage >= 40) {
      distribution.medium++;
    } else {
      distribution.hard++;
    }
  });
  
  return distribution;
}

/**
 * 학습 진행률 계산
 * @param {Object} userProgress - 사용자 진행률 데이터
 * @param {string} year - 연도
 * @returns {Object} 진행률 통계
 */
export function calculateYearProgress(userProgress, year) {
  if (!userProgress || !userProgress.yearlyMockExams) {
    return {
      completed: 0,
      total: 0,
      percentage: 0
    };
  }
  
  const yearData = userProgress.yearlyMockExams[year] || {};
  const mockExam1 = yearData['교시1'] || { completed: false };
  const mockExam2 = yearData['교시2'] || { completed: false };
  
  const completed = (mockExam1.completed ? 1 : 0) + (mockExam2.completed ? 1 : 0);
  const percentage = Math.round((completed / 2) * 100);
  
  return {
    completed,
    total: 2,
    percentage
  };
}

export default {
  getScoreColor,
  getWeaknessColor,
  getRandomColor,
  createChartOptions,
  formatDate,
  getDateRange,
  formatDateLabels,
  calculateDailyStats,
  calculateSubjectStats,
  calculateDifficultyDistribution,
  calculateYearProgress
};