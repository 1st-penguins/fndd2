// firestore-utils.js - Firebase Firestore 공통 유틸리티 함수

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  endBefore,
  limitToLast,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { db, auth } from "../core/firebase-core.js";

/**
 * 일반 문서 가져오기 (공통 패턴)
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @returns {Promise<Object|null>} 문서 데이터
 */
export async function getDocument(collectionName, docId) {
  try {
    if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
    
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        // 타임스탬프 변환
        ...convertTimestamps(docSnap.data())
      };
    }
    
    return null;
  } catch (error) {
    console.error(`문서 조회 오류 (${collectionName}/${docId}):`, error);
    throw error;
  }
}

/**
 * 컬렉션 내 문서 목록 가져오기 (일반 패턴)
 * @param {string} collectionName - 컬렉션 이름
 * @param {Object} options - 쿼리 옵션
 * @returns {Promise<Array>} 문서 배열
 */
export async function getDocuments(collectionName, options = {}) {
  try {
    if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
    
    const {
      whereConditions = [],     // where 조건 배열 [{field, op, value}]
      orderByField,             // 정렬 필드
      orderDirection = 'desc',  // 정렬 방향
      limitCount,               // 제한 개수
      startAfterDoc,            // 이후부터 (페이징)
      endBeforeDoc,             // 이전까지 (페이징)
      useLimitToLast = false    // limitToLast 사용 여부
    } = options;
    
    // 쿼리 생성 시작
    let queryRef = collection(db, collectionName);
    
    // 쿼리 빌더 함수
    const buildQuery = () => {
      let q = queryRef;
      
      // where 조건 추가
      whereConditions.forEach(condition => {
        const { field, op, value } = condition;
        q = query(q, where(field, op, value));
      });
      
      // 정렬 추가
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderDirection));
      }
      
      // 시작점 (페이징)
      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }
      
      // 종료점 (페이징)
      if (endBeforeDoc) {
        q = query(q, endBefore(endBeforeDoc));
      }
      
      // 제한 개수
      if (limitCount) {
        if (useLimitToLast) {
          q = query(q, limitToLast(limitCount));
        } else {
          q = query(q, limit(limitCount));
        }
      }
      
      return q;
    };
    
    // 쿼리 실행
    const q = buildQuery();
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return [];
    }
    
    // 결과 변환
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // 타임스탬프 변환
      ...convertTimestamps(doc.data())
    }));
    
  } catch (error) {
    console.error(`문서 목록 조회 오류 (${collectionName}):`, error);
    throw error;
  }
}

/**
 * 문서 생성 (일반 패턴)
 * @param {string} collectionName - 컬렉션 이름
 * @param {Object} data - 저장할 데이터
 * @param {boolean} addTimestamps - 타임스탬프 자동 추가 여부
 * @returns {Promise<Object>} 생성된 문서 정보
 */
export async function createDocument(collectionName, data, addTimestamps = true) {
  try {
    if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 타임스탬프 추가
    const documentData = { ...data };
    
    if (addTimestamps) {
      documentData.createdAt = serverTimestamp();
      documentData.updatedAt = serverTimestamp();
      
      // 작성자 정보 추가
      documentData.createdBy = documentData.createdBy || currentUser.uid;
      documentData.createdByName = documentData.createdByName || 
                                  (currentUser.displayName || currentUser.email);
    }
    
    // 문서 생성
    const docRef = await addDoc(collection(db, collectionName), documentData);
    
    return { 
      id: docRef.id,
      ...documentData,
      // 클라이언트측 타임스탬프 (서버 타임스탬프는 비동기적)
      createdAt: documentData.createdAt || new Date(),
      updatedAt: documentData.updatedAt || new Date()
    };
    
  } catch (error) {
    console.error(`문서 생성 오류 (${collectionName}):`, error);
    throw error;
  }
}

/**
 * 문서 업데이트 (일반 패턴)
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @param {Object} data - 업데이트할 데이터
 * @param {boolean} addTimestamp - 타임스탬프 자동 추가 여부
 * @returns {Promise<Object>} 업데이트된 문서 정보
 */
export async function updateDocument(collectionName, docId, data, addTimestamp = true) {
  try {
    if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 타임스탬프 및 수정자 정보 추가
    const updateData = { ...data };
    
    if (addTimestamp) {
      updateData.updatedAt = serverTimestamp();
      updateData.updatedBy = updateData.updatedBy || currentUser.uid;
      updateData.updatedByName = updateData.updatedByName || 
                                (currentUser.displayName || currentUser.email);
    }
    
    // undefined 값 제거 (Firestore에서는 null만 허용)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]; 
      }
    });
    
    // 문서 업데이트
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, updateData);
    
    // 업데이트된 문서 정보 반환
    return { 
      id: docId, 
      ...updateData,
      // 클라이언트측 타임스탬프 (서버 타임스탬프는 비동기적)
      updatedAt: updateData.updatedAt || new Date()
    };
    
  } catch (error) {
    console.error(`문서 업데이트 오류 (${collectionName}/${docId}):`, error);
    throw error;
  }
}

/**
 * 문서 삭제 (일반 패턴)
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} docId - 문서 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export async function deleteDocument(collectionName, docId) {
  try {
    if (!db) throw new Error('Firestore가 초기화되지 않았습니다.');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 문서 삭제
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    
    return true;
  } catch (error) {
    console.error(`문서 삭제 오류 (${collectionName}/${docId}):`, error);
    throw error;
  }
}

/**
 * 타임스탬프 필드를 Date 객체로 변환
 * @param {Object} data - 문서 데이터
 * @returns {Object} 변환된 데이터
 */
export function convertTimestamps(data) {
  if (!data) return {};
  
  const result = {};
  const timestampFields = ['timestamp', 'createdAt', 'updatedAt', 'date', 'startDate', 'endDate'];
  
  timestampFields.forEach(field => {
    if (data[field] && typeof data[field].toDate === 'function') {
      result[field] = data[field].toDate();
    }
  });
  
  return result;
}

/**
 * 단순 날짜 포맷팅 (yyyy.MM.dd)
 * @param {Date|Object} date - 날짜 또는 Firestore 타임스탬프
 * @returns {string} 포맷팅된 날짜
 */
export function formatSimpleDate(date) {
  if (!date) return '';
  
  // Firestore 타임스탬프인 경우 Date 객체로 변환
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  
  // 문자열인 경우 Date 객체로 변환
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}.${month}.${day}`;
  } catch (e) {
    console.error('날짜 포맷팅 오류:', e);
    return '';
  }
}

/**
 * 상대적 날짜 포맷팅 (예: '3일 전', '방금 전')
 * @param {Date|Timestamp} timestamp - 날짜
 * @returns {string} 형식화된 상대 날짜
 */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return '날짜 없음';
  
  // Timestamp 객체인 경우 Date로 변환
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 24시간 이내
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) {
      const minutes = Math.floor(diff / (60 * 1000));
      if (minutes < 1) return '방금 전';
      return `${minutes}분 전`;
    }
    return `${hours}시간 전`;
  }
  
  // 7일 이내
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}일 전`;
  }
  
  // 그 외
  return formatSimpleDate(timestamp);
}

// 전역 객체에 유틸리티 함수 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.formatSimpleDate = formatSimpleDate;
  window.formatRelativeDate = formatRelativeDate;
}

export default {
  getDocument,
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  convertTimestamps,
  formatSimpleDate,
  formatRelativeDate
};