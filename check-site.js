const { chromium } = require('playwright');

(async () => {
  const url = 'https://the1stpeng.com';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const logs = [];
  const networkErrors = [];

  const page = await context.newPage();
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('response', res => {
    if (res.status() >= 400) networkErrors.push(`${res.status()}: ${res.url()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const appVersion = await page.evaluate(() =>
    document.querySelector('meta[name="app-version"]')?.content || '없음'
  );
  const bgLoaded = await page.evaluate(() =>
    document.querySelector('.linear-hero')?.classList.contains('bg-loaded')
  );
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.sub-tab-button')).map(b => ({
      text: b.textContent.trim(),
      display: b.style.display || '(css)',
      adminOnly: b.classList.contains('admin-only')
    }))
  );

  console.log('=== 기본 정보 ===');
  console.log('app-version:', appVersion);
  console.log('Hero bg-loaded:', bgLoaded);
  console.log('서브탭:', JSON.stringify(tabs, null, 2));

  console.log('\n=== 콘솔 로그 ===');
  logs.forEach(l => console.log(l));

  console.log('\n=== 네트워크 에러 ===');
  networkErrors.forEach(e => console.log(e));

  console.log('\n=== 학습분석 탭 클릭 ===');
  const analyticsBtn = await page.$('[data-tab="analytics-tab"]');
  if (analyticsBtn) {
    await analyticsBtn.click();
    await page.waitForTimeout(5000);
    const afterLogs = [];
    page.on('console', msg => afterLogs.push(`[${msg.type()}] ${msg.text()}`));
    const html = await page.evaluate(() =>
      document.querySelector('.analytics-dashboard-container')?.innerHTML?.substring(0, 400) || '컨테이너 없음'
    );
    console.log('대시보드 HTML:', html);
    console.log('추가 콘솔:', afterLogs.join('\n'));
  } else {
    console.log('학습분석 버튼 없음');
  }

  await browser.close();
})();
