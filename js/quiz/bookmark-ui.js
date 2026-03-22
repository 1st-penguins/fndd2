import { getBookmarks, removeBookmark } from "./bookmark-service.js";
import { ensureFirebase } from "../core/firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// DOM Elements
const container = document.getElementById("bookmark-list-container");
const filterGroup = document.getElementById("bookmark-subject-filters");
const totalCountEl = document.getElementById("bookmark-total-count");
const selectModeBtn = document.getElementById("bookmark-select-mode-btn");
const actionBar = document.getElementById("bookmark-action-bar");
const selectedCountEl = document.getElementById("bookmark-selected-count");
const cancelSelectBtn = document.getElementById("bookmark-cancel-btn");
const removeSelectedBtn = document.getElementById("bookmark-remove-btn");
const quizSelectedBtn = document.getElementById("bookmark-quiz-btn");
const root = document.getElementById("bookmark-root");

// 모달 Elements
const modalOverlay = document.getElementById("bm-detail-modal");
const modalTitle = document.getElementById("bm-modal-title");
const modalQuestion = document.getElementById("bm-modal-question");
const modalOptions = document.getElementById("bm-modal-options");
const modalExplanation = document.getElementById("bm-modal-explanation");
const modalCloseBtn = document.getElementById("bm-modal-close-btn");
const modalDismissBtn = document.getElementById("bm-modal-dismiss-btn");
const modalRemoveBtn = document.getElementById("bm-modal-remove-btn");

let allBookmarks = [];
let currentBookmarks = [];
let activeCertType = localStorage.getItem('currentCertificateType') || 'health-manager';
let activeFilter = 'all';
let selectMode = false;
let selectedIds = new Set();
let collapsedSections = new Set();
let currentModalItem = null;
let firebaseAuth = null;
let currentUserId = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!container) return;

  const { auth } = await ensureFirebase();
  firebaseAuth = auth;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      loadBookmarks(user.uid);
    } else {
      currentUserId = null;
      container.innerHTML = `
        <div class="wrong-note-empty-state">
          <span class="wrong-note-empty-icon">&#128274;</span>
          <p>로그인이 필요한 서비스입니다.</p>
        </div>
      `;
    }
  });

  if (filterGroup) {
    filterGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".wrong-note-filter-btn");
      if (!btn) return;
      filterGroup.querySelectorAll(".wrong-note-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.subject;
      renderList();
    });
  }

  if (selectModeBtn) {
    selectModeBtn.addEventListener("click", () => {
      selectMode = !selectMode;
      updateSelectMode();
    });
  }

  if (cancelSelectBtn) {
    cancelSelectBtn.addEventListener("click", () => {
      selectMode = false;
      selectedIds.clear();
      updateSelectMode();
    });
  }

  if (removeSelectedBtn) {
    removeSelectedBtn.addEventListener("click", handleRemoveSelected);
  }

  if (quizSelectedBtn) {
    quizSelectedBtn.addEventListener("click", handleStartQuiz);
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  if (modalRemoveBtn) modalRemoveBtn.addEventListener("click", handleModalRemove);

  if (container) {
    container.addEventListener("click", handleContainerClick);
  }
});

// ── 이벤트 위임 ──
function handleContainerClick(e) {
  const header = e.target.closest(".wn-subject-section__header");
  if (header) {
    const sectionEl = header.closest(".wn-subject-section");
    const sectionName = header.dataset.section;
    if (sectionName) {
      if (collapsedSections.has(sectionName)) {
        collapsedSections.delete(sectionName);
        sectionEl.classList.remove("collapsed");
      } else {
        collapsedSections.add(sectionName);
        sectionEl.classList.add("collapsed");
      }
    }
    return;
  }

  const checkbox = e.target.closest(".wrong-item__checkbox");
  if (checkbox) {
    e.stopPropagation();
    toggleSelection(checkbox.dataset.id, checkbox.checked);
    return;
  }

  const itemEl = e.target.closest(".wrong-item");
  if (!itemEl) return;
  const item = currentBookmarks.find(x => x.id === itemEl.dataset.id);
  if (!item) return;

  if (selectMode) {
    const cb = itemEl.querySelector('.wrong-item__checkbox');
    if (cb) {
      cb.checked = !cb.checked;
      toggleSelection(itemEl.dataset.id, cb.checked);
    }
  } else {
    openDetailModal(item);
  }
}

// ── 데이터 로드 ──
async function loadBookmarks(userId) {
  try {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">로딩 중...</div>';
    allBookmarks = await getBookmarks(userId);
    filterByCertType();
  } catch (error) {
    container.innerHTML = `<p style="text-align:center; color:#ef4444; padding:40px;">북마크를 불러오는 중 오류가 발생했습니다.<br>${error.message}</p>`;
  }
}

function filterByCertType() {
  currentBookmarks = allBookmarks.filter(item => {
    const cert = item.certType || 'health-manager';
    return cert === activeCertType;
  });
  activeFilter = 'all';
  updateCertTabs();
  updateFilterButtons();
  renderList();
}

