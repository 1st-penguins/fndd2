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
    increment
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { ensureFirebase } from "../core/firebase-core.js";

const COLLECTION_NAME = "wrong_answers";

async function getDb() {
    const { db } = await ensureFirebase();
    return db;
}

/** undefined 값을 재귀적으로 제거 (Firestore는 undefined 허용 안 함) */
function removeUndefined(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined) {
            clean[key] = (val !== null && typeof val === 'object' && !(val instanceof Date))
                ? removeUndefined(val)
                : val;
        }
    }
    return clean;
}

/**
 * 오답 노트에 문제 저장
 * @param {string} userId - 사용자 UID
 * @param {object} questionData - 문제 데이터
 * @param {string} examName - 시험 이름 (예: 2024년 모의고사)
 * @param {string} section - 과목 (예: 운동생리학)
 * @param {string} certType - 자격증 타입 ('health-manager' | 'sports-instructor')
 */
export async function saveWrongAnswer(userId, questionData, examName, section, certType) {
    if (!userId || !questionData) return;

    const fireDb = await getDb();
    const cert = certType || 'health-manager';

    const questionId = questionData.id || `temp_${Date.now()}`;
    const docId = `${userId}_${questionId}`;
    const docRef = doc(fireDb, COLLECTION_NAME, docId);

    const payload = {
        userId,
        questionId,
        examName,
        section,
        certType: cert,
        questionData: removeUndefined(questionData),
        lastIncorrectAt: serverTimestamp(),
        isResolved: false,
        incorrectCount: increment(1)
    };

    try {
        await setDoc(docRef, payload, { merge: true });
    } catch (error) {
        console.error("오답노트 저장 실패:", error);
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
