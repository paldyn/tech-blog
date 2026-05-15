---
title: "Agentic RAG: 에이전트가 스스로 검색하고 추론하는 시스템"
description: "단순 검색-생성을 넘어 에이전트가 도구를 자율 선택하고 반복 추론하는 Agentic RAG의 아키텍처, 라우터 RAG vs 에이전트 RAG 비교, LangGraph 구현까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["RAG", "AgenticRAG", "LangGraph", "ReAct", "에이전트", "도구사용"]
featured: false
draft: false
---

[지난 글](/posts/rag-multi-hop/)에서 여러 단계의 검색을 연쇄해 복잡한 질문을 해결하는 멀티홉 RAG를 다뤘다. Agentic RAG는 그 연장선에 있지만 결정적인 차이가 있다. 멀티홉 RAG는 검색 단계가 사전에 정의된 반면, **Agentic RAG는 에이전트가 매 순간 상황을 판단해 어떤 도구를 사용할지 스스로 결정한다.** 벡터 검색, 웹 검색, SQL 쿼리, API 호출 중 무엇이 필요한지 에이전트가 추론하고, 결과를 보고 다음 행동을 결정하는 자율적인 루프가 핵심이다.

## Agentic RAG의 등장 배경

전통적인 RAG 파이프라인은 **고정된 구조**를 가진다. 쿼리가 들어오면, 벡터 검색을 하고, 컨텍스트를 붙여 LLM에 전달한다. 이 파이프라인은 단순하고 예측 가능하지만 세 가지 한계를 가진다.

1. **단일 데이터 소스**: 벡터 인덱스 외의 데이터(데이터베이스, 웹, API)에 접근 불가
2. **고정 홉 수**: 복잡성에 관계없이 항상 한 번 검색
3. **오류 수정 불가**: 검색 결과가 부족해도 재시도하지 않음

에이전트 패러다임은 LLM을 오케스트레이터로 사용해 이 모든 한계를 극복한다.

![Agentic RAG 아키텍처](/assets/posts/rag-agentic-rag-architecture.svg)

## ReAct 루프: 에이전트의 작동 원리

Agentic RAG의 핵심은 **ReAct(Reason + Act)** 루프다. 에이전트는 Thought → Action → Observation 사이클을 반복하며 문제를 해결한다.

```python
from langchain_anthropic import ChatAnthropic
from langchain.agents import create_react_agent, AgentExecutor
from langchain.tools import Tool

# 도구 정의
vector_search_tool = Tool(
    name="VectorSearch",
    description="사내 문서와 지식 베이스 검색. 정책, 매뉴얼, 내부 보고서 조회에 사용.",
    func=lambda q: vectorstore.similarity_search(q, k=5)
)

web_search_tool = Tool(
    name="WebSearch",
    description="실시간 인터넷 검색. 최신 뉴스, 현재 가격, 외부 정보 조회에 사용.",
    func=web_search_fn
)

sql_tool = Tool(
    name="SQLQuery",
    description="데이터베이스 쿼리. 정형 데이터, 통계, 집계 정보 조회에 사용.",
    func=execute_sql
)

# ReAct 에이전트 생성
llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)
agent = create_react_agent(llm=llm, tools=[vector_search_tool, web_search_tool, sql_tool])
executor = AgentExecutor(agent=agent, tools=[...], verbose=True, max_iterations=10)

# 에이전트 실행 - 내부에서 자동으로 도구 선택
result = executor.invoke({
    "input": "우리 회사의 AI 정책과 최근 EU AI Act를 비교해줘"
})
```

에이전트가 내부적으로 생성하는 추론:
```
Thought: 두 가지 정보가 필요하다. 회사 AI 정책은 사내 문서에 있고, 
         EU AI Act는 웹 검색이 필요하다.
Action: VectorSearch
Action Input: "AI 사용 정책 가이드라인"
Observation: [사내 정책 문서 반환]

Thought: 이제 EU AI Act를 찾아야 한다.
Action: WebSearch  
Action Input: "EU AI Act 2024 주요 내용"
Observation: [웹 검색 결과 반환]

Thought: 두 문서를 비교해 답변할 수 있다.
Final Answer: [비교 분석 답변]
```

## LangGraph로 구조화된 Agentic RAG

복잡한 에이전트 로직은 LangGraph의 그래프로 명시적으로 표현하면 디버깅과 제어가 훨씬 쉬워진다.

```python
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

# 도구 노드 (병렬 도구 실행 지원)
tool_node = ToolNode(tools=[vector_search_tool, web_search_tool, sql_tool])

def agent_node(state: MessagesState):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: MessagesState) -> str:
    last_msg = state["messages"][-1]
    if last_msg.tool_calls:
        return "tools"
    return END

# 그래프 구성
workflow = StateGraph(MessagesState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {"tools": "tools", END: END}
)
workflow.add_edge("tools", "agent")  # 도구 결과 → 다시 에이전트

app = workflow.compile()
```

![Agentic RAG 패턴 비교](/assets/posts/rag-agentic-rag-patterns.svg)

## 자기 반성(Self-RAG)과 교정(Corrective RAG)

Agentic RAG의 고급 변형으로, 에이전트가 검색 결과를 스스로 평가하고 품질이 낮으면 재검색하는 패턴이다.

```python
def corrective_rag_node(state):
    docs = state["documents"]
    question = state["question"]

    # 각 문서의 관련성 평가
    filtered = []
    needs_web_search = False

    for doc in docs:
        grade = grader_llm.invoke(
            f"질문: {question}\n문서: {doc.page_content}\n"
            f"관련 있으면 'yes', 없으면 'no'로만 답하라:"
        ).content.strip().lower()

        if grade == "yes":
            filtered.append(doc)
        else:
            needs_web_search = True  # 품질 낮으면 웹 검색 트리거

    return {
        "documents": filtered,
        "web_search_needed": needs_web_search or len(filtered) < 2
    }
```

## 주의사항과 안전장치

에이전트가 자율적으로 행동할수록 통제가 어려워진다. 프로덕션 배포 시 반드시 고려해야 할 사항들:

1. **최대 반복 횟수 제한**: `max_iterations=10`처럼 무한 루프 방지
2. **도구 권한 최소화**: 쓰기 권한 없는 읽기 전용 도구만 제공
3. **비용 모니터링**: 에이전트 루프는 LLM 호출을 여러 번 하므로 비용이 예상보다 클 수 있음
4. **타임아웃 설정**: 전체 에이전트 실행에 최대 시간 제한
5. **인간 검토 포인트**: 중요 결정 전 사람의 승인을 받는 human-in-the-loop 패턴 고려

Agentic RAG는 강력하지만 예측 불가능성이 증가한다. 단순한 작업에는 전통적인 RAG를, 복잡한 다단계 작업에만 Agentic RAG를 선택적으로 적용하는 것이 현명하다.

---

**지난 글:** [RAG 멀티홉 추론: 복잡한 질문을 단계적으로 해결하기](/posts/rag-multi-hop/)

**다음 글:** [Graph RAG: 지식 그래프로 RAG의 한계를 극복하다](/posts/rag-graph-rag/)

<br>
읽어주셔서 감사합니다. 😊
