import { getWrongAnswers, markAsResolved, removeWrongAnswer } from "./wrong-note-service.js";
import { auth } from "../core/firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// DOM Elements
const container = document.getElementById("wrong-list-container");
const filterGroup = document.getElementById("subject-filters");
const totalCountEl = document.getElementById("total-wrong-count");

let currentWrongAnswers = [];
let activeFilter = 'all';

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadData(user.uid);
        } else {
            // Show login required or redirect
            container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔒</span>
          <p>로그인이 필요한 서비스입니다.</p>
          <button class="btn-primary" onclick="showLoginModal()">로그인하기</button>
        </div>
      `;
        }
    });

    // Filter Click Event
    if (filterGroup) {
        filterGroup.addEventListener("click", (e) => {
            if (e.target.classList.contains("filter-btn")) {
                // UI Toggle
                document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
                e.target.classList.add("active");

                // Filter Logic
                activeFilter = e.target.dataset.subject;
                renderCards();
            }
        });
    }
});

async function loadData(userId) {
    try {
        currentWrongAnswers = await getWrongAnswers(userId);
        updateFilterButtons();
        renderCards();
    } catch (error) {
        container.innerHTML = `<p class="error-msg">오답 노트를 불러오는 중 오류가 발생했습니다.<br>${error.message}</p>`;
    }
}

function updateFilterButtons() {
    if (!currentWrongAnswers.length) return;

    // Extract unique sections
    const sections = [...new Set(currentWrongAnswers.map(item => item.section))];

    // Create buttons if not exist
    // We keep the static 'All' button and append others
    const existingButtons = Array.from(filterGroup.querySelectorAll('button')).map(b => b.dataset.subject);

    sections.forEach(section => {
        if (!section) return;
        if (!existingButtons.includes(section)) {
            const btn = document.createElement("button");
            btn.className = "filter-btn";
            btn.dataset.subject = section;
            btn.textContent = section;
            filterGroup.appendChild(btn);
        }
    });
}

function renderCards() {
    // 1. Filter
    let filtered = currentWrongAnswers;
    if (activeFilter !== 'all') {
        filtered = currentWrongAnswers.filter(item => item.section === activeFilter);
    }

    // 2. Update Count
    if (totalCountEl) totalCountEl.textContent = filtered.length;

    // 3. Clear container
    container.innerHTML = "";

    // 4. Check Empty
    if (filtered.length === 0) {
        if (currentWrongAnswers.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
              <span class="empty-icon">👏</span>
              <p>틀린 문제가 없습니다.<br>완벽해요!</p>
            </div>
        `;
        } else {
            container.innerHTML = `
            <div class="empty-state">
              <p>해당 과목의 오답이 없습니다.</p>
            </div>
        `;
        }
        return;
    }

    // 5. Render Grid
    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "wrong-card";

        // Date formatting
        const date = item.lastIncorrectAt ? new Date(item.lastIncorrectAt.seconds * 1000).toLocaleDateString() : '-';

        // Question Text (Truncated logic handled by CSS line-clamp)
        // Assuming questionData has 'question' field
        const questionText = item.questionData.question || "지문 없음";

        card.innerHTML = `
      <div class="card-header">
        <span class="subject-badge">${item.section || '기타'}</span>
        <span class="date-badge">${date}</span>
      </div>
      <div class="card-question">
        ${questionText}
      </div>
      <div class="card-action">
        <button class="retry-btn">다시 풀기 →</button>
      </div>
    `;

        // Add Click Logic
        card.addEventListener("click", () => openDetailModal(item));

        container.appendChild(card);
    });
}

// Simple Detail Modal (Can be upgraded to a real quiz mode later)
function openDetailModal(item) {
    const data = item.questionData;
    const optionsHtml = data.options.map((opt, idx) => {
        const isAnswer = (idx + 1) === Number(data.answer);
        return `
            <div class="option-row ${isAnswer ? 'answer-highlight' : ''}" style="margin: 8px 0; padding: 8px; border: 1px solid #eee; border-radius: 8px; ${isAnswer ? 'background-color: #f0fdf4; border-color: #bbf7d0;' : ''}">
                <span class="opt-idx">${idx + 1}.</span> ${opt}
                ${isAnswer ? ' <span style="color:green; font-weight:bold;">(정답)</span>' : ''}
            </div>
        `;
    }).join('');

    // Use SweetAlert or Toast or create a custom modal
    // For now, let's create a custom modal on the fly or reuse existing one logic?
    // Let's build a simpler 'Confirm' style overlay for MVP

    // Create Modal Element
    const modalId = 'wrong-detail-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
        `;
        document.body.appendChild(modal);

        // Close on BG click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #1f2937; margin-bottom: 20px;">문제 확인</h3>
            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 20px; line-height: 1.6;">${data.question}</div>
            ${data.image ? `<img src="${data.image}" style="max-width:100%; margin-bottom:20px; border-radius: 8px;">` : ''}
            
            <div style="margin-bottom: 24px;">
                ${optionsHtml}
            </div>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <strong style="display:block; margin-bottom: 8px; color: #4b5563;">📝 해설</strong>
                <p style="color: #6b7280; margin: 0; line-height: 1.5;">${data.explanation || '해설이 없습니다.'}</p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button id="modal-close-btn" style="padding: 10px 20px; border: 1px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">닫기</button>
                <button id="modal-resolve-btn" style="padding: 10px 20px; background: var(--penguin-navy); color: white; border: none; border-radius: 8px; cursor: pointer;">완벽히 이해했어요 (목록에서 제거)</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Event Bindings
    modal.querySelector('#modal-close-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.querySelector('#modal-resolve-btn').addEventListener('click', async () => {
        if (confirm('정말로 목록에서 제거할까요?')) {
            await markAsResolved(auth.currentUser.uid, item.questionId); // or removeWrongAnswer
            // Optimistic update
            currentWrongAnswers = currentWrongAnswers.filter(x => x.id !== item.id);
            renderCards();
            updateFilterButtons();
            modal.style.display = 'none';
        }
    });
}
