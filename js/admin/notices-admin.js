// notices-admin.js - 공지사항 관리 페이지 컨트롤러

import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  getDoc,
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { auth, db, ADMIN_EMAILS } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";
import { 
  getNotices, 
  getNoticeById, 
  createNotice, 
  updateNotice, 
  deleteNotice 
} from "../data/notice-repository.js";
import { formatSimpleDate } from "../utils/date-utils.js";

// DOM 요소
const publishBtn = document.getElementById('publish-btn');
const draftBtn = document.getElementById('draft-btn');
const resetBtn = document.getElementById('reset-btn');
const refreshBtn = document.getElementById('refresh-btn');
const titleInput = document.getElementById('notice-title');
const contentInput = document.getElementById('notice-content');
const contentPreview = document.getElementById('content-preview');
const badgeSelect = document.getElementById('notice-badge');
const pinnedCheckbox = document.getElementById('notice-pinned');
const noticeIdInput = document.getElementById('notice-id');
const formTitle = document.getElementById('form-title');
const noticesList = document.getElementById('notices-list');
const noticesLoading = document.getElementById('notices-loading');
const noticesTable = document.getElementById('notices-table');
const statusFilter = document.getElementById('status-filter');
const badgeFilter = document.getElementById('badge-filter');
const fontColorSelect = document.getElementById('font-color');
const editorButtons = document.querySelectorAll('.editor-btn[data-format]');

/**
 * 페이지 초기화
 */
function initNoticesAdmin() {
  console.log('공지사항 관리 페이지 초기화...');
  
  // 이벤트 리스너 등록
  setupEventListeners();
  
  // 에디터 초기화
  initEditor();
  
  // 로그인 상태 확인 및 관리자 권한 체크
  checkAdminAccess();
  
  console.log('공지사항 관리 페이지 초기화 완료');
}

/**
 * 이벤트 리스너 등록
 */
function setupEventListeners() {
  // 발행 버튼
  publishBtn.addEventListener('click', () => saveNotice(false));
  
  // 초안 저장 버튼
  draftBtn.addEventListener('click', () => saveNotice(true));
  
  // 폼 초기화 버튼
  resetBtn.addEventListener('click', resetForm);
  
  // 새로고침 버튼
  refreshBtn.addEventListener('click', loadNotices);
  
  // 필터 변경
  statusFilter.addEventListener('change', loadNotices);
  badgeFilter.addEventListener('change', loadNotices);
  
  // 내용 입력 시 미리보기 업데이트
  contentInput.addEventListener('input', updatePreview);
}

/**
 * 관리자 권한 확인
 */
function checkAdminAccess() {
  onAuthStateChanged(auth, (user) => {
    if (user && isAdmin(user)) {
      console.log("관리자로 로그인됨:", user.email);
      // 공지사항 목록 로드
      loadNotices();
    } else {
      alert("관리자 권한이 필요합니다.");
      window.location.href = "../index.html";
    }
  });
}

/**
 * 에디터 초기화
 */
function initEditor() {
  // 에디터 버튼 이벤트
  editorButtons.forEach(button => {
    button.addEventListener('click', () => {
      insertFormat(button.dataset.format);
      contentInput.focus();
    });
  });
  
  // 글자 색상 변경 이벤트
  fontColorSelect.addEventListener('change', () => {
    changeTextColor(fontColorSelect.value);
    contentInput.focus();
  });
  
  // 초기 미리보기 설정
  updatePreview();
}

/**
 * 공지사항 목록 로드
 */
