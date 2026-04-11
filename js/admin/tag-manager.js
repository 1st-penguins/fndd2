/**
 * 태그 관리자 페이지
 * 관리자가 문제별로 태그를 추가/수정/삭제할 수 있는 기능
 */

// 전역 변수
let allQuestions = [];
let currentQuestions = [];
let modifiedQuestions = new Map(); // 수정된 문제들 추적

// 과목 목록
const subjects = [
  '건강체력평가', '기능해부학', '병태생리학', '운동생리학',
  '운동처방론', '운동상해', '운동부하검사', '스포츠심리학'
];

// 년도 목록
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];

/**
 * 초기화
 */
async function init() {
  console.log('태그 관리자 초기화 시작');
  
  // 필터 옵션 설정
  setupFilters();
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 모든 문제 데이터 로드
  await loadAllQuestions();
  
  // 문제 목록 표시
  displayQuestions();
  
  console.log('태그 관리자 초기화 완료');
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
  subjects.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    subjectFilter.appendChild(option);
  });
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  document.getElementById('year-filter').addEventListener('change', filterQuestions);
  document.getElementById('subject-filter').addEventListener('change', filterQuestions);
  document.getElementById('question-number-filter').addEventListener('input', filterQuestions);
  document.getElementById('search-filter').addEventListener('input', filterQuestions);
}

/**
 * 모든 문제 데이터 로드
 */
