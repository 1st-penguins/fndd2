// schedule-ui.js — 시험 일정 페이지 UI 렌더링
import {
  fetchSchedules, calculateDDay,
  CERT_COLORS, CERT_NAMES, TYPE_LABELS, TYPE_ICONS
} from './schedule-data.js';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function formatDateRange(start, end) {
  if (!end) return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function createScheduleCard(item) {
  const target = item.endDate || item.startDate;
  const dday = calculateDDay(target);
  const color = CERT_COLORS[item.certType];
  const certName = CERT_NAMES[item.certType];
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const icon = TYPE_ICONS[item.type] || '📌';

  const pastClass = dday.isPast ? 'schedule-card--past' : '';
  let ddayClass = '';
  if (dday.isPast) ddayClass = 'schedule-card__dday--past';
  else if (dday.days <= 30) ddayClass = 'schedule-card__dday--urgent';

  const desc = item.description ? `<p class="schedule-card__desc">${item.description}</p>` : '';

  return `
    <div class="schedule-card ${pastClass}">
      <div class="schedule-card__indicator" style="background: ${color}"></div>
      <div class="schedule-card__body">
        <div class="schedule-card__header">
          <span class="schedule-card__cert" style="background: ${color}">${certName}</span>
          <span class="schedule-card__type">${icon} ${typeLabel}</span>
        </div>
        <p class="schedule-card__title">${item.title}</p>
        <p class="schedule-card__date">${formatDateRange(item.startDate, item.endDate)}</p>
        ${desc}
      </div>
      <div class="schedule-card__dday ${ddayClass}">${dday.text}</div>
    </div>
  `;
}

function groupByHalf(items) {
  const groups = {};
  for (const item of items) {
    const key = `${item.year}년 ${item.half === 1 ? '상반기' : '하반기'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

let currentFilter = null;

async function renderScheduleList() {
  const listEl = document.getElementById('schedule-list');
  const loadingEl = document.getElementById('schedule-loading');
  const emptyEl = document.getElementById('schedule-empty');

  if (!listEl) return;

  listEl.innerHTML = '';
  if (loadingEl) loadingEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    const items = await fetchSchedules(currentFilter);

    if (loadingEl) loadingEl.style.display = 'none';

    if (!items.length) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    const groups = groupByHalf(items);
    let html = '';

    for (const [label, groupItems] of Object.entries(groups)) {
      html += `<div class="schedule-divider">${label}</div>`;
      for (const item of groupItems) {
        html += createScheduleCard(item);
      }
    }

    listEl.innerHTML = html;
  } catch (err) {
    console.error('[Schedule UI]', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) {
      emptyEl.textContent = '일정을 불러올 수 없습니다.';
      emptyEl.style.display = 'block';
    }
  }
}

function initFilter() {
  const btns = document.querySelectorAll('.schedule-filter__btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('schedule-filter__btn--active'));
      btn.classList.add('schedule-filter__btn--active');
      currentFilter = btn.dataset.cert || null;
      renderScheduleList();
    });
  });
}

export function initSchedulePage() {
  // URL ?cert= 파라미터로 자격증 필터 자동 적용
  const params = new URLSearchParams(window.location.search);
  const certParam = params.get('cert');
  if (certParam) {
    currentFilter = certParam;
    const btn = document.querySelector(`.schedule-filter__btn[data-cert="${certParam}"]`);
    if (btn) {
      document.querySelectorAll('.schedule-filter__btn').forEach(b => b.classList.remove('schedule-filter__btn--active'));
      btn.classList.add('schedule-filter__btn--active');
    }
  }

  initFilter();
  renderScheduleList();
}
