// js/data/review-ui.js - 상품 후기 UI
import {
  getReviews, getReviewStats, hasUserReviewed,
  addReview, deleteReview, uploadReviewImage
} from './review-repository.js';
import { ensureFirebase } from '../core/firebase-core.js';
import { isAdmin } from '../auth/auth-utils.js';

let _selectedRating = 0;
let _pendingImages = []; // { file, previewUrl }

/**
 * 리뷰 섹션 초기화
 */
export async function initReviews(productId, isPurchased) {
  const container = document.getElementById('review-section');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:40px 0;color:#86868b;">후기를 불러오는 중...</div>';

  try {
    const reviews = await getReviews(productId);
    const stats = getReviewStats(reviews);
    const { auth } = await ensureFirebase();
    const user = auth.currentUser;
    const alreadyReviewed = user ? hasUserReviewed(reviews, user.uid) : false;

    container.innerHTML = `
      ${renderStats(stats)}
      ${renderForm(isPurchased, alreadyReviewed, user)}
      ${renderReviewList(reviews, user)}
    `;

    setupStarRating(container);
    setupForm(container, productId);
    setupImageUpload(container);
    setupDeleteButtons(container, productId, isPurchased);
    setupImageModal();
  } catch (error) {
    console.error('리뷰 로드 오류:', error);
    container.innerHTML = '<div style="text-align:center;padding:40px 0;color:#86868b;">후기를 불러오지 못했습니다.</div>';
  }
}

function renderStats(stats) {
  const stars = renderStars(stats.average);
  return `
    <div class="review-stats">
      <div class="review-stats__rating">${stats.average || '-'}</div>
      <div class="review-stats__stars">${stars}</div>
      <div class="review-stats__count">${stats.count}개의 후기</div>
    </div>
  `;
}

function renderStars(rating, size = 18) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      html += `<span style="color:#FFB800;font-size:${size}px;">★</span>`;
    } else if (i - 0.5 <= rating) {
      html += `<span style="color:#FFB800;font-size:${size}px;">★</span>`;
    } else {
      html += `<span style="color:#d2d2d7;font-size:${size}px;">★</span>`;
    }
  }
  return html;
}

function renderForm(isPurchased, alreadyReviewed, user) {
  if (!user) {
    return '<div class="review-form-notice">로그인 후 구매하시면 후기를 작성하실 수 있습니다.</div>';
  }
  if (!isPurchased) {
    return '<div class="review-form-notice">이 상품을 구매하신 분만 후기를 작성할 수 있습니다.</div>';
  }
  if (alreadyReviewed) {
    return '<div class="review-form-notice">이미 후기를 작성하셨습니다.</div>';
  }

  return `
    <div class="review-form">
      <h4 class="review-form__title">후기 작성</h4>
      <div class="review-form__stars" id="review-star-select">
        <span class="review-star" data-value="1">★</span>
        <span class="review-star" data-value="2">★</span>
        <span class="review-star" data-value="3">★</span>
        <span class="review-star" data-value="4">★</span>
        <span class="review-star" data-value="5">★</span>
        <span class="review-form__rating-text" id="rating-text">별점을 선택해주세요</span>
      </div>
      <div class="review-form__textarea-wrap">
        <textarea class="review-form__textarea" id="review-content" maxlength="200" placeholder="강의에 대한 솔직한 후기를 남겨주세요 (최소 10자)"></textarea>
        <span class="review-form__counter"><span id="char-count">0</span>/200</span>
      </div>
      <div class="review-form__images" id="image-preview-area"></div>
      <div class="review-form__actions">
        <label class="review-form__image-btn" id="image-upload-label">
          <input type="file" accept="image/*" multiple id="review-image-input" style="display:none;" />
          사진 첨부
        </label>
        <button class="review-form__submit" id="review-submit-btn">등록</button>
      </div>
      <div class="review-form__error" id="review-error" style="display:none;"></div>
    </div>
  `;
}