async function loadNotices() {
  try {
    // 필터 상태
    const statusValue = statusFilter.value;
    const badgeValue = badgeFilter.value;
    
    // 로딩 표시
    noticesLoading.style.display = "block";
    noticesTable.style.display = "none";
    
    // 모든 공지사항 로드 (관리자 모드에서는 모든 공지사항, 초안 포함)
    const notices = await getNotices(100, true);
    
    // 로딩 숨기기
    noticesLoading.style.display = "none";
    noticesTable.style.display = "table";
    
    if (notices.length === 0) {
      noticesList.innerHTML = '<tr><td colspan="6" style="text-align:center;">공지사항이 없습니다.</td></tr>';
      return;
    }
    
    // 모든 공지사항 데이터
    let allNotices = notices;
    
    // 상태 필터링
    if (statusValue === 'published') {
      allNotices = allNotices.filter(notice => !notice.isDraft);
    } else if (statusValue === 'draft') {
      allNotices = allNotices.filter(notice => notice.isDraft);
    }
    
    // 배지 필터링
    if (badgeValue !== 'all') {
      if (badgeValue === '') {
        // '없음' 선택 시 배지가 없는 항목만 표시
        allNotices = allNotices.filter(notice => !notice.badge);
      } else {
        // 특정 배지 선택 시
        allNotices = allNotices.filter(notice => notice.badge === badgeValue);
      }
    }
    
    // 결과 없음 처리
    if (allNotices.length === 0) {
      noticesList.innerHTML = '<tr><td colspan="6" style="text-align:center;">표시할 공지사항이 없습니다.</td></tr>';
      return;
    }
    
    // 정렬: 고정 항목 우선, 날짜 기준 내림차순
    allNotices.sort((a, b) => {
      // 먼저 고정 여부로 정렬
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // 같은 고정 상태면 날짜로 정렬
      const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return dateB - dateA;
    });
    
    // HTML 생성
    let html = '';
    allNotices.forEach((notice) => {
      html += `
        <tr>
          <td><span class="notice-status ${notice.isDraft ? 'status-draft' : 'status-published'}">${notice.isDraft ? '초안' : '발행됨'}</span></td>
          <td>${notice.title}</td>
          <td>${notice.badge ? 
              `<span class="badge badge-${notice.badge}">${notice.badge}</span>` : 
              '-'}</td>
          <td>${notice.pinned ? '고정됨' : '일반'}</td>
          <td>${formatSimpleDate(notice.timestamp)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-primary btn-sm" data-action="edit" data-id="${notice.id}">수정</button>
              ${notice.isDraft ? 
                `<button class="btn btn-warning btn-sm" data-action="publish" data-id="${notice.id}">발행</button>` : ''}
              <button class="btn btn-danger btn-sm" data-action="delete" data-id="${notice.id}">삭제</button>
            </div>
          </td>
        </tr>
      `;
    });
    
    noticesList.innerHTML = html;
    
    // 관리 버튼 이벤트 리스너 등록
    noticesList.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', handleActionButtonClick);
    });
  } catch (error) {
    console.error("공지사항 로드 오류:", error);
    noticesLoading.textContent = "공지사항을 불러오는 중 오류가 발생했습니다: " + error.message;
  }
}

/**
 * 액션 버튼 클릭 핸들러
 * @param {Event} event - 클릭 이벤트
 */
function handleActionButtonClick(event) {
  const button = event.currentTarget;
  const action = button.getAttribute('data-action');
  const noticeId = button.getAttribute('data-id');
  
  switch (action) {
    case 'edit':
      editNotice(noticeId);
      break;
    case 'publish':
      publishDraft(noticeId);
      break;
    case 'delete':
      deleteNoticeWithConfirm(noticeId);
      break;
  }
}

/**
 * 공지사항 저장 (새로 작성 또는 수정)
 * @param {boolean} isDraft - 초안 여부
 */
async function saveNotice(isDraft = false) {
  if (!titleInput.value.trim()) {
    alert('제목을 입력해주세요.');
    return;
  }
  
  if (!contentInput.value.trim() && !isDraft) {
    alert('내용을 입력해주세요.');
    return;
  }
  
  try {
    const actionBtn = isDraft ? draftBtn : publishBtn;
    actionBtn.disabled = true;
    actionBtn.textContent = '처리 중...';
    
    const noticeData = {
      title: titleInput.value.trim(),
      content: contentInput.value.trim(),
      badge: badgeSelect.value || null,
      pinned: pinnedCheckbox.checked,
      isDraft: isDraft
    };
    
    let result;
    
    if (noticeIdInput.value) {
      // 기존 공지사항 수정
      result = await updateNotice(noticeIdInput.value, noticeData);
      alert(`공지사항이 ${isDraft ? '초안으로 저장' : '발행'}되었습니다.`);
    } else {
      // 새 공지사항 작성
      result = await createNotice(noticeData);
      alert(`새 공지사항이 ${isDraft ? '초안으로 저장' : '발행'}되었습니다.`);
    }
    
    // 폼 초기화
    resetForm();
    
    // 목록 새로고침
    await loadNotices();
  } catch (error) {
    console.error('저장 오류:', error);
    alert('저장 중 오류가 발생했습니다: ' + error.message);
  } finally {
    const actionBtn = isDraft ? draftBtn : publishBtn;
    actionBtn.disabled = false;
    actionBtn.textContent = isDraft ? '초안 저장' : '발행하기';
  }
}

/**
 * 초안 발행하기
 * @param {string} noticeId - 공지사항 ID
 */
