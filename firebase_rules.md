# Firebase Firestore 보안 규칙 (레퍼런스)

아래 규칙은 프로젝트에서 사용 중인 Firestore 보안 규칙 레퍼런스입니다. 필요 시 이 문서를 열어 검색/복사해 활용하세요.

```text
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
    // 모의고사 결과 (mockExamResults) - 수정됨!
    // ============================================
    match /mockExamResults/{resultId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      // ✅ read에서는 resource.data 사용!
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
    // 공지사항 (notices)
    // ============================================
    match /notices/{noticeId} {
      // 공지사항 읽기는 모두 가능 (비로그인 포함)
      allow read: if true;
      // 공지사항 작성/수정/삭제는 관리자만
      allow create, update, delete: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 댓글 (comments)
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
    // 좋아요 (likes)
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
    // 상품 컬렉션 (products)
    // ============================================
    match /products/{productId} {
      // 상품 정보는 로그인한 사용자 모두 읽기 가능
      allow read: if request.auth != null;
      // 상품 생성/수정/삭제는 관리자만
      allow create, update, delete: if isAdmin() || isAdminEmail() || isAdminUser();
    }
    
    // ============================================
    // 구매 기록 (purchases)
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
```

- 배포 전 체크: 비로그인 공지/콘텐츠 공개 의도가 있다면 `notices` 등 공개 컬렉션에 대해 read 허용 범위를 조정해야 합니다.
- 관리자 인증 기준: `admins`, `adminUsers` 문서 존재 / `adminEmails` 목록 기준을 모두 지원합니다.
