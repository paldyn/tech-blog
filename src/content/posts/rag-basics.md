---
title: "RAG 완전 정복: 검색 증강 생성의 핵심 원리"
description: "Retrieval-Augmented Generation(RAG)의 핵심 개념과 동작 원리를 이해한다. LLM의 한계를 극복하는 방법, RAG의 전체 파이프라인, 파인튜닝과의 차이, 그리고 LangChain으로 첫 RAG를 구현하는 방법까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["RAG", "검색증강생성", "LLM", "벡터검색", "LangChain", "임베딩", "지식베이스"]
featured: false
draft: false
---

[지난 글](/posts/vector-db-pgvector/)에서 PostgreSQL 확장인 pgvector로 벡터 데이터를 저장하고 유사도 검색을 수행하는 방법을 살펴봤다. 이제 그 벡터 검색 기술이 LLM과 만나는 지점, 즉 **RAG(Retrieval-Augmented Generation)**를 다룬다. RAG는 "검색 증강 생성"이라고 번역되는데, LLM이 답변을 생성할 때 외부 지식을 실시간으로 검색해 참조하도록 하는 기법이다. 2020년 Facebook AI Research(현 Meta AI)의 논문 "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"에서 처음 제안됐고, 지금은 실무 AI 시스템의 표준 아키텍처로 자리잡았다.

## LLM의 한계: 왜 RAG가 필요한가

GPT-4o, Claude, Gemini 같은 최신 LLM은 놀라운 언어 이해와 생성 능력을 갖추고 있다. 하지만 구조적인 한계가 있다.

**첫째, 지식 컷오프(Knowledge Cutoff)**다. LLM은 특정 날짜까지의 데이터로만 학습된다. GPT-4o의 학습 데이터 컷오프는 2024년 초반이다. 2024년 하반기 이후에 발생한 사건, 새로 출시된 제품, 최신 논문 결과는 알 수 없다.

**둘째, 환각(Hallucination)**이다. LLM은 모른다고 말하는 것보다 그럴듯한 답을 만들어내도록 훈련된 경향이 있다. 특히 구체적인 수치, 날짜, 인명, 법률 조항처럼 정밀한 정보가 필요한 질문에서 확신에 찬 오답을 생성한다.

**셋째, 사내 지식 부재**다. LLM은 공개 데이터로 학습된다. 특정 회사의 내부 문서, 사내 규정, 미공개 기술 문서는 LLM이 알 방법이 없다.

**넷째, 출처 불투명성**이다. LLM의 답변이 어떤 정보를 근거로 하는지 추적하기 어렵다. 법률·의료·금융처럼 책임이 중요한 영역에서는 치명적인 문제다.

RAG는 이 네 가지 문제를 한 번에 해결한다. 외부 문서를 실시간으로 검색해 LLM에게 "이 문서를 참고해서 답변해"라고 컨텍스트로 제공하기 때문이다.

![RAG 전체 파이프라인](/assets/posts/rag-basics-pipeline.svg)

## RAG vs 파인튜닝: 언제 무엇을 선택할까

RAG 외에 LLM을 특정 도메인에 적용하는 또 다른 방법은 **파인튜닝(Fine-tuning)**이다. 두 접근법은 근본적으로 다르다.

| 구분 | RAG | 파인튜닝 |
|------|-----|----------|
| 지식 업데이트 | 실시간 가능 | 재학습 필요 |
| 학습 비용 | 없음 | 높음 (GPU 시간) |
| 출처 제공 | 가능 | 불가능 |
| 새 도메인 적응 | 즉시 | 데이터 수집·학습 필요 |
| 적합한 경우 | 최신 정보, 출처 필요 | 특정 스타일·형식 학습 |

실무에서는 두 방법을 결합하기도 한다. 도메인 특화 스타일로 파인튜닝된 LLM에 RAG를 결합하면 최고의 결과를 얻을 수 있다. 그러나 처음 시작이라면 RAG가 훨씬 빠르고 저렴하게 도메인 지식을 LLM에 주입할 수 있다.

## RAG의 두 파이프라인: 인덱싱과 쿼리

RAG 시스템은 두 개의 독립된 파이프라인으로 구성된다.

### 1. 오프라인 인덱싱 파이프라인

