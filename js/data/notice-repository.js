// notice-repository.js - 공지사항 데이터 접근 레이어 (동적 import로 초기 로드 최적화)

import { ensureFirebase } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";
import { convertTimestamps } from "./firestore-utils.js";

// 공지사항 컬렉션 이름
const NOTICES_COLLECTION = 'notices';
const VISITS_COLLECTION = 'visits';
const VISITOR_ID_KEY = 'fp_visitor_id';

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrCreateVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

/**
 * 공지사항 목록 가져오기 (최신순)
 * @param {number} limit - 가져올 최대 개수
 * @param {boolean} includeDrafts - 초안 포함 여부 (관리자만 true 가능)
 * @returns {Promise<Array>} 공지사항 배열
 */
export async function getNotices(limitCount = 20, includeDrafts = false) {
  try {
    const firebase = await ensureFirebase().catch(() => null);
    if (!firebase || !firebase.db) {
      throw new Error('Firestore가 초기화되지 않았습니다.');
    }
    const { db } = firebase;
    const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    // 쿼리 구성
    let queryRef;

    // 기본적으로 최신순 정렬
    const baseConstraints = [
      orderBy("timestamp", "desc")
    ];

    if (limitCount > 0) {
      baseConstraints.push(limit(limitCount));
    }

    // 관리자가 아니거나 초안을 포함하지 않는 경우
    if (!includeDrafts || !isAdmin()) {
      queryRef = query(
        collection(db, NOTICES_COLLECTION),
        where("isDraft", "==", false),
        ...baseConstraints
      );
    } else {
      // 관리자이고 초안 포함하는 경우
      queryRef = query(
        collection(db, NOTICES_COLLECTION),
        ...baseConstraints
      );
    }

    // 쿼리 실행
    const snapshot = await getDocs(queryRef);

    if (snapshot.empty) {
      return [];
    }

    // 결과 변환
    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      ...convertTimestamps(doc.data())
    }));

    return results;
  } catch (error) {
    // 비로그인 또는 권한 부족 시 콘솔 오류를 경고 수준으로 낮추고 빈 목록 반환
    if (String(error).includes('Missing or insufficient permissions')) {
      console.warn("공지사항 가져오기 권한 부족 (비로그인일 수 있음)");
      return [];
    }
    console.error("공지사항 가져오기 오류:", error);
    return [];
  }
}

/**
 * 특정 공지사항 가져오기
 * @param {string} id - 공지사항 ID
 * @returns {Promise<Object|null>} 공지사항 객체
 */
export async function getNoticeById(id) {
  try {
    const { db } = await ensureFirebase();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const docRef = doc(db, NOTICES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // 초안인 경우 관리자만 볼 수 있음
      if (data.isDraft && !isAdmin()) {
        throw new Error("접근 권한이 없습니다.");
      }

      return {
        id: docSnap.id,
        ...data,
        ...convertTimestamps(data)
      };
    } else {
      throw new Error("존재하지 않는 공지사항입니다.");
    }
  } catch (error) {
    console.error("공지사항 상세 가져오기 오류:", error);
    throw error;
  }
}

/**
 * 공지사항 조회수 증가
 * @param {string} id - 공지사항 ID
 * @returns {Promise<number|null>} 증가 후 조회수 (실패 시 null)
 */
export async function incrementNoticeViewCount(id) {
  try {
    const { db } = await ensureFirebase();
    const { doc, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const docRef = doc(db, NOTICES_COLLECTION, id);
    const nextCount = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error("존재하지 않는 공지사항입니다.");
      }

      const data = docSnap.data() || {};
      const currentCount = Number.isFinite(data.viewCount) ? data.viewCount : 0;
      const updatedCount = currentCount + 1;

      transaction.update(docRef, {
        viewCount: updatedCount,
        lastViewedAt: serverTimestamp()
      });

      return updatedCount;
    });

    return nextCount;
  } catch (error) {
    console.error("공지사항 조회수 증가 오류:", error);
    return null;
  }
}

