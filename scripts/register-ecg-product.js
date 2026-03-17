const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'first-penguins-new.firebasestorage.app'
});

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

const product = {
  id: 'video_ecg',
  title: '건강운동관리사를 위한 심전도',
  description: '심전도 판독의 기초부터 실전까지',
  detailDescription: '건강운동관리사를 위한 심전도 강의\n심전도 판독 기초 및 실전 해설',
  type: 'video',
  category: 'health',
  price: 50000,
  thumbnailUrl: '/images/products/ECG-lecture.png',
  tags: ['심전도', '건강운동관리사', '인강'],
  totalEpisodes: 0,
  totalDuration: '',
  sortOrder: 8,
  isActive: true,
  createdAt: now
};

async function register() {
  console.log('상품 등록 시작...');

  try {
    const { id, ...data } = product;
    await db.collection('products').doc(id).set(data);
    console.log('등록 완료:', product.title);
  } catch (error) {
    console.error('등록 실패:', error.message);
  }

  process.exit(0);
}

register();
