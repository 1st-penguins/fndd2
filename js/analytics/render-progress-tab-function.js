// render-progress-tab-function.js - 학습 진행률 탭 렌더링

const SPORTS_YEARS = ['2025', '2024', '2023', '2022', '2021'];
const SPORTS_CATEGORIES = {
  '기본': ['스포츠사회학', '스포츠교육학', '스포츠심리학', '한국체육사', '운동생리학', '운동역학', '스포츠윤리'],
  '전문': ['특수체육론', '유아체육론', '노인체육론'],
};
const SPORTS_SUBJECTS_ALL = [...SPORTS_CATEGORIES['기본'], ...SPORTS_CATEGORIES['전문']];

const SPORTS1_YEARS = ['2025', '2024', '2023', '2022', '2021'];
const SPORTS1_CATEGORIES = {
  '공통 필수': ['운동상해', '체육측정평가론', '트레이닝론'],
  '유형별 고유': ['스포츠영양학', '건강교육론', '장애인스포츠론'],
};
const SPORTS1_SUBJECTS_ALL = [...SPORTS1_CATEGORIES['공통 필수'], ...SPORTS1_CATEGORIES['유형별 고유']];

const HEALTH_YEARS = ['2025', '2024', '2023', '2022', '2021', '2020', '2019'];
const HEALTH_CATEGORIES = {
  '1교시': ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'],
  '2교시': ['운동상해', '기능해부학', '병태생리학', '스포츠심리학'],
};
const HEALTH_SUBJECTS_ALL = [...HEALTH_CATEGORIES['1교시'], ...HEALTH_CATEGORIES['2교시']];

