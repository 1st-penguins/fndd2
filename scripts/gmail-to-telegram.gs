/**
 * 리틀리 주문 알림 + 일일/주간/월간 정산 → 텔레그램 전송
 */

const TELEGRAM_BOT_TOKEN = "8766322797:AAHX08TXs0YamolCrAlOHfAMCtE1Dje10UA";
const TELEGRAM_CHAT_ID = "-5261185105";
const LABEL_NAME = "텔레그램전송완료";
const DAILY_STATS_URL = "https://asia-northeast3-first-penguins-new.cloudfunctions.net/dailyStats";

function checkLittlyOrders() {
  // 개별 메시지 ID 기반 중복 방지 (Gmail이 같은 제목 메일을 스레드로 묶으므로 스레드 라벨만으로는 불충분)
  var props = PropertiesService.getScriptProperties();
  var sentIdsJson = props.getProperty("sentMessageIds") || "[]";
  var sentIds = JSON.parse(sentIdsJson);
  var sentSet = {};
  sentIds.forEach(function(id) { sentSet[id] = true; });

  // 최근 7일 메일만 검색 (전체 검색 방지)
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  var afterStr = Utilities.formatDate(sevenDaysAgo, "Asia/Seoul", "yyyy/MM/dd");

  var threads = GmailApp.search('from:noreply@litt.ly subject:"신규 주문이 접수되었습니다" after:' + afterStr, 0, 20);

  if (threads.length === 0) return;

  var newIds = [];

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      var msgId = msg.getId();
      if (sentSet[msgId]) return; // 이미 발송한 메시지 → 건너뜀

      var body = msg.getPlainBody();

      var buyerRaw = extractField(body, "주문자");
      var parts = buyerRaw.split("/").map(function(s) { return s.trim(); });
      var buyerName = parts[0] || "-";
      var buyerPhone = parts[1] || "-";
      var buyerEmail = parts[2] || "-";
      var product = extractField(body, "구매상품");
      var amount = extractField(body, "총 결제금액");
      var orderDate = extractField(body, "주문일시");

      var text = "🛒 신규 주문\n\n" +
        "구매자 : " + buyerName + "\n" +
        "연락처 : " + buyerPhone + "\n" +
        "아이디 : " + buyerEmail + "\n" +
        "상품 : " + product + "\n" +
        "결제금액 : " + amount + "\n" +
        "주문일시 : " + orderDate;

      sendTelegram(text);
      newIds.push(msgId);
    });
  });

  // 처리된 메시지 ID 저장 (최근 500개만 유지하여 용량 관리)
  if (newIds.length > 0) {
    var allIds = sentIds.concat(newIds).slice(-500);
    props.setProperty("sentMessageIds", JSON.stringify(allIds));
  }
}

// ============================================
// 일일 정산 (매일 밤)
// ============================================
function dailySummary() {
  var today = new Date();
  var orders = getOrdersInRange(today, today);
  var dateStr = formatDate(today);

  // 사이트 통계 + 매출 데이터 가져오기
  var statsText = "";
  var revenueText = "";
  var cumulativeText = "";
  try {
    var response = UrlFetchApp.fetch(DAILY_STATS_URL);
    var stats = JSON.parse(response.getContentText());
    statsText = "📊 사이트 현황\n" +
      "방문자 : " + stats.visitors + "명\n" +
      "문제풀이 : " + stats.attempts + "건 (" + stats.solvers + "명)\n" +
      "미답변 문의 : " + stats.pendingInquiries + "건\n\n";

    // 홈페이지 매출 정보
    if (stats.revenue) {
      var r = stats.revenue;
      revenueText = "🏠 홈페이지 오늘 매출\n";
      if (r.todayPurchaseCount > 0) {
        revenueText += "주문 " + r.todayPurchaseCount + "건 / " + numberFormat(r.todayHomepage) + "원\n";
        r.todayPurchases.forEach(function(p, i) {
          revenueText += (i+1) + ". " + p.product + " — " + numberFormat(p.amount) + "원 (" + p.name + ")\n";
        });
      } else {
        revenueText += "주문 없음\n";
      }
      revenueText += "\n";

      cumulativeText = "\n💰 누적 매출 총계\n" +
        "리틀리 : " + numberFormat(r.littlyTotal) + "원\n" +
        "홈페이지 : " + numberFormat(r.homepageTotal) + "원\n" +
        "합계 : " + numberFormat(r.grandTotal) + "원\n";
    }
  } catch (e) {
    statsText = "📊 사이트 통계를 불러올 수 없습니다.\n\n";
  }

  // 리틀리 오늘 매출
  var littlyText = "🛒 리틀리 오늘 매출\n";
  littlyText += formatOrderSummary(orders);

  var text = "🧾 " + dateStr + " 일일 리포트\n\n";
  text += statsText;
  text += revenueText;
  text += littlyText;
  text += cumulativeText;

  // 일요일이면 주간 정산도 같이 발송
  if (today.getDay() === 0) {
    weeklySummary();
  }

  // 말일이면 월간 정산도 같이 발송
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() === 1) {
    monthlySummary();
  }

  sendTelegram(text);
}

