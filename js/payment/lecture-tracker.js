// lecture-tracker.js - 강의 시청 추적 시스템

import { db, auth } from '../core/firebase-core.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * 강의 시청 진행률 업데이트
 * @param {string} lectureId - 강의 ID (예: 'video_001')
 * @param {number} currentTime - 현재 재생 시간 (초)
 * @param {number} duration - 전체 영상 길이 (초)
 * @returns {Promise<Object>} 업데이트 결과
 */
export async function updateLectureProgress(lectureId, currentTime, duration) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('로그인이 필요합니다.');
      return { success: false, error: 'not-logged-in' };
    }

    // 진도율 계산
    const progress = Math.min(Math.round((currentTime / duration) * 100), 100);
    
    // 문서 ID: userId_lectureId
    const progressId = `${user.uid}_${lectureId}`;
    const progressRef = doc(db, 'lectureProgress', progressId);
    
    // 기존 문서 확인
    const existingDoc = await getDoc(progressRef);
    
    if (existingDoc.exists()) {
      // 업데이트 (진도율이 증가한 경우만)
      const currentProgress = existingDoc.data().progress || 0;
      const currentWatchTime = existingDoc.data().watchDuration || 0;
      
      if (currentTime > currentWatchTime || progress > currentProgress) {
        await updateDoc(progressRef, {
          watchDuration: currentTime,
          totalDuration: duration,
          progress: Math.max(progress, currentProgress),
          lastWatchedAt: serverTimestamp(),
          watchCount: increment(1)
        });
        
        console.log(`📹 강의 진도율 업데이트: ${progress}% (${lectureId})`);
      }
    } else {
      // 신규 생성
      await setDoc(progressRef, {
        userId: user.uid,
        userName: user.displayName || user.email || '익명',
        userEmail: user.email || '',
        lectureId: lectureId,
        lectureName: getLectureName(lectureId),
        watchDuration: currentTime,
        totalDuration: duration,
        progress: progress,
        startedAt: serverTimestamp(),
        lastWatchedAt: serverTimestamp(),
        watchCount: 1,
        completed: progress >= 100
      });
      
      console.log(`🎬 새 강의 시청 시작: ${lectureId}`);
    }
    
    return { success: true, progress };
    
  } catch (error) {
    console.error('강의 진도율 업데이트 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 강의 완료 처리
 * @param {string} lectureId - 강의 ID
 * @returns {Promise<Object>} 처리 결과
 */
export async function completeLecture(lectureId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'not-logged-in' };
    }

    const progressId = `${user.uid}_${lectureId}`;
    const progressRef = doc(db, 'lectureProgress', progressId);
    
    await updateDoc(progressRef, {
      progress: 100,
      completed: true,
      completedAt: serverTimestamp(),
      lastWatchedAt: serverTimestamp()
    });
    
    console.log(`✅ 강의 완료: ${lectureId}`);
    return { success: true };
    
  } catch (error) {
    console.error('강의 완료 처리 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 사용자의 강의 진도율 조회
 * @param {string} lectureId - 강의 ID
 * @returns {Promise<Object|null>} 진도율 데이터
 */
export async function getLectureProgress(lectureId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const progressId = `${user.uid}_${lectureId}`;
    const progressRef = doc(db, 'lectureProgress', progressId);
    const progressDoc = await getDoc(progressRef);
    
    if (progressDoc.exists()) {
      return progressDoc.data();
    }
    
    return null;
    
  } catch (error) {
    console.error('강의 진도율 조회 오류:', error);
    return null;
  }
}

/**
 * 환불 가능 여부 확인 (30% 미만 시청 시만 가능)
 * @param {string} lectureId - 강의 ID
 * @returns {Promise<Object>} 환불 가능 여부 및 정보
 */
export async function checkRefundEligibility(lectureId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { eligible: false, reason: 'not-logged-in' };
    }

    const progressData = await getLectureProgress(lectureId);
    
    if (!progressData) {
      // 시청 기록 없음 = 전액 환불 가능
      return {
        eligible: true,
        refundRate: 100,
        reason: '시청 기록 없음'
      };
    }
    
    const progress = progressData.progress || 0;
    
    if (progress === 0) {
      // 전혀 시청 안 함 = 전액 환불
      return {
        eligible: true,
        refundRate: 100,
        reason: '전혀 시청하지 않음'
      };
    } else if (progress < 30) {
      // 30% 미만 시청 = 50% 환불
      return {
        eligible: true,
        refundRate: 50,
        reason: `${progress}% 시청 (30% 미만)`
      };
    } else {
      // 30% 이상 시청 = 환불 불가
      return {
        eligible: false,
        refundRate: 0,
        reason: `${progress}% 시청 (30% 이상)`,
        progress: progress
      };
    }
    
  } catch (error) {
    console.error('환불 가능 여부 확인 오류:', error);
    return { eligible: false, reason: 'error', error: error.message };
  }
}

/**
 * 강의 이름 가져오기
 * @param {string} lectureId - 강의 ID
 * @returns {string} 강의 이름
 */
function getLectureName(lectureId) {
  const lectureNames = {
    'video_001': 'NSCA-CSCS 요약정리본',
    'video_002': '건강운동관리사 운동생리학 요약본',
    'video_003': '병태생리학 압축요약본',
    'video_004': '기능해부학 상지 요약본',
    'video_005': '운동처방론 요약정리본',
    'video_006': '건운사 스페셜테스트 압축본'
  };
  
  return lectureNames[lectureId] || '알 수 없는 강의';
}

// 전역으로 노출
if (typeof window !== 'undefined') {
  window.updateLectureProgress = updateLectureProgress;
  window.completeLecture = completeLecture;
  window.getLectureProgress = getLectureProgress;
  window.checkRefundEligibility = checkRefundEligibility;
}

