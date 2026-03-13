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

let allWrongAnswers = []; // 전체 오답 (모든 자격증)
let currentWrongAnswers = []; // 현재 자격증 필터링 결과
let activeCertType = localStorage.getItem('currentCertificateType') || 'health-manager';
let activeFilter = 'all';
let selectMode = false;
let selectedIds = new Set();
let currentModalItem = null;
let firebaseAuth = null;

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

  // 각 자격증의 오답 수 계산
  const healthCount = allWrongAnswers.filter(i => (i.certType || 'health-manager') === 'health-manager').length;
  const sportsCount = allWrongAnswers.filter(i => i.certType === 'sports-instructor').length;

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
      filterByCertType();
    });
  });
}

function updateFilterButtons() {
  if (!filterGroup) return;

  const sections = [...new Set(currentWrongAnswers.map(item => item.section).filter(Boolean))];

  // 전체 버튼 + 과목 버튼 새로 생성
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
  // ID에서 번호 추출: "2025_운동생리학_3" → 3, "mock_2020_과목_3" → 3
  if (typeof qData.id === 'string') {
    const parts = qData.id.split('_');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  return qData.number || 0;
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

  // 과목별 섹션 렌더링 (과목 내 문제 번호 오름차순)
  Object.entries(grouped).forEach(([section, items]) => {
    items.sort((a, b) => {
      const numA = parseInt(getDisplayNumber(a), 10) || 0;
      const numB = parseInt(getDisplayNumber(b), 10) || 0;
      return numA - numB;
    });
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
      const examName = item.examName || '';
      const count = item.incorrectCount || 1;

      // ID에서 실제 문제 번호 추출
      const displayNumber = getDisplayNumber(item);
      const seqIndex = idx + 1; // 순서 인덱스 (1부터)

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

  const tasks = [];
  selectedIds.forEach(docId => {
    const item = currentWrongAnswers.find(x => x.id === docId);
    if (item) {
      tasks.push({ docId, promise: markAsResolved(user.uid, item.questionId) });
    }
  });

  const results = await Promise.allSettled(tasks.map(t => t.promise));

  // 성공한 ID만 수집
  const resolvedIds = new Set();
  let failCount = 0;
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      resolvedIds.add(tasks[idx].docId);
    } else {
      failCount++;
      console.error('이해 완료 처리 실패:', result.reason);
    }
  });

  // 성공한 것만 로컬 제거 (allWrongAnswers도 동기화)
  if (resolvedIds.size > 0) {
    currentWrongAnswers = currentWrongAnswers.filter(x => !resolvedIds.has(x.id));
    allWrongAnswers = allWrongAnswers.filter(x => !resolvedIds.has(x.id));
  }

  if (failCount > 0) {
    alert(`${failCount}개 문제의 처리에 실패했습니다. 다시 시도해주세요.`);
  }

  selectedIds.clear();
  selectMode = false;
  updateSelectMode();
  updateCertTabs();
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

  const modalDisplayNum = getDisplayNumber(item);
  modalTitle.textContent = `${item.section || '기타'} - ${item.examName || '문제'} ${modalDisplayNum}번`;

  // 문제 내용
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

  // 해설
  modalExplanation.innerHTML = `<strong>해설</strong><br>${data.explanation || '해설이 없습니다.'}`;

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
