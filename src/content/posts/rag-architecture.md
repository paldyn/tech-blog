---
title: "RAG 아키텍처 심화: Naive RAG에서 Modular RAG까지"
description: "RAG의 발전 단계인 Naive RAG, Advanced RAG, Modular RAG의 구조적 차이를 완전히 이해한다. 각 아키텍처의 장단점과 구현 패턴, 실무에서 어떤 아키텍처를 선택해야 하는지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["RAG아키텍처", "NaiveRAG", "AdvancedRAG", "ModularRAG", "RAG", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/rag-basics/)에서 RAG의 핵심 개념과 전체 파이프라인, LangChain으로 첫 구현까지 살펴봤다. 기본 구현은 동작하지만 실무에 바로 투입하기에는 아직 부족하다. 검색 품질이 낮거나, 복잡한 질문을 처리하지 못하거나, 컨텍스트 길이 한계에 부딪히는 문제가 곧 나타난다. 이번 글에서는 RAG가 어떻게 진화해왔는지, 세 가지 아키텍처 세대를 통해 완전히 이해한다.

## RAG 아키텍처의 세 세대

RAG 연구는 2020년 이후 빠르게 발전하며 세 가지 패러다임을 형성했다.

![RAG 아키텍처 발전 단계](/assets/posts/rag-architecture-evolution.svg)

### 1세대: Naive RAG

가장 단순한 형태의 RAG다. "질문 → 벡터 검색 → LLM 생성"의 3단계로 구성된다.

```python
# Naive RAG의 핵심 로직
def naive_rag(question: str, vectorstore, llm) -> str:
    # 1. 질문을 그대로 임베딩해서 검색
    docs = vectorstore.similarity_search(question, k=3)
    context = "\n\n".join(d.page_content for d in docs)

    # 2. 검색 결과를 그대로 LLM에 주입
    prompt = f"Context:\n{context}\n\nQuestion: {question}"
    return llm.invoke(prompt).content
```

**장점**: 구현이 단순하고 빠르다. 개념 증명(PoC)에 적합하다.

**한계점**:
- **낮은 검색 정밀도**: 사용자가 모호하게 표현한 질문은 검색이 잘 되지 않는다. "지난번에 얘기한 그 기능 있잖아요"처럼 문맥 의존적인 질문은 벡터 검색이 실패한다.
- **중복 컨텍스트**: 유사한 내용의 청크가 여러 개 검색되면 LLM의 컨텍스트가 낭비된다.
- **"Lost in the Middle" 문제**: LLM은 컨텍스트의 처음과 끝에 있는 정보를 더 잘 활용하고, 중간 정보는 무시하는 경향이 있다.

### 2세대: Advanced RAG

Naive RAG의 한계를 극복하기 위해 검색 전·후 처리를 강화한 아키텍처다.

**사전 검색(Pre-retrieval) 단계:**
- 쿼리 재작성(Query Rewriting): 사용자의 모호한 질문을 명확하게 재작성
- HyDE(Hypothetical Document Embedding): "이 질문에 대한 답이 있다면 어떤 내용일까?"를 LLM으로 생성하고, 그 가상 답변을 임베딩해 검색
- 쿼리 분해(Query Decomposition): 복잡한 질문을 여러 단순 질문으로 분해

**검색(Retrieval) 단계:**
- 하이브리드 검색: BM25 + 벡터 검색 결합

**사후 검색(Post-retrieval) 단계:**
- 재순위(Reranking): 검색된 청크의 순서를 관련도에 따라 재정렬
- 컨텍스트 압축: 불필요한 내용 제거

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import (
    LLMChainExtractor,
)
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

# 하이브리드 검색: BM25 + 벡터 검색 앙상블
bm25_retriever = BM25Retriever.from_documents(chunks)
bm25_retriever.k = 4

vector_retriever = vectorstore.as_retriever(
    search_kwargs={"k": 4}
)

# 앙상블: BM25 40% + 벡터 60% 가중치
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.4, 0.6],
)

# 컨텍스트 압축: 청크에서 질문 관련 문장만 추출
compressor = LLMChainExtractor.from_llm(llm)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=ensemble_retriever,
)

