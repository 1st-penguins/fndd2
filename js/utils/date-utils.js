// date-utils.js - 날짜 관련 유틸리티 함수

/**
 * 단순 날짜 포맷팅 (yyyy.MM.dd)
 * @param {Date|Object} date - 날짜 또는 Firestore 타임스탬프
 * @returns {string} 포맷팅된 날짜
 */
export function formatSimpleDate(date) {
  if (!date) return '';
  
  // Firestore 타임스탬프인 경우 Date 객체로 변환
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  
  // 문자열인 경우 Date 객체로 변환
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}.${month}.${day}`;
  } catch (e) {
    console.error('날짜 포맷팅 오류:', e);
    return '';
  }
}

/**
 * 날짜 포맷팅 (yyyy.MM.dd HH:mm 형식)
 * @param {Date|Object} date - 날짜 또는 Firestore 타임스탬프
 * @returns {string} 포맷팅된 날짜와 시간
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  // Firestore 타임스탬프인 경우 Date 객체로 변환
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  
  // 문자열인 경우 Date 객체로 변환
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  } catch (e) {
    console.error('날짜/시간 포맷팅 오류:', e);
    return '';
  }
}

/**
 * 상대적 날짜 포맷팅 (예: '14시간 전', '5일 전', '2주 전', '2달 전', '2년 전')
 * @param {Date|Object} timestamp - 날짜 또는 Firestore 타임스탬프
 * @returns {string} 형식화된 상대 날짜
 */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return '날짜 없음';
  
  // Timestamp 객체인 경우 Date로 변환
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 1분 이내
  if (diff < 60 * 1000) {
    return '방금 전';
  }
  
  // 1시간 이내
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}분 전`;
  }
  
  // 24시간 이내
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}시간 전`;
  }
  
  // 7일 이내
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}일 전`;
  }
  
  // 4주 이내 (약 28일)
  if (diff < 4 * 7 * 24 * 60 * 60 * 1000) {
    const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
    return `${weeks}주 전`;
  }
  
  // 12개월 이내
  if (diff < 12 * 30 * 24 * 60 * 60 * 1000) {
    const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000));
    return `${months}달 전`;
  }
  
  // 그 외 (년 단위)
  const years = Math.floor(diff / (365 * 24 * 60 * 60 * 1000));
  if (years > 0) {
    return `${years}년 전`;
  }
  
  // 예외 처리
  return formatSimpleDate(timestamp);
}

/**
 * 시간 형식 변환 (초 -> mm:ss)
 * @param {number} seconds - 초
 * @returns {string} mm:ss 형식 문자열
 */
export function formatTimeFromSeconds(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * mm:ss 문자열을 초 단위로 변환
 * @param {string} timeString - mm:ss 형식 문자열
 * @returns {number} 초 단위 시간
 */
export function parseTimeToSeconds(timeString) {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  
  return (parts[0] * 60) + parts[1];
}

/**
 * 현재 년도 구하기
 * @returns {number} 현재 년도
 */
export function getCurrentYear() {
  return new Date().getFullYear();
}

/**
 * 현재 월 구하기 (1-12)
 * @returns {number} 현재 월 (1-12)
 */
export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

/**
 * 현재 날짜 구하기 (1-31)
 * @returns {number} 현재 날짜 (1-31)
 */
export function getCurrentDay() {
  return new Date().getDate();
}

/**
 * 오늘 날짜 YYYY-MM-DD 형식으로 반환
 * @returns {string} YYYY-MM-DD 형식 날짜
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 내일 날짜 YYYY-MM-DD 형식으로 반환
 * @returns {string} YYYY-MM-DD 형식 날짜
 */
export function getTomorrowString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 주어진 날짜가 오늘인지 확인
 * @param {Date|Object} date - 날짜 또는 Firestore 타임스탬프
 * @returns {boolean} 오늘 여부
 */
export function isToday(date) {
  if (!date) return false;
  
  // Firestore 타임스탬프인 경우 Date 객체로 변환
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  
  // 문자열인 경우 Date 객체로 변환
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// 전역 객체에 유틸리티 함수 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.formatSimpleDate = formatSimpleDate;
  window.formatDateTime = formatDateTime;
  window.formatRelativeDate = formatRelativeDate;
  window.formatTimeFromSeconds = formatTimeFromSeconds;
  window.parseTimeToSeconds = parseTimeToSeconds;
  window.getTodayString = getTodayString;
}

export default {
  formatSimpleDate,
  formatDateTime,
  formatRelativeDate,
  formatTimeFromSeconds,
  parseTimeToSeconds,
  getCurrentYear,
  getCurrentMonth,
  getCurrentDay,
  getTodayString,
  getTomorrowString,
  isToday
};