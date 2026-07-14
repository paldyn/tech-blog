---
title: "OpenAI Codex와 ChatGPT: AI 코딩의 시작점"
description: "2021년 Codex부터 ChatGPT, GPT-4, GPT-4o, o-series까지 OpenAI 코딩 AI의 진화를 추적하고, Code Interpreter·Canvas·Codex CLI의 실전 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["Codex", "ChatGPT", "GPT4o", "OpenAI", "AI코딩", "CodeInterpreter", "o-series"]
featured: false
draft: false
---

[지난 글](/posts/ai-coding-claude-code/)에서 Anthropic의 Claude Code를 살펴봤다. 이번엔 현대 AI 코딩 도구들의 출발점이 된 **OpenAI Codex**와 그 후속 제품들의 흐름을 따라간다. 오늘날 우리가 당연하게 쓰는 AI 코딩 도구 대부분의 뿌리가 여기에 있다.

## Codex: 모든 것의 시작

2021년 8월, OpenAI가 **Codex**를 발표했다. GPT-3를 GitHub 공개 코드로 파인튜닝한 모델로, 자연어를 코드로 변환하는 능력을 처음으로 대중에게 보여줬다. HumanEval 벤치마크에서 28.8%라는 당시로서는 놀라운 성과를 기록했고, GitHub Copilot의 초기 기반 모델이 됐다.

![OpenAI 코딩 AI 진화](/assets/posts/ai-coding-codex-evolution.svg)

Codex API는 2022년까지 공개되어 많은 AI 코딩 도구의 기반이 됐지만, GPT-3.5-turbo가 코딩 성능에서도 우위를 보이면서 2023년 3월 공식 deprecated됐다.

## ChatGPT: 대화형 코딩의 시대

2022년 11월 출시된 ChatGPT는 GPT-3.5에 RLHF를 적용한 모델로, AI 코딩 도구의 대중화를 이끌었다. 전용 코딩 도구가 아니었음에도 불구하고 대화 형식의 디버깅, 리팩토링, 코드 설명이 가능하다는 사실이 개발자들 사이에서 폭발적으로 퍼졌다.

ChatGPT로 코드 작업 시 효과적인 패턴:

```python
# 1. 에러 메시지와 코드를 함께 붙여넣기
"""
다음 에러가 발생합니다:
    TypeError: unsupported operand type(s) for +: 'int' and 'str'

코드:
def calculate_total(items):
    total = 0
    for item in items:
        total = total + item['price']  # ← 여기서 에러
    return total

수정해주세요.
"""

# 2. 요구사항을 구체적으로 명시
"""
Python으로 다음 기능을 구현해줘:
- 입력: 주문 목록 (order_id, amount, status 포함)
- 처리: status가 'completed'인 주문의 amount 합계
- 출력: 합계와 건수를 딕셔너리로 반환
- 조건: type hint 포함, docstring 포함
"""
```

## Code Interpreter: 실행하는 AI

2023년 7월 ChatGPT에 통합된 **Code Interpreter**(현재 'Python 분석')는 GPT-4가 실제 Python 코드를 실행하고 결과를 보여주는 기능이다. 데이터 분석, 시각화, 파일 처리가 가능해 데이터 사이언티스트들에게 혁신적인 도구가 됐다.

```python
# Code Interpreter에서 실행 가능한 작업들
"""
다음 CSV 파일을 업로드하고 분석해줘:
1. 결측값 현황 파악
2. 각 수치형 컬럼의 분포 시각화
3. 매출과 다른 변수들 간의 상관관계 히트맵
4. 이상값(outlier) 탐지 결과
5. 월별 매출 트렌드 그래프

모든 그래프는 한국어 레이블로 그려줘.
"""
```

## GPT-4o API 코드 생성

![OpenAI API 코딩 활용 예시](/assets/posts/ai-coding-codex-api.svg)

GPT-4o는 현재 OpenAI의 주력 모델로, 코드 생성에서도 매우 강력하다.

```python
from openai import OpenAI

client = OpenAI()

def generate_code(specification: str, language: str = "python") -> str:
    """
    자연어 명세를 코드로 변환
    """
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": f"""당신은 {language} 전문가입니다.
다음 명세에 따라 코드를 생성하세요:
- 타입 힌트 필수
- 에러 처리 포함
- 주석은 한국어
- 테스트 코드도 함께 제공"""
            },
            {
                "role": "user",
                "content": specification
            }
        ],
        temperature=0.1,  # 코드 생성은 낮은 temperature 권장
    )
    return response.choices[0].message.content

code = generate_code(
    "이메일 유효성 검사 함수. RFC 5322 표준 준수."
)
print(code)
```

