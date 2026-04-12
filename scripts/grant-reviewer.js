/**
 * 리뷰어 권한 부여 스크립트
 *
 * 사용법:
 *   node scripts/grant-reviewer.js <email>
 *   node scripts/grant-reviewer.js <email> --include=pdf,video
 *   node scripts/grant-reviewer.js <email> --exclude=pdf_001,pdf_002
 *   node scripts/grant-reviewer.js <email> --dry-run
 *
 * 기본 동작:
 * - products 컬렉션에서 isActive !== false 인 모든 상품 조회
 * - 대상 사용자를 Firebase Auth에서 조회 (없으면 에러)
 * - purchases 컬렉션에 0원 / "리뷰어 제공" / completed 로 일괄 등록
 * - 이미 존재하는 구매 문서는 스킵
 */

const path = require('path');
const admin = require('firebase-admin');
const sa = require(path.resolve(__dirname, '../serviceaccountkey.json'));

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const includeArg = args.find(a => a.startsWith('--include='));
const excludeArg = args.find(a => a.startsWith('--exclude='));
const includeTypes = includeArg ? includeArg.split('=')[1].split(',') : null;
const excludeIds = excludeArg ? excludeArg.split('=')[1].split(',') : [];

if (!email) {
  console.error('사용법: node scripts/grant-reviewer.js <email> [--include=pdf,video] [--exclude=id1,id2] [--dry-run]');
  process.exit(1);
}

(async () => {
  // 1) Firebase Auth에서 사용자 조회
  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (e) {
    console.error(`❌ Firebase Auth에 ${email} 없음. 사용자가 먼저 사이트에 가입해야 합니다.`);
    process.exit(1);
  }
  console.log(`👤 대상: ${authUser.displayName || '(이름 없음)'} | uid=${authUser.uid} | email=${email}`);

  // 2) 전체 상품 조회
  const productsSnap = await db.collection('products').get();
  let products = [];
  productsSnap.forEach(d => {
    const p = { id: d.id, ...d.data() };
    if (p.isActive === false) return;
    if (excludeIds.includes(p.id)) return;
    if (includeTypes && !includeTypes.includes(p.type)) return;
    products.push(p);
  });
  console.log(`\n📦 등록 대상 상품: ${products.length}개`);

  if (dryRun) {
    products.forEach(p => console.log(`  [DRY] ${p.id} (${p.type || '-'}) ${p.title || p.name || ''}`));
    console.log('\n--dry-run: 실제 등록 안 함');
    process.exit(0);
  }

  // 3) 일괄 등록
  const now = admin.firestore.FieldValue.serverTimestamp();
  let added = 0, skipped = 0;
  const batch = db.batch();

  for (const p of products) {
    const docId = `${authUser.uid}_${p.id}`;
    const ref = db.collection('purchases').doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`SKIP ${p.id} (이미 등록됨)`);
      skipped++;
      continue;
    }
    batch.set(ref, {
      userId: authUser.uid,
      userEmail: email,
      userName: authUser.displayName || '',
      productId: p.id,
      productType: p.type || (p.id.startsWith('pdf') ? 'pdf' : 'video'),
      purchaseAmount: 0,
      finalAmount: 0,
      discountAmount: 0,
      paymentMethod: '리뷰어 제공',
      status: 'completed',
      orderId: `reviewer_${authUser.uid}_${p.id}`,
      purchasedAt: now,
    });
    added++;
    console.log(`ADD ${p.id}`);
  }

  if (added > 0) await batch.commit();
  console.log(`\n✅ 완료: 추가 ${added}건 / 스킵 ${skipped}건`);
  process.exit(0);
})();