문서를 벡터 DB에 미리 저장하는 단계다. 한 번 실행하고, 문서가 바뀔 때만 재실행한다.

1. **문서 수집**: PDF, HTML, Markdown, 사내 Wiki 등 다양한 형식의 문서를 수집한다.
2. **청킹(Chunking)**: 긴 문서를 LLM이 처리할 수 있는 크기(보통 200~1000 토큰)의 청크로 분할한다.
3. **임베딩**: 각 청크를 임베딩 모델로 고차원 벡터로 변환한다.
4. **벡터 DB 저장**: 벡터와 원본 텍스트, 메타데이터(출처, 날짜 등)를 함께 저장한다.

### 2. 온라인 쿼리 파이프라인

사용자 질문이 들어올 때마다 실행되는 실시간 파이프라인이다.

1. **질문 임베딩**: 사용자 질문을 동일한 임베딩 모델로 벡터로 변환한다.
2. **벡터 검색**: 벡터 DB에서 질문 벡터와 가장 유사한 청크 Top-K를 검색한다.
3. **프롬프트 조립**: 검색된 청크들을 컨텍스트로 삼아 LLM 프롬프트를 구성한다.
4. **LLM 생성**: LLM이 컨텍스트를 참고해 답변을 생성한다.

![LLM 단독 vs RAG 비교](/assets/posts/rag-basics-vs-llm.svg)

## LangChain으로 첫 RAG 구현하기

이론을 코드로 확인해보자. LangChain은 RAG 구현을 위한 표준 라이브러리로, 인덱싱부터 쿼리까지 모든 단계를 간결하게 처리할 수 있다.

먼저 필요한 패키지를 설치한다.

```bash
pip install langchain langchain-openai langchain-community \
    faiss-cpu pypdf
```

다음은 PDF 문서를 인덱싱하고 질의하는 기본 RAG 파이프라인이다.

```python
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

# ── 1. 인덱싱 파이프라인 ──────────────────────────────────────
# 문서 로드
loader = PyPDFLoader("company_handbook.pdf")
documents = loader.load()

# 청킹: 500 토큰, 50 오버랩
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", ".", " "],
)
chunks = splitter.split_documents(documents)
print(f"총 청크 수: {len(chunks)}")

# 임베딩 생성 & 벡터 DB 저장
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small"
)
vectorstore = FAISS.from_documents(chunks, embeddings)
vectorstore.save_local("faiss_index")

# ── 2. 쿼리 파이프라인 ───────────────────────────────────────
# 저장된 인덱스 로드
vectorstore = FAISS.load_local(
    "faiss_index",
    embeddings,
    allow_dangerous_deserialization=True,
)

# 프롬프트 템플릿
prompt = PromptTemplate(
    input_variables=["context", "question"],
    template="""다음 문서 내용을 참고하여 질문에 답하세요.
문서에 없는 내용은 "문서에서 찾을 수 없습니다"라고 답하세요.

문서:
{context}

질문: {question}
답변:""",
)

# RAG 체인 구성
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4},
)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    chain_type_kwargs={"prompt": prompt},
    return_source_documents=True,
)

# 질의
result = qa_chain.invoke(
    {"query": "연차 휴가는 며칠인가요?"}
)
print(result["result"])
print("\n출처 문서:")
for doc in result["source_documents"]:
    print(f"  - {doc.metadata.get('source', '?')} "
          f"p.{doc.metadata.get('page', '?')}")
```

이 코드는 RAG의 전체 흐름을 담고 있다. `PyPDFLoader`가 PDF를 로드하고, `RecursiveCharacterTextSplitter`가 청킹하며, `OpenAIEmbeddings`가 임베딩을 생성하고, `FAISS`가 로컬 벡터 인덱스를 관리한다. 마지막으로 `RetrievalQA` 체인이 검색과 생성을 연결한다.

## 프롬프트 엔지니어링: RAG의 핵심

RAG에서 LLM에게 컨텍스트를 어떻게 전달하느냐가 답변 품질을 크게 좌우한다. 효과적인 RAG 프롬프트의 원칙을 살펴보자.