// ============================================
// 주간 정산 (매주 일요일)
// ============================================
function weeklySummary() {
  var today = new Date();
  var monday = new Date(today);
  monday.setDate(today.getDate() - 6);

  var orders = getOrdersInRange(monday, today);
  var text = "📊 주간 정산 (" + formatDate(monday) + " ~ " + formatDate(today) + ")\n\n";
  text += formatOrderSummary(orders);
  text += formatProductBreakdown(orders);

  sendTelegram(text);
}

// ============================================
// 월간 정산 (매월 말일)
// ============================================
function monthlySummary() {
  var today = new Date();
  var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  var orders = getOrdersInRange(firstDay, today);
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, "0");

  var text = "📈 " + yyyy + "년 " + mm + "월 월간 정산\n\n";
  text += formatOrderSummary(orders);
  text += formatProductBreakdown(orders);

  sendTelegram(text);
}

// ============================================
// 공통 함수
// ============================================
function getOrdersInRange(startDate, endDate) {
  var startStr = Utilities.formatDate(startDate, "Asia/Seoul", "yyyy/MM/dd");
  var endNext = new Date(endDate);
  endNext.setDate(endNext.getDate() + 1);
  var endStr = Utilities.formatDate(endNext, "Asia/Seoul", "yyyy/MM/dd");

  var threads = GmailApp.search('from:noreply@litt.ly subject:"신규 주문이 접수되었습니다" after:' + startStr + ' before:' + endStr, 0, 100);

  var orders = [];
  var start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  var end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      var msgDate = msg.getDate();
      if (msgDate >= start && msgDate <= end) {
        var body = msg.getPlainBody();
        var product = extractField(body, "구매상품");
        var amountStr = extractField(body, "총 결제금액");
        var buyer = extractField(body, "주문자");
        var amount = parseInt(amountStr.replace(/[^0-9]/g, "")) || 0;

        orders.push({
          buyer: buyer.split("/")[0].trim(),
          product: product,
          amount: amount
        });
      }
    });
  });

  return orders;
}

function formatOrderSummary(orders) {
  if (orders.length === 0) {
    return "주문 없음\n";
  }

  var totalAmount = 0;
  orders.forEach(function(o) { totalAmount += o.amount; });

  var text = "주문 " + orders.length + "건\n";
  text += "총 매출: " + totalAmount.toLocaleString() + "원\n\n";

  orders.forEach(function(order, i) {
    text += (i + 1) + ". " + order.product + " — " + order.amount.toLocaleString() + "원 (" + order.buyer + ")\n";
  });

  return text;
}

function formatProductBreakdown(orders) {
  if (orders.length === 0) return "";

  var products = {};
  orders.forEach(function(o) {
    var name = o.product.replace(/\(.*?\)/g, "").trim();
    if (!products[name]) {
      products[name] = { count: 0, amount: 0 };
    }
    products[name].count++;
    products[name].amount += o.amount;
  });

  var text = "\n📦 상품별 집계\n";
  Object.keys(products).forEach(function(name) {
    var p = products[name];
    text += "• " + name + " — " + p.count + "건 / " + p.amount.toLocaleString() + "원\n";
  });

  return text;
}

function numberFormat(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(date) {
  var yyyy = date.getFullYear();
  var mm = String(date.getMonth() + 1).padStart(2, "0");
  var dd = String(date.getDate()).padStart(2, "0");
  return yyyy + "." + mm + "." + dd;
}

function extractField(text, fieldName) {
  var regex = new RegExp("\\*\\s*" + fieldName + "\\s*[:：]\\s*(.+)");
  var match = text.match(regex);
  return match ? match[1].trim() : "-";
}

function sendTelegram(text) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text
    })
  };
  UrlFetchApp.fetch(url, options);
}

function testSend() {
  sendTelegram("테스트: 리틀리 주문 알림 연동 완료!");
}

function testDailySummary() {
  dailySummary();
}

function testWeeklySummary() {
  weeklySummary();
}

function testMonthlySummary() {
  monthlySummary();
}

/**
 * 기존 주문 메일의 ID를 모두 "발송완료"로 등록 (텔레그램 발송 없이)
 * ★ 코드 적용 후 최초 1회만 실행할 것! 이후 삭제해도 됨
 */
function initSentIds() {
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30);
  var afterStr = Utilities.formatDate(sevenDaysAgo, "Asia/Seoul", "yyyy/MM/dd");

  var threads = GmailApp.search('from:noreply@litt.ly subject:"신규 주문이 접수되었습니다" after:' + afterStr, 0, 50);

  var ids = [];
  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      ids.push(msg.getId());
    });
  });

  var props = PropertiesService.getScriptProperties();
  props.setProperty("sentMessageIds", JSON.stringify(ids));
  Logger.log("등록 완료: " + ids.length + "개 메시지 ID 저장됨");
}
