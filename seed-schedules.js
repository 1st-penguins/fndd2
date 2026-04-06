// seed-schedules.js — 2026년 체���지도자 시험 일정 시드 데이터 (공식 일정)
// 실행: node seed-schedules.js
// ⚠️ serviceaccountkey.json 필요

const admin = require('firebase-admin');
const serviceAccount = require('./serviceaccountkey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const { Timestamp } = admin.firestore;

function ts(dateStr) {
  return Timestamp.fromDate(new Date(dateStr + 'T00:00:00+09:00'));
}

const schedules = [
  // ══════════════════════════════════════
  // 1급 전문스포츠지도사
  // ══════════��═══════════════════════════
  {
    certType: 'sports-instructor-1',
    title: '필��시험 원서접수',
    type: 'registration',
    startDate: ts('2026-03-12'),
    endDate: ts('2026-03-16'),
    year: 2026, half: 1, order: 1, isActive: true,
    description: '원서접수 3/12~3/16, 서류접수 ~3/18, 수수료납부 ~3/18',
  },
  {
    certType: 'sports-instructor-1',
    title: '필기시험',
    type: 'written-exam',
    startDate: ts('2026-04-18'),
    endDate: null,
    year: 2026, half: 1, order: 2, isActive: true,
  },
  {
    certType: 'sports-instructor-1',
    title: '필기시험 합격자 발표',
    type: 'result',
    startDate: ts('2026-05-08'),
    endDate: null,
    year: 2026, half: 1, order: 3, isActive: true,
  },
  {
    certType: 'sports-instructor-1',
    title: '연수 등록',
    type: 'registration',
    startDate: ts('2026-07-21'),
    endDate: ts('2026-07-23'),
    year: 2026, half: 2, order: 4, isActive: true,
    description: '일반/특별과정 공통, 연수비납부 ~7/23',
  },
  {
    certType: 'sports-instructor-1',
    title: '연수 (일반수업)',
    type: 'other',
    startDate: ts('2026-08-01'),
    endDate: ts('2026-12-05'),
    year: 2026, half: 2, order: 5, isActive: true,
    description: '일반/특별과정 공통',
  },

  // ══════════════════════════════════════
  // 2급 생활스포츠지도사
  // ══════════════���═══════════════════════
  {
    certType: 'sports-instructor',
    title: '실기·구술 원서접수 (동계·설상)',
    type: 'registration',
    startDate: ts('2026-01-26'),
    endDate: ts('2026-01-29'),
    year: 2026, half: 1, order: 1, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '실기·구술시험 (동계·설상)',
    type: 'practical-exam',
    startDate: ts('2026-02-02'),
    endDate: ts('2026-03-01'),
    year: 2026, half: 1, order: 2, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '실기·구술 합격자 발표 (동계·설상)',
    type: 'result',
    startDate: ts('2026-03-06'),
    endDate: null,
    year: 2026, half: 1, order: 3, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '필기시험 원서접수',
    type: 'registration',
    startDate: ts('2026-04-02'),
    endDate: ts('2026-04-02'),
    year: 2026, half: 1, order: 4, isActive: true,
    description: '원서접수·수수료납부 4/2 당일',
  },
  {
    certType: 'sports-instructor',
    title: '필기시험',
    type: 'written-exam',
    startDate: ts('2026-04-18'),
    endDate: null,
    year: 2026, half: 1, order: 5, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '필기시험 합격자 발표',
    type: 'result',
    startDate: ts('2026-05-08'),
    endDate: null,
    year: 2026, half: 1, order: 6, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '���기·구술 원서접수 (하계/빙상)',
    type: 'registration',
    startDate: ts('2026-05-18'),
    endDate: ts('2026-05-21'),
    year: 2026, half: 1, order: 7, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '실기·구술시험 (하���/빙상)',
    type: 'practical-exam',
    startDate: ts('2026-05-26'),
    endDate: ts('2026-07-10'),
    year: 2026, half: 2, order: 8, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '실기·구술 합격자 발표 (하계/빙상)',
    type: 'result',
    startDate: ts('2026-07-15'),
    endDate: null,
    year: 2026, half: 2, order: 9, isActive: true,
  },
  {
    certType: 'sports-instructor',
    title: '연수 등��',
    type: 'registration',
    startDate: ts('2026-07-21'),
    endDate: ts('2026-07-23'),
    year: 2026, half: 2, order: 10, isActive: true,
    description: '일반/특별과정 공통, 연수비납부 ~7/23',
  },
  {
    certType: 'sports-instructor',
    title: '연수 (일반수업·현장실습)',
    type: 'other',
    startDate: ts('2026-08-01'),
    endDate: ts('2026-10-18'),
    year: 2026, half: 2, order: 11, isActive: true,
    description: '일반/특별과정 공통',
  },

  // ═══════════��══════════════════════════
  // 건강운동관리사
  // ═══════════════════���══════════════════
  {
    certType: 'health-manager',
    title: '필기시��� 원서접수',
    type: 'registration',
    startDate: ts('2026-05-07'),
    endDate: ts('2026-05-11'),
    year: 2026, half: 1, order: 1, isActive: true,
    description: '원서접수 5/7~5/11, 서류접수 ~5/13, 수수료납부 ~5/13',
  },
  {
    certType: 'health-manager',
    title: '필기��험',
    type: 'written-exam',
    startDate: ts('2026-06-13'),
    endDate: null,
    year: 2026, half: 1, order: 2, isActive: true,
  },
  {
    certType: 'health-manager',
    title: '필기시험 합격자 발표',
    type: 'result',
    startDate: ts('2026-06-29'),
    endDate: null,
    year: 2026, half: 1, order: 3, isActive: true,
  },
  {
    certType: 'health-manager',
    title: '실기·구술시험 원서접수',
    type: 'registration',
    startDate: ts('2026-07-01'),
    endDate: ts('2026-07-06'),
    year: 2026, half: 2, order: 4, isActive: true,
    description: '원서접수 7/1~7/6, 서류접수 ~7/7, 수수료납부 ~7/7',
  },
  {
    certType: 'health-manager',
    title: '실기·구���시험',
    type: 'practical-exam',
    startDate: ts('2026-07-11'),
    endDate: ts('2026-07-12'),
    year: 2026, half: 2, order: 5, isActive: true,
  },
  {
    certType: 'health-manager',
    title: '실기·구술 합격자 발표',
    type: 'result',
    startDate: ts('2026-07-24'),
    endDate: null,
    year: 2026, half: 2, order: 6, isActive: true,
  },
  {
    certType: 'health-manager',
    title: '연수 등록',
    type: 'registration',
    startDate: ts('2026-07-30'),
    endDate: ts('2026-08-04'),
    year: 2026, half: 2, order: 7, isActive: true,
    description: '연수비납부 ~8/4',
  },
  {
    certType: 'health-manager',
    title: '연��� (일반수업·현장실습)',
    type: 'other',
    startDate: ts('2026-08-16'),
    endDate: ts('2026-11-22'),
    year: 2026, half: 2, order: 8, isActive: true,
  },
];

async function seed() {
  // 기존 데이터 삭제
  const existing = await db.collection('examSchedules').get();
  if (!existing.empty) {
    const deleteBatch = db.batch();
    existing.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    console.log(`🗑️  기존 ${existing.size}개 일정 삭제`);
  }

  // 새 데이터 등록
  const batch = db.batch();
  const col = db.collection('examSchedules');

  for (const schedule of schedules) {
    const ref = col.doc();
    batch.set(ref, {
      ...schedule,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`✅ ${schedules.length}개 시험 일�� 등록 완료!`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
