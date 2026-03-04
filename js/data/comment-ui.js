// js/data/comment-ui.js
console.log("댓글 UI 모듈 로드됨");

import { getComments, addComment, deleteComment } from "./comment-repository.js";
import { formatSimpleDate } from "../utils/date-utils.js";
import { auth } from "../core/firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * 댓글 기능 초기화
 * @param {string} noticeId - 공지사항 ID
 */
export async function initComments(noticeId) {
  if (!noticeId) {
    console.error('댓글 초기화 실패: 공지사항 ID가 필요합니다.');
    return;
  }
  
  try {
    console.log('댓글 기능 초기화 중...', noticeId);
    
    // 댓글 목록 로드
    const comments = await getComments(noticeId);
    
    // 댓글 수 업데이트
    updateCommentCount(comments.length);
    
    // 댓글 목록 렌더링
    renderComments(comments);
    
    // 댓글 작성 폼 이벤트 리스너 등록
    setupCommentForm(noticeId);
    
    // 로그인 상태 변화 감지 리스너 등록
    setupAuthStateListener();
    
    console.log('댓글 초기화 완료:', comments.length + '개의 댓글');
  } catch (error) {
    console.error('댓글 초기화 오류:', error);
    showCommentError('댓글을 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 댓글 수 업데이트
 * @param {number} count - 댓글 수
 */
function updateCommentCount(count) {
  const headerElement = document.querySelector('.comments-header h3');
  if (headerElement) {
    headerElement.textContent = `댓글 (${count})`;
  }
}

/**
 * 댓글 목록 렌더링
 * @param {Array} comments - 댓글 목록
 */
function renderComments(comments) {
  const commentList = document.querySelector('.comment-list');
  if (!commentList) {
    console.error('댓글 목록 컨테이너를 찾을 수 없습니다.');
    return;
  }
  
  if (!comments || comments.length === 0) {
    commentList.innerHTML = '<p class="no-comments">아직 댓글이 없습니다. 첫 댓글을 작성해보세요!</p>';
    return;
  }
  
  const commentsHTML = comments.map(comment => `
    <div class="comment-item" data-comment-id="${comment.id}">
      <div class="comment-header">
        <span class="comment-author">${comment.author || '익명'}</span>
        <span class="comment-date">${formatSimpleDate(comment.timestamp)}</span>
      </div>
      <div class="comment-content">${formatCommentContent(comment.content)}</div>
      <div class="comment-actions">
        <span class="comment-action delete-comment">삭제</span>
      </div>
    </div>
  `).join('');
  
  commentList.innerHTML = commentsHTML;
  
  // 삭제 버튼 이벤트 리스너 등록
  setupDeleteButtons(comments);
}

/**
 * 댓글 내용 포맷팅 (안전한 HTML 처리)
 * @param {string} content - 댓글 내용
 * @returns {string} 포맷팅된 내용
 */
function formatCommentContent(content) {
  if (!content) return '';
  
  // HTML 이스케이프 처리
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // 줄바꿈을 <br>로 변환
  return escaped.replace(/\n/g, '<br>');
}

/**
 * 댓글 작성 폼 설정
 * @param {string} noticeId - 공지사항 ID
 */
function setupCommentForm(noticeId) {
  const form = document.querySelector('.comment-form');
  const input = form.querySelector('.comment-input');
  const submitButton = form.querySelector('.comment-submit');
  
  // 로그인 상태에 따라 폼 상태 업데이트
  updateCommentFormForLoginStatus();
  
  submitButton.addEventListener('click', async () => {
    // 로그인 상태 확인
    if (!auth.currentUser) {
      showCommentError('로그인이 필요한 서비스입니다. 로그인 후 댓글을 작성해주세요.');
      return;
    }
    
    const content = input.value.trim();
    if (!content) {
      showCommentError('댓글 내용을 입력해주세요.');
      return;
    }
    
    // 버튼 비활성화 (중복 클릭 방지)
    submitButton.disabled = true;
    submitButton.textContent = '작성 중...';
    
    try {
      // 댓글 추가
      await addComment(noticeId, content);
      
      // 입력 필드 초기화
      input.value = '';
      
      // 댓글 목록 새로고침
      const comments = await getComments(noticeId);
      updateCommentCount(comments.length);
      renderComments(comments);
      
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      showCommentError('댓글 작성 중 오류가 발생했습니다: ' + error.message);
    } finally {
      // 버튼 상태 복원
      submitButton.disabled = false;
      submitButton.textContent = '댓글 작성';
    }
  });
}

/**
 * 로그인 상태에 따라 댓글 폼 상태 업데이트
 */
function updateCommentFormForLoginStatus() {
  const input = document.querySelector('.comment-input');
  const submitButton = document.querySelector('.comment-submit');
  
  if (!input || !submitButton) {
    return; // 요소가 없으면 무시
  }
  
  if (!auth.currentUser) {
    // 로그인하지 않은 경우
    input.placeholder = '로그인이 필요한 서비스입니다.';
    input.disabled = true;
    submitButton.disabled = true;
    submitButton.textContent = '로그인 필요';
    submitButton.style.opacity = '0.6';
  } else {
    // 로그인한 경우
    input.placeholder = '댓글을 입력하세요...';
    input.disabled = false;
    submitButton.disabled = false;
    submitButton.textContent = '댓글 작성';
    submitButton.style.opacity = '1';
  }
}

/**
 * Firebase 인증 상태 변화 리스너 설정
 */
function setupAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    console.log('댓글 폼: 인증 상태 변화 감지', user ? '로그인됨' : '로그아웃됨');
    updateCommentFormForLoginStatus();
  });
}

