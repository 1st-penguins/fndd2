/**
 * temp_* ID 오답 데이터 Firestore 정리 스크립트
 *
 * 사용법: 브라우저 콘솔에서 실행 (the1stpeng.com에 관리자 로그인 상태에서)
 *
 * 1. the1stpeng.com에 관리자 계정으로 로그인
 * 2. 개발자 도구 (F12) → Console 탭
 * 3. 아래 코드를 붙여넣기하고 실행
 *
 * 주의: 이 스크립트는 1회성 정리용입니다. 실행 후 삭제해도 됩니다.
 */

// === 브라우저 콘솔에 붙여넣을 코드 ===

(async function cleanupTempWrongAnswers() {
  // Firebase 모듈 로드
  const { db, auth, ensureFirebase } = await import('/js/core/firebase-core.js');
  const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

  await ensureFirebase();

  // 관리자 확인
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ 로그인이 필요합니다.');
    return;
  }

  const ADMIN_EMAILS = ['kspo0324@gmail.com', 'mingdy7283@gmail.com', 'sungsoo702@gmail.com'];
  if (!ADMIN_EMAILS.includes(user.email)) {
    console.error('❌ 관리자 계정으로 로그인해야 합니다.');
    return;
  }

  console.log('🔍 wrong_answers 컬렉션에서 temp_* 문서 검색 중...');

  // 전체 wrong_answers 컬렉션 조회
  const snapshot = await getDocs(collection(db, 'wrong_answers'));
  const tempDocs = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const questionId = data.questionId || '';
    if (questionId.startsWith('temp_')) {
      tempDocs.push({
        id: docSnap.id,
        questionId: questionId,
        certType: data.certType || 'unknown',
        incorrectCount: data.incorrectCount || 0
      });
    }
  });

  console.log(`📊 전체 문서: ${snapshot.size}개, temp_* 문서: ${tempDocs.length}개`);

  if (tempDocs.length === 0) {
    console.log('✅ temp_* 문서가 없습니다. 정리할 것이 없습니다.');
    return;
  }

  // temp_* 문서 목록 출력
  console.table(tempDocs);

  // 삭제 확인
  const confirmed = confirm(`temp_* 문서 ${tempDocs.length}개를 삭제하시겠습니까?`);
  if (!confirmed) {
    console.log('⏹️ 삭제 취소됨.');
    return;
  }

  // 삭제 실행
  let deletedCount = 0;
  for (const tempDoc of tempDocs) {
    try {
      await deleteDoc(doc(db, 'wrong_answers', tempDoc.id));
      deletedCount++;
    } catch (err) {
      console.error(`❌ 삭제 실패: ${tempDoc.id}`, err);
    }
  }

  console.log(`✅ 완료: ${deletedCount}/${tempDocs.length}개 temp_* 문서 삭제됨.`);
})();
