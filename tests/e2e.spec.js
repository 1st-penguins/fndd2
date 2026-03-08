// e2e.spec.js — fndd2 End-to-End Tests
// 테스트 대상: https://fndd.netlify.app

const { test, expect } = require('@playwright/test');

const BASE = 'https://fndd.netlify.app';

// Firebase WebSocket이 살아있어 networkidle 안 됨 → load 사용
const LOAD = { waitUntil: 'load' };

function isCriticalError(msg) {
  const ignore = [
    'permissions', 'daily visit', 'firebase', 'Firebase',
    'login', 'restricted', '목록으로 링크',
  ];
  return !ignore.some(s => msg.includes(s));
}

// ===================================================
// 1. 홈페이지 기본 로드
// ===================================================
test.describe('홈페이지 기본', () => {
  test('페이지 정상 로드 + 콘솔 오류 없음', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE, LOAD);
    await expect(page).toHaveTitle(/퍼스트펭귄/);
    await expect(page.locator('.linear-header__brand')).toBeVisible();

    const critical = errors.filter(isCriticalError);
    if (critical.length) console.log('Critical errors:', critical);
    expect(critical).toHaveLength(0);
  });

  test('자격증 선택 버튼 표시', async ({ page }) => {
    await page.goto(BASE, LOAD);
    const certButtons = page.locator('.cert-button');
    await expect(certButtons.first()).toBeVisible({ timeout: 5000 });
  });

  test('공지사항 탭 기본 활성화', async ({ page }) => {
    await page.goto(BASE, LOAD);
    await expect(page.locator('#notice-tab')).toBeVisible({ timeout: 5000 });
  });
});

// ===================================================
// 2. 헤더·푸터
// ===================================================
test.describe('헤더·푸터', () => {
  test('헤더 네비게이션 링크 표시', async ({ page }) => {
    await page.goto(BASE, LOAD);
    await expect(page.locator('.linear-header__nav-link').first()).toBeVisible();
  });

  test('푸터 렌더링 (SNS 섹션 포함)', async ({ page }) => {
    await page.goto(BASE, LOAD);
    // 푸터 JS 인젝션 기다리기
    await page.waitForSelector('.linear-footer__sns-link', { timeout: 10000 });
    await expect(page.locator('.linear-footer__sns-link').first()).toBeVisible();
  });

  test('푸터 SNS 왼쪽 정렬 (justify-content ≠ center)', async ({ page }) => {
    await page.goto(BASE, LOAD);
    await page.waitForSelector('.linear-footer__sns-link', { timeout: 10000 });
    const jc = await page.locator('.linear-footer__sns-link').first()
      .evaluate(el => window.getComputedStyle(el).justifyContent);
    expect(jc).not.toBe('center');
  });

  test('notices.html 푸터 동일 렌더링', async ({ page }) => {
    await page.goto(`${BASE}/notices.html`, LOAD);
    await page.waitForSelector('.linear-footer__sns-link', { timeout: 10000 });
    await expect(page.locator('.linear-footer__sns-link').first()).toBeVisible();
  });
});

// ===================================================
// 3. 문제풀이 페이지 (2019 기능해부학)
// ===================================================
test.describe('문제풀이 페이지', () => {
  const EXAM = `${BASE}/exam/2019_%EA%B8%B0%EB%8A%A5%ED%95%B4%EB%B6%80%ED%95%99.html`;

  test('문제 페이지 로드 + 콘솔 오류 없음', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await page.waitForSelector('.indicator', { timeout: 10000 });

    const critical = errors.filter(isCriticalError);
    if (critical.length) console.log('Exam errors:', critical);
    expect(critical).toHaveLength(0);
  });

  test('인디케이터 20개 생성', async ({ page }) => {
    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await page.waitForSelector('.indicator', { timeout: 10000 });
    await expect(page.locator('.indicator')).toHaveCount(20);
  });

  test('답 선택 → 정답보기 → 인디케이터 색상 변경', async ({ page }) => {
    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await page.waitForSelector('.indicator', { timeout: 10000 });

    await page.locator('.option-button').first().click();
    await page.locator('#check-button').click();

    await expect(page.locator('#feedback')).toBeVisible();
    // checked-correct 또는 checked-incorrect 클래스
    await expect(page.locator('.indicator').first())
      .toHaveClass(/checked-correct|checked-incorrect/);
  });

  test('다음/이전 문제 이동 (비로그인: 오버레이 우회)', async ({ page }) => {
    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await page.waitForSelector('.indicator', { timeout: 10000 });

    // 비로그인 상태에서도 navigation-buttons 영역 직접 클릭 가능한지 확인
    // (로그인 오버레이가 콘텐츠를 가릴 수 있어 JS로 직접 호출)
    await page.evaluate(() => window.goToNextQuestion && window.goToNextQuestion());
    await expect(page.locator('.question-number')).toContainText('2번', { timeout: 5000 });

    await page.evaluate(() => window.goToPreviousQuestion && window.goToPreviousQuestion());
    await expect(page.locator('.question-number')).toContainText('1번', { timeout: 5000 });
  });

  test('뒤로가기 링크 존재', async ({ page }) => {
    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await expect(page.locator('.back-link')).toBeVisible({ timeout: 5000 });
  });
});

// ===================================================
// 4. 모바일 (390×844 iPhone 12 viewport)
// ===================================================
test.describe('모바일 뷰포트', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  test('홈 페이지 모바일 로드', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE, LOAD);
    await expect(page.locator('.linear-header')).toBeVisible();
    await expect(page.locator('.linear-header__mobile-toggle')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('모바일 햄버거 메뉴 동작', async ({ page }) => {
    await page.goto(BASE, LOAD);
    const toggle = page.locator('.linear-header__mobile-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    // 모바일 메뉴는 #mobile-menu에 --active 클래스 추가 방식
    await expect(page.locator('#mobile-menu')).toHaveClass(/linear-header__mobile-menu--active/, { timeout: 3000 });
  });

  test('모바일 문제풀이 4개 선택지', async ({ page }) => {
    const EXAM = `${BASE}/exam/2019_%EA%B8%B0%EB%8A%A5%ED%95%B4%EB%B6%80%ED%95%99.html`;
    await page.goto(EXAM, { ...LOAD, timeout: 30000 });
    await page.waitForSelector('.option-button', { timeout: 10000 });
    await expect(page.locator('.option-button')).toHaveCount(4);
  });
});

// ===================================================
// 5. 공지사항 페이지
// ===================================================
test.describe('공지사항', () => {
  test('공지사항 페이지 로드', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${BASE}/notices.html`, LOAD);
    await expect(page).toHaveTitle(/공지/);
    expect(errors).toHaveLength(0);
  });
});