function renderReviewList(reviews, currentUser) {
  if (!reviews.length) {
    return '<div class="review-empty">아직 후기가 없습니다. 첫 번째 후기를 작성해보세요!</div>';
  }

  const items = reviews.map(r => {
    const stars = renderStars(r.rating, 14);
    const date = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt instanceof Date ? r.createdAt : new Date());
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

    const canDelete = currentUser && (currentUser.uid === r.userId || isAdmin(currentUser));
    const deleteBtn = canDelete
      ? `<button class="review-delete-btn" data-review-id="${r.id}" data-user-id="${r.userId}">삭제</button>`
      : '';

    const imagesHtml = r.images && r.images.length
      ? `<div class="review-card__images">${r.images.map(url =>
          `<img src="${url}" class="review-card__thumb" data-full="${url}" alt="후기 사진" />`
        ).join('')}</div>`
      : '';

    return `
      <div class="review-card">
        <div class="review-card__header">
          <div class="review-card__info">
            <span class="review-card__stars">${stars}</span>
            <span class="review-card__author">${r.author}</span>
            <span class="review-card__date">${dateStr}</span>
          </div>
          ${deleteBtn}
        </div>
        <p class="review-card__content">${escapeHtml(r.content)}</p>
        ${imagesHtml}
      </div>
    `;
  }).join('');

  return `<div class="review-list">${items}</div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === 이벤트 설정 ===

function setupStarRating(container) {
  const stars = container.querySelectorAll('#review-star-select .review-star');
  const ratingText = container.querySelector('#rating-text');
  const labels = ['', '별로예요', '그저 그래요', '보통이에요', '좋아요', '최고예요'];

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= val ? '#FFB800' : '#d2d2d7';
      });
    });

    star.addEventListener('click', () => {
      _selectedRating = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= _selectedRating ? '#FFB800' : '#d2d2d7';
      });
      if (ratingText) ratingText.textContent = labels[_selectedRating];
    });
  });

  const starContainer = container.querySelector('#review-star-select');
  if (starContainer) {
    starContainer.addEventListener('mouseleave', () => {
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= _selectedRating ? '#FFB800' : '#d2d2d7';
      });
    });
  }
}

function setupForm(container, productId) {
  const textarea = container.querySelector('#review-content');
  const charCount = container.querySelector('#char-count');
  const submitBtn = container.querySelector('#review-submit-btn');
  const errorEl = container.querySelector('#review-error');

  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!_selectedRating) {
        showError(errorEl, '별점을 선택해주세요.');
        return;
      }
      const content = textarea?.value.trim() || '';
      if (content.length < 10) {
        showError(errorEl, '후기는 최소 10자 이상 작성해주세요.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '등록 중...';

      try {
        // 이미지 업로드
        const imageUrls = [];
        for (const item of _pendingImages) {
          const url = await uploadReviewImage(item.file);
          imageUrls.push(url);
        }

        await addReview(productId, {
          rating: _selectedRating,
          content,
          images: imageUrls
        });

        _selectedRating = 0;
        _pendingImages = [];
        await initReviews(productId, true);
      } catch (err) {
        showError(errorEl, err.message || '후기 등록에 실패했습니다.');
        submitBtn.disabled = false;
        submitBtn.textContent = '등록';
      }
    });
  }
}

function setupImageUpload(container) {
  const input = container.querySelector('#review-image-input');
  const previewArea = container.querySelector('#image-preview-area');
  if (!input || !previewArea) return;

  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (_pendingImages.length + files.length > 3) {
      alert('사진은 최대 3장까지 첨부할 수 있습니다.');
      input.value = '';
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(file);
      _pendingImages.push({ file, previewUrl });
    }

    renderImagePreviews(previewArea);
    input.value = '';
  });
}

function renderImagePreviews(area) {
  area.innerHTML = _pendingImages.map((item, idx) => `
    <div class="review-form__image-item">
      <img src="${item.previewUrl}" alt="미리보기" />
      <button class="review-form__image-remove" data-idx="${idx}">&times;</button>
    </div>
  `).join('');

  area.querySelectorAll('.review-form__image-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      URL.revokeObjectURL(_pendingImages[idx].previewUrl);
      _pendingImages.splice(idx, 1);
      renderImagePreviews(area);
    });
  });
}

function setupDeleteButtons(container, productId, isPurchased) {
  container.querySelectorAll('.review-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('후기를 삭제하시겠습니까?')) return;
      try {
        await deleteReview(btn.dataset.reviewId, btn.dataset.userId);
        await initReviews(productId, isPurchased);
      } catch (err) {
        alert(err.message || '삭제에 실패했습니다.');
      }
    });
  });
}

function setupImageModal() {
  document.querySelectorAll('.review-card__thumb').forEach(img => {
    img.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'review-image-modal';
      modal.innerHTML = `<img src="${img.dataset.full}" alt="후기 사진" /><button class="review-image-modal__close">&times;</button>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('review-image-modal__close')) {
          modal.remove();
        }
      });
    });
  });
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
