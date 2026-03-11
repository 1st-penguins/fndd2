import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    deleteDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { ensureFirebase } from "../core/firebase-core.js";

const COLLECTION_NAME = "wrong_answers";

async function getDb() {
    const { db } = await ensureFirebase();
    return db;
}

/**
 * 오답 노트에 문제 저장
 * @param {string} userId - 사용자 UID
 * @param {object} questionData - 문제 데이터 (question, options, answer, explanation 등)
 * @param {string} examName - 시험 이름 (예: 2024년 1월 모의고사)
 * @param {string} section - 과목 (예: 운동생리학)
 */
export async function saveWrongAnswer(userId, questionData, examName, section) {
    if (!userId || !questionData) return;

    const fireDb = await getDb();

    // 고유 ID 생성 (userId_questionId 조합으로 중복 방지)
    // questionData.id가 없으면 임시 ID 생성 (거의 없겠지만)
    const questionId = questionData.id || `temp_${Date.now()}`;
    const docId = `${userId}_${questionId}`;

    const docRef = doc(fireDb, COLLECTION_NAME, docId);

    // 이미 존재하는지 확인 (불필요한 쓰기 방지) -> setDoc {merge: true}로 대체 가능
    // 하지만 'solvedCount' 같은 걸 늘리고 싶다면 읽어야 함.
    // 여기서는 단순히 덮어쓰거나 새로 생성. 'lastIncorrectAt' 갱신.

    const payload = {
        userId,
        questionId,
        examName,
        section,
        questionData, // 전체 문제 데이터 저장 (조회 시 원본 불필요)
        lastIncorrectAt: serverTimestamp(),
        isResolved: false,
        incorrectCount: 1 // 초기값
    };

    try {
        // 기존 데이터가 있으면 count 증가
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            payload.incorrectCount = (data.incorrectCount || 1) + 1;
        }

        await setDoc(docRef, payload, { merge: true });
        // console.log("오답노트 저장 완료:", docId);
    } catch (error) {
        console.error("오답노트 저장 실패:", error);
        // 사용자에게 에러를 굳이 보여줄 필요는 없음 (백그라운드 저장)
    }
}

/**
 * 사용자의 오답 노트 목록 가져오기
 * @param {string} userId 
 * @param {boolean} includeResolved - 해결된 문제도 포함할지 여부
 */
export async function getWrongAnswers(userId, includeResolved = false) {
    const fireDb = await getDb();
    const collectionRef = collection(fireDb, COLLECTION_NAME);
    let q;

    if (includeResolved) {
        q = query(
            collectionRef,
            where("userId", "==", userId),
            orderBy("lastIncorrectAt", "desc")
        );
    } else {
        q = query(
            collectionRef,
            where("userId", "==", userId),
            where("isResolved", "==", false),
            orderBy("lastIncorrectAt", "desc")
        );
    }

    try {
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() });
        });
        return results;
    } catch (error) {
        console.error("오답노트 로드 실패:", error);
        throw error;
    }
}

/**
 * 오답 해결 처리 (맞았을 때)
 * @param {string} userId 
 * @param {string} questionId 
 */
export async function markAsResolved(userId, questionId) {
    const fireDb = await getDb();
    const docId = `${userId}_${questionId}`;
    const docRef = doc(fireDb, COLLECTION_NAME, docId);

    try {
        await setDoc(docRef, {
            isResolved: true,
            resolvedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("오답 해결 처리 실패:", error);
    }
}

/**
 * 오답 노트에서 삭제 (완전히 제거)
 */
export async function removeWrongAnswer(userId, questionId) {
    const fireDb = await getDb();
    const docId = `${userId}_${questionId}`;
    const docRef = doc(fireDb, COLLECTION_NAME, docId);
    try {
        await deleteDoc(docRef);
    } catch (error) {
        console.error("오답 삭제 실패:", error);
    }
}
