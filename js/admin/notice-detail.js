// notice-detail.js - 공지사항 상세 페이지 컨트롤러

import { getNoticeById } from "../data/notice-repository.js";
import { formatSimpleDate } from "../utils/date-utils.js";
import { initComments } from "../data/comment-ui.js";

// 상세 페이지 배지 스타일 동적 추가
function addBadgeStyles() {
  // 이미 스타일이 추가되었는지 확인
  if (document.getElementById('notice-badge-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'notice-badge-styles';
  style.textContent = `
    .notice-badge-new { background-color: #f44336; color: white; }
    .notice-badge-important { background-color: #ff9800; color: white; }
    .notice-badge-urgent { background-color: #d32f2f; color: white; }
    .notice-badge-notice { background-color: #2196f3; color: white; }
    .notice-badge-update { background-color: #4caf50; color: white; }
    .notice-badge-faq { background-color: #607d8b; color: white; }
    .notice-badge-guide { background-color: #009688; color: white; }
    .notice-badge-lecture-upcoming { background-color: #4caf50; color: white; }
    .notice-badge-lecture-ended { background-color: #9e9e9e; color: white; }
    .notice-badge-event { background-color: #8b5cf6; color: white; }
  `;
  
  document.head.appendChild(style);
}

/**
 * 공지사항 상세 페이지 초기화
 */
function initNoticePage() {
  console.log('공지사항 상세 페이지 초기화...');
  
  // 배지 스타일 추가
  addBadgeStyles();
  
  // URL에서 공지사항 ID 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const noticeId = urlParams.get('id');
  
  if (!noticeId) {
    showError('잘못된 접근입니다. 공지사항 ID가 필요합니다.');
    return;
  }
  
  // 공지사항 데이터 로드
  loadNotice(noticeId);
  
  // 좋아요 상태 로드
  loadLikeStatus(noticeId);
  
  console.log('공지사항 상세 페이지 초기화 완료');
}

/**
 * 공지사항 데이터 로드
 * @param {string} noticeId - 공지사항 ID
 */
async function loadNotice(noticeId) {
  try {
    // 데이터 로드
    const notice = await getNoticeById(noticeId);
    
    if (!notice) {
      showError('존재하지 않는 공지사항입니다.');
      return;
    }
    
    // 초안인 경우 처리
    if (notice.isDraft) {
      showError('이 공지사항은 아직 발행되지 않은 초안입니다.');
      return;
    }
    
    // 공지사항 내용 설정
    updateNoticeContent(notice);
  } catch (error) {
    console.error('공지사항 로드 오류:', error);
    showError(`공지사항을 불러오는 중 오류가 발생했습니다: ${error.message}`);
  }
}

/**
 * 공지사항 내용 업데이트
 * @param {Object} notice - 공지사항 데이터
 */
function updateNoticeContent(notice) {
  // 제목 설정
  document.getElementById('notice-title').textContent = notice.title || '제목 없음';
  
  // 내용 설정
  document.getElementById('notice-content').innerHTML = formatContent(notice.content || '');
  
  // 날짜 포맷팅
  document.getElementById('notice-date').textContent = formatSimpleDate(notice.timestamp);
  
  // 배지 설정
  const badgeElement = document.getElementById('notice-badge');
  if (notice.badge) {
    badgeElement.textContent = notice.badge;
    
    // 배지 유형에 따라 동적으로 클래스 추가
    const badgeClassMap = {
      '신규': 'new',
      '중요': 'important',
      '강의예정': 'lecture-upcoming', 
      '강의종료': 'lecture-ended',
      '행사': 'event',
      '안내': 'notice',
      '업데이트': 'update',
      'FAQ': 'faq',
      '가이드': 'guide'
    };

    // 기존 클래스 초기화 후 새 클래스 추가
    badgeElement.className = 'notice-badge';
    const badgeClass = badgeClassMap[notice.badge];
    if (badgeClass) {
      badgeElement.classList.add(`notice-badge-${badgeClass}`);
    }
    
    badgeElement.style.display = 'inline-block';
  } else {
    badgeElement.style.display = 'none';
  }
  
  // 페이지 제목 설정
  document.title = `${notice.title || '공지사항'} - 퍼스트펭귄`;

  // 댓글 기능 초기화
  console.log("공지사항 내용 업데이트 완료, 댓글 초기화 호출:", notice.id);
  try {
    // 댓글 컨테이너 확인 및 생성
    let commentsContainer = document.getElementById('comments-container');
    if (!commentsContainer) {
      console.log("댓글 컨테이너가 없어서 새로 생성합니다");
      
      const contentWrapper = document.querySelector('.notice-content-wrapper');
      if (contentWrapper) {
        commentsContainer = document.createElement('div');
        commentsContainer.id = 'comments-container';
        commentsContainer.className = 'comments-container';
        commentsContainer.innerHTML = `
          <div class="comments-header">
            <h3>댓글</h3>
          </div>
          <div class="comment-form">
            <textarea class="comment-input" placeholder="댓글을 입력하세요..."></textarea>
            <button class="comment-submit">댓글 작성</button>
          </div>
          <div class="comment-list">
            <p class="no-comments">아직 댓글이 없습니다. 첫 댓글을 작성해보세요!</p>
          </div>
        `;
        contentWrapper.appendChild(commentsContainer);
        console.log("댓글 컨테이너를 생성했습니다");
      }
    }
    
    // 댓글 초기화 호출
    initComments(notice.id);
  } catch (error) {
    console.error("댓글 초기화 오류:", error);
  }
}

/**
 * 공지사항 내용 포맷팅
 * @param {string} content - 원본 내용
 * @returns {string} 포맷팅된 내용
 */
function formatContent(content) {
  if (!content) return '<p>내용이 없습니다.</p>';
  
  // 단순 텍스트인 경우 줄바꿈 처리
  if (!content.includes('<')) {
    content = content
      .replace(/\n/g, '<br>')
      // URL을 링크로 변환
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  }
  
  // 전체 내용을 컨테이너 div로 감싸기
  return `<div class="notice-content-wrapper">${content}</div>`;
}

/**
 * 오류 메시지 표시
 * @param {string} message - 오류 메시지
 */
function showError(message) {
  document.getElementById('notice-content').innerHTML = `<p style="color:red;">${message}</p>`;
}

/**
 * 좋아요 상태 로드
 * @param {string} noticeId - 공지사항 ID
 */
async function loadLikeStatus(noticeId) {
  try {
    const likesData = await window.getNoticeLikes(noticeId);
    updateLikeButton(likesData.liked, likesData.count);
  } catch (error) {
    console.error('좋아요 상태 로드 오류:', error);
  }
}

/**
 * 좋아요 버튼 UI 업데이트
 * @param {boolean} liked - 좋아요 여부
 * @param {number} count - 좋아요 수
 */
function updateLikeButton(liked, count) {
  const likeButton = document.getElementById('likeButton');
  const likeCount = document.getElementById('likeCount');
  
  if (!likeButton || !likeCount) return;
  
  likeCount.textContent = count;
  
  if (liked) {
    likeButton.classList.add('liked');
  } else {
    likeButton.classList.remove('liked');
  }
}

/**
 * 좋아요 버튼 클릭 처리
 */
window.handleLike = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const noticeId = urlParams.get('id');
  
  if (!noticeId) {
    alert('오류가 발생했습니다.');
    return;
  }
  
  const likeButton = document.getElementById('likeButton');
  
  try {
    // 버튼 비활성화
    likeButton.disabled = true;
    
    // 좋아요 토글
    const result = await window.toggleNoticeLike(noticeId);
    
    // UI 업데이트
    updateLikeButton(result.liked, result.count);
    
    // 애니메이션 효과
    if (result.liked) {
      likeButton.style.transform = 'scale(1.1)';
      setTimeout(() => {
        likeButton.style.transform = '';
      }, 300);
    }
    
  } catch (error) {
    console.error('좋아요 처리 오류:', error);
    
    if (error.message.includes('로그인')) {
      alert('로그인이 필요한 기능입니다.');
      window.location.href = '../index.html';
    } else {
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    }
  } finally {
    // 버튼 다시 활성화
    likeButton.disabled = false;
  }
};

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', initNoticePage);