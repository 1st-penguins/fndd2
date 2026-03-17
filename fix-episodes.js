const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require('./serviceaccountkey.json')) });
}
const db = admin.firestore();

// 새 ID → 기존 ID 매핑
const ID_MAP = {
  'health-anatomy-lecture': 'video_anatomy',
  'health-injury-lecture': 'video_injury',
  'health-physiology-lecture': 'video_physio',
  'health-stress-test-lecture': 'video_load',
  'health-ecg-lecture': 'video_ecg',
  'health-pathology-lecture': 'video_patho',
  'health-prescription-lecture': 'video_prescript',
  'health-fitness-eval-lecture': 'video_health',
  'health-anatomy-summary': 'pdf_anatomy',
  'health-injury-summary': 'pdf_injury',
  'health-physiology-summary': 'pdf_physio',
  'health-stress-test-summary': 'pdf_load',
  'health-pathology-summary': 'pdf_patho',
  'health-sports-psych-summary': 'pdf_psycho',
  'health-prescription-summary': 'pdf_prescript',
  'health-fitness-eval-summary': 'pdf_health',
};

// 에피소드 데이터 (기존 ID 사용)
const episodes = [
  // 기능해부학
  { productId: 'video_anatomy', episode: 0, title: '무료강의', vimeoId: '1174294721', duration: '11:14', sortOrder: 0, isFree: true },
  { productId: 'video_anatomy', episode: 1, title: '기본개념', vimeoId: '1174294828', duration: '48:46', sortOrder: 1, isFree: false },
  { productId: 'video_anatomy', episode: 2, title: '상지', vimeoId: '1174295118', duration: '97:54', sortOrder: 2, isFree: false },
  { productId: 'video_anatomy', episode: 3, title: '복부환기', vimeoId: '1174295840', duration: '12:45', sortOrder: 3, isFree: false },
  { productId: 'video_anatomy', episode: 4, title: '하지', vimeoId: '1174295985', duration: '85:10', sortOrder: 4, isFree: false },
  { productId: 'video_anatomy', episode: 5, title: '보행주행', vimeoId: '1174297147', duration: '12:14', sortOrder: 5, isFree: false },
  { productId: 'video_anatomy', episode: 6, title: '운동역학', vimeoId: '1174297377', duration: '112:05', sortOrder: 6, isFree: false },

  // 운동상해
  { productId: 'video_injury', episode: 1, title: '운동상해개요', vimeoId: '1174300648', duration: '93:27', sortOrder: 1, isFree: true },
  { productId: 'video_injury', episode: 2, title: '뇌손상', vimeoId: '1174301395', duration: '8:55', sortOrder: 2, isFree: false },
  { productId: 'video_injury', episode: 3, title: '어깨팔손상', vimeoId: '1174301492', duration: '43:15', sortOrder: 3, isFree: false },
  { productId: 'video_injury', episode: 4, title: '팔꿈치손가락', vimeoId: '1174301976', duration: '43:23', sortOrder: 4, isFree: false },
  { productId: 'video_injury', episode: 5, title: '척추손상', vimeoId: '1174302315', duration: '23:53', sortOrder: 5, isFree: false },
  { productId: 'video_injury', episode: 6, title: '엉덩관절골반', vimeoId: '1174302462', duration: '37:21', sortOrder: 6, isFree: false },
  { productId: 'video_injury', episode: 7, title: '무릎손상', vimeoId: '1174302746', duration: '47:41', sortOrder: 7, isFree: false },
  { productId: 'video_injury', episode: 8, title: '발발목손상', vimeoId: '1174303096', duration: '52:46', sortOrder: 8, isFree: false },
  { productId: 'video_injury', episode: 9, title: '재활운동', vimeoId: '1174303456', duration: '45:56', sortOrder: 9, isFree: false },

  // 운동생리학
  { productId: 'video_physio', episode: 1, title: '생체에너지학', vimeoId: '1174271107', duration: '58:35', sortOrder: 1, isFree: true },
  { productId: 'video_physio', episode: 2, title: '운동대사', vimeoId: '1174271511', duration: '57:21', sortOrder: 2, isFree: false },
  { productId: 'video_physio', episode: 3, title: '호르몬', vimeoId: '1174271934', duration: '54:27', sortOrder: 3, isFree: false },
  { productId: 'video_physio', episode: 4, title: '신경계', vimeoId: '1174272066', duration: '55:36', sortOrder: 4, isFree: false },
  { productId: 'video_physio', episode: 5, title: '골격근', vimeoId: '1174272430', duration: '56:25', sortOrder: 5, isFree: false },
  { productId: 'video_physio', episode: 6, title: '순환계', vimeoId: '1174272722', duration: '102:14', sortOrder: 6, isFree: false },
  { productId: 'video_physio', episode: 7, title: '호흡계', vimeoId: '1174273328', duration: '75:54', sortOrder: 7, isFree: false },
  { productId: 'video_physio', episode: 8, title: '체온조절', vimeoId: '1174273798', duration: '23:22', sortOrder: 8, isFree: false },
  { productId: 'video_physio', episode: 9, title: '훈련생리학', vimeoId: '1174273952', duration: '32:58', sortOrder: 9, isFree: false },
  { productId: 'video_physio', episode: 10, title: '저항성훈련생리학', vimeoId: '1174274199', duration: '17:09', sortOrder: 10, isFree: false },
  { productId: 'video_physio', episode: 11, title: '운동과환경', vimeoId: '1174274334', duration: '21:30', sortOrder: 11, isFree: false },

  // 운동부하검사
  { productId: 'video_load', episode: 1, title: '개요 및 적응증', vimeoId: '1174288117', duration: '24:38', sortOrder: 1, isFree: true },
  { productId: 'video_load', episode: 2, title: '검사실시', vimeoId: '1174288316', duration: '84:19', sortOrder: 2, isFree: false },
  { productId: 'video_load', episode: 3, title: '검사해석', vimeoId: '1174290112', duration: '142:22', sortOrder: 3, isFree: false },
  { productId: 'video_load', episode: 4, title: '질환자검사', vimeoId: '1174291330', duration: '53:13', sortOrder: 4, isFree: false },
  { productId: 'video_load', episode: 5, title: '기타질환자검사', vimeoId: '1174291917', duration: '25:11', sortOrder: 5, isFree: false },
  { productId: 'video_load', episode: 6, title: '특수대상자검사', vimeoId: '1174292278', duration: '11:16', sortOrder: 6, isFree: false },

  // 심전도
  { productId: 'video_ecg', episode: 1, title: '심전도 (1)', vimeoId: '1174292400', duration: '77:49', sortOrder: 1, isFree: false },
  { productId: 'video_ecg', episode: 2, title: '심전도 (2)', vimeoId: '1174293166', duration: '84:47', sortOrder: 2, isFree: false },

  // 병태생리학
  { productId: 'video_patho', episode: 1, title: '기본적인 질병 과정', vimeoId: '1174298176', duration: '72:41', sortOrder: 1, isFree: true },
  { productId: 'video_patho', episode: 2, title: '심혈관계 질환', vimeoId: '1174298685', duration: '99:05', sortOrder: 2, isFree: false },
  { productId: 'video_patho', episode: 3, title: '호흡계 질환', vimeoId: '1174299448', duration: '48:29', sortOrder: 3, isFree: false },
  { productId: 'video_patho', episode: 4, title: '척추관절 질환', vimeoId: '1174300039', duration: '26:02', sortOrder: 4, isFree: false },
  { productId: 'video_patho', episode: 5, title: '골 질환', vimeoId: '1174300304', duration: '26:53', sortOrder: 5, isFree: false },
  { productId: 'video_patho', episode: 6, title: '대사계 질환', vimeoId: '1174300571', duration: '39:43', sortOrder: 6, isFree: false },
  { productId: 'video_patho', episode: 7, title: '신경계 질환', vimeoId: '1174300615', duration: '43:57', sortOrder: 7, isFree: false },

  // 운동처방론
  { productId: 'video_prescript', episode: 1, title: '운동처방의 기초이론', vimeoId: '1174284845', duration: '26:30', sortOrder: 1, isFree: true },
  { productId: 'video_prescript', episode: 2, title: '체력향상을 위한 운동처방', vimeoId: '1174285136', duration: '54:23', sortOrder: 2, isFree: false },
  { productId: 'video_prescript', episode: 3, title: '질환자를 위한 운동처방', vimeoId: '1174285593', duration: '108:20', sortOrder: 3, isFree: false },
  { productId: 'video_prescript', episode: 4, title: '기타질환자를 위한 운동처방', vimeoId: '1174286542', duration: '83:04', sortOrder: 4, isFree: false },
  { productId: 'video_prescript', episode: 5, title: '특수대상자의 운동처방', vimeoId: '1174287173', duration: '26:24', sortOrder: 5, isFree: false },

  // 건강체력평가
  { productId: 'video_health', episode: 1, title: '신체활동과 건강', vimeoId: '1174274432', duration: '24:38', sortOrder: 1, isFree: true },
  { productId: 'video_health', episode: 2, title: '운동참여 전 평가', vimeoId: '1174274581', duration: '56:00', sortOrder: 2, isFree: false },
  { productId: 'video_health', episode: 3, title: '체력검사와 평가', vimeoId: '1174293851', duration: '104:42', sortOrder: 3, isFree: false },
  { productId: 'video_health', episode: 4, title: '통계', vimeoId: '1174283754', duration: '103:58', sortOrder: 4, isFree: false },
  { productId: 'video_health', episode: 5, title: '국민체력100', vimeoId: '1174284539', duration: '44:15', sortOrder: 5, isFree: false },
];

