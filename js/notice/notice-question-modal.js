/**
 * 공지사항 내 문제 확인 모달
 * 공지 본문에 data-question="dataDir/year_subject/number" 링크가 있으면
 * 클릭 시 해당 문제를 모달로 표시
 *
 * 사용법 (공지 본문 HTML):
 * <a href="#" class="notice-question-link" data-dir="data" data-year="2025" data-subject="운동처방론" data-num="16">
 *   2025 운동처방론 16번
 * </a>
 */

const CERT_DATA_DIRS = {
  'data': '건강운동관리사',
  'data/sports': '생활스포츠지도사',
  'data/sports1': '1급 스포츠지도사'
};

// 캐시
const dataCache = {};

let currentQuestion = null;
let answerRevealed = false;

async function fetchQuestion(dataDir, year, subject, num) {
  const key = `${dataDir}/${year}_${subject}`;
  if (!dataCache[key]) {
    const path = `../${dataDir}/${year}_${subject}.json`;
    const res = await fetch(path);
    if (!res.ok) throw new Error(`데이터 로드 실패: ${path}`);
    dataCache[key] = await res.json();
  }
  return dataCache[key][num - 1] || null;
}

function openModal(question, certLabel, year, subject, num) {
  currentQuestion = question;
  answerRevealed = false;

  const modal = document.getElementById('question-detail-modal');
  const title = document.getElementById('qmodal-title');
  const questionDiv = document.getElementById('qmodal-question');
  const optionsDiv = document.getElementById('qmodal-options');
  const explanationDiv = document.getElementById('qmodal-explanation');
  const showAnswerBtn = document.getElementById('qmodal-show-answer');

  title.textContent = `[${certLabel}] ${year}년 ${subject} ${num}번`;

  let questionInnerHtml = '';
  if (question.commonImage) {
    const commonSrc = question.commonImage.startsWith('/')
      ? question.commonImage
      : `../${question.commonImage}`;
    questionInnerHtml += `<img src="${commonSrc}" alt="공통 이미지" style="max-width:100%; border-radius:8px; margin-bottom:8px;">`;
  }
  if (question.questionImage) {
    const imgSrc = question.questionImage.startsWith('/')
      ? question.questionImage
      : `../${question.questionImage}`;
    questionInnerHtml += `<img src="${imgSrc}" alt="문제 이미지" style="max-width:100%; border-radius:8px;">`;
  }
  questionDiv.innerHTML = questionInnerHtml || '<p>(문제 이미지 없음)</p>';

  optionsDiv.innerHTML = '';
  explanationDiv.style.display = 'none';
  explanationDiv.innerHTML = '';
  showAnswerBtn.style.display = 'inline-block';
  showAnswerBtn.textContent = '정답 보기';

  modal.classList.add('open');
}

function revealAnswer() {
  if (!currentQuestion || answerRevealed) return;
  answerRevealed = true;

  const q = currentQuestion;
  const optionsDiv = document.getElementById('qmodal-options');
  const explanationDiv = document.getElementById('qmodal-explanation');
  const showAnswerBtn = document.getElementById('qmodal-show-answer');

  const correctIdx = Number(q.correctAnswer ?? -1);
  optionsDiv.innerHTML = `<div class="wrong-modal__option correct">정답: ${correctIdx + 1}번</div>`;

  const explanationHtml = (q.explanation || '해설이 없습니다.').replace(/\n/g, '<br>');
  explanationDiv.innerHTML = `<strong>해설</strong><br>${explanationHtml}`;
  explanationDiv.style.display = 'block';

  if (q.tags && q.tags.length > 0) {
    explanationDiv.innerHTML += `
      <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;">
        ${q.tags.slice(0, 8).map(tag =>
          `<span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;">${tag}</span>`
        ).join('')}
      </div>
    `;
  }

  showAnswerBtn.style.display = 'none';
}

function closeModal() {
  document.getElementById('question-detail-modal').classList.remove('open');
  currentQuestion = null;
}

// 이벤트 위임: 공지 본문 내 .notice-question-link 클릭 처리
document.addEventListener('click', async (e) => {
  const link = e.target.closest('.notice-question-link');
  if (!link) return;

  e.preventDefault();

  const dataDir = link.dataset.dir || 'data';
  const year = link.dataset.year;
  const subject = link.dataset.subject;
  const num = parseInt(link.dataset.num, 10);

  if (!year || !subject || !num) return;

  const certLabel = CERT_DATA_DIRS[dataDir] || '';

  try {
    link.style.opacity = '0.5';
    const question = await fetchQuestion(dataDir, year, subject, num);
    link.style.opacity = '1';

    if (!question) {
      alert('문제 데이터를 찾을 수 없습니다.');
      return;
    }

    openModal(question, certLabel, year, subject, num);
  } catch (err) {
    link.style.opacity = '1';
    console.error(err);
    alert('문제 데이터를 불러오지 못했습니다.');
  }
});

// 모달 이벤트
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('qmodal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('qmodal-dismiss-btn')?.addEventListener('click', closeModal);
  document.getElementById('qmodal-show-answer')?.addEventListener('click', revealAnswer);
  document.getElementById('question-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
});
