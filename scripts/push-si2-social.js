const admin = require('firebase-admin');
const serviceAccount = require('../serviceaccountkey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const product = {
  id: 'video_si2_social_free',
  title: '2급 스포츠지도사 스포츠사회학 무료강의',
  description: '스포츠사회학 전 범위 무료 강의',
  type: 'video',
  category: 'sports',
  price: 0,
  originalPrice: null,
  thumbnailUrl: 'https://img.youtube.com/vi/yn_zusV9b2A/hqdefault.jpg',
  youtubeId: 'yn_zusV9b2A',
  isFree: true,
  totalEpisodes: 1,
  totalDuration: '28분 54초',
  isActive: true,
  sortOrder: 104
};

const episode = {
  productId: 'video_si2_social_free',
  episode: 1,
  title: '스포츠사회학 전 범위',
  youtubeId: 'yn_zusV9b2A',
  duration: '28:54',
  sortOrder: 1,
  isFree: true,
  chapters: [
    { time: 0,    title: '1 - 스포츠사회학의 이해와 주요 이론' },
    { time: 235,  title: '2 - 스포츠의 특징·거트만·육성 정책 모형' },
    { time: 352,  title: '3 - 스포츠와 정치·경제' },
    { time: 540,  title: '4 - 스포츠와 교육·미디어' },
    { time: 793,  title: '5 - 스포츠와 사회계층' },
    { time: 1080, title: '6 - 스포츠와 사회화' },
    { time: 1297, title: '7 - 스포츠와 일탈' },
    { time: 1638, title: '8 - 미래사회의 스포츠' }
  ]
};

async function run() {
  const { id, ...pData } = product;
  pData.createdAt = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('products').doc(id).set(pData, { merge: true });
  console.log('✅ product:', id);

  const epId = `${episode.productId}_ep${String(episode.episode).padStart(2, '0')}`;
  await db.collection('episodes').doc(epId).set(episode, { merge: true });
  console.log('✅ episode:', epId);

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
