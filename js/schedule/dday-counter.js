// dday-counter.js — 정적 JSON 기반 즉시 렌더링 D-Day 카운터
const CERT_NAMES = {
  'health-manager': '건강운동관리사',
  'sports-instructor': '2급 스포츠지도사',
  'sports-instructor-1': '1급 스포츠지도사'
};

function calculateDDay(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff > 0) return { text: `D-${diff}`, days: diff, isToday: false };
  if (diff === 0) return { text: 'D-Day', days: 0, isToday: true };
  return { text: `D+${Math.abs(diff)}`, days: diff, isToday: false };
}

function formatDate(dateStr) {
  return dateStr.replace(/-/g, '.');
}

function createCardHTML(item, isClosest) {
  const dday = calculateDDay(item.startDate);
  const certName = CERT_NAMES[item.certType];

  let countClass = '';
  if (dday.isToday) countClass = 'select__dday-count--today';
  else if (dday.days <= 30 && dday.days > 0) countClass = 'select__dday-count--urgent';

  const highlightClass = isClosest ? 'select__dday-card--highlight' : '';

  return `
    <a href="schedule.html?cert=${item.certType}" class="select__dday-card ${highlightClass}">
      <div>
        <span class="select__dday-cert">${certName}</span>
        <p class="select__dday-title">${item.title}</p>
      </div>
      <p class="select__dday-count ${countClass}">${dday.text}</p>
      <p class="select__dday-date">${formatDate(item.startDate)}</p>
    </a>
  `;
}

export async function renderDDayCounter(containerId = 'dday-section') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cardsContainer = container.querySelector('.select__dday-cards');
  if (!cardsContainer) return;

  try {
    const res = await fetch('/data/dday-upcoming.json');
    const items = await res.json();

    if (!items.length) {
      cardsContainer.innerHTML = '<p class="select__dday-loading">등록된 시험 일정이 없습니다.</p>';
      return;
    }

    let closestIdx = 0;
    let closestDays = Infinity;
    items.forEach((item, i) => {
      const { days } = calculateDDay(item.startDate);
      if (days >= 0 && days < closestDays) {
        closestDays = days;
        closestIdx = i;
      }
    });

    cardsContainer.innerHTML = items.map((item, i) => createCardHTML(item, i === closestIdx)).join('');
  } catch (err) {
    console.error('[D-Day Counter]', err);
    cardsContainer.innerHTML = '<p class="select__dday-loading">일정을 불러올 수 없습니다.</p>';
  }
}
