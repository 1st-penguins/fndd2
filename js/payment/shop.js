// shop.js - 상점 카탈로그 로직
// 강의 탭에서 상품 목록을 Firestore에서 가져와 렌더링

import { ensureFirebase } from '../core/firebase-core.js';
import {
  collection, query, where, orderBy, getDocs, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let db = null;
let auth = null;

// 타입 라벨 매핑
const TYPE_LABELS = {
  video: '강의',
  pdf: '자료',
  ppt: '자료',
  bundle: '패키지'
};

// 타입 아이콘 매핑
const TYPE_ICONS = {
  video: '🎬',
  pdf: '📄',
  ppt: '📊',
  bundle: '📦'
};

// 필터 → Firestore type 매핑
const FILTER_TYPE_MAP = {
  all: null,
  video: ['video'],
  material: ['pdf', 'ppt'],
  bundle: ['bundle']
};

// 캐시
let productsCache = null;
let purchasesCache = null;

/**
 * 상품 목록 로드 (Firestore)
 */
async function loadProducts() {
  if (productsCache) return productsCache;
  if (!db) {
    const firebase = await ensureFirebase();
    db = firebase.db;
    auth = firebase.auth;
  }

  try {
    const q = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const snapshot = await getDocs(q);
    productsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return productsCache;
  } catch (error) {
    console.error('상품 로드 오류:', error);
    return [];
  }
}

/**
 * 사용자 구매 내역 로드
 */
async function loadPurchases() {
  if (!auth) {
    const firebase = await ensureFirebase();
    db = firebase.db;
    auth = firebase.auth;
  }
  const user = auth.currentUser;
  if (!user) return [];
  if (purchasesCache) return purchasesCache;

  try {
    const q = query(
      collection(db, 'purchases'),
      where('userId', '==', user.uid),
      where('status', '==', 'completed')
    );
    const snapshot = await getDocs(q);
    purchasesCache = snapshot.docs.map(d => d.data().productId);

    // 패키지 구매 시 포함 상품도 구매 목록에 추가
    const products = await loadProducts();
    const bundlePurchased = products.filter(
      p => p.type === 'bundle' && purchasesCache.includes(p.id)
    );
    for (const bundle of bundlePurchased) {
      if (bundle.includedProducts) {
        for (const pid of bundle.includedProducts) {
          if (!purchasesCache.includes(pid)) {
            purchasesCache.push(pid);
          }
        }
      }
    }

    return purchasesCache;
  } catch (error) {
    console.error('구매 내역 로드 오류:', error);
    return [];
  }
}

/**
 * 상품이 구매되었는지 확인
 */
function isPurchased(productId, purchases) {
  return purchases.includes(productId);
}

/**
 * 가격 포맷
 */
function formatPrice(price) {
  if (price === 0) return '무료';
  return price.toLocaleString() + '원';
}

/**
 * 할인율 계산
 */
function calcDiscount(original, current) {
  if (!original || original <= current) return 0;
  return Math.round((1 - current / original) * 100);
}

/**
 * 상품 카드 HTML 생성
 */
function renderCard(product, purchased) {
  const typeLabel = TYPE_LABELS[product.type] || product.type;
  const typeIcon = TYPE_ICONS[product.type] || '📦';
  const badgeClass = `shop-card__badge--${product.type}`;

  // 메타 정보
  let metaHtml = '';
  if (product.type === 'video' && product.totalEpisodes) {
    metaHtml += `<span class="shop-card__meta-item">📹 ${product.totalEpisodes}강</span>`;
  }
  if (product.type === 'video' && product.totalDuration) {
    metaHtml += `<span class="shop-card__meta-item">⏱ ${product.totalDuration}</span>`;
  }
  if ((product.type === 'pdf' || product.type === 'ppt') && product.pages) {
    metaHtml += `<span class="shop-card__meta-item">📄 ${product.pages}쪽</span>`;
  }
  if ((product.type === 'pdf' || product.type === 'ppt') && product.fileSize) {
    metaHtml += `<span class="shop-card__meta-item">💾 ${product.fileSize}</span>`;
  }
  if (product.type === 'bundle' && product.includedProducts) {
    metaHtml += `<span class="shop-card__meta-item">📦 ${product.includedProducts.length}개 포함</span>`;
  }

  // 가격
  const priceClass = product.price === 0 ? 'shop-card__price shop-card__price--free' : 'shop-card__price';
  let priceHtml = `<span class="${priceClass}">${formatPrice(product.price)}</span>`;

  if (product.originalPrice && product.originalPrice > product.price) {
    const discount = calcDiscount(product.originalPrice, product.price);
    priceHtml = `
      <span class="shop-card__discount">${discount}%</span>
      <span class="${priceClass}">${formatPrice(product.price)}</span>
      <span class="shop-card__original-price">${formatPrice(product.originalPrice)}</span>
    `;
  }

  // 썸네일
  let thumbHtml;
  if (product.thumbnailUrl) {
    thumbHtml = `<img src="${product.thumbnailUrl}" alt="${product.title}">`;
  } else {
    thumbHtml = `<div class="shop-card__thumb-placeholder">${typeIcon}</div>`;
  }

  // 구매 뱃지
  const purchasedBadge = purchased
    ? `<span class="shop-card__purchased">구매완료</span>`
    : '';

  return `
    <a href="product-detail.html?id=${product.id}" class="shop-card">
      <div class="shop-card__thumb">
        ${thumbHtml}
        <span class="shop-card__badge ${badgeClass}">${typeLabel}</span>
        ${purchasedBadge}
      </div>
      <div class="shop-card__body">
        <div class="shop-card__title">${product.title}</div>
        <div class="shop-card__desc">${product.description || ''}</div>
        ${metaHtml ? `<div class="shop-card__meta">${metaHtml}</div>` : ''}
        <div class="shop-card__footer">${priceHtml}</div>
      </div>
    </a>
  `;
}

/**
 * 상점 렌더링
 */
async function renderShop(category, typeFilter = 'all') {
  const grid = document.getElementById('shop-product-grid');
  const emptyEl = document.getElementById('shop-empty');
  if (!grid) return;

  // 로딩
  grid.innerHTML = `
    <div class="shop-loading" style="grid-column: 1 / -1;">
      <div class="shop-loading__spinner"></div>
      <div>상품을 불러오는 중...</div>
    </div>
  `;
  if (emptyEl) emptyEl.style.display = 'none';

  const [products, purchases] = await Promise.all([
    loadProducts(),
    loadPurchases()
  ]);

  // 필터링: 카테고리
  let filtered = products.filter(p =>
    p.category === category || p.category === 'common'
  );

  // 필터링: 타입
  const typeValues = FILTER_TYPE_MAP[typeFilter];
  if (typeValues) {
    filtered = filtered.filter(p => typeValues.includes(p.type));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = 'block';
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  grid.innerHTML = filtered.map(p =>
    renderCard(p, isPurchased(p.id, purchases))
  ).join('');
}

/**
 * 캐시 초기화 (로그인/로그아웃 시)
 */
function clearCache() {
  productsCache = null;
  purchasesCache = null;
}

/**
 * 상점 초기화
 */
export function initShop() {
  const shopContainer = document.getElementById('shop-container');
  if (!shopContainer) return;

  // 현재 자격증 & 필터 상태
  let currentCategory = 'health';
  let currentFilter = 'all';

  // 자격증 탭에서 카테고리 매핑
  const certCategoryMap = {
    'health-manager': 'health',
    'sports-instructor': 'sports',
    'sports-instructor-1': 'sports-1'
  };

  // 현재 선택된 자격증 가져오기
  function getCurrentCategory() {
    const activeCert = document.querySelector('.cert-button.active');
    if (activeCert) {
      const certType = activeCert.getAttribute('data-cert');
      return certCategoryMap[certType] || 'health';
    }
    return 'health';
  }

  // 필터 버튼 이벤트
  const filterBtns = shopContainer.querySelectorAll('.shop-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      currentCategory = getCurrentCategory();
      renderShop(currentCategory, currentFilter);
    });
  });

  // 자격증 변경 감지
  document.addEventListener('certChanged', () => {
    currentCategory = getCurrentCategory();
    renderShop(currentCategory, currentFilter);
  });

  // 로그인 상태 변경 시 캐시 초기화 & 재렌더링
  document.addEventListener('authStateChanged', () => {
    clearCache();
    currentCategory = getCurrentCategory();
    renderShop(currentCategory, currentFilter);
  });

  // 초기 렌더링
  currentCategory = getCurrentCategory();
  renderShop(currentCategory, currentFilter);
}

// 외부에서 사용
export { loadProducts, loadPurchases, clearCache };
