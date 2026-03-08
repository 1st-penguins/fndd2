"""
생활스포츠지도사 기출문제 해설 자동 생성 스크립트
- Claude Vision API로 문제 이미지를 읽어 해설 생성
- data/sports/*.json 파일의 explanation 필드 업데이트
"""

import os
import json
import base64
import time
import glob
import anthropic

API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not API_KEY:
    raise SystemExit("ANTHROPIC_API_KEY 환경변수를 설정하세요.\nexport ANTHROPIC_API_KEY='sk-ant-...'")

client = anthropic.Anthropic(api_key=API_KEY)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "sports")
IMAGE_BASE = BASE_DIR  # 이미지 경로는 프로젝트 루트 기준

PLACEHOLDER = ["이 문제의 정답은", "##", "**"]  # 해설이 없거나 재생성 필요한 패턴


def is_placeholder(explanation):
    return not explanation or any(p in explanation for p in PLACEHOLDER)


def image_to_base64(image_path):
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def build_prompt(correct_answer, subject, year):
    """정답 유형에 따라 프롬프트 생성"""
    is_list = isinstance(correct_answer, list)
    all_correct = is_list and sorted(correct_answer) == [0, 1, 2, 3]
    is_multiple = is_list and not all_correct

    if all_correct:
        answer_info = "정답: 모두 정답 (문제 오류로 전항 정답 처리)"
        format_block = """[출력 형식 - 아래 구조 그대로, 줄바꿈 포함]
문제 오류: 모두 정답 처리된 문항입니다.

(문제 오류 또는 출제 기준 변경으로 인해 전항이 정답으로 처리된 이유를 2~3문장으로 설명.)

시험 포인트: (이 문제에서 다루는 핵심 개념 한 줄)"""
    elif is_multiple:
        nums = ", ".join(str(i + 1) for i in sorted(correct_answer))
        answer_info = f"정답: {nums}번 (복수정답)"
        wrong = [i for i in range(4) if i not in correct_answer]
        wrong_lines = "\n".join(f"{i+1}번: (오답인 이유 한 줄)" for i in wrong)
        format_block = f"""[출력 형식 - 아래 구조 그대로, 줄바꿈 포함]
복수정답 {nums}번: (각 정답 선택지의 공통 핵심을 한 줄로 요약)

(각 정답 선택지가 옳은 이유를 2~3문장으로 설명.)

오답 정리
{wrong_lines}

시험 포인트: (핵심 키워드나 암기 포인트 한 줄)"""
    else:
        correct_num = correct_answer + 1
        answer_info = f"정답: {correct_num}번"
        wrong_nums = [i + 1 for i in range(4) if i != correct_answer]
        wrong_lines = "\n".join(f"{n}번: (오답인 이유 한 줄)" for n in wrong_nums)
        format_block = f"""[출력 형식 - 아래 구조 그대로, 줄바꿈 포함]
정답 {correct_num}번: (정답 선택지 내용 한 줄 요약)

(정답인 이유를 2~3문장으로 설명. 핵심 개념 중심으로 간결하게.)

오답 정리
{wrong_lines}

시험 포인트: (핵심 키워드나 암기 포인트 한 줄)"""

    return f"""당신은 2급 생활스포츠지도사 시험 전문 강사입니다.
아래 기출문제 이미지를 보고 해설을 작성해주세요.

과목: {subject}
연도: {year}년
{answer_info}

해설 작성 규칙:
1. 마크다운 문법 절대 금지 (##, **, >, |, - 기호 사용 금지)
2. 영어 용어 괄호 표기 금지 (강화(Reinforcement) X → 강화 O)
3. 이모지 사용 금지

{format_block}

위 형식 그대로만 출력하세요. 다른 말은 하지 마세요."""


def generate_explanation(image_path, correct_answer, subject, year):
    """Claude Vision API로 해설 생성"""
    img_b64 = image_to_base64(image_path)
    prompt = build_prompt(correct_answer, subject, year)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=700,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": img_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    return response.content[0].text.strip()


def process_file(json_path):
    filename = os.path.basename(json_path)
    year = filename[:4]
    subject = filename[5:].replace(".json", "")

    with open(json_path, "r", encoding="utf-8") as f:
        questions = json.load(f)

    updated = 0
    for q in questions:
        if not is_placeholder(q.get("explanation", "")):
            continue  # 이미 해설 있음

        image_rel = q.get("questionImage", "")
        image_path = os.path.join(IMAGE_BASE, image_rel)

        if not os.path.exists(image_path):
            print(f"  [스킵] 이미지 없음: {image_rel}")
            continue

        try:
            ca = q["correctAnswer"]
            if isinstance(ca, list):
                tag = " [모두정답]" if sorted(ca) == [0, 1, 2, 3] else f" [복수정답:{[i+1 for i in sorted(ca)]}]"
            else:
                tag = ""
            print(f"  문제 {q['id']}{tag} 해설 생성 중...", end=" ", flush=True)
            explanation = generate_explanation(
                image_path, q["correctAnswer"], subject, year
            )
            q["explanation"] = explanation
            updated += 1
            print("완료")
            time.sleep(0.5)  # API 레이트 리밋 방지
        except Exception as e:
            print(f"오류: {e}")
            continue

    if updated > 0:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"  -> {updated}개 해설 저장 완료\n")
    else:
        print(f"  -> 업데이트 없음\n")

    return updated


def main():
    json_files = sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))
    print(f"총 {len(json_files)}개 파일 처리 시작\n")

    total = 0
    for json_path in json_files:
        filename = os.path.basename(json_path)
        print(f"[{filename}]")
        total += process_file(json_path)

    print(f"\n완료. 총 {total}개 해설 생성됨.")


if __name__ == "__main__":
    import sys
    # --file 옵션으로 특정 파일만 처리: python script.py --file 2022_스포츠사회학
    if len(sys.argv) == 3 and sys.argv[1] == "--file":
        target = sys.argv[2]
        path = os.path.join(DATA_DIR, f"{target}.json")
        if not os.path.exists(path):
            raise SystemExit(f"파일 없음: {path}")
        print(f"[{target}.json] 단일 처리 모드\n")
        process_file(path)
    else:
        main()
