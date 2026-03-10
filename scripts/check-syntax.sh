#!/bin/bash
# ESM 모드로 모든 JS 파일 구문 검사
# 사용법: bash scripts/check-syntax.sh
# 오류 있으면 exit 1 반환 → CI/CD 또는 배포 전 실행

set -e

FAILED=0
ERROR_FILES=()

echo "🔍 JS 구문 검사 시작 (ESM 모드)..."
echo ""

while IFS= read -r -d '' file; do
  result=$(node --input-type=module --check < "$file" 2>&1)
  if [ -n "$result" ]; then
    echo "❌  $file"
    echo "    $result"
    echo ""
    FAILED=1
    ERROR_FILES+=("$file")
  fi
done < <(find js -name "*.js" -not -path "*/node_modules/*" -print0)

echo "---"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "🚫 구문 오류 발견: ${#ERROR_FILES[@]}개 파일"
  for f in "${ERROR_FILES[@]}"; do
    echo "   - $f"
  done
  echo ""
  echo "배포 중단: 위 파일의 구문 오류를 수정한 후 다시 실행하세요."
  exit 1
else
  echo "✅ 모든 JS 파일 구문 검사 통과"
  echo "   배포 진행 가능합니다."
fi
