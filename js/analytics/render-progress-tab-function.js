// render-progress-tab-function.js - 학습 진행률 탭 렌더링 (개선 버전)
// 디자인 가이드: 프리미엄 카드 UI, 고득점 기록 교체, 안풀었음 표시

/**
 * 학습 진행률 탭 렌더링 - 독립형 함수
 */
export function renderProgressTabStandalone() {
  console.log('학습 진행률 탭 렌더링 시작...');
  const container = document.getElementById('progress-tab');
  if (!container) return;

  // 데이터 가져오기
  const userProgress = window.state?.userProgress || {};
  const mockExamResults = window.state?.mockExamResults || [];
  const attempts = window.userAttempts || window.state?.attempts || [];

  // 연도 정보 (실제 파일 존재하는 연도만 표시)
  const years = ['2025', '2024', '2023', '2022', '2021', '2020', '2019'];

  // 연도별/교시별 최고 점수 분석 (mockExamResults와 userProgress 모두 확인)
  const bestScores = {};
  
  // 1. mockExamResults에서 점수 정보 가져오기
  mockExamResults.forEach(result => {
    const year = result.year;
    // ✅ 기존 데이터 호환성: 여러 필드명 확인 (mockExamHour, hour, mockExamPart 등)
    // 숫자/문자열 모두 처리
    let hour = result.mockExamHour || result.hour || result.mockExamPart;
    if (hour != null) {
      hour = String(hour); // 숫자면 문자열로 변환
    } else {
      hour = "1"; // 기본값
    }
    
    // year와 hour가 유효한지 확인
    if (!year || !hour) {
      console.warn('[학습진행률] 모의고사 결과에 year 또는 hour가 없습니다:', result);
      return;
    }
    
    const key = `${year}_${hour}`;
    const score = result.score || 0;

    if (!bestScores[key] || score > bestScores[key].score) {
      bestScores[key] = {
        score: score,
        id: result.id,
        timestamp: result.timestamp,
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions
      };
    }
  });

  // 2. userProgress.yearlyMockExams에서도 확인 (mockExamResults에 없는 경우 보완)
  const yearlyMockExams = userProgress.yearlyMockExams || {};
  Object.keys(yearlyMockExams).forEach(year => {
    const yearData = yearlyMockExams[year];
    if (yearData && typeof yearData === 'object') {
      // ✅ 기존 데이터 호환성: 교시1, 교시2뿐만 아니라 모든 키 확인
      Object.keys(yearData).forEach(partKey => {
        // "교시1", "교시2" 형식 또는 "1", "2" 형식 모두 처리
        let hour = null;
        if (partKey.startsWith('교시')) {
          hour = partKey.replace('교시', '');
        } else if (/^[12]$/.test(partKey)) {
          hour = partKey;
        } else {
          return; // 다른 형식은 건너뛰기
        }
        
        const partData = yearData[partKey];
        // ✅ completed가 true이거나, score가 있으면 응시한 것으로 간주
        if (partData && (partData.completed === true || partData.score != null || partData.completed === 1)) {
          const key = `${year}_${hour}`;
          const score = partData.score || 0;
          
          // mockExamResults에 없거나, userProgress의 점수가 더 높은 경우 업데이트
          if (!bestScores[key] || score > bestScores[key].score) {
            bestScores[key] = {
              score: score,
              id: partData.examId || null,
              timestamp: partData.timestamp || null,
              correctCount: partData.correctCount || null,
              totalQuestions: partData.totalQuestions || 0
            };
          }
        }
      });
    }
  });

  // 3. attempts(문제풀이 시도) 기반 보완
  // mockExamResults 저장이 누락/지연된 경우에도 모의고사 응시를 반영하기 위한 fallback
  const attemptSessions = {};
  attempts.forEach(attempt => {
    const q = attempt?.questionData || {};
    const isMock = q.isFromMockExam === true || q.mockExamHour != null || q.mockExamPart != null;
    if (!isMock) return;

    const year = q.year ? String(q.year) : null;
    const hour = String(q.mockExamHour || q.mockExamPart || q.hour || '1');
    if (!year || !hour) return;

    const sessionId = attempt?.sessionId || q?.sessionId || `${year}_${hour}_unknown`;
    const groupKey = `${year}_${hour}_${sessionId}`;

    if (!attemptSessions[groupKey]) {
      attemptSessions[groupKey] = {
        year,
        hour,
        sessionId,
        total: 0,
        correct: 0,
        latestTs: 0
      };
    }

    attemptSessions[groupKey].total += 1;
    if (attempt?.isCorrect === true) {
      attemptSessions[groupKey].correct += 1;
    }

    const rawTs = attempt?.timestamp || q?.timestamp;
    const ts = rawTs instanceof Date
      ? rawTs.getTime()
      : (rawTs?.toDate ? rawTs.toDate().getTime() : Date.now());
    if (ts > attemptSessions[groupKey].latestTs) {
      attemptSessions[groupKey].latestTs = ts;
    }
  });

  // year/hour별 최신 세션 기준 점수 계산
  const latestSessionByYearHour = {};
  Object.values(attemptSessions).forEach(session => {
    const key = `${session.year}_${session.hour}`;
    if (!latestSessionByYearHour[key] || session.latestTs > latestSessionByYearHour[key].latestTs) {
      latestSessionByYearHour[key] = session;
    }
  });

  Object.entries(latestSessionByYearHour).forEach(([key, session]) => {
    if (bestScores[key]) return; // 이미 더 신뢰도 높은 데이터가 있으면 유지
    if (!session.total || session.total <= 0) return;

    const score = Math.round((session.correct / session.total) * 100);
    bestScores[key] = {
      score,
      id: session.sessionId || null,
      timestamp: session.latestTs ? new Date(session.latestTs) : null,
      correctCount: session.correct,
      totalQuestions: session.total
    };
  });
  
  // 디버깅: 매칭된 기록 로그
  console.log('[학습진행률] 모의고사 기록 매칭 결과:', {
    mockExamResultsCount: mockExamResults.length,
    attemptsCount: attempts.length,
    yearlyMockExamsKeys: Object.keys(yearlyMockExams),
    bestScoresKeys: Object.keys(bestScores),
    bestScores: bestScores,
    yearlyMockExams: yearlyMockExams
  });

  let html = `
    <div class="progress-container">
      <div class="progress-header-section">
        <h3>🏆 연도별 모의고사 학습 진행률</h3>
        <p>각 연도별 모의고사 응시 현황과 최고 점수를 확인할 수 있습니다.</p>
      </div>
      
      <div class="mockexam-cards-grid">
  `;

  years.forEach(year => {
    // 1교시, 2교시 각각 카드 생성
    [1, 2].forEach(hour => {
      const key = `${year}_${hour}`;
      const best = bestScores[key];
      const isCompleted = !!best;

      const examUrl = `exam/${year}_모의고사_${hour}교시.html`;

      html += `
        <div class="progress-card ${isCompleted ? 'completed' : 'not-taken'}">
          <div class="card-badge ${isCompleted ? 'badge-done' : 'badge-yet'}">
            ${isCompleted ? '응시완료' : '미응시'}
          </div>
          
          <div class="card-content">
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
                  <div class="score-detail">
                    정답: ${best.correctCount}/${best.totalQuestions}
                  </div>
                ` : ''}
              ` : `
                <div class="score-placeholder">
                  데이터 없음
                </div>
              `}
            </div>
          </div>
          
          <div class="card-footer">
            <a href="${examUrl}" class="action-button ${isCompleted ? 'button-retry' : 'button-start'}">
              ${isCompleted ? '다시 풀기' : '지금 풀기'}
            </a>
          </div>
        </div>
      `;
    });
  });

  html += `
      </div>
    </div>
  `;

  // 추가 스타일 (인라인 스타일 또는 별도 스타일 시트)
  const styles = `
    <style>
      .progress-container {
        padding: 20px 0;
      }
      .progress-header-section {
        margin-bottom: 24px;
        text-align: center;
      }
      .progress-header-section h3 {
        font-size: 1.5rem;
        color: #1D2F4E;
        margin-bottom: 8px;
      }
      .progress-header-section p {
        color: #666;
        font-size: 0.95rem;
      }
      .mockexam-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 20px;
        padding: 10px;
      }
      .progress-card {
        background: white;
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        position: relative;
        overflow: hidden;
        border: 1px solid #f0f0f0;
      }
      .progress-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 35px rgba(0,0,0,0.1);
      }
      .progress-card.completed {
        border-top: 4px solid #34A853;
      }
      .progress-card.not-taken {
        border-top: 4px solid #e0e0e0;
        background-color: #fcfcfc;
      }
      .card-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-done {
        background: #E8F5E9;
        color: #34A853;
      }
      .badge-yet {
        background: #F5F5F5;
        color: #9E9E9E;
      }
      .card-year-session {
        margin-top: 10px;
        margin-bottom: 20px;
      }
      .year-text {
        display: block;
        font-size: 1.2rem;
        font-weight: 700;
        color: #1D2F4E;
      }
      .session-text {
        display: block;
        font-size: 0.9rem;
        color: #666;
        margin-top: 2px;
      }
      .card-score-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-bottom: 20px;
        min-height: 80px;
      }
      .score-display {
        text-align: center;
      }
      .score-value {
        font-size: 2.5rem;
        font-weight: 800;
        color: #4285F4;
      }
      .score-unit {
        font-size: 1rem;
        color: #4285F4;
        margin-left: 2px;
      }
      .score-detail {
        font-size: 0.85rem;
        color: #888;
        margin-top: 4px;
      }
      .score-placeholder {
        color: #ccc;
        font-style: italic;
        font-size: 0.9rem;
      }
      .card-footer {
        margin-top: auto;
      }
      .action-button {
        display: block;
        width: 100%;
        padding: 10px;
        text-align: center;
        border-radius: 10px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s;
        font-size: 0.9rem;
      }
      .button-retry {
        background: #f0f7ff;
        color: #4285F4;
        border: 1px solid #4285F4;
      }
      .button-retry:hover {
        background: #4285F4;
        color: white;
      }
      .button-start {
        background: #4285F4;
        color: white;
        border: 1px solid #4285F4;
      }
      .button-start:hover {
        background: #3367D6;
        border-color: #3367D6;
      }
      
      @media (max-width: 480px) {
        .mockexam-cards-grid {
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .progress-card {
          padding: 12px;
        }
        .year-text { font-size: 1rem; }
        .session-text { font-size: 0.75rem; }
        .score-value { font-size: 1.8rem; }
      }
    </style>
  `;

  container.innerHTML = styles + html;
}

// 전역 함수 등록
window.renderProgressTab = renderProgressTabStandalone;

// 페이지 로드 시 또는 필요 시 호출할 수 있도록 준비
console.log('✅ 개선된 학습 진행률 렌더링 함수 로드 완료');