function renderSportsInstructorProgress(container, attempts, years, categories, subjectsAll, examFolder) {
  const normalizeYear = (v) => { const m = String(v ?? '').match(/(20\d{2})/); return m ? m[1] : null; };
  const normalizeSubject = (v) => {
    if (!v) return null;
    try {
      let s = String(v);
      for (let i = 0; i < 3; i++) { const t = decodeURIComponent(s); if (t === s) break; s = t; }
      return s;
    } catch (e) { return String(v); }
  };

  // 연도×과목별 풀이 집계
  const done = {};
  attempts.forEach(a => {
    const q = a?.questionData || {};
    const year = normalizeYear(q.year || a.year);
    const subject = normalizeSubject(q.subject || a.subject);
    if (!year || !subject || !years.includes(year)) return;
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

  years.forEach(year => {
    const yearData = done[year] || {};
    const completedCount = subjectsAll.filter(s => (yearData[s]?.count ?? 0) > 0).length;
    const totalCount = subjectsAll.length;
    const pct = Math.round((completedCount / totalCount) * 100);
    const color = pct === 100 ? '#047D5A' : pct >= 50 ? '#5FB2C9' : '#1D2F4E';

    let categoriesHtml = '';
    Object.entries(categories).forEach(([categoryName, subjects]) => {
      const catDone = subjects.filter(s => (yearData[s]?.count ?? 0) > 0).length;
      const subjectsHtml = subjects.map(subject => {
        const s = yearData[subject];
        const isDone = (s?.count ?? 0) > 0;
        const acc = isDone ? Math.round((s.correct / s.count) * 100) : null;
        const url = `${examFolder}/${year}_${subject}.html`;
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
    .sports-subjects-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    @media (max-width: 480px) { .sports-subjects-grid { grid-template-columns: repeat(2, 1fr); } }
    .sports-subject-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 0.875rem; }
    .sports-subject-item.done { background: rgba(5,150,105,0.08); color: #047D5A; font-weight: 600; }
    .sports-subject-item.not-done { background: var(--color-bg-level-1, #f8fafc); color: var(--color-text-secondary); }
    .subject-name { flex: 1; }
    .subject-acc { font-size: 0.8rem; font-weight: 700; color: #047D5A; }
    .subject-start-btn { font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; background: #1D2F4E; color: #fff; text-decoration: none; white-space: nowrap; }
    .subject-start-btn:hover { background: #2a4570; }
  </style>`;

  container.innerHTML = html;
}

function renderHealthRegularProgress(attempts) {
  const normalizeYear = (v) => { const m = String(v ?? '').match(/(20\d{2})/); return m ? m[1] : null; };
  const normalizeSubject = (v) => {
    if (!v) return null;
    try {
      let s = String(v);
      for (let i = 0; i < 3; i++) { const t = decodeURIComponent(s); if (t === s) break; s = t; }
      return s;
    } catch (e) { return String(v); }
  };

  // 일반문제만 필터링 (모의고사 제외)
  const done = {};
  attempts.forEach(a => {
    const q = a?.questionData || {};
    const isMock = q.isFromMockExam === true || q.type === 'mockexam' || q.mockExamHour != null || q.mockExamPart != null || q.hour != null;
    if (isMock) return;

    const year = normalizeYear(q.year || a.year);
    const subject = normalizeSubject(q.subject || a.subject);
    if (!year || !subject || !HEALTH_YEARS.includes(year)) return;
    if (!HEALTH_SUBJECTS_ALL.includes(subject)) return;
    if (!done[year]) done[year] = {};
    if (!done[year][subject]) done[year][subject] = { count: 0, correct: 0 };
    done[year][subject].count++;
    if (a.isCorrect) done[year][subject].correct++;
  });

  let html = `
    <div class="progress-container" style="margin-top: 32px;">
      <div class="progress-header-section">
        <h3>연도별 일반문제 학습 진행률</h3>
        <p>각 연도별 과목 풀이 현황을 확인할 수 있습니다.</p>
      </div>`;

  HEALTH_YEARS.forEach(year => {
    const yearData = done[year] || {};
    const completedCount = HEALTH_SUBJECTS_ALL.filter(s => (yearData[s]?.count ?? 0) > 0).length;
    const totalCount = HEALTH_SUBJECTS_ALL.length;
    const pct = Math.round((completedCount / totalCount) * 100);
    const color = pct === 100 ? '#1D2F4E' : pct >= 50 ? '#5FB2C9' : '#94a3b8';

    let categoriesHtml = '';
    Object.entries(HEALTH_CATEGORIES).forEach(([categoryName, subjects]) => {
      const catDone = subjects.filter(s => (yearData[s]?.count ?? 0) > 0).length;
      const subjectsHtml = subjects.map(subject => {
        const s = yearData[subject];
        const isDone = (s?.count ?? 0) > 0;
        const acc = isDone ? Math.round((s.correct / s.count) * 100) : null;
        const url = `exam-new/${year}_${subject}.html`;
        return `
          <div class="health-subject-item ${isDone ? 'done' : 'not-done'}">
            <span class="subject-name">${subject}</span>
            ${isDone
              ? `<span class="subject-acc">${acc}%</span>`
              : `<a href="${url}" class="subject-start-btn">풀기</a>`}
          </div>`;
      }).join('');

      categoriesHtml += `
        <div class="health-category-section">
          <div class="health-category-label">${categoryName} <span class="cat-count">${catDone}/${subjects.length}</span></div>
          <div class="health-subjects-grid">${subjectsHtml}</div>
        </div>`;
    });

    html += `
      <div class="health-year-card">
        <div class="health-year-header">
          <span class="health-year-title">${year}년</span>
          <span class="health-year-badge" style="background:${color}">${completedCount}/${totalCount} 과목</span>
        </div>
        <div class="health-year-progress-bar">
          <div class="health-year-progress-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        ${categoriesHtml}
      </div>`;
  });

  html += `</div>`;
  return html;
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

  // 생활스포츠지도사: 2급 과목/연도 사용
  if (certType === 'sports-instructor') {
    return renderSportsInstructorProgress(container, attempts, SPORTS_YEARS, SPORTS_CATEGORIES, SPORTS_SUBJECTS_ALL, 'exam-new-sports');
  }
  // 1급 스포츠지도사: 1급 과목/연도 사용
  if (certType === 'sports-instructor-1') {
    return renderSportsInstructorProgress(container, attempts, SPORTS1_YEARS, SPORTS1_CATEGORIES, SPORTS1_SUBJECTS_ALL, 'exam-new-sports1');
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
        subjectResults: result.subjectResults  ?? null,
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

  let yearsHtml = '';
  years.forEach(year => {
    const h1 = bestScores[`${year}_1`];
    const h2 = bestScores[`${year}_2`];
    const doneCount = (h1 ? 1 : 0) + (h2 ? 1 : 0);
    const yearStatus = doneCount === 2 ? 'all-done' : doneCount === 1 ? 'partial' : 'none';

    const renderHourCard = (hour, best) => {
      const isCompleted = !!best;
      const examUrl = `exam-new/${year}_모의고사_${hour}교시.html?year=${year}&hour=${hour}`;
      const PASS_PCT = 40;       // 과목별 과락 기준 (%)
      const TOTAL_PASS_PCT = 60; // 총점 합격 기준 (%)
      const PTS_PER_Q = 5;       // 1문제당 배점

      let subjectHtml = '';
      let passTagHtml = '';
      let totalPts = '';
      let totalMax = '';

      if (isCompleted) {
        // 실제 점수 계산 (문제수 × 5점)
        const cc = best.correctCount ?? 0;
        const tq = best.totalQuestions ?? 0;
        totalPts = cc * PTS_PER_Q;
        totalMax = tq * PTS_PER_Q;
      }

      if (isCompleted && best.subjectResults) {
        const subjects = Object.entries(best.subjectResults);
        const allSubjectsPass = subjects.every(([, s]) => (s.score || 0) >= PASS_PCT);
        const totalPass = (best.score || 0) >= TOTAL_PASS_PCT;
        const isPass = allSubjectsPass && totalPass;

        passTagHtml = `<span class="pass-tag ${isPass ? 'pass' : 'fail'}">${isPass ? '합격' : (!allSubjectsPass ? '과락' : '불합격')}</span>`;

        subjectHtml = `<div class="subject-detail-list">
          ${subjects.map(([name, s]) => {
            const pct = s.score || 0;
            const pass = pct >= PASS_PCT;
            const pts = (s.correct || 0) * PTS_PER_Q;
            const maxPts = (s.total || 0) * PTS_PER_Q;
            const barColor = pass ? (pct >= 80 ? '#1D2F4E' : '#5FB2C9') : '#ef4444';
            return `
              <div class="subj-row">
                <span class="subj-name">${name}</span>
                <div class="subj-bar-wrap">
                  <div class="subj-bar-bg">
                    <div class="subj-bar-fill" style="width:${Math.max(pct, 3)}%;background:${barColor}"></div>
                    <div class="subj-cutline"></div>
                  </div>
                </div>
                <span class="subj-score ${pass ? '' : 'fail'}">${pts}점</span>
              </div>`;
          }).join('')}
        </div>`;
      }

      return `
        <div class="progress-hour-card ${isCompleted ? 'completed' : 'not-taken'}">
          <div class="hour-header">
            <span class="hour-label">${hour}교시</span>
            <div class="hour-tags">
              ${passTagHtml}
              <span class="hour-badge ${isCompleted ? 'badge-done' : 'badge-yet'}">${isCompleted ? '응시완료' : '미응시'}</span>
            </div>
          </div>
          ${isCompleted ? `
            <div class="hour-score-row">
              <span class="score-big">${totalPts}</span><span class="score-unit-big">/ ${totalMax}점</span>
              <span class="score-sub">(${best.correctCount}/${best.totalQuestions}문제)</span>
            </div>
          ` : `<div class="hour-empty">아직 응시하지 않았습니다</div>`}
          ${subjectHtml}
          <a href="${examUrl}" class="hour-action-btn ${isCompleted ? 'btn-retry' : 'btn-start'}">
            ${isCompleted ? '다시 풀기' : '응시하기'}
          </a>
        </div>`;
    };

    yearsHtml += `
      <div class="progress-year-group ${yearStatus}">
        <div class="year-group-header">
          <span class="year-group-title">${year}년</span>
          <span class="year-group-badge">${doneCount}/2</span>
        </div>
        <div class="year-group-hours">
          ${renderHourCard(1, h1)}
          ${renderHourCard(2, h2)}
        </div>
      </div>`;
  });

  // 일반문제 진행률 HTML 생성
  const regularProgressHtml = renderHealthRegularProgress(attempts);

  container.innerHTML = `
    <div class="progress-sub-tabs">
      <button class="progress-sub-tab active" data-target="progress-regular">일반문제</button>
      <button class="progress-sub-tab" data-target="progress-mock">모의고사</button>
    </div>
    <div id="progress-regular" class="progress-sub-content active">
      ${regularProgressHtml}
    </div>
    <div id="progress-mock" class="progress-sub-content">
      <div class="progress-container">
        <div class="progress-header-section">
          <h3>연도별 모의고사 학습 진행률</h3>
          <p>각 연도별 1교시·2교시 모의고사 응시 현황과 최고 점수를 확인할 수 있습니다.</p>
        </div>
        ${yearsHtml}
      </div>
    </div>
    <style>
      .progress-sub-tabs { display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; }
      .progress-sub-tab { padding: 9px 24px; border: 1px solid rgba(29,47,78,0.12); background: #fff; color: var(--color-text-secondary, #64748b); border-radius: 9999px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
      .progress-sub-tab:hover { background: #f8f9fa; border-color: rgba(95,178,201,0.5); color: var(--color-text-primary, #1D2F4E); }
      .progress-sub-tab.active { background: var(--penguin-navy, #1D2F4E); color: #fff; border-color: var(--penguin-navy, #1D2F4E); }
      .progress-sub-content { display: none; }
      .progress-sub-content.active { display: block; animation: fadeIn 0.3s ease-out; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .progress-year-group { background: var(--color-bg-level-0, #fff); border: 1px solid var(--color-border-primary, #e2e8f0); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
      .progress-year-group.all-done { border-color: rgba(29,47,78,0.3); }
      .year-group-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .year-group-title { font-size: 1.15rem; font-weight: 700; color: var(--color-text-primary, #1D2F4E); }
      .year-group-badge { font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: var(--color-bg-level-1, #f1f5f9); color: var(--color-text-secondary, #64748b); }
      .progress-year-group.all-done .year-group-badge { background: #1D2F4E; color: #fff; }
      .progress-year-group.partial .year-group-badge { background: #5FB2C9; color: #fff; }
      .year-group-hours { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .progress-hour-card { padding: 16px; border-radius: 10px; }
      .progress-hour-card.completed { background: rgba(29,47,78,0.04); }
      .progress-hour-card.not-taken { background: var(--color-bg-level-1, #f8fafc); text-align: center; }
      .hour-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .hour-label { font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary, #1D2F4E); }
      .hour-tags { display: flex; align-items: center; gap: 6px; }
      .hour-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
      .hour-badge.badge-done { background: #1D2F4E; color: #fff; }
      .hour-badge.badge-yet { background: var(--color-bg-level-1, #e2e8f0); color: var(--color-text-secondary, #94a3b8); }
      .pass-tag { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
      .pass-tag.pass { background: rgba(29,47,78,0.1); color: #1D2F4E; }
      .pass-tag.fail { background: rgba(239,68,68,0.1); color: #ef4444; }
      .hour-score-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 10px; }
      .score-big { font-size: 1.5rem; font-weight: 800; color: var(--color-text-primary, #1D2F4E); }
      .score-unit-big { font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary, #64748b); }
      .score-sub { font-size: 0.75rem; color: var(--color-text-tertiary, #94a3b8); margin-left: 4px; }
      .hour-empty { font-size: 0.85rem; color: var(--color-text-tertiary, #94a3b8); padding: 16px 0; }
      .hour-action-btn { display: inline-block; padding: 7px 18px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; text-decoration: none; transition: opacity 0.2s; margin-top: 4px; }
      .hour-action-btn:hover { opacity: 0.85; }
      .hour-action-btn.btn-start { background: #1D2F4E; color: #fff; }
      .hour-action-btn.btn-retry { background: var(--color-bg-level-1, #e2e8f0); color: var(--color-text-primary, #1D2F4E); }
      /* 과목별 수평 막대 */
      .subject-detail-list { display: flex; flex-direction: column; gap: 5px; margin: 8px 0; }
      .subj-row { display: flex; align-items: center; gap: 12px; }
      .subj-name { font-size: 0.68rem; font-weight: 600; color: var(--color-text-secondary, #64748b); width: 5.2em; flex-shrink: 0; white-space: nowrap; }
      .subj-bar-wrap { flex: 1; min-width: 0; }
      .subj-bar-bg { position: relative; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden; }
      .subj-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
      .subj-cutline { position: absolute; left: 40%; top: 0; bottom: 0; width: 1.5px; background: rgba(239,68,68,0.35); }
      .subj-score { font-size: 0.65rem; font-weight: 700; color: #1D2F4E; min-width: 38px; text-align: right; flex-shrink: 0; }
      .subj-score.fail { color: #ef4444; }
      @media (max-width: 480px) {
        .year-group-hours { grid-template-columns: 1fr; gap: 8px; }
        .progress-hour-card { padding: 12px 10px; }
        .score-big { font-size: 1.3rem; }
        .hour-action-btn { padding: 6px 14px; font-size: 0.75rem; }
        .subj-name { font-size: 0.63rem; width: 4.8em; }
        .subj-bar-bg { height: 8px; }
        .subj-score { font-size: 0.6rem; min-width: 34px; }
      }
      /* 건강운동관리사 일반문제 진행률 */
      .health-year-card { background: var(--color-bg-level-0, #fff); border: 1px solid var(--color-border-primary, #e2e8f0); border-radius: 14px; padding: 24px; margin-bottom: 20px; }
      .health-year-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .health-year-title { font-size: 1.2rem; font-weight: 700; color: var(--color-text-primary); }
      .health-year-badge { color: #fff; font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
      .health-year-progress-bar { height: 8px; background: rgba(0,0,0,0.06); border-radius: 99px; overflow: hidden; margin-bottom: 20px; }
      .health-year-progress-fill { height: 100%; border-radius: 99px; transition: width 0.8s ease; }
      .health-category-section { margin-bottom: 16px; }
      .health-category-label { font-size: 0.8rem; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
      .health-subjects-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      @media (max-width: 480px) { .health-subjects-grid { grid-template-columns: repeat(2, 1fr); } }
      .health-subject-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 0.875rem; }
      .health-subject-item.done { background: rgba(29,47,78,0.08); color: #1D2F4E; font-weight: 600; }
      .health-subject-item.not-done { background: var(--color-bg-level-1, #f8fafc); color: var(--color-text-secondary); }
    </style>
  `;

  // 서브탭 전환 이벤트
  container.querySelectorAll('.progress-sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.progress-sub-tab').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.progress-sub-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add('active');
    });
  });
}

// data-management-standalone.js 등 전역 호출 호환용
window.renderProgressTab = renderProgressTabStandalone;
