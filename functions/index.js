const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ============================================
// 📩 1:1 문의 텔레그램 알림
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-5261185105";

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
exports.onNewInquiry = functions.region("asia-northeast3")
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .firestore
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

// 새 리뷰 → 텔레그램 알림
exports.onNewReview = functions.region("asia-northeast3")
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .firestore
  .document("reviews/{reviewId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    // 상품명 조회
    let productName = data.productId;
    try {
      const productDoc = await db.collection("products").doc(data.productId).get();
      if (productDoc.exists) {
        productName = productDoc.data().title || productDoc.data().name || data.productId;
      }
    } catch (e) { /* fallback to productId */ }
    const stars = "★".repeat(data.rating) + "☆".repeat(5 - data.rating);
    const content = data.content.length > 100 ? data.content.substring(0, 100) + "..." : data.content;
    const images = data.images && data.images.length ? `\n📷 사진 ${data.images.length}장` : "";
    const text = `⭐ *새 후기 등록*\n\n` +
      `📦 ${productName}\n` +
      `${stars} (${data.rating}점)\n` +
      `👤 ${data.authorRaw || data.author}\n\n` +
      `${content}${images}`;

    try {
      await sendTelegram(text);
    } catch (err) {
      console.warn("리뷰 텔레그램 알림 실패:", err.message);
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
exports.telegramWebhook = functions.region("asia-northeast3")
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .https.onRequest(async (req, res) => {
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
    // 한국 시간(KST, UTC+9) 기준으로 날짜 계산
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    // 오늘 방문자 수 (daily_visits 컬렉션 — 관리자 대시보드와 동일 소스)
    const dailyDoc = await db.collection("daily_visits").doc(todayKey).get();
    const users = dailyDoc.exists ? (dailyDoc.data().users || {}) : {};
    const visitorCount = Object.keys(users).length;

    // 오늘 문제풀이 수 (attempts 컬렉션, KST 기준)
    const todayStart = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate()) - 9 * 60 * 60 * 1000);
    const todayEnd = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59) - 9 * 60 * 60 * 1000);
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

    // 매출 집계 — 홈페이지 (purchases 컬렉션, status=completed, 리틀리 이전 제외)
    const allPurchases = await db.collection("purchases")
      .where("status", "==", "completed")
      .get();

    let totalHomepageRevenue = 0;
    let todayHomepageRevenue = 0;
    let todayPurchaseCount = 0;
    let todayPurchases = [];

    allPurchases.forEach(doc => {
      const d = doc.data();
      if (d.paymentMethod === "리틀리 이전") return;
      const amount = d.finalAmount != null ? d.finalAmount : (d.purchaseAmount || 0);
      if (amount <= 0) return;
      totalHomepageRevenue += amount;

      // 오늘 구매 확인
      if (d.purchasedAt) {
        const purchaseDate = d.purchasedAt.toDate();
        const pKST = new Date(purchaseDate.getTime() + 9 * 60 * 60 * 1000);
        const pKey = `${pKST.getUTCFullYear()}-${String(pKST.getUTCMonth()+1).padStart(2,"0")}-${String(pKST.getUTCDate()).padStart(2,"0")}`;
        if (pKey === todayKey) {
          todayHomepageRevenue += amount;
          todayPurchaseCount++;
          todayPurchases.push({
            name: d.userName || d.userEmail || "알 수 없음",
            productId: d.productId,
            product: d.productId,
            amount,
          });
        }
      }
    });

    // productId → 상품명 매핑 (products 컬렉션 조회)
    const uniqueProductIds = [...new Set(todayPurchases.map(p => p.productId).filter(Boolean))];
    if (uniqueProductIds.length > 0) {
      const productDocs = await Promise.all(
        uniqueProductIds.map(pid => db.collection("products").doc(pid).get())
      );
      const nameMap = {};
      productDocs.forEach((snap, i) => {
        if (snap.exists) {
          const pd = snap.data();
          nameMap[uniqueProductIds[i]] = pd.title || pd.name || uniqueProductIds[i];
        }
      });
      todayPurchases = todayPurchases.map(p => ({
        ...p,
        product: nameMap[p.productId] || p.productId,
      }));
    }

    // 리틀리 누적 정산금 (고정값, 2026-04-09 기준)
    const littlyTotalRevenue = 22287000;

    res.json({
      date: todayKey,
      visitors: visitorCount,
      attempts: attemptsSnap.size,
      solvers: uniqueSolvers.size,
      pendingInquiries: pendingSnap.size,
      revenue: {
        littlyTotal: littlyTotalRevenue,
        homepageTotal: totalHomepageRevenue,
        grandTotal: littlyTotalRevenue + totalHomepageRevenue,
        todayHomepage: todayHomepageRevenue,
        todayPurchaseCount,
        todayPurchases,
      },
    });
  } catch (err) {
    console.error("일일 통계 오류:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 📊 자격증별 일일 이용자 집계 + 문제별 통계 증분 업데이트
// ============================================

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

exports.onNewAttempt = functions.region("asia-northeast3").firestore
  .document("attempts/{attemptId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const certType = data.certificateType;
    const userId = data.userId;
    if (!certType || !userId) return;

    // KST 기준 날짜
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dateKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    // 1) certDailyUsers 업데이트
    const docRef = db.collection("certDailyUsers").doc(dateKey);
    try {
      await docRef.update({ [`${certType}.${userId}`]: true });
    } catch (e) {
      await docRef.set({ [certType]: { [userId]: true } });
    }

    // 2) questionStats 증분 업데이트 (관리자 데이터 제외)
    if (ADMIN_EMAILS.includes(data.userEmail)) return;

    const qData = data.questionData;
    if (!qData) return;

    const sessionId = data.sessionId;
    if (!sessionId) return; // sessionId 없는 레거시 데이터는 마이그레이션에서 처리됨

    // 세션 완주 확인: 같은 sessionId의 attempt 수 조회
    const isMockExam = qData.isFromMockExam === true;
    const requiredCount = isMockExam ? 80 : 20;

    const sessionSnap = await db.collection("attempts")
      .where("sessionId", "==", sessionId)
      .select()  // 문서 내용 없이 카운트만
      .get();

    if (sessionSnap.size < requiredCount) return; // 미완주 세션 → 스킵

    // 세션이 방금 완주됨 (정확히 requiredCount에 도달한 시점)
    // → 이 세션의 모든 attempt를 과목+연도 단위로 묶어서 집계
    if (sessionSnap.size === requiredCount) {
      const sessionAttempts = await db.collection("attempts")
        .where("sessionId", "==", sessionId)
        .get();

      // 1단계: 과목별 점수 사전 계산 (25% 미만 찍기 필터용)
      const subjectScores = {}; // subjectKey → { correct, total }
      sessionAttempts.forEach(attemptDoc => {
        const attempt = attemptDoc.data();
        if (ADMIN_EMAILS.includes(attempt.userEmail)) return;
        const aQData = attempt.questionData;
        if (!aQData) return;
        let aSubject = String(aQData.subject || attempt.subject);
        try { aSubject = decodeURIComponent(aSubject); } catch(e) {}
        const aIsCorrect = attempt.firstAttemptIsCorrect !== undefined
          ? attempt.firstAttemptIsCorrect : attempt.isCorrect;
        if (!subjectScores[aSubject]) subjectScores[aSubject] = { correct: 0, total: 0 };
        subjectScores[aSubject].total++;
        if (aIsCorrect) subjectScores[aSubject].correct++;
      });

      // 25% 미만 과목 필터 (찍기 수준)
      const lowScoreSubjects = new Set();
      Object.entries(subjectScores).forEach(([subj, s]) => {
        if (s.total > 0 && (s.correct / s.total) < 0.25) {
          lowScoreSubjects.add(subj);
        }
      });

      // 2단계: 유효한 과목만 집계
      const docUpdates = {}; // docKey → payload 객체

      sessionAttempts.forEach(attemptDoc => {
        const attempt = attemptDoc.data();
        if (ADMIN_EMAILS.includes(attempt.userEmail)) return;

        const aQData = attempt.questionData;
        if (!aQData) return;

        const aYear = String(aQData.year || attempt.year);
        let aSubject = String(aQData.subject || attempt.subject);
        try { aSubject = decodeURIComponent(aSubject); } catch(e) {}
        const aNumber = String(aQData.number || attempt.number);
        const aCertType = attempt.certificateType || 'health-manager';
        if (!aYear || !aSubject || !aNumber) return;

        // 과목별 25% 미만 필터
        if (lowScoreSubjects.has(aSubject)) return;

        const docKey = `${aCertType}_${aYear}_${aSubject}`;

        if (!docUpdates[docKey]) {
          docUpdates[docKey] = {
            certificateType: aCertType,
            year: aYear,
            subject: aSubject,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
        }

        const aIsCorrect = attempt.firstAttemptIsCorrect !== undefined
          ? attempt.firstAttemptIsCorrect : attempt.isCorrect;
        const aUserAnswer = attempt.firstAttemptAnswer !== undefined
          ? attempt.firstAttemptAnswer : attempt.userAnswer;
        const aAnswerIndex = Number(aUserAnswer);
        const aCorrectIndex = extractCorrectAnswerIndex(attempt);

        const p = docUpdates[docKey];

        // quiz/mock 분리 카운터
        const aIsMock = aQData.isFromMockExam === true;
        const mode = aIsMock ? 'mock' : 'quiz';

        if (!p._counters) p._counters = {};
        const counterKey = `${aNumber}_${mode}`;
        if (!p._counters[counterKey]) {
          p._counters[counterKey] = {
            number: aNumber, mode,
            total: 0, correct: 0,
            answers: { '0': 0, '1': 0, '2': 0, '3': 0 },
            correctAnswerIndex: null
          };
        }

        const c = p._counters[counterKey];
        c.total++;
        if (aIsCorrect) c.correct++;

        if (Number.isInteger(aAnswerIndex) && aAnswerIndex >= 0 && aAnswerIndex <= 3) {
          c.answers[String(aAnswerIndex)]++;
        }

        if (Number.isInteger(aCorrectIndex) && aCorrectIndex >= 0 && aCorrectIndex <= 3) {
          c.correctAnswerIndex = aCorrectIndex;
        }
      });

      // 카운터를 FieldValue.increment로 변환 후 배치 쓰기
      const batch = db.batch();

      Object.entries(docUpdates).forEach(([docKey, payload]) => {
        const counters = payload._counters || {};
        delete payload._counters;
        // 임시 increment 필드 제거
        Object.keys(payload).forEach(k => {
          if (k.startsWith('questions.')) delete payload[k];
        });

        Object.entries(counters).forEach(([counterKey, c]) => {
          const qp = `questions.${c.number}.${c.mode}`;
          payload[`${qp}.total`] = admin.firestore.FieldValue.increment(c.total);
          payload[`${qp}.correct`] = admin.firestore.FieldValue.increment(c.correct);
          payload[`${qp}.answers.0`] = admin.firestore.FieldValue.increment(c.answers['0']);
          payload[`${qp}.answers.1`] = admin.firestore.FieldValue.increment(c.answers['1']);
          payload[`${qp}.answers.2`] = admin.firestore.FieldValue.increment(c.answers['2']);
          payload[`${qp}.answers.3`] = admin.firestore.FieldValue.increment(c.answers['3']);
          if (Number.isInteger(c.correctAnswerIndex)) {
            payload[`questions.${c.number}.correctAnswerIndex`] = c.correctAnswerIndex;
          }
        });

        const qRef = db.collection("questionStats").doc(docKey);
        batch.set(qRef, payload, { merge: true });
      });

      await batch.commit();
    }
    // sessionSnap.size > requiredCount → 이미 집계됨, 스킵
  });

/**
 * Toss Payments 결제 확인 Cloud Function
 *
 * 클라이언트에서 paymentKey, orderId, amount를 받아
 * Toss API로 결제 승인 요청 후 Firestore에 구매 기록 저장
 */
exports.confirmPayment = functions.region("asia-northeast3").runWith({ minInstances: 0, secrets: ["TOSS_SECRET_KEY", "TELEGRAM_BOT_TOKEN"] }).https.onCall(async (data, context) => {
  // 0. 워밍업 요청 — 콜드 스타트 방지용, 즉시 반환
  if (data.warmup) {
    return { success: true, warmup: true };
  }

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
  const secretKey = (process.env.TOSS_SECRET_KEY || "").trim();
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
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)),
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

  // 텔레그램 구매 알림
  const productName = product.title || product.name || productId;
  const pType = productType || product.type;
  const typeLabel = pType === 'video' ? '강의' : (pType === 'bundle' ? '강의+자료' : '자료(PDF)');
  const userName = userRecord.displayName || userRecord.email || '알 수 없음';
  const purchaseMsg = `💰 *홈페이지 새 구매!*\n\n` +
    `👤 ${userName}\n` +
    `📦 ${productName} (${typeLabel})\n` +
    `💳 ${amount.toLocaleString()}원${discountAmount > 0 ? ` (할인 ${discountAmount.toLocaleString()}원)` : ''}\n` +
    `🔖 주문번호: ${orderId}`;

  try {
    await sendTelegram(purchaseMsg);
  } catch (e) {
    console.warn("구매 텔레그램 알림 실패:", e.message);
  }

  return {
    success: true,
    orderId: orderId,
    productId: productId,
    amount: amount,
  };
});

