#!/bin/bash
# 리틀리 이미지 일괄 다운로드 스크립트
# 사용법: bash download-littly.sh "폴더명" URL1 URL2 URL3 ...
# 예시:  bash download-littly.sh "기능해부학 정규강의" "https://cdn.litt.ly/images/abc..." "https://cdn.litt.ly/images/def..."

FOLDER="$1"
shift

if [ -z "$FOLDER" ] || [ $# -eq 0 ]; then
  echo "사용법: bash download-littly.sh \"폴더명\" URL1 URL2 URL3 ..."
  echo ""
  echo "예시:"
  echo "  bash download-littly.sh \"기능해부학 정규강의\" \\"
  echo "    \"https://cdn.litt.ly/images/abc?s=600x600&f=webp\" \\"
  echo "    \"https://cdn.litt.ly/images/def?s=600x600&f=webp\""
  echo ""
  echo "폴더명 목록 (GALLERY_MAP 기준):"
  echo "  기능해부학 정규강의, 기능해부학 요약본"
  echo "  병태생리학 정규강의, 병태생리학 요약본"
  echo "  운동생리학 정규강의, 운동생리학 요약본"
  echo "  운동부하검사 정규강의, 운동부하검사 요약본"
  echo "  운동처방론 정규강의"
  echo "  운동상해 정규강의, 운동상해 요약본"
  echo "  스포츠심리학 요약본"
  echo "  건강체력평가 정규강의, 건강체력평가 요약본"
  echo "  심전도 특별강의"
  echo "  2급 생체 7일패키지"
  exit 1
fi

BASE_DIR="images/products/건강운동관리사 썸네일/${FOLDER}"
mkdir -p "$BASE_DIR"

echo "📁 저장 경로: $BASE_DIR"
echo "📥 총 ${#} 개 이미지 다운로드 시작..."
echo ""

# 첫 번째 URL(카드 썸네일)은 건너뛰고 2번째부터 저장
SKIP_FIRST=true
COUNT=1
for URL in "$@"; do
  if $SKIP_FIRST; then
    SKIP_FIRST=false
    echo "  [SKIP] 카드 썸네일 (1번) 건너뜀"
    continue
  fi
  # URL에서 쿼리 파라미터의 확장자 확인
  if echo "$URL" | grep -q "f=webp"; then
    EXT="webp"
  elif echo "$URL" | grep -q "f=png"; then
    EXT="png"
  else
    EXT="jpg"
  fi

  FILENAME="${COUNT}.${EXT}"
  echo -n "  [${COUNT}/${#}] ${FILENAME} ... "

  if curl -sL "$URL" -o "${BASE_DIR}/${FILENAME}"; then
    SIZE=$(wc -c < "${BASE_DIR}/${FILENAME}")
    echo "✅ (${SIZE} bytes)"
  else
    echo "❌ 실패"
  fi

  COUNT=$((COUNT + 1))
done

echo ""
echo "✅ 완료! ${BASE_DIR}/ 에 저장됨"
echo "📂 파일 목록:"
ls -la "$BASE_DIR/"
