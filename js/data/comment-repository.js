// js/data/comment-repository.js
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { db, auth } from "../core/firebase-core.js";

/**
 * 특정 공지사항의 댓글 목록 가져오기
 * @param {string} noticeId - 공지사항 ID
 * @returns {Promise<Array>} 댓글 배열
 */
export async function getComments(noticeId) {
  try {
    const commentsRef = collection(db, "comments");
    const q = query(
      commentsRef,
      where("noticeId", "==", noticeId),
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const comments = [];
    
    querySnapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return comments;
  } catch (error) {
    console.error("댓글 로드 오류:", error);
    throw error;
  }
}

/**
 * 새 댓글 추가
 * @param {string} noticeId - 공지사항 ID
 * @param {string} content - 댓글 내용
 * @returns {Promise<Object>} 추가된 댓글 데이터
 */
export async function addComment(noticeId, content) {
  try {
    // 현재 로그인한 사용자 정보 (실제 구현 시 로그인 상태 확인 필요)
    let authorName = "익명";
    let userId = null;
    
    // 로그인 사용자가 있으면 정보 활용
    if (auth.currentUser) {
      authorName = auth.currentUser.displayName || auth.currentUser.email || "익명";
      userId = auth.currentUser.uid;
    }
    
    const commentsRef = collection(db, "comments");
    const commentData = {
      noticeId,
      content,
      author: authorName,
      userId: userId,
      timestamp: new Date()
    };
    
    const docRef = await addDoc(commentsRef, commentData);
    return {
      id: docRef.id,
      ...commentData
    };
  } catch (error) {
    console.error("댓글 추가 오류:", error);
    throw new Error("댓글 작성 중 오류가 발생했습니다.");
  }
}

/**
 * 댓글 삭제
 * @param {string} commentId - 댓글 ID
 * @returns {Promise<void>}
 */
export async function deleteComment(commentId) {
  try {
    const commentRef = doc(db, "comments", commentId);
    await deleteDoc(commentRef);
  } catch (error) {
    console.error("댓글 삭제 오류:", error);
    throw new Error("댓글 삭제 중 오류가 발생했습니다.");
  }
}