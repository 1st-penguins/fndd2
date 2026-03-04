// admin-repository.js - 관리자 데이터 접근 레이어

import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  doc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { db, auth } from "../core/firebase-core.js";
import { isAdmin, ADMIN_EMAILS } from "./auth-utils.js";

/**
 * 새 관리자 추가 (슈퍼 관리자만 가능)
 * @param {string} email - 관리자 이메일
 * @param {string} name - 관리자 이름
 * @returns {Promise<Object>} 결과 객체
 */
export async function addAdmin(email, name) {
  try {
    // 현재 사용자가 로그인되어있는지 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 슈퍼 관리자 권한 체크
    if (!ADMIN_EMAILS.includes(currentUser.email)) {
      throw new Error('관리자 추가 권한이 없습니다.');
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('유효하지 않은 이메일 형식입니다.');
    }

    // 이미 존재하는 관리자인지 확인
    const adminQuery = query(
      collection(db, 'admins'), 
      where('email', '==', email)
    );
    const existingAdmins = await getDocs(adminQuery);
    
    if (!existingAdmins.empty) {
      throw new Error('이미 존재하는 관리자입니다.');
    }

    // 새 관리자 추가
    const adminRef = await addDoc(collection(db, 'admins'), {
      email,
      name,
      addedBy: currentUser.email,
      addedAt: serverTimestamp()
    });

    return { 
      success: true, 
      adminId: adminRef.id, 
      email, 
      name 
    };
  } catch (error) {
    console.error('관리자 추가 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 관리자 삭제 (슈퍼 관리자만 가능)
 * @param {string} email - 삭제할 관리자 이메일
 * @returns {Promise<Object>} 결과 객체
 */
export async function removeAdmin(email) {
  try {
    // 현재 사용자가 로그인되어있는지 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 슈퍼 관리자 권한 체크
    if (!ADMIN_EMAILS.includes(currentUser.email)) {
      throw new Error('관리자 삭제 권한이 없습니다.');
    }

    // 삭제할 관리자 찾기
    const adminQuery = query(
      collection(db, 'admins'), 
      where('email', '==', email)
    );
    const adminSnapshot = await getDocs(adminQuery);
    
    // 찾은 관리자가 없으면 오류
    if (adminSnapshot.empty) {
      throw new Error('해당 이메일의 관리자를 찾을 수 없습니다.');
    }
    
    // 찾은 관리자 삭제
    const deletePromises = adminSnapshot.docs.map(adminDoc => 
      deleteDoc(doc(db, 'admins', adminDoc.id))
    );

    await Promise.all(deletePromises);
    
    return { 
      success: true, 
      message: `관리자 ${email}이(가) 제거되었습니다.` 
    };
  } catch (error) {
    console.error('관리자 삭제 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 현재 관리자 목록 가져오기
 * @returns {Promise<Array>} 관리자 목록
 */
export async function listAdmins() {
  try {
    // 현재 사용자가 로그인되어있는지 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }
    
    // 관리자 권한 체크
    if (!isAdmin(currentUser)) {
      throw new Error('관리자만 접근 가능한 기능입니다.');
    }
    
    // 관리자 목록 가져오기
    const adminsCollection = collection(db, 'admins');
    const adminsSnapshot = await getDocs(adminsCollection);
    
    // 관리자 목록 변환 및 반환
    const adminsList = adminsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        name: data.name || '',
        addedAt: data.addedAt?.toDate() || null,
        addedBy: data.addedBy || ''
      };
    });
    
    // 슈퍼 관리자 목록 추가 (DB에 없더라도 표시)
    const allAdmins = [...adminsList];
    
    // 이미 목록에 있는 이메일 체크
    const existingEmails = new Set(adminsList.map(admin => admin.email));
    
    // 슈퍼 관리자 중 리스트에 없는 이메일 추가
    ADMIN_EMAILS.forEach(email => {
      if (!existingEmails.has(email)) {
        allAdmins.push({
          id: 'super_' + email.replace(/[@.]/g, '_'),
          email: email,
          name: '슈퍼 관리자',
          isSuperAdmin: true
        });
      }
    });
    
    return allAdmins;
  } catch (error) {
    console.error('관리자 목록 조회 오류:', error);
    throw error;
  }
}

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.addAdmin = addAdmin;
  window.removeAdmin = removeAdmin;
  window.listAdmins = listAdmins;
}

export default {
  addAdmin,
  removeAdmin,
  listAdmins
};