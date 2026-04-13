/**
 * 태그 검색 기능
 * 문제에 태그를 추가하고 태그로 검색할 수 있는 기능
 */

import { SUBJECT_TAG_DICTIONARY, GLOBAL_ALIAS_DICTIONARY } from './data/tag-dictionary.js';

// 전역 변수
let allQuestions = []; // 모든 문제 데이터
let tagIndex = {}; // 태그별 문제 인덱스
let popularTags = []; // 인기 태그 목록
let selectedTags = new Set(); // 선택된 태그들
let isAdminMode = false; // 관리자(검토자) 모드 상태
let localSubjectDictionary = SUBJECT_TAG_DICTIONARY; // 로컬 수정용 사전

// 자격증별 과목 & 데이터 경로 설정
const CERT_CONFIG = {
  'health-manager': {
    label: '건강운동관리사',
    dataDir: 'data',
    years: ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    subjects: [
      '건강체력평가', '기능해부학', '병태생리학', '운동생리학',
      '운동처방론', '운동상해', '운동부하검사', '스포츠심리학'
    ]
  },
  'sports-instructor': {
    label: '2급 스포츠지도사',
    dataDir: 'data/sports',
    years: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    subjects: [
      '노인체육론', '스포츠교육학', '스포츠사회학', '스포츠심리학',
      '스포츠윤리', '운동생리학', '운동역학', '유아체육론',
      '특수체육론', '한국체육사'
    ]
  },
  'sports-instructor-1': {
    label: '1급 스포츠지도사',
    dataDir: 'data/sports1',
    years: ['2021', '2022', '2023', '2024', '2025'],
    subjects: [
      '건강교육론', '스포츠영양학', '운동상해',
      '장애인스포츠론', '체육측정평가론', '트레이닝론'
    ]
  }
};

// 하위 호환용
const healthManagerSubjects = CERT_CONFIG['health-manager'].subjects;

/**
 * 초기화
 */
async function init() {
  console.log('태그 검색 초기화 시작');

  // URL ?cert= 파라미터로 자격증 고정
  const urlParams = new URLSearchParams(window.location.search);
  const certParam = urlParams.get('cert');
  if (certParam && CERT_CONFIG[certParam]) {
    const certFilter = document.getElementById('certificate-filter');
    certFilter.value = certParam;
    // 자격증 필터 숨기기 (해당 자격증만 보여주므로 선택할 필요 없음)
    const certGroup = certFilter.closest('.filter-group');
    if (certGroup) certGroup.style.display = 'none';
    // 페이지 타이틀에 자격증명 표시
    const certLabel = CERT_CONFIG[certParam].label;
    const headerTitle = document.querySelector('.tag-search-header h1');
    if (headerTitle) headerTitle.textContent = `${certLabel} 문제 검색`;
  }

  // 필터 옵션 설정
  setupFilters();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 모든 문제 데이터 로드
  await loadAllQuestions();

  // 태그 인덱스 생성 (과목별 독립 사전 기반)
  buildTagIndex();

  // 인기 태그 표시
  displayPopularTags();

  console.log('태그 검색 초기화 완료');
}

/**
 * 필터 옵션 설정
 */
function setupFilters() {
  const yearFilter = document.getElementById('year-filter');
  const subjectFilter = document.getElementById('subject-filter');
  const certFilter = document.getElementById('certificate-filter');

  // 자격증 변경 시 년도/과목 옵션 갱신
  certFilter.addEventListener('change', () => {
    updateSubjectAndYearOptions();
    performSearch();
  });

  // 초기 옵션 설정
  updateSubjectAndYearOptions();

  // 필터 변경 이벤트
  yearFilter.addEventListener('change', performSearch);
  subjectFilter.addEventListener('change', performSearch);
}

/**
 * 자격증 선택에 따라 년도/과목 옵션 갱신
 */
