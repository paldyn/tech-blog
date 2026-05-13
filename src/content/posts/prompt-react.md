---
title: "ReAct: 추론과 행동을 결합한 에이전트 프롬프팅"
description: "Yao et al. 2022의 ReAct 프레임워크 원리, Thought-Action-Observation 루프, 도구 통합 구현, LangChain과의 관계, 한계 및 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["ReAct", "에이전트", "프롬프트엔지니어링", "LLM", "도구사용", "ToolUse", "AI에이전트", "프롬프팅"]
featured: false
draft: false
---

[지난 글](/posts/prompt-tree-of-thought/)에서 여러 추론 경로를 탐색하는 Tree-of-Thought를 살펴봤다. ToT는 LLM 내부의 사고를 확장하는 기법이다. 이번 글에서 다룰 **ReAct**는 방향이 다르다. LLM이 사고(Reasoning)와 행동(Acting)을 번갈아가며 **외부 세계와 상호작용**하도록 만드는 프레임워크다. 검색, 계산기, 데이터베이스 조회 등 도구를 호출하고 그 결과를 다시 추론에 반영하는 구조는 오늘날 모든 LLM 에이전트의 기초가 됐다.

## ReAct란 무엇인가

**ReAct**(Reasoning + Acting)는 2022년 Princeton·Google의 Yao et al.이 제안한 프롬프팅 패러다임이다. 핵심 아이디어는 세 가지 토큰 타입을 번갈아 생성하는 것이다.

1. **Thought**: LLM이 내부적으로 추론하는 텍스트 ("어떤 정보가 필요한지", "다음 단계는 무엇인지")
2. **Action**: 실행할 도구와 인자를 명시하는 텍스트 (`Search["쿼리"]`, `Calculator[식]`)
3. **Observation**: 도구 실행 결과를 환경에서 받아 컨텍스트에 주입

이 세 단계가 반복되면서 모델은 점점 더 많은 정보를 축적하고, 최종적으로 답을 생성한다.

![ReAct 루프: Thought → Action → Observation](/assets/posts/prompt-react-loop.svg)

## 왜 ReAct가 필요한가

순수 LLM은 두 가지 근본 한계를 가진다.

**1. 지식 단절(Knowledge Cutoff)**: 학습 데이터 이후 발생한 사건을 모른다. 현재 날씨, 최신 뉴스, 실시간 주가는 검색 도구 없이는 알 수 없다.

**2. 계산 오류**: LLM은 수학 계산에 취약하다. "2,847 × 193"을 틀릴 수 있지만, Python 실행기로 넘기면 정확하다.

CoT는 이 두 문제를 해결하지 못한다. ReAct는 외부 도구를 통합함으로써 LLM을 "모든 것을 아는 오라클"이 아닌 "도구를 조율하는 에이전트"로 전환한다.

![ReAct 트레이스 예시](/assets/posts/prompt-react-tools.svg)

## 구현: ReAct 에이전트 만들기

ReAct 에이전트의 핵심은 **Thought-Action-Observation 루프**를 파싱하고 실행하는 것이다.

