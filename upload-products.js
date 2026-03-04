const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const products = require('./products.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function uploadProducts() {
  const batch = db.batch();
  
  products.forEach(product => {
    const docRef = db.collection('products').doc(product.id);
    const data = {
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    delete data.id;
    batch.set(docRef, data);
  });

  await batch.commit();
  console.log('✅ 5개 상품 업로드 완료!');
}

uploadProducts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 업로드 실패:', error);
    process.exit(1);
  });