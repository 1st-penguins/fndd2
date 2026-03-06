// advanced-analytics.js - 고급 학습 분석 기능

/**
 * 취약 문제 분석
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Array} 취약 문제 목록
 */
export function analyzeWeakQuestions(attempts) {
  const questionMap = {};
  
  attempts.forEach(attempt => {
    const qData = attempt.questionData;
    if (!qData) return;
    
    const key = `${qData.year}_${qData.subject}_${qData.number}`;
    
    if (!questionMap[key]) {
      questionMap[key] = {
        year: qData.year,
        subject: qData.subject,
        number: qData.number,
        attempts: 0,
        correct: 0,
        lastAttempt: null
      };
    }
    
    questionMap[key].attempts++;
    if (attempt.isCorrect) {
      questionMap[key].correct++;
    }
    
    if (!questionMap[key].lastAttempt || new Date(attempt.timestamp) > new Date(questionMap[key].lastAttempt)) {
      questionMap[key].lastAttempt = attempt.timestamp;
    }
  });
  
  // 취약 문제: 정답률 50% 미만 또는 2회 이상 틀린 문제
  const weakQuestions = Object.values(questionMap)
    .filter(q => {
      const accuracy = (q.correct / q.attempts * 100);
      return accuracy < 50 || (q.attempts >= 2 && q.correct === 0);
    })
    .sort((a, b) => {
      // 정답률이 낮을수록, 최근 시도일수록 우선
      const accA = a.correct / a.attempts;
      const accB = b.correct / b.attempts;
      if (Math.abs(accA - accB) > 0.1) {
        return accA - accB;
      }
      return new Date(b.lastAttempt) - new Date(a.lastAttempt);
    })
    .slice(0, 10); // 상위 10개
  
  return weakQuestions;
}

/**
 * 반복 학습 추천
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Array} 복습 추천 문제
 */
export function recommendReviewQuestions(attempts) {
  const now = new Date();
  const questionMap = {};
  
  attempts.forEach(attempt => {
    const qData = attempt.questionData;
    if (!qData) return;
    
    const key = `${qData.year}_${qData.subject}_${qData.number}`;
    
    if (!questionMap[key]) {
      questionMap[key] = {
        year: qData.year,
        subject: qData.subject,
        number: qData.number,
        lastAttempt: null,
        correct: 0,
        attempts: 0,
        lastCorrect: false
      };
    }
    
    questionMap[key].attempts++;
    if (attempt.isCorrect) {
      questionMap[key].correct++;
      questionMap[key].lastCorrect = true;
    } else {
      questionMap[key].lastCorrect = false;
    }
    
    if (!questionMap[key].lastAttempt || new Date(attempt.timestamp) > new Date(questionMap[key].lastAttempt)) {
      questionMap[key].lastAttempt = attempt.timestamp;
    }
  });
  
  // 복습 추천: 마지막으로 맞춘 지 7일 이상 지난 문제 또는 마지막 시도가 틀린 문제
  const recommendations = Object.values(questionMap)
    .filter(q => {
      if (!q.lastAttempt) return false;
      
      const daysSinceLastAttempt = (now - new Date(q.lastAttempt)) / (1000 * 60 * 60 * 24);
      
      // 마지막 시도가 틀렸거나, 7일 이상 지난 경우
      return !q.lastCorrect || daysSinceLastAttempt >= 7;
    })
    .sort((a, b) => {
      // 마지막 시도가 틀린 문제 우선, 그 다음 오래된 문제
      if (a.lastCorrect !== b.lastCorrect) {
        return a.lastCorrect ? 1 : -1;
      }
      return new Date(a.lastAttempt) - new Date(b.lastAttempt);
    })
    .slice(0, 15); // 상위 15개
  
  return recommendations;
}

/**
 * 학습 패턴 분석
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Object} 학습 패턴 분석 결과
 */