async function fix() {
  // 1. 기존 상품에 totalEpisodes, totalDuration 업데이트
  const productMeta = {
    'video_anatomy': { totalEpisodes: 7, totalDuration: '약 6시간 20분' },
    'video_injury': { totalEpisodes: 9, totalDuration: '약 6시간 36분' },
    'video_physio': { totalEpisodes: 11, totalDuration: '약 9시간 16분' },
    'video_load': { totalEpisodes: 6, totalDuration: '약 5시간 41분' },
    'video_ecg': { totalEpisodes: 2, totalDuration: '약 2시간 43분' },
    'video_patho': { totalEpisodes: 7, totalDuration: '약 5시간 57분' },
    'video_prescript': { totalEpisodes: 5, totalDuration: '약 4시간 59분' },
    'video_health': { totalEpisodes: 5, totalDuration: '약 5시간 33분' },
  };

  console.log('━━━ 1. 기존 상품 메타 업데이트 ━━━');
  for (const [id, meta] of Object.entries(productMeta)) {
    await db.collection('products').doc(id).update(meta);
    console.log(`✅ ${id} → ${meta.totalEpisodes}강, ${meta.totalDuration}`);
  }

  // 2. 기존 ID로 에피소드 등록
  console.log('\n━━━ 2. 에피소드 등록 (기존 ID) ━━━');
  for (const ep of episodes) {
    const epId = `${ep.productId}_ep${String(ep.episode).padStart(2, '0')}`;
    await db.collection('episodes').doc(epId).set({
      ...ep,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ ${epId} → ${ep.title} (vimeo:${ep.vimeoId})`);
  }

  // 3. 중복 생성된 새 ID 상품 비활성화
  console.log('\n━━━ 3. 중복 상품 비활성화 ━━━');
  for (const newId of Object.keys(ID_MAP)) {
    await db.collection('products').doc(newId).update({ isActive: false });
    console.log(`🚫 ${newId} → isActive: false`);
  }

  // 4. 잘못된 ID로 등록된 에피소드 삭제
  console.log('\n━━━ 4. 잘못된 에피소드 삭제 ━━━');
  const oldEpSnap = await db.collection('episodes').get();
  for (const doc of oldEpSnap.docs) {
    const data = doc.data();
    if (data.productId && data.productId.startsWith('health-')) {
      await doc.ref.delete();
      console.log(`🗑️ ${doc.id} 삭제`);
    }
  }

  console.log('\n━━━ 완료! ━━━');
}

fix().catch(console.error).then(() => process.exit());
