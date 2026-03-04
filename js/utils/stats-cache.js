// stats-cache.js - 통계 데이터 캐싱 매니저

/**
 * 통계 캐시 매니저
 * Firebase 읽기 비용 절감을 위한 클라이언트 사이드 캐싱
 */
class StatsCacheManager {
  constructor() {
    this.storage = new Map();
    this.ttl = 5 * 60 * 1000; // 5분 (300,000ms)
    this.maxSize = 50; // 최대 캐시 항목 수
  }
  
  /**
   * 캐시 키 생성
   * @param {string} prefix - 캐시 접두사
   * @param {Object} params - 캐시 파라미터
   * @returns {string} 캐시 키
   */
  generateKey(prefix, params = {}) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    
    return `${prefix}|${paramStr}`;
  }
  
  /**
   * 캐시에서 데이터 조회
   * @param {string} key - 캐시 키
   * @returns {any|null} 캐시된 데이터 또는 null
   */
  get(key) {
    const item = this.storage.get(key);
    
    if (!item) {
      return null;
    }
    
    // TTL 확인
    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.storage.delete(key);
      console.log(`🗑️ 캐시 만료: ${key}`);
      return null;
    }
    
    console.log(`✅ 캐시 적중: ${key} (${Math.round((now - item.timestamp) / 1000)}초 전)`);
    return item.data;
  }
  
  /**
   * 캐시에 데이터 저장
   * @param {string} key - 캐시 키
   * @param {any} data - 저장할 데이터
   */
  set(key, data) {
    // 최대 크기 확인
    if (this.storage.size >= this.maxSize) {
      // 가장 오래된 항목 제거 (LRU)
      const oldestKey = Array.from(this.storage.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      
      this.storage.delete(oldestKey);
      console.log(`🗑️ 캐시 용량 초과, 제거: ${oldestKey}`);
    }
    
    this.storage.set(key, {
      data,
      timestamp: Date.now()
    });
    
    console.log(`💾 캐시 저장: ${key} (크기: ${this.storage.size}/${this.maxSize})`);
  }
  
  /**
   * 특정 키 또는 패턴 삭제
   * @param {string|RegExp} pattern - 삭제할 키 또는 패턴
   */
  delete(pattern) {
    if (typeof pattern === 'string') {
      const deleted = this.storage.delete(pattern);
      if (deleted) {
        console.log(`🗑️ 캐시 삭제: ${pattern}`);
      }
      return deleted;
    }
    
    // RegExp 패턴
    let count = 0;
    for (const key of this.storage.keys()) {
      if (pattern.test(key)) {
        this.storage.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`🗑️ 캐시 삭제 (패턴): ${pattern} (${count}개)`);
    }
    return count;
  }
  
  /**
   * 모든 캐시 삭제
   */
  clear() {
    const size = this.storage.size;
    this.storage.clear();
    console.log(`🗑️ 전체 캐시 삭제: ${size}개`);
  }
  
  /**
   * 캐시 정보 조회
   * @returns {Object} 캐시 통계
   */
  getInfo() {
    const now = Date.now();
    const items = Array.from(this.storage.entries()).map(([key, item]) => ({
      key,
      age: Math.round((now - item.timestamp) / 1000),
      size: JSON.stringify(item.data).length
    }));
    
    return {
      size: this.storage.size,
      maxSize: this.maxSize,
      ttl: this.ttl / 1000,
      items
    };
  }
  
  /**
   * TTL 설정
   * @param {number} seconds - 초 단위 TTL
   */
  setTTL(seconds) {
    this.ttl = seconds * 1000;
    console.log(`⏱️ 캐시 TTL 설정: ${seconds}초`);
  }
}

// 싱글톤 인스턴스 생성
const statsCache = new StatsCacheManager();

// 전역 접근 가능하도록
if (typeof window !== 'undefined') {
  window.StatsCache = statsCache;
}

export default statsCache;

