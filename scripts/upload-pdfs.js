const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'first-penguins-new.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const db = admin.firestore();

// PDF 파일 → Firestore 상품 ID 매핑
const pdfMap = {
  'physio-summary.pdf': 'pdf_physio',
  'patho-summary.pdf': 'pdf_patho',
  'anatomy-summary.pdf': 'pdf_anatomy',
  'prescript-summary.pdf': 'pdf_prescript',
  'load-summary.pdf': 'pdf_load',
  'injury-summary.pdf': 'pdf_injury',
  'psycho-summary.pdf': 'pdf_psycho',
  'health-summary.pdf': 'pdf_health',
};

const pdfDir = 'C:/Users/sapsk/Desktop/건운사 필기자료';

async function uploadAndLink() {
  console.log('🚀 PDF 업로드 시작...\n');

  for (const [fileName, productId] of Object.entries(pdfMap)) {
    const filePath = path.join(pdfDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ 파일 없음: ${fileName}`);
      continue;
    }

    const fileSize = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1) + 'MB';

    try {
      // 1. Firebase Storage 업로드
      const storagePath = `products/${fileName}`;
      await bucket.upload(filePath, {
        destination: storagePath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            firebaseStorageDownloadTokens: require('crypto').randomUUID()
          }
        }
      });

      // 2. 다운로드 URL 생성
      const file = bucket.file(storagePath);
      const [metadata] = await file.getMetadata();
      const token = metadata.metadata.firebaseStorageDownloadTokens;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

      // 3. Firestore 상품에 fileUrl + fileSize 업데이트
      await db.collection('products').doc(productId).update({
        fileUrl: downloadUrl,
        fileSize: fileSize
      });

      console.log(`✅ ${fileName} → ${productId} (${fileSize})`);
    } catch (error) {
      console.error(`❌ ${fileName}: ${error.message}`);
    }
  }

  console.log('\n🎉 완료!');
  process.exit(0);
}

uploadAndLink();
