---
title: "문서 Q&A 시스템 구축: RAG 기반 PDF·문서 검색"
description: "PDF, DOCX, HTML 문서를 벡터 DB에 인덱싱하고 자연어 질문에 정확하게 답하는 RAG 기반 문서 Q&A 시스템의 전체 파이프라인을 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["문서QA", "RAG", "벡터검색", "PDF파싱", "임베딩", "LangChain", "pgvector"]
featured: false
draft: false
---

[지난 글](/posts/app-chatbot-design/)에서 기본 챗봇 아키텍처를 설계했다. 챗봇의 가장 강력한 확장 형태 중 하나가 **문서 Q&A 시스템**이다. "우리 회사 계약서에서 해지 조항을 찾아줘", "이 400페이지 매뉴얼에서 오류 코드 E-404의 해결 방법은?" 같은 질문에 정확하게 답할 수 있는 시스템이다. 핵심은 RAG(Retrieval-Augmented Generation) — 질문과 관련된 문서 조각을 먼저 검색하고, 그 내용을 LLM에 제공해 답변을 생성하는 패턴이다.

## 시스템 구조: 인덱싱과 검색 두 단계

문서 Q&A 파이프라인은 **오프라인 인덱싱**과 **실시간 검색** 두 단계로 나뉜다.

**인덱싱 단계**: 문서를 로드하고, 텍스트를 추출하며, 청크로 분할하고, 임베딩을 생성해 Vector DB에 저장한다. 한 번 실행하면 재사용할 수 있다.

**검색 단계**: 사용자 질문이 들어오면 질문을 임베딩하고, Vector DB에서 유사한 청크를 검색하며, 이를 컨텍스트로 LLM을 호출해 답변을 생성한다.

![RAG 기반 문서 Q&A 파이프라인](/assets/posts/app-document-qa-pipeline.svg)

## 문서 로딩과 텍스트 추출

다양한 형식을 지원해야 하므로 형식별 파서를 준비한다.

```python
from pathlib import Path
import pdfplumber
from docx import Document as DocxDocument

def load_document(path: str) -> str:
    suffix = Path(path).suffix.lower()

    if suffix == ".pdf":
        with pdfplumber.open(path) as pdf:
            return "\n\n".join(
                page.extract_text() or "" for page in pdf.pages
            )
    elif suffix in (".docx", ".doc"):
        doc = DocxDocument(path)
        return "\n\n".join(para.text for para in doc.paragraphs if para.text)
    elif suffix in (".txt", ".md"):
        return Path(path).read_text(encoding="utf-8")
    else:
        raise ValueError(f"지원하지 않는 형식: {suffix}")
```

PDF의 경우 `pdfplumber`가 표와 이미지가 있는 문서에서도 비교적 정확한 텍스트를 추출한다. 스캔 PDF는 OCR이 별도로 필요하다.

## 청킹 전략 선택

추출된 텍스트를 어떻게 분할하느냐가 검색 품질에 큰 영향을 준다.

![청킹 전략 비교](/assets/posts/app-document-qa-chunking.svg)

**고정 크기 청킹**: 가장 단순하다. 토큰 수 기준으로 분할하고 일정량의 겹침(overlap)을 둔다.

```python
def fixed_size_chunks(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        start += chunk_size - overlap
    return chunks
```

**의미 단위 청킹**: 문단이나 문장 경계에서 분할한다. 검색 품질은 좋지만 청크 크기가 불균일하다.

```python
import re

def semantic_chunks(text: str, max_tokens: int = 512) -> list[str]:
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks, current, current_len = [], [], 0

    for para in paragraphs:
        para_len = len(para.split())
        if current_len + para_len > max_tokens and current:
            chunks.append("\n\n".join(current))
            current, current_len = [], 0
        current.append(para)
        current_len += para_len

    if current:
        chunks.append("\n\n".join(current))
    return chunks
```

실무에서는 일반 문서라면 의미 단위 청킹을, 빠른 프로토타입이 목적이라면 고정 크기 청킹을 권장한다. 계층 구조가 있는 기술 문서(제목→절→문단)는 재귀적 청킹이 효과적이다.

## 임베딩과 Vector DB 저장

청크를 벡터로 변환하고 Vector DB에 저장한다. 여기서는 OpenAI 임베딩과 pgvector를 사용하는 예시다.

