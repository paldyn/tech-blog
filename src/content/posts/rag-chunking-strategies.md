---
title: "RAG 청킹 전략 완전 정복: 문서를 어떻게 나눠야 하는가"
description: "RAG 성능을 결정짓는 핵심 요소인 청킹 전략을 완전히 이해한다. 고정 크기, 재귀적, 시맨틱, 문장 단위 청킹의 차이와 청크 크기·오버랩 설정 방법, 문서 유형별 최적 전략을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["청킹", "RAG", "텍스트분할", "LangChain", "임베딩", "벡터DB"]
featured: false
draft: false
---

[지난 글](/posts/rag-architecture/)에서 Naive RAG부터 Modular RAG까지 아키텍처의 발전 단계를 살펴봤다. RAG 시스템을 실제로 구축할 때 가장 먼저, 그리고 가장 많이 고민하게 되는 문제가 있다. **"문서를 어떻게 나눠야 하는가?"** 즉, 청킹(Chunking) 전략이다. 경험 많은 RAG 엔지니어들이 공통적으로 하는 말이 있다. "RAG 품질의 절반은 청킹에서 결정된다." 그만큼 청킹은 임베딩 모델이나 LLM 선택만큼이나 중요하다.

## 왜 청킹이 중요한가

LLM에게 문서 전체를 한 번에 넣으면 되지 않느냐는 의문이 들 수 있다. 이유는 두 가지다.

**첫째, 컨텍스트 길이 제한**이다. GPT-4o는 최대 128K 토큰, 한국어 텍스트 약 10만 자를 처리할 수 있다. 충분해 보이지만, 수만 개의 문서를 가진 사내 지식베이스 전체를 한 번에 넣을 수는 없다. 게다가 컨텍스트가 길어질수록 비용과 응답 속도가 비례해서 증가한다.

**둘째, 임베딩 정밀도** 문제다. 긴 텍스트 전체를 하나의 벡터로 임베딩하면 전체 내용의 평균적인 의미만 담기게 된다. 결과적으로 특정 세부 내용을 검색할 때 정밀도가 크게 떨어진다. 청크가 작을수록 더 구체적인 의미를 담을 수 있고, 쿼리와의 관련도 계산이 정확해진다.

## 청킹의 핵심 파라미터

어떤 청킹 전략을 쓰든 두 가지 파라미터가 핵심이다.

- **`chunk_size`**: 각 청크의 최대 크기 (토큰 수 또는 문자 수)
- **`chunk_overlap`**: 인접한 청크 간 공유하는 텍스트 길이

오버랩이 왜 필요한가? 경계에서 문장이 중간에 잘리면 두 청크 어디에도 완전한 정보가 없게 된다. 오버랩은 이 경계 문제를 완화한다.

![청크 오버랩 시각화](/assets/posts/rag-chunking-strategies-overlap.svg)

일반적인 권장값은 `chunk_overlap = chunk_size × 0.10 ~ 0.20`이다. `chunk_size=500`이라면 `chunk_overlap=50~100`이 적절하다. 오버랩이 너무 크면 저장 공간이 낭비되고, 너무 작으면 경계 문제가 발생한다.

## 주요 청킹 전략 4가지

![청킹 전략 비교](/assets/posts/rag-chunking-strategies-types.svg)

### 전략 1: 고정 크기 청킹 (Fixed-size Chunking)

가장 단순한 방법이다. 문자 수나 토큰 수 기준으로 고정된 크기로 자른다.

```python
from langchain.text_splitter import CharacterTextSplitter

splitter = CharacterTextSplitter(
    separator="\n",        # 이 구분자 기준으로 분할
    chunk_size=500,        # 최대 500자
    chunk_overlap=50,      # 50자 오버랩
    length_function=len,   # 문자 수 기준
)

text = """RAG는 검색 증강 생성의 약어다.
LLM의 한계를 극복하는 방법으로 주목받고 있다.
벡터 검색과 언어 모델을 결합한 기술이다."""

chunks = splitter.split_text(text)
for i, chunk in enumerate(chunks):
    print(f"청크 {i}: {chunk[:50]}...")
```

**적합한 경우**: 정형화된 텍스트(로그 파일, CSV), 모든 내용이 동등한 중요도를 가진 문서
**주의사항**: 의미 단위를 무시하고 기계적으로 자르기 때문에 문장이나 단락 중간에서 잘릴 수 있다.