### Tool Calling으로 코드 실행 통합

GPT-4o의 Tool Calling을 활용하면 AI가 직접 코드를 실행하는 시스템을 만들 수 있다.

```python
import subprocess
import json
from openai import OpenAI

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "run_python",
            "description": "Python 코드를 실행하고 결과를 반환",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "실행할 Python 코드"}
                },
                "required": ["code"]
            }
        }
    }
]

def run_python(code: str) -> str:
    result = subprocess.run(
        ["python", "-c", code],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout or result.stderr

messages = [{"role": "user", "content": "1부터 100까지 소수를 모두 출력해줘"}]

response = client.chat.completions.create(
    model="gpt-4o", tools=tools, messages=messages
)

if response.choices[0].message.tool_calls:
    call = response.choices[0].message.tool_calls[0]
    args = json.loads(call.function.arguments)
    output = run_python(args['code'])
    print(f"실행 결과:\n{output}")
```

## o-series: 추론하는 코딩 AI

2024년 말 OpenAI가 출시한 **o-series**(o1, o3, o4-mini)는 기존 모델과 다른 패러다임이다. 답변을 바로 생성하는 대신 내부적으로 **단계별 추론(Chain of Thought)**을 수행하고 최종 답을 반환한다.

복잡한 알고리즘 문제나 까다로운 버그에서 특히 강력하다.

```python
# o4-mini로 알고리즘 문제 해결
response = client.chat.completions.create(
    model="o4-mini",
    reasoning_effort="high",  # low / medium / high
    messages=[{
        "role": "user",
        "content": """
        다음 문제를 O(n log n) 이내로 해결하는 Python 코드를 작성해줘:
        
        n개의 정수 배열에서 두 원소의 합이 target과 같은
        모든 쌍의 인덱스를 반환하라.
        같은 인덱스는 두 번 사용할 수 없으며,
        결과의 순서는 상관없다.
        
        예: nums=[2,7,11,15], target=9 → [[0,1]]
        """
    }]
)
```

HumanEval 기준으로 o4-mini는 92% 이상의 통과율을 기록한다. 이는 상위 인간 프로그래머 수준이다.

## Codex CLI: 터미널 에이전트

2025년 OpenAI는 **Codex CLI**를 출시했다. Claude Code와 비슷한 콘셉트로, 터미널에서 o-series 모델을 에이전트로 실행한다.

```bash
# 설치
npm install -g @openai/codex

# 실행
codex

# 자동 승인 모드 (주의해서 사용)
codex --approval-mode auto-edit "테스트 파일 작성해줘"
```

## Canvas: 협업 코딩 환경

ChatGPT의 **Canvas** 기능은 코드를 별도 패널에서 실시간으로 편집할 수 있게 한다. 코드를 작성한 후 특정 부분을 선택해 수정 요청, 버그 수정, 주석 추가를 요청할 수 있다.

```text
Canvas 활용 패턴:
1. "Python으로 파일 업로드 API 만들어줘" → Canvas에 코드 생성
2. validate_file 함수 선택 → "파일 크기 제한 로직 추가해줘"
3. 에러 처리 부분 선택 → "더 구체적인 에러 메시지로 수정해줘"
4. "이 코드의 유닛 테스트 추가해줘" → Canvas에 테스트 코드 추가
```

## 선택 가이드

| 작업 | 추천 도구 |
|---|---|
| 빠른 코드 스니펫 | ChatGPT (GPT-4o) |
| 데이터 분석·시각화 | Code Interpreter |
| 복잡한 알고리즘 | o4-mini / o3 |
| 멀티파일 프로젝트 | Codex CLI |
| 대화형 리팩토링 | Canvas |
| CI/CD 통합 | OpenAI API + Tool Calling |

---

**지난 글:** [Claude Code: 터미널에서 만나는 AI 소프트웨어 엔지니어](/posts/ai-coding-claude-code/)

**다음 글:** [Aider: AI 페어 프로그래머와 Git 통합 개발](/posts/ai-coding-aider/)

<br>
읽어주셔서 감사합니다. 😊
