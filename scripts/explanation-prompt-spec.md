# 생활스포츠지도사 해설 생성 프롬프트 명세

## 공통 규칙

- 마크다운 문법 절대 금지 (##, **, >, |, - 기호 사용 금지)
- 영어 용어 괄호 표기 금지 (강화(Reinforcement) X → 강화 O)
- 이모지 사용 금지
- 섹션 간 빈 줄로 구분 (white-space: pre-line으로 렌더링됨)
- max_tokens: 700

---

## 케이스 1: 단일 정답

```
정답 N번: (정답 선택지 내용 한 줄 요약)

(정답인 이유를 2~3문장으로 설명. 핵심 개념 중심으로 간결하게.)

오답 정리
1번: (오답인 이유 한 줄)   ← 정답 번호 제외, 나머지 3개
2번: (오답인 이유 한 줄)
4번: (오답인 이유 한 줄)

시험 포인트: (핵심 키워드나 암기 포인트 한 줄)
```

---

## 케이스 2: 복수정답 (일부)

예: correctAnswer = [0, 3] → 1번, 4번 정답

```
복수정답 1, 4번: (각 정답 선택지의 공통 핵심을 한 줄로 요약)

(각 정답 선택지가 옳은 이유를 2~3문장으로 설명.)

오답 정리
2번: (오답인 이유 한 줄)   ← 오답 번호만
3번: (오답인 이유 한 줄)

시험 포인트: (핵심 키워드나 암기 포인트 한 줄)
```

---

## 케이스 3: 모두 정답 (문제 오류)

correctAnswer = [0, 1, 2, 3]

```
문제 오류: 모두 정답 처리된 문항입니다.

(문제 오류 또는 출제 기준 변경으로 인해 전항이 정답으로 처리된 이유를 2~3문장으로 설명.)

시험 포인트: (이 문제에서 다루는 핵심 개념 한 줄)
```

---

## 프론트엔드 렌더링

- `css/pages/quiz.css` `.explanation { white-space: pre-line; }`
- JSON에 `\n` 저장 → 브라우저에서 줄바꿈으로 렌더링

## 스크립트 위치

`scripts/generate-explanations.py`

실행:
```bash
export ANTHROPIC_API_KEY='sk-ant-...'
PYTHONIOENCODING=utf-8 python scripts/generate-explanations.py

# 단일 파일만 처리
PYTHONIOENCODING=utf-8 python scripts/generate-explanations.py --file 2022_스포츠사회학
```

## PLACEHOLDER 재생성 조건

`explanation` 필드가 비어있거나 아래 패턴 포함 시 재생성:
- `이 문제의 정답은`
- `##`
- `**`