function updateCertTabs() {
  const certTabGroup = document.getElementById('bookmark-cert-tabs');
  if (!certTabGroup) return;

  const healthCount = allBookmarks.filter(i => (i.certType || 'health-manager') === 'health-manager').length;
  const sportsCount = allBookmarks.filter(i => i.certType === 'sports-instructor').length;
  const sports1Count = allBookmarks.filter(i => i.certType === 'sports-instructor-1').length;

  certTabGroup.innerHTML = `
    <button class="wrong-note-cert-btn ${activeCertType === 'health-manager' ? 'active' : ''}" data-cert="health-manager">
      건강운동관리사 <span class="wrong-note-cert-count">${healthCount}</span>
    </button>
    <button class="wrong-note-cert-btn ${activeCertType === 'sports-instructor-1' ? 'active' : ''}" data-cert="sports-instructor-1">
      1급 스포츠지도사 <span class="wrong-note-cert-count">${sports1Count}</span>
    </button>
    <button class="wrong-note-cert-btn ${activeCertType === 'sports-instructor' ? 'active' : ''}" data-cert="sports-instructor">
      2급 스포츠지도사 <span class="wrong-note-cert-count">${sportsCount}</span>
    </button>
  `;

  certTabGroup.querySelectorAll('.wrong-note-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCertType = btn.dataset.cert;
      collapsedSections.clear();
      filterByCertType();
    });
  });
}

function updateFilterButtons() {
  if (!filterGroup) return;
  const sections = [...new Set(currentBookmarks.map(item => item.section || item.questionData?.subject).filter(Boolean))];
  filterGroup.innerHTML = '<button class="wrong-note-filter-btn active" data-subject="all">전체</button>';
  sections.forEach(section => {
    const btn = document.createElement("button");
    btn.className = "wrong-note-filter-btn";
    btn.dataset.subject = section;
    btn.textContent = section;
    filterGroup.appendChild(btn);
  });
}

function getFilteredItems() {
  if (activeFilter === 'all') return currentBookmarks;
  return currentBookmarks.filter(item => (item.section || item.questionData?.subject) === activeFilter);
}

