// scorecard-component.js - 세션별 정오표 컴포넌트

import { db, auth } from '../core/firebase-core.js';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { formatRelativeDate } from '../utils/date-utils.js';
import { getScoreColor } from './chart-utils.js';
import { showLoading, hideLoading, showError, showToast } from "../utils/ui-utils.js";

// import { sessionManager } from '../data/session-manager.js';
const sessionManager = window.sessionManager; // 전역 객체에서 참조

/* 정오표 테이블 스타일 개선 */
const styleSheet = document.createElement('style');
styleSheet.textContent = `
.scorecard-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 20px;
  table-layout: fixed;
  word-break: break-word;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.scorecard-table th {
  background-color: #f1f5f9;
  color: #475569;
  font-weight: 700;
  padding: 14px 10px;
  font-size: 0.85rem;
  border-bottom: 2px solid #e2e8f0;
}

.scorecard-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #f1f5f9;
  text-align: center;
  font-size: 0.95rem;
  color: #1e293b;
}

/* 번호 컬럼 */
.scorecard-table th:first-child,
.scorecard-table td:first-child {
  width: 12%;
  font-weight: 700;
}

/* 결과 컬럼 */
.scorecard-table th:last-child,
.scorecard-table td:last-child {
  width: 15%;
}

.scorecard-result-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
}

.scorecard-result-badge.correct {
    background: #ecfdf5;
    color: #047D5A;
}

.scorecard-result-badge.incorrect {
    background: #fef2f2;
    color: #dc2626;
}

/* 개선된 카드 형식 스타일 */
.scorecard-section {
    margin-bottom: 32px;
}

.scorecard-section:last-child {
    margin-bottom: 0;
}

.section-header {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e2e8f0;
}

.section-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-icon {
    font-size: 1.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-weight: 700;
}

.correct-icon {
    background: #ecfdf5;
    color: #047D5A;
}

.incorrect-icon {
    background: #fef2f2;
    color: #dc2626;
}

.section-count {
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    margin-left: 4px;
}

.scorecard-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
}

@media (max-width: 768px) {
    .scorecard-cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
    }
}

.scorecard-question-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    border: 2px solid #e2e8f0;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.scorecard-question-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.correct-card {
    border-color: #0A9E72;
    background: linear-gradient(to bottom, #ecfdf5 0%, #ffffff 20%);
}

.incorrect-card {
    border-color: #ef4444;
    background: linear-gradient(to bottom, #fef2f2 0%, #ffffff 20%);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
}

.question-number {
    font-size: 1rem;
    font-weight: 800;
    color: #1e293b;
}

.result-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
}

.correct-badge {
    background: #0A9E72;
    color: white;
}

.incorrect-badge {
    background: #ef4444;
    color: white;
}

.card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.answer-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.answer-label {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
    min-width: 70px;
}

.answer-value {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e293b;
}

.correct-answer {
    color: #0A9E72;
}

.incorrect-user-answer {
    color: #ef4444;
}

.correct-answer-section {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
}

.correct-answer-highlight {
    color: #0A9E72;
    font-size: 1rem;
    font-weight: 800;
    background: #ecfdf5;
    padding: 4px 10px;
    border-radius: 6px;
    display: inline-block;
}

.no-data-message {
    text-align: center;
    padding: 40px 20px;
    color: #64748b;
    font-size: 1rem;
}

/* 모달 스타일 */
.scorecard-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  transition: all 0.3s ease;
}

.scorecard-modal-content {
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 32px;
  max-width: 800px;
  width: 92%;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: premium-modal-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes premium-modal-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

.scorecard-modal-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.scorecard-modal-header h3 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--primary-color, #1d2f4e);
    margin: 0;
}

.scorecard-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f1f5f9;
  font-size: 20px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.3s ease;
}

.scorecard-modal-close:hover {
  background: #e2e8f0;
  color: #1e293b;
  transform: rotate(90deg);
}

.scorecard-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}

.scorecard-summary-item {
    background: white;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    text-align: center;
}

.scorecard-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 4px;
}

.scorecard-value {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1e293b;
}

@media (max-width: 768px) {
  .scorecard-modal-content {
      padding: 24px 16px;
  }
  .scorecard-summary {
      grid-template-columns: 1fr;
      gap: 10px;
  }
  .scorecard-table {
    font-size: 0.85rem;
  }
}
  .scorecard-table {
    font-size: 0.85rem;
  }
}

/* 과목별 결과 스타일 */
.subject-scores h4, .subject-chart-container h4 {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1e293b;
    margin: 24px 0 16px;
}

.subject-score-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
}

.subject-score-table th {
    background: #f8faec;
    padding: 12px;
    font-size: 0.8rem;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
}

.subject-score-table td {
    padding: 12px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.9rem;
}

.progress-bar-compact {
    height: 8px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
    position: relative;
}

.progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.8s ease;
}

.subject-chart-container {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
}

.chart-bar-container {
    margin-bottom: 16px;
}

.chart-bar-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #475569;
    margin-bottom: 6px;
}

.chart-bar-wrapper {
    height: 12px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
}

.chart-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 1s ease;
}
`;
document.head.appendChild(styleSheet);

