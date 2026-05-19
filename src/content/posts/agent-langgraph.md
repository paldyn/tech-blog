---
title: "LangGraph 완전 가이드: 상태 기반 에이전트 워크플로우"
description: "LangGraph의 StateGraph, Node, Edge, Conditional Edge, Checkpointer, Human-in-the-Loop까지 실전 Python 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["LangGraph", "StateGraph", "에이전트", "워크플로우", "Checkpointer", "Human-in-the-Loop", "LangChain"]
featured: false
draft: false
---

[지난 글](/posts/agent-langchain/)에서 LangChain의 LCEL과 에이전트 기본 구조를 살펴봤다. 이번 글에서는 LangGraph를 다룬다. LangGraph는 LangChain 팀이 개발한 **상태 기계(State Machine)** 기반 프레임워크로, 복잡한 멀티 스텝 에이전트 워크플로우를 그래프 형태로 명시적으로 표현한다.

## LangGraph란

LangGraph는 **순환 가능한 방향 그래프(Cyclic Directed Graph)**로 에이전트 로직을 모델링한다. LangChain의 LCEL이 선형 파이프라인에 강점이 있다면, LangGraph는 루프·분기·병렬 실행이 섞인 복잡한 워크플로우에 최적화되어 있다.

핵심 개념은 세 가지다:
- **State**: 그래프 전체가 공유하는 TypedDict 형태의 상태 객체
- **Node**: 상태를 받아 변경된 상태를 반환하는 Python 함수
- **Edge**: 노드 간 전이를 정의 (고정 Edge 또는 조건부 Conditional Edge)

![LangGraph StateGraph 구조](/assets/posts/agent-langgraph-stategraph.svg)

## 기본 StateGraph 구현

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage
import operator

# 1. State 정의 (TypedDict)
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    tool_calls_made: int

# 2. LLM과 도구 준비
from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """웹에서 정보를 검색합니다."""
    return f"'{query}' 검색 결과: 관련 정보입니다."

@tool
def calculator(expression: str) -> str:
    """수식을 계산합니다. 예: '2+3*4'"""
    import ast
    result = ast.literal_eval(expression)
    return str(result)

tools = [web_search, calculator]
llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)
llm_with_tools = llm.bind_tools(tools)

# 3. Node 함수 정의
def agent_node(state: AgentState) -> dict:
    """LLM을 호출해 다음 액션을 결정하는 노드"""
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# ToolNode: 도구 자동 실행 헬퍼
tool_node = ToolNode(tools)

# 4. 조건부 엣지 라우팅 함수
def should_continue(state: AgentState) -> str:
    """마지막 메시지에 tool_calls가 있으면 tools로, 없으면 END로"""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END

# 5. 그래프 조립
graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)

graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")  # 도구 실행 후 agent로 복귀 (루프)

app = graph.compile()

# 실행
result = app.invoke({
    "messages": [HumanMessage(content="파이썬의 현재 최신 버전을 검색하고, 그 숫자를 제곱해줘")],
    "tool_calls_made": 0,
})
print(result["messages"][-1].content)
```

## Checkpointer: 상태 영속화

Checkpointer는 매 스텝마다 상태를 저장해 **대화 재개, 디버깅, Human-in-the-Loop**을 가능하게 한다.

![LangGraph Checkpointer & Human-in-the-Loop](/assets/posts/agent-langgraph-checkpoint.svg)

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

# 메모리 체크포인터 (개발/테스트용)
memory = MemorySaver()

# SQLite 체크포인터 (프로덕션)
sqlite_saver = SqliteSaver.from_conn_string("checkpoints.db")

# Human-in-the-Loop: tools 노드 실행 전 인터럽트
app = graph.compile(
    checkpointer=memory,
    interrupt_before=["tools"],  # tools 노드 전에 멈춤
)

config = {"configurable": {"thread_id": "conv-001"}}

# 1단계: agent 실행 → tools 앞에서 중단
events = app.stream(
    {"messages": [HumanMessage(content="구글 주가를 검색해줘")]},
    config=config,
    stream_mode="values",
)
for event in events:
    if "messages" in event:
        event["messages"][-1].pretty_print()

# 현재 상태 확인 (agent의 tool_calls 포함)
state = app.get_state(config)
print("pending tool calls:", state.next)

# 2단계: 사람 검토 후 승인 → 실행 재개
print("\n→ 도구 실행을 승인합니다.")
for event in app.stream(None, config=config, stream_mode="values"):
    if "messages" in event:
        event["messages"][-1].pretty_print()

# 상태 수정 (도구 인자 변경)
app.update_state(
    config,
    {"messages": [HumanMessage(content="아, 애플 주가로 바꿔줘")]},
    as_node="agent",
)
```

## 멀티 에이전트 그래프

