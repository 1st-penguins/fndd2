const admin = require('firebase-admin');
const fs = require('fs');
const crypto = require('crypto');

const serviceAccount = require('../serviceaccountkey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'first-penguins-new.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const db = admin.firestore();

const localPath = 'C:/Users/Pc/Downloads/ethics-summary.pdf';
const storagePath = 'products/si2-ethics-summary.pdf';
const productId = 'pdf_si2_package';
const bundleKey = 'si2-ethics';

async function run() {
  if (!fs.existsSync(localPath)) {
    console.error('❌ 파일 없음:', localPath);
    process.exit(1);
  }

  const fileSize = (fs.statSync(localPath).size / 1024 / 1024).toFixed(1) + 'MB';
  const token = crypto.randomUUID();

  console.log(`⬆️  업로드: ${localPath} → ${storagePath} (${fileSize})`);

  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType: 'application/pdf',
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });

  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  console.log('🔗', downloadUrl);

  // Firestore products 문서의 bundleFiles 갱신
  const ref = db.collection('products').doc(productId);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data();
    const bundleFiles = (data.bundleFiles || []).map(f =>
      f.key === bundleKey ? { ...f, fileUrl: downloadUrl, fileSize } : f
    );
    await ref.update({ bundleFiles });
    console.log('✅ Firestore 업데이트 완료');
  } else {
    console.log('⚠️  Firestore 문서 없음, products.json만 수동 업데이트');
  }

  console.log('\n📝 data/products.json / seed-firestore.js 수동 업데이트 필요:');
  console.log('  fileUrl:', downloadUrl);
  console.log('  fileSize:', fileSize);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
