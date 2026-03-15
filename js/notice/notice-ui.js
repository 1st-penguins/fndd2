// notice-ui.js - 공지사항 UI 관련 기능

import { getNotices, getNoticeUsageStats, trackNoticeBoardVisit } from '../data/notice-repository.js';
import { formatSimpleDate } from '../utils/date-utils.js';
import { isAdmin } from '../auth/auth-utils.js';
import { auth } from '../core/firebase-core.js';

/**
 * 공지사항 목록 로드 및 표시
 * @param {string} [containerId='notice-container'] - 공지사항 컨테이너 ID
 * @param {Object} [options={}] - 옵션
 */
export async function loadNotices(containerId = 'notice-container', options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`공지사항 컨테이너(#${containerId})를 찾을 수 없습니다.`);
    return;
  }

  // 기본 옵션 설정
  const defaultOptions = {
    limit: 5,
    showBadges: true,
    showDates: true,
    showPinned: true,
    showViewCount: isAdmin(auth && auth.currentUser),
    dateFn: formatSimpleDate
  };

  // 사용자 옵션과 기본 옵션 병합
  const opts = { ...defaultOptions, ...options };

  try {
    // 로딩 표시 (notices.html의 로딩 요소 숨기기)
    const loadingEl = document.getElementById('notices-loading');
    const emptyEl = document.getElementById('notices-empty');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';

    container.innerHTML = '<div class="notice-loading">공지사항을 불러오는 중...</div>';

    // 공지사항 데이터 가져오기
    const notices = await getNotices(opts.limit);

    if (!notices || notices.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    // 로딩 요소 숨기기
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    container.style.display = 'block';

    // 고정 공지와 일반 공지 분리
    let pinnedNotices = [];
    let regularNotices = [];

    if (opts.showPinned) {
      pinnedNotices = notices.filter(notice => notice.pinned);
      regularNotices = notices.filter(notice => !notice.pinned);
    } else {
      regularNotices = notices;
    }

    // HTML 생성
    let noticesHTML = '';

    // 고정 공지 먼저 표시
    if (pinnedNotices.length > 0) {
      noticesHTML += '<div class="pinned-notices">';
      pinnedNotices.forEach(notice => {
        noticesHTML += createNoticeItem(notice, opts);
      });
      noticesHTML += '</div>';
    }

    // 일반 공지 표시
    regularNotices.forEach(notice => {
      noticesHTML += createNoticeItem(notice, opts);
    });

    // HTML 삽입
    container.innerHTML = noticesHTML;

  } catch (error) {
    console.error('공지사항 로드 오류:', error);
    const loadingEl = document.getElementById('notices-loading');
    const emptyEl = document.getElementById('notices-empty');
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = '공지사항을 불러오는 중 오류가 발생했습니다.';
    } else {
      container.innerHTML = '<div class="notice-error">공지사항을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

/**
 * 공지사항 목록 로드 및 표시 (페이지네이션 지원)
 * @param {string} [containerId='notice-container'] - 공지사항 컨테이너 ID
 * @param {Object} [options={}] - 옵션
 */
// 공지사항 데이터 캐시 (페이지 이동 시 Firestore 재요청 방지)
let _cachedNotices = null;
let _loadingPromise = null;

export async function loadNoticesWithPagination(containerId = 'notice-container', options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`공지사항 컨테이너(#${containerId})를 찾을 수 없습니다.`);
    return;
  }

  // 기본 옵션 설정
  const defaultOptions = {
    itemsPerPage: 8, // 페이지당 항목 수
    currentPage: 1,  // 현재 페이지
    showBadges: true,
    showDates: true,
    showPinned: true,
    showViewCount: isAdmin(auth && auth.currentUser),
    dateFn: formatSimpleDate,
    paginationId: 'notice-pagination' // 페이지네이션 컨테이너 ID
  };

  // 사용자 옵션과 기본 옵션 병합
  const opts = { ...defaultOptions, ...options };

  try {
    const loadingEl = document.getElementById('notices-loading');
    const emptyEl = document.getElementById('notices-empty');

    // 캐시 또는 진행 중인 요청 재사용 (중복 Firestore 요청 방지)
    let allNotices;
    if (_cachedNotices) {
      allNotices = _cachedNotices;
    } else {
      if (!_loadingPromise) {
        // 첫 요청: 로딩 표시 + Firestore 쿼리 시작
        if (loadingEl) loadingEl.style.display = 'flex';
        if (emptyEl) emptyEl.style.display = 'none';
        container.innerHTML = '<div class="notice-loading">공지사항을 불러오는 중...</div>';
        _loadingPromise = getNotices(0);
      }
      // 첫 요청이든 중복 요청이든 같은 Promise를 await
      allNotices = await _loadingPromise;
      _cachedNotices = allNotices;
      _loadingPromise = null;
    }

    if (!allNotices || allNotices.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    // 로딩 요소 숨기기
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    container.style.display = 'block';

    // 고정 공지와 일반 공지 분리
    let pinnedNotices = [];
    let regularNotices = [];

    if (opts.showPinned) {
      pinnedNotices = allNotices.filter(notice => notice.pinned);
      regularNotices = allNotices.filter(notice => !notice.pinned);
    } else {
      regularNotices = allNotices;
    }

    // 페이지네이션 적용 (고정 공지는 항상 표시, 일반 공지만 페이지네이션)
    const totalItems = regularNotices.length;
    const totalPages = Math.ceil(totalItems / opts.itemsPerPage);

    // 현재 페이지 확인 및 조정
    let currentPage = parseInt(opts.currentPage);
    if (isNaN(currentPage) || currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    // 현재 페이지에 해당하는 공지사항만 선택
    const startIndex = (currentPage - 1) * opts.itemsPerPage;
    const endIndex = startIndex + opts.itemsPerPage;
    const currentPageNotices = regularNotices.slice(startIndex, endIndex);

    // HTML 생성
    let noticesHTML = '';

    // 고정 공지 먼저 표시 (모든 페이지에 표시)
    if (pinnedNotices.length > 0) {
      noticesHTML += '<div class="pinned-notices">';
      pinnedNotices.forEach(notice => {
        noticesHTML += createNoticeItem(notice, opts);
      });
      noticesHTML += '</div>';
    }

    // 현재 페이지의 일반 공지 표시
    currentPageNotices.forEach(notice => {
      noticesHTML += createNoticeItem(notice, opts);
    });

    // HTML 삽입
    container.innerHTML = noticesHTML;

    // 관리자 통계 패널 렌더링 (non-blocking, 어드민만)
    renderAdminUsagePanel();

    // 페이지네이션 생성
    createPagination(opts.paginationId, currentPage, totalPages, containerId, opts);

  } catch (error) {
    console.error('공지사항 로드 오류:', error);
    const loadingEl = document.getElementById('notices-loading');
    const emptyEl = document.getElementById('notices-empty');
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = '공지사항을 불러오는 중 오류가 발생했습니다.';
    } else {
      container.innerHTML = '<div class="notice-error">공지사항을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }
}

/**
 * 페이지네이션 UI 생성
 * @param {string} paginationId - 페이지네이션 컨테이너 ID
 * @param {number} currentPage - 현재 페이지
 * @param {number} totalPages - 전체 페이지 수
 * @param {string} containerId - 공지사항 컨테이너 ID (페이지 변경 시 사용)
 * @param {Object} options - 옵션
 */
function createPagination(paginationId, currentPage, totalPages, containerId, options) {
  const paginationContainer = document.getElementById(paginationId);
  if (!paginationContainer) return;

  // 표시할 페이지 번호 범위 계산 (최대 5개)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  // 범위 조정
  if (endPage - startPage < 4 && totalPages > 5) {
    startPage = Math.max(1, endPage - 4);
  }

  let paginationHTML = '<div class="notice-pagination-wrap"><div class="notice-pagination">';

  // 이전 페이지 버튼
  if (currentPage > 1) {
    paginationHTML += `<a href="#" class="pagination-button prev-btn" data-page="${currentPage - 1}">이전</a>`;
  } else {
    paginationHTML += `<button class="pagination-button prev-btn" disabled>이전</button>`;
  }

  // 첫 페이지 버튼 (현재 페이지가 4 이상일 때)
  if (startPage > 1) {
    paginationHTML += `<a href="#" class="pagination-button" data-page="1">1</a>`;
    if (startPage > 2) {
      paginationHTML += `<span class="ellipsis">...</span>`;
    }
  }

  // 페이지 번호 버튼
  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      paginationHTML += `<button class="pagination-button active">${i}</button>`;
    } else {
      paginationHTML += `<a href="#" class="pagination-button" data-page="${i}">${i}</a>`;
    }
  }

  // 마지막 페이지 버튼 (endPage가 totalPages보다 2 이상 작을 때)
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="ellipsis">...</span>`;
    }
    paginationHTML += `<a href="#" class="pagination-button" data-page="${totalPages}">${totalPages}</a>`;
  }

  // 다음 페이지 버튼
  if (currentPage < totalPages) {
    paginationHTML += `<a href="#" class="pagination-button next-btn" data-page="${currentPage + 1}">다음</a>`;
  } else {
    paginationHTML += `<button class="pagination-button next-btn" disabled>다음</button>`;
  }

  paginationHTML += '</div><div class="notice-pagination-actions"></div></div>';

  // 페이지네이션 HTML 삽입
  paginationContainer.innerHTML = paginationHTML;

  // 관리자 전용 작성하기 버튼 추가 (비동기로 관리자 확인)
  checkAndAddWriteButton(paginationContainer);

  // 페이지 버튼 이벤트 리스너 등록
  paginationContainer.querySelectorAll('.pagination-button[data-page]').forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const newPage = parseInt(this.getAttribute('data-page'));

      // 옵션 복사 및 페이지 번호 업데이트
      const newOptions = { ...options, currentPage: newPage };

      // 공지사항 다시 로드
      loadNoticesWithPagination(containerId, newOptions);

      // 스크롤: 공지사항 목록 상단으로만 이동 (맨 위 X)
      const container = document.getElementById(containerId);
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * 관리자 권한 확인 후 작성하기 버튼 추가
 * @param {HTMLElement} paginationContainer - 페이지네이션 컨테이너
 */
async function checkAndAddWriteButton(paginationContainer) {
  try {
    // 현재 사용자 확인
    const currentUser = auth.currentUser;

    // 이미 작성하기 버튼이 있으면 제거
    const existingBtn = paginationContainer.querySelector('.write-notice-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // 관리자 확인
    if (currentUser && isAdmin(currentUser)) {
      const actionContainer = paginationContainer.querySelector('.notice-pagination-actions');
      if (!actionContainer) return;

      const writeBtn = document.createElement('a');
      writeBtn.href = 'admin/notices.html';
      writeBtn.className = 'write-notice-btn';
      writeBtn.innerHTML = '<span>✏️</span> 작성하기';

      // 페이지네이션 액션 영역에 배치 (스크롤 따라다님 방지)
      actionContainer.appendChild(writeBtn);
    }
  } catch (error) {
    console.error('관리자 권한 확인 오류:', error);
  }
}

/**
 * 페이지네이션 스타일 추가 (폐기됨 - css/pages/notice.css 사용)
 */
function addPaginationStyles() {
  // CSS 파일에서 스타일을 관리하므로 JS 주입 코드는 제거함
  return;
}

/**
 * 단일 공지사항 HTML 생성 - 수정된 버전
 * @param {Object} notice - 공지사항 객체
 * @param {Object} options - 표시 옵션
 * @returns {string} 공지사항 HTML
 */
function createNoticeItem(notice, options) {
  // 기본 클래스
  let itemClass = 'notice-item';

  // 고정된 공지사항인 경우 pinned 클래스 추가
  if (notice.pinned) {
    itemClass += ' pinned';
  }

  // 날짜 포맷팅
  const formattedDate = options.dateFn ?
    options.dateFn(notice.timestamp || notice.createdAt) :
    (notice.date || '날짜 없음');

  // 30일 이내의 공지인지 확인
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const noticeDate = notice.timestamp || notice.createdAt;
  const isNew = noticeDate && noticeDate > oneMonthAgo;

  // 상대 경로 처리
  const detailPath = window.location.pathname.includes('notices.html')
    ? 'notices/detail.html'
    : '../notices/detail.html';
  const newDot = isNew ? '<span class="notice-new-dot"></span>' : '';
  const pinEmoji = notice.pinned ? '<span class="notice-pin">📌</span>' : '';

  // 배지 HTML — [카테고리] 대괄호 스타일
  let badgeTag = '';
  if (options.showBadges && notice.badge) {
    badgeTag = `<span class="notice-badge">[${notice.badge}]</span> `;
  }

  return `
    <div class="${itemClass}">
      <a href="${detailPath}?id=${notice.id}" class="notice-link">
        <div class="notice-content">
          <h3 class="notice-title">${badgeTag}${notice.title}${pinEmoji}${newDot}</h3>
        </div>
        <span class="notice-date">${formattedDate}</span>
      </a>
    </div>
  `;
}

/**
 * 관리자 전용 공지/방문 통계 카드 렌더링
 */
async function renderAdminUsagePanel() {
  const header = document.querySelector('.notices-header');
  if (!header) return;

  const existingPanel = document.getElementById('admin-usage-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  if (!isAdmin(auth.currentUser)) {
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'admin-usage-panel';
  panel.className = 'admin-usage-panel';
  panel.innerHTML = `
    <div class="admin-usage-item">
      <div class="admin-usage-label">공지 누적 조회수</div>
      <div class="admin-usage-value">집계 중...</div>
    </div>
    <div class="admin-usage-item">
      <div class="admin-usage-label">오늘 방문자</div>
      <div class="admin-usage-value">집계 중...</div>
    </div>
    <div class="admin-usage-item">
      <div class="admin-usage-label">최근 30일 방문자</div>
      <div class="admin-usage-value">집계 중...</div>
    </div>
  `;
  header.appendChild(panel);

  const stats = await getNoticeUsageStats(30);
  if (!stats) {
    panel.innerHTML = `<div class="admin-usage-empty">통계를 불러오지 못했습니다.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="admin-usage-item">
      <div class="admin-usage-label">공지 누적 조회수</div>
      <div class="admin-usage-value">${stats.totalNoticeViews}</div>
    </div>
    <div class="admin-usage-item">
      <div class="admin-usage-label">오늘 방문자</div>
      <div class="admin-usage-value">${stats.activeUsersToday}</div>
    </div>
    <div class="admin-usage-item">
      <div class="admin-usage-label">최근 30일 방문자</div>
      <div class="admin-usage-value">${stats.activeUsersLast30Days}</div>
    </div>
  `;
}

/**
 * 배지 타입에 따른 CSS 클래스 반환
 * @param {string} badge - 배지 텍스트
 * @returns {string} CSS 클래스
 */
function getBadgeClass(badge) {
  switch (badge) {
    case '신규':
      return 'new';
    case '중요':
      return 'important';
    case '긴급':
      return 'urgent';
    case '강의예정':
      return 'lecture-upcoming';
    case '강의종료':
      return 'lecture-ended';
    case '마감됨':
    case '종료됨':
      return 'closed';
    case '행사':
      return 'event';
    case '안내':
      return 'notice';
    case '업데이트':
      return 'update';
    case 'FAQ':
      return 'faq';
    case '가이드':
      return 'guide';
    default:
      // 기본값으로 배지 텍스트를 소문자로 변환하고 공백을 하이픈으로 대체
      return badge.toLowerCase().replace(/\s+/g, '-');
  }
}


/**
 * 모든 공지사항 더보기 버튼 추가 (페이지네이션으로 대체됨)
 * @param {string} containerId - 컨테이너 ID
 * @param {string} noticesPage - 공지사항 전체 페이지 경로
 */
export function addViewAllNoticesButton(containerId = 'notice-container', noticesPage = '../notices.html') {
  // 페이지네이션 기능으로 대체되어 비활성화됨
  return;
}

/**
 * 공지사항 상세 페이지 데이터 동기화
 * @param {string} noticeId - 공지사항 ID
 */
export async function syncNoticeDetail(noticeId) {
  try {
    // 페이지에 필요한 요소가 있는지 확인
    const titleElement = document.querySelector('.notice-title');
    const dateElement = document.querySelector('.notice-date');
    const badgeContainer = document.querySelector('.notice-meta');
    const contentElement = document.querySelector('.notice-content');

    if (!titleElement || !dateElement || !contentElement) {
      console.error('공지사항 상세 페이지 요소를 찾을 수 없습니다.');
      return;
    }

    // 공지사항 데이터 가져오기
    const notice = await window.getNoticeById(noticeId);

    if (!notice) {
      console.error('공지사항을 찾을 수 없습니다:', noticeId);
      return;
    }

    // 제목 업데이트
    titleElement.textContent = notice.title;

    // 날짜 업데이트
    const formattedDate = formatRelativeDate(notice.timestamp || notice.createdAt);
    dateElement.textContent = formattedDate;

    // 배지 업데이트
    if (badgeContainer && notice.badge) {
      // 기존 배지 제거 (NEW 배지 제외)
      const existingBadges = badgeContainer.querySelectorAll('.notice-badge:not(.new)');
      existingBadges.forEach(badge => {
        if (!badge.classList.contains('new')) {
          badge.remove();
        }
      });

      // 새 배지 추가
      const newBadge = document.createElement('span');
      newBadge.className = `notice-badge ${getBadgeClass(notice.badge)}`;
      newBadge.textContent = notice.badge;

      // NEW 배지가 있는 경우, 그 앞에 삽입
      const newBadgeElement = badgeContainer.querySelector('.notice-badge.new');
      if (newBadgeElement) {
        badgeContainer.insertBefore(newBadge, newBadgeElement);
      } else {
        badgeContainer.insertBefore(newBadge, dateElement);
      }
    }

    // 내용 업데이트
    if (notice.content) {
      contentElement.innerHTML = notice.content;
    }

    // 문서 제목 업데이트
    document.title = `${notice.title} - 퍼스트펭귄 건강운동관리사`;

  } catch (error) {
    console.error('공지사항 상세 페이지 동기화 오류:', error);
  }
}

/**
 * 모든 공지사항 페이지에 통합된 연락처 정보 박스 자동 삽입
 */
export function addContactBox() {
  // 공지사항 내용 영역 찾기
  const contentArea = document.querySelector('.notice-content');

  // 내용 영역이 있는 경우만 처리
  if (contentArea) {
    // 이미 있는 연락처 박스 확인
    const existingContactBox = contentArea.querySelector('.contact-box');
    const existingSlogan = contentArea.querySelector('.brand-slogan');

    // 기존 요소 제거 (중복 방지)
    if (existingContactBox) existingContactBox.remove();
    if (existingSlogan) existingSlogan.remove();

    // 통합된 연락처 박스 요소 생성
    const contactBox = document.createElement('div');
    contactBox.className = 'contact-box';
    contactBox.innerHTML = `
      <div class="contact-box-logo">
        <img src="../images/firstpenguin-logo2.png" alt="퍼스트펭귄 로고">
      </div>
      <div class="slogan-text">Fear Not, Deep Dive</div>
      <div class="slogan-subtitle">우리와 함께라면, 더 깊은 바다도 두렵지 않을 거예요.</div>
      <div class="contact-methods">
        <div class="contact-method">
          <img src="../images/Instagram_logo.svg" alt="인스타그램" class="social-logo">
          <span>인스타그램: <a href="https://www.instagram.com/1st_penguins" target="_blank">@1st_penguins</a></span>
        </div>
        <div class="contact-method">
          <img src="../images/KakaoTalk_logo.svg" alt="카카오톡" class="social-logo">
          <span>카카오톡: <a href="https://open.kakao.com/o/gYRh5kch" target="_blank">건강운동관리사 준비방</a></span>
        </div>
      </div>
    `;

    // 무조건 콘텐츠 영역의 맨 마지막에 추가
    contentArea.appendChild(contactBox);

    console.log('연락처 정보 박스가 자동으로 추가되었습니다.');
  }
}

// 공지사항 재로드 함수 (전역으로 노출)
window.reloadNotices = function () {
  // notice-list 컨테이너가 있으면 공지사항 재로드
  const noticeListContainer = document.getElementById('notice-list');
  if (noticeListContainer) {
    loadNoticesWithPagination('notice-list', {
      itemsPerPage: 8,
      showBadges: true,
      showDates: true,
      paginationId: 'notice-pagination'
    });
  }

  // notice-container가 있으면 공지사항 재로드
  const noticeContainer = document.getElementById('notice-container');
  if (noticeContainer) {
    loadNotices('notice-container', {
      limit: 5,
      showBadges: true,
      showDates: true
    });
  }
};

// 페이지 로드 시 공지사항 로드 (자동 실행)
document.addEventListener('DOMContentLoaded', function () {
  if (window.Logger && window.Logger.isDev()) {
    console.log('페이지 로드 완료, 공지사항 로드 준비...');
  }

  // 공지사항 컨테이너가 있을 경우 (notice-list로 수정)
  // app.js에서 이미 초기화한 경우 중복 실행 방지
  const noticeContainer = document.getElementById('notice-list');
  if (noticeContainer && !noticeContainer.dataset.initBy) {
    // 공지 게시판 방문 기록 (하루 1회/방문자 기준)
    trackNoticeBoardVisit();

    // 공지사항 로드 (지연 없이 즉시)
    loadNoticesWithPagination('notice-list', {
      itemsPerPage: 8,
      showBadges: true,
      showDates: true,
      paginationId: 'notice-pagination'
    }).then(() => {
      const paginationContainer = document.getElementById('notice-pagination');
      if (paginationContainer) {
        checkAndAddWriteButton(paginationContainer);
      }
    });
  }

  // 인증 상태 변경 시 관리자 버튼만 업데이트 (공지 전체 리로드 제거)
  if (auth) {
    import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js').then(({ onAuthStateChanged }) => {
      onAuthStateChanged(auth, () => {
        const paginationContainer = document.getElementById('notice-pagination');
        if (paginationContainer) {
          checkAndAddWriteButton(paginationContainer);
        }
      });
    });
  }

  // 공지사항 상세 페이지 여부 확인 및 동기화 (나머지 코드는 동일)
  const noticeContent = document.querySelector('.notice-content');
  if (noticeContent) {
    // URL에서 공지사항 ID 추출
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    const noticeId = filename.replace('.html', '');

    if (noticeId) {
      syncNoticeDetail(noticeId);
      // 연락처 정보 박스 추가
      setTimeout(addContactBox, 1000);
    }
  }
});

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.loadNotices = loadNotices;
  window.loadNoticesWithPagination = loadNoticesWithPagination;
  window.addViewAllNoticesButton = addViewAllNoticesButton;
  window.syncNoticeDetail = syncNoticeDetail;
  window.addContactBox = addContactBox;
}

export default {
  loadNotices,
  loadNoticesWithPagination,
  addViewAllNoticesButton,
  syncNoticeDetail,
  addContactBox
};