// ============================================
// 🗑️ 회원 탈퇴 — Auth 삭제 + Firestore 정리
// ============================================
exports.deleteAccount = functions.region("asia-northeast3")
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email || "알 수 없음";
    const displayName = context.auth.token.name || email;

    // Firestore 관련 데이터 삭제 (userId 필드 기반 컬렉션)
    const collectionsToClean = [
      "wrong_answers", "bookmarks", "sessions", "quizSessions",
      "attempts", "mockExamResults", "lectureProgress",
      "pdfDownloads", "couponUsage", "inquiries"
    ];

    // 전부 병렬 실행
    const deletedCounts = {};
    await Promise.all([
      ...collectionsToClean.map(async (col) => {
        try {
          const snap = await db.collection(col).where("userId", "==", uid).get();
          if (!snap.empty) {
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            deletedCounts[col] = snap.size;
          }
        } catch (e) { console.warn(`[deleteAccount] ${col} 정리 실패:`, e.message); }
      }),
      ...["users", "userProgress", "userStatistics"].map(async (col) => {
        try {
          const ref = db.collection(col).doc(uid);
          const snap = await ref.get();
          if (snap.exists) { await ref.delete(); deletedCounts[col] = 1; }
        } catch (e) { console.warn(`[deleteAccount] ${col}/${uid} 삭제 실패:`, e.message); }
      })
    ]);

    // deletedUsers 기록 (탈퇴 집계용)
    await db.collection("deletedUsers").add({
      uid,
      email,
      displayName,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedCounts,
    });

    // Firebase Auth 삭제
    await admin.auth().deleteUser(uid);

    // 텔레그램 알림
    try {
      const msg = `🗑️ *회원 탈퇴*\n\n👤 ${displayName}\n📧 ${email}\n📊 삭제: ${JSON.stringify(deletedCounts)}`;
      await sendTelegram(msg);
    } catch (e) {
      console.warn("[deleteAccount] 텔레그램 알림 실패:", e.message);
    }

    return { success: true };
  });

