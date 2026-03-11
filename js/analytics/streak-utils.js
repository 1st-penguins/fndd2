/**
 * streak-utils.js — 학습 스트릭 계산 유틸리티
 * attempts 배열에서 dayMap을 만들고 스트릭/최장 스트릭/오늘 문제 수를 계산
 */

/**
 * attempts 배열 → { dateStr: count } 맵 생성
 */
export function buildDayMap(attempts) {
  const dayMap = {};
  attempts.forEach(a => {
    const ts = a.timestamp?.toDate ? a.timestamp.toDate() :
      (a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp));
    if (!ts || isNaN(ts)) return;
    const key = ts.toISOString().slice(0, 10);
    dayMap[key] = (dayMap[key] || 0) + 1;
  });
  return dayMap;
}

/**
 * dayMap에서 현재 연속 학습일(스트릭) 계산
 */
export function calcCurrentStreak(dayMap) {
  const now = new Date();
  const checkDate = new Date(now);
  const todayKey = checkDate.toISOString().slice(0, 10);

  // 오늘 활동이 없으면 어제부터 시작
  if (!dayMap[todayKey]) checkDate.setDate(checkDate.getDate() - 1);

  let streak = 0;
  while (true) {
    const ck = checkDate.toISOString().slice(0, 10);
    if (dayMap[ck]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * dayMap에서 최장 연속 학습일 계산
 */
export function calcLongestStreak(dayMap) {
  const dates = Object.keys(dayMap).sort();
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else if (diff > 1) {
      current = 1;
    }
    // diff === 0 (같은 날) → 무시
  }
  return longest;
}

/**
 * 오늘 풀은 문제 수
 */
export function getTodayCount(dayMap) {
  const todayKey = new Date().toISOString().slice(0, 10);
  return dayMap[todayKey] || 0;
}

/**
 * 최근 N일 활동 여부 배열 반환 (오늘부터 역순)
 * 예: [true, true, false, true, ...] (index 0 = 오늘)
 */
export function getRecentActivity(dayMap, days = 7) {
  const result = [];
  const d = new Date();
  for (let i = 0; i < days; i++) {
    const key = d.toISOString().slice(0, 10);
    result.push(!!dayMap[key]);
    d.setDate(d.getDate() - 1);
  }
  return result;
}