/**
 * 댓글 삭제 버튼 설정
 * @param {Array} comments - 댓글 목록
 */
function setupDeleteButtons(comments) {
  const deleteButtons = document.querySelectorAll('.delete-comment');
  
  deleteButtons.forEach((button, index) => {
    button.addEventListener('click', async (e) => {
      const commentItem = e.target.closest('.comment-item');
      const commentId = commentItem.dataset.commentId;
      
      if (confirm('이 댓글을 삭제하시겠습니까?')) {
        try {
          // 버튼 상태 변경
          button.textContent = '삭제 중...';
          button.style.pointerEvents = 'none';
          
          await deleteComment(commentId);
          
          // 현재 댓글 제거
          commentItem.remove();
          
          // 댓글 수 업데이트
          const remainingComments = document.querySelectorAll('.comment-item').length;
          updateCommentCount(remainingComments);
          
          // 댓글이 없는 경우 메시지 표시
          if (remainingComments === 0) {
            document.querySelector('.comment-list').innerHTML = 
              '<p class="no-comments">아직 댓글이 없습니다. 첫 댓글을 작성해보세요!</p>';
          }
        } catch (error) {
          console.error('댓글 삭제 오류:', error);
          showCommentError('댓글 삭제 중 오류가 발생했습니다: ' + error.message);
          
          // 버튼 상태 복원
          button.textContent = '삭제';
          button.style.pointerEvents = 'auto';
        }
      }
    });
  });
}

/**
 * 댓글 관련 오류 메시지 표시
 * @param {string} message - 오류 메시지
 */
function showCommentError(message) {
  // 기존 오류 메시지 제거
  const existingError = document.querySelector('.comment-error');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'comment-error';
  errorDiv.style.cssText = `
    color: #d32f2f;
    background-color: #ffebee;
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 4px;
    font-size: 14px;
  `;
  errorDiv.textContent = message;
  
  const commentForm = document.querySelector('.comment-form');
  commentForm.insertBefore(errorDiv, commentForm.firstChild);
  
  // 3초 후 오류 메시지 제거
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// 전역 함수 노출
if (typeof window !== 'undefined') {
  window.initComments = initComments;
}

export default {
  initComments
};