```python
import openai
import psycopg2

client_oai = openai.OpenAI()

def embed_texts(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    response = client_oai.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]

def index_chunks(chunks: list[str], doc_id: str, conn):
    vectors = embed_texts(chunks)
    with conn.cursor() as cur:
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            cur.execute(
                "INSERT INTO doc_chunks (doc_id, chunk_index, content, embedding) "
                "VALUES (%s, %s, %s, %s)",
                (doc_id, i, chunk, vector),
            )
    conn.commit()
```

pgvector를 사용하면 PostgreSQL 데이터베이스 안에서 벡터 검색이 가능하다. 추가 인프라 없이 기존 DB를 활용할 수 있어서 소규모 서비스에 적합하다.

## 검색과 답변 생성

사용자 질문이 들어오면 두 단계로 처리한다.

```python
import anthropic

client = anthropic.Anthropic()

def retrieve_chunks(question: str, top_k: int = 5, conn) -> list[str]:
    q_vec = embed_texts([question])[0]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT content FROM doc_chunks "
            "ORDER BY embedding <=> %s::vector LIMIT %s",
            (q_vec, top_k),
        )
        return [row[0] for row in cur.fetchall()]

def answer_question(question: str, conn) -> str:
    chunks = retrieve_chunks(question, conn=conn)
    context = "\n\n---\n\n".join(chunks)

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=(
            "주어진 문서 내용을 바탕으로 정확하게 답변하세요. "
            "문서에 없는 내용은 '해당 문서에서 찾을 수 없습니다'라고 답하세요."
        ),
        messages=[
            {
                "role": "user",
                "content": f"문서 내용:\n{context}\n\n질문: {question}",
            }
        ],
    )
    return response.content[0].text
```

시스템 프롬프트에 "문서에 없는 내용은 모른다고 답하라"는 지시가 핵심이다. 이 가드레일 없이는 LLM이 학습 데이터에서 유사한 내용을 지어내 답변할 수 있다(환각).

## 검색 품질 개선 기법

기본 RAG에서 더 나아가 검색 품질을 높이는 방법들이다.

**재순위화(Reranking)**: 벡터 검색으로 Top-K(예: 20개)를 뽑고, Cross-encoder 모델로 관련성을 재평가해 Top-N(예: 5개)을 선택한다.

**쿼리 재작성**: 사용자 질문이 모호하거나 오탈자가 있을 때, LLM으로 명확한 형태로 재작성해 검색 성능을 높인다.

**하이브리드 검색**: 벡터 유사도 검색과 키워드(BM25) 검색을 결합한다. 정확한 제품 코드나 고유명사 검색에 특히 효과적이다.

```python
def hybrid_search(question: str, top_k: int = 5, conn) -> list[str]:
    vec_results = retrieve_chunks(question, top_k=top_k * 2, conn=conn)
    # BM25 키워드 검색은 FTS 또는 Elasticsearch 활용
    kw_results = keyword_search(question, top_k=top_k * 2, conn=conn)
    # RRF로 두 결과 통합
    combined = rrf_merge(vec_results, kw_results)
    return combined[:top_k]
```

## 인용 출처 제공

답변의 신뢰성을 높이려면 어느 문서의 어느 부분에서 답을 찾았는지 표시해야 한다. 청크 저장 시 `page_number`, `section_title`, `doc_name` 같은 메타데이터를 함께 저장하고, 답변 생성 시 출처를 함께 반환한다.

```python
def answer_with_citations(question: str, conn) -> dict:
    rows = retrieve_chunks_with_meta(question, conn=conn)
    context_parts = [f"[출처: {r['doc_name']} p.{r['page']}]\n{r['content']}" for r in rows]
    context = "\n\n".join(context_parts)
    answer = generate_answer(question, context)
    sources = [{"doc": r["doc_name"], "page": r["page"]} for r in rows]
    return {"answer": answer, "sources": sources}
```

---

**지난 글:** [AI 챗봇 서비스 설계: 아키텍처부터 배포까지](/posts/app-chatbot-design/)

**다음 글:** [사내 지식 검색 시스템 구축](/posts/app-internal-search/)

<br>
읽어주셔서 감사합니다. 😊
