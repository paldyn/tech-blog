---
title: "RAG 멀티홉 추론: 복잡한 질문을 단계적으로 해결하기"
description: "단순 검색으로 풀 수 없는 복합 질문을 여러 단계의 검색과 추론으로 해결하는 멀티홉 RAG의 원리, Iterative Retrieval·IRCoT·FLARE 패턴, 그리고 LangGraph 구현까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["RAG", "멀티홉", "MultiHop", "IRCoT", "FLARE", "LangGraph"]
featured: false
draft: false
---

[지난 글](/posts/rag-query-rewriting/)에서 쿼리 재작성으로 검색 품질을 높이는 방법을 배웠다. 이번에는 훨씬 어려운 문제, 즉 **여러 사실을 연쇄적으로 찾아야만 답할 수 있는 복합 질문**을 다룬다. "AlphaFold를 개발한 회사의 CEO는?"이라는 질문은 단번에 검색해서 답할 수 없다. "AlphaFold 개발사"와 "그 회사의 CEO"를 연속적으로 찾아야 한다. 이처럼 **두 홉 이상의 추론이 필요한 검색**을 멀티홉 RAG(Multi-Hop RAG)라고 한다.

## 왜 단일 검색으로는 부족한가

일반적인 RAG 파이프라인은 쿼리 하나로 단 한 번 검색한다. 이 방식은 "판교의 인구는?"처럼 단순한 사실 질문에는 충분하다. 하지만 다음과 같은 질문에는 한계를 드러낸다.

- "OpenAI CEO의 출신 대학교는?" → OpenAI CEO 확인 → 그 사람의 출신 대학 검색
- "한국의 AI 규제법과 EU AI Act의 공통점은?" → 한국 법률 검색 → EU 법률 검색 → 비교
- "LLaMA를 개발한 회사의 주가는 오늘 얼마인가?" → LLaMA 개발사 확인 → 실시간 주가 검색

이런 질문들은 이전 검색 결과가 다음 검색 쿼리를 결정하는 **의존적 검색 체인**이 필요하다.

![멀티홉 RAG 추론 체인](/assets/posts/rag-multi-hop-reasoning.svg)

## 멀티홉 RAG 구현 패턴

![멀티홉 RAG 구현 패턴 비교](/assets/posts/rag-multi-hop-patterns.svg)

### Iterative Retrieval (반복 검색)

가장 직관적인 구현이다. 쿼리를 하위 질문으로 분해하고, 각 하위 질문을 순서대로 검색한다.

```python
def iterative_retrieval(question, llm, retriever, max_hops=3):
    # 1단계: 하위 질문 목록 생성
    sub_questions = decompose_question(question, llm)

    context_accumulator = []
    answers = []

    for i, sub_q in enumerate(sub_questions[:max_hops]):
        # 이전 답변을 컨텍스트에 포함해 검색 쿼리 구체화
        if answers:
            enriched_q = f"{sub_q} (이전 정보: {'; '.join(answers)})"
        else:
            enriched_q = sub_q

        docs = retriever.invoke(enriched_q)
        context_accumulator.extend(docs)

        # 현재 홉의 중간 답변 생성
        partial_answer = llm.invoke(
            f"질문: {sub_q}\n컨텍스트: {format_docs(docs)}\n간단히 답하라:"
        ).content
        answers.append(partial_answer)

    # 최종 답변 종합
    full_context = format_docs(context_accumulator)
    return llm.invoke(
        f"원본 질문: {question}\n수집된 정보: {full_context}\n최종 답변:"
    ).content
```

### IRCoT (Interleaving Retrieval with Chain-of-Thought)

추론 단계와 검색 단계를 번갈아 실행하는 방식이다. CoT 추론의 각 단계에서 필요한 정보를 실시간으로 검색한다.

