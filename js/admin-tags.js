import { SUBJECT_TAG_DICTIONARY, GLOBAL_ALIAS_DICTIONARY } from './data/tag-dictionary.js';

let localDictionary = JSON.parse(JSON.stringify(SUBJECT_TAG_DICTIONARY));
let currentSubject = '운동생리학';

const subjectList = document.getElementById('subject-list');
const categoryContainer = document.getElementById('category-container');
const currentSubjectTitle = document.getElementById('current-subject-title');

// 초기화
function init() {
    renderSubjectSidebar();
    switchSubject(currentSubject);
}

// 과목 사이드바 렌더링
function renderSubjectSidebar() {
    subjectList.innerHTML = Object.keys(localDictionary).map(subject => `
        <div class="subject-item ${subject === currentSubject ? 'active' : ''}" 
             onclick="window.switchSubject('${subject}')">
            ${subject}
        </div>
    `).join('');
}

// 과목 전환
window.switchSubject = function (subject) {
    currentSubject = subject;
    currentSubjectTitle.textContent = subject;
    renderSubjectSidebar();
    renderCategories();
};

// 카테고리 및 태그 렌더링
function renderCategories() {
    const categories = localDictionary[currentSubject];
    categoryContainer.innerHTML = Object.entries(categories).map(([catName, tags]) => `
        <div class="category-card">
            <div class="category-header">
                <span class="category-title">${catName}</span>
                <button class="tag-delete" onclick="window.deleteCategory('${catName}')">카테고리 삭제</button>
            </div>
            <div class="tag-grid">
                ${tags.map(tag => `
                    <div class="tag-badge">
                        <span>${tag}</span>
                        <span class="tag-delete" onclick="window.deleteTag('${catName}', '${tag}')">×</span>
                    </div>
                `).join('')}
                <button class="add-btn" onclick="window.openTagModal('${catName}')">+ 추가</button>
            </div>
        </div>
    `).join('');
}

// --- CRUD 작업 ---

window.deleteTag = function (category, tagToDelete) {
    localDictionary[currentSubject][category] = localDictionary[currentSubject][category].filter(t => t !== tagToDelete);
    renderCategories();
};

window.deleteCategory = function (category) {
    if (confirm(`'${category}' 카테고리를 정말 삭제할까요?`)) {
        delete localDictionary[currentSubject][category];
        renderCategories();
    }
};

window.openCategoryModal = function () {
    document.getElementById('category-modal').style.display = 'flex';
};

window.addCategory = function () {
    const name = document.getElementById('new-category-name').value.trim();
    if (name) {
        if (!localDictionary[currentSubject][name]) {
            localDictionary[currentSubject][name] = [];
            renderCategories();
            closeModal('category-modal');
            document.getElementById('new-category-name').value = '';
        } else {
            alert('이미 존재하는 카테고리입니다.');
        }
    }
};

let activeCategoryForTag = '';
window.openTagModal = function (category) {
    activeCategoryForTag = category;
    document.getElementById('tag-modal-label').textContent = `${category} 태그 추가`;
    document.getElementById('tag-modal').style.display = 'flex';
};

document.getElementById('tag-add-confirm-btn').onclick = function () {
    const name = document.getElementById('new-tag-name').value.trim();
    if (name) {
        if (!localDictionary[currentSubject][activeCategoryForTag].includes(name)) {
            localDictionary[currentSubject][activeCategoryForTag].push(name);
            renderCategories();
            closeModal('tag-modal');
            document.getElementById('new-tag-name').value = '';
        }
    }
};

window.closeModal = function (id) {
    document.getElementById(id).style.display = 'none';
};

// --- 코드 생성 엔진 ---

window.generateCode = function () {
    const exportPanel = document.getElementById('export-panel');
    const codeBlock = document.getElementById('generated-code');

    const formattedJson = JSON.stringify(localDictionary, null, 4);

    // JS 파일 형태의 문자열 생성
    const code = `/**
 * 과목별 독립형 전문 태그 사전 (자동 생성됨)
 */

export const SUBJECT_TAG_DICTIONARY = ${formattedJson};

// 범용 약어/동의어 매핑 (과목에 상관없이 통용되는 용어)
export const GLOBAL_ALIAS_DICTIONARY = ${JSON.stringify(GLOBAL_ALIAS_DICTIONARY, null, 4)};

// 기존 호환성용 빈 객체
export const TAG_DICTIONARY = {};
export const ALIAS_DICTIONARY = {};
export const TAG_CATEGORIES = {};
`;

    codeBlock.textContent = code;
    exportPanel.style.display = 'block';
    exportPanel.scrollIntoView({ behavior: 'smooth' });
};

window.copyToClipboard = function () {
    const code = document.getElementById('generated-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('코드가 클립보드에 복사되었습니다! tag-dictionary.js 파일에 덮어쓰기 하세요.');
    });
};

init();
