// 쿠폰 관리 모듈

import { db, auth } from '../core/firebase-core.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * 쿠폰 유효성 검증
 */
export async function validateCoupon(couponCode, productId, purchaseAmount) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { valid: false, message: '로그인이 필요합니다.' };
    }
    
    // 쿠폰 조회
    const couponsRef = collection(db, 'coupons');
    const q = query(couponsRef, where('code', '==', couponCode.toUpperCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { valid: false, message: '존재하지 않는 쿠폰 코드입니다.' };
    }
    
    const couponDoc = snapshot.docs[0];
    const coupon = { id: couponDoc.id, ...couponDoc.data() };
    
    // 1. 유효기간 확인
    const now = new Date();
    const startDate = coupon.startDate.toDate();
    const endDate = coupon.endDate.toDate();
    
    if (now < startDate) {
      return { valid: false, message: '아직 사용할 수 없는 쿠폰입니다.' };
    }
    
    if (now > endDate) {
      return { valid: false, message: '만료된 쿠폰입니다.' };
    }
    
    // 2. 최대 사용 횟수 확인
    if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) {
      return { valid: false, message: '쿠폰 사용 한도가 초과되었습니다.' };
    }
    
    // 3. 1인당 사용 횟수 확인
    const userUsageCount = await getUserCouponUsageCount(user.uid, coupon.id);
    if (userUsageCount >= coupon.maxUsesPerUser) {
      return { valid: false, message: '이미 사용한 쿠폰입니다.' };
    }
    
    // 4. 적용 상품 확인
    if (!coupon.applicableProducts.includes('all') && !coupon.applicableProducts.includes(productId)) {
      return { valid: false, message: '이 상품에는 사용할 수 없는 쿠폰입니다.' };
    }
    
    // 5. 최소 구매 금액 확인
    if (coupon.minPurchase > 0 && purchaseAmount < coupon.minPurchase) {
      return { 
        valid: false, 
        message: `최소 ${coupon.minPurchase.toLocaleString()}원 이상 구매 시 사용 가능합니다.` 
      };
    }
    
    // 6. 할인 금액 계산
    let discountAmount = 0;
    if (coupon.discountType === 'percent') {
      discountAmount = Math.floor(purchaseAmount * (coupon.discountValue / 100));
      
      // 최대 할인 금액 적용
      if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }
    
    // 할인 금액이 구매 금액을 초과하지 않도록
    if (discountAmount > purchaseAmount) {
      discountAmount = purchaseAmount;
    }
    
    return {
      valid: true,
      coupon: coupon,
      discountAmount: discountAmount,
      finalAmount: purchaseAmount - discountAmount
    };
    
  } catch (error) {
    console.error('쿠폰 검증 오류:', error);
    return { valid: false, message: '쿠폰 확인 중 오류가 발생했습니다.' };
  }
}

/**
 * 사용자의 쿠폰 사용 횟수 조회
 */
async function getUserCouponUsageCount(userId, couponId) {
  try {
    const usageRef = collection(db, 'couponUsage');
    const q = query(
      usageRef,
      where('userId', '==', userId),
      where('couponId', '==', couponId)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('쿠폰 사용 횟수 조회 오류:', error);
    return 0;
  }
}

/**
 * 쿠폰 사용 처리
 */
export async function applyCoupon(couponId, userId, orderId, productId, discountAmount) {
  try {
    // 사용자 정보
    const currentUser = auth.currentUser;
    const userName = currentUser?.displayName || null;
    const userEmail = currentUser?.email || null;

    // 쿠폰 사용 내역 저장
    await addDoc(collection(db, 'couponUsage'), {
      couponId: couponId,
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      orderId: orderId,
      productId: productId,
      discountAmount: discountAmount,
      usedAt: serverTimestamp()
    });
    
    // 쿠폰 사용 횟수 증가
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, {
      usedCount: increment(1)
    });
    
    console.log('✅ 쿠폰 사용 처리 완료:', couponId);
    return true;
  } catch (error) {
    console.error('쿠폰 사용 처리 오류:', error);
    return false;
  }
}

/**
 * 쿠폰 취소 처리 (환불 시)
 */
export async function cancelCoupon(orderId) {
  try {
    // 해당 주문의 쿠폰 사용 내역 조회
    const usageRef = collection(db, 'couponUsage');
    const q = query(usageRef, where('orderId', '==', orderId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('취소할 쿠폰 사용 내역이 없습니다.');
      return true;
    }
    
    const usageDoc = snapshot.docs[0];
    const usage = usageDoc.data();
    
    // 쿠폰 사용 횟수 감소
    const couponRef = doc(db, 'coupons', usage.couponId);
    await updateDoc(couponRef, {
      usedCount: increment(-1)
    });
    
    // 사용 내역 삭제
    await deleteDoc(usageDoc.ref);
    
    console.log('✅ 쿠폰 취소 처리 완료:', usage.couponId);
    return true;
  } catch (error) {
    console.error('쿠폰 취소 처리 오류:', error);
    return false;
  }
}

