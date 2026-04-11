const admin = require('firebase-admin');
const serviceAccount = require('../serviceaccountkey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const chapters = [
  { time: 0,    title: '1 - 체육사의 의미와 선사·부족국가' },
  { time: 334,  title: '2 - 삼국 시대 (태학·경당·화랑도)' },
  { time: 1048, title: '3 - 고려 시대의 체육' },
  { time: 1498, title: '4 - 조선 시대 (무예도보통지·민속놀이)' },
  { time: 2022, title: '5 - 개화기 (교육입국조서·YMCA) ⭐' },
  { time: 2907, title: '6 - 일제 강점기 (조선체육회·일장기 말소) ⭐' },
  { time: 3608, title: '7 - 광복 이후와 현대 체육 정책 ⭐' },
  { time: 3983, title: '8 - 주요 올림픽 참가 기록' }
];

async function run() {
  const epId = 'video_si2_history_free_ep01';
  await db.collection('episodes').doc(epId).set({ chapters }, { merge: true });
  console.log('✅ episode chapters updated:', epId);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
