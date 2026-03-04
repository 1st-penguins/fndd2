// logger.js - 프로덕션 환경 최적화
const Logger = {
  // 로깅 레벨: 0=없음, 1=오류만, 2=경고까지, 3=정보까지, 4=모든 로그
  // 배포 시에는 1로 설정하여 오류만 표시하세요
  level: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 2 : 1,
  
  // 개발 환경 감지
  isDev: function() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  },
  
  error: function(message) {
    if (this.level >= 1) console.error(message);
  },
  
  warn: function(message) {
    if (this.level >= 2) console.warn(message);
  },
  
  info: function(message) {
    if (this.level >= 3) console.info(message);
  },
  
  log: function(message) {
    if (this.level >= 4) console.log(message);
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

  // 개발 환경에서만 로거 초기화 메시지 출력
if (Logger.isDev() && Logger.level >= 3) {
  console.log('로깅 시스템이 초기화되었습니다. 로그 레벨: ' + Logger.level);
}

// export default 제거