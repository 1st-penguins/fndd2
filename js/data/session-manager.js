// session-manager.js - 세션 관리 모듈 (개선된 버전)

import { ensureFirebase } from '../core/firebase-core.js';

// 동적으로 가져오기 (초기화 후 사용)
let db, auth;
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  deleteDoc,
  increment,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * 세션 매니저 클래스 - 개선된 버전
 */
class SessionManager {
  constructor() {
    this.currentSessionId = null;
    this.isInitialized = false;

    this.initialize();
  }

  /**
   * 세션 매니저 초기화
   */
  async initialize() {
    try {
      // ✅ Firebase 초기화 및 인증 상태 확인
      if (!auth || !db) {
        // ensureAuthReady를 사용하여 인증 상태가 완전히 복원될 때까지 대기
        const { ensureAuthReady } = await import('../core/firebase-core.js');
        await ensureAuthReady();

        // 동적으로 가져오기
        const { db: dbModule, auth: authModule } = await import('../core/firebase-core.js');
        db = dbModule;
        auth = authModule;

        if (!auth || !db) {
          console.warn('Firebase 초기화 실패. 잠시 후 재시도합니다.');
          setTimeout(() => this.initialize(), 500);
          return;
        }
      }

      // 로그인 상태 확인
      const isLoggedIn = this.isUserLoggedIn();

      if (isLoggedIn) {
        // 기존 세션 확인 (24시간 이내)
        const existingSession = await this.findRecentSession(24);
        if (existingSession) {
          this.currentSessionId = existingSession.id;
        }
      }

      this.isInitialized = true;

      // 인증 변경 리스너 설정
      if (auth && auth.onAuthStateChanged) {
        auth.onAuthStateChanged(user => {
          if (user) {
            // 로그인 시에도 자동 세션 생성하지 않음
          } else {
            // 로그아웃 시 세션 정리
            this.currentSessionId = null;
            localStorage.removeItem('currentSessionId');
          }
        });
      }
    } catch (error) {
      console.error('세션 매니저 초기화 오류:', error);
    }
  }

  /**
   * 로그인 상태 확인
   * @returns {boolean} 로그인 여부
   */
  isUserLoggedIn() {
    return localStorage.getItem('userLoggedIn') === 'true';
  }

  /**
   * 현재 세션 ID 반환
   * @returns {string|null} 현재 세션 ID
   */
  getCurrentSessionId() {
    // 현재 세션 ID가 없으면 localStorage에서 찾아볼 수 있음
    if (!this.currentSessionId) {
      this.currentSessionId = localStorage.getItem('currentSessionId');
    }

    return this.currentSessionId;
  }

  /**
   * Firebase 초기화 확인 헬퍼 함수
   */
  /**
   * Firebase 초기화 및 인증 확인 헬퍼 함수
   */
  async ensureFirebaseReady() {
    if (!auth || !db) {
      const { ensureAuthReady } = await import('../core/firebase-core.js');
      await ensureAuthReady();

      const { db: dbModule, auth: authModule } = await import('../core/firebase-core.js');
      db = dbModule;
      auth = authModule;
    }
  }

