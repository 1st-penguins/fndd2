// advanced-analytics-ui.js - 고급 학습 분석 UI 렌더링 (Refactored for CSS Classes)

import {
  analyzeWeakQuestions,
  recommendReviewQuestions,
  analyzeLearningPattern,
  calculateExpectedScore,
  analyzeLearningTrend
} from './advanced-analytics.js';

/**
 * 예상 점수 렌더링
 * @param {Array} attempts - 문제 풀이 기록
 */
export function renderExpectedScore(attempts) {
  const container = document.getElementById('expected-score-section');
  if (!container) return;

  if (!attempts || attempts.length < 10) {
    container.innerHTML = `
      <div class="no-data-message">
        <p>최소 10문제 이상 풀어야 예상 점수를 확인할 수 있습니다.</p>
        <p style="font-size: 0.9em; margin-top: 8px;">더 많은 데이터를 쌓아보세요!</p>
      </div>
    `;
    return;
  }

  const scoreData = calculateExpectedScore(attempts);

  // 신뢰도에 따른 색상 클래스는 CSS에서 처리하거나 간단한 인라인으로 보조
  let reliabilityColor = 'var(--danger-color)';
  if (scoreData.reliability === '높음') reliabilityColor = 'var(--success-color)';
  else if (scoreData.reliability === '보통') reliabilityColor = 'var(--warning-color)';

  container.innerHTML = `
    <div class="score-grid">
      <div class="score-card score-card-primary">
        <div style="opacity: 0.9; margin-bottom: 8px;">1교시 예상</div>
        <div class="score-value-large">${scoreData.firstExamScore}<span style="font-size:0.5em">점</span></div>
      </div>
      
      <div class="score-card score-card-secondary">
        <div style="opacity: 0.9; margin-bottom: 8px;">2교시 예상</div>
        <div class="score-value-large">${scoreData.secondExamScore}<span style="font-size:0.5em">점</span></div>
      </div>
      
      <div class="score-card score-card-info">
        <div style="opacity: 0.9; margin-bottom: 8px;">총 예상 점수</div>
        <div class="score-value-large">${scoreData.totalScore}<span style="font-size:0.5em">점</span></div>
        <div style="font-size: 0.8rem; opacity: 0.8;">(400점 만점)</div>
      </div>
      
      <div class="score-card score-card-neutral">
        <div style="color: var(--text-secondary); margin-bottom: 8px;">데이터 신뢰도</div>
        <div class="score-value-large" style="color: ${reliabilityColor}">${scoreData.reliability}</div>
        <div style="font-size: 0.8rem; color: var(--text-tertiary);">${scoreData.totalAttempts}문제 기준</div>
      </div>
    </div>
    
    ${scoreData.estimatedSubjects?.length > 0 ? `
    <div style="margin-top: 12px; padding: 12px 16px; background: rgba(59,130,246,0.08); border-radius: var(--radius-md); color: #1D4ED8; font-size: 0.85rem; line-height: 1.5;">
      <strong>📊 추정 과목:</strong> ${scoreData.estimatedSubjects.join(', ')} — 데이터 5문제 미만으로 전체 평균 정답률로 추정됩니다.
    </div>` : ''}
    <div style="margin-top: 12px; padding: 16px; background: var(--warning-bg); border-radius: var(--radius-md); color: #B45309; font-size: 0.9rem; line-height: 1.5;">
      <strong>💡 참고:</strong> 예상 점수는 현재까지의 학습 데이터를 기반으로 단순 계산됩니다. 실제 시험 결과와 다를 수 있으며, 합격 기준은 총점 240점(과락 40점)입니다.
    </div>
  `;
}

/**
 * 학습 트렌드 렌더링
 * @param {Array} attempts - 문제 풀이 기록
 */
