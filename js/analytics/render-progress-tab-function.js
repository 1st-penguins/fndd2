// render-progress-tab-function.js - 학습 진행률 탭 렌더링

const SPORTS_YEARS = ['2025', '2024', '2023', '2022'];
const SPORTS_CATEGORIES = {
  '기본': ['스포츠사회학', '스포츠교육학', '스포츠심리학', '한국체육사', '운동생리학', '운동역학', '스포츠윤리'],
  '전문': ['특수체육론', '유아체육론', '노인체육론'],
};
const SPORTS_SUBJECTS_ALL = [...SPORTS_CATEGORIES['기본'], ...SPORTS_CATEGORIES['전문']];

function renderSportsInstructorProgress(container, attempts) {
  const normalizeYear = (v) => { const m = String(v ?? '').match(/(20\d{2})/); return m ? m[1] : null; };

  // 연도×과목별 풀이 집계
  const done = {};
  attempts.forEach(a => {
    const q = a?.questionData || {};
    const year = normalizeYear(q.year || a.year);
    const subject = q.subject || a.subject;
    if (!year || !subject || !SPORTS_YEARS.includes(year)) return;
    if (!done[year]) done[year] = {};
    if (!done[year][subject]) done[year][subject] = { count: 0, correct: 0 };
    done[year][subject].count++;
    if (a.isCorrect) done[year][subject].correct++;
  });

  let html = `
    <div class="progress-container">
      <div class="progress-header-section">
        <h3>연도별 기출 학습 진행률</h3>
        <p>각 연도별 기초·특화 과목 풀이 현황을 확인할 수 있습니다.</p>
      </div>`;

  SPORTS_YEARS.forEach(year => {
    const yearData = done[year] || {};
    const completedCount = SPORTS_SUBJECTS_ALL.filter(s => (yearData[s]?.count ?? 0) > 0).length;
    const totalCount = SPORTS_SUBJECTS_ALL.length;
    const pct = Math.round((completedCount / totalCount) * 100);
    const color = pct === 100 ? '#059669' : pct >= 50 ? '#5FB2C9' : '#1D2F4E';

    let categoriesHtml = '';
    Object.entries(SPORTS_CATEGORIES).forEach(([categoryName, subjects]) => {
      const catDone = subjects.filter(s => (yearData[s]?.count ?? 0) > 0).length;
      const subjectsHtml = subjects.map(subject => {
        const s = yearData[subject];
        const isDone = (s?.count ?? 0) > 0;
        const acc = isDone ? Math.round((s.correct / s.count) * 100) : null;
        const url = `exam-sports/${year}_${subject}.html`;
        return `
          <div class="sports-subject-item ${isDone ? 'done' : 'not-done'}">
            <span class="subject-name">${subject}</span>
            ${isDone
              ? `<span class="subject-acc">${acc}%</span>`
              : `<a href="${url}" class="subject-start-btn">풀기</a>`}
          </div>`;
      }).join('');

      categoriesHtml += `
        <div class="sports-category-section">
          <div class="sports-category-label">${categoryName} <span class="cat-count">${catDone}/${subjects.length}</span></div>
          <div class="sports-subjects-grid">${subjectsHtml}</div>
        </div>`;
    });

    html += `
      <div class="sports-year-card">
        <div class="sports-year-header">
          <span class="sports-year-title">${year}년</span>
          <span class="sports-year-badge" style="background:${color}">${completedCount}/${totalCount} 과목</span>
        </div>
        <div class="sports-year-progress-bar">
          <div class="sports-year-progress-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        ${categoriesHtml}
      </div>`;
  });

  html += `</div>`;

  html += `<style>
    .sports-year-card { background: var(--color-bg-level-0, #fff); border: 1px solid var(--color-border-primary, #e2e8f0); border-radius: 14px; padding: 24px; margin-bottom: 20px; }
    .sports-year-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sports-year-title { font-size: 1.2rem; font-weight: 700; color: var(--color-text-primary); }
    .sports-year-badge { color: #fff; font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
    .sports-year-progress-bar { height: 8px; background: rgba(0,0,0,0.06); border-radius: 99px; overflow: hidden; margin-bottom: 20px; }
    .sports-year-progress-fill { height: 100%; border-radius: 99px; transition: width 0.8s ease; }
    .sports-category-section { margin-bottom: 16px; }
    .sports-category-label { font-size: 0.8rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    .cat-count { font-weight: 600; color: var(--color-text-tertiary, #94a3b8); }
    .sports-subjects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .sports-subject-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 0.875rem; }
    .sports-subject-item.done { background: rgba(5,150,105,0.08); color: #059669; font-weight: 600; }
    .sports-subject-item.not-done { background: var(--color-bg-level-1, #f8fafc); color: var(--color-text-secondary); }
    .subject-name { flex: 1; }
    .subject-acc { font-size: 0.8rem; font-weight: 700; color: #059669; }
    .subject-start-btn { font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; background: #1D2F4E; color: #fff; text-decoration: none; white-space: nowrap; }
    .subject-start-btn:hover { background: #2a4570; }
  </style>`;

  container.innerHTML = html;
}

/**
 * 학습 진행률 탭 렌더링
 * @param {Object} [data] - { userProgress, mockExamResults, attempts, certType }
 *   생략 시 window.state / window.userAttempts에서 읽음 (하위 호환)
 */
export function renderProgressTabStandalone(data) {
  const container = document.getElementById('progress-tab');
  if (!container) return;

  // 데이터 소스: 파라미터 우선, 없으면 전역 상태
  const userProgress    = data?.userProgress    ?? window.state?.userProgress    ?? {};
  const mockExamResults = data?.mockExamResults ?? window.state?.mockExamResults ?? [];
  const attempts        = data?.attempts        ?? window.userAttempts           ?? window.state?.attempts ?? [];
  const certType        = data?.certType        ?? localStorage.getItem('currentCertificateType') ?? 'health-manager';

  // 생활스포츠지도사: 연도별 과목 완료율 뷰
  if (certType === 'sports-instructor') {
    return renderSportsInstructorProgress(container, attempts);
  }

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
