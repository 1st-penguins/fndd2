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

let currentWrongAnswers = [];
let activeFilter = 'all';
let selectMode = false;
let selectedIds = new Set();
let currentModalItem = null;
let firebaseAuth = null; // ensureFirebase()로 초기화

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!container) return; // DOM 요소 없으면 무시

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
    }
  });

  // 과목 필터
  if (filterGroup) {
    filterGroup.addEventListener("click", (e) => {
      if (e.target.classList.contains("wrong-note-filter-btn")) {
        filterGroup.querySelectorAll(".wrong-note-filter-btn").forEach(btn => btn.classList.remove("active"));
        e.target.classList.add("active");
        activeFilter = e.target.dataset.subject;
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

  // 다시 풀기 (선택된 문제들로 퀴즈 시작)
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
});

async function loadData(userId) {
  try {
    currentWrongAnswers = await getWrongAnswers(userId);
    updateFilterButtons();
    renderList();
  } catch (error) {
    container.innerHTML = `<p style="text-align:center; color:#ef4444; padding:40px;">오답 노트를 불러오는 중 오류가 발생했습니다.<br>${error.message}</p>`;
  }
}

function updateFilterButtons() {
  if (!currentWrongAnswers.length || !filterGroup) return;

  const sections = [...new Set(currentWrongAnswers.map(item => item.section).filter(Boolean))];
  const existingButtons = Array.from(filterGroup.querySelectorAll('button')).map(b => b.dataset.subject);

  sections.forEach(section => {
    if (!existingButtons.includes(section)) {
      const btn = document.createElement("button");
      btn.className = "wrong-note-filter-btn";
      btn.dataset.subject = section;
      btn.textContent = section;
      filterGroup.appendChild(btn);
    }
  });
}

function getFilteredItems() {
  if (activeFilter === 'all') return currentWrongAnswers;
  return currentWrongAnswers.filter(item => item.section === activeFilter);
}

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
    const sectionEl = document.createElement("div");
    sectionEl.className = "wn-subject-section";

    const headerEl = document.createElement("div");
    headerEl.className = "wn-subject-section__header";
    headerEl.innerHTML = `
      <span class="wn-subject-section__title">${section}</span>
      <span class="wn-subject-section__count">${items.length}문제</span>
    `;
    sectionEl.appendChild(headerEl);

    items.forEach((item, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = "wrong-item";
      itemEl.dataset.id = item.id;

      const date = item.lastIncorrectAt
        ? new Date(item.lastIncorrectAt.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
        : '';

      const qData = item.questionData || {};
      const questionText = qData.question || '(이미지 문제)';
      const examName = item.examName || '';
      const count = item.incorrectCount || 1;
      const qNumber = qData.id || qData.number || (idx + 1);

      itemEl.innerHTML = `
        <input type="checkbox" class="wrong-item__checkbox" data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
        <div class="wrong-item__number">${qNumber}</div>
        <div class="wrong-item__info">
          <div class="wrong-item__title">${escapeHtml(questionText)}</div>
          <div class="wrong-item__meta">
            <span>${examName}</span>
            ${date ? `<span>${date}</span>` : ''}
          </div>
        </div>
        ${count > 1 ? `<span class="wrong-item__count">${count}회 틀림</span>` : ''}
        <span class="wrong-item__arrow">&#8250;</span>
      `;

      // 체크박스 이벤트
      const checkbox = itemEl.querySelector('.wrong-item__checkbox');
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSelection(item.id, checkbox.checked);
      });

      // 아이템 클릭 → 선택 모드면 체크, 아니면 상세 모달
      itemEl.addEventListener("click", (e) => {
        if (e.target.classList.contains('wrong-item__checkbox')) return;

        if (selectMode) {
          checkbox.checked = !checkbox.checked;
          toggleSelection(item.id, checkbox.checked);
        } else {
          openDetailModal(item);
        }
      });

      sectionEl.appendChild(itemEl);
    });

    container.appendChild(sectionEl);
  });
}

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
    // 체크박스 해제
    container.querySelectorAll('.wrong-item__checkbox').forEach(cb => { cb.checked = false; });
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = selectedIds.size;
  if (selectedCountEl) selectedCountEl.textContent = `${count}개 선택됨`;
  if (quizSelectedBtn) quizSelectedBtn.disabled = count === 0;
}

// 선택된 문제들 이해 완료 처리
async function handleResolveSelected() {
  if (selectedIds.size === 0) return;

  const count = selectedIds.size;
  if (!confirm(`${count}개 문제를 이해 완료 처리하시겠습니까?\n목록에서 제거됩니다.`)) return;

  const user = firebaseAuth?.currentUser;
  if (!user) return;

  const promises = [];
  selectedIds.forEach(docId => {
    const item = currentWrongAnswers.find(x => x.id === docId);
    if (item) {
      promises.push(markAsResolved(user.uid, item.questionId));
    }
  });

  await Promise.all(promises);

  // 로컬 데이터 업데이트
  currentWrongAnswers = currentWrongAnswers.filter(x => !selectedIds.has(x.id));
  selectedIds.clear();
  selectMode = false;
  updateSelectMode();
  updateFilterButtons();
  renderList();
}

// 선택된 문제들로 퀴즈 시작
function handleStartQuiz() {
  if (selectedIds.size === 0) return;

  const selectedItems = currentWrongAnswers.filter(x => selectedIds.has(x.id));

  if (selectedItems.length === 0) return;

  // sessionStorage에 문제 데이터 저장
  const quizData = selectedItems.map(item => ({
    questionData: item.questionData,
    section: item.section,
    examName: item.examName,
    questionId: item.questionId,
    docId: item.id
  }));

  sessionStorage.setItem('wrongReviewQuestions', JSON.stringify(quizData));

  // exam/quiz.html?mode=wrong-review 로 이동
  window.location.href = `exam/quiz.html?mode=wrong-review&count=${quizData.length}`;
}

// 상세 모달
function openDetailModal(item) {
  currentModalItem = item;
  const data = item.questionData || {};

  modalTitle.textContent = `${item.section || '기타'} - ${item.examName || '문제'}`;

  // 문제 내용
  let questionHtml = '';
  if (data.questionImage) {
    questionHtml += `<img src="${data.questionImage}" alt="문제 이미지" style="max-width:100%; border-radius:8px; margin-bottom:8px;">`;
  }
  if (data.question) {
    questionHtml += `<p>${escapeHtml(data.question)}</p>`;
  }
  modalQuestion.innerHTML = questionHtml || '<p>(이미지 문제)</p>';

  // 선택지
  const correctAnswer = Number(data.correctAnswer ?? data.answer ?? -1);
  if (data.options && data.options.length > 0) {
    modalOptions.innerHTML = data.options.map((opt, idx) => {
      const isCorrect = idx === correctAnswer || (idx + 1) === correctAnswer;
      return `<div class="wrong-modal__option ${isCorrect ? 'correct' : ''}">${idx + 1}. ${escapeHtml(opt)} ${isCorrect ? ' (정답)' : ''}</div>`;
    }).join('');
  } else {
    // 선택지 텍스트가 없으면 번호만 표시
    modalOptions.innerHTML = `<div class="wrong-modal__option correct">정답: ${correctAnswer + 1}번</div>`;
  }

  // 해설
  modalExplanation.innerHTML = `<strong>해설</strong>${data.explanation || '해설이 없습니다.'}`;

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

  await markAsResolved(user.uid, currentModalItem.questionId);

  currentWrongAnswers = currentWrongAnswers.filter(x => x.id !== currentModalItem.id);
  renderList();
  closeModal();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
