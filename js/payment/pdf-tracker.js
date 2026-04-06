// pdf-tracker.js - PDF 다운로드 추적 시스템

import { ensureFirebase } from '../core/firebase-core.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * PDF 다운로드 기록
 * @param {string} pdfId - PDF ID (예: 'pdf_001')
 * @returns {Promise<Object>} 기록 결과
 */
export async function recordPdfDownload(pdfId) {
  try {
    const { auth, db } = await ensureFirebase();
    const user = auth.currentUser;
    if (!user) {
      console.warn('로그인이 필요합니다.');
      return { success: false, error: 'not-logged-in' };
    }

    // 문서 ID: userId_pdfId
    const downloadId = `${user.uid}_${pdfId}`;
    const downloadRef = doc(db, 'pdfDownloads', downloadId);

    // 기존 다운로드 기록 확인
    const existingDoc = await getDoc(downloadRef);

    if (existingDoc.exists()) {
      // 재다운로드
      await setDoc(downloadRef, {
        ...existingDoc.data(),
        downloadCount: increment(1),
        lastDownloadedAt: serverTimestamp()
      }, { merge: true });

      console.log(`📥 PDF 재다운로드: ${pdfId} (${existingDoc.data().downloadCount + 1}번째)`);
    } else {
      // 첫 다운로드
      await setDoc(downloadRef, {
        userId: user.uid,
        userName: user.displayName || user.email || '익명',
        userEmail: user.email || '',
        pdfId: pdfId,
        pdfName: getPdfName(pdfId),
        firstDownloadedAt: serverTimestamp(),
        lastDownloadedAt: serverTimestamp(),
        downloadCount: 1
      });

      console.log(`🎉 PDF 첫 다운로드: ${pdfId}`);
    }

    return { success: true };

  } catch (error) {
    console.error('PDF 다운로드 기록 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * PDF 다운로드 여부 확인
 * @param {string} pdfId - PDF ID
 * @returns {Promise<boolean>} 다운로드 여부
 */
export async function hasPdfDownloaded(pdfId) {
  try {
    const { auth, db } = await ensureFirebase();
    const user = auth.currentUser;
    if (!user) {
      return false;
    }

    const downloadId = `${user.uid}_${pdfId}`;
    const downloadRef = doc(db, 'pdfDownloads', downloadId);
    const downloadDoc = await getDoc(downloadRef);

    return downloadDoc.exists();

  } catch (error) {
    console.error('PDF 다운로드 여부 확인 오류:', error);
    return false;
  }
}

/**
 * 환불 가능 여부 확인 (다운로드 전에만 가능)
 * @param {string} pdfId - PDF ID
 * @returns {Promise<Object>} 환불 가능 여부 및 정보
 */
export async function checkPdfRefundEligibility(pdfId) {
  try {
    const { auth, db } = await ensureFirebase();
    const user = auth.currentUser;
    if (!user) {
      return { eligible: false, reason: 'not-logged-in' };
    }

    const hasDownloaded = await hasPdfDownloaded(pdfId);

    if (!hasDownloaded) {
      return {
        eligible: true,
        refundRate: 100,
        reason: 'PDF 다운로드 전'
      };
    } else {
      const downloadId = `${user.uid}_${pdfId}`;
      const downloadRef = doc(db, 'pdfDownloads', downloadId);
      const downloadDoc = await getDoc(downloadRef);
      const downloadData = downloadDoc.data();

      return {
        eligible: false,
        refundRate: 0,
        reason: 'PDF 다운로드 완료',
        firstDownloadedAt: downloadData.firstDownloadedAt,
        downloadCount: downloadData.downloadCount
      };
    }

  } catch (error) {
    console.error('PDF 환불 가능 여부 확인 오류:', error);
    return { eligible: false, reason: 'error', error: error.message };
  }
}

/**
 * 사용자의 모든 PDF 다운로드 내역 조회
 * @returns {Promise<Array>} 다운로드 내역 배열
 */
export async function getUserPdfDownloads() {
  try {
    const { auth, db } = await ensureFirebase();
    const user = auth.currentUser;
    if (!user) {
      return [];
    }

    const downloadsQuery = query(
      collection(db, 'pdfDownloads'),
      where('userId', '==', user.uid)
    );

    const downloadsSnap = await getDocs(downloadsQuery);
    const downloads = [];

    downloadsSnap.forEach(doc => {
      downloads.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return downloads;

  } catch (error) {
    console.error('PDF 다운로드 내역 조회 오류:', error);
    return [];
  }
}

/**
 * PDF 이름 가져오기
 * @param {string} pdfId - PDF ID
 * @returns {string} PDF 이름
 */
function getPdfName(pdfId) {
  const pdfNames = {
    'pdf_001': 'NSCA-CSCS 요약정리본',
    'pdf_002': '건강운동관리사 운동생리학 요약본',
    'pdf_003': '병태생리학 압축요약본',
    'pdf_004': '기능해부학 상지 요약본',
    'pdf_005': '운동처방론 요약정리본',
    'pdf_006': '건운사 스페셜테스트 압축본'
  };

  return pdfNames[pdfId] || '알 수 없는 PDF';
}

// 전역으로 노출
if (typeof window !== 'undefined') {
  window.recordPdfDownload = recordPdfDownload;
  window.hasPdfDownloaded = hasPdfDownloaded;
  window.checkPdfRefundEligibility = checkPdfRefundEligibility;
  window.getUserPdfDownloads = getUserPdfDownloads;
}
