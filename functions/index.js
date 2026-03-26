const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ============================================
// 📩 1:1 문의 텔레그램 알림
// ============================================
const TELEGRAM_BOT_TOKEN = "8766322797:AAHX08TXs0YamolCrAlOHfAMCtE1Dje10UA";
const TELEGRAM_CHAT_ID = "-5261185105";

const CATEGORY_LABELS = {
  "payment": "결제/환불",
  "lecture": "강의 문의",
  "question-error": "문제 오류",
  "suggestion": "건의사항",
  "etc": "기타"
};

// 텔레그램 메시지 전송 헬퍼
async function sendTelegram(text, replyToMessageId) {
  const body = { chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 새 문의 → 텔레그램 알림 (문의 ID 포함)
exports.onNewInquiry = functions.region("asia-northeast3").firestore
  .document("inquiries/{inquiryId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const inquiryId = context.params.inquiryId;
    const category = CATEGORY_LABELS[data.category] || data.category;
    const content = data.content.length > 200 ? data.content.substring(0, 200) + "..." : data.content;
    const text = `📩 *새 문의 접수*\n\n` +
      `*[${category}]* ${data.title}\n` +
      `작성자: ${data.userName || data.userEmail}\n\n` +
      `${content}\n\n` +
      `💬 이 메시지에 답장하면 자동으로 답변이 등록됩니다.\n` +
      `ID: ${inquiryId}`;

    try {
      const result = await sendTelegram(text);
      // 봇 메시지 ID를 Firestore에 저장 (답장 매칭용)
      if (result.ok && result.result) {
        await snap.ref.update({ telegramMessageId: result.result.message_id });
      }
      if (!result.ok) console.error("텔레그램 전송 실패:", result);
    } catch (err) {
      console.error("텔레그램 알림 오류:", err);
    }
  });

// Firestore에 답변 저장 헬퍼
async function saveReply(docRef, docData, replyText, replierName, messageId) {
  await docRef.update({
    adminReply: replyText,
    adminReplyAt: admin.firestore.FieldValue.serverTimestamp(),
    adminEmail: replierName,
    status: "answered",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await sendTelegram(`✅ 답변이 등록되었습니다. (${docData.title})`, messageId);
}

// 텔레그램 웹훅 — 관리자 답변 감지 → Firestore에 답변 저장
exports.telegramWebhook = functions.region("asia-northeast3").https.onRequest(async (req, res) => {
  if (req.method !== "POST") { res.status(200).send("OK"); return; }

  const message = req.body.message;
  if (!message || !message.text) { res.status(200).send("OK"); return; }

  const text = message.text;
  const replierName = `${message.from.first_name || ""} ${message.from.last_name || ""}`.trim();

  try {
    // 방법 1: "(답변) 내용" → 가장 최근 대기중 문의에 답변
    const answerMatch = text.match(/^\(답변\)\s*(.+)/s);
    if (answerMatch) {
      const replyText = answerMatch[1].trim();
      if (!replyText) { res.status(200).send("OK"); return; }

      const snapshot = await db.collection("inquiries")
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (snapshot.empty) {
        await sendTelegram("⚠️ 대기중인 문의가 없습니다.", message.message_id);
        res.status(200).send("OK");
        return;
      }

      const doc = snapshot.docs[0];
      await saveReply(doc.ref, doc.data(), replyText, replierName, message.message_id);
      res.status(200).send("OK");
      return;
    }

    // 방법 2: 봇 메시지에 답장 → 해당 문의에 답변
    if (message.reply_to_message && message.reply_to_message.from?.is_bot) {
      const originalText = message.reply_to_message.text || "";

      // 원본 메시지에서 문의 ID 추출
      const idMatch = originalText.match(/ID:\s*(.+?)$/m);
      let docRef, docSnap;

      if (idMatch) {
        docRef = db.collection("inquiries").doc(idMatch[1]);
        docSnap = await docRef.get();
      }

      // ID로 못 찾으면 telegramMessageId로 검색
      if (!docSnap || !docSnap.exists) {
        const originalMsgId = message.reply_to_message.message_id;
        const snapshot = await db.collection("inquiries")
          .where("telegramMessageId", "==", originalMsgId)
          .limit(1)
          .get();

        if (snapshot.empty) {
          await sendTelegram("⚠️ 문의를 찾을 수 없습니다.", message.message_id);
          res.status(200).send("OK");
          return;
        }
        docRef = snapshot.docs[0].ref;
        docSnap = snapshot.docs[0];
      }

      await saveReply(docRef, docSnap.data ? docSnap.data() : docSnap, text, replierName, message.message_id);
      res.status(200).send("OK");
      return;
    }
  } catch (err) {
    console.error("답변 저장 오류:", err);
    await sendTelegram("❌ 답변 저장에 실패했습니다.", message.message_id);
  }

  res.status(200).send("OK");
});

// ============================================
// 📊 일일 사이트 통계 API (Apps Script에서 호출)
// ============================================
exports.dailyStats = functions.region("asia-northeast3").https.onRequest(async (req, res) => {
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    // 오늘 방문자 수 (visits 컬렉션, dateKey 기준)
    const visitsSnap = await db.collection("visits")
      .where("dateKey", "==", todayKey)
      .get();

    // 고유 방문자 수 (visitorId 기준 중복 제거)
    const uniqueVisitors = new Set();
    visitsSnap.forEach(doc => {
      const data = doc.data();
      uniqueVisitors.add(data.visitorId || data.userId || doc.id);
    });

    // 오늘 문제풀이 수 (attempts 컬렉션)
    const todayStart = new Date(yyyy, now.getMonth(), now.getDate());
    const todayEnd = new Date(yyyy, now.getMonth(), now.getDate(), 23, 59, 59);
    const attemptsSnap = await db.collection("attempts")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(todayStart))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(todayEnd))
      .get();

    // 오늘 문제풀이 고유 사용자 수
    const uniqueSolvers = new Set();
    attemptsSnap.forEach(doc => {
      const data = doc.data();
      if (data.userId) uniqueSolvers.add(data.userId);
    });

    // 미답변 문의 수
    const pendingSnap = await db.collection("inquiries")
      .where("status", "==", "pending")
      .get();

    // 전체 회원 수
    const usersResult = await admin.auth().listUsers(1);
    // listUsers는 페이지네이션이라 전체 수를 빠르게 못 가져옴
    // 대신 attempts의 고유 userId로 활성 사용자 추정

    res.json({
      date: todayKey,
      visitors: uniqueVisitors.size,
      pageViews: visitsSnap.size,
      attempts: attemptsSnap.size,
      solvers: uniqueSolvers.size,
      pendingInquiries: pendingSnap.size,
    });
  } catch (err) {
    console.error("일일 통계 오류:", err);
    res.status(500).json({ error: err.message });
  }
});

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
