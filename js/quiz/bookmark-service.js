// bookmark-service.js - 문제 북마크 Firestore 서비스

import {
  collection, doc, setDoc, getDocs, query,
  where, orderBy, serverTimestamp, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { ensureFirebase } from "../core/firebase-core.js";

async function getDb() {
  const { db } = await ensureFirebase();
  return db;
}

/** undefined 값을 재귀적으로 제거 */
function removeUndefined(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) cleaned[k] = typeof v === 'object' && v !== null && !(v instanceof Date) ? removeUndefined(v) : v;
  }
  return cleaned;
}

/**
 * 북마크 저장/토글
 * @param {string} userId
 * @param {object} questionData - id, question, options, correctAnswer, explanation, subject 등
 * @param {string} examName - 예: '2024년 모의고사 1교시'
 * @param {string} section - 과목명
 * @param {string} certType - 'health-manager' | 'sports-instructor'
 */
export async function saveBookmark(userId, questionData, examName, section, certType) {
  if (!userId || !questionData?.id) {
    console.warn('북마크 저장 실패: userId 또는 questionData.id 누락');
    return;
  }

  const db = await getDb();
  const questionId = questionData.id;
  const docId = `${userId}_${questionId}`;

  const data = removeUndefined({
    userId,
    questionId,
    examName: examName || '',
    section: section || '',
    certType: certType || 'health-manager',
    bookmarkedAt: serverTimestamp(),
    questionData: removeUndefined({
      question: questionData.question || '',
      options: questionData.options || [],
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation || '',
      subject: questionData.subject || section || '',
      year: questionData.year || '',
      questionImage: questionData.questionImage || null,
      commonImage: questionData.commonImage || null,
    })
  });

  await setDoc(doc(db, 'bookmarks', docId), data, { merge: true });
}

/**
 * 북마크 삭제
 */
export async function removeBookmark(userId, questionId) {
  if (!userId || !questionId) return;
  const db = await getDb();
  const docId = `${userId}_${questionId}`;
  await deleteDoc(doc(db, 'bookmarks', docId));
}

/**
 * 북마크 여부 확인
 */
export async function isBookmarked(userId, questionId) {
  if (!userId || !questionId) return false;
  const db = await getDb();
  const docId = `${userId}_${questionId}`;
  const snap = await getDoc(doc(db, 'bookmarks', docId));
  return snap.exists();
}

/**
 * 북마크 목록 조회
 * @param {string} userId
 * @param {object} options - { certType }
 */
export async function getBookmarks(userId, options = {}) {
  if (!userId) return [];
  const db = await getDb();

  const constraints = [where('userId', '==', userId)];
  if (options.certType) {
    constraints.push(where('certType', '==', options.certType));
  }
  constraints.push(orderBy('bookmarkedAt', 'desc'));

  try {
    const snap = await getDocs(query(collection(db, 'bookmarks'), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // 복합 인덱스 없으면 클라이언트 필터링
    console.warn('북마크 쿼리 폴백:', e.message);
    const snap = await getDocs(query(
      collection(db, 'bookmarks'),
      where('userId', '==', userId)
    ));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (options.certType) {
      results = results.filter(r => r.certType === options.certType);
    }
    results.sort((a, b) => {
      const ta = a.bookmarkedAt?.seconds || 0;
      const tb = b.bookmarkedAt?.seconds || 0;
      return tb - ta;
    });
    return results;
  }
}