function getDisplayNumber(item) {
  const qId = String(item.questionId || '');
  if (qId) {
    const parts = qId.split('_');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  return item.questionData?.number || 0;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const ms = ts.seconds ? ts.seconds * 1000 : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
  if (isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ── 렌더링 ──
function renderList() {
  const filtered = getFilteredItems();
  if (totalCountEl) totalCountEl.textContent = filtered.length;
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="wrong-note-empty-state">
        <span class="wrong-note-empty-icon">&#9734;</span>
        <p>${currentBookmarks.length === 0 ? '저장된 북마크가 없습니다.<br>문제 풀이 중 리본 버튼을 눌러 저장하세요.' : '해당 과목의 북마크가 없습니다.'}</p>
      </div>
    `;
    return;
  }

  const grouped = {};
  filtered.forEach(item => {
    const section = item.section || item.questionData?.subject || '기타';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  Object.entries(grouped).forEach(([section, items]) => {
    items.sort((a, b) => (getDisplayNumber(a) || 0) - (getDisplayNumber(b) || 0));

    const isCollapsed = collapsedSections.has(section);
    const sectionEl = document.createElement("div");
    sectionEl.className = `wn-subject-section${isCollapsed ? ' collapsed' : ''}`;

    const headerEl = document.createElement("div");
    headerEl.className = "wn-subject-section__header";
    headerEl.dataset.section = section;
    headerEl.innerHTML = `
      <div class="wn-subject-section__left">
        <span class="wn-subject-section__toggle">&#9662;</span>
        <span class="wn-subject-section__title">${section}</span>
      </div>
      <span class="wn-subject-section__count">${items.length}문제</span>
    `;
    sectionEl.appendChild(headerEl);

    const listWrapper = document.createElement("div");
    listWrapper.className = "wn-subject-section__list";

    items.forEach((item, idx) => {
      const date = formatTimestamp(item.bookmarkedAt);
      const examName = item.examName || '';
      const displayNumber = getDisplayNumber(item);

      const itemEl = document.createElement("div");
      itemEl.className = "wrong-item";
      itemEl.dataset.id = item.id;

      itemEl.innerHTML = `
        <input type="checkbox" class="wrong-item__checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
        <div class="wrong-item__number" style="background:#fef3c7; color:#d97706;">${idx + 1}</div>
        <div class="wrong-item__info">
          <div class="wrong-item__title">${examName} ${displayNumber}번</div>
          <div class="wrong-item__meta">
            ${date ? `<span>${date} 저장</span>` : ''}
          </div>
        </div>
        <span class="wrong-item__arrow">&#8250;</span>
      `;
      listWrapper.appendChild(itemEl);
    });

    sectionEl.appendChild(listWrapper);
    container.appendChild(sectionEl);
  });
}

// ── 선택 모드 ──
function toggleSelection(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateSelectedCount();
}

function updateSelectMode() {
  if (selectMode) {
    root.classList.add("select-mode");
    actionBar.classList.add("visible");
    selectModeBtn.textContent = "완료";
  } else {
    root.classList.remove("select-mode");
    actionBar.classList.remove("visible");
    selectModeBtn.textContent = "선택";
    selectedIds.clear();
    container.querySelectorAll('.wrong-item__checkbox').forEach(cb => { cb.checked = false; });
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = selectedIds.size;
  if (selectedCountEl) selectedCountEl.textContent = `${count}개 선택됨`;
  if (quizSelectedBtn) quizSelectedBtn.disabled = count === 0;
}

// ── 북마크 해제 ──
async function handleRemoveSelected() {
  if (selectedIds.size === 0) return;
  const count = selectedIds.size;
  if (!confirm(`${count}개 북마크를 해제하시겠습니까?`)) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  const tasks = [];
  selectedIds.forEach(docId => {
    const item = currentBookmarks.find(x => x.id === docId);
    if (item) tasks.push({ docId, promise: removeBookmark(user.uid, item.questionId) });
  });

  const results = await Promise.allSettled(tasks.map(t => t.promise));
  const removedIds = new Set();
  let failCount = 0;
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') removedIds.add(tasks[idx].docId);
    else { failCount++; console.error('북마크 해제 실패:', result.reason); }
  });

  if (removedIds.size > 0) {
    currentBookmarks = currentBookmarks.filter(x => !removedIds.has(x.id));
    allBookmarks = allBookmarks.filter(x => !removedIds.has(x.id));
  }
  if (failCount > 0) alert(`${failCount}개 처리에 실패했습니다.`);

  selectedIds.clear();
  selectMode = false;
  updateSelectMode();
  updateCertTabs();
  updateFilterButtons();
  renderList();
}

// ── 다시 풀기 ──
function handleStartQuiz() {
  if (selectedIds.size === 0) return;
  const selectedItems = currentBookmarks.filter(x => selectedIds.has(x.id));
  if (selectedItems.length === 0) return;

  const quizData = selectedItems.map(item => ({
    questionData: item.questionData,
    section: item.section || item.questionData?.subject || '',
    examName: item.examName,
    questionId: item.questionId,
    docId: item.id
  }));

  sessionStorage.setItem('wrongReviewQuestions', JSON.stringify(quizData));
  window.location.href = `exam-new/quiz.html?mode=wrong-review&count=${quizData.length}`;
}

// ── 상세 모달 ──
function openDetailModal(item) {
  currentModalItem = item;
  const data = item.questionData || {};
  const displayNum = getDisplayNumber(item);
  const sectionName = item.section || data.subject || '기타';

  modalTitle.textContent = `${sectionName} - ${item.examName || '문제'} ${displayNum}번`;

  let questionHtml = '';
  if (data.questionImage) {
    questionHtml += `<img src="${data.questionImage}" alt="문제 이미지" style="max-width:100%; border-radius:8px; margin-bottom:8px;">`;
  }
  if (data.question) {
    questionHtml += `<p>${escapeHtml(data.question)}</p>`;
  }
  modalQuestion.innerHTML = questionHtml || '<p>(이미지 문제)</p>';

  const correctAnswer = Number(data.correctAnswer ?? data.answer ?? -1);
  if (data.options && data.options.length > 0) {
    modalOptions.innerHTML = data.options.map((opt, idx) => {
      const isCorrect = idx === correctAnswer;
      let cls = isCorrect ? 'correct' : '';
      let label = isCorrect ? ' (정답)' : '';
      return `<div class="wrong-modal__option ${cls}">${idx + 1}. ${escapeHtml(opt)}${label}</div>`;
    }).join('');
  } else {
    modalOptions.innerHTML = `<div class="wrong-modal__option correct">정답: ${correctAnswer + 1}번</div>`;
  }

  const explanationHtml = (data.explanation || '해설이 없습니다.').replace(/\n/g, '<br>');
  modalExplanation.innerHTML = `<strong>해설</strong><br>${explanationHtml}`;
  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  currentModalItem = null;
}

async function handleModalRemove() {
  if (!currentModalItem) return;
  if (!confirm('이 문제의 북마크를 해제하시겠습니까?')) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  try {
    await removeBookmark(user.uid, currentModalItem.questionId);
    const itemId = currentModalItem.id;
    currentBookmarks = currentBookmarks.filter(x => x.id !== itemId);
    allBookmarks = allBookmarks.filter(x => x.id !== itemId);
    updateCertTabs();
    updateFilterButtons();
    renderList();
    closeModal();
  } catch (error) {
    console.error('북마크 해제 실패:', error);
    alert('처리에 실패했습니다. 다시 시도해주세요.');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
