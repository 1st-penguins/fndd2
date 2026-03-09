// notices-admin.js - 공지사항 관리 페이지 컨트롤러

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { ensureFirebase } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";
import { getNotices, getNoticeById, createNotice, updateNotice, deleteNotice } from "../data/notice-repository.js";
import { formatSimpleDate } from "../utils/date-utils.js";

// DOM
const publishBtn    = document.getElementById('publish-btn');
const draftBtn      = document.getElementById('draft-btn');
const resetBtn      = document.getElementById('reset-btn');
const refreshBtn    = document.getElementById('refresh-btn');
const titleInput    = document.getElementById('notice-title');
const contentInput  = document.getElementById('notice-content');
const contentPreview= document.getElementById('content-preview');
const badgeSelect   = document.getElementById('notice-badge');
const pinnedCheckbox= document.getElementById('notice-pinned');
const noticeIdInput = document.getElementById('notice-id');
const formTitle     = document.getElementById('form-title');
const noticeCards   = document.getElementById('notice-cards');
const noticesLoading= document.getElementById('notices-loading');
const statusFilter  = document.getElementById('status-filter');
const noticeCount   = document.getElementById('notice-count');
const editorButtons = document.querySelectorAll('.editor-btn[data-format]');

// 토스트 알림
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 2800);
}

// 관리자 확인
async function checkAdminAccess() {
  const { auth } = await ensureFirebase();
  onAuthStateChanged(auth, user => {
    if (user && isAdmin(user)) {
      loadNotices();
    } else {
      toast('관리자 권한이 필요합니다.', 'error');
      setTimeout(() => window.location.href = '../index.html', 1500);
    }
  });
}

// 공지 목록 로드
async function loadNotices() {
  noticesLoading.style.display = 'block';
  noticeCards.style.display = 'none';

  try {
    const all = await getNotices(100, true);
    const statusVal = statusFilter.value;

    let filtered = all;
    if (statusVal === 'published') filtered = all.filter(n => !n.isDraft);
    if (statusVal === 'draft')     filtered = all.filter(n => n.isDraft);

    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const da = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp || 0);
      const db_ = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp || 0);
      return db_ - da;
    });

    noticeCount.textContent = `(${filtered.length}건)`;
    noticesLoading.style.display = 'none';
    noticeCards.style.display = 'flex';

    if (filtered.length === 0) {
      noticeCards.innerHTML = '<p style="color:#868e96;text-align:center;padding:40px;">공지사항이 없습니다.</p>';
      return;
    }

    noticeCards.innerHTML = filtered.map(n => `
      <div class="notice-card ${n.pinned ? 'is-pinned' : ''} ${n.isDraft ? 'is-draft' : ''}" data-id="${n.id}">
        <div class="card-main">
          <div class="card-title">${n.title}</div>
          <div class="card-meta">
            <span class="badge ${n.isDraft ? 'badge-draft' : 'badge-published'}">${n.isDraft ? '초안' : '발행됨'}</span>
            ${n.badge ? `<span class="badge badge-${n.badge}">${n.badge}</span>` : ''}
            <span class="card-date">${formatSimpleDate(n.timestamp)}</span>
          </div>
        </div>
        <div class="card-controls">
          <button class="pin-btn ${n.pinned ? 'pinned' : ''}" title="${n.pinned ? '고정 해제' : '상단 고정'}" data-action="pin" data-id="${n.id}" data-pinned="${n.pinned}">📌</button>
          <button class="card-btn edit" data-action="edit" data-id="${n.id}">수정</button>
          ${n.isDraft ? `<button class="card-btn publish" data-action="publish" data-id="${n.id}">발행</button>` : ''}
          <button class="card-btn delete" data-action="delete" data-id="${n.id}">삭제</button>
        </div>
      </div>
    `).join('');

    noticeCards.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', handleAction);
    });

  } catch (e) {
    noticesLoading.textContent = '불러오기 오류: ' + e.message;
    noticesLoading.style.display = 'block';
  }
}

// 버튼 액션
async function handleAction(e) {
  const btn = e.currentTarget;
  const { action, id, pinned } = btn.dataset;

  if (action === 'edit')    editNotice(id);
  if (action === 'delete')  deleteNoticeWithConfirm(id);
  if (action === 'publish') publishDraft(id);
  if (action === 'pin')     togglePin(id, pinned === 'true');
}

// 고정 토글 (인라인)
async function togglePin(id, currentPinned) {
  try {
    await updateNotice(id, { pinned: !currentPinned });
    toast(!currentPinned ? '상단에 고정했습니다.' : '고정을 해제했습니다.');
    loadNotices();
  } catch (e) {
    toast('오류: ' + e.message, 'error');
  }
}

