// quiz-timer.js - 문제 풀이 시간 측정 유틸리티

/**
 * 문제별 시간 측정기
 */
class QuizTimer {
  constructor() {
    this.questionStartTime = null;
    this.explanationViewedAt = null;
  }

  /**
   * 문제 시작 시간 기록
   */
  startQuestion() {
    this.questionStartTime = Date.now();
    this.explanationViewedAt = null;
    console.log('⏱️ 문제 풀이 시작');
  }

  /**
   * 해설 조회 시간 기록
   */
  viewExplanation() {
    this.explanationViewedAt = Date.now();
    console.log('📖 해설 조회');
  }

  /**
   * 문제 완료 시 소요 시간 계산
   * @returns {Object} 시간 정보
   */
  endQuestion() {
    if (!this.questionStartTime) {
      return { timeSpent: 0, viewedExplanation: false };
    }

    const endTime = Date.now();
    const timeSpent = Math.round((endTime - this.questionStartTime) / 1000); // 초 단위
    const viewedExplanation = this.explanationViewedAt !== null;

    console.log(`⏱️ 문제 풀이 완료: ${timeSpent}초 (해설 조회: ${viewedExplanation ? '예' : '아니오'})`);

    return {
      timeSpent,
      viewedExplanation
    };
  }

  /**
   * 타이머 리셋
   */
  reset() {
    this.questionStartTime = null;
    this.explanationViewedAt = null;
  }
}

// 전역 인스턴스 생성
export const quizTimer = new QuizTimer();

// 전역으로 노출
if (typeof window !== 'undefined') {
  window.quizTimer = quizTimer;
}

