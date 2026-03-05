// analytics-question-sets.js - 문제풀이기록 및 약점 분석 관련 기능

import { getScoreColor, getWeaknessColor } from './chart-utils.js';
import { analyzeWeaknesses, generateRecommendations } from './user-analytics.js';
import { getCurrentCertificateType } from '../utils/certificate-utils.js';

function normalizeSetProgress(completed, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const rawCompleted = Math.max(0, Number(completed) || 0);
  const normalizedCompleted = safeTotal > 0 ? Math.min(rawCompleted, safeTotal) : rawCompleted;
  const percentage = safeTotal > 0 ? Math.round((normalizedCompleted / safeTotal) * 100) : 0;

  return {
    total: safeTotal,
    completed: normalizedCompleted,
    percentage
  };
}

/**
 * 문제풀이기록 탭 렌더링
 * @param {Object} cachedData - 캐시된 분석 데이터
 */
export function renderQuestionSetsTab(cachedData) {
  console.log('[analytics-question-sets] 문제풀이기록 탭 렌더링...');

  // 모든 필터에 대해 초기 렌더링
  renderFilteredQuestionSets(cachedData, 'all', 'all', 'all');
}

/**
 * 필터링된 문제풀이기록 렌더링
 * @param {Object} cachedData - 캐시된 분석 데이터
 * @param {string} typeFilter - 유형 필터
 * @param {string} subjectFilter - 과목 필터
 * @param {string} yearFilter - 연도 필터
 */