async function publishDraft(noticeId) {
  try {
    // 공지사항 데이터 가져오기
    const notice = await getNoticeById(noticeId);
    
    if (!notice) {
      alert('공지사항을 찾을 수 없습니다.');
      return;
    }
    
    // isDraft 속성만 수정
    const result = await updateNotice(noticeId, {
      isDraft: false
    });
    
    alert('초안이 발행되었습니다.');
    await loadNotices();
  } catch (error) {
    console.error('초안 발행 오류:', error);
    alert('초안 발행 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 공지사항 수정 준비
 * @param {string} noticeId - 공지사항 ID
 */
async function editNotice(noticeId) {
  try {
    const notice = await getNoticeById(noticeId);
    
    if (!notice) {
      alert('공지사항을 찾을 수 없습니다.');
      return;
    }
    
    // 폼에 데이터 채우기
    noticeIdInput.value = noticeId;
    titleInput.value = notice.title || '';
    contentInput.value = notice.content || '';
    badgeSelect.value = notice.badge || '';
    pinnedCheckbox.checked = notice.pinned || false;
    
    formTitle.textContent = '공지사항 수정';
    updatePreview();
    
    // 폼으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('수정 준비 오류:', error);
    alert('공지사항 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 공지사항 삭제 (확인 메시지 포함)
 * @param {string} noticeId - 공지사항 ID
 */
async function deleteNoticeWithConfirm(noticeId) {
  if (confirm('정말 이 공지사항을 삭제하시겠습니까?')) {
    try {
      await deleteNotice(noticeId);
      alert('공지사항이 삭제되었습니다.');
      await loadNotices();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 실패: ' + error.message);
    }
  }
}

/**
 * 폼 초기화 함수
 */
function resetForm() {
  noticeIdInput.value = '';
  titleInput.value = '';
  contentInput.value = '';
  badgeSelect.value = '';
  pinnedCheckbox.checked = false;
  formTitle.textContent = '새 공지사항 작성';
  updatePreview();
}

/**
 * 텍스트 에디터 기능
 * @param {string} format - 포맷 유형
 */
function insertFormat(format) {
  const textarea = contentInput;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  let replacement = '';
  
  switch(format) {
    case 'h1':
      replacement = `<h1>${selectedText || '제목 1'}</h1>`;
      break;
    case 'h2':
      replacement = `<h2>${selectedText || '제목 2'}</h2>`;
      break;
    case 'h3':
      replacement = `<h3>${selectedText || '제목 3'}</h3>`;
      break;
    case 'b':
      replacement = `<b>${selectedText || '굵은 텍스트'}</b>`;
      break;
    case 'i':
      replacement = `<i>${selectedText || '기울임 텍스트'}</i>`;
      break;
    case 'u':
      replacement = `<u>${selectedText || '밑줄 텍스트'}</u>`;
      break;
    case 'ul':
      replacement = `<ul>\n  <li>${selectedText || '목록 항목'}</li>\n  <li>항목 2</li>\n</ul>`;
      break;
    case 'ol':
      replacement = `<ol>\n  <li>${selectedText || '번호 항목'}</li>\n  <li>항목 2</li>\n</ol>`;
      break;
    case 'img':
      const imgUrl = prompt('이미지 URL을 입력하세요:', 'https://');
      if (imgUrl) {
        replacement = `<img src="${imgUrl}" alt="이미지" style="max-width:100%">`;
      }
      break;
    case 'a':
      const url = prompt('링크 URL을 입력하세요:', 'https://');
      if (url) {
        replacement = `<a href="${url}" target="_blank">${selectedText || url}</a>`;
      }
      break;
    case 'center':
      replacement = `<div style="text-align:center">${selectedText || '가운데 정렬된 텍스트'}</div>`;
      break;
    case 'quote':
      replacement = `<blockquote style="border-left:3px solid #ddd; padding-left:10px; margin-left:20px; color:#666">${selectedText || '인용구 텍스트'}</blockquote>`;
      break;
  }
  
  if (replacement) {
    textarea.value = 
      textarea.value.substring(0, start) + 
      replacement + 
      textarea.value.substring(end);
    
    // 커서 위치 설정
    const newCursorPos = start + replacement.length;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;
    
    // 미리보기 업데이트
    updatePreview();
  }
}

/**
 * 글자 색상 변경
 * @param {string} color - 색상 코드
 */
function changeTextColor(color) {
  if (!color) return;
  
  const textarea = contentInput;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  
  const replacement = `<span style="color:${color}">${selectedText || '색상 텍스트'}</span>`;
  
  textarea.value = 
    textarea.value.substring(0, start) + 
    replacement + 
    textarea.value.substring(end);
  
  // 커서 위치 설정
  const newCursorPos = start + replacement.length;
  textarea.selectionStart = newCursorPos;
  textarea.selectionEnd = newCursorPos;
  
  // 색상 선택 초기화
  fontColorSelect.value = '';
  
  // 미리보기 업데이트
  updatePreview();
}

/**
 * 미리보기 업데이트
 */
function updatePreview() {
  const content = contentInput.value.trim();
  // 기본 컨테이너 스타일 추가
  contentPreview.innerHTML = content ? 
    `<div style="width:100%; text-align:left; line-height:1.6;">${content}</div>` : 
    '<em>미리보기 내용이 여기에 표시됩니다.</em>';
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', initNoticesAdmin);

// 전역 함수로 노출 (기존 인라인 이벤트 핸들러와의 호환성 유지)
window.editNotice = editNotice;
window.deleteNotice = deleteNoticeWithConfirm;
window.publishDraft = publishDraft;