  /**
   * 새 세션 시작 (또는 기존 세션 복구)
   * @param {Object} metadata - 세션 메타데이터
   * @param {boolean} allowResume - 기존 세션 복구 허용 여부 (기본값: false)
   * @returns {Object} 생성된 또는 복구된 세션 객체
   */
  async startNewSession(metadata = {}, allowResume = false) {
    try {
      // ✅ Firebase 초기화 확인
      await this.ensureFirebaseReady();

      if (!this.isUserLoggedIn()) {
        console.warn('세션 시작: 로그인이 필요합니다.');
        return null;
      }

      // auth 객체 확인
      if (!auth) {
        console.warn('Firebase 인증이 초기화되지 않았습니다.');
        return null;
      }

      const user = auth.currentUser;
      if (!user) {
        console.warn('세션 시작: 현재 사용자를 찾을 수 없습니다.');
        return null;
      }

      // 모의고사인 경우 기존 세션 복구 시도 (5분 이내 세션)
      if (allowResume && metadata.type === 'mockexam' && metadata.year && metadata.hour) {
        const existingSession = await this.findActiveSessionByFilters({
          type: 'mockexam',
          year: metadata.year,
          hour: metadata.hour
        }, 5 / 60); // 5분 이내 세션 (시간 단위로 변환)

        if (existingSession) {
          console.log('기존 모의고사 세션을 복구했습니다:', existingSession.id);
          this.currentSessionId = existingSession.id;
          this.currentSession = existingSession;
          localStorage.setItem('currentSessionId', existingSession.id);
          return existingSession;
        }
      }

      // 세션 ID 생성
      const now = new Date();
      const dateStr = now.getFullYear() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
      const timeStr = now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');
      const userId = user.uid.substring(0, 6);

      const sessionId = `${dateStr}_${timeStr}_${userId}`;

      // 현재 페이지에서 과목 정보 추출 시도
      let subject = '';
      let year = '';

      // URL에서 과목 정보 추출 시도
      const currentPath = window.location.pathname;
      const filename = currentPath.split('/').pop();

      // 파일명에서 년도와 과목 추출 (YYYY_과목명.html 형식)
      const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
      if (filenameMatch) {
        year = filenameMatch[1];
        try {
          subject = decodeURIComponent(filenameMatch[2]);
        } catch (e) {
          console.warn('과목명 디코딩 오류:', e);
          subject = filenameMatch[2];
        }
      }

      // 로컬 스토리지에서 마지막으로 본 과목 확인
      const lastViewedSubject = localStorage.getItem('lastViewedSubject');
      if (!subject && lastViewedSubject) {
        subject = lastViewedSubject;
      }

      // 최종 과목/년도 정보 확정
      const finalSubject = subject || metadata.subject || '';
      const finalYear = year || metadata.year || '';
      const finalType = metadata.type || 'regular';

      // ✅ 유효성 검사: 유효한 세션 정보가 있는지 확인
      // 유효하지 않은 타이틀 목록
      const invalidTitles = ['학습 세트', '일반문제', '진행도', '점수', '기록보기', '0/20', '0점'];
      const providedTitle = metadata.title || '';
      const hasInvalidTitle = invalidTitles.includes(providedTitle) || 
                             providedTitle.includes('오후') || providedTitle.includes('오전') || 
                             (providedTitle.length > 0 && providedTitle.length < 3);
      
      // 모의고사인 경우: 년도와 교시 정보가 있어야 함
      if (finalType === 'mockexam') {
        const hasMockExamInfo = (finalYear && (metadata.hour || metadata.mockExamHour));
        if (!hasMockExamInfo && (hasInvalidTitle || !providedTitle)) {
          console.warn('세션 저장 거부: 모의고사 정보가 부족하거나 유효하지 않은 타이틀입니다.', metadata);
          return null; // 유효하지 않은 세션은 저장하지 않음
        }
      }
      // 일반 문제인 경우: 과목 또는 년도 정보가 있어야 함
      else {
        const hasValidInfo = finalSubject || finalYear || metadata.questionNumber || metadata.setId;
        if (!hasValidInfo && (hasInvalidTitle || !providedTitle)) {
          console.warn('세션 저장 거부: 과목/년도 정보가 없거나 유효하지 않은 타이틀입니다.', { 
            subject: finalSubject, 
            year: finalYear, 
            title: providedTitle,
            metadata 
          });
          return null; // 유효하지 않은 세션은 저장하지 않음
        }
      }

      // 세션 데이터 준비
      const sessionData = {
        userId: user.uid,
        userName: user.displayName || user.email || '익명',
        userEmail: user.email || '',
        startTime: serverTimestamp(),
        isActive: true,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        },
        // 페이지 정보 추가
        subject: finalSubject,
        year: finalYear,
        // ✅ 타이틀 생성 로직 개선 (2025-12-27)
        title: (() => {
          // 제공된 타이틀이 있고 유효한 경우 사용
          if (metadata.title) {
            const invalidTitles = ['학습 세트', '일반문제', '진행도', '점수', '기록보기', '0/20', '0점'];
            if (!invalidTitles.includes(metadata.title) && 
                !metadata.title.includes('오후') && 
                !metadata.title.includes('오전') &&
                metadata.title.length >= 3) {
              return metadata.title;
            }
          }
          
          // 모의고사인 경우
          if (finalType === 'mockexam' || finalSubject.includes('모의고사')) {
            const mYear = finalYear || '2025';
            const mHour = metadata.hour || metadata.mockExamHour || '1';
            return `${mYear}년 ${mHour}교시 모의고사`;
          }
          // 일반 과목인 경우
          if (finalSubject && finalYear) {
            return `${finalYear}년 ${finalSubject} 기출문제`;
          }
          if (finalSubject) {
            return `${finalSubject} 문제풀이`;
          }
          if (finalYear) {
            return `${finalYear}년 문제풀이`;
          }
          // 유효성 검사를 통과했지만 타이틀을 만들 수 없는 경우는 없어야 함
          // 하지만 안전장치로 기본값 제공 (이 경우는 발생하지 않아야 함)
          return `문제풀이 ${new Date().toLocaleDateString()}`;
        })(),
        type: finalType,
        ...metadata
      };

      // Firestore에 세션 데이터 저장
      await setDoc(doc(db, 'sessions', sessionId), sessionData);

      this.currentSessionId = sessionId;
      this.currentSession = {
        id: sessionId,
        ...sessionData
      };

      // 로컬 스토리지에도 저장 (백업용)
      localStorage.setItem('currentSessionId', sessionId);

      return {
        id: sessionId,
        ...sessionData
      };
    } catch (error) {
      console.error('세션 시작 오류:', error);
      return null;
    }
  }

  /**
   * 특정 조건의 활성 세션 찾기 (모의고사 복구용)
   * @param {Object} filters - 필터 조건 { year, hour, type }
   * @param {number} hoursLimit - 몇 시간 이내의 세션을 찾을지 (기본값: 24시간)
   * @returns {Object|null} 찾은 세션 또는 null
   */
  async findActiveSessionByFilters(filters = {}, hoursLimit = 24) {
    try {
      // ✅ Firebase 초기화 확인
      await this.ensureFirebaseReady();

      if (!this.isUserLoggedIn()) {
        return null;
      }

      // auth 객체 확인
      if (!auth) {
        console.warn('Firebase 인증이 초기화되지 않았습니다.');
        return null;
      }

      const user = auth.currentUser;
      if (!user) {
        return null;
      }

      // 시간 제한 설정 (hoursLimit이 1보다 작으면 분 단위로 처리)
      const timeLimit = new Date();
      if (hoursLimit < 1) {
        // 분 단위 (예: 5분 = 5/60 시간)
        timeLimit.setMinutes(timeLimit.getMinutes() - (hoursLimit * 60));
      } else {
        timeLimit.setHours(timeLimit.getHours() - hoursLimit);
      }

      // 쿼리 조건 구성
      let sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        where('isActive', '==', true)
      );

      // ✅ 인덱스 없이도 작동하도록 쿼리 단순화
      // 필터 조건은 클라이언트 측에서 처리
      // 최신순 정렬
      try {
        sessionsQuery = query(sessionsQuery, orderBy('startTime', 'desc'), limit(50));
      } catch (error) {
        // orderBy가 실패하면 (인덱스 없음) limit만 적용
        sessionsQuery = query(sessionsQuery, limit(50));
      }

      const snapshot = await getDocs(sessionsQuery);

      if (snapshot.empty) {
        return null;
      }

      // 시간 제한 내의 세션 찾기 (클라이언트 측 필터링)
      for (const doc of snapshot.docs) {
        const session = {
          id: doc.id,
          ...doc.data()
        };

        // 필터 조건 확인 (클라이언트 측)
        if (filters.type && session.type !== filters.type) {
          continue;
        }
        if (filters.year && session.year !== filters.year) {
          continue;
        }
        if (filters.hour && session.hour !== filters.hour) {
          continue;
        }

        // 시간 비교
        let sessionTime;
        if (session.startTime && typeof session.startTime.toDate === 'function') {
          sessionTime = session.startTime.toDate();
        } else if (session.startTime) {
          sessionTime = new Date(session.startTime);
        } else {
          continue;
        }

        // 시간 제한 내에 있으면 반환
        if (sessionTime >= timeLimit) {
          return session;
        }
      }

      return null;
    } catch (error) {
      console.error('활성 세션 찾기 오류:', error);
      return null;
    }
  }

  /**
   * 최근 세션 찾기
   * @param {number} hoursLimit - 몇 시간 이내의 세션을 찾을지 (기본값: 12시간)
   * @returns {Object|null} 찾은 세션 또는 null
   */
  async findRecentSession(hoursLimit = 12) {
    try {
      // ✅ Firebase 초기화 확인
      await this.ensureFirebaseReady();

      if (!this.isUserLoggedIn()) {
        return null;
      }

      // auth 객체 확인
      if (!auth) {
        console.warn('Firebase 인증이 초기화되지 않았습니다.');
        return null;
      }

      const user = auth.currentUser;
      if (!user) {
        return null;
      }

      // 시간 제한 설정 (현재 시간으로부터 hoursLimit 시간 전)
      const timeLimit = new Date();
      timeLimit.setHours(timeLimit.getHours() - hoursLimit);

      // 최근 세션 쿼리
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        where('isActive', '==', true),
        orderBy('startTime', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(sessionsQuery);

      if (snapshot.empty) {
        return null;
      }

      const session = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };

      // 시간 비교 (timestamp가 Firestore 타임스탬프인 경우)
      let sessionTime;
      if (session.startTime && typeof session.startTime.toDate === 'function') {
        sessionTime = session.startTime.toDate();
      } else if (session.startTime) {
        sessionTime = new Date(session.startTime);
      } else {
        return null; // 시작 시간이 없으면 무효
      }

      // 시간 제한 내에 있는지 확인
      if (sessionTime >= timeLimit) {
        return session;
      }

      return null;
    } catch (error) {
      console.error('최근 세션 찾기 오류:', error);
      return null;
    }
  }

  /**
   * 세션 종료
   * @param {Object} stats - 세션 통계 정보
   * @returns {boolean} 성공 여부
   */
  async endSession(stats = {}) {
    try {
      // ✅ Firebase 초기화 확인
      await this.ensureFirebaseReady();

      // 세션 ID 확인
      const sessionId = this.getCurrentSessionId();
      if (!sessionId) {
        console.warn('종료할 세션이 없습니다.');
        return false;
      }

      // Firestore 업데이트
      const sessionRef = doc(db, 'sessions', sessionId);

      // 세션 문서 가져오기 (존재 확인)
      const sessionDoc = await getDoc(sessionRef);
      if (!sessionDoc.exists()) {
        console.warn(`세션 ${sessionId}이 존재하지 않습니다.`);
        return false;
      }

      // 세션 데이터 업데이트
      await updateDoc(sessionRef, {
        endTime: serverTimestamp(),
        isActive: false,
        duration: increment(1), // 더미 값, 서버에서 계산
        stats: stats
      });

      console.log('세션이 종료되었습니다:', sessionId);

      // 세션 카운터 초기화
      this.currentSessionId = null;
      localStorage.removeItem('currentSessionId');

      return true;
    } catch (error) {
      console.error('세션 종료 오류:', error);
      return false;
    }
  }

  /**
   * 빈 세션 정리 (시도 기록이 없는 세션 삭제) - 수정된 버전
   * @param {number} minutes - 몇 분 이상 지난 세션을 정리할지
   * @returns {number} 정리된 세션 수
   */
  async cleanupEmptySessions(minutes = 30) {
    try {
      // ✅ Firebase 초기화 확인
      await this.ensureFirebaseReady();

      if (!this.isUserLoggedIn()) {
        return 0;
      }

      // auth 객체 확인
      if (!auth) {
        console.warn('Firebase 인증이 초기화되지 않았습니다.');
        return 0;
      }

      const user = auth.currentUser;
      if (!user) {
        return 0;
      }

      // 시간 제한 설정
      const timeLimit = new Date();
      timeLimit.setMinutes(timeLimit.getMinutes() - minutes);

      // 현재 세션 제외
      const currentSessionId = this.getCurrentSessionId();

      // 세션 쿼리
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(
        sessionsRef,
        where('userId', '==', user.uid),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(sessionsQuery);

      if (snapshot.empty) {
        return 0;
      }

      let deletedCount = 0;
      const batch = writeBatch(db);

      // 각 세션에 대해 시도 기록 확인
      for (const doc of snapshot.docs) {
        const sessionId = doc.id;
        const sessionData = doc.data();

        // 현재 세션은 건너뜀
        if (sessionId === currentSessionId) {
          continue;
        }

        // 시간 확인
        const startTime = sessionData.startTime;
        let sessionTime;

        if (startTime && typeof startTime.toDate === 'function') {
          sessionTime = startTime.toDate();
        } else if (startTime) {
          sessionTime = new Date(startTime);
        } else {
          continue; // 시작 시간이 없으면 건너뜀
        }

        // 시간 제한보다 최근이면 건너뜀
        if (sessionTime > timeLimit) {
          continue;
        }

        // ✅ 유효하지 않은 세션 검사: 타이틀이 유효하지 않은 경우 삭제
        const title = sessionData.title || '';
        const subject = sessionData.subject || '';
        const year = sessionData.year || '';
        const type = sessionData.type || 'regular';

        // 유효하지 않은 타이틀 목록 (UI 텍스트나 빈 값)
        const invalidTitles = ['학습 세트', '일반문제', '진행도', '점수', '기록보기', '0/20', '0점'];
        const hasInvalidTitle = invalidTitles.includes(title) || 
                               title.includes('오후') || title.includes('오전') || 
                               title.length === 0;

        // 유효성 검사: 유효한 정보가 없고 유효하지 않은 타이틀을 가진 경우
        const hasNoValidInfo = !subject && !year && !sessionData.setId && !sessionData.questionNumber;
        const shouldDelete = hasInvalidTitle && hasNoValidInfo;

        // 시도 기록 확인
        const attemptsRef = collection(db, 'attempts');
        const attemptsQuery = query(
          attemptsRef,
          where('sessionId', '==', sessionId),
          limit(1)
        );

        const attemptsSnapshot = await getDocs(attemptsQuery);

        // 시도 기록이 없거나 유효하지 않은 세션이면 삭제 대상
        if (attemptsSnapshot.empty || shouldDelete) {
          console.log(`삭제 대상 세션: ${sessionId}`, { title, subject, year, hasAttempts: !attemptsSnapshot.empty, shouldDelete });
          batch.delete(doc.ref);
          deletedCount++;
        }
      }

      // 배치 커밋
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`${deletedCount}개의 빈 세션이 정리되었습니다.`);
      }

      return deletedCount;
    } catch (error) {
      console.error('세션 정리 오류:', error);
      return 0;
    }
  }
}

// 싱글톤 인스턴스 생성 및 전역 변수에 할당
if (typeof window !== 'undefined' && !window.sessionManager) {
  window.sessionManager = new SessionManager();
}

// 내보내기
export const sessionManager = window.sessionManager;

export default sessionManager;