// 저장
async function saveNotice(isDraft) {
  if (!titleInput.value.trim()) { toast('제목을 입력해주세요.', 'error'); return; }
  if (!contentInput.value.trim() && !isDraft) { toast('내용을 입력해주세요.', 'error'); return; }

  const btn = isDraft ? draftBtn : publishBtn;
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const data = {
      title: titleInput.value.trim(),
      content: contentInput.value.trim(),
      badge: badgeSelect.value || null,
      pinned: pinnedCheckbox.checked,
      isDraft
    };

    if (noticeIdInput.value) {
      await updateNotice(noticeIdInput.value, data);
      toast(isDraft ? '초안으로 저장했습니다.' : '공지를 수정했습니다.');
    } else {
      await createNotice(data);
      toast(isDraft ? '초안으로 저장했습니다.' : '공지를 발행했습니다.');
    }

    resetForm();
    await loadNotices();
  } catch (e) {
    toast('저장 오류: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isDraft ? '초안 저장' : '발행하기';
  }
}

// 수정 준비
async function editNotice(id) {
  try {
    const n = await getNoticeById(id);
    if (!n) { toast('공지를 찾을 수 없습니다.', 'error'); return; }
    noticeIdInput.value = id;
    titleInput.value = n.title || '';
    contentInput.value = n.content || '';
    badgeSelect.value = n.badge || '';
    pinnedCheckbox.checked = n.pinned || false;
    formTitle.textContent = '공지사항 수정';
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    titleInput.focus();
  } catch (e) {
    toast('불러오기 오류: ' + e.message, 'error');
  }
}

// 초안 발행
async function publishDraft(id) {
  try {
    await updateNotice(id, { isDraft: false });
    toast('발행했습니다.');
    loadNotices();
  } catch (e) {
    toast('발행 오류: ' + e.message, 'error');
  }
}

// 삭제
async function deleteNoticeWithConfirm(id) {
  if (!confirm('이 공지사항을 삭제할까요?')) return;
  try {
    await deleteNotice(id);
    toast('삭제했습니다.');
    loadNotices();
  } catch (e) {
    toast('삭제 오류: ' + e.message, 'error');
  }
}

// 폼 초기화
function resetForm() {
  noticeIdInput.value = '';
  titleInput.value = '';
  contentInput.value = '';
  badgeSelect.value = '';
  pinnedCheckbox.checked = false;
  formTitle.textContent = '새 공지사항 작성';
  updatePreview();
}

// 에디터 서식
function insertFormat(format) {
  const ta = contentInput;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.substring(s, e);
  const map = {
    b:  `<strong>${sel || '굵은 텍스트'}</strong>`,
    i:  `<em>${sel || '기울임 텍스트'}</em>`,
    h2: `<h2>${sel || '제목'}</h2>`,
    h3: `<h3>${sel || '소제목'}</h3>`,
    ul: `<ul>\n  <li>${sel || '항목 1'}</li>\n  <li>항목 2</li>\n</ul>`,
    ol: `<ol>\n  <li>${sel || '항목 1'}</li>\n  <li>항목 2</li>\n</ol>`,
    hr: `\n<hr>\n`,
    a:  (() => { const url = prompt('링크 URL:', 'https://'); return url ? `<a href="${url}" target="_blank">${sel || url}</a>` : ''; })(),
  };
  const rep = map[format];
  if (!rep) return;
  ta.value = ta.value.substring(0, s) + rep + ta.value.substring(e);
  ta.selectionStart = ta.selectionEnd = s + rep.length;
  updatePreview();
  ta.focus();
}

// 미리보기
function updatePreview() {
  const c = contentInput.value.trim();
  contentPreview.innerHTML = c
    ? `<div style="line-height:1.7">${c}</div>`
    : '<em style="color:#adb5bd">내용을 입력하면 여기에 미리보기가 표시됩니다.</em>';
}

// 이벤트 등록
document.addEventListener('DOMContentLoaded', () => {
  publishBtn.addEventListener('click', () => saveNotice(false));
  draftBtn.addEventListener('click', () => saveNotice(true));
  resetBtn.addEventListener('click', resetForm);
  refreshBtn.addEventListener('click', loadNotices);
  statusFilter.addEventListener('change', loadNotices);
  contentInput.addEventListener('input', updatePreview);
  editorButtons.forEach(btn => btn.addEventListener('click', () => insertFormat(btn.dataset.format)));
  checkAdminAccess();
});
