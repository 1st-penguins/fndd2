// schedule-data.js — Firestore examSchedules 컬렉션 조회
import { ensureFirebase } from '../core/firebase-core.js';

const CERT_COLORS = {
  'health-manager': '#1D2F4E',
  'sports-instructor': '#059669',
  'sports-instructor-1': '#7C3AED'
};

const CERT_NAMES = {
  'health-manager': '건강운동관리사',
  'sports-instructor': '2급 스포츠지도사',
  'sports-instructor-1': '1급 스포츠지도사'
};

const TYPE_LABELS = {
  'registration': '접수 기간',
  'written-exam': '필기시험',
  'practical-exam': '실기·구술시험',
  'result': '합격자 발표',
  'other': '기타'
};

const TYPE_ICONS = {
  'registration': '📝',
  'written-exam': '✏️',
  'practical-exam': '🏃',
  'result': '📢',
  'other': '📌'
};

export { CERT_COLORS, CERT_NAMES, TYPE_LABELS, TYPE_ICONS };

/**
 * D-Day 계산
 * @param {Date} targetDate
 * @returns {{ text: string, days: number, isPast: boolean, isToday: boolean }}
 */
export function calculateDDay(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diff > 0) return { text: `D-${diff}`, days: diff, isPast: false, isToday: false };
  if (diff === 0) return { text: 'D-Day', days: 0, isPast: false, isToday: true };
  return { text: `D+${Math.abs(diff)}`, days: diff, isPast: true, isToday: false };
}

/**
 * Firestore에서 시험 일정 가져오기
 * @param {string|null} certFilter — null이면 전체
 * @returns {Promise<Array>}
 */
export async function fetchSchedules(certFilter = null) {
  const { db } = await ensureFirebase();
  const { collection, query, where, orderBy, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js'
  );

  const constraints = [orderBy('startDate', 'asc')];
  if (certFilter) {
    constraints.unshift(where('certType', '==', certFilter));
  }
  constraints.unshift(where('isActive', '==', true));

  const q = query(collection(db, 'examSchedules'), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      certType: d.certType,
      title: d.title,
      type: d.type,
      startDate: d.startDate?.toDate?.() || new Date(d.startDate),
      endDate: d.endDate?.toDate?.() || (d.endDate ? new Date(d.endDate) : null),
      year: d.year,
      half: d.half,
      description: d.description || '',
      order: d.order || 0
    };
  });
}

/**
 * 각 자격증별 가장 가까운 미래 일정 가져오기 (D-Day 카운터용)
 * @returns {Promise<Array>} — 최대 3개 (자격증당 1개)
 */
export async function fetchUpcomingPerCert() {
  const all = await fetchSchedules();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = {};
  for (const item of all) {
    const target = item.startDate;
    if (target < today) continue;
    if (!result[item.certType]) {
      result[item.certType] = item;
    }
  }

  // 자격증 순서 고정
  const order = ['health-manager', 'sports-instructor-1', 'sports-instructor'];
  return order.map(key => result[key]).filter(Boolean);
}
