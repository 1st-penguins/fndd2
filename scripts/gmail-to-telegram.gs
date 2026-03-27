/**
 * 리틀리 주문 알림 + 일일/주간/월간 정산 → 텔레그램 전송
 */

const TELEGRAM_BOT_TOKEN = "8766322797:AAHX08TXs0YamolCrAlOHfAMCtE1Dje10UA";
const TELEGRAM_CHAT_ID = "-5261185105";
const LABEL_NAME = "텔레그램전송완료";
const DAILY_STATS_URL = "https://asia-northeast3-first-penguins-new.cloudfunctions.net/dailyStats";

function checkLittlyOrders() {
  // 이미 처리한 메시지 ID 목록 (PropertiesService로 중복 방지)
  const props = PropertiesService.getScriptProperties();
  const sentRaw = props.getProperty("sentMessageIds") || "[]";
  const sentIds = JSON.parse(sentRaw);
  const sentSet = {};
  sentIds.forEach(function(id) { sentSet[id] = true; });

  const threads = GmailApp.search('from:noreply@litt.ly subject:"신규 주문이 접수되었습니다"', 0, 20);

  if (threads.length === 0) return;

  const newIds = [];

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    messages.forEach(function(msg) {
      const msgId = msg.getId();

      // 이미 텔레그램 발송한 메시지는 스킵
      if (sentSet[msgId]) return;

      const body = msg.getPlainBody();

      const buyerRaw = extractField(body, "주문자");
      const parts = buyerRaw.split("/").map(function(s) { return s.trim(); });
      const buyerName = parts[0] || "-";
      const buyerPhone = parts[1] || "-";
      const buyerEmail = parts[2] || "-";
      const product = extractField(body, "구매상품");
      const amount = extractField(body, "총 결제금액");
      const orderDate = extractField(body, "주문일시");

      const text = "🛒 신규 주문\n\n" +
        "구매자 : " + buyerName + "\n" +
        "연락처 : " + buyerPhone + "\n" +
        "아이디 : " + buyerEmail + "\n" +
        "상품 : " + product + "\n" +
        "결제금액 : " + amount + "\n" +
        "주문일시 : " + orderDate;

      sendTelegram(text);
      newIds.push(msgId);
      sentSet[msgId] = true;
    });
  });

  // 새로 처리한 ID 추가 후 저장 (최근 200개만 유지)
  if (newIds.length > 0) {
    const allIds = sentIds.concat(newIds);
    const trimmed = allIds.slice(-200);
    props.setProperty("sentMessageIds", JSON.stringify(trimmed));
  }
}

// ============================================
// 일일 정산 (매일 밤)
// ============================================
function dailySummary() {
  var today = new Date();
  var orders = getOrdersInRange(today, today);
  var dateStr = formatDate(today);

  // 사이트 통계 가져오기
  var statsText = "";
  try {
    var response = UrlFetchApp.fetch(DAILY_STATS_URL);
    var stats = JSON.parse(response.getContentText());
    statsText = "📊 사이트 현황\n" +
      "방문자 : " + stats.visitors + "명\n" +
      "페이지뷰 : " + stats.pageViews + "회\n" +
      "문제풀이 : " + stats.attempts + "건 (" + stats.solvers + "명)\n" +
      "미답변 문의 : " + stats.pendingInquiries + "건\n\n";
  } catch (e) {
    statsText = "📊 사이트 통계를 불러올 수 없습니다.\n\n";
  }

  var text = "🧾 " + dateStr + " 일일 리포트\n\n";
  text += statsText;
  text += "🛒 매출\n";
  text += formatOrderSummary(orders);

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