```python
import re
import anthropic

client = anthropic.Anthropic()

# 도구 정의
def search(query: str) -> str:
    # 실제 구현에서는 SerpAPI, Brave Search 등 연결
    return f"검색 결과: '{query}'에 대한 정보..."

def calculator(expression: str) -> str:
    try:
        result = eval(expression, {"__builtins__": {}})
        return str(result)
    except Exception as e:
        return f"계산 오류: {e}"

TOOLS = {"Search": search, "Calculator": calculator}

REACT_SYSTEM = """당신은 도구를 사용해 질문에 답하는 에이전트입니다.

다음 형식으로만 응답하세요:
Thought: [현재 상황 분석 및 다음 행동 계획]
Action: ToolName[입력값]

또는 최종 답변 시:
Thought: [최종 분석]
Final Answer: [답변]

사용 가능한 도구:
- Search[쿼리]: 웹 검색
- Calculator[수식]: 계산기"""

def react_agent(question: str, max_steps: int = 6) -> str:
    messages = [{"role": "user", "content": question}]
    trajectory = []

    for step in range(max_steps):
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            system=REACT_SYSTEM,
            messages=messages
        )
        output = response.content[0].text
        trajectory.append(f"Step {step+1}:\n{output}")

        # Final Answer 감지
        if "Final Answer:" in output:
            answer = output.split("Final Answer:")[-1].strip()
            return answer

        # Action 파싱 및 실행
        action_match = re.search(r'Action:\s*(\w+)\[(.+?)\]', output, re.DOTALL)
        if action_match:
            tool_name = action_match.group(1)
            tool_input = action_match.group(2).strip().strip('"\'')

            if tool_name in TOOLS:
                observation = TOOLS[tool_name](tool_input)
            else:
                observation = f"알 수 없는 도구: {tool_name}"

            # Observation을 컨텍스트에 추가
            messages.append({"role": "assistant", "content": output})
            messages.append({
                "role": "user",
                "content": f"Observation: {observation}"
            })
        else:
            break  # Action 없으면 종료

    return "최대 스텝 초과 — 답을 찾지 못했습니다."

# 실행
question = "파이썬의 현재 최신 버전은 무엇이며, 3.10과 비교해 몇 버전 차이인가?"
answer = react_agent(question)
print(f"답: {answer}")
```

## Claude의 Tool Use API와 ReAct

최신 Claude 모델은 ReAct 패턴을 직접 구현하는 것보다 **공식 Tool Use API**를 활용하는 것이 더 강력하고 신뢰성 있다.

```python
tools = [
    {
        "name": "search",
        "description": "웹 검색으로 최신 정보를 가져옵니다",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "검색 쿼리"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "calculator",
        "description": "수학 계산을 수행합니다",
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "계산할 수식"}
            },
            "required": ["expression"]
        }
    }
]

def react_with_tool_use(question: str) -> str:
    messages = [{"role": "user", "content": question}]

    while True:
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            tools=tools,
            messages=messages
        )

        if response.stop_reason == "end_turn":
            return response.content[0].text

        if response.stop_reason == "tool_use":
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []
            for tu in tool_uses:
                if tu.name == "search":
                    result = search(tu.input["query"])
                elif tu.name == "calculator":
                    result = calculator(tu.input["expression"])
                else:
                    result = "알 수 없는 도구"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": result
                })

            messages.append({"role": "user", "content": tool_results})
        else:
            break

    return "완료되지 않음"
```

## ReAct의 장점과 한계

**장점:**
- 실시간 정보 접근 가능
- 계산·조회 등 LLM이 약한 부분을 도구로 보완
- 추론 과정이 투명하게 기록됨 (감사 추적 용이)
- 필요한 단계수만큼만 반복해 유연한 처리

**한계:**
- **반복 호출 비용**: 각 단계마다 LLM 호출이 필요해 지연·비용 증가
- **오류 전파**: 초반 Action이 잘못된 쿼리를 던지면 이후 Observation도 오염됨
- **무한 루프**: 답을 못 찾고 계속 Action을 반복할 수 있어 스텝 수 제한 필수
- **환각 Action**: 존재하지 않는 도구나 잘못된 인자로 호출할 수 있음

ReAct는 오늘날 LangChain, LlamaIndex, CrewAI 등 거의 모든 에이전트 프레임워크의 기반 패턴이다. 다음 글에서 다룰 Self-Consistency와 결합하면 단일 ReAct 에이전트 경로의 불안정성도 보완할 수 있다.

---

**지난 글:** [Tree-of-Thought: 여러 추론 경로를 탐색하다](/posts/prompt-tree-of-thought/)

**다음 글:** [Self-Consistency: 다수결로 정확도를 높이다](/posts/prompt-self-consistency/)

<br>
읽어주셔서 감사합니다. 😊
