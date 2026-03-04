// js/utils/admin-utils.js
// 관리자 계정 관리 유틸리티

// 관리자 이메일 목록 (firebase-core.js와 동기화)
const ADMIN_EMAILS = [
  'kspo0324@gmail.com',       // 메인 관리자
  'mingdy7283@gmail.com',     // 관리자 2
  'sungsoo702@gmail.com'      // 관리자 3
];

/**
 * 현재 로그인한 사용자가 관리자인지 확인
 * @param {Object} user - Firebase Auth 사용자 객체
 * @returns {boolean} 관리자 여부
 */
export function isAdmin(user) {
  if (!user || !user.email) {
    return false;
  }
  
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/**
 * 관리자 권한 확인 (에러 발생)
 * @param {Object} user - Firebase Auth 사용자 객체
 * @throws {Error} 관리자가 아닐 경우 에러
 */
export function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw new Error('관리자 권한이 필요합니다.');
  }
}

/**
 * 관리자 이메일 추가
 * @param {string} email - 추가할 이메일
 */
export function addAdminEmail(email) {
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
    ADMIN_EMAILS.push(email.toLowerCase());
    console.log(`✅ 관리자 이메일 추가: ${email}`);
  }
}

/**
 * 현재 관리자 목록 조회
 * @returns {string[]} 관리자 이메일 목록
 */
export function getAdminEmails() {
  return [...ADMIN_EMAILS];
}

console.log('🔐 관리자 유틸리티 로드 완료');

