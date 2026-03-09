#!/bin/bash
# 버전 자동 갱신 스크립트
# 사용법: bash bump-version.sh
# sw.js, index.html의 모든 ?v= 쿼리와 CACHE_VERSION, app-version을 한 번에 갱신

NEW_VERSION=$(date +%Y%m%d%H)
echo "새 버전: $NEW_VERSION"

# sw.js CACHE_VERSION 갱신
sed -i "s/const CACHE_VERSION = '[0-9]*'/const CACHE_VERSION = '$NEW_VERSION'/" sw.js

# index.html app-version 메타 태그 갱신
sed -i "s/content=\"[0-9]*\"/content=\"$NEW_VERSION\"/" index.html

# index.html 내 모든 ?v= 쿼리 갱신
sed -i "s/?v=[0-9]*/?v=$NEW_VERSION/g" index.html

echo "완료: sw.js + index.html 버전 → $NEW_VERSION"