```python
def ircot(question, llm, retriever, max_steps=5):
    reasoning_chain = ""
    retrieved_docs = []

    for step in range(max_steps):
        # 현재까지의 추론 + 수집된 정보로 다음 추론 생성
        prompt = f"""질문: {question}
이미 찾은 정보: {format_docs(retrieved_docs)}
지금까지 추론: {reasoning_chain}

다음 추론 단계 하나를 작성하라. 
답을 알면 'FINISH: [답변]'으로 끝내라."""

        thought = llm.invoke(prompt).content

        if "FINISH:" in thought:
            return thought.split("FINISH:")[-1].strip()

        reasoning_chain += f"\n{step+1}. {thought}"

        # 이번 추론에서 필요한 정보 검색
        search_query = extract_search_query(thought, llm)
        new_docs = retriever.invoke(search_query)
        retrieved_docs.extend(new_docs)

    return llm.invoke(
        f"질문: {question}\n정보: {format_docs(retrieved_docs)}\n최종 답변:"
    ).content
```

## LangGraph로 멀티홉 RAG 구현

복잡한 멀티홉 로직은 LangGraph의 그래프 기반 워크플로로 구조화하면 관리가 쉬워진다.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List

class MultiHopState(TypedDict):
    question: str
    sub_questions: List[str]
    current_hop: int
    collected_docs: List[str]
    intermediate_answers: List[str]
    final_answer: str

def decompose_node(state: MultiHopState) -> MultiHopState:
    sub_qs = decompose_question(state["question"], llm)
    return {**state, "sub_questions": sub_qs, "current_hop": 0}

def retrieve_node(state: MultiHopState) -> MultiHopState:
    hop = state["current_hop"]
    sub_q = state["sub_questions"][hop]
    docs = retriever.invoke(sub_q)
    return {**state, "collected_docs": state["collected_docs"] + docs}

def reason_node(state: MultiHopState) -> MultiHopState:
    hop = state["current_hop"]
    answer = llm.invoke(
        f"질문: {state['sub_questions'][hop]}\n"
        f"정보: {format_docs(state['collected_docs'][-5:])}"
    ).content
    return {
        **state,
        "intermediate_answers": state["intermediate_answers"] + [answer],
        "current_hop": hop + 1
    }

def should_continue(state: MultiHopState) -> str:
    if state["current_hop"] >= len(state["sub_questions"]):
        return "synthesize"
    return "retrieve"

graph = StateGraph(MultiHopState)
graph.add_node("decompose", decompose_node)
graph.add_node("retrieve", retrieve_node)
graph.add_node("reason", reason_node)
graph.add_conditional_edges("reason", should_continue, {
    "retrieve": "retrieve",
    "synthesize": END
})
```

## 성능과 비용 최적화

멀티홉 RAG의 가장 큰 단점은 **지연시간과 비용**이다. 홉마다 LLM 추론과 검색이 추가되기 때문이다.

최적화 전략:

1. **캐싱**: 동일한 중간 쿼리에 대한 검색 결과를 캐싱해 중복 검색 방지
2. **병렬 검색**: 독립적인 하위 질문은 비동기로 동시 검색
3. **조기 종료**: 충분한 정보가 수집되면 남은 홉을 건너뜀
4. **라우터**: 단순 질문에는 단일 홉, 복합 질문에만 멀티홉 적용

```python
import asyncio

async def parallel_multihop(sub_questions, retriever):
    # 독립적인 하위 질문은 동시 검색
    tasks = [
        retriever.ainvoke(sq) 
        for sq in sub_questions
    ]
    results = await asyncio.gather(*tasks)
    return [doc for docs in results for doc in docs]
```

멀티홉 RAG는 복합 질문 처리에서 단순 RAG 대비 정확도가 20~40% 향상된다고 보고되지만, 지연시간도 2~5배 증가한다. 서비스 SLA와 질문 복잡도를 고려해 적용 범위를 결정해야 한다.

---

**지난 글:** [RAG 쿼리 재작성: 검색 품질을 높이는 쿼리 변환 기법](/posts/rag-query-rewriting/)

**다음 글:** [Agentic RAG: 에이전트가 스스로 검색하고 추론하는 시스템](/posts/rag-agentic-rag/)

<br>
읽어주셔서 감사합니다. 😊
