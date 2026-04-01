/**
 * questionStats 마이그레이션 스크립트
 *
 * 기존 attempts 컬렉션을 읽어서 questionStats 컬렉션 초기 데이터를 생성합니다.
 * 문서 구조: 과목+연도당 1문서 (questions 맵에 문제별 통계)
 * 문서 ID: {certType}_{year}_{subject}
 *
 * 실행: node scripts/migrate-question-stats.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceaccountkey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ADMIN_EMAILS = [
  'kspo0324@gmail.com',
  'mingdy7283@gmail.com',
  'sungsoo702@gmail.com',
  'pyogobear@gmail.com'
];

function extractCorrectAnswerIndex(attempt) {
  const candidates = [
    attempt?.correctAnswer,
    attempt?.firstAttemptCorrectAnswer,
    attempt?.questionData?.correctAnswer,
    attempt?.questionData?.correctOption,
    attempt?.questionData?.correct
  ];

  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (value >= 0 && value <= 3) return Math.trunc(value);
    if (value >= 1 && value <= 4) return Math.trunc(value) - 1;
  }
  return null;
}

async function migrate() {
  console.log('📊 questionStats 마이그레이션 시작 (과목+연도 단위)...');

  // 1. 전체 attempts 읽기
  const snapshot = await db.collection('attempts').get();
  console.log(`✅ attempts ${snapshot.size}개 로드 완료`);

  // 2. 세션별 그룹핑 → 완주 세션만 필터
  const sessionGroups = {};
  const allAttempts = [];

  snapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    allAttempts.push(data);
    if (data.sessionId) {
      (sessionGroups[data.sessionId] = sessionGroups[data.sessionId] || []).push(data);
    }
  });

  const completedSessionIds = new Set();
  Object.entries(sessionGroups).forEach(([sid, list]) => {
    const isMock = list.some(a => a.questionData?.isFromMockExam === true);
    if (list.length >= (isMock ? 80 : 20)) completedSessionIds.add(sid);
  });

  const filteredAttempts = allAttempts.filter(a => !a.sessionId || completedSessionIds.has(a.sessionId));
  const attempts = filteredAttempts.filter(a => !ADMIN_EMAILS.includes(a.userEmail));
  console.log(`✅ 필터링 후: ${attempts.length}개 (완주 세션 + 관리자 제외)`);

  // 3. 과목+연도 단위로 집계
  // docs[docKey] = { certificateType, year, subject, questions: { "1": {...}, "2": {...} } }
  const docs = {};

  attempts.forEach(attempt => {
    const qData = attempt.questionData;
    if (!qData) return;

    const certType = attempt.certificateType || 'health-manager';
    const year = String(qData.year || attempt.year);
    let subject = String(qData.subject || attempt.subject);
    // 인코딩된 과목명 디코딩
    try { let d = decodeURIComponent(subject); while (d !== subject) { subject = d; d = decodeURIComponent(subject); } } catch(e) {}
    const number = String(qData.number || attempt.number);
    if (!year || !subject || !number) return;

    const docKey = `${certType}_${year}_${subject}`;

    if (!docs[docKey]) {
      docs[docKey] = {
        certificateType: certType,
        year,
        subject,
        questions: {}
      };
    }

    if (!docs[docKey].questions[number]) {
      docs[docKey].questions[number] = {
        total: 0,
        correct: 0,
        answers: { '0': 0, '1': 0, '2': 0, '3': 0 },
        correctVotes: { '0': 0, '1': 0, '2': 0, '3': 0 },
        correctAnswerIndex: null,
        totalTimeSpent: 0,
        viewedExplanationCount: 0
      };
    }

    const q = docs[docKey].questions[number];

    const isCorrect = attempt.firstAttemptIsCorrect !== undefined
      ? attempt.firstAttemptIsCorrect : attempt.isCorrect;
    const userAnswer = attempt.firstAttemptAnswer !== undefined
      ? attempt.firstAttemptAnswer : attempt.userAnswer;
    const answerIndex = Number(userAnswer);
    const correctAnswerIndex = extractCorrectAnswerIndex(attempt);

    q.total++;
    if (isCorrect) q.correct++;

    if (Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 3) {
      q.answers[String(answerIndex)]++;
      if (isCorrect) q.correctVotes[String(answerIndex)]++;
    }

    if (Number.isInteger(correctAnswerIndex) && correctAnswerIndex >= 0 && correctAnswerIndex <= 3) {
      q.correctAnswerIndex = correctAnswerIndex;
    }

    if (typeof attempt.timeSpent === 'number' && attempt.timeSpent > 0) {
      q.totalTimeSpent += attempt.timeSpent;
    }
    if (attempt.viewedExplanation === true) {
      q.viewedExplanationCount++;
    }
  });

  // 레거시 정답 추론
  Object.values(docs).forEach(docData => {
    Object.values(docData.questions).forEach(q => {
      if (Number.isInteger(q.correctAnswerIndex)) return;
      let inferredIndex = null;
      let maxVotes = 0;
      [0, 1, 2, 3].forEach(idx => {
        const votes = q.correctVotes[String(idx)] || 0;
        if (votes > maxVotes) {
          maxVotes = votes;
          inferredIndex = idx;
        }
      });
      q.correctAnswerIndex = maxVotes > 0 ? inferredIndex : null;
    });
  });

  // correctVotes 제거 (임시 데이터)
  Object.values(docs).forEach(docData => {
    Object.keys(docData.questions).forEach(num => {
      delete docData.questions[num].correctVotes;
    });
  });

  // 4. Firestore에 배치 쓰기
  const entries = Object.entries(docs);
  console.log(`📝 questionStats ${entries.length}개 문서 쓰기 시작...`);

  for (let i = 0; i < entries.length; i += 500) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + 500);

    chunk.forEach(([key, data]) => {
      batch.set(db.collection('questionStats').doc(key), {
        ...data,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`  ✅ 배치 ${Math.floor(i / 500) + 1}/${Math.ceil(entries.length / 500)} 완료 (${chunk.length}개)`);
  }

  console.log(`\n🎉 마이그레이션 완료! ${entries.length}개 questionStats 문서 생성됨`);

  // 통계 요약
  const certTypes = {};
  let totalQuestions = 0;
  entries.forEach(([, data]) => {
    const qCount = Object.keys(data.questions).length;
    certTypes[data.certificateType] = (certTypes[data.certificateType] || 0) + qCount;
    totalQuestions += qCount;
  });
  console.log(`\n📋 총 문제 수: ${totalQuestions}개`);
  console.log('📋 자격증별 문제 수:');
  Object.entries(certTypes).forEach(([cert, count]) => {
    console.log(`  - ${cert}: ${count}개`);
  });

  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
