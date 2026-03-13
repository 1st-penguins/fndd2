import {
    collection,
    doc,
    setDoc,
    updateDoc,
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
// 같은 세션 내 중복 저장 방지용 Set
const _savedInSession = new Set();

export async function saveWrongAnswer(userId, questionData, examName, section, certType) {
    if (!userId || !questionData) return;

    const fireDb = await getDb();
    const cert = certType || 'health-manager';

    const questionId = questionData.id;
    if (!questionId) {
        console.warn('오답노트 저장 실패: questionData.id 누락', questionData);
        return;
    }
    const docId = `${userId}_${questionId}`;

    // 같은 페이지 세션 내 동일 문제 중복 저장 방지
    if (_savedInSession.has(docId)) {
        console.warn(`오답노트 중복 저장 방지: ${questionId}`);
        return;
    }
    _savedInSession.add(docId);

    const docRef = doc(fireDb, COLLECTION_NAME, docId);

    try {
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

        await setDoc(docRef, payload, { merge: true });
    } catch (error) {
        console.error("오답노트 저장 실패:", error);
        // 실패 시 재시도 가능하도록 Set에서 제거
        _savedInSession.delete(docId);
    }
}

/**
 * 사용자의 오답 노트 목록 가져오기
 * @param {string} userId
 * @param {object} options - { certType, includeResolved }
 */
export async function getWrongAnswers(userId, optionsOrResolved = false) {
    // 하위호환: 기존 (userId, boolean) 호출 지원
    let certType = null;
    let includeResolved = false;
    if (typeof optionsOrResolved === 'object' && optionsOrResolved !== null) {
        certType = optionsOrResolved.certType || null;
        includeResolved = optionsOrResolved.includeResolved || false;
    } else {
        includeResolved = !!optionsOrResolved;
    }

    const fireDb = await getDb();
    const collectionRef = collection(fireDb, COLLECTION_NAME);

    // certType 필터 포함 쿼리 시도 (복합 인덱스 필요)
    if (certType) {
        try {
            const conditions = [
                where("userId", "==", userId),
                where("certType", "==", certType)
            ];
            if (!includeResolved) {
                conditions.push(where("isResolved", "==", false));
            }
            conditions.push(orderBy("lastIncorrectAt", "desc"));

            const q = query(collectionRef, ...conditions);
            const snapshot = await getDocs(q);
            const results = [];
            snapshot.forEach(d => { results.push({ id: d.id, ...d.data() }); });
            return results;
        } catch (indexError) {
            // 복합 인덱스 미생성 시 → 전체 로드 후 클라이언트 필터로 폴백
            console.warn("certType 인덱스 없음, 전체 로드 후 필터:", indexError.message);
        }
    }

    // 기본 쿼리 (전체 로드)
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
        snapshot.forEach(d => { results.push({ id: d.id, ...d.data() }); });
        // certType이 지정됐으면 클라이언트 필터
        if (certType) {
            return results.filter(item => (item.certType || 'health-manager') === certType);
        }
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
        await updateDoc(docRef, {
            isResolved: true,
            resolvedAt: serverTimestamp()
        });
    } catch (error) {
        // 문서가 없으면 (오답 기록이 없는 문제) 무시
        if (error.code === 'not-found') return;
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
