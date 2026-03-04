# 🔥 Firebase Console에 적용할 보안 규칙

## 📋 적용 방법

1. **Firebase Console 접속**: https://console.firebase.google.com
2. **프로젝트 선택**: first-penguins-new
3. **Firestore Database** → **규칙** 탭 클릭
4. 아래 전체 규칙을 복사하여 붙여넣기
5. **게시** 버튼 클릭

---

## 🔒 주요 변경 사항

### ✅ 공지사항 (notices)
- **읽기**: 모두 가능 (비로그인 포함) ← 변경됨!
- **작성/수정/삭제**: 관리자만

### ✅ 댓글 (comments)
- **읽기**: 모두 가능 (비로그인 포함) ← 변경됨!
- **작성**: 로그인 필요
- **삭제**: 작성자 본인 또는 관리자
- **수정**: 작성자 본인만

### ✅ 좋아요 (likes)
- **읽기**: 모두 가능 (비로그인 포함) ← 추가됨!
- **생성/삭제**: 로그인 필요

---

## 📝 전체 규칙 (복사하여 Firebase Console에 붙여넣기)

\`\`\`javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // 관리자 확인 함수
    // ============================================
    function isAdmin() {
      return request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    function isAdminUser() {
      return request.auth != null && exists(/databases/$(database)/documents/adminUsers/$(request.auth.uid));
    }
    
    function isAdminEmail() {
      let adminEmails = ['kspo0324@gmail.com', 'mingdy7283@gmail.com', 'sungsoo702@gmail.com'];
      return request.auth != null && request.auth.token.email in adminEmails;
    }
    
    // ============================================
    // 사용자 컬렉션
    // ============================================
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 문제 풀이 기록 (attempts) - 통합!
    // ============================================
    match /attempts/{attemptId} {
      // 일반 사용자: 자신의 데이터만
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 데이터 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 퀴즈 세션 (quizSessions)
    // ============================================
    match /quizSessions/{sessionId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 세션 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // sessions 컬렉션 (별칭)
    match /sessions/{sessionId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 세션 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 모의고사 결과 (mockExamResults)
    // ============================================
    match /mockExamResults/{resultId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 결과 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 시험 문제 컬렉션
    // ============================================
    match /exams/{examId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /mockexams/{mockExamId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /mockexams/{mockExamId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /mockExams/{mockExamId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /mockExams/{mockExamId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 문제 세트 컬렉션
    // ============================================
    match /questionSets/{setId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 공지사항 (notices) ⭐ 변경됨!
    // ============================================
    match /notices/{noticeId} {
      // 공지사항 읽기는 모두 가능 (비로그인 포함)
      allow read: if true;
      // 공지사항 작성/수정/삭제는 관리자만
      allow create, update, delete: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 댓글 (comments) ⭐ 변경됨!
    // ============================================
    match /comments/{commentId} {
      // 댓글 읽기는 모두 가능 (비로그인 포함)
      allow read: if true;
      // 댓글 작성은 로그인 필요
      allow create: if request.auth != null;
      // 댓글 삭제는 작성자 본인 또는 관리자
      allow delete: if request.auth != null && 
                    (request.auth.uid == resource.data.userId || 
                     isAdmin() || isAdminEmail() || isAdminUser());
      // 댓글 수정은 작성자 본인만
      allow update: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // ============================================
    // 좋아요 (likes) ⭐ 추가됨!
    // ============================================
    match /likes/{likeId} {
      // 좋아요 읽기는 모두 가능 (비로그인 포함)
      allow read: if true;
      // 좋아요 생성/삭제는 로그인 필요
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
      // 관리자는 모든 좋아요 관리 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 사용자 진행률 (userProgress)
    // ============================================
    match /userProgress/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 북마크 (bookmarks)
    // ============================================
    match /bookmarks/{bookmarkId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 북마크 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 관리자 통계 (adminStats)
    // ============================================
    match /adminStats/{statId} {
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 사용자 통계 (userStatistics)
    // ============================================
    match /userStatistics/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 문제 통계 (questionStats)
    // ============================================
    match /questionStats/{questionId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 관리자 컬렉션
    // ============================================
    match /admins/{adminId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    match /adminUsers/{adminUserId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 상품 컬렉션 (products) ⭐ 추가됨!
    // ============================================
    match /products/{productId} {
      // 상품 정보는 로그인한 사용자 모두 읽기 가능
      allow read: if request.auth != null;
      // 상품 생성/수정/삭제는 관리자만
      allow create, update, delete: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 구매 기록 (purchases) ⭐ 추가됨!
    // ============================================
    match /purchases/{purchaseId} {
      // 자신의 구매 기록만 읽기 가능
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      // 구매 기록 생성
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      // 관리자는 모든 구매 기록 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 추천 문제 세트 (recommendedSets)
    // ============================================
    match /recommendedSets/{setId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 관리자: 모든 추천 세트 접근 가능
      allow read, write: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 기본 거부 규칙
    // ============================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
\`\`\`

---

## ✅ 적용 후 확인사항

### 1. 비로그인 사용자
- ✅ 공지사항 목록 볼 수 있음
- ✅ 공지사항 상세 볼 수 있음
- ✅ 댓글 목록 볼 수 있음
- ✅ 좋아요 개수 볼 수 있음
- ❌ 댓글 작성 불가 (로그인 필요)
- ❌ 좋아요 누르기 불가 (로그인 필요)

### 2. 로그인 사용자
- ✅ 공지사항 보기
- ✅ 댓글 작성/수정/삭제 (본인 것만)
- ✅ 좋아요 누르기/취소

### 3. 관리자
- ✅ 모든 권한
- ✅ 공지사항 작성/수정/삭제
- ✅ 모든 댓글 삭제 가능

---

**규칙 적용 후 즉시 반영됩니다!** 🎉

브라우저 새로고침 후 공지사항이 비로그인 상태에서도 표시됩니다.