export function analyzeLearningPattern(attempts) {
  if (attempts.length === 0) {
    return {
      mostActiveTime: null,
      studyStreak: 0,
      averageSessionLength: 0,
      totalStudyDays: 0
    };
  }
  
  // 시간대별 학습량
  const hourDistribution = new Array(24).fill(0);
  const dateMap = {};
  
  attempts.forEach(attempt => {
    const date = new Date(attempt.timestamp);
    const hour = date.getHours();
    const dateKey = date.toDateString();
    
    hourDistribution[hour]++;
    dateMap[dateKey] = (dateMap[dateKey] || 0) + 1;
  });
  
  // 가장 많이 공부한 시간대
  const mostActiveHour = hourDistribution.indexOf(Math.max(...hourDistribution));
  let mostActiveTime = '아침 (06:00-12:00)';
  if (mostActiveHour >= 12 && mostActiveHour < 18) {
    mostActiveTime = '오후 (12:00-18:00)';
  } else if (mostActiveHour >= 18 && mostActiveHour < 24) {
    mostActiveTime = '저녁 (18:00-24:00)';
  } else if (mostActiveHour >= 0 && mostActiveHour < 6) {
    mostActiveTime = '새벽 (00:00-06:00)';
  }
  
  // 연속 학습 일수
  const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b));
  let tempStreak = 0;
  let maxStreak = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const dayDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  // 현재 연속 학습일 — 가장 최근 날짜가 오늘/어제인 경우만 유효
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let currentStreak = 0;
  if (sortedDates.length > 0) {
    const mostRecent = new Date(sortedDates[sortedDates.length - 1]);
    mostRecent.setHours(0, 0, 0, 0);
    const diffFromToday = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));

    if (diffFromToday <= 1) { // 오늘 또는 어제까지 공부한 경우
      currentStreak = 1;
      for (let i = sortedDates.length - 2; i >= 0; i--) {
        const curr = new Date(sortedDates[i + 1]);
        const prev = new Date(sortedDates[i]);
        curr.setHours(0, 0, 0, 0);
        prev.setHours(0, 0, 0, 0);
        const dayDiff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // 평균 세션 길이 (일일 평균 문제 수)
  const averageSessionLength = Math.round(attempts.length / sortedDates.length);

  return {
    mostActiveTime,
    studyStreak: currentStreak,   // 현재 연속 학습일
    maxStreak,                     // 역대 최고 연속 학습일
    averageSessionLength,
    totalStudyDays: sortedDates.length
  };
}

/**
 * 예상 점수 계산
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Object} 예상 점수 정보
 */
export function calculateExpectedScore(attempts) {
  // 과목별 정답률 계산
  const subjectStats = {};
  const subjects = [
    '운동생리학', '건강체력평가', '운동처방론', '운동부하검사',
    '운동상해', '기능해부학', '병태생리학', '스포츠심리학'
  ];
  
  subjects.forEach(subject => {
    subjectStats[subject] = { correct: 0, total: 0 };
  });
  
  attempts.forEach(attempt => {
    const subject = attempt.questionData?.subject;
    if (subject && subjectStats[subject]) {
      subjectStats[subject].total++;
      if (attempt.isCorrect) {
        subjectStats[subject].correct++;
      }
    }
  });
  
  // 전체 평균 정답률 (미응시 과목 추정에 사용)
  const totalCorrectAll = attempts.filter(a => a.isCorrect).length;
  const overallAccuracy = attempts.length > 0 ? totalCorrectAll / attempts.length : 0.5;

  // 과목별 예상 점수 (각 과목 25문제, 4점)
  let total1stScore = 0;
  let total2ndScore = 0;
  const estimatedSubjects = []; // 추정값 사용된 과목 목록

  const firstSubjects = ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'];
  const secondSubjects = ['운동상해', '기능해부학', '병태생리학', '스포츠심리학'];

  firstSubjects.forEach(subject => {
    const stat = subjectStats[subject];
    let accuracy;
    if (stat.total >= 5) {
      accuracy = stat.correct / stat.total;
    } else {
      accuracy = overallAccuracy; // 데이터 부족 시 전체 평균으로 추정
      estimatedSubjects.push(subject);
    }
    total1stScore += accuracy * 25 * 4; // 25문제 * 4점
  });

  secondSubjects.forEach(subject => {
    const stat = subjectStats[subject];
    let accuracy;
    if (stat.total >= 5) {
      accuracy = stat.correct / stat.total;
    } else {
      accuracy = overallAccuracy;
      estimatedSubjects.push(subject);
    }
    total2ndScore += accuracy * 25 * 4;
  });

  // 신뢰도 계산 (충분한 문제를 풀었는지)
  const totalSolvedProblems = attempts.length;
  let reliability = '낮음';
  if (totalSolvedProblems >= 200) {
    reliability = '높음';
  } else if (totalSolvedProblems >= 100) {
    reliability = '보통';
  }

  return {
    firstExamScore: Math.round(total1stScore),
    secondExamScore: Math.round(total2ndScore),
    totalScore: Math.round(total1stScore + total2ndScore),
    reliability,
    totalAttempts: totalSolvedProblems,
    estimatedSubjects // 추정값 사용된 과목들
  };
}

/**
 * 과목별 강약점 분석
 * @param {Array} attempts - 문제 풀이 기록
 * @returns {Object} 과목별 분석
 */
export function analyzeSubjectStrengths(attempts) {
  const subjects = [
    '운동생리학', '건강체력평가', '운동처방론', '운동부하검사',
    '운동상해', '기능해부학', '병태생리학', '스포츠심리학'
  ];
  
  const subjectStats = {};
  
  subjects.forEach(subject => {
    subjectStats[subject] = {
      name: subject,
      correct: 0,
      total: 0,
      accuracy: 0,
      level: '미응시',
      color: '#ccc'
    };
  });
  
  attempts.forEach(attempt => {
    const subject = attempt.questionData?.subject;
    if (subject && subjectStats[subject]) {
      subjectStats[subject].total++;
      if (attempt.isCorrect) {
        subjectStats[subject].correct++;
      }
    }
  });
  
  // 정답률 계산 및 레벨 설정
  Object.keys(subjectStats).forEach(subject => {
    const stat = subjectStats[subject];
    if (stat.total > 0) {
      stat.accuracy = Math.round((stat.correct / stat.total) * 100);
      
      if (stat.accuracy >= 80) {
        stat.level = '우수';
        stat.color = '#4caf50';
      } else if (stat.accuracy >= 60) {
        stat.level = '양호';
        stat.color = '#8bc34a';
      } else if (stat.accuracy >= 40) {
        stat.level = '보통';
        stat.color = '#ff9800';
      } else {
        stat.level = '취약';
        stat.color = '#f44336';
      }
    }
  });
  
  // 강점/약점 분류
  const strengths = Object.values(subjectStats)
    .filter(s => s.total >= 5 && s.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy);
  
  const weaknesses = Object.values(subjectStats)
    .filter(s => s.total >= 5 && s.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy);
  
  return {
    allSubjects: Object.values(subjectStats),
    strengths,
    weaknesses
  };
}

/**
 * 최근 학습 트렌드 분석
 * @param {Array} attempts - 문제 풀이 기록
 * @param {number} days - 분석 기간 (일)
 * @returns {Object} 트렌드 분석 결과
 */
export function analyzeLearningTrend(attempts, days = 14) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  
  const recentAttempts = attempts.filter(a => new Date(a.timestamp) >= startDate);
  const previousAttempts = attempts.filter(a => new Date(a.timestamp) < startDate);
  
  const recentCorrect = recentAttempts.filter(a => a.isCorrect).length;
  const recentAccuracy = recentAttempts.length > 0 ? (recentCorrect / recentAttempts.length * 100) : 0;
  
  const previousCorrect = previousAttempts.filter(a => a.isCorrect).length;
  const previousAccuracy = previousAttempts.length > 0 ? (previousCorrect / previousAttempts.length * 100) : 0;
  
  const trend = recentAccuracy - previousAccuracy;
  
  let trendText = '유지';
  let trendColor = '#666';
  let trendIcon = '➡️';
  
  if (trend > 5) {
    trendText = '상승';
    trendColor = '#4caf50';
    trendIcon = '📈';
  } else if (trend < -5) {
    trendText = '하락';
    trendColor = '#f44336';
    trendIcon = '📉';
  }
  
  return {
    recentAccuracy: Math.round(recentAccuracy),
    previousAccuracy: Math.round(previousAccuracy),
    trend: Math.round(trend),
    trendText,
    trendColor,
    trendIcon,
    recentAttempts: recentAttempts.length
  };
}

export default {
  analyzeWeakQuestions,
  recommendReviewQuestions,
  analyzeLearningPattern,
  calculateExpectedScore,
  analyzeSubjectStrengths,
  analyzeLearningTrend
};