### 전략 2: 재귀적 문자 청킹 (Recursive Character Chunking)

LangChain의 `RecursiveCharacterTextSplitter`가 구현하는 방식으로, **실무에서 가장 널리 쓰이는 기본 전략**이다. 여러 구분자를 우선순위 순서로 시도한다. 단락(`\n\n`) → 줄(`\n`) → 문장(`.`) → 단어(` `) 순으로 시도하며, 지정한 크기를 초과하지 않는 가장 큰 단위로 분할한다.

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    # 우선순위 순서로 구분자 시도
    separators=[
        "\n\n",   # 단락
        "\n",     # 줄
        ". ",     # 문장
        ", ",     # 구
        " ",      # 단어
        "",       # 문자 (최후 수단)
    ],
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
)

# 토큰 기준 청킹 (임베딩 모델의 max token과 맞추기 위해)
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken

def tiktoken_len(text: str) -> int:
    tokenizer = tiktoken.get_encoding("cl100k_base")
    tokens = tokenizer.encode(text, disallowed_special=())
    return len(tokens)

token_splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,         # 400 토큰
    chunk_overlap=40,       # 40 토큰 오버랩
    length_function=tiktoken_len,
    separators=["\n\n", "\n", ". ", " ", ""],
)
```

**적합한 경우**: 대부분의 일반 텍스트 문서, 뉴스 기사, 보고서
**장점**: 단락과 문장 경계를 최대한 존중하면서 크기 제한을 준수한다.

### 전략 3: 시맨틱 청킹 (Semantic Chunking)

문자 수가 아니라 **의미적 유사성**을 기준으로 청크 경계를 결정한다. 연속된 문장들을 임베딩하고, 인접 문장 간 코사인 유사도가 급격히 떨어지는 지점을 경계로 삼는다.

```python
from langchain_experimental.text_splitter import (
    SemanticChunker,
)
from langchain_openai import OpenAIEmbeddings

# 시맨틱 청커 초기화
semantic_splitter = SemanticChunker(
    embeddings=OpenAIEmbeddings(
        model="text-embedding-3-small"
    ),
    # 경계 결정 방식:
    # "percentile" - 유사도 하위 n% 지점에서 분할
    # "standard_deviation" - 평균에서 n 표준편차 이하
    # "interquartile" - IQR 기반
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,  # 상위 5%의 경계만 분할
)

with open("research_paper.txt") as f:
    text = f.read()

semantic_chunks = semantic_splitter.split_text(text)
print(f"생성된 청크 수: {len(semantic_chunks)}")
print(f"평균 청크 길이: "
      f"{sum(len(c) for c in semantic_chunks)//len(semantic_chunks)}")
```

**적합한 경우**: 학술 논문, 법률 문서, 의료 기록처럼 주제가 명확하게 전환되는 전문 문서
**단점**: 임베딩 API 호출 비용이 발생하고 처리 속도가 느리다. 청크 크기가 일정하지 않아 토큰 한계를 초과할 수 있으므로 후처리가 필요하다.

### 전략 4: 문서 구조 기반 청킹

Markdown, HTML, 코드 파일처럼 명확한 구조를 가진 문서는 그 구조를 그대로 활용한다.

```python
from langchain.text_splitter import MarkdownHeaderTextSplitter

# Markdown 헤더 기반 분할
md_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[
        ("#", "H1"),
        ("##", "H2"),
        ("###", "H3"),
    ],
    strip_headers=False,  # 헤더를 청크에 포함 (맥락 유지)
)

markdown_doc = """# RAG 가이드

## 개요
RAG는 검색 증강 생성이다.

## 구현 방법
### 인덱싱
문서를 청킹하고 임베딩한다.

### 검색
벡터 유사도로 청크를 검색한다.
"""

md_chunks = md_splitter.split_text(markdown_doc)
for chunk in md_chunks:
    print(f"메타데이터: {chunk.metadata}")
    print(f"내용: {chunk.page_content[:60]}\n")