function updateSubjectAndYearOptions() {
  const certFilter = document.getElementById('certificate-filter');
  const yearFilter = document.getElementById('year-filter');
  const subjectFilter = document.getElementById('subject-filter');
  const selectedCert = certFilter.value;

  // 현재 선택값 보존
  const prevYear = yearFilter.value;
  const prevSubject = subjectFilter.value;

  // 대상 자격증 목록
  const certs = selectedCert === 'all'
    ? Object.values(CERT_CONFIG)
    : [CERT_CONFIG[selectedCert]].filter(Boolean);

  // 년도 수집 (중복 제거, 정렬)
  const allYears = [...new Set(certs.flatMap(c => c.years))].sort();
  yearFilter.innerHTML = '<option value="all">전체</option>';
  allYears.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year}년`;
    yearFilter.appendChild(option);
  });
  if (allYears.includes(prevYear)) yearFilter.value = prevYear;

  // 과목 수집 (중복 제거, 정렬)
  const allSubjects = [...new Set(certs.flatMap(c => c.subjects))].sort();
  subjectFilter.innerHTML = '<option value="all">전체</option>';
  allSubjects.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    subjectFilter.appendChild(option);
  });
  if (allSubjects.includes(prevSubject)) subjectFilter.value = prevSubject;
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  const searchInput = document.getElementById('tag-search-input');
  const searchButton = document.getElementById('tag-search-button');

  // 검색 버튼 클릭
  searchButton.addEventListener('click', () => {
    handleSearchInput(searchInput.value);
  });

  // 엔터 키 입력
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearchInput(searchInput.value);
      document.getElementById('tag-autocomplete').innerHTML = '';
    }
  });

  // 자동완성
  searchInput.addEventListener('input', handleAutocomplete);

  // 외부 클릭 시 자동완성 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tag-search-input') && !e.target.closest('.autocomplete-dropdown')) {
      document.getElementById('tag-autocomplete').innerHTML = '';
    }
  });

  // 관리자 모드 토글 이벤트
  const adminToggle = document.getElementById('admin-mode-toggle');
  if (adminToggle) {
    adminToggle.addEventListener('change', (e) => {
      isAdminMode = e.target.checked;
      performSearch(); // 결과 재랜더링 (수정 버튼 표시용)
    });
  }

  // 인라인 편집 저장 버튼
  const saveBtn = document.getElementById('save-inline-tag');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveInlineTag);
  }
}

/**
 * 검색 입력 처리 (동의어 처리 + 태그 추가)
 */
function handleSearchInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  // 1. 동의어 체크 (GLOBAL_ALIAS_DICTIONARY 활용)
  const upperInput = trimmed.toUpperCase();
  const matchedAlias = Object.keys(GLOBAL_ALIAS_DICTIONARY).find(key => key.toUpperCase() === upperInput);

  if (matchedAlias) {
    const mappedTag = GLOBAL_ALIAS_DICTIONARY[matchedAlias];
    addTag(mappedTag);
    document.getElementById('tag-search-input').value = '';
  } else if (tagIndex[trimmed]) {
    // 정확히 일치하는 태그가 있으면 태그로 추가
    addTag(trimmed);
    document.getElementById('tag-search-input').value = '';
  }
  // 태그에 없는 입력은 텍스트 검색으로 처리 (입력값 유지)

  performSearch();
}

/**
 * 모든 문제 데이터 로드 (전 자격증)
 */
async function loadAllQuestions() {
  const loadingPromises = [];

  for (const [certType, config] of Object.entries(CERT_CONFIG)) {
    for (const year of config.years) {
      for (const subject of config.subjects) {
        const dataPath = `${config.dataDir}/${year}_${subject}.json`;
        loadingPromises.push(
          fetch(dataPath)
            .then(response => {
              if (response.ok) {
                return response.json().then(data => {
                  return data.map((q, index) => ({
                    ...q,
                    year,
                    subject,
                    certType,
                    number: index + 1,
                    questionId: `${certType}_${year}_${subject}_${index + 1}`
                  }));
                });
              }
              return [];
            })
            .catch(error => {
              console.warn(`데이터 로드 실패: ${dataPath}`, error);
              return [];
            })
        );
      }
    }
  }

  const results = await Promise.all(loadingPromises);
  allQuestions = results.flat();

  console.log(`총 ${allQuestions.length}개 문제 로드 완료 (${Object.keys(CERT_CONFIG).length}개 자격증)`);
}

/**
 * 태그 인덱스 생성 (과목별 독립적 로직)
 */
function buildTagIndex() {
  tagIndex = {};

  allQuestions.forEach((question, index) => {
    // question.tags 필드 직접 사용
    const processedTags = (question.tags && Array.isArray(question.tags)) ? [...question.tags] : [];

    const content = (question.explanation || '') + ' ' + (question.subject || '');

    // 과목별 사전 키워드 매칭으로 보충
    const subjectDict = SUBJECT_TAG_DICTIONARY[question.subject] || {};

    Object.entries(subjectDict).forEach(([mainTag, keywords]) => {
      let matched = false;
      if (content.includes(mainTag)) matched = true;

      if (!matched) {
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        processedTags.push(mainTag);
      }
    });

    const uniqueTags = [...new Set(processedTags)];
    question._generatedTags = uniqueTags;

    uniqueTags.forEach(tag => {
      if (!tagIndex[tag]) tagIndex[tag] = [];
      tagIndex[tag].push(index);
    });
  });

  // 인기 태그 계산
  popularTags = Object.entries(tagIndex)
    .filter(([tag, indices]) => indices.length >= 2)
    .map(([tag, indices]) => ({ tag, count: indices.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  console.log(`과목별 독립 태그 인덱스 생성 완료: ${Object.keys(tagIndex).length}개 태그`);
}


/**
 * explanation에서 태그 추출 (기존 로직 유지 + 보완)
 */
function extractTagsFromExplanation(explanation) {
  const tags = [];
  if (!explanation) return tags;

  // HTML 태그 제거
  const text = explanation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // 1. 괄호 안의 내용 추출 (핵심 개념일 가능성 높음)
  const parenthesisPattern = /\(([가-힣A-Z0-9\s]+)\)/g;
  let match;
  while ((match = parenthesisPattern.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.length >= 2 && content.length <= 10) {
      tags.push(content);
    }
  }

  // 2. ~이론, ~법칙, ~효과 등 주요 용어 추출
  const theoryPattern = /([가-힣]+(이론|법칙|효과|증후군|검사|모형|가설))/g;
  while ((match = theoryPattern.exec(text)) !== null) {
    tags.push(match[1]);
  }

  return tags;
}

/**
 * 인기 태그 표시
 */
function displayPopularTags() {
  const container = document.getElementById('popular-tags');

  if (popularTags.length === 0) {
    container.innerHTML = '<div class="loading-tags">태그를 추출하는 중...</div>';
    return;
  }

  // 사전 정의된 태그인지 확인하여 스타일 구분 가능 (선택사항)

  container.innerHTML = popularTags.map(({ tag, count }) => `
    <span class="popular-tag" data-tag="${tag}">
      ${tag}
      <span class="popular-tag-count">(${count})</span>
    </span>
  `).join('');

  // 클릭 이벤트
  container.querySelectorAll('.popular-tag').forEach(el => {
    el.addEventListener('click', () => {
      addTag(el.dataset.tag);
      performSearch();
    });
  });
}

/**
 * 태그 추가
 */
function addTag(tag) {
  const trimmedTag = tag.trim();
  if (trimmedTag) {
    selectedTags.add(trimmedTag);
    updateSelectedTagsDisplay();
  }
}

/**
 * 태그 제거
 */
function removeTag(tag) {
  selectedTags.delete(tag);
  updateSelectedTagsDisplay();
  performSearch();
}

/**
 * 선택된 태그 표시 업데이트
 */
function updateSelectedTagsDisplay() {
  const container = document.getElementById('selected-tags');

  if (selectedTags.size === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = Array.from(selectedTags).map(tag => `
    <span class="selected-tag">
      ${tag}
      <button class="selected-tag-remove" onclick="removeTag('${tag}')" aria-label="태그 제거">×</button>
    </span>
  `).join('');
}

/**
 * 자동완성 처리
 */
function handleAutocomplete(e) {
  const input = e.target.value.trim();
  const autocompleteContainer = document.getElementById('tag-autocomplete');

  if (input.length < 1) {
    autocompleteContainer.innerHTML = '';
    return;
  }

  // 사전에 있는 태그 우선 + 기존 인덱스 태그
  // 태그 검색
  const matchingTags = Object.keys(tagIndex)
    .filter(tag => tag.toLowerCase().includes(input.toLowerCase()) && !selectedTags.has(tag))
    .sort((a, b) => {
      // 입력과 일치하는 순서
      const aStarts = a.toLowerCase().startsWith(input.toLowerCase());
      const bStarts = b.toLowerCase().startsWith(input.toLowerCase());
      if (aStarts !== bStarts) return bStarts - aStarts;

      // 사전에 있는 태그 우선
      const aInDict = Object.values(SUBJECT_TAG_DICTIONARY).some(d => d.hasOwnProperty(a));
      const bInDict = Object.values(SUBJECT_TAG_DICTIONARY).some(d => d.hasOwnProperty(b));
      if (aInDict !== bInDict) return bInDict - aInDict;

      return tagIndex[b].length - tagIndex[a].length; // 인기도 순
    })
    .slice(0, 10);

  if (matchingTags.length === 0) {
    autocompleteContainer.innerHTML = '';
    return;
  }

  autocompleteContainer.innerHTML = `
    <div class="autocomplete-dropdown">
      ${matchingTags.map(tag => `
        <div class="autocomplete-item" data-tag="${tag}">
          <span class="autocomplete-tag">${tag}</span>
          <span class="autocomplete-count">${tagIndex[tag].length}개 문제</span>
        </div>
      `).join('')}
    </div>
  `;

  // 클릭 이벤트
  autocompleteContainer.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('click', () => {
      addTag(el.dataset.tag);
      document.getElementById('tag-search-input').value = '';
      autocompleteContainer.innerHTML = '';
      performSearch();
    });
  });
}

/**
 * 검색 수행
 */
function performSearch() {
  const yearFilter = document.getElementById('year-filter').value;
  const subjectFilter = document.getElementById('subject-filter').value;
  const certFilter = document.getElementById('certificate-filter').value;

  let results = [];

  // 텍스트 검색어 가져오기
  const searchInput = document.getElementById('tag-search-input');
  const textQuery = searchInput ? searchInput.value.trim() : '';

  // 태그로 필터링
  if (selectedTags.size > 0) {
    const sets = Array.from(selectedTags).map(tag => {
      return new Set(tagIndex[tag] || []);
    });

    if (sets.length > 0) {
      let intersection = sets[0];
      for (let i = 1; i < sets.length; i++) {
        intersection = new Set([...intersection].filter(x => sets[i].has(x)));
      }

      results = Array.from(intersection).map(index => allQuestions[index]);
    } else {
      results = [];
    }
  } else if (textQuery.length >= 2) {
    // 태그 미선택 + 텍스트 입력 시: questionText 전문 검색
    const query = textQuery.toLowerCase();
    results = allQuestions.filter(q => {
      const text = (q.questionText || '').toLowerCase();
      const explanation = (q.explanation || '').replace(/<[^>]*>/g, ' ').toLowerCase();
      const tags = (q._generatedTags || []).join(' ').toLowerCase();
      return text.includes(query) || explanation.includes(query) || tags.includes(query);
    });
  } else {
    // 태그도 없고 텍스트도 없으면 전체 문제
    results = [...allQuestions];
  }

  // 년도 필터
  if (yearFilter !== 'all') {
    results = results.filter(q => q.year === yearFilter);
  }

  // 과목 필터
  if (subjectFilter !== 'all') {
    results = results.filter(q => q.subject === subjectFilter);
  }

  // 자격증 필터
  if (certFilter !== 'all') {
    results = results.filter(q => q.certType === certFilter);
  }

  displayResults(results);
}

/**
 * 검색 결과 표시
 */
function displayResults(results) {
  const resultsContainer = document.getElementById('search-results');
  const resultsTitle = document.getElementById('results-title');
  const resultsCount = document.getElementById('results-count');

  resultsCount.textContent = `${results.length}개 문제`;

  if (results.length === 0) {
    const hasTags = selectedTags.size > 0;
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>${hasTags ? '검색 결과가 없습니다.' : '태그를 입력하거나 인기 태그를 클릭하여 검색해보세요.'}</p>
        ${hasTags ? `
          <p style="font-size: 14px; margin-top: 8px; color: #999;">
            다른 태그를 시도해보거나 필터를 조정해보세요.<br>
            예: "심전도", "근육", "ATP" 등 포괄적인 단어로 검색해보세요.
          </p>
        ` : ''}
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = results.map((question, index) => {
    // 저장된 태그 사용
    const semanticTags = question._generatedTags || [];

    // 검색어와 일치하는 태그를 하이라이트하기 위해 맨 앞으로
    const sortedTags = [...semanticTags].sort((a, b) => {
      const aSelected = selectedTags.has(a);
      const bSelected = selectedTags.has(b);
      return bSelected - aSelected;
    });

    const displayTags = sortedTags.slice(0, 5); // 최대 5개

    const certLabel = CERT_CONFIG[question.certType]?.label || '';

    return `
      <div class="question-card" data-question-id="${question.questionId}">
        <div class="question-card-header">
          <div class="question-card-info">
            <div class="question-card-title">
              ${question.year}년 ${question.subject} ${question.number}번 문제
            </div>
            <div class="question-card-meta">
              <span>${certLabel}</span>
              <span>${question.year}년</span>
              <span>${question.subject}</span>
              <span>${question.number}번</span>
            </div>
            ${displayTags.length > 0 ? `
              <div class="question-card-tags">
                ${displayTags.map(tag => {
      const isSelected = selectedTags.has(tag);
      const removeBtn = isAdminMode ? `<button class="tag-remove-btn" onclick="event.stopPropagation(); removeQuestionTag('${question.questionId}', '${tag.replace(/'/g, "\\'")}')" title="태그 삭제">×</button>` : '';
      return `<span class="question-card-tag ${isSelected ? 'active' : ''}">${tag}${removeBtn}</span>`;
    }).join('')}
              </div>
            ` : ''}
          </div>
          <div class="question-card-actions" style="display: flex; gap: 8px;">
            <button class="question-card-action" onclick="openQuestionModal('${question.questionId}')">
              문제 보기
            </button>
            ${isAdminMode ? `
              <button class="question-card-action admin-btn" onclick="openInlineEditModal('${question.questionId}')" style="background: #334155;">
                태그 수정
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 인라인 편집 모달 열기
 */
