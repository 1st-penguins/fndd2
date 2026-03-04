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
    
    <div style="margin-top: 20px; padding: 16px; background: var(--warning-bg); border-radius: var(--radius-md); color: #B45309; font-size: 0.9rem; line-height: 1.5;">
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

  let html = `
    <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: rgba(255, 251, 235, 0.8); border: 1px solid #FCD34D; border-radius: 12px; color: #92400E;">
      <span style="font-size: 1.2rem;">⚠️</span>
      <span style="font-size: 0.95rem; font-weight: 600;">집중 공략: 정답률 50% 미만 문제들을 모았습니다.</span>
    </div>
    <div class="weak-question-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
  `;

  weakQuestions.forEach((q) => {
    const accuracy = (q.correct / q.attempts * 100).toFixed(1);
    const borderColor = accuracy < 30 ? 'var(--danger-color)' : 'var(--warning-color)';
    const bgColor = accuracy < 30 ? 'rgba(254, 242, 242, 0.5)' : 'rgba(255, 251, 235, 0.5)';

    // 1-20번 문제로 변환
    const displayNum = q.number > 20 ? ((q.number - 1) % 20) + 1 : q.number;

    html += `
      <div class="glass-card" style="padding: 24px; border-left: 5px solid ${borderColor}; background: linear-gradient(135deg, ${bgColor}, rgba(255,255,255,0.8)); transition: transform 0.2s, box-shadow 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-tertiary); font-weight: 700; margin-bottom: 4px;">${q.year}년 기출</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${q.subject}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: 800; color: ${borderColor}; line-height: 1;">${accuracy}%</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">정답률</div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 8px;">
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">
            Q. ${displayNum}번
          </div>
          <div style="height: 12px; width: 1px; background: #ddd;"></div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            <strong style="color: var(--text-primary);">${q.attempts}</strong>번 시도 중 <strong style="color: var(--danger-color);">${q.attempts - q.correct}</strong>번 오답
          </div>
        </div>
        
        <button 
          onclick="window.location.href='exam/quiz.html?year=${q.year}&subject=${encodeURIComponent(q.subject)}&question=${q.number}'"
          style="width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(90deg, ${borderColor}, ${borderColor}dd); color: white; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          ⚡ 다시 풀기
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
      <strong>📚 에빙하우스 복습:</strong> 7일 이상 지났거나 틀렸던 문제를 다시 확인해보세요.
    </div>
    <div class="review-grid">
  `;

  recommendations.forEach((q) => {
    const daysSince = Math.floor((new Date() - new Date(q.lastAttempt)) / (1000 * 60 * 60 * 24));

    // Status Badge
    let statusBadge = '';
    if (!q.lastCorrect) {
      statusBadge = `<span style="background: var(--danger-bg); color: var(--danger-color); padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">오답</span>`;
    } else {
      statusBadge = `<span style="background: var(--warning-bg); color: var(--warning-color); padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">${daysSince}일 전</span>`;
    }

    const displayNum = q.number > 20 ? ((q.number - 1) % 20) + 1 : q.number;

    html += `
      <div class="review-card">
        <div class="review-year">${q.year}년</div>
        <div class="review-title">
          ${q.subject} ${displayNum}번
        </div>
        <div class="review-status">${statusBadge}</div>
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
        <div style="opacity: 0.9; margin-bottom: 8px;">연속 학습일</div>
        <div class="score-value-large">${patternData.studyStreak}<span style="font-size:0.5em">일</span></div>
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
