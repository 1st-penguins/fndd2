// render-progress-tab-function.js - 학습 진행률 탭 렌더링

/**
 * 학습 진행률 탭 렌더링
 * @param {Object} [data] - { userProgress, mockExamResults, attempts }
 *   생략 시 window.state / window.userAttempts에서 읽음 (하위 호환)
 */
export function renderProgressTabStandalone(data) {
  const container = document.getElementById('progress-tab');
  if (!container) return;

  // 데이터 소스: 파라미터 우선, 없으면 전역 상태
  const userProgress    = data?.userProgress    ?? window.state?.userProgress    ?? {};
  const mockExamResults = data?.mockExamResults ?? window.state?.mockExamResults ?? [];
  const attempts        = data?.attempts        ?? window.userAttempts           ?? window.state?.attempts ?? [];

  // ── 레거시 포맷 정규화 헬퍼 ──────────────────────────────────────
  const normalizeYear = (v) => {
    if (v == null) return null;
    const m = String(v).match(/(20\d{2})/);
    return m ? m[1] : null;
  };

  const normalizeHour = (v) => {
    if (v == null) return null;
    const m = String(v).trim().match(/[12]/);
    return m ? m[0] : null;
  };

  // ── 연도별·교시별 최고 점수 수집 ─────────────────────────────────
  const bestScores = {};

  // 1) mockExamResults
  mockExamResults.forEach(result => {
    const year = normalizeYear(result.year);
    const hour = normalizeHour(result.mockExamHour || result.hour || result.mockExamPart) || '1';
    if (!year || !hour) return;

    const key   = `${year}_${hour}`;
    const score = result.score || 0;
    if (!bestScores[key] || score > bestScores[key].score) {
      bestScores[key] = {
        score,
        correctCount:   result.correctCount   ?? null,
        totalQuestions: result.totalQuestions  ?? null,
      };
    }
  });

  // 2) userProgress.yearlyMockExams (보완)
  const yearlyMockExams = userProgress.yearlyMockExams || {};
  Object.keys(yearlyMockExams).forEach(year => {
    const yearData = yearlyMockExams[year];
    if (!yearData || typeof yearData !== 'object') return;
    Object.keys(yearData).forEach(partKey => {
      const hour = normalizeHour(partKey);
      if (!hour) return;
      const partData = yearData[partKey];
      if (!partData || (partData.completed !== true && partData.score == null)) return;

      const key   = `${year}_${hour}`;
      const score = partData.score || 0;
      if (!bestScores[key] || score > bestScores[key].score) {
        bestScores[key] = {
          score,
          correctCount:   partData.correctCount   ?? null,
          totalQuestions: partData.totalQuestions  ?? null,
        };
      }
    });
  });

  // 3) attempts 기반 fallback (저장 누락 케이스 보완)
  const sessionGroups = {};
  attempts.forEach(attempt => {
    const q      = attempt?.questionData || {};
    const isMock = q.isFromMockExam === true || q.mockExamHour != null || q.mockExamPart != null;
    if (!isMock) return;

    const year = normalizeYear(q.year);
    const hour = normalizeHour(q.mockExamHour || q.mockExamPart || q.hour || '1');
    if (!year || !hour) return;

    const sid      = attempt?.sessionId || `${year}_${hour}_unknown`;
    const groupKey = `${year}_${hour}_${sid}`;

    if (!sessionGroups[groupKey]) {
      sessionGroups[groupKey] = { year, hour, total: 0, correct: 0, latestTs: 0 };
    }
    sessionGroups[groupKey].total++;
    if (attempt?.isCorrect) sessionGroups[groupKey].correct++;

    const rawTs = attempt?.timestamp || q?.timestamp;
    const ts    = rawTs instanceof Date ? rawTs.getTime()
                : (rawTs?.toDate ? rawTs.toDate().getTime() : Date.now());
    if (ts > sessionGroups[groupKey].latestTs) sessionGroups[groupKey].latestTs = ts;
  });

  // year_hour별 최신 세션만 남기기
  const latestByYearHour = {};
  Object.values(sessionGroups).forEach(s => {
    const key = `${s.year}_${s.hour}`;
    if (!latestByYearHour[key] || s.latestTs > latestByYearHour[key].latestTs) {
      latestByYearHour[key] = s;
    }
  });

  Object.entries(latestByYearHour).forEach(([key, s]) => {
    if (bestScores[key]) return; // 더 신뢰도 높은 데이터 우선
    if (!s.total) return;
    bestScores[key] = {
      score:          Math.round((s.correct / s.total) * 100),
      correctCount:   s.correct,
      totalQuestions: s.total,
    };
  });

  // ── HTML 렌더링 ───────────────────────────────────────────────────
  const years = ['2025', '2024', '2023', '2022', '2021', '2020', '2019'];

  let cardsHtml = '';
  years.forEach(year => {
    [1, 2].forEach(hour => {
      const key         = `${year}_${hour}`;
      const best        = bestScores[key];
      const isCompleted = !!best;
      const examUrl     = `exam/${year}_모의고사_${hour}교시.html?year=${year}&hour=${hour}`;

      cardsHtml += `
        <div class="progress-card ${isCompleted ? 'completed' : 'not-taken'}">
          <div class="card-badge ${isCompleted ? 'badge-done' : 'badge-yet'}">
            ${isCompleted ? '응시완료' : '미응시'}
          </div>

          <div class="card-year-session">
            <span class="year-text">${year}년</span>
            <span class="session-text">${hour}교시 모의고사</span>
          </div>

          <div class="card-score-section">
            ${isCompleted ? `
              <div class="score-display">
                <span class="score-value">${best.score}</span>
                <span class="score-unit">점</span>
              </div>
              ${best.correctCount != null && best.totalQuestions != null ? `
                <div class="score-detail">정답 ${best.correctCount} / ${best.totalQuestions}</div>
              ` : ''}
            ` : `
              <div class="score-placeholder">미응시</div>
            `}
          </div>

          <div class="card-footer">
            <a href="${examUrl}" class="progress-action-btn ${isCompleted ? 'btn-retry' : 'btn-start'}">
              ${isCompleted ? '다시 풀기' : '지금 풀기'}
            </a>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = `
    <div class="progress-container">
      <div class="progress-header-section">
        <h3>연도별 모의고사 학습 진행률</h3>
        <p>각 연도별 모의고사 응시 현황과 최고 점수를 확인할 수 있습니다.</p>
      </div>
      <div class="mockexam-cards-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
}

// data-management-standalone.js 등 전역 호출 호환용
window.renderProgressTab = renderProgressTabStandalone;