function openInlineEditModal(questionId) {
  const q = allQuestions.find(it => it.questionId === questionId);
  if (!q) return;

  const modal = document.getElementById('inline-edit-modal');
  document.getElementById('modal-q-id').textContent = `${q.year}년 ${q.subject} ${q.number}번 태그 편집`;
  document.getElementById('modal-q-subject').textContent = `과목: ${q.subject}`;
  document.getElementById('modal-q-explanation').innerHTML = q.explanation || '해설 정보가 없습니다.';
  document.getElementById('modal-q-explanation').dataset.questionId = questionId;

  // 카테고리 셀렉트박스 채우기
  const catSelect = document.getElementById('inline-category-select');
  const subjectDict = SUBJECT_TAG_DICTIONARY[q.subject] || {};
  catSelect.innerHTML = Object.keys(subjectDict).map(cat => `
    <option value="${cat}">${cat}</option>
  `).join('');

  modal.style.display = 'flex';

  // AI 추천 버튼 추가 (동적)
  setupAISuggestionButton(q);
}

/**
 * Gemini AI 추천 버튼 설정
 */
function setupAISuggestionButton(question) {
  const modalContent = document.querySelector('#inline-edit-modal .modal-content');
  let aiBtn = document.getElementById('ai-suggest-btn');

  if (!aiBtn) {
    aiBtn = document.createElement('button');
    aiBtn.id = 'ai-suggest-btn';
    aiBtn.className = 'admin-btn-primary';
    aiBtn.style.cssText = 'margin-bottom: 1.5rem; background: #818cf8; color: white; border: none; padding: 10px; border-radius: 8px; width: 100%; font-weight: 600; cursor: pointer;';
    aiBtn.textContent = '✨ Gemini AI 추천 태그 받기';
    const explanationDiv = document.getElementById('modal-q-explanation');
    explanationDiv.parentNode.insertBefore(aiBtn, explanationDiv.nextSibling);
  }

  aiBtn.onclick = async () => {
    aiBtn.textContent = 'AI 분석 중...';
    aiBtn.disabled = true;

    try {
      // 💡 실제 Gemini 연동 시에는 여기에 API 호출 로직이 들어갑니다.
      // 여기서는 해설 텍스트를 분석하여 핵심 키워드(추천 태그)를 추출하는 시뮬레이션을 수행합니다.
      const suggestions = await fetchAISuggestions(question);

      const suggestDiv = document.createElement('div');
      suggestDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1.5rem; padding: 10px; background: rgba(129, 140, 248, 0.1); border-radius: 8px;';
      suggestDiv.innerHTML = `<p style="width: 100%; margin: 0 0 8px; font-size: 12px; color: #818cf8;">AI 추천 단어 (클릭해서 입력):</p>` +
        suggestions.map(s => `<span class="ai-tag-chip" style="cursor: pointer; background: #818cf8; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${s}</span>`).join('');

      const oldSuggest = document.getElementById('ai-suggestions-container');
      if (oldSuggest) oldSuggest.remove();
      suggestDiv.id = 'ai-suggestions-container';
      aiBtn.parentNode.insertBefore(suggestDiv, aiBtn.nextSibling);

      suggestDiv.querySelectorAll('.ai-tag-chip').forEach(chip => {
        chip.onclick = () => {
          document.getElementById('inline-tag-input').value = chip.textContent;
        };
      });

    } catch (e) {
      alert('AI 추천을 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
    } finally {
      aiBtn.textContent = '✨ Gemini AI 추천 태그 받기';
      aiBtn.disabled = false;
    }
  };
}

/**
 * Gemini API 호출 시뮬레이션 (또는 실제 연동)
 */
async function fetchAISuggestions(question) {
  // 실제 상용 환경에서는 백엔드를 통해 Gemini API에 다음 프롬프트를 보냅니다:
  // "다음 건강운동관리사 ${question.subject} 영여 문제 해설에서 전문적인 핵심 용어 5가지만 추출해줘: ${question.explanation}"

  return new Promise((resolve) => {
    setTimeout(() => {
      const text = question.explanation.replace(/<[^>]*>/g, '');
      const words = extractTagsFromExplanation(question.explanation);
      // 더 정교한 분석 (시뮬레이션)
      const mockResult = [...new Set(words)];
      if (mockResult.length < 3) mockResult.push('추가 분석 필요', '중요 개념');
      resolve(mockResult.slice(0, 5));
    }, 1000);
  });
}

/**
 * 인라인 태그 저장
 */
function saveInlineTag() {
  const questionId = document.getElementById('modal-q-explanation').dataset.questionId;
  const q = allQuestions.find(it => it.questionId === questionId);
  if (!q) return;

  const newTag = document.getElementById('inline-tag-input').value.trim();
  const category = document.getElementById('inline-category-select').value;

  if (!newTag) {
    alert('추가할 태그명을 입력해주세요.');
    return;
  }

  // 1. 사전 데이터 업데이트 (메모리)
  if (!SUBJECT_TAG_DICTIONARY[q.subject][category]) {
    SUBJECT_TAG_DICTIONARY[q.subject][category] = [];
  }

  if (!SUBJECT_TAG_DICTIONARY[q.subject][category].includes(newTag)) {
    SUBJECT_TAG_DICTIONARY[q.subject][category].push(newTag);

    // 2. 인덱스 재구성 및 결과 반영
    buildTagIndex();
    performSearch();

    // 3. 토스트 알림
    const toast = document.getElementById('admin-export-toast');
    toast.style.display = 'flex';

    document.getElementById('inline-edit-modal').style.display = 'none';
    document.getElementById('inline-tag-input').value = '';
  } else {
    alert('이미 해당 카테고리에 존재하는 태그입니다.');
  }
}

/**
 * 문제 열기 (퀴즈 페이지로 이동)
 */
function openQuestion(year, subject, questionIndex) {
  const encodedSubject = encodeURIComponent(subject);
  window.location.href = `exam-new/quiz.html?year=${year}&subject=${encodedSubject}&q=${questionIndex + 1}`;
}

/**
 * 문제 상세 모달 열기
 */
let currentModalQuestion = null;
let answerRevealed = false;

function openQuestionModal(questionId) {
  const q = allQuestions.find(it => it.questionId === questionId);
  if (!q) return;

  currentModalQuestion = q;
  answerRevealed = false;

  const modal = document.getElementById('question-detail-modal');
  const title = document.getElementById('qmodal-title');
  const questionDiv = document.getElementById('qmodal-question');
  const optionsDiv = document.getElementById('qmodal-options');
  const explanationDiv = document.getElementById('qmodal-explanation');
  const showAnswerBtn = document.getElementById('qmodal-show-answer');

  const certLabel = CERT_CONFIG[q.certType]?.label || '';
  title.textContent = `[${certLabel}] ${q.year}년 ${q.subject} ${q.number}번`;

  // 문제 이미지 표시
  if (q.questionImage) {
    questionDiv.innerHTML = `<img src="${q.questionImage}" alt="문제 이미지" style="max-width:100%; border-radius:8px;">`;
  } else {
    questionDiv.innerHTML = '<p>(문제 이미지 없음)</p>';
  }

  // 선택지 및 해설 숨김
  optionsDiv.innerHTML = '';
  explanationDiv.style.display = 'none';
  explanationDiv.innerHTML = '';
  showAnswerBtn.style.display = 'inline-block';
  showAnswerBtn.textContent = '정답 보기';

  modal.classList.add('open');
}

function revealAnswer() {
  if (!currentModalQuestion || answerRevealed) return;
  answerRevealed = true;

  const q = currentModalQuestion;
  const optionsDiv = document.getElementById('qmodal-options');
  const explanationDiv = document.getElementById('qmodal-explanation');
  const showAnswerBtn = document.getElementById('qmodal-show-answer');

  // 정답 표시
  const correctIdx = Number(q.correctAnswer ?? -1);
  optionsDiv.innerHTML = `<div class="wrong-modal__option correct">정답: ${correctIdx + 1}번</div>`;

  // 해설 표시
  const explanationHtml = (q.explanation || '해설이 없습니다.').replace(/\n/g, '<br>');
  explanationDiv.innerHTML = `<strong>해설</strong><br>${explanationHtml}`;
  explanationDiv.style.display = 'block';

  // 태그 표시
  if (q.tags && q.tags.length > 0) {
    explanationDiv.innerHTML += `
      <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;" id="qmodal-tags">
        ${q.tags.slice(0, 8).map(tag => {
          const removeBtn = isAdminMode ? `<button onclick="event.stopPropagation(); removeQuestionTag('${q.questionId}', '${tag.replace(/'/g, "\\'")}', true)" style="background:none; border:none; color:#0369a1; cursor:pointer; font-size:14px; margin-left:2px; padding:0 2px;">×</button>` : '';
          return `<span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">${tag}${removeBtn}</span>`;
        }).join('')}
      </div>
    `;
  }

  showAnswerBtn.style.display = 'none';
}

function closeQuestionModal() {
  document.getElementById('question-detail-modal').classList.remove('open');
  currentModalQuestion = null;
}

/**
 * 문제에서 태그 삭제 (관리자 전용)
 */
function removeQuestionTag(questionId, tag, isModal = false) {
  if (!isAdminMode) return;

  const q = allQuestions.find(it => it.questionId === questionId);
  if (!q) return;

  // question.tags에서 제거
  if (q.tags && Array.isArray(q.tags)) {
    q.tags = q.tags.filter(t => t !== tag);
  }

  // 인덱스 재구성 + 검색 결과 갱신
  buildTagIndex();
  performSearch();

  // 모달 내 태그도 갱신
  if (isModal && currentModalQuestion && currentModalQuestion.questionId === questionId) {
    const tagsDiv = document.getElementById('qmodal-tags');
    if (tagsDiv) {
      const remaining = q.tags || [];
      if (remaining.length === 0) {
        tagsDiv.remove();
      } else {
        tagsDiv.innerHTML = remaining.slice(0, 8).map(t => {
          const removeBtn = `<button onclick="event.stopPropagation(); removeQuestionTag('${questionId}', '${t.replace(/'/g, "\\'")}', true)" style="background:none; border:none; color:#0369a1; cursor:pointer; font-size:14px; margin-left:2px; padding:0 2px;">×</button>`;
          return `<span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:2px;">${t}${removeBtn}</span>`;
        }).join('');
      }
    }
  }
}

function escapeHtmlTag(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 모달 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('qmodal-close-btn');
  const dismissBtn = document.getElementById('qmodal-dismiss-btn');
  const showAnswerBtn = document.getElementById('qmodal-show-answer');
  const overlay = document.getElementById('question-detail-modal');

  if (closeBtn) closeBtn.addEventListener('click', closeQuestionModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeQuestionModal);
  if (showAnswerBtn) showAnswerBtn.addEventListener('click', revealAnswer);
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeQuestionModal();
  });
});

// 전역 함수로 export
window.removeTag = removeTag;
window.openQuestion = openQuestion;
window.openQuestionModal = openQuestionModal;
window.removeQuestionTag = removeQuestionTag;
window.openInlineEditModal = openInlineEditModal;
window.saveInlineTag = saveInlineTag;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);