// ============================================
// 💳 Toss Payments 웹훅 — 결제 취소 자동 처리
// ============================================
exports.tossWebhook = functions.region("asia-northeast3").runWith({ minInstances: 0, secrets: ["TOSS_SECRET_KEY", "TELEGRAM_BOT_TOKEN"] }).https.onRequest(async (req, res) => {
  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { eventType, data } = req.body;

    console.log(`[Toss Webhook] eventType: ${eventType}`);

    // 결제 상태 변경 이벤트만 처리
    if (eventType !== "PAYMENT_STATUS_CHANGED") {
      return res.status(200).json({ success: true, message: "이벤트 무시" });
    }

    const { paymentKey, orderId, status } = data || {};

    if (!paymentKey || !orderId) {
      console.warn("[Toss Webhook] paymentKey 또는 orderId 누락");
      return res.status(400).json({ success: false, message: "필수 데이터 누락" });
    }

    // 취소 상태인 경우만 처리
    if (status !== "CANCELED" && status !== "PARTIAL_CANCELED") {
      console.log(`[Toss Webhook] 상태 ${status} — 처리 불필요`);
      return res.status(200).json({ success: true, message: "취소 아닌 상태, 무시" });
    }

    // Toss API로 결제 정보 조회하여 검증
    const secretKey = (process.env.TOSS_SECRET_KEY || "").trim();
    if (!secretKey) {
      console.error("[Toss Webhook] TOSS_SECRET_KEY 미설정");
      return res.status(500).json({ success: false, message: "서버 설정 오류" });
    }

    const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");
    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
      method: "GET",
      headers: { "Authorization": authHeader },
    });

    if (!tossRes.ok) {
      console.error("[Toss Webhook] Toss API 조회 실패:", await tossRes.text());
      return res.status(500).json({ success: false, message: "Toss 결제 조회 실패" });
    }

    const payment = await tossRes.json();

    // 실제로 취소된 건인지 재확인
    if (payment.status !== "CANCELED" && payment.status !== "PARTIAL_CANCELED") {
      console.log(`[Toss Webhook] Toss 실제 상태: ${payment.status} — 취소 아님`);
      return res.status(200).json({ success: true, message: "취소 상태 아님" });
    }

    // Firestore에서 해당 orderId의 purchases 문서 찾기
    const purchasesSnap = await db.collection("purchases")
      .where("orderId", "==", orderId)
      .where("status", "==", "completed")
      .limit(1)
      .get();

    if (purchasesSnap.empty) {
      console.warn(`[Toss Webhook] orderId ${orderId}에 해당하는 구매 없음`);
      return res.status(200).json({ success: true, message: "해당 구매 없음" });
    }

    const purchaseDoc = purchasesSnap.docs[0];
    const purchaseData = purchaseDoc.data();

    // purchases 상태 변경
    await purchaseDoc.ref.update({
      status: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelReason: payment.cancels?.[0]?.cancelReason || "Toss 대시보드에서 취소",
    });

    console.log(`🚫 결제 취소 처리 완료: ${purchaseDoc.id} (orderId: ${orderId})`);

    // 상품명 조회
    let cancelProductName = purchaseData.productId;
    try {
      const prodDoc = await db.collection("products").doc(purchaseData.productId).get();
      if (prodDoc.exists) {
        cancelProductName = prodDoc.data().title || prodDoc.data().name || purchaseData.productId;
      }
    } catch (e) { /* fallback to productId */ }

    // 텔레그램 알림
    const cancelMsg = `🚫 *결제 취소 알림*\n\n` +
      `👤 ${purchaseData.userName || purchaseData.userEmail || "알 수 없음"}\n` +
      `📦 ${cancelProductName}\n` +
      `💰 ${purchaseData.finalAmount?.toLocaleString() || 0}원\n` +
      `📝 사유: ${payment.cancels?.[0]?.cancelReason || "없음"}\n` +
      `🔖 주문번호: ${orderId}`;

    try {
      await sendTelegram(cancelMsg);
    } catch (e) {
      console.warn("[Toss Webhook] 텔레그램 알림 실패:", e.message);
    }

    return res.status(200).json({ success: true, message: "취소 처리 완료" });

  } catch (error) {
    console.error("[Toss Webhook] 오류:", error);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
});