export async function renderFilteredQuestionSets(cachedData, typeFilter, subjectFilter, yearFilter) {
  const container = document.getElementById('question-sets-container');
  if (!container) return;

  // 로딩 표시
  container.innerHTML = '<div class="loader">기록 불러오는 중...</div>';

  try {
    // 데이터 확인
    const questionSets = cachedData.questionSets || [];

    if (questionSets.length === 0) {
      container.innerHTML = '<div class="no-data">아직 문제풀이기록이 없습니다.</div>';
      return;
    }

    // 필터 적용
    const filteredSets = questionSets.filter(set => {
      let match = true;

      if (typeFilter !== 'all' && set.type !== typeFilter) match = false;
      if (subjectFilter !== 'all' && set.subject !== subjectFilter && set.subject !== 'all') match = false;
      if (yearFilter !== 'all' && set.year !== yearFilter) match = false;

      return match;
    });

    // 결과가 없는 경우
    if (filteredSets.length === 0) {
      container.innerHTML = '<div class="no-data">필터에 맞는 기록이 없습니다.</div>';
      return;
    }

    // HTML 생성
    let html = '';

    filteredSets.forEach(set => {
      const normalizedProgress = normalizeSetProgress(set.completed, set.total);
      const { completed, total, percentage } = normalizedProgress;
      const color = getScoreColor(set.score || 0);

      html += `
        <div class="question-set-item" data-id="${set.id}">
          <div class="set-header">
            <div class="set-title">${set.title || '제목 없음'}</div>
            <div class="set-type-badge ${set.type || 'regular'}">${set.type === 'mockexam' ? '모의고사' : '일반 문제'}</div>
          </div>
          <div class="set-progress">
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${percentage}%; background: ${percentage < 100 ? 'linear-gradient(90deg, #5fb2c9, #1d2f4e)' : '#059669'};"></div>
            </div>
            <div class="progress-text">
              <span>학습 진행률</span>
              <span>${completed}/${total} (${percentage}%)</span>
            </div>
          </div>
          <div class="set-score">
            <span>성취도:</span> 
            <span style="color: ${color};">${set.score || 0}점</span>
          </div>
          <div class="set-actions">
            <button class="set-action-button continue">이어서 풀기</button>
            <button class="set-action-button view-record">정오표보기</button>
            <button class="set-action-button restart">처음부터</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // 버튼 이벤트 리스너 등록
    container.querySelectorAll('.set-action-button').forEach(button => {
      button.addEventListener('click', function () {
        const setItem = this.closest('.question-set-item');
        const setId = setItem.dataset.id;
        const setData = filteredSets.find(set => set.id === setId);

        if (!setData) return;

        if (this.classList.contains('continue')) {
          window.location.href = `quiz.html?set=${setId}&mode=continue`;
        } else if (this.classList.contains('restart')) {
          window.location.href = `quiz.html?set=${setId}&mode=restart`;
        } else if (this.classList.contains('view-record')) {
          // 정오표 보기 (세션 ID 또는 세트 데이터 사용)
          if (window.showSetScorecard) {
            window.showSetScorecard(setData);
          } else {
            console.error('showSetScorecard 함수를 찾을 수 없습니다.');
          }
        }
      });
    });
  } catch (error) {
    console.error('[analytics-question-sets] 문제풀이기록 데이터 로드 오류:', error);
    container.innerHTML = '<div class="error-message">데이터를 불러오는 중 오류가 발생했습니다.</div>';
  }
}

/**
 * 약점 분석 탭 렌더링
 * @param {Object} cachedData - 캐시된 분석 데이터
 */
export function renderWeakAreasTab(cachedData) {
  console.log('[analytics-question-sets] 약점 분석 탭 렌더링...');

  renderWeakAreas(cachedData);
  renderRecommendedSets(cachedData);
}

/**
 * 약점 분석 렌더링
 * @param {Object} cachedData - 캐시된 분석 데이터
 */
export function renderWeakAreas(cachedData) {
  const container = document.getElementById('weak-areas');
  if (!container) return;

  // 데이터 확인
  const attempts = cachedData.attempts || [];
  const mockExamResults = cachedData.mockExamResults || [];
  const certificateType = getCurrentCertificateType();

  // 데이터가 없는 경우
  if (attempts.length === 0 && mockExamResults.length === 0) {
    container.innerHTML = `
      <div class="stats-card">
        <div class="stats-header">약점 과목 분석</div>
        <div class="stats-section">
          <div class="no-data">학습 데이터가 충분하지 않습니다. 더 많은 문제를 풀어보세요.</div>
        </div>
      </div>
    `;
    return;
  }

  // 약점 분석 실행 (문제풀이 기록 + 모의고사 결과 통합)
  const weaknessData = analyzeWeaknesses(attempts, mockExamResults, certificateType);

  // HTML 생성
  let html = '<div class="stats-card"><div class="stats-header">약점 과목 분석</div><div class="stats-section">';

  if (weaknessData.length === 0) {
    html += '<div class="no-data">학습 데이터가 충분하지 않습니다. 더 많은 문제를 풀어보세요.</div>';
  } else {
    html += '<div class="weak-areas-list">';

    weaknessData.forEach(item => {
      const incorrectRate = item.incorrectRate;
      const correctRate = 100 - incorrectRate;
      const correctCount = item.total - item.incorrect;
      
      // 이모지 제거 (약점 분석에서는 이모지 표시 안 함)
      const displayName = item.displayName || item.subject;
      const nameWithoutEmoji = displayName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '');
      
      // 오답률에 따른 색상 조정 (더 부드러운 색상)
      const getSoftColor = (rate) => {
        if (rate >= 60) return '#EF4444'; // Red 500
        if (rate >= 40) return '#F59E0B'; // Amber 500
        return '#F97316'; // Orange 500
      };
      const softColor = getSoftColor(incorrectRate);

      html += `
        <div class="weak-area-item">
          <div class="weak-area-content">
            <div class="weak-area-title-row">
              <h3 class="weak-area-subject">${nameWithoutEmoji}</h3>
              <div class="weak-area-percentage">${incorrectRate.toFixed(1)}%</div>
            </div>
            <div class="weak-area-info-row">
              <div class="weak-area-details">
                <span class="weak-detail-item">
                  <span class="weak-detail-label">시도</span>
                  <span class="weak-detail-value">${item.total}문제</span>
                </span>
                <span class="weak-detail-divider">•</span>
                <span class="weak-detail-item">
                  <span class="weak-detail-label">정답</span>
                  <span class="weak-detail-value">${correctCount}문제</span>
                </span>
                <span class="weak-detail-divider">•</span>
                <span class="weak-detail-item">
                  <span class="weak-detail-label">정답률</span>
                  <span class="weak-detail-value">${correctRate.toFixed(1)}%</span>
                </span>
              </div>
            </div>
            <div class="weak-area-progress-container">
              <div class="weak-area-progress-bar" style="--progress: ${incorrectRate}%; --progress-color: ${softColor};">
                <div class="weak-area-progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
  }

  html += '</div></div>';

  container.innerHTML = html;
}

/**
 * 추천 문제 세트 렌더링
 * @param {Object} cachedData - 캐시된 분석 데이터
 */
export async function renderRecommendedSets(cachedData) {
  const container = document.getElementById('recommended-sets');
  if (!container) return;

  try {
    const attempts = cachedData.attempts || [];
    const mockExamResults = cachedData.mockExamResults || [];
    const certificateType = getCurrentCertificateType();

    // 약점 분석 실행
    const weaknesses = analyzeWeaknesses(attempts, mockExamResults, certificateType);

    // 추천 세트 생성
    const recommendations = await generateRecommendations(weaknesses, attempts, certificateType);

    if (recommendations.length === 0) {
      container.innerHTML = '<div class="no-data">추천할 문제 세트가 없습니다.</div>';
      return;
    }

    let html = '<div class="recommended-sets-list">';
    recommendations.forEach(set => {
      html += `
        <div class="recommended-set-item">
          <div class="recommended-set-header">
            <div class="recommended-set-title">${set.title}</div>
            <div class="recommended-set-type">${set.type === 'mockexam' ? '모의고사' : '일반'}</div>
          </div>
          <div class="recommended-set-info">
            <div class="recommended-set-stats">
              <span>문제 수: ${set.questions}개</span>
              <span>난이도: ${set.difficulty}</span>
            </div>
            <div class="recommended-set-reason">${set.reasonText}</div>
          </div>
          <div class="recommended-set-action">
            <button class="recommended-set-button" data-set-id="${set.id}">문제 풀기</button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;

    // 버튼 이벤트 리스너
    container.querySelectorAll('.recommended-set-button').forEach(button => {
      button.addEventListener('click', function () {
        const setId = this.dataset.setId;
        if (setId) {
          window.location.href = `quiz.html?set=${setId}`;
        }
      });
    });
  } catch (error) {
    console.error('[analytics-question-sets] 추천 세트 렌더링 오류:', error);
    container.innerHTML = '<div class="error-message">추천 세트를 불러오는 중 오류가 발생했습니다.</div>';
  }
}

/**
 * 약점 분석 기능 (기존 user-analytics.js에서 이동/수정)
 * @param {Array} attempts - 문제 풀이 시도 배열
 * @returns {Array} 약점 과목 배열 (오답률 높은 순)
 */
export function analyzeWeaknessesBackup(attempts) {
  // 과목별 통계 초기화
  const subjectStats = {};

  // 시도 데이터 집계
  attempts.forEach(attempt => {
    // questionData.subject 또는 fallback 처리
    let subject = attempt.questionData?.subject;

    // 과목명이 undefined, null 또는 빈 문자열인 경우 '알 수 없음'으로 처리
    if (!subject || subject.trim() === '') {
      return; // 과목이 없는 데이터는 건너뛰기
    }

    if (!subjectStats[subject]) {
      subjectStats[subject] = { total: 0, incorrect: 0 };
    }

    subjectStats[subject].total++;
    if (!attempt.isCorrect) {
      subjectStats[subject].incorrect++;
    }
  });

  // 오답률 계산 및 배열로 변환
  const weaknessData = Object.keys(subjectStats)
    .filter(subject => subjectStats[subject].total >= 5) // 최소 5문제 이상 시도한 과목만
    .map(subject => {
      const { total, incorrect } = subjectStats[subject];
      const incorrectRate = total > 0 ? (incorrect / total) * 100 : 0;

      return {
        subject,
        total,
        incorrect,
        incorrectRate: Math.round(incorrectRate),
        color: getWeaknessColor(Math.round(incorrectRate))
      };
    });

  // 오답률 높은 순으로 정렬
  return weaknessData.sort((a, b) => b.incorrectRate - a.incorrectRate);
}

/**
 * 정오표(Scorecard) 모달 표시 함수
 * @param {Object} setData - 세트 데이터
 */
export function showSetScorecard(setData) {
  // 모달 HTML 생성
  const modalId = 'scorecard-modal';
  let modal = document.getElementById(modalId);

  if (modal) {
    modal.remove(); // 기존 모달 제거
  }

  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.style.zIndex = '10000'; // 최상위 보장

  const normalizedProgress = normalizeSetProgress(setData?.completed, setData?.total);
  const summaryCompleted = normalizedProgress.completed;
  const summaryTotal = normalizedProgress.total;
  const summaryPercent = normalizedProgress.percentage;

  // 문제 데이터가 있는 경우 (세부 기록)
  let cardsHtml = '';
  
  if (setData.attempts && setData.attempts.length > 0) {
    // 문제 번호순 정렬
    const sortedAttempts = [...setData.attempts].sort((a, b) => {
      const numA = a.questionData?.number || 0;
      const numB = b.questionData?.number || 0;
      return numA - numB;
    });

    // 맞은 문제와 틀린 문제 분리
    const correctAttempts = sortedAttempts.filter(a => a.isCorrect === true);
    const incorrectAttempts = sortedAttempts.filter(a => a.isCorrect !== true);

    // 정답 추출 헬퍼 함수 (createQuestionCard와 동일한 로직)
    function getCorrectAnswer(attempt) {
      let answer = null;

      // 시도 객체에서 직접 확인
      if (attempt.correctAnswer !== undefined && attempt.correctAnswer !== null && !isNaN(attempt.correctAnswer)) {
        answer = Number(attempt.correctAnswer) + 1;
      }

      // questionData 객체 내부 확인
      if (answer === null && attempt.questionData) {
        if (attempt.questionData.correctAnswer !== undefined && attempt.questionData.correctAnswer !== null && !isNaN(attempt.questionData.correctAnswer)) {
          answer = Number(attempt.questionData.correctAnswer) + 1;
        } else if (attempt.questionData.correctOption !== undefined && attempt.questionData.correctOption !== null && !isNaN(attempt.questionData.correctOption)) {
          answer = Number(attempt.questionData.correctOption) + 1;
        } else if (attempt.questionData.correct !== undefined && attempt.questionData.correct !== null && !isNaN(attempt.questionData.correct)) {
          answer = Number(attempt.questionData.correct) + 1;
        }
      }

      // 정답인 경우 userAnswer 사용
      if (answer === null && attempt.isCorrect === true && attempt.userAnswer !== undefined && attempt.userAnswer !== null && !isNaN(attempt.userAnswer)) {
        answer = Number(attempt.userAnswer) + 1;
      }

      return answer !== null && !isNaN(answer) ? answer : '-';
    }

    // 카드 생성 헬퍼 함수
    const createCard = (attempt, index, isCorrect) => {
      const questionNum = attempt.questionData?.number || (index + 1);
      const userAnswer = attempt.userAnswer !== undefined ? (attempt.userAnswer + 1) : '-';
      const correctAnswer = getCorrectAnswer(attempt);
      
      if (isCorrect) {
        return `
          <div class="scorecard-question-card correct-card">
            <div class="card-header">
              <span class="question-number">${questionNum}번</span>
              <span class="result-badge correct-badge">✓ 정답</span>
            </div>
            <div class="card-content">
              <div class="answer-info">
                <span class="answer-label">선택한 답:</span>
                <span class="answer-value correct-answer">${userAnswer}번</span>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="scorecard-question-card incorrect-card">
            <div class="card-header">
              <span class="question-number">${questionNum}번</span>
              <span class="result-badge incorrect-badge">✗ 오답</span>
            </div>
            <div class="card-content">
              <div class="answer-info">
                <span class="answer-label">선택한 답:</span>
                <span class="answer-value incorrect-user-answer">${userAnswer}번</span>
              </div>
              <div class="answer-info correct-answer-section">
                <span class="answer-label">정답:</span>
                <span class="answer-value correct-answer-highlight">${correctAnswer}번</span>
              </div>
            </div>
          </div>
        `;
      }
    };

    // 틀린 문제 섹션 (우선 표시)
    if (incorrectAttempts.length > 0) {
      cardsHtml += `
        <div class="scorecard-section incorrect-section">
          <div class="section-header">
            <h4 class="section-title">
              <span class="section-icon incorrect-icon">✗</span>
              틀린 문제 <span class="section-count">${incorrectAttempts.length}개</span>
            </h4>
          </div>
          <div class="scorecard-cards-grid">
            ${incorrectAttempts.map((attempt, idx) => createCard(attempt, idx, false)).join('')}
          </div>
        </div>
      `;
    }

    // 맞은 문제 섹션
    if (correctAttempts.length > 0) {
      cardsHtml += `
        <div class="scorecard-section correct-section">
          <div class="section-header">
            <h4 class="section-title">
              <span class="section-icon correct-icon">✓</span>
              맞은 문제 <span class="section-count">${correctAttempts.length}개</span>
            </h4>
          </div>
          <div class="scorecard-cards-grid">
            ${correctAttempts.map((attempt, idx) => createCard(attempt, idx, true)).join('')}
          </div>
        </div>
      `;
    }
  } else {
    // 상세 시도 기록이 없는 경우
    cardsHtml = '<div class="no-data-message">상세 문제 풀이 기록을 불러올 수 없습니다.</div>';
  }

  modal.innerHTML = `
    <div class="modal-content glass-card" style="max-width: 900px; width: 92%; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #1e293b;">${setData.title || '문제 풀이 결과'}</h3>
        <button class="close-modal-btn" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; cursor: pointer; color: #64748b; transition: all 0.3s; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      
      <div class="scorecard-summary" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
        <div class="summary-item" style="background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">점수</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: ${getScoreColor(setData.score)};">${setData.score}점</div>
        </div>
        <div class="summary-item" style="background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">맞은 문제</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${summaryCompleted} / ${summaryTotal}</div>
        </div>
        <div class="summary-item" style="background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">정답률</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${summaryPercent}%</div>
        </div>
      </div>
      
      <div class="scorecard-table-container">
        ${cardsHtml}
      </div>
      
      <div class="modal-footer" style="margin-top: 32px; text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <button class="btn btn-primary close-modal-btn" style="background: var(--primary-color, #1d2f4e); color: white; border: none; padding: 12px 32px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.3s;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 닫기 이벤트
  const closeBtns = modal.querySelectorAll('.close-modal-btn');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
    });
  });

  // 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
    }
  });
}

// 전역객체에 연결 (HTML onclick 등에서 접근 가능하도록)
window.showSetScorecard = showSetScorecard;

// 모듈 내보내기
export default {
  renderQuestionSetsTab,
  renderFilteredQuestionSets,
  renderWeakAreasTab,
  renderWeakAreas,
  renderRecommendedSets,
  analyzeWeaknessesBackup,
  showSetScorecard
};
