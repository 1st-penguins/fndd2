"""
시험 페이지 헤더/푸터 일괄 교체 스크립트
exam/*.html, exam-sports/*.html, exam-sports1/*.html, exam-new/*.html, exam-new-sports/*.html
"""
import re
import glob
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 대상 파일 찾기
patterns = [
    'exam/*.html',
    'exam-sports/*.html',
    'exam-sports1/*.html',
    'exam-new/*.html',
    'exam-new-sports/*.html',
]

files = []
for p in patterns:
    files.extend(glob.glob(p))

print(f"대상 파일: {len(files)}개")

NEW_HEADER = '''  <!-- Header -->
  <header class="header" id="header">
    <a href="../index.html" class="header__brand">
      <img src="/images/firstpenguin-logo3.png" alt="퍼스트펭귄" class="header__logo">
      <span class="header__name">퍼스트펭귄</span>
    </a>
    <nav class="header__nav">
      <a href="../notices.html" class="header__nav-link">공지사항</a>
      <a href="../cft.html" class="header__nav-link">건운사</a>
      <a href="../si1.html" class="header__nav-link">1급</a>
      <a href="../si2.html" class="header__nav-link">2급</a>
    </nav>
    <div class="header__right">
      <a href="#" class="header__login" id="header-login-btn">로그인</a>
      <button class="header__hamburger" id="hamburger" aria-label="메뉴">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  <div class="header__mobile-menu" id="mobile-menu">
    <a href="../notices.html" class="header__mobile-link">공지사항</a>
    <a href="../cft.html" class="header__mobile-link">건운사</a>
    <a href="../si1.html" class="header__mobile-link">1급</a>
    <a href="../si2.html" class="header__mobile-link">2급</a>
    <a href="#" class="header__mobile-link" id="mobile-login-btn">로그인</a>
  </div>'''

NEW_FOOTER = '''  <footer class="footer">
    <div class="footer__inner">
      <nav class="footer__links">
        <a href="../cft.html" class="footer__link">건강운동관리사</a>
        <a href="../si1.html" class="footer__link">1급 스포츠지도사</a>
        <a href="../si2.html" class="footer__link">2급 스포츠지도사</a>
        <span class="footer__divider"></span>
        <a href="/terms.html" class="footer__link">이용약관</a>
        <a href="/privacy-policy.html" class="footer__link">개인정보처리방침</a>
        <a href="/company-info.html" class="footer__link">사업자정보</a>
      </nav>
      <p class="footer__meta">
        퍼스트펭귄 | 대표: 강민지 | 사업자등록번호: 243-14-02752 | 통신판매업 신고번호: 제2025-서울강동-1597호<br>
        주소: 서울특별시 강동구 양재대로 1300, 201동 1408호 | 전화번호: 010-9139-7328 | E-mail: the1stpeng@gmail.com
      </p>
      <div class="footer__bottom">
        <span class="footer__copyright">&copy; 2025 퍼스트펭귄. All rights reserved.</span>
        <div class="footer__sns">
          <a href="https://instagram.com/1st_penguins" target="_blank" rel="noopener" class="footer__sns-link">Instagram</a>
          <a href="https://www.youtube.com/@the1stpeng" target="_blank" rel="noopener" class="footer__sns-link">YouTube</a>
          <a href="https://open.kakao.com/o/gYRh5kch" target="_blank" rel="noopener" class="footer__sns-link">KakaoTalk</a>
        </div>
      </div>
    </div>
  </footer>'''

changed = 0
errors = []

for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()

        original = content

        # 1. CSS: linear-header.css -> apple-header.css
        content = content.replace(
            'href="../css/linear-header.css"',
            'href="../css/apple-header.css"'
        )

        # 2. CSS: linear-footer.css -> apple-footer.css
        content = content.replace(
            'href="../css/linear-footer.css"',
            'href="../css/apple-footer.css"'
        )

        # 3. Add login.css if not present
        if 'login.css' not in content:
            content = content.replace(
                'href="../css/apple-header.css"',
                'href="../css/apple-header.css">\n  <link rel="stylesheet" href="../css/login.css"'
            )

        # 4. Replace header HTML (multiline regex)
        header_pattern = re.compile(
            r'  <!-- Linear Header -->.*?</header>',
            re.DOTALL
        )
        content = header_pattern.sub(NEW_HEADER, content)

        # Also try without comment
        header_pattern2 = re.compile(
            r'  <header class="linear-header">.*?</header>',
            re.DOTALL
        )
        content = header_pattern2.sub(NEW_HEADER, content)

        # 5. Replace footer
        content = content.replace(
            '<footer class="linear-footer"></footer>',
            NEW_FOOTER
        )

        # 6. Replace linear-header.js with apple-header.js
        content = content.replace(
            '<script src="../js/linear-header.js"></script>',
            '<script src="../js/apple-header.js"></script>'
        )

        if content != original:
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(content)
            changed += 1

    except Exception as e:
        errors.append(f"{f}: {e}")

print(f"변경: {changed}개")
if errors:
    print(f"에러: {len(errors)}개")
    for e in errors:
        print(f"  {e}")
