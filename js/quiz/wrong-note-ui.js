import { getWrongAnswers, markAsResolved } from "./wrong-note-service.js";
import { getBookmarks, removeBookmark } from "./bookmark-service.js";
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

let allWrongAnswers = []; // 전체 오답 (모든 자격증)
let currentWrongAnswers = []; // 현재 자격증 필터링 결과
let activeCertType = localStorage.getItem('currentCertificateType') || 'health-manager';
let activeFilter = 'all';
let selectMode = false;
let selectedIds = new Set();
let collapsedSections = new Set(); // 접힌 과목 섹션 추적
let currentModalItem = null;
let firebaseAuth = null;
let currentUserId = null;

// 북마크 관련 상태
let activeView = 'wrong'; // 'wrong' | 'bookmark'
let allBookmarks = [];
let currentBookmarks = []; // 현재 자격증 필터링 결과
const viewToggle = document.getElementById("view-toggle");
const pageTitleEl = document.getElementById("page-title-text");
const pageSubtitleEl = document.getElementById("page-subtitle-text");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!container) return;

  const { auth } = await ensureFirebase();
  firebaseAuth = auth;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      loadData(user.uid);
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

  // 과목 필터 (이벤트 위임)
  if (filterGroup) {
    filterGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".wrong-note-filter-btn");
      if (!btn) return;
      filterGroup.querySelectorAll(".wrong-note-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.subject;
      if (activeView === 'bookmark') {
        renderBookmarkList();
      } else {
        renderList();
      }
    });
  }

  // 선택 모드 토글
  if (selectModeBtn) {
    selectModeBtn.addEventListener("click", () => {
      selectMode = !selectMode;
      updateSelectMode();
    });
  }

  // 선택 취소
  if (cancelSelectBtn) {
    cancelSelectBtn.addEventListener("click", () => {
      selectMode = false;
      selectedIds.clear();
      updateSelectMode();
    });
  }

  // 이해 완료 (선택된 문제들)
  if (resolveSelectedBtn) {
    resolveSelectedBtn.addEventListener("click", handleResolveSelected);
  }

  // 다시 풀기
  if (quizSelectedBtn) {
    quizSelectedBtn.addEventListener("click", handleStartQuiz);
  }

  // 모달 닫기
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  if (modalResolveBtn) modalResolveBtn.addEventListener("click", handleModalResolve);

  // 컨테이너 이벤트 위임 (아이템 클릭 + 체크박스 + 헤더 접기/펼치기)
  if (container) {
    container.addEventListener("click", handleContainerClick);
  }

  // 오답/북마크 뷰 토글
  if (viewToggle) {
    viewToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".wn-view-toggle__btn");
      if (!btn || btn.dataset.view === activeView) return;
      viewToggle.querySelectorAll(".wn-view-toggle__btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeView = btn.dataset.view;
      activeFilter = 'all';
      collapsedSections.clear();
      selectedIds.clear();
      selectMode = false;
      updateSelectMode();
      updateViewUI();
      if (activeView === 'bookmark' && currentUserId) {
        loadBookmarks(currentUserId);
      } else {
        filterByCertType();
      }
    });
  }
});

// ── 이벤트 위임 핸들러 ──
function handleContainerClick(e) {
  // 1. 과목 섹션 헤더 클릭 → 접기/펼치기
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

  // 2. 체크박스 클릭
  const checkbox = e.target.closest(".wrong-item__checkbox");
  if (checkbox) {
    e.stopPropagation();
    const itemId = checkbox.dataset.id;
    toggleSelection(itemId, checkbox.checked);
    return;
  }

  // 3. 아이템 클릭
  const itemEl = e.target.closest(".wrong-item");
  if (!itemEl) return;
  const itemId = itemEl.dataset.id;
  const dataSource = activeView === 'bookmark' ? currentBookmarks : currentWrongAnswers;
  const item = dataSource.find(x => x.id === itemId);
  if (!item) return;

  if (selectMode) {
    const cb = itemEl.querySelector('.wrong-item__checkbox');
    if (cb) {
      cb.checked = !cb.checked;
      toggleSelection(itemId, cb.checked);
    }
  } else {
    openDetailModal(item);
  }
}

