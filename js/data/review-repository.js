// js/data/review-repository.js - 상품 후기 데이터 계층
import { ensureFirebase } from "../core/firebase-core.js";
import { isAdmin } from "../auth/auth-utils.js";

let _fsCache = null;
async function getFS() {
  if (_fsCache) {
    // auth는 매번 최신으로
    const { auth } = await ensureFirebase();
    return { ..._fsCache, auth };
  }
  const { db, auth } = await ensureFirebase();
  const fs = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
  _fsCache = { db, ...fs };
  return { db, auth, ...fs };
}

let _storage = null;
async function getStorage() {
  if (_storage) return _storage;
  const { app } = await ensureFirebase();
  const { getStorage: initStorage } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");
  _storage = initStorage(app);
  return _storage;
}

const REVIEWS_COLLECTION = 'reviews';

/**
 * 이름 마스킹 (김준서 → 김*서, 이승현 → 이*현, AB → A*)
 */
export function maskName(name) {
  if (!name || name.length <= 1) return name || '익명';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

/**
 * 이미지 리사이즈 (max 800px, JPEG 80%)
 */
function resizeImage(file, maxSize = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('이미지 변환 실패')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/**
 * 리뷰 이미지 업로드 (Firebase Storage)
 */
export async function uploadReviewImage(file) {
  const storage = await getStorage();
  const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");
  const resized = await resizeImage(file);
  const fileName = `reviews/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, resized, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

/**
 * 상품 리뷰 목록 조회
 */
export async function getReviews(productId) {
  const { db, collection, query, where, orderBy, getDocs } = await getFS();
  const q = query(
    collection(db, REVIEWS_COLLECTION),
    where('productId', '==', productId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * 리뷰 통계 (평균 별점, 총 개수)
 */
export function getReviewStats(reviews) {
  if (!reviews.length) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length
  };
}

/**
 * 유저가 이미 리뷰를 작성했는지 확인
 */
export function hasUserReviewed(reviews, userId) {
  return reviews.some(r => r.userId === userId);
}

/**
 * 리뷰 추가
 */
export async function addReview(productId, { rating, content, images = [] }) {
  const { db, auth, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } = await getFS();
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  // 구매 확인 (document ID 패턴: {userId}_{productId})
  let isPurchased = false;
  try {
    const purchaseSnap = await getDoc(doc(db, 'purchases', `${user.uid}_${productId}`));
    if (purchaseSnap.exists() && purchaseSnap.data().status === 'completed') {
      isPurchased = true;
    }
  } catch (e) {}

  // 번들 구매 확인
  if (!isPurchased) {
    try {
      const bundleSnap = await getDocs(query(collection(db, 'products'), where('type', '==', 'bundle')));
      for (const bd of bundleSnap.docs) {
        const bData = bd.data();
        if (bData.includedProducts && bData.includedProducts.includes(productId)) {
          const bPurchase = await getDoc(doc(db, 'purchases', `${user.uid}_${bd.id}`));
          if (bPurchase.exists() && bPurchase.data().status === 'completed') {
            isPurchased = true;
            break;
          }
        }
      }
    } catch (e) {}
  }

  if (!isPurchased && !isAdmin(user)) {
    throw new Error('구매자만 후기를 작성할 수 있습니다.');
  }

  const authorName = user.displayName || user.email || '익명';

  const reviewData = {
    productId,
    userId: user.uid,
    author: maskName(authorName),
    authorRaw: authorName,
    rating,
    content,
    images,
    createdAt: serverTimestamp(),
    status: 'active'
  };

  const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), reviewData);
  return { id: docRef.id, ...reviewData, createdAt: new Date() };
}

/**
 * 리뷰 삭제 (본인 또는 관리자)
 */
export async function deleteReview(reviewId, reviewUserId) {
  const { db, auth, doc, deleteDoc } = await getFS();
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (user.uid !== reviewUserId && !isAdmin(user)) {
    throw new Error('삭제 권한이 없습니다.');
  }
  await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewId));
}