LangGraph는 여러 전문 에이전트를 하나의 그래프로 조합하는 **멀티 에이전트 아키텍처**를 자연스럽게 표현한다.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal

class ResearchState(TypedDict):
    query: str
    research_notes: str
    draft: str
    feedback: str
    revision_count: int
    final_output: str

# 각 에이전트는 독립적인 노드
def researcher(state: ResearchState) -> dict:
    """웹 검색 및 정보 수집 전문 에이전트"""
    prompt = f"다음 주제를 조사하세요: {state['query']}"
    notes = llm.invoke(prompt).content
    return {"research_notes": notes}

def writer(state: ResearchState) -> dict:
    """리서치 노트를 바탕으로 초안 작성 에이전트"""
    prompt = f"노트: {state['research_notes']}\n\n글을 작성하세요."
    draft = llm.invoke(prompt).content
    return {"draft": draft, "revision_count": state.get("revision_count", 0)}

def reviewer(state: ResearchState) -> dict:
    """초안을 검토하고 피드백 제공 에이전트"""
    prompt = f"초안을 검토하고 피드백을 주세요:\n{state['draft']}"
    feedback = llm.invoke(prompt).content
    return {"feedback": feedback}

def revise_or_finish(state: ResearchState) -> Literal["writer", "finish"]:
    """피드백이 있고 수정 횟수가 2 미만이면 재작성, 아니면 완료"""
    if state["revision_count"] < 2 and "개선" in state["feedback"]:
        return "writer"
    return "finish"

def finalize(state: ResearchState) -> dict:
    return {"final_output": state["draft"]}

# 멀티 에이전트 그래프
multi_agent = StateGraph(ResearchState)
multi_agent.add_node("researcher", researcher)
multi_agent.add_node("writer", writer)
multi_agent.add_node("reviewer", reviewer)
multi_agent.add_node("finish", finalize)

multi_agent.set_entry_point("researcher")
multi_agent.add_edge("researcher", "writer")
multi_agent.add_edge("writer", "reviewer")
multi_agent.add_conditional_edges(
    "reviewer",
    revise_or_finish,
    {"writer": "writer", "finish": "finish"},
)
multi_agent.add_edge("finish", END)

pipeline = multi_agent.compile()
result = pipeline.invoke({"query": "LangGraph vs AutoGen 비교", "revision_count": 0})
print(result["final_output"])
```

## 스트리밍 & 시각화

```python
# 토큰 단위 스트리밍
async def stream_agent():
    async for event in app.astream_events(
        {"messages": [HumanMessage(content="AI의 미래는?")]},
        config={"configurable": {"thread_id": "stream-1"}},
        version="v2",
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            print(chunk.content, end="", flush=True)
        elif kind == "on_tool_start":
            print(f"\n[도구 실행] {event['name']}: {event['data']['input']}")
        elif kind == "on_tool_end":
            print(f"[도구 완료] {event['data']['output'][:100]}")

import asyncio
asyncio.run(stream_agent())

# 그래프 시각화 (Mermaid 다이어그램 출력)
print(app.get_graph().draw_mermaid())
# → graph TD; __start__ --> agent; agent -->|tools| tools; ...
```

## LangGraph vs LangChain LCEL

| 구분 | LangChain LCEL | LangGraph |
|------|---------------|-----------|
| 실행 패턴 | 선형 파이프라인 | 순환 그래프 |
| 루프 지원 | 제한적 | 네이티브 지원 |
| 상태 관리 | 수동 | TypedDict로 자동화 |
| 체크포인트 | 없음 | 내장 지원 |
| Human-in-the-Loop | 구현 복잡 | `interrupt_before` 한 줄 |
| 디버깅 | 어려움 | LangSmith 통합, 시각화 |
| 적합한 사용 사례 | RAG, 단순 체인 | 멀티 에이전트, 복잡 워크플로우 |

## 정리

LangGraph는 **상태 기계 패러다임**으로 에이전트 로직을 명시적이고 디버깅하기 쉽게 만든다:

- **StateGraph**: TypedDict로 상태를 정의하고, 노드가 상태를 변경하며, 엣지가 흐름을 제어
- **Conditional Edge**: `should_continue` 같은 라우팅 함수로 동적 분기
- **Checkpointer**: 매 스텝 상태 저장으로 대화 재개와 롤백 지원
- **Human-in-the-Loop**: `interrupt_before`로 특정 노드 전에 사람 개입 삽입
- **멀티 에이전트**: 전문 에이전트를 독립 노드로 구성해 복잡 파이프라인 조합

---

**지난 글:** [LangChain 완전 가이드: 에이전트 프레임워크의 표준](/posts/agent-langchain/)

**다음 글:** [LlamaIndex 완전 가이드: 데이터 중심 LLM 프레임워크](/posts/agent-llamaindex/)

<br>
읽어주셔서 감사합니다. 😊
