// seed-firestore.js - Firestore에 상품 + 에피소드 시드 (Firebase Admin SDK)
const admin = require('firebase-admin');
const serviceAccount = require('./serviceaccountkey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ──────────────────────────────────────
// 상품 데이터
// ──────────────────────────────────────
const products = [
  // 건강운동관리사 상품은 Firestore에 video_*, pdf_* ID로 등록 완료
  // seed 재실행 시 중복 방지를 위해 여기에 포함하지 않음

  // === 2급 스포츠지도사 ===
  {
    id: 'pdf_si2_package',
    title: '2급 생활스포츠지도사 7일 완성 합격패키지',
    description: '스포츠사회학·스포츠윤리·스포츠심리학·한국체육사·스포츠교육학 요약본 5종 세트',
    type: 'package',
    category: 'sports',
    price: 50000,
    originalPrice: 50000,
    thumbnailUrl: '/images/products/si-7days-bundle.jpg',
    isActive: true,
    sortOrder: 100,
    bundleFiles: [
      { key: 'si2-social', name: '스포츠사회학 요약본', fileUrl: 'https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2Fsi2-social-summary.pdf?alt=media', fileSize: '32.8MB' },
      { key: 'si2-ethics', name: '스포츠윤리 요약본', fileUrl: 'https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2Fsi2-ethics-summary.pdf?alt=media', fileSize: '11.2MB' },
      { key: 'si2-psycho', name: '스포츠심리학 요약본', fileUrl: 'https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2Fsi2-psycho-summary.pdf?alt=media', fileSize: '56.7MB' },
      { key: 'si2-history', name: '한국체육사 요약본', fileUrl: 'https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2Fsi2-history-summary.pdf?alt=media', fileSize: '43.1MB' },
      { key: 'si2-education', name: '스포츠교육학 요약본', fileUrl: 'https://firebasestorage.googleapis.com/v0/b/first-penguins-new.firebasestorage.app/o/products%2Fsi2-education-summary.pdf?alt=media', fileSize: '10.9MB' }
    ]
  },
  {
    id: 'video_si2_psycho_free',
    title: '2급 스포츠지도사 스포츠심리학 무료강의',
    description: '스포츠심리학 전 범위 무료 강의',
    type: 'video',
    category: 'sports',
    price: 0,
    originalPrice: null,
    thumbnailUrl: 'https://img.youtube.com/vi/6dnkwEAiQFc/hqdefault.jpg',
    youtubeId: '6dnkwEAiQFc',
    isFree: true,
    totalEpisodes: 1,
    isActive: true,
    sortOrder: 101
  },
  {
    id: 'video_si2_history_free',
    title: '2급 스포츠지도사 한국체육사 무료강의',
    description: '한국체육사 전 범위 무료 강의',
    type: 'video',
    category: 'sports',
    price: 0,
    originalPrice: null,
    thumbnailUrl: 'https://img.youtube.com/vi/4AFuYvElqH4/hqdefault.jpg',
    youtubeId: '4AFuYvElqH4',
    isFree: true,
    totalEpisodes: 1,
    isActive: true,
    sortOrder: 102
  }
];

// ──────────────────────────────────────
// 에피소드 데이터 (Vimeo 연동)
// ──────────────────────────────────────
const episodes = [
  // 기능해부학 (7강, 00번은 무료)
  { productId: 'health-anatomy-lecture', episode: 0, title: '무료강의', vimeoId: '1174294721', duration: '11:14', sortOrder: 0, isFree: true },
  { productId: 'health-anatomy-lecture', episode: 1, title: '기본개념', vimeoId: '1174294828', duration: '48:46', sortOrder: 1, isFree: false },
  { productId: 'health-anatomy-lecture', episode: 2, title: '상지', vimeoId: '1174295118', duration: '97:54', sortOrder: 2, isFree: false },
  { productId: 'health-anatomy-lecture', episode: 3, title: '복부환기', vimeoId: '1174295840', duration: '12:45', sortOrder: 3, isFree: false },
  { productId: 'health-anatomy-lecture', episode: 4, title: '하지', vimeoId: '1174295985', duration: '85:10', sortOrder: 4, isFree: false },
  { productId: 'health-anatomy-lecture', episode: 5, title: '보행주행', vimeoId: '1174297147', duration: '12:14', sortOrder: 5, isFree: false },
  { productId: 'health-anatomy-lecture', episode: 6, title: '운동역학', vimeoId: '1174297377', duration: '112:05', sortOrder: 6, isFree: false },

  // 운동상해 (9강)
  { productId: 'health-injury-lecture', episode: 1, title: '운동상해개요', vimeoId: '1174300648', duration: '93:27', sortOrder: 1, isFree: true },
  { productId: 'health-injury-lecture', episode: 2, title: '뇌손상', vimeoId: '1174301395', duration: '8:55', sortOrder: 2, isFree: false },
  { productId: 'health-injury-lecture', episode: 3, title: '어깨팔손상', vimeoId: '1174301492', duration: '43:15', sortOrder: 3, isFree: false },
  { productId: 'health-injury-lecture', episode: 4, title: '팔꿈치손가락', vimeoId: '1174301976', duration: '43:23', sortOrder: 4, isFree: false },
  { productId: 'health-injury-lecture', episode: 5, title: '척추손상', vimeoId: '1174302315', duration: '23:53', sortOrder: 5, isFree: false },
  { productId: 'health-injury-lecture', episode: 6, title: '엉덩관절골반', vimeoId: '1174302462', duration: '37:21', sortOrder: 6, isFree: false },
  { productId: 'health-injury-lecture', episode: 7, title: '무릎손상', vimeoId: '1174302746', duration: '47:41', sortOrder: 7, isFree: false },
  { productId: 'health-injury-lecture', episode: 8, title: '발발목손상', vimeoId: '1174303096', duration: '52:46', sortOrder: 8, isFree: false },
  { productId: 'health-injury-lecture', episode: 9, title: '재활운동', vimeoId: '1174303456', duration: '45:56', sortOrder: 9, isFree: false },

  // 운동생리학 (11강)
  { productId: 'health-physiology-lecture', episode: 1, title: '생체에너지학', vimeoId: '1174271107', duration: '58:35', sortOrder: 1, isFree: true },
  { productId: 'health-physiology-lecture', episode: 2, title: '운동대사', vimeoId: '1174271511', duration: '57:21', sortOrder: 2, isFree: false },
  { productId: 'health-physiology-lecture', episode: 3, title: '호르몬', vimeoId: '1174271934', duration: '54:27', sortOrder: 3, isFree: false },
  { productId: 'health-physiology-lecture', episode: 4, title: '신경계', vimeoId: '1174272066', duration: '55:36', sortOrder: 4, isFree: false },
  { productId: 'health-physiology-lecture', episode: 5, title: '골격근', vimeoId: '1174272430', duration: '56:25', sortOrder: 5, isFree: false },
  { productId: 'health-physiology-lecture', episode: 6, title: '순환계', vimeoId: '1174272722', duration: '102:14', sortOrder: 6, isFree: false },
  { productId: 'health-physiology-lecture', episode: 7, title: '호흡계', vimeoId: '1174273328', duration: '75:54', sortOrder: 7, isFree: false },
  { productId: 'health-physiology-lecture', episode: 8, title: '체온조절', vimeoId: '1174273798', duration: '23:22', sortOrder: 8, isFree: false },
  { productId: 'health-physiology-lecture', episode: 9, title: '훈련생리학', vimeoId: '1174273952', duration: '32:58', sortOrder: 9, isFree: false },
  { productId: 'health-physiology-lecture', episode: 10, title: '저항성훈련생리학', vimeoId: '1174274199', duration: '17:09', sortOrder: 10, isFree: false },
  { productId: 'health-physiology-lecture', episode: 11, title: '운동과환경', vimeoId: '1174274334', duration: '21:30', sortOrder: 11, isFree: false },

  // 운동부하검사 (6강, 심전도 제외)
  { productId: 'health-stress-test-lecture', episode: 1, title: '개요 및 적응증', vimeoId: '1174288117', duration: '24:38', sortOrder: 1, isFree: true },
  { productId: 'health-stress-test-lecture', episode: 2, title: '검사실시', vimeoId: '1174288316', duration: '84:19', sortOrder: 2, isFree: false },
  { productId: 'health-stress-test-lecture', episode: 3, title: '검사해석', vimeoId: '1174290112', duration: '142:22', sortOrder: 3, isFree: false },
  { productId: 'health-stress-test-lecture', episode: 4, title: '질환자검사', vimeoId: '1174291330', duration: '53:13', sortOrder: 4, isFree: false },
  { productId: 'health-stress-test-lecture', episode: 5, title: '기타질환자검사', vimeoId: '1174291917', duration: '25:11', sortOrder: 5, isFree: false },
  { productId: 'health-stress-test-lecture', episode: 6, title: '특수대상자검사', vimeoId: '1174292278', duration: '11:16', sortOrder: 6, isFree: false },

  // 심전도 (2강)
  { productId: 'health-ecg-lecture', episode: 1, title: '심전도 (1)', vimeoId: '1174292400', duration: '77:49', sortOrder: 1, isFree: false },
  { productId: 'health-ecg-lecture', episode: 2, title: '심전도 (2)', vimeoId: '1174293166', duration: '84:47', sortOrder: 2, isFree: false },

  // 병태생리학 (7강)
  { productId: 'health-pathology-lecture', episode: 1, title: '기본적인 질병 과정', vimeoId: '1174298176', duration: '72:41', sortOrder: 1, isFree: true },
  { productId: 'health-pathology-lecture', episode: 2, title: '심혈관계 질환', vimeoId: '1174298685', duration: '99:05', sortOrder: 2, isFree: false },
  { productId: 'health-pathology-lecture', episode: 3, title: '호흡계 질환', vimeoId: '1174299448', duration: '48:29', sortOrder: 3, isFree: false },
  { productId: 'health-pathology-lecture', episode: 4, title: '척추관절 질환', vimeoId: '1174300039', duration: '26:02', sortOrder: 4, isFree: false },
  { productId: 'health-pathology-lecture', episode: 5, title: '골 질환', vimeoId: '1174300304', duration: '26:53', sortOrder: 5, isFree: false },
  { productId: 'health-pathology-lecture', episode: 6, title: '대사계 질환', vimeoId: '1174300571', duration: '39:43', sortOrder: 6, isFree: false },
  { productId: 'health-pathology-lecture', episode: 7, title: '신경계 질환', vimeoId: '1174300615', duration: '43:57', sortOrder: 7, isFree: false },

  // 운동처방론 (5강)
  { productId: 'health-prescription-lecture', episode: 1, title: '운동처방의 기초이론', vimeoId: '1174284845', duration: '26:30', sortOrder: 1, isFree: true },
  { productId: 'health-prescription-lecture', episode: 2, title: '체력향상을 위한 운동처방', vimeoId: '1174285136', duration: '54:23', sortOrder: 2, isFree: false },
  { productId: 'health-prescription-lecture', episode: 3, title: '질환자를 위한 운동처방', vimeoId: '1174285593', duration: '108:20', sortOrder: 3, isFree: false },
  { productId: 'health-prescription-lecture', episode: 4, title: '기타질환자를 위한 운동처방', vimeoId: '1174286542', duration: '83:04', sortOrder: 4, isFree: false },
  { productId: 'health-prescription-lecture', episode: 5, title: '특수대상자의 운동처방', vimeoId: '1174287173', duration: '26:24', sortOrder: 5, isFree: false },

  // 건강체력평가 (5강)
  { productId: 'health-fitness-eval-lecture', episode: 1, title: '신체활동과 건강', vimeoId: '1174274432', duration: '24:38', sortOrder: 1, isFree: true },
  { productId: 'health-fitness-eval-lecture', episode: 2, title: '운동참여 전 평가', vimeoId: '1174274581', duration: '56:00', sortOrder: 2, isFree: false },
  { productId: 'health-fitness-eval-lecture', episode: 3, title: '체력검사와 평가', vimeoId: '1174293851', duration: '104:42', sortOrder: 3, isFree: false },
  { productId: 'health-fitness-eval-lecture', episode: 4, title: '통계', vimeoId: '1174283754', duration: '103:58', sortOrder: 4, isFree: false },
  { productId: 'health-fitness-eval-lecture', episode: 5, title: '국민체력100', vimeoId: '1174284539', duration: '44:15', sortOrder: 5, isFree: false },

  // === 2급 스포츠지도사 ===
  { productId: 'video_si2_psycho_free', episode: 1, title: '스포츠심리학 전 범위', youtubeId: '6dnkwEAiQFc', duration: '1:49:03', sortOrder: 1, isFree: true },
  { productId: 'video_si2_history_free', episode: 1, title: '한국체육사 전 범위', youtubeId: '4AFuYvElqH4', duration: '1:08:56', sortOrder: 1, isFree: true },
];

// ──────────────────────────────────────
// 실행
// ──────────────────────────────────────
async function seed() {
  console.log('━━━ 상품 등록 시작 ━━━');
  for (const p of products) {
    const { id, ...data } = p;
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('products').doc(id).set(data, { merge: true });
    console.log(`✅ 상품: ${p.title} (${id})`);
  }

  console.log('\n━━━ 에피소드 등록 시작 ━━━');
  for (const ep of episodes) {
    const epId = `${ep.productId}_ep${String(ep.episode).padStart(2, '0')}`;
    await db.collection('episodes').doc(epId).set({
      ...ep,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    const videoId = ep.vimeoId ? `vimeo:${ep.vimeoId}` : `youtube:${ep.youtubeId}`;
    console.log(`✅ EP: ${ep.productId} ${ep.episode}강 "${ep.title}" (${videoId})`);
  }

  console.log(`\n━━━ 완료! 상품 ${products.length}개, 에피소드 ${episodes.length}개 ━━━`);
}

seed().catch(console.error);