# 쿼리 재작성 (HyDE 방식)
hyde_prompt = """다음 질문에 대한 가상의 답변 문서를
2~3 문장으로 작성하세요. 실제 정보가 아니어도 됩니다.

질문: {question}
가상 답변 문서:"""

def hyde_search(question: str) -> list:
    # 가상 답변 생성
    hypothetical_doc = llm.invoke(
        hyde_prompt.format(question=question)
    ).content
    # 가상 답변을 검색 쿼리로 사용
    return compression_retriever.invoke(hypothetical_doc)
```

### 3세대: Modular RAG

각 컴포넌트를 독립적인 모듈로 분리하고 파이프라인을 유연하게 구성하는 아키텍처다. 마치 레고 블록처럼 필요에 따라 모듈을 교체하거나 추가할 수 있다.

핵심 모듈:
- **Router**: 질문 유형에 따라 최적의 검색 전략 선택
- **Retriever**: 다양한 검색 방법 (벡터, BM25, 지식 그래프, SQL)
- **Reranker**: Cross-encoder 기반 정밀 재순위
- **Generator**: LLM 답변 생성
- **Memory**: 대화 히스토리 관리
- **Evaluator**: 답변 품질 자동 평가 및 재시도

## 인덱싱 파이프라인 상세 설계

아키텍처 선택 못지않게 중요한 것이 인덱싱 파이프라인 설계다. 검색 품질의 70%는 인덱싱 단계에서 결정된다.

![RAG 인덱싱 파이프라인 상세](/assets/posts/rag-architecture-indexing.svg)

### 문서 파싱 전략

단순히 텍스트를 추출하는 것이 아니라 문서의 구조를 보존해야 한다.

```python
from unstructured.partition.auto import partition
from unstructured.cleaners.core import (
    clean_extra_whitespace,
    replace_unicode_quotes,
)

def parse_document(file_path: str) -> list[dict]:
    """
    문서를 구조화된 요소로 파싱한다.
    표, 제목, 본문을 구분해서 처리한다.
    """
    elements = partition(filename=file_path)
    structured = []
    for elem in elements:
        text = str(elem)
        text = clean_extra_whitespace(text)
        text = replace_unicode_quotes(text)
        if len(text.strip()) < 10:
            continue  # 너무 짧은 조각 제거
        structured.append({
            "text": text,
            "type": type(elem).__name__,  # Title, Table, Text
            "metadata": {
                "source": file_path,
                "element_type": type(elem).__name__,
            },
        })
    return structured

# PDF의 경우 PyMuPDF로 페이지별 처리
import fitz  # PyMuPDF