# 메타데이터: {'H1': 'RAG 가이드', 'H2': '구현 방법', 'H3': '인덱싱'}
# 내용: 문서를 청킹하고 임베딩한다.
```

헤더 정보가 메타데이터로 자동 추출되는 것이 핵심이다. 이 메타데이터로 검색 시 섹션 필터링이 가능하고, 답변에 "RAG 가이드 > 구현 방법 > 인덱싱 섹션 참조"처럼 구체적인 출처를 제공할 수 있다.

## 고급 기법: 부모-자식 청킹 (Parent-Child Chunking)

단일 청킹 전략의 한계를 넘는 고급 기법이다. 핵심 아이디어는 **검색은 작은 청크(자식)로, 컨텍스트 제공은 큰 청크(부모)로** 수행하는 것이다.

```python
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 부모 청크: 맥락을 위한 큰 단위 (2000자)
parent_splitter = RecursiveCharacterTextSplitter(
    chunk_size=2000,
    chunk_overlap=200,
)

# 자식 청크: 정밀 검색을 위한 작은 단위 (300자)
child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=30,
)

# 부모 청크는 로컬 스토어에, 자식 청크는 벡터DB에
store = InMemoryStore()
retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)

retriever.add_documents(documents)

# 검색 시: 자식 청크로 검색 → 부모 청크로 반환
results = retriever.invoke("연차 휴가 정책")
# 300자 자식 청크로 검색했지만 2000자 부모 청크가 반환됨
print(len(results[0].page_content))  # ~2000
```

이 방식은 검색 정밀도(작은 청크)와 컨텍스트 풍부성(큰 청크)을 동시에 달성한다.

## 청크 크기별 특성 비교

| chunk_size | 특징 | 적합한 경우 |
|-----------|------|------------|
| 128~256 토큰 | 매우 정밀, 맥락 부족 | FAQ, 단답형 질문 |
| 256~512 토큰 | 균형적 | 대부분의 범용 RAG |
| 512~1024 토큰 | 풍부한 맥락, 정밀도 낮음 | 장문 분석, 요약 |
| 1024+ 토큰 | 섹션 단위, 거시적 | 문서 분류, 개요 검색 |

실무 권장값은 **400~600 토큰**이다. 대부분의 임베딩 모델(text-embedding-3-small의 최적 입력)과 검색 정밀도의 균형점이 이 범위에 있다.

## 청킹 품질 평가 방법

청킹 전략을 선택했다면 실제로 품질을 측정해야 한다.

```python
import statistics

def evaluate_chunks(chunks: list[str]) -> dict:
    """청크 품질 기본 지표 계산"""
    lengths = [len(c) for c in chunks]
    return {
        "total_chunks": len(chunks),
        "avg_length": statistics.mean(lengths),
        "std_length": statistics.stdev(lengths),
        "min_length": min(lengths),
        "max_length": max(lengths),
        # 너무 짧은 청크 비율 (품질 저하 요인)
        "short_chunk_ratio": sum(
            1 for l in lengths if l < 100
        ) / len(lengths),
        # 너무 긴 청크 비율 (임베딩 성능 저하 요인)
        "long_chunk_ratio": sum(
            1 for l in lengths if l > 1000
        ) / len(lengths),
    }

# 예시 출력
stats = evaluate_chunks(chunks)
# {'total_chunks': 245, 'avg_length': 423.5,
#  'std_length': 87.3, 'short_chunk_ratio': 0.02, ...}
```

이상적인 청킹 결과는 `std_length`가 낮아 청크 크기가 일정하고, `short_chunk_ratio`와 `long_chunk_ratio`가 모두 5% 이하인 상태다.

## 문서 유형별 청킹 전략 요약

- **일반 텍스트·보고서**: `RecursiveCharacterTextSplitter`, chunk_size=500, overlap=50
- **Markdown·Wiki·사내 문서**: `MarkdownHeaderTextSplitter` + 재귀적 청킹 결합
- **법률·의료 전문 문서**: `SemanticChunker` (의미 경계 중요)
- **소스 코드**: 함수/클래스 단위 분할 (`Language.PYTHON` 등 언어별 스플리터)
- **긴 문서 + 세밀한 검색 필요**: 부모-자식 청킹

다음 글에서는 청킹 후 각 청크를 벡터로 변환하는 **임베딩 모델**을 다룬다. OpenAI, BGE-M3, 한국어 특화 모델까지 성능·비용·언어 지원을 완전히 비교한다.

---

**지난 글:** [RAG 아키텍처 심화: Naive RAG에서 Modular RAG까지](/posts/rag-architecture/)

**다음 글:** [RAG 임베딩 모델 선택 가이드: 성능·비용·언어 지원 완전 비교](/posts/rag-embedding-models/)

<br>
읽어주셔서 감사합니다. 😊
