import { getWrongAnswers, markAsResolved } from "./wrong-note-service.js";
import { ensureFirebase } from "../core/firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// DOM Elements
const container = document.getElementById("wrong-list-container");
const filterGroup = document.getElementById("subject-filters");
const totalCountEl = document.getElementById("total-wrong-count");
const selectModeBtn = document.getElementById("select-mode-btn");
const actionBar = document.getElementById("action-bar");
const selectedCountEl = document.getElementById("selected-count");
const cancelSelectBtn = document.getElementById("cancel-select-btn");
const resolveSelectedBtn = document.getElementById("resolve-selected-btn");
const quizSelectedBtn = document.getElementById("quiz-selected-btn");
const root = document.getElementById("wrong-note-root");

// 모달 Elements
const modalOverlay = document.getElementById("wrong-detail-modal");
const modalTitle = document.getElementById("modal-title");
const modalQuestion = document.getElementById("modal-question");
const modalOptions = document.getElementById("modal-options");
const modalExplanation = document.getElementById("modal-explanation");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalDismissBtn = document.getElementById("modal-dismiss-btn");
const modalResolveBtn = document.getElementById("modal-resolve-btn");

let allWrongAnswers = [];
let currentWrongAnswers = [];
let activeCertType = localStorage.getItem('currentCertificateType') || 'health-manager';
let activeFilter = 'all';
let selectMode = false;
let selectedIds = new Set();
let collapsedSections = new Set();
let currentModalItem = null;
let firebaseAuth = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!container) return;

  const { auth } = await ensureFirebase();
  firebaseAuth = auth;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadData(user.uid);
    } else {
      container.innerHTML = `
        <div class="wrong-note-empty-state">
          <span class="wrong-note-empty-icon">&#128274;</span>
          <p>로그인이 필요한 서비스입니다.</p>
        </div>
      `;
      // 비로그인 시 로그인 모달 즉시 표시
      if (typeof window.showLoginModal === 'function') {
        setTimeout(() => window.showLoginModal(), 300);
      }
    }
  });

  // 과목 필터 (이벤트 위임)
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

  if (resolveSelectedBtn) {
    resolveSelectedBtn.addEventListener("click", handleResolveSelected);
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
  if (modalResolveBtn) modalResolveBtn.addEventListener("click", handleModalResolve);

  if (container) {
    container.addEventListener("click", handleContainerClick);
  }
});

// ── 이벤트 위임 핸들러 ──
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
  const item = currentWrongAnswers.find(x => x.id === itemEl.dataset.id);
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
async function loadData(userId) {
  try {
    allWrongAnswers = await getWrongAnswers(userId);
    filterByCertType();
  } catch (error) {
    container.innerHTML = `<p style="text-align:center; color:#ef4444; padding:40px;">오답 노트를 불러오는 중 오류가 발생했습니다.<br>${error.message}</p>`;
  }
}

function filterByCertType() {
  currentWrongAnswers = allWrongAnswers.filter(item => {
    const cert = item.certType || 'health-manager';
    return cert === activeCertType;
  });
  activeFilter = 'all';
  updateCertTabs();
  updateFilterButtons();
  renderList();
}

function updateCertTabs() {
  const certTabGroup = document.getElementById('cert-type-tabs');
  if (!certTabGroup) return;

  const healthCount = allWrongAnswers.filter(i => (i.certType || 'health-manager') === 'health-manager').length;
  const sportsCount = allWrongAnswers.filter(i => i.certType === 'sports-instructor').length;
  const sports1Count = allWrongAnswers.filter(i => i.certType === 'sports-instructor-1').length;

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
  const sections = [...new Set(currentWrongAnswers.map(item => item.section).filter(Boolean))];
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
  if (activeFilter === 'all') return currentWrongAnswers;
  return currentWrongAnswers.filter(item => item.section === activeFilter);
}