// ── 뷰 전환 UI 업데이트 ──
function updateViewUI() {
  if (activeView === 'bookmark') {
    if (pageTitleEl) pageTitleEl.textContent = '북마크';
    if (pageSubtitleEl) pageSubtitleEl.textContent = '중요 문제를 저장하고 반복 학습하세요.';
    if (selectModeBtn) selectModeBtn.style.display = 'inline-block';
    if (resolveSelectedBtn) resolveSelectedBtn.textContent = '북마크 해제';
  } else {
    if (pageTitleEl) pageTitleEl.textContent = '오답 노트';
    if (pageSubtitleEl) pageSubtitleEl.textContent = '틀렸던 문제를 다시 확인하고 완벽하게 내 것으로 만드세요.';
    if (selectModeBtn) selectModeBtn.style.display = 'inline-block';
    if (resolveSelectedBtn) resolveSelectedBtn.textContent = '이해 완료';
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

async function loadBookmarks(userId) {
  try {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">로딩 중...</div>';
    allBookmarks = await getBookmarks(userId);
    filterBookmarksByCertType();
  } catch (error) {
    container.innerHTML = `<p style="text-align:center; color:#ef4444; padding:40px;">북마크를 불러오는 중 오류가 발생했습니다.<br>${error.message}</p>`;
  }
}

function filterBookmarksByCertType() {
  currentBookmarks = allBookmarks.filter(item => {
    const cert = item.certType || 'health-manager';
    return cert === activeCertType;
  });
  activeFilter = 'all';
  updateCertTabs();
  updateBookmarkFilterButtons();
  renderBookmarkList();
}

function updateBookmarkFilterButtons() {
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

function getFilteredBookmarks() {
  if (activeFilter === 'all') return currentBookmarks;
  return currentBookmarks.filter(item => (item.section || item.questionData?.subject) === activeFilter);
}

function renderBookmarkList() {
  const filtered = getFilteredBookmarks();
  if (totalCountEl) totalCountEl.textContent = filtered.length;
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="wrong-note-empty-state">
        <span class="wrong-note-empty-icon">&#9734;</span>
        <p>${currentBookmarks.length === 0 ? '저장된 북마크가 없습니다.<br>문제 풀이 중 ★ 버튼을 눌러 저장하세요.' : '해당 과목의 북마크가 없습니다.'}</p>
      </div>
    `;
    return;
  }

  // 과목별 그룹화
  const grouped = {};
  filtered.forEach(item => {
    const section = item.section || item.questionData?.subject || '기타';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  Object.entries(grouped).forEach(([section, items]) => {
    items.sort((a, b) => {
      const numA = getBookmarkDisplayNumber(a) || 0;
      const numB = getBookmarkDisplayNumber(b) || 0;
      return numA - numB; // 문제 번호순
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
      let date = '';
      const ts = item.bookmarkedAt;
      if (ts) {
        const ms = ts.seconds ? ts.seconds * 1000 : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
        if (!isNaN(ms)) date = new Date(ms).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      }
      const examName = item.examName || '';
      const displayNumber = getBookmarkDisplayNumber(item);
      const seqIndex = idx + 1;

      const itemEl = document.createElement("div");
      itemEl.className = "wrong-item";
      itemEl.dataset.id = item.id;

      itemEl.innerHTML = `
        <input type="checkbox" class="wrong-item__checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
        <div class="wrong-item__number" style="background:#fef3c7; color:#d97706;">${seqIndex}</div>
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

function getBookmarkDisplayNumber(item) {
  const qId = String(item.questionId || '');
  if (qId) {
    const parts = qId.split('_');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  const qData = item.questionData || {};
  return qData.number || 0;
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

  const dataSource = activeView === 'bookmark' ? allBookmarks : allWrongAnswers;
  const healthCount = dataSource.filter(i => (i.certType || 'health-manager') === 'health-manager').length;
  const sportsCount = dataSource.filter(i => i.certType === 'sports-instructor').length;

  certTabGroup.innerHTML = `
    <button class="wrong-note-cert-btn ${activeCertType === 'health-manager' ? 'active' : ''}" data-cert="health-manager">
      건강운동관리사 <span class="wrong-note-cert-count">${healthCount}</span>
    </button>
    <button class="wrong-note-cert-btn ${activeCertType === 'sports-instructor' ? 'active' : ''}" data-cert="sports-instructor">
      생활스포츠지도사 <span class="wrong-note-cert-count">${sportsCount}</span>
    </button>
  `;

  certTabGroup.querySelectorAll('.wrong-note-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCertType = btn.dataset.cert;
      collapsedSections.clear();
      if (activeView === 'bookmark') {
        filterBookmarksByCertType();
      } else {
        filterByCertType();
      }
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

// ── 렌더링 (이벤트 위임 방식 — 리스너 0개) ──
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

  // 과목별로 그룹화
  const grouped = {};
  filtered.forEach(item => {
    const section = item.section || '기타';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(item);
  });

  // 과목별 섹션 렌더링
  Object.entries(grouped).forEach(([section, items]) => {
    items.sort((a, b) => {
      const numA = parseInt(getDisplayNumber(a), 10) || 0;
      const numB = parseInt(getDisplayNumber(b), 10) || 0;
      return numA - numB;
    });

    const isCollapsed = collapsedSections.has(section);
    const sectionEl = document.createElement("div");
    sectionEl.className = `wn-subject-section${isCollapsed ? ' collapsed' : ''}`;

    // 헤더 (클릭으로 접기/펼치기 — 이벤트 위임)
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

    // 아이템 목록 래퍼 (접기 애니메이션용)
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
  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
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

// ── 이해 완료 / 북마크 해제 처리 ──
async function handleResolveSelected() {
  if (selectedIds.size === 0) return;

  const count = selectedIds.size;
  const isBookmarkView = activeView === 'bookmark';
  const confirmMsg = isBookmarkView
    ? `${count}개 북마크를 해제하시겠습니까?`
    : `${count}개 문제를 이해 완료 처리하시겠습니까?\n목록에서 제거됩니다.`;
  if (!confirm(confirmMsg)) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  if (isBookmarkView) {
    // 북마크 해제
    const tasks = [];
    selectedIds.forEach(docId => {
      const item = currentBookmarks.find(x => x.id === docId);
      if (item) {
        tasks.push({ docId, promise: removeBookmark(user.uid, item.questionId) });
      }
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
    updateBookmarkFilterButtons();
    renderBookmarkList();
  } else {
    // 오답 이해 완료
    const tasks = [];
    selectedIds.forEach(docId => {
      const item = currentWrongAnswers.find(x => x.id === docId);
      if (item) {
        tasks.push({ docId, promise: markAsResolved(user.uid, item.questionId) });
      }
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
}

// ── 다시 풀기 ──
function handleStartQuiz() {
  if (selectedIds.size === 0) return;

  const dataSource = activeView === 'bookmark' ? currentBookmarks : currentWrongAnswers;
  const selectedItems = dataSource.filter(x => selectedIds.has(x.id));
  if (selectedItems.length === 0) return;

  const quizData = selectedItems.map(item => ({
    questionData: item.questionData,
    section: item.section || item.questionData?.subject || '',
    examName: item.examName,
    questionId: item.questionId,
    docId: item.id
  }));

  sessionStorage.setItem('wrongReviewQuestions', JSON.stringify(quizData));
  window.location.href = `exam/quiz.html?mode=wrong-review&count=${quizData.length}`;
}

// ── 상세 모달 ──
function openDetailModal(item) {
  currentModalItem = item;
  const data = item.questionData || {};

  const modalDisplayNum = activeView === 'bookmark' ? getBookmarkDisplayNumber(item) : getDisplayNumber(item);
  const sectionName = item.section || item.questionData?.subject || '기타';
  modalTitle.textContent = `${sectionName} - ${item.examName || '문제'} ${modalDisplayNum}번`;

  let questionHtml = '';
  if (data.questionImage) {
    questionHtml += `<img src="${data.questionImage}" alt="문제 이미지" style="max-width:100%; border-radius:8px; margin-bottom:8px;">`;
  }
  if (data.question) {
    questionHtml += `<p>${escapeHtml(data.question)}</p>`;
  }
  modalQuestion.innerHTML = questionHtml || '<p>(이미지 문제)</p>';

  // 선택지 — correctAnswer, userAnswer 모두 0-based
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

  modalExplanation.innerHTML = `<strong>해설</strong><br>${data.explanation || '해설이 없습니다.'}`;

  // 모달 버튼 텍스트 변경
  if (modalResolveBtn) {
    modalResolveBtn.textContent = activeView === 'bookmark' ? '북마크 해제' : '이해 완료 (목록에서 제거)';
  }

  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  currentModalItem = null;
}

async function handleModalResolve() {
  if (!currentModalItem) return;

  const isBookmarkView = activeView === 'bookmark';
  const confirmMsg = isBookmarkView
    ? '이 문제의 북마크를 해제하시겠습니까?'
    : '이 문제를 이해 완료 처리하시겠습니까?\n목록에서 제거됩니다.';
  if (!confirm(confirmMsg)) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  try {
    const itemId = currentModalItem.id;
    if (isBookmarkView) {
      await removeBookmark(user.uid, currentModalItem.questionId);
      currentBookmarks = currentBookmarks.filter(x => x.id !== itemId);
      allBookmarks = allBookmarks.filter(x => x.id !== itemId);
      updateCertTabs();
      updateBookmarkFilterButtons();
      renderBookmarkList();
    } else {
      await markAsResolved(user.uid, currentModalItem.questionId);
      currentWrongAnswers = currentWrongAnswers.filter(x => x.id !== itemId);
      allWrongAnswers = allWrongAnswers.filter(x => x.id !== itemId);
      updateCertTabs();
      updateFilterButtons();
      renderList();
    }
    closeModal();
  } catch (error) {
    console.error('처리 실패:', error);
    alert('처리에 실패했습니다. 다시 시도해주세요.');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
