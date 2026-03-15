// logger.js - 프로덕션 환경 최적화
const Logger = {
  // 로깅 레벨: 0=없음, 1=오류만, 2=경고까지, 3=정보까지, 4=모든 로그
  // 배포 시에는 1로 설정하여 오류만 표시하세요
  level: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 2 : 1,
  
  // 개발 환경 감지
  isDev: function() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  },
  
  error: function(message, ...args) {
    if (this.level >= 1) console.error(message, ...args);
  },

  warn: function(message, ...args) {
    if (this.level >= 2) console.warn(message, ...args);
  },

  info: function(message, ...args) {
    if (this.level >= 3) console.info(message, ...args);
  },

  log: function(message, ...args) {
    if (this.level >= 4) console.log(message, ...args);
  },
  
  // 디버그 로깅 (개발 환경에서만, 객체도 지원)
  debug: function(message, data) {
    if (this.isDev()) {
      if (data) {
        console.log(`[DEBUG] ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  },
  
  // 조건부 로깅 (개발 환경에서만)
  dev: function(message) {
    if (this.isDev()) {
      console.log(message);
    }
  }
};

// 전역으로 등록
window.Logger = Logger;

// 🔇 프로덕션 콘솔 정리: 개발 환경이 아니면 console.log/debug/info 무음 처리
// console.error, console.warn은 유지 (실제 에러/경고는 항상 보여야 함)
if (!Logger.isDev()) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}