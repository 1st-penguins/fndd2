/**
 * 1:1 문의 — 플로팅 버튼 + 슬라이드 패널
 * apple-header.js에서 동적으로 로드됨
 */

const CATEGORIES = [
  { value: 'payment', label: '결제/환불' },
  { value: 'lecture', label: '강의 문의' },
  { value: 'question-error', label: '문제 오류' },
  { value: 'suggestion', label: '건의사항' },
  { value: 'etc', label: '기타' }
];

const STATUS_MAP = {
  pending: { label: '대기중', class: 'inquiry-item__status--pending' },
  answered: { label: '답변완료', class: 'inquiry-item__status--answered' },
  closed: { label: '종료', class: 'inquiry-item__status--closed' }
};

let panelOpen = false;
let currentTab = 'form'; // 'form' | 'list'
let currentDetail = null; // viewing detail
let isLoggedIn = false;
let inquiryRepo = null;

// CSS 주입
function injectCSS() {
  if (document.querySelector('link[href*="inquiry.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const path = window.location.pathname;
  const isSubDir = path.includes('/exam') || path.includes('/admin/') ||
    path.includes('/notices/') || path.includes('/subjects') || path.includes('/years');
  link.href = (isSubDir ? '../' : '') + 'css/inquiry.css';
  document.head.appendChild(link);
}

// 퀴즈/시험 페이지 감지
function isExamPage() {
  const path = window.location.pathname;
  return /\/(exam-new|exam-new-sports|exam-new-sports1)\/(?!index)/.test(path);
}

// 날짜 포맷
function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

// 토스트
function showToast(message, type = 'success') {
  let toast = document.querySelector('.inquiry-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'inquiry-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `inquiry-toast inquiry-toast--${type} inquiry-toast--show`;
  setTimeout(() => toast.classList.remove('inquiry-toast--show'), 2500);
}

// 리포지토리 로드
async function getRepo() {
  if (inquiryRepo) return inquiryRepo;
  inquiryRepo = await import('/js/data/inquiry-repository.js');
  return inquiryRepo;
}

// ===== DOM 생성 =====

function createFAB() {
  if (isExamPage()) return null;

  const fab = document.createElement('div');
  fab.className = 'inquiry-fab';
  fab.style.cssText = 'position:fixed;z-index:1001;';
  fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  fab.title = '1:1 문의';
  fab.addEventListener('click', togglePanel);
  document.body.appendChild(fab);
  return fab;
}

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'inquiry-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1002;';
  overlay.addEventListener('click', closePanel);
  document.body.appendChild(overlay);
  return overlay;
}

function createPanel() {
  const panel = document.createElement('div');
  panel.className = 'inquiry-panel';
  panel.style.cssText = 'position:fixed;z-index:1003;transform:translateY(100%);transition:none;';
  panel.innerHTML = `
    <div class="inquiry-panel__header">
      <span class="inquiry-panel__title">1:1 문의</span>
      <button class="inquiry-panel__close">&times;</button>
    </div>
    <div class="inquiry-tabs">
      <button class="inquiry-tab inquiry-tab--active" data-tab="form">문의하기</button>
      <button class="inquiry-tab" data-tab="list">내 문의내역</button>
    </div>
    <div class="inquiry-panel__body" id="inquiry-body"></div>
  `;

  panel.querySelector('.inquiry-panel__close').addEventListener('click', closePanel);
  panel.querySelectorAll('.inquiry-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.body.appendChild(panel);
  return panel;
}

// ===== 패널 제어 =====

let fabEl, overlayEl, panelEl;

function togglePanel() {
  if (panelOpen) closePanel();
  else openPanel();
}

function openPanel() {
  panelOpen = true;
  // 인라인 초기 스타일 제거하여 CSS 클래스가 동작하도록
  panelEl.style.transform = '';
  panelEl.style.transition = '';
  overlayEl.classList.add('inquiry-overlay--open');
  // 리플로우 강제 후 클래스 추가 (트랜지션 작동을 위해)
  void panelEl.offsetHeight;
  panelEl.classList.add('inquiry-panel--open');
  currentDetail = null;
  renderBody();
}

function closePanel() {
  panelOpen = false;
  overlayEl.classList.remove('inquiry-overlay--open');
  panelEl.classList.remove('inquiry-panel--open');
}

function switchTab(tab) {
  currentTab = tab;
  currentDetail = null;
  panelEl.querySelectorAll('.inquiry-tab').forEach(t => {
    t.classList.toggle('inquiry-tab--active', t.dataset.tab === tab);
  });
  renderBody();
}

// ===== 렌더링 =====

function renderBody() {
  const body = document.getElementById('inquiry-body');
  if (!body) return;

  if (!isLoggedIn) {
    const path = window.location.pathname;
    const isSubDir = path.includes('/exam') || path.includes('/admin/') ||
      path.includes('/notices/') || path.includes('/subjects') || path.includes('/years');
    const prefix = isSubDir ? '../' : '';
    body.innerHTML = `
      <div class="inquiry-login-msg">
        <p>로그인 후 문의할 수 있습니다.</p>
        <a href="${prefix}login.html" class="inquiry-login-msg__btn">로그인하기</a>
      </div>
    `;
    return;
  }

  if (currentDetail) {
    renderDetail(body);
  } else if (currentTab === 'form') {
    renderForm(body);
  } else {
    renderList(body);
  }
}

function renderForm(body) {
  const options = CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
  body.innerHTML = `
    <form class="inquiry-form" id="inquiry-form">
      <div>
        <label class="inquiry-form__label">카테고리</label>
        <select class="inquiry-form__select" name="category" required>${options}</select>
      </div>
      <div>
        <label class="inquiry-form__label">제목</label>
        <input class="inquiry-form__input" name="title" placeholder="문의 제목을 입력하세요" required maxlength="100">
      </div>
      <div>
        <label class="inquiry-form__label">내용</label>
        <textarea class="inquiry-form__textarea" name="content" placeholder="문의 내용을 상세히 작성해주세요" required maxlength="2000"></textarea>
      </div>
      <button type="submit" class="inquiry-form__submit">문의 등록</button>
    </form>
  `;

  body.querySelector('#inquiry-form').addEventListener('submit', handleSubmit);
}

async function renderList(body) {
  body.innerHTML = '<div class="inquiry-list__empty">불러오는 중...</div>';

  try {
    const repo = await getRepo();
    const inquiries = await repo.getMyInquiries(20);

    if (!inquiries.length) {
      body.innerHTML = '<div class="inquiry-list__empty">문의 내역이 없습니다.</div>';
      return;
    }

    body.innerHTML = `<div class="inquiry-list">
      ${inquiries.map(inq => {
        const status = STATUS_MAP[inq.status] || STATUS_MAP.pending;
        const cat = CATEGORIES.find(c => c.value === inq.category);
        return `
          <div class="inquiry-item" data-id="${inq.id}">
            <div class="inquiry-item__top">
              <span class="inquiry-item__category">${cat ? cat.label : inq.category}</span>
              <span class="inquiry-item__status ${status.class}">${status.label}</span>
            </div>
            <div class="inquiry-item__title">${escapeHtml(inq.title)}</div>
            <div class="inquiry-item__date">${formatDate(inq.createdAt)}</div>
          </div>
        `;
      }).join('')}
    </div>`;

    body.querySelectorAll('.inquiry-item').forEach(item => {
      item.addEventListener('click', () => {
        const inq = inquiries.find(i => i.id === item.dataset.id);
        if (inq) { currentDetail = inq; renderBody(); }
      });
    });
  } catch (err) {
    console.error('문의 목록 로드 오류:', err);
    body.innerHTML = '<div class="inquiry-list__empty">불러오기 실패</div>';
  }
}

function renderDetail(body) {
  const inq = currentDetail;
  const status = STATUS_MAP[inq.status] || STATUS_MAP.pending;
  const cat = CATEGORIES.find(c => c.value === inq.category);

  let replyHtml = '';
  if (inq.adminReply) {
    replyHtml = `
      <div class="inquiry-detail__reply">
        <div class="inquiry-detail__reply-label">관리자 답변</div>
        <div class="inquiry-detail__reply-text">${escapeHtml(inq.adminReply)}</div>
        <div class="inquiry-detail__reply-date">${formatDate(inq.adminReplyAt)}</div>
      </div>
    `;
  } else {
    replyHtml = '<div class="inquiry-detail__no-reply">아직 답변이 등록되지 않았습니다.</div>';
  }

  body.innerHTML = `
    <div class="inquiry-detail">
      <button class="inquiry-detail__back">&larr; 목록으로</button>
      <div class="inquiry-detail__meta">
        <span class="inquiry-item__category">${cat ? cat.label : inq.category}</span>
        <span class="inquiry-item__status ${status.class}">${status.label}</span>
        <span class="inquiry-item__date">${formatDate(inq.createdAt)}</span>
      </div>
      <div class="inquiry-detail__title">${escapeHtml(inq.title)}</div>
      <div class="inquiry-detail__content">${escapeHtml(inq.content)}</div>
      ${replyHtml}
    </div>
  `;

  body.querySelector('.inquiry-detail__back').addEventListener('click', () => {
    currentDetail = null;
    renderBody();
  });
}

// ===== 이벤트 핸들러 =====

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.inquiry-form__submit');
  btn.disabled = true;
  btn.textContent = '등록 중...';

  try {
    const repo = await getRepo();
    await repo.createInquiry({
      category: form.category.value,
      title: form.title.value.trim(),
      content: form.content.value.trim()
    });

    showToast('문의가 등록되었습니다.');
    form.reset();
    switchTab('list');
  } catch (err) {
    console.error('문의 등록 오류:', err, err?.message, err?.code);
    showToast('문의 등록 실패: ' + (err?.message || err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '문의 등록';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== 초기화 =====

function init() {
  injectCSS();

  fabEl = createFAB();
  if (!fabEl) return; // 시험 페이지면 생성 안 함

  overlayEl = createOverlay();
  panelEl = createPanel();

  // 로그인 상태 감지
  window.addEventListener('loginStateChanged', (e) => {
    isLoggedIn = e.detail?.isLoggedIn || false;
    if (panelOpen) renderBody();
  });

  // 폴링 fallback
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (typeof window.isUserLoggedIn === 'function') {
      isLoggedIn = window.isUserLoggedIn();
      clearInterval(interval);
    }
    if (attempts > 20) clearInterval(interval);
  }, 500);

  if (typeof window.isUserLoggedIn === 'function') {
    isLoggedIn = window.isUserLoggedIn();
  }
}

// 외부에서 주문번호 기반 문의 열기
window.openInquiryWithOrder = function(productName, orderId) {
  if (!panelEl) return;

  // 패널 열기 + 폼 탭으로 전환
  currentTab = 'form';
  openPanel();

  // 폼 렌더링 후 값 자동 채우기
  setTimeout(() => {
    const form = document.getElementById('inquiry-form');
    if (!form) return;

    const categorySelect = form.querySelector('[name="category"]');
    const titleInput = form.querySelector('[name="title"]');
    const contentTextarea = form.querySelector('[name="content"]');

    if (categorySelect) categorySelect.value = 'payment';
    if (titleInput) titleInput.value = `[결제문의] ${productName}`;
    if (contentTextarea) {
      contentTextarea.value = `주문번호: ${orderId}\n상품명: ${productName}\n\n문의 내용을 입력해주세요.`;
      contentTextarea.focus();
      contentTextarea.setSelectionRange(contentTextarea.value.length, contentTextarea.value.length);
    }

    // 탭 UI 동기화
    panelEl.querySelectorAll('.inquiry-tab').forEach(t => {
      t.classList.toggle('inquiry-tab--active', t.dataset.tab === 'form');
    });
  }, 200);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
