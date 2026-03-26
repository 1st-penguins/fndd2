// inquiry-repository.js - 1:1 문의 데이터 접근 레이어

import { ensureFirebase } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";
import { convertTimestamps } from "./firestore-utils.js";

const INQUIRIES_COLLECTION = 'inquiries';

/**
 * 문의 작성
 */
export async function createInquiry({ category, title, content }) {
  const { auth, db } = await ensureFirebase();
  const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");

  const data = {
    userId: user.uid,
    userEmail: user.email || '',
    userName: user.displayName || user.email || '익명',
    category,
    title,
    content,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    adminReply: null,
    adminReplyAt: null,
    adminEmail: null
  };

  const docRef = await addDoc(collection(db, INQUIRIES_COLLECTION), data);
  return { id: docRef.id, ...data, createdAt: new Date(), updatedAt: new Date() };
}

/**
 * 내 문의 목록 가져오기
 */
export async function getMyInquiries(limitCount = 20) {
  const { auth, db } = await ensureFirebase();
  const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, INQUIRIES_COLLECTION),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    ...convertTimestamps(doc.data())
  }));
}

/**
 * 전체 문의 목록 (관리자)
 */
export async function getAllInquiries(statusFilter = null, limitCount = 50) {
  if (!isAdmin()) throw new Error("관리자 권한이 필요합니다.");

  const { db } = await ensureFirebase();
  const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  const constraints = [orderBy('createdAt', 'desc'), limit(limitCount)];
  if (statusFilter) {
    constraints.unshift(where('status', '==', statusFilter));
  }

  const q = query(collection(db, INQUIRIES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    ...convertTimestamps(doc.data())
  }));
}

/**
 * 문의 상세 조회
 */
export async function getInquiryById(id) {
  const { db } = await ensureFirebase();
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  const docSnap = await getDoc(doc(db, INQUIRIES_COLLECTION, id));
  if (!docSnap.exists()) throw new Error("존재하지 않는 문의입니다.");

  return { id: docSnap.id, ...docSnap.data(), ...convertTimestamps(docSnap.data()) };
}

/**
 * 답변 작성 (관리자)
 */
export async function replyToInquiry(id, replyText) {
  if (!isAdmin()) throw new Error("관리자 권한이 필요합니다.");

  const { auth, db } = await ensureFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  await updateDoc(doc(db, INQUIRIES_COLLECTION, id), {
    adminReply: replyText,
    adminReplyAt: serverTimestamp(),
    adminEmail: auth.currentUser?.email || '',
    status: 'answered',
    updatedAt: serverTimestamp()
  });
}

/**
 * 문의 상태 변경 (관리자)
 */
export async function updateInquiryStatus(id, status) {
  if (!isAdmin()) throw new Error("관리자 권한이 필요합니다.");

  const { db } = await ensureFirebase();
  const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  await updateDoc(doc(db, INQUIRIES_COLLECTION, id), {
    status,
    updatedAt: serverTimestamp()
  });
}

/**
 * 문의 삭제 (관리자)
 */
export async function deleteInquiry(id) {
  if (!isAdmin()) throw new Error("관리자 권한이 필요합니다.");

  const { db } = await ensureFirebase();
  const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  await deleteDoc(doc(db, INQUIRIES_COLLECTION, id));
}

export default {
  createInquiry,
  getMyInquiries,
  getAllInquiries,
  getInquiryById,
  replyToInquiry,
  updateInquiryStatus,
  deleteInquiry
};
