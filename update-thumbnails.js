// update-thumbnails.js - 정규강의 썸네일 URL 업데이트
const admin = require('firebase-admin');
const serviceAccount = require('./serviceaccountkey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const thumbnailMap = {
  // 정규강의 (새 ID 체계)
  'health-anatomy-lecture': '/images/products/anatomy-lecture.jpg',
  'health-injury-lecture': '/images/products/injury-lecture.jpg',
  'health-physiology-lecture': '/images/products/physio-lecture.jpg',
  'health-stress-test-lecture': '/images/products/load-lecture.jpg',
  'health-ecg-lecture': '/images/products/ECG-lecture.jpg',
  'health-pathology-lecture': '/images/products/patho-lecture.jpg',
  'health-prescription-lecture': '/images/products/prescript-lecture.jpg',
  'health-fitness-eval-lecture': '/images/products/health-lecture.jpg',
  // 레거시 ID (혹시 남아있을 경우)
  'video_anatomy': '/images/products/anatomy-lecture.jpg',
  'video_injury': '/images/products/injury-lecture.jpg',
  'video_physio': '/images/products/physio-lecture.jpg',
  'video_load': '/images/products/load-lecture.jpg',
  'video_ecg': '/images/products/ECG-lecture.jpg',
  'video_patho': '/images/products/patho-lecture.jpg',
  'video_prescript': '/images/products/prescript-lecture.jpg',
  'video_health': '/images/products/health-lecture.jpg',
};

async function updateThumbnails() {
  const batch = db.batch();
  let count = 0;

  for (const [productId, thumbnailUrl] of Object.entries(thumbnailMap)) {
    const ref = db.collection('products').doc(productId);
    const doc = await ref.get();
    if (doc.exists) {
      batch.update(ref, { thumbnailUrl });
      console.log(`✓ ${productId} → ${thumbnailUrl}`);
      count++;
    } else {
      console.log(`✗ ${productId} (문서 없음, 스킵)`);
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`\n${count}개 상품 썸네일 업데이트 완료!`);
  } else {
    console.log('\n업데이트할 상품이 없습니다.');
  }

  process.exit(0);
}

updateThumbnails().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
