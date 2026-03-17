const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

const products = [
  // ===== 인강 =====
  { id: 'video_physio', title: '건강운동관리사 운동생리학 정규강의', description: '운동생리학 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 운동생리학 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/physio-lecture.png', tags: ['운동생리학', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 1, isActive: true, createdAt: now },
  { id: 'video_patho', title: '건강운동관리사 병태생리학 정규강의', description: '병태생리학 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 병태생리학 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/patho-lecture.png', tags: ['병태생리학', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 2, isActive: true, createdAt: now },
  { id: 'video_anatomy', title: '건강운동관리사 기능해부학 정규강의', description: '기능해부학 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 기능해부학 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/anatomy-lecture.png', tags: ['기능해부학', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 3, isActive: true, createdAt: now },
  { id: 'video_prescript', title: '건강운동관리사 운동처방론 정규강의', description: '운동처방론 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 운동처방론 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 100000, thumbnailUrl: '/images/products/prescript-lecture.png', tags: ['운동처방론', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 4, isActive: true, createdAt: now },
  { id: 'video_load', title: '건강운동관리사 운동부하검사 정규강의', description: '운동부하검사 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 운동부하검사 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/load-lecture.png', tags: ['운동부하검사', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 5, isActive: true, createdAt: now },
  { id: 'video_injury', title: '건강운동관리사 운동상해 정규강의', description: '운동상해 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 운동상해 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/injury-lecture.png', tags: ['운동상해', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 6, isActive: true, createdAt: now },
  { id: 'video_health', title: '건강운동관리사 건강체력평가 정규강의', description: '건강체력평가 핵심 개념부터 기출 해설까지 완벽 정리', detailDescription: '건강운동관리사 건강체력평가 전 범위 정규강의\n핵심 개념 정리 및 기출문제 해설 포함', type: 'video', category: 'health', price: 150000, thumbnailUrl: '/images/products/health-lecture.png', tags: ['건강체력평가', '건강운동관리사', '인강'], totalEpisodes: 0, totalDuration: '', sortOrder: 7, isActive: true, createdAt: now },

  // ===== PDF =====
  { id: 'pdf_physio', title: '건강운동관리사 운동생리학 요약본', description: '운동생리학 핵심 내용 요약 정리', detailDescription: '건강운동관리사 운동생리학 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/physio-pdf.png', tags: ['운동생리학', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 11, isActive: true, createdAt: now },
  { id: 'pdf_patho', title: '건강운동관리사 병태생리학 요약본', description: '병태생리학 핵심 내용 요약 정리', detailDescription: '건강운동관리사 병태생리학 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/patho-pdf.png', tags: ['병태생리학', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 12, isActive: true, createdAt: now },
  { id: 'pdf_anatomy', title: '건강운동관리사 기능해부학 요약본', description: '기능해부학 핵심 내용 요약 정리', detailDescription: '건강운동관리사 기능해부학 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 80000, thumbnailUrl: '/images/products/anatomy-pdf.png', tags: ['기능해부학', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 13, isActive: true, createdAt: now },
  { id: 'pdf_prescript', title: '건강운동관리사 운동처방론 요약본', description: '운동처방론 핵심 내용 요약 정리', detailDescription: '건강운동관리사 운동처방론 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/prescript-pdf.png', tags: ['운동처방론', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 14, isActive: true, createdAt: now },
  { id: 'pdf_load', title: '건강운동관리사 운동부하검사 요약본', description: '운동부하검사 핵심 내용 요약 정리', detailDescription: '건강운동관리사 운동부하검사 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/load-pdf.png', tags: ['운동부하검사', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 15, isActive: true, createdAt: now },
  { id: 'pdf_injury', title: '건강운동관리사 운동상해 요약본', description: '운동상해 핵심 내용 요약 정리', detailDescription: '건강운동관리사 운동상해 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/injury-pdf.png', tags: ['운동상해', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 16, isActive: true, createdAt: now },
  { id: 'pdf_psycho', title: '건강운동관리사 스포츠심리학 요약본', description: '스포츠심리학 핵심 내용 요약 정리', detailDescription: '건강운동관리사 스포츠심리학 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/psycho-pdf.png', tags: ['스포츠심리학', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 17, isActive: true, createdAt: now },
  { id: 'pdf_health', title: '건강운동관리사 건강체력평가 요약본', description: '건강체력평가 핵심 내용 요약 정리', detailDescription: '건강운동관리사 건강체력평가 핵심 요약본\n시험 대비 핵심 키워드 정리', type: 'pdf', category: 'health', price: 50000, thumbnailUrl: '/images/products/health-pdf.png', tags: ['건강체력평가', '건강운동관리사', 'PDF', '요약본'], fileUrl: '', fileSize: '', pages: 0, sortOrder: 18, isActive: true, createdAt: now },
];

async function register() {
  console.log('🚀 상품 등록 시작...');
  let success = 0;
  let fail = 0;

  for (const product of products) {
    try {
      const { id, ...data } = product;
      await db.collection('products').doc(id).set(data);
      console.log(`✅ ${product.title}`);
      success++;
    } catch (error) {
      console.error(`❌ ${product.title}:`, error.message);
      fail++;
    }
  }

  console.log(`\n🎉 등록 완료! 성공: ${success}개, 실패: ${fail}개`);
  process.exit(0);
}

register();