/**
 * 공지사항/방문자 사용 통계 조회 (관리자 전용)
 * 방문자 수는 attempts 기준 활성 사용자 수로 계산한다.
 * @param {number} days - 최근 집계 기간(일)
 * @returns {Promise<Object|null>} 통계 객체
 */
export async function getNoticeUsageStats(days = 30) {
  try {
    if (!isAdmin()) {
      throw new Error("관리자 권한이 필요합니다.");
    }

    const { db } = await ensureFirebase();
    const {
      collection,
      query,
      where,
      getDocs,
      Timestamp
    } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    // 1) 공지 조회수 합계
    const noticesSnap = await getDocs(collection(db, NOTICES_COLLECTION));
    let totalNoticeViews = 0;
    noticesSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      totalNoticeViews += Number.isFinite(data.viewCount) ? data.viewCount : 0;
    });

    // 2) 방문자 집계 - visits 컬렉션(페이지 방문 기준) 사용
    const now = new Date();
    const todayKey = getDateKey(now);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - Math.max(1, days) + 1);
    const startKey = getDateKey(startDate);

    const visitsRef = collection(db, VISITS_COLLECTION);
    const visits30Q = query(
      visitsRef,
      where('page', '==', 'notices'),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', todayKey)
    );
    const visitsTodayQ = query(
      visitsRef,
      where('page', '==', 'notices'),
      where('dateKey', '==', todayKey)
    );

    const [visits30Snap, visitsTodaySnap] = await Promise.all([
      getDocs(visits30Q),
      getDocs(visitsTodayQ)
    ]);

    return {
      totalNotices: noticesSnap.size,
      totalNoticeViews,
      activeUsersLast30Days: visits30Snap.size,
      activeUsersToday: visitsTodaySnap.size
    };
  } catch (error) {
    console.error("공지사항 사용 통계 조회 오류:", error);
    return null;
  }
}

/**
 * 공지 게시판 방문 기록 (일자+방문자 기준 1회)
 * @returns {Promise<boolean>} 성공 여부
 */
