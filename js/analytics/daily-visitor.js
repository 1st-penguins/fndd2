// daily-visitor.js — 오늘의 고유 방문자 기록 및 조회
import { db } from "../core/firebase-core.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 로그인한 사용자의 오늘 방문을 Firestore에 기록.
 * 같은 날 같은 uid는 덮어쓰기라 중복 카운트 없음.
 */
export async function recordDailyVisit(uid) {
  if (!uid) return;
  try {
    const today = getTodayKey();
    const ref = doc(db, 'daily_visits', today);
    await setDoc(ref, { users: { [uid]: true } }, { merge: true });
  } catch (e) {
    // 방문 기록 실패는 조용히 무시
    console.warn('daily visit 기록 실패:', e);
  }
}

/**
 * 오늘 방문한 고유 사용자 수 반환.
 * @returns {Promise<number>}
 */
export async function getTodayVisitorCount() {
  try {
    const today = getTodayKey();
    const ref = doc(db, 'daily_visits', today);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const users = snap.data().users || {};
    return Object.keys(users).length;
  } catch (e) {
    console.warn('오늘 방문자 수 조회 실패:', e);
    return null;
  }
}

/**
 * 최근 N일의 방문자 수 배열 반환 (관리자 통계용).
 * @param {number} days
 * @returns {Promise<Array<{date: string, count: number}>>}
 */
export async function getRecentVisitorStats(days = 7) {
  const results = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${day}`;
    try {
      const ref = doc(db, 'daily_visits', dateKey);
      const snap = await getDoc(ref);
      const count = snap.exists() ? Object.keys(snap.data().users || {}).length : 0;
      results.push({ date: dateKey, count });
    } catch {
      results.push({ date: dateKey, count: 0 });
    }
  }
  return results; // 오늘부터 역순
}