/**
 * 세션별 정오표 모달 클래스
 */
export class ScorecardModal {
  /**
   * 정오표 모달 생성
   * @param {string} sessionId - 세션 ID (없으면 세트 데이터 사용)
   * @param {Object} [setData] - 세트 데이터 (sessionId가 없을 때 사용)
   */
  constructor(sessionId, setData = null) {
    this.sessionId = sessionId;
    this.setData = setData;
    this.attempts = [];
    this.sessionData = null;
    this.subjectGroups = {};
    this.modalElement = null;

    // 방어적 코딩 추가: 세트 데이터에 ID 보장
    if (this.setData && !this.setData.id && sessionId) {
      this.setData.id = sessionId;
    }

    // 세트 데이터에 sessionId 추가
    if (this.setData && !this.setData.sessionId && sessionId) {
      this.setData.sessionId = sessionId;
    }
  }

  /**
   * 정오표 모달 표시
   * @returns {Promise<void>}
   */
  async show() {
    try {
      showLoading('정오표 데이터 로드 중...');

      // 세션 데이터 로드
      if (this.sessionId) {
        await this.loadSessionData();
      } else if (this.setData) {
        await this.loadSetData();
      } else {
        throw new Error('세션 ID 또는 세트 데이터가 필요합니다.');
      }

      // 시도 기록 확인
      if (!this.attempts || this.attempts.length === 0) {
        // 전역 데이터에서 마지막 시도
        if (window.userAttempts && (this.sessionId || (this.setData && (this.setData.id || this.setData.sessionId)))) {
          const sessionId = this.sessionId || this.setData.id || this.setData.sessionId;
          this.attempts = window.userAttempts.filter(a => a.sessionId === sessionId);
          console.log(`전역 데이터에서 ${this.attempts.length}개의 시도 기록을 찾았습니다.`);
        }
      }

      // 모달 생성 및 표시
      this.createModal();
      this.renderInitialData();

      // 이벤트 리스너 등록
      this.attachEventListeners();

      hideLoading();
    } catch (error) {
      console.error('정오표 표시 오류:', error);
      hideLoading();
      showError('정오표를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
  }

  /**
   * 모달 닫기 기능
   * @private
   */
  closeModal() {
    // 모달 페이드 아웃 애니메이션
    if (this.modalElement) {
      this.modalElement.style.opacity = '0';

      // 애니메이션 완료 후 모달 제거
      setTimeout(() => {
        if (this.modalElement && this.modalElement.parentNode) {
          this.modalElement.parentNode.removeChild(this.modalElement);
        }
      }, 300); // 300ms는 트랜지션 시간과 일치시키는 것이 좋습니다
    }
  }

  /**
   * 세션 데이터 로드
   * @private
   */
  async loadSessionData() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 세션 문서 로드
    const sessionDoc = await getDoc(doc(db, 'sessions', this.sessionId));

    if (!sessionDoc.exists()) {
      // 세션 문서가 없으면 attempts에서 직접 쿼리
      const attemptsQuery = query(
        collection(db, 'attempts'),
        where('userId', '==', user.uid),
        where('sessionId', '==', this.sessionId)
      );

      const attemptsSnapshot = await getDocs(attemptsQuery);

      if (attemptsSnapshot.empty) {
        throw new Error('세션 데이터를 찾을 수 없습니다.');
      }

      // 시도 데이터 수집
      this.attempts = [];
      attemptsSnapshot.forEach(doc => {
        const data = doc.data();
        // 타임스탬프 처리
        const timestamp = data.timestamp?.toDate?.() || new Date();

        this.attempts.push({
          id: doc.id,
          ...data,
          timestamp: timestamp
        });
      });

      // 세션 정보 구성
      const firstAttempt = this.attempts[0];
      this.sessionData = {
        sessionId: this.sessionId,
        userId: user.uid,
        type: firstAttempt.questionData?.isFromMockExam ? 'mockexam' : 'regular',
        subject: firstAttempt.questionData?.subject || '알 수 없음',
        year: firstAttempt.questionData?.year || '알 수 없음',
        timestamp: firstAttempt.timestamp,
        attempts: this.attempts
      };
    } else {
      // 세션 문서가 있는 경우
      this.sessionData = {
        ...sessionDoc.data(),
        id: sessionDoc.id
      };

      // attempts 컬렉션에서 이 세션의 시도 데이터 로드
      const attemptsQuery = query(
        collection(db, 'attempts'),
        where('userId', '==', user.uid),
        where('sessionId', '==', this.sessionId)
      );

      const attemptsSnapshot = await getDocs(attemptsQuery);

      // 시도 데이터 수집
      this.attempts = [];
      attemptsSnapshot.forEach(doc => {
        const data = doc.data();
        // 타임스탬프 처리
        const timestamp = data.timestamp?.toDate?.() || new Date();

        this.attempts.push({
          id: doc.id,
          ...data,
          timestamp: timestamp
        });
      });

      // 세션 데이터에 시도 정보 추가
      this.sessionData.attempts = this.attempts;
    }

    // 모의고사인 경우 과목별로 그룹화
    if (this.sessionData.type === 'mockexam') {
      this.subjectGroups = {};
      this.attempts.forEach(attempt => {
        const subject = attempt.questionData?.subject;
        if (subject) {
          if (!this.subjectGroups[subject]) {
            this.subjectGroups[subject] = [];
          }
          this.subjectGroups[subject].push(attempt);
        }
      });
    }
  }

  /**
   * 세트 데이터로부터 시도 정보 로드
   * @private
   */
  async loadSetData() {
    try {
      console.log('Loading set data:', this.setData);

      if (!this.setData) {
        console.error('세트 데이터가 제공되지 않았습니다.');
        throw new Error('세트 데이터가 제공되지 않았습니다.');
      }

      // 방어적 코딩: 전역 시도 기록 데이터 활용
      if (!this.setData.attempts || this.setData.attempts.length === 0) {
        const sessionId = this.setData.id || this.setData.sessionId;
        if (sessionId && window.userAttempts) {
          this.setData.attempts = window.userAttempts.filter(a => a.sessionId === sessionId);
          console.log(`전역 데이터에서 ${this.setData.attempts.length}개의 시도 기록을 찾았습니다.`);
        }
      }

      // 모의고사 결과만 있고 시도 기록이 없는 경우 처리
      if (this.setData.type === 'mockexam' && (!this.setData.attempts || this.setData.attempts.length === 0)) {
        if (this.setData.mockExamResult) {
          const mockResult = this.setData.mockExamResult;

          // 세션 데이터 구성
          this.sessionData = {
            title: this.setData.title || `${this.setData.subject} ${this.setData.year}년도`,
            timestamp: mockResult.timestamp || Date.now(),
            sessionId: mockResult.sessionId,
            mockExamInfo: {
              score: mockResult.score || 0,
              totalQuestions: mockResult.totalQuestions || 80,
              correctCount: mockResult.correctCount || 0
            }
          };

          // 빈 시도 배열 초기화
          this.attempts = [];

          // 과목별 점수가 있으면 설정
          if (mockResult.subjectScores && mockResult.subjectScores.length > 0) {
            this.sessionData.subjectScores = mockResult.subjectScores;
          }

          return;
        }
      }

      // 시도 기록이 있는 경우 처리 (기존 로직)
      if (this.setData.attempts && this.setData.attempts.length > 0) {
        // 시도를 날짜순으로 정렬
        this.attempts = this.setData.attempts.sort((a, b) => a.timestamp - b.timestamp);

        // 세션 정보 기록
        const firstAttempt = this.attempts[0];
        const sessionId = firstAttempt.sessionId;

        // 정답 및 오답 개수 계산
        const correctCount = this.attempts.filter(a => a.isCorrect).length;
        const totalQuestions = this.attempts.length;

        this.sessionData = {
          title: this.setData.title || `${this.setData.subject} ${this.setData.year}년도`,
          timestamp: firstAttempt.timestamp,
          sessionId: sessionId,
          subject: this.setData.subject,
          year: this.setData.year
        };

        // 모의고사 결과가 있으면 추가 정보 설정
        if (this.setData.mockExamResult) {
          this.sessionData.mockExamInfo = {
            score: this.setData.mockExamResult.score || 0,
            totalQuestions: this.setData.mockExamResult.totalQuestions || totalQuestions,
            correctCount: this.setData.mockExamResult.correctCount || correctCount
          };

          if (this.setData.mockExamResult.subjectScores && this.setData.mockExamResult.subjectScores.length > 0) {
            this.sessionData.subjectScores = this.setData.mockExamResult.subjectScores;
          }
        }
      } else {
        // 시도 기록이 없는 경우 다시 한번 확인
        const sessionId = this.setData.id || this.setData.sessionId;
        if (sessionId && window.userAttempts) {
          this.attempts = window.userAttempts.filter(a => a.sessionId === sessionId);
          console.log(`재시도: 전역 데이터에서 ${this.attempts.length}개의 시도 기록을 찾았습니다.`);

          if (this.attempts.length > 0) {
            const firstAttempt = this.attempts[0];
            this.sessionData = {
              title: this.setData.title || `${this.setData.subject || firstAttempt.questionData?.subject || '알 수 없음'} 세션`,
              timestamp: firstAttempt.timestamp || Date.now(),
              sessionId: sessionId,
              subject: this.setData.subject || firstAttempt.questionData?.subject,
              year: this.setData.year || firstAttempt.questionData?.year
            };
          } else {
            // 여전히 시도 기록이 없는 경우
            this.attempts = [];
            this.sessionData = {
              title: this.setData.title || `${this.setData.subject} ${this.setData.year || ''}년도`,
              timestamp: Date.now(),
              subject: this.setData.subject,
              year: this.setData.year,
              sessionId: sessionId
            };

            console.warn('시도 기록을 찾을 수 없습니다. 요약 정보만 표시합니다.');
          }
        } else {
          // 세션 ID도 없는 경우
          this.attempts = [];
          this.sessionData = {
            title: this.setData.title || `${this.setData.subject} ${this.setData.year}년도`,
            timestamp: Date.now(),
            subject: this.setData.subject,
            year: this.setData.year
          };
        }
      }
    } catch (error) {
      console.error('Error loading set data:', error);
      throw error;
    }
  }

  /**
   * 모달 요소 생성
   * @private
   */
  createModal() {
    // 기존 모달 제거
    const existingModal = document.querySelector('.scorecard-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // 새 모달 생성
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'scorecard-modal';

    document.body.appendChild(this.modalElement);

    // 모달 표시 애니메이션
    setTimeout(() => {
      this.modalElement.style.opacity = '1';
    }, 10);
  }

  /**
   * 초기 데이터 렌더링
   * @private
   */
  renderInitialData() {
    // 세션 정보 계산
    const totalAttempts = this.attempts.length;

    // 모의고사 결과만 있는 경우에는 이미 적절한 처리가 되어 있으므로 그대로 유지
    if (this.sessionData.mockExamInfo) {
      // 기존 코드 유지
      const mockInfo = this.sessionData.mockExamInfo;
      const correctCount = mockInfo.correctCount || 0;
      const totalQuestions = mockInfo.totalQuestions || 80;
      const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      const score = mockInfo.score || 0;

      // 안전한 타임스탬프 처리
      let timestamp = this.sessionData.timestamp;

      // 타임스탬프가 없거나 유효하지 않은 경우 처리
      if (!timestamp) {
        timestamp = new Date();
      } else if (typeof timestamp === 'object' && timestamp.toDate) {
        // Firestore 타임스탬프 객체인 경우
        timestamp = timestamp.toDate();
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        // 문자열이나 숫자인 경우
        timestamp = new Date(timestamp);
      }

      // 유효한 날짜인지 한번 더 확인
      if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
        timestamp = new Date(); // 여전히 유효하지 않으면 현재 시간 사용
      }

      this.sessionData.timestamp = timestamp;

      // 과목별 점수 탭 HTML 생성
      let tabsHtml = '';

      if (this.sessionData.subjectScores && this.sessionData.subjectScores.length > 0) {
        tabsHtml = `
          <div class="subject-tabs">
            <button class="subject-tab active" data-subject="all">전체 요약</button>
            ${this.sessionData.subjectScores.map(scoreData =>
          `<button class="subject-tab" data-subject="${scoreData.subject}">${scoreData.subject}</button>`
        ).join('')}
          </div>
        `;
      }

      // 모달 내용 구성 - 모의고사 요약 정보만 표시
      const modalContent = `
        <div class="scorecard-modal-content">
          <div class="scorecard-modal-header">
            <h3>${this.sessionData.title || this.sessionData.subject} 결과</h3>
            <span class="scorecard-modal-close">&times;</span>
          </div>
          
          <div class="scorecard-summary">
            <div class="scorecard-summary-item">
              <span class="scorecard-label">응시 일시:</span>
              <span class="scorecard-value">${timestamp.toLocaleString()}</span>
            </div>
            <div class="scorecard-summary-item">
              <span class="scorecard-label">총 문제:</span>
              <span class="scorecard-value">${totalQuestions}문제</span>
            </div>
            <div class="scorecard-summary-item">
              <span class="scorecard-label">점수:</span>
              <span class="scorecard-value">${score}점</span>
            </div>
          </div>
          
          ${tabsHtml}
          
          <div id="mockexam-details" class="mockexam-details">
            <div class="mockexam-summary">
              <h4>모의고사 결과 요약</h4>
              <div class="mockexam-score-display">
                <div class="score-circle" style="background: conic-gradient(#4CAF50 ${accuracy}%, #f3f3f3 0);">
                  <span class="score-text">${score}점</span>
                </div>
              </div>
              <div class="mockexam-stats">
                <div class="stat-item">
                  <span class="stat-label">총 문제</span>
                  <span class="stat-value">${totalQuestions}문제</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">정답</span>
                  <span class="stat-value">${correctCount}문제</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">오답</span>
                  <span class="stat-value">${totalQuestions - correctCount}문제</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">정답률</span>
                  <span class="stat-value">${accuracy}%</span>
                </div>
              </div>
            </div>
            
            <div id="subject-details" class="subject-details">
              <!-- 과목별 결과가 여기에 렌더링됩니다 -->
            </div>
          </div>
          
          <div class="mockexam-note">
            <p>* 개별 문제에 대한 세부 정오표는 제공되지 않습니다.</p>
          </div>
        </div>
      `;

      this.modalElement.innerHTML = modalContent;

      // 과목별 결과 표시 (첫 번째 탭이 기본)
      if (this.sessionData.subjectScores && this.sessionData.subjectScores.length > 0) {
        this.renderSubjectDetails(this.sessionData.subjectScores);
      }

      return;
    }

    // 일반 시도 기록이 있는 경우 처리
    const correctCount = this.attempts.filter(a => a.isCorrect).length;
    const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

    // 안전한 타임스탬프 처리
    let timestamp = this.sessionData.timestamp;

    // 타임스탬프가 없거나 유효하지 않은 경우 처리
    if (!timestamp) {
      timestamp = new Date();
    } else if (typeof timestamp === 'object' && timestamp.toDate) {
      // Firestore 타임스탬프 객체인 경우
      timestamp = timestamp.toDate();
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      // 문자열이나 숫자인 경우
      timestamp = new Date(timestamp);
    }

    // 유효한 날짜인지 한번 더 확인
    if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      // 첫 번째 시도에서 가져오기 시도
      if (this.attempts.length > 0 && this.attempts[0].timestamp) {
        const attemptTimestamp = this.attempts[0].timestamp;

        if (typeof attemptTimestamp === 'object' && attemptTimestamp.toDate) {
          timestamp = attemptTimestamp.toDate();
        } else {
          timestamp = new Date(attemptTimestamp);
        }

        // 여전히 유효하지 않으면 현재 시간 사용
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } else {
        // 여전히 유효하지 않으면 현재 시간 사용
        timestamp = new Date();
      }
    }

    this.sessionData.timestamp = timestamp;

    // 세션 선택 옵션 생성 (여러 세션이 있는 경우)
    let sessionSelectHtml = '';

    if (this.setData && this.setData.sessionCount > 1) {
      // 세션 목록 구성 (고유 세션 ID와 시간)
      const sessionOptions = [];

      // 각 시도를 세션별로 그룹화
      const sessionMap = {};
      this.setData.attempts.forEach(attempt => {
        if (attempt.sessionId) {
          if (!sessionMap[attempt.sessionId]) {
            sessionMap[attempt.sessionId] = {
              id: attempt.sessionId,
              timestamp: new Date(attempt.timestamp),
              attempts: []
            };
          }
          sessionMap[attempt.sessionId].attempts.push(attempt);
        }
      });

      // 시간순 정렬
      const sortedSessions = Object.values(sessionMap).sort((a, b) =>
        b.timestamp - a.timestamp
      );

      // 세션 선택 드롭다운 구성
      sessionSelectHtml = `
        <div class="session-selector">
          <label for="session-select">세션 선택:</label>
          <select id="session-select">
            <option value="all">모든 시도</option>
            ${sortedSessions.map((session, index) => `
              <option value="${session.id}" ${index === 0 ? 'selected' : ''}>
                ${formatRelativeDate(session.timestamp)} (${session.attempts.length}문제)
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    // 과목 탭 HTML 생성
    let tabsHtml = '';

    if (this.sessionData.type === 'mockexam' && Object.keys(this.subjectGroups).length > 0) {
      tabsHtml = `
        <div class="subject-tabs">
          <button class="subject-tab active" data-subject="all">전체 과목</button>
          ${Object.keys(this.subjectGroups).map(subject =>
        `<button class="subject-tab" data-subject="${subject}">${subject}</button>`
      ).join('')}
        </div>
      `;
    }

    // 점수 계산 (1문제당 5점)
    const pointsPerQuestion = 5;
    const rawScore = correctCount * pointsPerQuestion;
    const maxScore = totalAttempts * pointsPerQuestion;

    // 모달 내용 구성
    const modalContent = `
      <div class="scorecard-modal-content">
        <div class="scorecard-modal-header">
          <h3>${this.sessionData.title || this.sessionData.subject} 정오표</h3>
          <span class="scorecard-modal-close">&times;</span>
        </div>
        
          <div class="scorecard-summary">
            <div class="scorecard-summary-item">
              <span class="scorecard-label">풀이 일시</span>
              <span class="scorecard-value">${new Date(this.sessionData.timestamp).toLocaleDateString()}</span>
            </div>
            <div class="scorecard-summary-item">
              <span class="scorecard-label">총 문제</span>
              <span class="scorecard-value">${totalAttempts}문제</span>
            </div>
            <div class="scorecard-summary-item">
              <span class="scorecard-label">내 점수</span>
              <span class="scorecard-value">${rawScore}점</span>
            </div>
          </div>
        
        ${sessionSelectHtml}
        ${tabsHtml}
        
        <div class="scorecard-table-container">
          <!-- 카드 형식으로 표시 (loadScorecardTableData에서 생성) -->
        </div>
    `;

    this.modalElement.innerHTML = modalContent;

    // 초기 정오표 데이터 로드
    this.loadScorecardTableData(this.attempts);
  }

  /**
   * 이벤트 리스너 등록
   * @private
   */
  attachEventListeners() {
    // 닫기 버튼 이벤트
    const closeButtons = this.modalElement.querySelectorAll('.scorecard-modal-close, .scorecard-close-button');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.closeModal();
      });
    });

    // 모달 외부 클릭 시 닫기
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.closeModal();
      }
    });

    // 세션 선택 이벤트
    const sessionSelect = this.modalElement.querySelector('#session-select');
    if (sessionSelect) {
      sessionSelect.addEventListener('change', () => {
        const selectedSessionId = sessionSelect.value;
        this.handleSessionChange(selectedSessionId);
      });
    }

    // 과목 탭 이벤트
    const subjectTabs = this.modalElement.querySelectorAll('.subject-tab');
    if (subjectTabs.length > 0) {
      subjectTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // 탭 활성화
          this.modalElement.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          // 선택된 과목
          const subject = tab.getAttribute('data-subject');

          // 모의고사 결과만 있는 경우 특별 처리
          if (this.sessionData.mockExamInfo) {
            if (subject === 'all') {
              // 전체 요약 표시
              if (this.sessionData.subjectScores) {
                this.renderSubjectDetails(this.sessionData.subjectScores);
              }
            } else {
              // 특정 과목 결과만 표시
              const filteredScores = this.sessionData.subjectScores.filter(s => s.subject === subject);
              this.renderSubjectDetails(filteredScores);
            }
          } else {
            // 일반 시도 기록이 있는 경우 (기존 코드)
            this.handleSubjectChange(subject);
          }
        });
      });
    }
  }

  /**
   * 세션 변경 처리
   * @param {string} sessionId - 세션 ID
   * @private
   */
  handleSessionChange(sessionId) {
    try {
      if (sessionId === 'all') {
        // 모든 세션 데이터 표시
        this.loadScorecardTableData(this.setData.attempts);
      } else {
        // 특정 세션 데이터 필터링
        const sessionAttempts = this.setData.attempts.filter(a => a.sessionId === sessionId);
        this.loadScorecardTableData(sessionAttempts);
      }
    } catch (error) {
      console.error('세션 변경 오류:', error);
      showError('세션 데이터를 로드하는 중 오류가 발생했습니다.');
    }
  }

  /**
   * 과목 변경 처리
   * @param {string} subject - 과목명
   * @private
   */
  handleSubjectChange(subject) {
    try {
      if (subject === 'all') {
        // 모든 과목 데이터 표시
        this.loadScorecardTableData(this.attempts);
      } else {
        // 특정 과목 데이터 필터링
        const subjectAttempts = this.subjectGroups[subject] || [];
        this.loadScorecardTableData(subjectAttempts);
      }
    } catch (error) {
      console.error('과목 변경 오류:', error);
      showError('과목 데이터를 로드하는 중 오류가 발생했습니다.');
    }
  }

  /**
   * 정오표 테이블 데이터 로드 (개선된 버전: 맞은 문제/틀린 문제 분리)
   * @param {Array} attempts - 시도 배열
   * @private
   */
  loadScorecardTableData(attempts) {
    const tableContainer = this.modalElement.querySelector('.scorecard-table-container');
    if (!tableContainer) return;

    // 문제 번호 순으로 정렬
    const sortedAttempts = [...attempts].sort((a, b) => {
      const aNumber = a.questionData?.number !== undefined ? a.questionData.number :
        (a.questionNumber || 0);
      const bNumber = b.questionData?.number !== undefined ? b.questionData.number :
        (b.questionNumber || 0);
      return aNumber - bNumber;
    });

    // 빈 데이터 처리
    if (sortedAttempts.length === 0) {
      tableContainer.innerHTML = '<div class="no-data-message">데이터가 없습니다.</div>';
      return;
    }

    // 맞은 문제와 틀린 문제 분리
    const correctAttempts = sortedAttempts.filter(a => a.isCorrect === true);
    const incorrectAttempts = sortedAttempts.filter(a => a.isCorrect !== true);

    // 문제 정보 추출 헬퍼 함수
    const getQuestionInfo = (attempt, index) => {
      let questionNumber = '?';
      if (attempt.questionData?.number !== undefined) {
        questionNumber = attempt.questionData.number;
      } else if (attempt.questionNumber !== undefined) {
        questionNumber = attempt.questionNumber;
      } else {
        questionNumber = index + 1;
      }

      let userAnswer = '미응답';
      if (attempt.userAnswer !== undefined && attempt.userAnswer !== null) {
        const numericAnswer = parseInt(attempt.userAnswer);
        if (!isNaN(numericAnswer)) {
          userAnswer = `${numericAnswer + 1}번`;
        } else {
          userAnswer = attempt.userAnswer;
        }
      } else if (attempt.answers && Object.keys(attempt.answers).length > 0) {
        const firstAnswer = Object.values(attempt.answers)[0];
        const numericAnswer = parseInt(firstAnswer);
        if (!isNaN(numericAnswer)) {
          userAnswer = `${numericAnswer + 1}번`;
        } else {
          userAnswer = firstAnswer;
        }
      }

      // 정답 추출 (여러 필드 확인)
      let correctAnswer = '정보 없음';
      let answer = null;

      // 시도 객체에서 직접 확인
      if (attempt.correctAnswer !== undefined && attempt.correctAnswer !== null && !isNaN(attempt.correctAnswer)) {
        answer = Number(attempt.correctAnswer);
      }

      // questionData 객체 내부 확인
      if (answer === null && attempt.questionData) {
        if (attempt.questionData.correctAnswer !== undefined && attempt.questionData.correctAnswer !== null && !isNaN(attempt.questionData.correctAnswer)) {
          answer = Number(attempt.questionData.correctAnswer);
        } else if (attempt.questionData.correctOption !== undefined && attempt.questionData.correctOption !== null && !isNaN(attempt.questionData.correctOption)) {
          answer = Number(attempt.questionData.correctOption);
        } else if (attempt.questionData.correct !== undefined && attempt.questionData.correct !== null && !isNaN(attempt.questionData.correct)) {
          answer = Number(attempt.questionData.correct);
        }
      }

      // 정답인 경우 userAnswer 사용
      if (answer === null && attempt.isCorrect === true && attempt.userAnswer !== undefined && attempt.userAnswer !== null && !isNaN(attempt.userAnswer)) {
        answer = Number(attempt.userAnswer);
      }

      if (answer !== null && !isNaN(answer)) {
        correctAnswer = `${answer + 1}번`;
      }

      return { questionNumber, userAnswer, correctAnswer };
    };

    // 카드 생성 헬퍼 함수
    const createCard = (attempt, index, isCorrect) => {
      const { questionNumber, userAnswer, correctAnswer } = getQuestionInfo(attempt, index);
      
      if (isCorrect) {
        return `
          <div class="scorecard-question-card correct-card">
            <div class="card-header">
              <span class="question-number">${questionNumber}번</span>
              <span class="result-badge correct-badge">✓ 정답</span>
            </div>
            <div class="card-content">
              <div class="answer-info">
                <span class="answer-label">선택한 답:</span>
                <span class="answer-value correct-answer">${userAnswer}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="scorecard-question-card incorrect-card">
            <div class="card-header">
              <span class="question-number">${questionNumber}번</span>
              <span class="result-badge incorrect-badge">✗ 오답</span>
            </div>
            <div class="card-content">
              <div class="answer-info">
                <span class="answer-label">선택한 답:</span>
                <span class="answer-value incorrect-user-answer">${userAnswer}</span>
              </div>
              <div class="answer-info correct-answer-section">
                <span class="answer-label">정답:</span>
                <span class="answer-value correct-answer-highlight">${correctAnswer}</span>
              </div>
            </div>
          </div>
        `;
      }
    };

    // HTML 생성
    let html = '';

    // 틀린 문제 섹션 (우선 표시)
    if (incorrectAttempts.length > 0) {
      html += `
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
      html += `
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

    tableContainer.innerHTML = html;
  }


  /**
   * 과목별 결과 표시
   * @param {Array} subjectScores - 과목별 점수 배열
   * @private
   */
  renderSubjectDetails(subjectScores) {
    const detailsContainer = this.modalElement.querySelector('#subject-details');
    if (!detailsContainer) return;

    // 과목별 결과 HTML 생성
    let html = `
      <div class="subject-scores">
        <h4>과목별 상세 결과</h4>
        <table class="subject-score-table">
          <thead>
            <tr>
              <th>과목</th>
              <th>문제 수</th>
              <th>정답 수</th>
              <th>정답률</th>
            </tr>
          </thead>
          <tbody>
    `;

    subjectScores.forEach(subject => {
      const accuracy = subject.total > 0 ? Math.round((subject.correct / subject.total) * 100) : 0;
      const scoreColor = this.getScoreColor(accuracy);

      html += `
        <tr>
          <td class="subject-name">${subject.subject}</td>
          <td class="subject-total">${subject.total}문제</td>
          <td class="subject-correct">${subject.correct}문제</td>
          <td class="subject-accuracy">
            <div class="progress-bar-compact">
              <div class="progress-fill" style="width: ${accuracy}%; background-color: ${scoreColor};"></div>
              <span class="progress-text">${accuracy}%</span>
            </div>
          </td>
        </tr>
      `;
    });

    // 테이블 닫기
    html += `
          </tbody>
        </table>
      </div>
    `;

    // 과목별 그래프 추가 (선택적)
    if (subjectScores.length > 1) {
      html += `
        <div class="subject-chart-container">
          <h4>과목별 성취도 비교</h4>
          <div class="subject-chart">
      `;

      // 간단한 막대 차트 구현
      subjectScores.forEach(subject => {
        const accuracy = subject.total > 0 ? Math.round((subject.correct / subject.total) * 100) : 0;
        const scoreColor = this.getScoreColor(accuracy);

        html += `
          <div class="chart-bar-container">
            <div class="chart-bar-label">${subject.subject}</div>
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="width: ${accuracy}%; background-color: ${scoreColor};">
                <span class="chart-bar-value">${accuracy}%</span>
              </div>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    detailsContainer.innerHTML = html;

    detailsContainer.innerHTML = html;
  }

  /**
   * 점수에 따른 색상 코드 반환
   * @param {number} score - 점수 (0-100)
   * @returns {string} - 색상 코드
   * @private
   */
  getScoreColor(score) {
    if (score >= 90) return '#4CAF50'; // 초록색 (90% 이상)
    if (score >= 75) return '#8BC34A'; // 밝은 초록색 (75% 이상)
    if (score >= 60) return '#CDDC39'; // 라임색 (60% 이상)
    if (score >= 40) return '#FFEB3B'; // 노란색 (40% 이상)
    if (score >= 25) return '#FFC107'; // 황색 (25% 이상)
    return '#F44336';                  // 빨간색 (25% 미만)
  }
}

/**
 * 세션 정오표 모달 표시 함수
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<void>}
 */
export async function showSessionScorecard(sessionId) {
  const modal = new ScorecardModal(sessionId);
  await modal.show();
}

/**
 * 세트 정오표 모달 표시 함수
 * @param {Object} setData - 세트 데이터
 * @returns {Promise<void>}
 */
export async function showSetScorecard(setData) {
  // 방어적 코딩 추가
  if (!setData) {
    console.error('showSetScorecard 함수에 setData가 전달되지 않았습니다.');
    showToast('세트 데이터가 없어 정오표를 표시할 수 없습니다.');
    return;
  }

  console.log('showSetScorecard 호출됨:', setData);

  // 모달 생성 전 데이터 검증
  if (!setData.attempts && !setData.mockExamResult) {
    console.warn('세트에 시도 기록이나 모의고사 결과가 없습니다:', setData);
    // 빈 attempts 배열 추가
    if (!setData.attempts) {
      setData.attempts = [];
    }
  }

  const modal = new ScorecardModal(null, setData);
  await modal.show();
}

// 전역 스코프에 노출
if (typeof window !== 'undefined') {
  window.showSessionScorecard = showSessionScorecard;
  window.showSetScorecard = showSetScorecard;
}