export function renderLearningTrend(attempts) {
  const container = document.getElementById('learning-trend-section');
  if (!container) return;

  if (!attempts || attempts.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">학습 데이터가 없습니다.</div>
    `;
    return;
  }

  const trendData = analyzeLearningTrend(attempts, 14);

  container.innerHTML = `
    <div class="trend-container">
      <div class="trend-item">
        <div style="font-size: 3rem; margin-bottom: 8px;">${trendData.trendIcon}</div>
        <div style="font-size: 1.25rem; font-weight: 700; color: ${trendData.trendColor};">${trendData.trendText}</div>
        <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 4px;">최근 2주 트렌드</div>
      </div>
      
      <div class="trend-item">
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">최근 2주 정답률</div>
        <div style="font-size: 2rem; font-weight: 800; color: var(--primary-color);">${trendData.recentAccuracy}%</div>
        <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 4px;">${trendData.recentAttempts}문제</div>
      </div>
      
      <div class="trend-item">
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">이전 정답률</div>
        <div style="font-size: 2rem; font-weight: 800; color: var(--text-tertiary);">${trendData.previousAccuracy}%</div>
      </div>
      
      <div class="trend-item">
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">변화</div>
        <div style="font-size: 2rem; font-weight: 800; color: ${trendData.trendColor};">
          ${trendData.trend > 0 ? '+' : ''}${trendData.trend}%
        </div>
      </div>
    </div>
  `;
}

/**
 * 취약 문제 렌더링
 * @param {Array} attempts - 문제 풀이 기록
 */
export function renderWeakQuestions(attempts) {
  const container = document.getElementById('weak-questions-section');
  if (!container) return;

  const weakQuestions = analyzeWeakQuestions(attempts);

  if (weakQuestions.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 40px; color: var(--success-color);">
        <div style="font-size: 3.5rem; margin-bottom: 16px;">🎉</div>
        <div style="font-size: 1.4rem; font-weight: 800; margin-bottom: 8px;">완벽합니다!</div>
        <p style="color: var(--text-secondary); opacity: 0.8;">발견된 취약 문제가 없습니다. 모든 문제를 훌륭하게 소화하고 계시네요.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="weak-question-grid">';

  weakQuestions.forEach((q) => {
    const accuracy = (q.correct / q.attempts * 100).toFixed(0);
    const accuracyColor = accuracy < 30 ? '#DC2626' : '#D97706';

    // 1-20번 문제로 변환
    const displayNum = q.number > 20 ? ((q.number - 1) % 20) + 1 : q.number;

    html += `
      <div class="weak-question-card">
        <div class="weak-question-header">
          <div>
            <div class="weak-question-year">${q.year}년</div>
            <div class="weak-question-subject">${q.subject} ${displayNum}번</div>
          </div>
          <div class="weak-question-accuracy" style="color: ${accuracyColor};">${accuracy}%<span class="weak-question-accuracy-label">정답률</span></div>
        </div>

        <div class="weak-question-meta">
          <span class="weak-question-stat">
            ${q.attempts}회 시도 · <strong class="weak-question-wrong">${q.attempts - q.correct}회 오답</strong>
            ${q.consecutiveWrong >= 2 ? ` · ${q.consecutiveWrong}연속` : ''}
          </span>
        </div>

        <button
          class="weak-question-btn"
          onclick="window.location.href='exam/quiz.html?year=${q.year}&subject=${encodeURIComponent(q.subject)}&question=${q.number}'">
          다시 풀기
        </button>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

/**
 * 복습 추천 렌더링
 * @param {Array} attempts - 문제 풀이 기록
 */
export function renderReviewRecommendations(attempts) {
  const container = document.getElementById('review-recommendations-section');
  if (!container) return;

  const recommendations = recommendReviewQuestions(attempts);

  if (recommendations.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
        <div style="font-size: 1.2rem; font-weight: 700;">지금은 복습할 문제가 없어요.</div>
        <p style="margin-top: 8px;">새로운 문제를 풀어보세요!</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 20px; padding: 12px 16px; background: var(--info-bg); border-radius: var(--radius-md); font-size: 0.9rem; color: var(--info-color); border-left: 4px solid var(--info-color);">
      <strong>📚 에빙하우스 간격 복습:</strong> 연속 정답 횟수에 따라 3일→7일→14일→30일 간격으로 복습 시점을 계산합니다.
    </div>
    <div class="review-grid">
  `;

  recommendations.forEach((q) => {
    const daysSince = Math.floor((new Date() - new Date(q.lastAttempt)) / (1000 * 60 * 60 * 24));

    // 상태 뱃지
    let statusBadge = '';
    if (!q.lastCorrect) {
      statusBadge = `<span style="background: var(--danger-bg); color: var(--danger-color); padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">오답</span>`;
    } else {
      const intervalDays = q.reviewIntervalDays || 7;
      const overdueDays = daysSince - intervalDays;
      const overdueText = overdueDays > 0 ? ` (+${overdueDays}일 초과)` : '';
      statusBadge = `<span style="background: var(--warning-bg); color: var(--warning-color); padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">${daysSince}일 경과${overdueText}</span>`;
    }

    // 복습 주기 표시
    const intervalLabel = q.reviewIntervalDays
      ? `<div style="font-size: 0.72rem; color: var(--text-tertiary); margin-top: 2px;">${q.reviewIntervalDays}일 주기 (${q.consecutiveCorrect}연속 정답)</div>`
      : '';

    const displayNum = q.number > 20 ? ((q.number - 1) % 20) + 1 : q.number;

    html += `
      <div class="review-card">
        <div class="review-year">${q.year}년</div>
        <div class="review-title">
          ${q.subject} ${displayNum}번
        </div>
        <div class="review-status">${statusBadge}${intervalLabel}</div>
        <a
          href="exam/quiz.html?year=${q.year}&subject=${encodeURIComponent(q.subject)}&question=${q.number}"
          class="review-btn">
          복습하기
        </a>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

/**
 * 학습 패턴 렌더링
 * @param {Array} attempts - 문제 풀이 기록
 */
export function renderLearningPattern(attempts) {
  const container = document.getElementById('learning-pattern-section');
  if (!container) return;

  if (!attempts || attempts.length === 0) {
    container.innerHTML = `<div class="no-data-message">학습 데이터가 부족합니다.</div>`;
    return;
  }

  const patternData = analyzeLearningPattern(attempts);

  container.innerHTML = `
    <div class="score-grid">
      <div class="score-card score-card-primary">
        <div style="opacity: 0.9; margin-bottom: 8px;">주요 학습 시간</div>
        <div class="score-value-large" style="font-size: 1.8rem;">${patternData.mostActiveTime}</div>
      </div>
      
      <div class="score-card score-card-secondary">
        <div style="opacity: 0.9; margin-bottom: 8px;">현재 연속 학습일</div>
        <div class="score-value-large">${patternData.studyStreak}<span style="font-size:0.5em">일</span></div>
        <div style="font-size: 0.8rem; opacity: 0.75; margin-top: 4px;">최고 ${patternData.maxStreak}일</div>
      </div>
      
      <div class="score-card score-card-info">
        <div style="opacity: 0.9; margin-bottom: 8px;">일평균 풀이</div>
        <div class="score-value-large">${patternData.averageSessionLength}<span style="font-size:0.5em">문제</span></div>
      </div>
      
      <div class="score-card score-card-neutral">
        <div style="color: var(--text-secondary); margin-bottom: 8px;">총 학습일</div>
        <div class="score-value-large" style="color: var(--primary-color)">${patternData.totalStudyDays}<span style="font-size:0.5em">일</span></div>
      </div>
    </div>
    
    <div style="margin-top: 24px; padding: 16px; background: var(--success-bg); border-radius: var(--radius-md); color: var(--success-color); font-size: 0.95rem; border-left: 4px solid var(--success-color);">
      <strong>💪 AI 학습 코멘트:</strong> ${getLearningTip(patternData)}
    </div>
  `;
}

/**
 * 학습 팁 생성
 */
function getLearningTip(patternData) {
  if (patternData.studyStreak >= 7) {
    return '꾸준함이 최고의 재능입니다! 7일 연속 학습 달성을 축하해요.';
  } else if (patternData.averageSessionLength >= 30) {
    return '열정이 대단하시네요! 다만 번아웃이 오지 않도록 적절한 휴식도 잊지 마세요.';
  } else if (patternData.averageSessionLength < 10) {
    return '시작이 반입니다. 하루 10문제만 더 풀어볼까요?';
  } else if (patternData.studyStreak < 3) {
    return '매일 조금씩 푸는 습관이 합격의 지름길입니다. 내일도 만나요!';
  }
  return '지금처럼만 꾸준히 하시면 좋은 결과가 있을 거예요. 화이팅!';
}

export default {
  renderExpectedScore,
  renderLearningTrend,
  renderWeakQuestions,
  renderReviewRecommendations,
  renderLearningPattern
};
