const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

/**
 * Toss Payments 결제 확인 Cloud Function
 *
 * 클라이언트에서 paymentKey, orderId, amount를 받아
 * Toss API로 결제 승인 요청 후 Firestore에 구매 기록 저장
 */
exports.confirmPayment = functions.region("asia-northeast3").runWith({ minInstances: 0 }).https.onCall(async (data, context) => {
  // 1. 인증 확인
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const uid = context.auth.uid;
  const { paymentKey, orderId, amount, productId, productType, couponId, discountAmount } = data;

  // 2. 필수 파라미터 확인
  if (!paymentKey || !orderId || !amount || !productId) {
    throw new functions.https.HttpsError("invalid-argument", "필수 결제 정보가 누락되었습니다.");
  }

  // 3. 중복 결제 방지 — 이미 구매 기록이 있는지 확인
  const purchaseId = `${uid}_${productId}`;
  const existingPurchase = await db.collection("purchases").doc(purchaseId).get();
  if (existingPurchase.exists && existingPurchase.data().status === "completed") {
    return { success: true, message: "이미 구매된 상품입니다.", alreadyPurchased: true };
  }

  // 4. 상품 가격 서버 검증
  const productDoc = await db.collection("products").doc(productId).get();
  if (!productDoc.exists) {
    throw new functions.https.HttpsError("not-found", "존재하지 않는 상품입니다.");
  }

  const product = productDoc.data();
  let expectedAmount = product.price;

  // 쿠폰 할인 검증
  if (couponId && discountAmount > 0) {
    const couponDoc = await db.collection("coupons").doc(couponId).get();
    if (couponDoc.exists) {
      const coupon = couponDoc.data();
      const now = new Date();
      const startDate = coupon.startDate.toDate();
      const endDate = coupon.endDate.toDate();

      // 쿠폰 유효성 검증
      if (now < startDate || now > endDate) {
        throw new functions.https.HttpsError("invalid-argument", "만료된 쿠폰입니다.");
      }

      // 전체 사용 횟수 확인
      if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) {
        throw new functions.https.HttpsError("invalid-argument", "쿠폰 사용 한도가 초과되었습니다.");
      }

      // 1인당 사용 횟수 확인
      if (coupon.maxUsesPerUser > 0) {
        const userUsageSnap = await db.collection("couponUsage")
          .where("userId", "==", uid)
          .where("couponId", "==", couponId)
          .get();
        if (userUsageSnap.size >= coupon.maxUsesPerUser) {
          throw new functions.https.HttpsError("invalid-argument", "이미 사용한 쿠폰입니다.");
        }
      }

      // 적용 상품 확인
      if (!coupon.applicableProducts.includes("all") && !coupon.applicableProducts.includes(productId)) {
        throw new functions.https.HttpsError("invalid-argument", "이 상품에 사용할 수 없는 쿠폰입니다.");
      }

      let validDiscount = 0;
      if (coupon.discountType === "percent") {
        validDiscount = Math.floor(product.price * (coupon.discountValue / 100));
        if (coupon.maxDiscount > 0 && validDiscount > coupon.maxDiscount) {
          validDiscount = coupon.maxDiscount;
        }
      } else {
        validDiscount = coupon.discountValue;
      }
      if (validDiscount > product.price) validDiscount = product.price;

      // 클라이언트가 보낸 할인 금액이 서버 계산과 일치하는지 확인
      if (discountAmount <= validDiscount) {
        expectedAmount = product.price - discountAmount;
      } else {
        throw new functions.https.HttpsError("invalid-argument", "할인 금액이 올바르지 않습니다.");
      }
    }
  }

  // 금액 검증
  if (amount !== expectedAmount) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `결제 금액이 일치하지 않습니다. (요청: ${amount}원, 예상: ${expectedAmount}원)`
    );
  }

  // 5. Toss Payments 결제 승인 API 호출
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new functions.https.HttpsError("internal", "결제 시스템 설정 오류입니다. 관리자에게 문의하세요.");
  }

  const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");

  let tossResponse;
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    tossResponse = await res.json();

    if (!res.ok) {
      console.error("Toss 결제 승인 실패:", tossResponse);
      throw new functions.https.HttpsError(
        "aborted",
        tossResponse.message || "결제 승인에 실패했습니다."
      );
    }
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("Toss API 호출 오류:", error);
    throw new functions.https.HttpsError("internal", "결제 승인 중 오류가 발생했습니다.");
  }

  // 6. Firestore에 구매 기록 저장
  const userRecord = await admin.auth().getUser(uid);

  await db.collection("purchases").doc(purchaseId).set({
    userId: uid,
    userName: userRecord.displayName || userRecord.email || null,
    userEmail: userRecord.email || null,
    productId: productId,
    productType: productType || product.type || "video",
    orderId: orderId,
    paymentKey: paymentKey,
    purchaseAmount: product.price,
    discountAmount: discountAmount || 0,
    finalAmount: amount,
    couponId: couponId || null,
    paymentMethod: tossResponse.method || null,
    purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "completed",
    expiresAt: (productType || product.type) === "video"
      ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000))
      : null,
    tossTransactionKey: tossResponse.transactionKey || null,
  });

  // 7. 쿠폰 사용 처리
  if (couponId && discountAmount > 0) {
    await db.collection("couponUsage").add({
      couponId: couponId,
      userId: uid,
      userName: userRecord.displayName || null,
      userEmail: userRecord.email || null,
      orderId: orderId,
      productId: productId,
      discountAmount: discountAmount,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("coupons").doc(couponId).update({
      usedCount: admin.firestore.FieldValue.increment(1),
    });
  }

  console.log(`✅ 결제 완료: ${uid} → ${productId} (${amount}원)`);

  return {
    success: true,
    orderId: orderId,
    productId: productId,
    amount: amount,
  };
});
