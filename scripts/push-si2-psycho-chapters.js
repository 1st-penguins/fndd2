const admin = require('firebase-admin');
const serviceAccount = require('../serviceaccountkey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const chapters = [
  { time: 0,    title: '1 - 스포츠심리학의 정의와 역사' },
  { time: 189,  title: '2 - 운동 제어 이론 (폐쇄·개방회로·도식·다이나믹) ⭐' },
  { time: 604,  title: '3 - 불변/가변 매개변수와 운동 학습 단계' },
  { time: 2580, title: '4 - 정보 처리 단계' },
  { time: 3900, title: '5 - 성격과 스포츠' },
  { time: 5100, title: '6 - 동기 이론 (성취동기·귀인·자기효능감) ⭐' },
  { time: 5700, title: '7 - 불안과 스트레스 ⭐' },
  { time: 6369, title: '8 - 스포츠 심리 상담 기술과 윤리' }
];

async function run() {
  const epId = 'video_si2_psycho_free_ep01';
  await db.collection('episodes').doc(epId).set({ chapters }, { merge: true });
  console.log('✅ episode chapters updated:', epId);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
