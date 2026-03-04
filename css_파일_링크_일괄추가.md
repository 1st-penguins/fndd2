# CSS 파일 링크 일괄 추가 가이드

## 문제 상황
일반 문제 페이지에서 인디케이터가 보이지 않고 숫자만 나타남

## 원인
`css/quiz.css` 파일이 로드되지 않음

## 해결 방법

### 수동으로 추가해야 할 파일들

#### 1. exam 폴더의 모든 과목별 문제 파일
```
exam/2025_운동생리학.html
exam/2025_건강체력평가.html
exam/2025_운동처방론.html
exam/2025_운동부하검사.html
exam/2025_운동상해.html
exam/2025_기능해부학.html
exam/2025_병태생리학.html
exam/2025_스포츠심리학.html

exam/2024_운동생리학.html
... (2024~2019 모든 과목)
```

#### 2. subjects 폴더의 과목 페이지
```
subjects/subject_운동생리학.html
subjects/subject_건강체력평가.html
subjects/subject_운동처방론.html
subjects/subject_운동부하검사.html
subjects/subject_운동상해.html
subjects/subject_기능해부학.html
subjects/subject_병태생리학.html
subjects/subject_스포츠심리학.html
```

### 추가할 코드

기존:
```html
<link rel="stylesheet" href="../css/base.css"/>
<link rel="stylesheet" href="../css/layout.css"/>
<link rel="stylesheet" href="../css/components.css"/>
<link rel="stylesheet" href="../css/pages/quiz.css"/>
```

변경 후:
```html
<link rel="stylesheet" href="../css/base.css"/>
<link rel="stylesheet" href="../css/layout.css"/>
<link rel="stylesheet" href="../css/components.css"/>
<link rel="stylesheet" href="../css/quiz.css"/>  ← 이 줄 추가!
<link rel="stylesheet" href="../css/pages/quiz.css"/>
```

### 자동화 스크립트 (VSCode에서 실행)

1. **Find (Ctrl + Shift + F)**
   ```
   <link rel="stylesheet" href="../css/components.css"/>
   ```

2. **Replace**
   ```
   <link rel="stylesheet" href="../css/components.css"/>
  <link rel="stylesheet" href="../css/quiz.css"/>
   ```

3. **Files to include**
   ```
   exam/*.html, subjects/*.html
   ```

4. **Replace All** 클릭

---

## 완료된 파일
✅ exam/quiz.html (인라인 스타일 추가)
✅ exam/2025_운동생리학.html
✅ exam/2024_운동생리학.html
✅ subjects/subject_운동생리학.html

## 남은 파일
⏳ exam/2025_건강체력평가.html ~ 2019_스포츠심리학.html (약 56개)
⏳ subjects/subject_건강체력평가.html ~ subject_스포츠심리학.html (7개)

---

**VSCode의 Find & Replace 기능으로 한 번에 처리하는 것을 추천합니다!** 🚀