function getDisplayNumber(item) {
  const qData = item.questionData || {};
  if (typeof qData.id === 'string') {
    const parts = qData.id.split('_');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  return qData.number || 0;
}

// ── 렌더링 ──
function renderList() {
  const filtered = getFilteredItems();
  if (totalCountEl) totalCountEl.textContent = filtered.length;
  container.innerHTML = "";

  if (filtered.length === 0) {
    if (currentWrongAnswers.length === 0) {
      container.innerHTML = `
        <div class="wrong-note-empty-state">
          <span class="wrong-note-empty-icon">&#128079;</span>
          <p>틀린 문제가 없습니다.<br>완벽해요!</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="wrong-note-empty-state">
          <p>해당 과목의 오답이 없습니다.</p>
        </div>
      `;
    }
    return;
  }

  const grouped = {};
  filtered.forEach(item => {
    const section = item.section || '기타';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  Object.entries(grouped).forEach(([section, items]) => {
    items.sort((a, b) => {
      const numA = parseInt(getDisplayNumber(a), 10) || 0;
      const numB = parseInt(getDisplayNumber(b), 10) || 0;
      return numA - numB;
    });

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
      const date = item.lastIncorrectAt
        ? new Date(item.lastIncorrectAt.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
        : '';
      const examName = item.examName || '';
      const count = item.incorrectCount || 1;
      const displayNumber = getDisplayNumber(item);
      const seqIndex = idx + 1;

      const itemEl = document.createElement("div");
      itemEl.className = "wrong-item";
      itemEl.dataset.id = item.id;

      itemEl.innerHTML = `
        <input type="checkbox" class="wrong-item__checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
        <div class="wrong-item__number">${seqIndex}</div>
        <div class="wrong-item__info">
          <div class="wrong-item__title">${examName} ${displayNumber}번</div>
          <div class="wrong-item__meta">
            ${count > 1 ? `<span class="wrong-item__retry-count">${count}회 틀림</span>` : ''}
            ${date ? `<span>${date}</span>` : ''}
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

// ── 이해 완료 처리 ──
async function handleResolveSelected() {
  if (selectedIds.size === 0) return;
  const count = selectedIds.size;
  if (!confirm(`${count}개 문제를 이해 완료 처리하시겠습니까?\n목록에서 제거됩니다.`)) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  const tasks = [];
  selectedIds.forEach(docId => {
    const item = currentWrongAnswers.find(x => x.id === docId);
    if (item) tasks.push({ docId, promise: markAsResolved(user.uid, item.questionId) });
  });

  const results = await Promise.allSettled(tasks.map(t => t.promise));
  const resolvedIds = new Set();
  let failCount = 0;
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') resolvedIds.add(tasks[idx].docId);
    else { failCount++; console.error('이해 완료 처리 실패:', result.reason); }
  });

  if (resolvedIds.size > 0) {
    currentWrongAnswers = currentWrongAnswers.filter(x => !resolvedIds.has(x.id));
    allWrongAnswers = allWrongAnswers.filter(x => !resolvedIds.has(x.id));
  }
  if (failCount > 0) alert(`${failCount}개 문제의 처리에 실패했습니다.`);

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
  const selectedItems = currentWrongAnswers.filter(x => selectedIds.has(x.id));
  if (selectedItems.length === 0) return;

  const quizData = selectedItems.map(item => ({
    questionData: item.questionData,
    section: item.section,
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

  const modalDisplayNum = getDisplayNumber(item);
  modalTitle.textContent = `${item.section || '기타'} - ${item.examName || '문제'} ${modalDisplayNum}번`;

  let questionHtml = '';
  if (data.questionImage) {
    questionHtml += `<img src="${data.questionImage}" alt="문제 이미지" style="max-width:100%; border-radius:8px; margin-bottom:8px;">`;
  }
  if (data.question) {
    questionHtml += `<p>${escapeHtml(data.question)}</p>`;
  }
  modalQuestion.innerHTML = questionHtml || '<p>(이미지 문제)</p>';

  const correctAnswer = Number(data.correctAnswer ?? data.answer ?? -1);
  const userAnswer = data.userAnswer != null ? Number(data.userAnswer) : null;
  if (data.options && data.options.length > 0) {
    modalOptions.innerHTML = data.options.map((opt, idx) => {
      const isCorrect = idx === correctAnswer;
      const isUserWrong = userAnswer !== null && !isCorrect && idx === userAnswer;
      let cls = '';
      let label = '';
      if (isCorrect) { cls = 'correct'; label = ' (정답)'; }
      else if (isUserWrong) { cls = 'user-wrong'; label = ' (내 선택)'; }
      return `<div class="wrong-modal__option ${cls}">${idx + 1}. ${escapeHtml(opt)}${label}</div>`;
    }).join('');
  } else {
    let html = `<div class="wrong-modal__option correct">정답: ${correctAnswer + 1}번</div>`;
    if (userAnswer !== null) {
      html += `<div class="wrong-modal__option user-wrong">내 선택: ${userAnswer + 1}번</div>`;
    }
    modalOptions.innerHTML = html;
  }

  const explanationHtml = (data.explanation || '해설이 없습니다.').replace(/\n/g, '<br>');
  modalExplanation.innerHTML = `<strong>해설</strong><br>${explanationHtml}`;
  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  currentModalItem = null;
}

async function handleModalResolve() {
  if (!currentModalItem) return;
  if (!confirm('이 문제를 이해 완료 처리하시겠습니까?\n목록에서 제거됩니다.')) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  try {
    await markAsResolved(user.uid, currentModalItem.questionId);
    const itemId = currentModalItem.id;
    currentWrongAnswers = currentWrongAnswers.filter(x => x.id !== itemId);
    allWrongAnswers = allWrongAnswers.filter(x => x.id !== itemId);
    updateCertTabs();
    updateFilterButtons();
    renderList();
    closeModal();
  } catch (error) {
    console.error('이해 완료 처리 실패:', error);
    alert('처리에 실패했습니다. 다시 시도해주세요.');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
