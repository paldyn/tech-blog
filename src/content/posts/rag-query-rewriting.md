---
title: "RAG 쿼리 재작성: 검색 품질을 높이는 쿼리 변환 기법"
description: "RAG에서 사용자 쿼리를 변환해 검색 품질을 높이는 Multi-Query, HyDE, Step-Back, Query Decomposition 기법의 원리와 LangChain 구현을 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["RAG", "쿼리재작성", "HyDE", "MultiQuery", "StepBack", "LangChain"]
featured: false
draft: false
---

[지난 글](/posts/rag-reranking/)에서 1차 검색 결과를 Cross-Encoder로 정렬하는 리랭킹을 다뤘다. 이번에는 그보다 한 단계 앞, 즉 **검색 자체가 시작되기 전**에 개입하는 최적화, 바로 **쿼리 재작성(Query Rewriting)**을 살펴본다. 사용자가 입력하는 쿼리는 종종 짧고, 모호하고, 검색 인덱스에 실제로 존재하는 문서 표현과 거리가 있다. 이 불일치를 해소하는 것이 쿼리 재작성의 핵심이다.

## 쿼리-문서 불일치 문제

"LLM이 뭐예요?"라는 쿼리를 생각해보자. 이 쿼리는 단 세 단어지만, 실제로 사용자가 원하는 답변은 훨씬 풍부한 내용을 담고 있다. 벡터 인덱스에는 "대규모 언어 모델의 트랜스포머 기반 아키텍처", "GPT 계열 모델의 사전 학습 방법론", "Claude와 GPT의 차이" 같은 문서들이 저장돼 있을 것이다. 짧은 쿼리가 이 다양한 문서를 모두 포착하기 어렵다는 것은 직관적으로 이해할 수 있다.

쿼리 재작성은 LLM을 사용해 원본 쿼리를 여러 가지 방법으로 변환하고, 변환된 쿼리(들)로 검색을 수행함으로써 더 많은, 더 관련성 높은 문서를 회수한다.

![쿼리 재작성 기법 분류](/assets/posts/rag-query-rewriting-types.svg)

## 1. Multi-Query: 다각도 검색

가장 직관적인 방법이다. LLM이 원본 쿼리를 3~5개의 다른 표현으로 변환하고, 각각으로 검색한 뒤 결과를 통합한다.

```python
from langchain.retrievers import MultiQueryRetriever
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6")
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=llm
)

# 내부적으로 일어나는 일:
# "LLM이 뭔가요?" →
#   "LLM의 정의와 개념은?"
#   "대규모 언어 모델이란 무엇인가?"
#   "GPT, Claude 같은 AI 모델의 원리?"
# → 각각 검색 → 결과 중복 제거 후 통합

docs = retriever.invoke("LLM이 뭔가요?")
```

프롬프트를 커스터마이징하면 더 세밀한 제어가 가능하다.

```python
from langchain.prompts import PromptTemplate

custom_prompt = PromptTemplate(
    input_variables=["question"],
    template="""다음 질문에 대해 서로 다른 관점에서 3개의 검색 쿼리를 작성하라.
각 줄에 하나씩, 번호 없이 출력하라.

원본 질문: {question}
검색 쿼리:"""
)

retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=llm,
    prompt=custom_prompt
)
```

## 2. HyDE: 가상 문서 임베딩

HyDE(Hypothetical Document Embeddings)는 2022년 논문에서 제안된 독창적인 방법이다. 짧은 쿼리가 아니라 LLM이 생성한 **가상의 답변 문서**를 임베딩해 검색에 사용한다.

![HyDE 가상 문서 임베딩 검색](/assets/posts/rag-query-rewriting-hyde.svg)

HyDE가 효과적인 이유는 임베딩 공간의 분포 불일치(Query-Document Asymmetry) 때문이다. 짧은 질문과 긴 답변 문서는 임베딩 공간에서 다른 영역에 위치하는 경향이 있다. 가상 답변은 실제 문서와 유사한 길이와 형태를 가지므로 더 정확하게 관련 문서를 찾는다.

