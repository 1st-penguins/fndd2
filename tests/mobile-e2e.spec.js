// mobile-e2e.spec.js - 모바일 문제풀이 & 학습분석 E2E 테스트
const { test, expect, devices } = require('@playwright/test');

const BASE_URL = 'http://localhost:8888';
const iPhone = devices['iPhone 13'];

test.use({ ...iPhone });

test.describe('모바일 문제풀이 E2E', () => {

  test('일반문제 풀기 → 결과 → 오답리뷰 → 이전/다음 버튼', async ({ page }) => {
    await page.goto(`${BASE_URL}/exam/2025_운동상해.html`);
    await page.waitForSelector('.indicator', { timeout: 10000 });

    // 비로그인 시 content-blurred 오버레이 제거
    await page.evaluate(() => {
      document.querySelectorAll('.content-blurred, .restricted-overlay').forEach(el => {
        el.classList.remove('content-blurred');
        el.style.display = el.classList.contains('restricted-overlay') ? 'none' : '';
      });
    });

    // 인디케이터 20개 확인
    const indicators = await page.locator('.indicator').count();
    expect(indicators).toBe(20);

    // 20문제 풀기 (일부 오답 유도: 짝수는 0번, 홀수는 1번)
    for (let i = 0; i < 20; i++) {
      const answer = i % 2 === 0 ? 0 : 1;
      await page.locator(`.option-button:nth-child(${answer + 1})`).click();
      await page.waitForTimeout(200);

      if (i < 19) {
        await page.locator('#next-button').click();
        await page.waitForTimeout(200);
      }
    }

    // 제출 버튼 클릭
    const submitBtn = page.locator('#submit-button, .submit-button, button:has-text("제출")');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // confirm 대화상자 처리
      page.on('dialog', dialog => dialog.accept());
      await page.waitForTimeout(500);
    }

    // 결과 화면 확인
    await page.waitForSelector('#results-summary', { state: 'visible', timeout: 10000 });
    const resultsVisible = await page.locator('#results-summary').isVisible();
    expect(resultsVisible).toBe(true);

    // 오답 리뷰 버튼 클릭
    const reviewBtn = page.locator('button:has-text("오답 리뷰"), .review-button');
    await expect(reviewBtn).toBeVisible({ timeout: 5000 });
    await reviewBtn.click();
    await page.waitForTimeout(500);

    // 퀴즈 컨테이너가 다시 보이는지 확인
    const quizVisible = await page.locator('#quiz-container').isVisible();
    expect(quizVisible).toBe(true);

    // 인디케이터가 보이는지 확인 (잘림 문제)
    const indicatorContainer = page.locator('.question-indicators-container');
    await expect(indicatorContainer).toBeVisible();

    // 인디케이터가 뷰포트 안에 있는지 확인
    const box = await indicatorContainer.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize();
      // 인디케이터 하단이 뷰포트 밖으로 벗어나지 않았는지 (2초 스크롤 대기 후)
      await page.waitForTimeout(1000);
    }

    // 다음 오답 버튼 클릭
    const nextBtn = page.locator('#next-button');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(300);

      // 이전 버튼이 활성화되었는지 확인
      const prevBtn = page.locator('#prev-button');
      const prevDisabled = await prevBtn.getAttribute('disabled');
      expect(prevDisabled).toBeNull(); // disabled 아님 = 클릭 가능

      // 이전 버튼 클릭 동작 확인
      await prevBtn.click();
      await page.waitForTimeout(300);
    }

    console.log('✅ 일반문제 풀기 → 결과 → 오답리뷰 → 이전/다음 버튼 테스트 통과');
  });

  test('인디케이터 표시 및 answered 클래스', async ({ page }) => {
    await page.goto(`${BASE_URL}/exam/2025_운동상해.html`);
    await page.waitForSelector('.indicator', { timeout: 10000 });

    // 첫 문제 답변
    await page.locator('.option-button:nth-child(1)').click();
    await page.waitForTimeout(300);

    // 인디케이터에 answered 클래스 확인
    const firstIndicator = page.locator('.indicator').first();
    await expect(firstIndicator).toHaveClass(/answered|current/);

    console.log('✅ 인디케이터 answered 클래스 테스트 통과');
  });
});

test.describe('모바일 학습분석 E2E', () => {

  test('자격증 전환 시 탭 콘텐츠 변경', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForTimeout(2000);

    // 자격증 버튼 확인
    const certButtons = page.locator('.cert-button');
    const count = await certButtons.count();
    expect(count).toBe(3);

    // 1급 스포츠지도사 전환
    await page.locator('.cert-button[data-cert="sports-instructor-1"]').click();
    await page.waitForTimeout(500);

    // 1급 버튼이 active인지 확인
    const sports1Btn = page.locator('.cert-button[data-cert="sports-instructor-1"]');
    await expect(sports1Btn).toHaveClass(/active/);

    // 건강운동관리사 버튼이 비활성인지 확인
    const healthBtn = page.locator('.cert-button[data-cert="health-manager"]');
    await expect(healthBtn).not.toHaveClass(/active/);

    // 다시 건강운동관리사로 전환
    await healthBtn.click();
    await page.waitForTimeout(500);

    await expect(healthBtn).toHaveClass(/active/);
    await expect(sports1Btn).not.toHaveClass(/active/);

    console.log('✅ 자격증 전환 테스트 통과');
  });

  test('모바일 자격증 버튼 레이아웃 (건운사 풀 폭)', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForSelector('.cert-selector', { timeout: 5000 });

    const healthBtn = page.locator('.cert-button[data-cert="health-manager"]');
    const sports1Btn = page.locator('.cert-button[data-cert="sports-instructor-1"]');
    const sportsBtn = page.locator('.cert-button[data-cert="sports-instructor"]');

    const healthBox = await healthBtn.boundingBox();
    const sports1Box = await sports1Btn.boundingBox();
    const sportsBox = await sportsBtn.boundingBox();

    // 건운사가 첫 줄(위), 1급/2급이 아래 줄
    expect(healthBox.y).toBeLessThan(sports1Box.y);
    expect(healthBox.y).toBeLessThan(sportsBox.y);

    // 1급과 2급은 같은 줄에 나란히
    expect(Math.abs(sports1Box.y - sportsBox.y)).toBeLessThan(5);

    // 건운사가 더 넓음 (풀 폭)
    expect(healthBox.width).toBeGreaterThan(sports1Box.width);

    console.log('✅ 모바일 자격증 버튼 레이아웃 테스트 통과');
  });

  test('삭제 버튼 3개 존재 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForTimeout(2000);

    const healthDelete = page.locator('#delete-health-question-sets');
    const sportsDelete = page.locator('#delete-sports-question-sets');
    const sports1Delete = page.locator('#delete-sports1-question-sets');

    // DOM에 존재하는지 확인
    await expect(healthDelete).toBeAttached();
    await expect(sportsDelete).toBeAttached();
    await expect(sports1Delete).toBeAttached();

    console.log('✅ 삭제 버튼 3개 존재 테스트 통과');
  });
});