```python
RAG_PROMPT = """당신은 주어진 문서를 바탕으로 질문에 답하는
전문 어시스턴트입니다.

규칙:
1. 반드시 아래 문서 내용에 근거해서만 답변하세요.
2. 문서에 없는 내용을 추측하거나 창작하지 마세요.
3. 답변에 근거한 문서 번호([문서 1], [문서 2] 등)를 명시하세요.
4. 확실하지 않으면 "문서에서 명확한 정보를 찾지 못했습니다"
   라고 답하세요.

참조 문서:
{context}

질문: {question}

답변 (근거 문서 번호 포함):"""
```

핵심은 **"문서에 없으면 모른다고 해라"**는 명시적 지시다. 이 지시가 없으면 LLM은 문서 내용과 자신의 사전 지식을 혼합해 답변을 생성하는 경향이 있고, 결과적으로 환각이 다시 발생한다.

## RAG 평가 지표

RAG 시스템을 구축했다면 품질을 평가해야 한다. 주요 지표는 다음과 같다.

- **충실도(Faithfulness)**: LLM의 답변이 검색된 컨텍스트와 얼마나 일치하는가. 환각 여부를 측정한다.
- **답변 관련성(Answer Relevance)**: 생성된 답변이 사용자 질문과 얼마나 관련 있는가.
- **컨텍스트 정밀도(Context Precision)**: 검색된 청크 중 실제로 유용한 청크의 비율.
- **컨텍스트 재현율(Context Recall)**: 답변에 필요한 정보가 검색된 청크에 얼마나 포함됐는가.

`ragas` 라이브러리를 사용하면 이 지표들을 자동으로 계산할 수 있다.

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

# 평가 데이터셋 준비
eval_data = {
    "question": ["연차는 며칠인가요?", "재택근무 정책은?"],
    "answer": [rag_answer_1, rag_answer_2],
    "contexts": [retrieved_chunks_1, retrieved_chunks_2],
    "ground_truth": [correct_answer_1, correct_answer_2],
}

dataset = Dataset.from_dict(eval_data)
result = evaluate(
    dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    ],
)
print(result)
# {'faithfulness': 0.92, 'answer_relevancy': 0.87, ...}
```

## 실무에서 자주 만나는 문제와 해결책

**문제 1: 검색 품질이 낮아 엉뚱한 청크가 검색된다**
- 원인: 청크 크기가 너무 크거나, 임베딩 모델이 도메인에 맞지 않음
- 해결: 청크 크기를 줄이고(200~300 토큰), 도메인 특화 임베딩 모델로 교체

**문제 2: 답변이 여러 청크에 걸쳐 있는 정보를 합치지 못한다**
- 원인: 하나의 질문에 필요한 정보가 서로 다른 청크에 분산됨
- 해결: Top-K를 늘리거나, 부모-자식 청크(Parent-Child Chunking) 전략 적용

**문제 3: LLM이 컨텍스트를 무시하고 사전 지식으로 답한다**
- 원인: 프롬프트에 컨텍스트 의존 지시가 약함
- 해결: 프롬프트를 강화하거나, 컨텍스트가 매우 명확한 경우에만 답변하도록 제한

**문제 4: 처리 속도가 너무 느리다**
- 원인: 매 쿼리마다 임베딩 모델 API를 호출
- 해결: 임베딩 캐시, 배치 처리, 로컬 임베딩 모델(BGE-M3) 사용

## 마치며: RAG는 LLM 실무화의 관문

RAG는 LLM을 실제 비즈니스 문제에 적용할 때 가장 먼저 시도해야 할 기법이다. 파인튜닝보다 빠르고, 저렴하고, 지식 업데이트가 쉽다. 무엇보다 LLM이 "왜 그렇게 답했는지" 출처를 제공할 수 있어 신뢰성을 확보할 수 있다.

다음 글에서는 RAG의 아키텍처를 더 깊이 파고든다. 단순한 Naive RAG에서 시작해, 쿼리 재작성·재순위·모듈러 구조를 갖춘 Advanced RAG와 Modular RAG까지 발전 단계를 살펴볼 것이다.

---

**지난 글:** [pgvector 완전 정복: PostgreSQL로 벡터 검색 구현하기](/posts/vector-db-pgvector/)

**다음 글:** [RAG 아키텍처 심화: Naive RAG에서 Modular RAG까지](/posts/rag-architecture/)

<br>
읽어주셔서 감사합니다. 😊