```python
from langchain.chains import HypotheticalDocumentEmbedder
from langchain_openai import OpenAIEmbeddings

# HyDE 임베딩 모델 생성
embeddings = OpenAIEmbeddings()
hyde_embeddings = HypotheticalDocumentEmbedder.from_llm(
    llm=llm,
    base_embeddings=embeddings,
    custom_instructions="다음 질문에 대해 전문가처럼 한 단락으로 답하라:"
)

# HyDE 임베딩을 사용해 벡터 스토어 구성
vectorstore = FAISS.from_documents(docs, hyde_embeddings)
retriever = vectorstore.as_retriever()
```

단, HyDE는 LLM이 잘못된 가상 답변을 생성하면(할루시네이션) 오히려 검색 품질이 저하될 수 있다. 특히 사실에 민감한 도메인에서는 주의가 필요하다.

## 3. Step-Back Prompting: 상위 개념 검색

Google DeepMind가 2023년 제안한 기법이다. 구체적인 질문 전에 더 일반적인 상위 개념 질문을 먼저 검색한다.

```python
# Step-Back 쿼리 생성
stepback_prompt = """
다음의 구체적인 질문을 한 단계 추상화해 더 일반적인 배경 질문으로 변환하라.

예시:
- 원본: "2023년 GPT-4의 컨텍스트 길이는?"
- 스텝백: "LLM의 컨텍스트 윈도우란 무엇이고 어떻게 발전해왔는가?"

원본 질문: {question}
스텝백 질문:"""

def step_back_retrieve(question, llm, retriever):
    # 상위 개념 쿼리 생성
    stepback_q = llm.invoke(
        stepback_prompt.format(question=question)
    ).content

    # 원본 + 스텝백 쿼리 모두 검색
    original_docs = retriever.invoke(question)
    stepback_docs = retriever.invoke(stepback_q)

    # 중복 제거 후 합산
    seen, combined = set(), []
    for doc in original_docs + stepback_docs:
        if doc.page_content not in seen:
            seen.add(doc.page_content)
            combined.append(doc)
    return combined
```

## 4. Query Decomposition: 복잡한 질문 분해

"RAG와 파인튜닝의 차이점과 각각의 적합한 사용 케이스는?"처럼 복합 질문은 단순 검색으로 처리하기 어렵다. 이를 하위 질문들로 분해해 각각 검색한 뒤 종합한다.

```python
decompose_prompt = """다음 질문을 독립적으로 답변 가능한 2~4개의 하위 질문으로 분해하라.
각 줄에 하나씩, 번호 없이 출력하라.

질문: {question}
하위 질문:"""

def decompose_and_retrieve(question, llm, retriever):
    # 하위 질문 생성
    sub_questions = llm.invoke(
        decompose_prompt.format(question=question)
    ).content.strip().split("\n")

    # 각 하위 질문 검색
    all_docs = []
    for sq in sub_questions:
        docs = retriever.invoke(sq.strip())
        all_docs.extend(docs)

    # 중복 제거
    seen = set()
    unique_docs = []
    for doc in all_docs:
        h = hash(doc.page_content[:200])
        if h not in seen:
            seen.add(h)
            unique_docs.append(doc)
    return unique_docs
```

## 기법별 비교와 선택 기준

| 기법 | 적합한 상황 | 단점 |
|-----|-----------|-----|
| Multi-Query | 짧고 모호한 쿼리 | LLM 호출 비용 증가 |
| HyDE | 전문 도메인, 긴 문서 | 할루시네이션 위험 |
| Step-Back | 배경 지식이 필요한 질문 | 오버헤드 있음 |
| Decomposition | 복합 질문, 멀티홉 | 복잡한 구현 |

실제 프로덕션에서는 한 가지를 선택하기보다 **라우터**를 둬 질문 유형에 따라 적절한 전략을 선택하는 패턴이 많다. 단순한 사실 질문에는 기본 검색, 복합 질문에는 Decomposition, 전문 도메인에는 HyDE를 적용하는 식이다.

---

**지난 글:** [RAG 리랭킹: 검색 품질을 한 단계 끌어올리는 기술](/posts/rag-reranking/)

**다음 글:** [RAG 멀티홉 추론: 복잡한 질문을 단계적으로 해결하기](/posts/rag-multi-hop/)

<br>
읽어주셔서 감사합니다. 😊