export async function trackNoticeBoardVisit() {
  try {
    const { db, auth } = await ensureFirebase();
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const visitorId = getOrCreateVisitorId();
    const dateKey = getDateKey();
    const user = auth?.currentUser || null;
    const visitId = `notices_${dateKey}_${visitorId}`;

    await setDoc(doc(db, VISITS_COLLECTION, visitId), {
      page: 'notices',
      dateKey,
      visitorId,
      userId: user ? user.uid : null,
      isLoggedIn: !!user,
      visitedAt: serverTimestamp()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("공지 방문 기록 오류:", error);
    return false;
  }
}

/**
 * 공지사항 생성
 * @param {Object} noticeData - 공지사항 데이터
 * @returns {Promise<Object>} 생성된 공지사항
 */
export async function createNotice(noticeData) {
  try {
    const { auth, db } = await ensureFirebase();
    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    // 관리자 체크
    if (!isAdmin()) {
      throw new Error("관리자만 공지사항을 작성할 수 있습니다.");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    // 기본값 설정
    const timestamp = serverTimestamp();
    const data = {
      title: noticeData.title || "제목 없음",
      content: noticeData.content || "",
      badge: noticeData.badge || null,
      pinned: noticeData.pinned || false,
      isDraft: noticeData.isDraft || false,
      author: user.displayName || user.email,
      authorId: user.uid,
      timestamp: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Firestore에 저장
    const docRef = await addDoc(collection(db, NOTICES_COLLECTION), data);

    return {
      id: docRef.id,
      ...data,
      // 클라이언트 측에서는 Date 객체 사용
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error("공지사항 생성 오류:", error);
    throw error;
  }
}

/**
 * 공지사항 수정
 * @param {string} id - 공지사항 ID
 * @param {Object} noticeData - 수정할 데이터
 * @returns {Promise<Object>} 수정된 공지사항
 */
export async function updateNotice(id, noticeData) {
  try {
    const { auth, db } = await ensureFirebase();
    const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    // 관리자 체크
    if (!isAdmin()) {
      throw new Error("관리자만 공지사항을 수정할 수 있습니다.");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    // 기존 문서 확인
    const docRef = doc(db, NOTICES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("존재하지 않는 공지사항입니다.");
    }

    // 업데이트 데이터 구성
    const updateData = {
      ...noticeData,
      updatedAt: serverTimestamp(),
      lastEditedBy: user.displayName || user.email
    };

    // 필드가 undefined인 경우 제외
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Firestore 업데이트
    await updateDoc(docRef, updateData);

    // 기존 데이터 + 업데이트 데이터 반환
    const originalData = docSnap.data();
    return {
      id,
      ...originalData,
      ...updateData,
      // 클라이언트 측에서는 Date 객체로 변환
      updatedAt: new Date()
    };
  } catch (error) {
    console.error("공지사항 수정 오류:", error);
    throw error;
  }
}

/**
 * 공지사항 좋아요 토글
 * @param {string} noticeId - 공지사항 ID
 * @returns {Promise<Object>} { liked: boolean, count: number }
 */
export async function toggleNoticeLike(noticeId) {
  try {
    const { auth, db } = await ensureFirebase();
    const { doc, getDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const user = auth.currentUser;
    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    const docRef = doc(db, NOTICES_COLLECTION, noticeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("존재하지 않는 공지사항입니다.");
    }

    const data = docSnap.data();
    const likes = data.likes || { count: 0, users: [] };

    const userIndex = likes.users.indexOf(user.uid);
    const isLiked = userIndex !== -1;

    if (isLiked) {
      // 좋아요 취소
      likes.users.splice(userIndex, 1);
      likes.count = Math.max(0, likes.count - 1);
    } else {
      // 좋아요 추가
      likes.users.push(user.uid);
      likes.count = (likes.count || 0) + 1;
    }

    // Firestore 업데이트
    await updateDoc(docRef, { likes });

    return {
      liked: !isLiked,
      count: likes.count
    };
  } catch (error) {
    console.error("좋아요 토글 오류:", error);
    throw error;
  }
}

/**
 * 공지사항 좋아요 정보 가져오기
 * @param {string} noticeId - 공지사항 ID
 * @returns {Promise<Object>} { count: number, liked: boolean }
 */
export async function getNoticeLikes(noticeId) {
  try {
    const { db, auth } = await ensureFirebase();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const docRef = doc(db, NOTICES_COLLECTION, noticeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("존재하지 않는 공지사항입니다.");
    }

    const data = docSnap.data();
    const likes = data.likes || { count: 0, users: [] };

    const user = auth.currentUser;
    const liked = user ? likes.users.includes(user.uid) : false;

    return {
      count: likes.count || 0,
      liked: liked
    };
  } catch (error) {
    console.error("좋아요 정보 가져오기 오류:", error);
    return { count: 0, liked: false };
  }
}

/**
 * 공지사항 삭제
 * @param {string} id - 공지사항 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export async function deleteNotice(id) {
  try {
    const { auth, db } = await ensureFirebase();
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    // 관리자 체크
    if (!isAdmin()) {
      throw new Error("관리자만 공지사항을 삭제할 수 있습니다.");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    // Firestore에서 삭제
    const docRef = doc(db, NOTICES_COLLECTION, id);
    await deleteDoc(docRef);

    return true;
  } catch (error) {
    console.error("공지사항 삭제 오류:", error);
    throw error;
  }
}

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  // getNotices 함수
  window.getNotices = async function (limitCount = 10) {
    return await getNotices(limitCount, false);
  };

  // getNoticeById 함수
  window.getNoticeById = async function (id) {
    return await getNoticeById(id);
  };

  // 좋아요 함수들
  window.toggleNoticeLike = toggleNoticeLike;
  window.getNoticeLikes = getNoticeLikes;
}

export default {
  getNotices,
  getNoticeById,
  incrementNoticeViewCount,
  getNoticeUsageStats,
  trackNoticeBoardVisit,
  createNotice,
  updateNotice,
  deleteNotice,
  toggleNoticeLike,
  getNoticeLikes
};