def parse_pdf_with_metadata(pdf_path: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    pages = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text")
        pages.append({
            "text": text,
            "metadata": {
                "source": pdf_path,
                "page": page_num + 1,
                "total_pages": len(doc),
            },
        })
    return pages
```

### 메타데이터 설계

메타데이터는 검색 결과 필터링과 출처 제공에 필수적이다. 잘 설계된 메타데이터는 검색 정밀도를 크게 높인다.

```python
from datetime import datetime

def create_rich_metadata(
    source_file: str,
    page: int,
    section_title: str,
    doc_type: str,
) -> dict:
    """
    풍부한 메타데이터를 생성한다.
    필터링, 출처 추적, 신선도 판단에 활용된다.
    """
    return {
        # 출처 정보
        "source": source_file,
        "page": page,
        "section": section_title,
        "doc_type": doc_type,  # "policy", "manual", "faq"

        # 시간 정보
        "indexed_at": datetime.utcnow().isoformat(),
        "doc_version": "2026-Q1",

        # 접근 제어
        "access_level": "internal",  # public / internal / secret
        "department": "HR",

        # 품질 정보
        "chunk_index": 0,       # 문서 내 청크 순번
        "total_chunks": 12,     # 같은 문서의 전체 청크 수
        "char_count": 450,
    }

# 메타데이터 기반 필터링 검색
retriever = vectorstore.as_retriever(
    search_kwargs={
        "k": 5,
        "filter": {
            "doc_type": "policy",
            "department": "HR",
        },
    }
)
```

## 실무 아키텍처 선택 가이드

**Naive RAG 선택 기준:**
- PoC, 내부 데모, 빠른 프로토타입
- 문서량이 적고(1000 청크 이하) 질문이 단순
- 개발 리소스가 부족

**Advanced RAG 선택 기준:**
- 실제 서비스 배포
- 사용자 질문이 다양하고 복잡
- 검색 품질이 비즈니스에 중요
- 팀에 ML 엔지니어가 있음

**Modular RAG 선택 기준:**
- 대규모 엔터프라이즈 시스템
- 여러 데이터 소스(DB, API, 문서) 통합
- A/B 테스트로 모듈별 최적화 필요
- 지속적인 성능 모니터링과 개선이 필요

## LangGraph로 Modular RAG 구현

LangGraph는 RAG 파이프라인을 그래프로 표현해 복잡한 워크플로우를 관리할 수 있게 해준다.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

# 상태 정의
class RAGState(TypedDict):
    question: str
    rewritten_question: str
    retrieved_docs: list
    reranked_docs: list
    answer: str
    sources: list
    needs_retry: bool

# 각 노드 함수 정의
def rewrite_query(state: RAGState) -> RAGState:
    """질문을 검색에 최적화된 형태로 재작성"""
    prompt = f"""다음 질문을 검색에 최적화된 형태로
재작성하세요. 핵심 키워드를 명확히 하세요.

원본: {state['question']}
재작성:"""
    rewritten = llm.invoke(prompt).content
    return {"rewritten_question": rewritten}

def retrieve(state: RAGState) -> RAGState:
    """하이브리드 검색 실행"""
    docs = ensemble_retriever.invoke(
        state["rewritten_question"]
    )
    return {"retrieved_docs": docs}

def rerank(state: RAGState) -> RAGState:
    """Cross-encoder로 재순위"""
    from sentence_transformers import CrossEncoder
    model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    pairs = [
        [state["question"], doc.page_content]
        for doc in state["retrieved_docs"]
    ]
    scores = model.predict(pairs)
    # 점수 기준 내림차순 정렬
    ranked = sorted(
        zip(state["retrieved_docs"], scores),
        key=lambda x: x[1], reverse=True
    )
    return {"reranked_docs": [doc for doc, _ in ranked[:3]]}

def generate(state: RAGState) -> RAGState:
    """최종 답변 생성"""
    context = "\n\n".join(
        d.page_content for d in state["reranked_docs"]
    )
    answer = llm.invoke(
        f"Context:\n{context}\n\nQ: {state['question']}"
    ).content
    sources = [
        d.metadata.get("source") for d in state["reranked_docs"]
    ]
    return {"answer": answer, "sources": sources}

# 그래프 구성
workflow = StateGraph(RAGState)
workflow.add_node("rewrite", rewrite_query)
workflow.add_node("retrieve", retrieve)
workflow.add_node("rerank", rerank)
workflow.add_node("generate", generate)

workflow.set_entry_point("rewrite")
workflow.add_edge("rewrite", "retrieve")
workflow.add_edge("retrieve", "rerank")
workflow.add_edge("rerank", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()
result = app.invoke({"question": "연차 휴가 정책은?"})
print(result["answer"])
```

## 성능 최적화 팁

1. **인덱싱 캐싱**: 동일 문서를 반복 인덱싱하지 않도록 해시 기반 캐시 구현
2. **비동기 검색**: `asyncio`를 사용해 여러 검색을 병렬 실행
3. **스트리밍 응답**: `llm.astream()`으로 답변을 토큰 단위로 스트리밍
4. **청크 캐시**: 자주 검색되는 청크를 인메모리 캐시에 보관

다음 글에서는 RAG 성능의 핵심 변수인 **청킹 전략**을 집중적으로 다룬다. 청크 크기, 오버랩 설정, 시맨틱 청킹의 원리까지 완전히 해설한다.

---

**지난 글:** [RAG 완전 정복: 검색 증강 생성의 핵심 원리](/posts/rag-basics/)

**다음 글:** [RAG 청킹 전략 완전 정복: 문서를 어떻게 나눠야 하는가](/posts/rag-chunking-strategies/)

<br>
읽어주셔서 감사합니다. 😊