async function loadAllQuestions() {
  const loadingPromises = [];
  
  for (const year of years) {
    for (const subject of subjects) {
      const dataPath = `../data/${year}_${subject}.json`;
      loadingPromises.push(
        fetch(dataPath)
          .then(response => {
            if (response.ok) {
              return response.json().then(data => {
                return data.map((q, index) => ({
                  ...q,
                  year,
                  subject,
                  number: index + 1,
                  questionId: `${year}_${subject}_${index + 1}`,
                  // tags 필드가 없으면 빈 배열로 초기화
                  tags: q.tags || []
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
  currentQuestions = [...allQuestions];
  
  console.log(`총 ${allQuestions.length}개 문제 로드 완료`);
}

/**
 * 문제 필터링
 */
function filterQuestions() {
  const yearFilter = document.getElementById('year-filter').value;
  const subjectFilter = document.getElementById('subject-filter').value;
  const questionNumberFilter = document.getElementById('question-number-filter').value;
  const searchFilter = document.getElementById('search-filter').value.toLowerCase();
  
  currentQuestions = allQuestions.filter(q => {
    // 년도 필터
    if (yearFilter !== 'all' && q.year !== yearFilter) return false;
    
    // 과목 필터
    if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false;
    
    // 문제 번호 필터
    if (questionNumberFilter && q.number !== parseInt(questionNumberFilter)) return false;
    
    // 검색 필터 (태그 또는 explanation에서 검색)
    if (searchFilter) {
      const tags = (q.tags || []).join(' ').toLowerCase();
      const explanation = (q.explanation || '').toLowerCase();
      if (!tags.includes(searchFilter) && !explanation.includes(searchFilter)) {
        return false;
      }
    }
    
    return true;
  });
  
  displayQuestions();
}

/**
 * 문제 목록 표시
 */
function displayQuestions() {
  const container = document.getElementById('question-list');
  
  if (currentQuestions.length === 0) {
    container.innerHTML = '<div class="loading">검색 결과가 없습니다.</div>';
    return;
  }
  
  // 최대 50개만 표시 (성능 고려)
  const displayQuestions = currentQuestions.slice(0, 50);
  
  container.innerHTML = displayQuestions.map((question, index) => {
    const tags = question.tags || [];
    const imagePath = question.questionImage 
      ? `../${question.questionImage}` 
      : '../images/image-placeholder.png';
    
    return `
      <div class="question-card" data-question-id="${question.questionId}">
        <div class="question-header">
          <div class="question-info">
            <div class="question-title">
              ${question.year}년 ${question.subject} ${question.number}번 문제
            </div>
            <div class="question-meta">
              <span>ID: ${question.id || question.number}</span>
              <span>년도: ${question.year}</span>
              <span>과목: ${question.subject}</span>
            </div>
          </div>
          <img src="${imagePath}" alt="문제 이미지" class="question-image-preview" 
               onerror="this.src='../images/image-placeholder.png'">
        </div>
        
        <div class="tags-section">
          <div class="tags-label">태그:</div>
          <div class="current-tags" id="tags-${question.questionId}">
            ${tags.map(tag => `
              <span class="tag-item">
                ${tag}
                <button class="tag-remove" onclick="removeTag('${question.questionId}', '${tag}')">×</button>
              </span>
            `).join('')}
            ${tags.length === 0 ? '<span style="color: #999; font-size: 13px;">태그가 없습니다</span>' : ''}
          </div>
          
          <div class="tag-input-section">
            <input 
              type="text" 
              class="tag-input" 
              id="tag-input-${question.questionId}"
              placeholder="태그 입력 후 엔터 또는 추가 버튼 클릭"
              onkeypress="if(event.key==='Enter') addTag('${question.questionId}')"
            >
            <button class="tag-add-button" onclick="addTag('${question.questionId}')">추가</button>
            <button class="auto-extract-button" onclick="autoExtractTags('${question.questionId}')">
              설명에서 추출
            </button>
            <button class="auto-extract-button" onclick="extractTagsFromImage('${question.questionId}')" 
                    style="background: #9c27b0; color: white;">
              이미지 OCR
            </button>
          </div>
          
          <button class="save-button" onclick="saveQuestionTags('${question.questionId}')">
            💾 저장
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // 더 많은 결과가 있는 경우 표시
  if (currentQuestions.length > 50) {
    container.innerHTML += `
      <div style="text-align: center; padding: 20px; color: #666;">
        ${currentQuestions.length}개 중 50개만 표시됩니다. 필터를 사용하여 범위를 좁혀주세요.
      </div>
    `;
  }
}

/**
 * 태그 추가
 */
window.addTag = function(questionId) {
  const input = document.getElementById(`tag-input-${questionId}`);
  const tag = input.value.trim();
  
  if (!tag) return;
  
  // 현재 문제 찾기
  const question = allQuestions.find(q => q.questionId === questionId);
  if (!question) return;
  
  // 태그 배열 초기화
  if (!question.tags) {
    question.tags = [];
  }
  
  // 중복 체크
  if (question.tags.includes(tag)) {
    alert('이미 존재하는 태그입니다.');
    input.value = '';
    return;
  }
  
  // 태그 추가
  question.tags.push(tag);
  
  // 수정된 문제로 표시
  modifiedQuestions.set(questionId, question);
  
  // UI 업데이트
  updateTagsDisplay(questionId, question.tags);
  
  input.value = '';
};

/**
 * 태그 제거
 */
window.removeTag = function(questionId, tag) {
  const question = allQuestions.find(q => q.questionId === questionId);
  if (!question) return;
  
  if (!question.tags) {
    question.tags = [];
  }
  
  question.tags = question.tags.filter(t => t !== tag);
  
  // 수정된 문제로 표시
  modifiedQuestions.set(questionId, question);
  
  // UI 업데이트
  updateTagsDisplay(questionId, question.tags);
};

/**
 * 태그 표시 업데이트
 */
function updateTagsDisplay(questionId, tags) {
  const container = document.getElementById(`tags-${questionId}`);
  if (!container) return;
  
  container.innerHTML = tags.map(tag => `
    <span class="tag-item">
      ${tag}
      <button class="tag-remove" onclick="removeTag('${questionId}', '${tag}')">×</button>
    </span>
  `).join('');
  
  if (tags.length === 0) {
    container.innerHTML = '<span style="color: #999; font-size: 13px;">태그가 없습니다</span>';
  }
}

/**
 * 자동 태그 추출 (explanation에서)
 */
window.autoExtractTags = function(questionId) {
  const question = allQuestions.find(q => q.questionId === questionId);
  if (!question) return;
  
  if (!question.explanation) {
    alert('설명이 없어 태그를 추출할 수 없습니다.');
    return;
  }
  
  // 태그 추출 로직 (tag-search.js와 동일)
  const tags = extractTagsFromExplanation(question.explanation);
  
  if (tags.length === 0) {
    alert('추출할 수 있는 태그가 없습니다.');
    return;
  }
  
  // 기존 태그와 병합 (중복 제거)
  if (!question.tags) {
    question.tags = [];
  }
  
  tags.forEach(tag => {
    if (!question.tags.includes(tag)) {
      question.tags.push(tag);
    }
  });
  
  // 수정된 문제로 표시
  modifiedQuestions.set(questionId, question);
  
  // UI 업데이트
  updateTagsDisplay(questionId, question.tags);
  
  addLog(`태그 자동 추출 완료: ${tags.length}개 태그 추가`, 'success');
};

/**
 * explanation에서 태그 추출
 */
function extractTagsFromExplanation(explanation) {
  const tags = [];
  
  if (!explanation) return tags;
  
  // HTML 태그 제거
  const text = explanation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  // 주요 패턴 추출
  const patterns = [
    /([가-힣]+이론|([가-힣]+)검사지|([가-힣]+)모형|([가-힣]+)원리|([가-힣]+)가설)/g,
    /([가-힣]{2,6})\s*(탈진|목표|훈련|응집력|의존성|상담|모형|이론|원리|가설)/g,
    /\(([가-힣A-Z]+)\)/g,
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.replace(/[()]/g, '').trim();
        if (cleaned.length >= 2 && cleaned.length <= 10) {
          tags.push(cleaned);
        }
      });
    }
  });
  
  return [...new Set(tags)]; // 중복 제거
}

/**
 * 문제 태그 저장
 */
window.saveQuestionTags = async function(questionId) {
  const question = allQuestions.find(q => q.questionId === questionId);
  if (!question) return;
  
  try {
    // JSON 파일 업데이트를 위한 데이터 준비
    const year = question.year;
    const subject = question.subject;
    const dataPath = `../data/${year}_${subject}.json`;
    
    // 해당 년도/과목의 모든 문제 가져오기
    const response = await fetch(dataPath);
    if (!response.ok) {
      throw new Error('데이터 파일을 불러올 수 없습니다.');
    }
    
    const allData = await response.json();
    
    // 현재 문제 찾아서 태그 업데이트
    const questionIndex = question.number - 1;
    if (allData[questionIndex]) {
      allData[questionIndex].tags = question.tags || [];
      
      // 파일 저장은 서버 측에서 처리해야 함
      // 여기서는 로컬 스토리지에 저장하고 다운로드 링크 제공
      const jsonStr = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${year}_${subject}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      addLog(`✅ ${question.year}년 ${question.subject} ${question.number}번 문제 태그 저장 완료`, 'success');
      
      // 수정된 문제 목록에서 제거
      modifiedQuestions.delete(questionId);
    }
  } catch (error) {
    console.error('태그 저장 오류:', error);
    addLog(`❌ 저장 실패: ${error.message}`, 'error');
    alert('태그 저장 중 오류가 발생했습니다: ' + error.message);
  }
};

/**
 * 이미지에서 OCR로 태그 추출
 */
window.extractTagsFromImage = async function(questionId) {
  const question = allQuestions.find(q => q.questionId === questionId);
  if (!question || !question.questionImage) {
    alert('문제 이미지가 없습니다.');
    return;
  }
  
  const imagePath = `../${question.questionImage}`;
  
  try {
    addLog(`🔄 이미지 OCR 시작: ${question.questionImage}`, 'info');
    
    // Tesseract.js를 사용한 OCR
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'kor+eng', // 한국어 + 영어
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            addLog(`진행률: ${Math.round(m.progress * 100)}%`, 'info');
          }
        }
      }
    );
    
    addLog(`✅ OCR 완료: ${text.length}자 추출`, 'success');
    
    // 추출된 텍스트에서 태그 추출
    const tags = extractTagsFromText(text);
    
    if (tags.length === 0) {
      alert('이미지에서 태그를 추출할 수 없습니다.\n추출된 텍스트를 확인해주세요.');
      console.log('OCR 추출 텍스트:', text);
      return;
    }
    
    // 기존 태그와 병합
    if (!question.tags) {
      question.tags = [];
    }
    
    let addedCount = 0;
    tags.forEach(tag => {
      if (!question.tags.includes(tag)) {
        question.tags.push(tag);
        addedCount++;
      }
    });
    
    // 수정된 문제로 표시
    modifiedQuestions.set(questionId, question);
    
    // UI 업데이트
    updateTagsDisplay(questionId, question.tags);
    
    addLog(`✅ ${addedCount}개 태그 추가됨`, 'success');
    
  } catch (error) {
    console.error('OCR 오류:', error);
    addLog(`❌ OCR 실패: ${error.message}`, 'error');
    alert('이미지 인식 중 오류가 발생했습니다: ' + error.message);
  }
};

/**
 * 텍스트에서 태그 추출 (OCR 결과용)
 */
function extractTagsFromText(text) {
  const tags = [];
  
  if (!text) return tags;
  
  // 주요 패턴 추출
  const patterns = [
    // 이론명, 검사지, 모형 등
    /([가-힣]+이론|([가-힣]+)검사지|([가-힣]+)모형|([가-힣]+)원리|([가-힣]+)가설)/g,
    // 주요 개념
    /([가-힣]{2,6})\s*(탈진|목표|훈련|응집력|의존성|상담|모형|이론|원리|가설|검사|측정|평가)/g,
    // 괄호 안의 내용
    /\(([가-힣A-Z]+)\)/g,
    // 영문 약어 (MBI, VO2max 등)
    /[A-Z]{2,10}/g,
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.replace(/[()]/g, '').trim();
        if (cleaned.length >= 2 && cleaned.length <= 15) {
          // 너무 일반적인 단어 제외
          const excludeWords = ['문제', '정답', '번', '년', '과목', '설명', '예시'];
          if (!excludeWords.includes(cleaned)) {
            tags.push(cleaned);
          }
        }
      });
    }
  });
  
  return [...new Set(tags)]; // 중복 제거
}

/**
 * 로그 추가
 */
function addLog(message, type = 'info') {
  const logArea = document.getElementById('log-area');
  const logContent = document.getElementById('log-content');
  
  logArea.style.display = 'block';
  
  const logItem = document.createElement('div');
  logItem.className = `log-item log-${type}`;
  logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  logContent.appendChild(logItem);
  logContent.scrollTop = logContent.scrollHeight;
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);

