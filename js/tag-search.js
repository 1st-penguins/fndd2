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

// 과목 목록 (건강운동관리사)
const healthManagerSubjects = [
  '건강체력평가', '기능해부학', '병태생리학', '운동생리학',
  '운동처방론', '운동상해', '운동부하검사', '스포츠심리학'
];

// 년도 목록
const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];

/**
 * 초기화
 */
async function init() {
  console.log('태그 검색 초기화 시작');

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

  // 년도 옵션 추가
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year}년`;
    yearFilter.appendChild(option);
  });

  // 과목 옵션 추가
  healthManagerSubjects.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    subjectFilter.appendChild(option);
  });

  // 필터 변경 이벤트
  yearFilter.addEventListener('change', performSearch);
  subjectFilter.addEventListener('change', performSearch);
  document.getElementById('certificate-filter').addEventListener('change', performSearch);
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
    searchInput.value = '';
  });

  // 엔터 키 입력
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearchInput(searchInput.value);
      searchInput.value = '';
      document.getElementById('tag-autocomplete').innerHTML = ''; // 자동완성 닫기
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
  } else {
    // 매핑 없으면 입력값 그대로 태그로 추가
    addTag(trimmed);
  }

  performSearch();
}

/**
 * 모든 문제 데이터 로드
 */
async function loadAllQuestions() {
  const loadingPromises = [];

  for (const year of years) {
    for (const subject of healthManagerSubjects) {
      const dataPath = `data/${year}_${subject}.json`;
      loadingPromises.push(
        fetch(dataPath)
          .then(response => {
            if (response.ok) {
              return response.json().then(data => {
                // 각 문제에 메타데이터 추가
                return data.map((q, index) => ({
                  ...q,
                  year,
                  subject,
                  number: index + 1,
                  questionId: `${year}_${subject}_${index + 1}`
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

  const results = await Promise.all(loadingPromises);
  allQuestions = results.flat();

  console.log(`총 ${allQuestions.length}개 문제 로드 완료`);
}

/**
 * 태그 인덱스 생성 (과목별 독립적 로직)
 */
function buildTagIndex() {
  tagIndex = {};

  allQuestions.forEach((question, index) => {
    const processedTags = extractTagsFromExplanation(question.explanation || '');
    const content = (question.explanation || '') + ' ' + (question.subject || '');

    // 💡 과목별 사전 로드 (교차 차단 핵심)
    const subjectDict = SUBJECT_TAG_DICTIONARY[question.subject] || {};

    // 해당 과목의 사전 키워드만 본문에서 매칭
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

    // 기존 수동 태그 병합
    if (question.tags && Array.isArray(question.tags)) {
      processedTags.push(...question.tags);
    }

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
      const aInDict = TAG_DICTIONARY.hasOwnProperty(a);
      const bInDict = TAG_DICTIONARY.hasOwnProperty(b);
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

  // 태그로 필터링
  if (selectedTags.size > 0) {
    // 선택된 태그들에 해당하는 문제들의 교집합 찾기
    const sets = Array.from(selectedTags).map(tag => {
      // 태그 인덱스에 있으면 가져오고, 없으면 빈 배열
      return new Set(tagIndex[tag] || []);
    });

    // 교집합 계산 (모든 태그를 포함해야 함)
    // 첫 번째 세트를 기준으로 나머지 세트들과 교집합 수행
    if (sets.length > 0) {
      let intersection = sets[0];
      for (let i = 1; i < sets.length; i++) {
        intersection = new Set([...intersection].filter(x => sets[i].has(x)));
      }

      results = Array.from(intersection).map(index => allQuestions[index]);
    } else {
      results = [];
    }
  } else {
    // 태그가 없으면 전체 문제 (필터 적용 전)
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
    if (certFilter === 'health-manager') {
      results = results.filter(q => healthManagerSubjects.includes(q.subject));
    }
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

    return `
      <div class="question-card" data-question-id="${question.questionId}">
        <div class="question-card-header">
          <div class="question-card-info">
            <div class="question-card-title">
              ${question.year}년 ${question.subject} ${question.number}번 문제
            </div>
            <div class="question-card-meta">
              <span>년도: ${question.year}</span>
              <span>과목: ${question.subject}</span>
              <span>문제번호: ${question.number}</span>
            </div>
            ${displayTags.length > 0 ? `
              <div class="question-card-tags">
                ${displayTags.map(tag => {
      const isSelected = selectedTags.has(tag);
      return `<span class="question-card-tag ${isSelected ? 'active' : ''}">${tag}</span>`;
    }).join('')}
              </div>
            ` : ''}
          </div>
          <div class="question-card-actions" style="display: flex; gap: 8px;">
            <button class="question-card-action" onclick="openQuestion('${question.year}', '${question.subject}', ${question.number - 1})">
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
 * 문제 열기
 */
function openQuestion(year, subject, questionIndex) {
  const encodedSubject = encodeURIComponent(subject);
  window.location.href = `exam/quiz.html?year=${year}&subject=${encodedSubject}&q=${questionIndex + 1}`;
}

// 전역 함수로 export
window.removeTag = removeTag;
window.openQuestion = openQuestion;
window.openInlineEditModal = openInlineEditModal;
window.saveInlineTag = saveInlineTag;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);

