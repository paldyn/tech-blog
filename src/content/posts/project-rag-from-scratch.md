---
title: "RAG 시스템 처음부터 구축하기: 실전 프로젝트"
description: "문서 수집부터 청킹, 임베딩, 벡터 DB 저장, 검색, 생성까지 — LangChain 없이 순수 Python으로 RAG 시스템을 처음부터 구축하는 단계별 프로젝트 가이드."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["RAG", "벡터DB", "임베딩", "검색증강생성", "프로젝트", "Python", "FAISS"]
featured: false
draft: false
---

[지난 글](/posts/gpu-memory-tuning/)에서 GPU 메모리 최적화 기법을 살펴봤다. 이번에는 방향을 바꿔 **RAG(Retrieval-Augmented Generation) 시스템을 LangChain 없이 순수 Python으로 처음부터** 구축하는 실전 프로젝트를 진행한다. 라이브러리가 내부에서 무엇을 하는지 이해하지 못한 채 사용하면 디버깅이 어렵고 커스터마이징에 한계가 생긴다. 이 글은 문서 로딩부터 청킹, 임베딩, FAISS 벡터 저장, 검색, 프롬프트 조립, LLM 생성, 평가까지 — 모든 단계를 직접 코드로 구현한다.

## 프로젝트 구조

먼저 프로젝트 디렉토리를 설정한다.

```bash
rag-from-scratch/
├── data/
│   ├── raw/          # 원본 문서 (PDF, TXT, HTML)
│   └── chunks/       # 청킹된 텍스트 조각
├── indexes/
│   └── faiss.index   # FAISS 인덱스 파일
├── src/
│   ├── loader.py     # 문서 로딩
│   ├── chunker.py    # 텍스트 청킹
│   ├── embedder.py   # 임베딩 생성
│   ├── store.py      # 벡터 스토어
│   ├── retriever.py  # 검색
│   ├── generator.py  # LLM 생성
│   └── evaluator.py  # 평가
├── main.py           # 파이프라인 실행
└── requirements.txt
```

```bash
# 의존성 설치
pip install sentence-transformers faiss-cpu anthropic \
            pypdf requests beautifulsoup4 numpy
```

## 1단계: 문서 로딩

다양한 소스에서 텍스트를 추출한다.

```python
# src/loader.py
import pathlib
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

class DocumentLoader:
    def load_txt(self, path: str) -> str:
        return pathlib.Path(path).read_text(encoding="utf-8")

    def load_pdf(self, path: str) -> str:
        reader = PdfReader(path)
        return "\n".join(
            page.extract_text() or "" for page in reader.pages
        )

    def load_url(self, url: str) -> str:
        html = requests.get(url, timeout=10).text
        soup = BeautifulSoup(html, "html.parser")
        # 불필요한 태그 제거
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)

    def load(self, source: str) -> str:
        if source.startswith("http"):
            return self.load_url(source)
        elif source.endswith(".pdf"):
            return self.load_pdf(source)
        else:
            return self.load_txt(source)
```

## 2단계: 텍스트 청킹

청킹 전략은 검색 품질에 직접적인 영향을 미친다.

![청킹 전략 비교](/assets/posts/project-rag-from-scratch-chunking.svg)

```python
# src/chunker.py
from typing import List
import re

class RecursiveCharacterSplitter:
    """단락 → 문장 → 단어 순으로 재귀 분할"""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        separators: List[str] = None,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def split(self, text: str) -> List[str]:
        return self._split(text, self.separators)

    def _split(self, text: str, separators: List[str]) -> List[str]:
        sep = separators[0]
        parts = text.split(sep) if sep else list(text)

        chunks, current = [], ""
        for part in parts:
            candidate = current + (sep if current else "") + part
            if len(candidate) <= self.chunk_size:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                # 단일 part가 너무 크면 다음 separator로 재귀
                if len(part) > self.chunk_size and len(separators) > 1:
                    chunks.extend(self._split(part, separators[1:]))
                    current = ""
                else:
                    current = part

        if current:
            chunks.append(current)

        # overlap 적용
        return self._apply_overlap(chunks)

    def _apply_overlap(self, chunks: List[str]) -> List[str]:
        if self.chunk_overlap == 0 or len(chunks) <= 1:
            return chunks
        result = [chunks[0]]
        for i in range(1, len(chunks)):
            prev_tail = chunks[i - 1][-self.chunk_overlap:]
            result.append(prev_tail + chunks[i])
        return result
```

## 3단계: 임베딩 생성

`sentence-transformers` 라이브러리로 텍스트를 벡터로 변환한다. 인덱싱과 쿼리에 동일한 모델을 사용해야 임베딩 공간의 일관성이 유지된다.

```python
# src/embedder.py
import numpy as np
from sentence_transformers import SentenceTransformer

class Embedder:
    def __init__(self, model_name: str = "BAAI/bge-m3"):
        # bge-m3: 한국어·영어 다국어 지원, 1024-dim
        self.model = SentenceTransformer(model_name)
        self.dim = self.model.get_sentence_embedding_dimension()

    def encode(
        self, texts: list[str], batch_size: int = 32
    ) -> np.ndarray:
        return self.model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,  # 코사인 유사도 최적화
            show_progress_bar=True,
        )
```

## 4단계: FAISS 벡터 스토어

FAISS(Facebook AI Similarity Search)로 고속 k-NN 검색 인덱스를 구축한다.

```python
# src/store.py
import faiss, numpy as np, json, pathlib
from dataclasses import dataclass, field

@dataclass
class Document:
    text: str
    source: str
    chunk_id: int

class FAISSStore:
    def __init__(self, dim: int):
        # IndexFlatIP: 내적 기반 (정규화된 벡터 = 코사인 유사도)
        self.index = faiss.IndexFlatIP(dim)
        self.docs: list[Document] = []

    def add(self, docs: list[Document], embeddings: np.ndarray):
        self.index.add(embeddings.astype("float32"))
        self.docs.extend(docs)

    def search(self, query_vec: np.ndarray, k: int = 5):
        q = query_vec.reshape(1, -1).astype("float32")
        scores, ids = self.index.search(q, k)
        return [
            (self.docs[i], float(scores[0][rank]))
            for rank, i in enumerate(ids[0])
            if i >= 0
        ]

    def save(self, directory: str):
        p = pathlib.Path(directory)
        p.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(p / "faiss.index"))
        meta = [{"text": d.text, "source": d.source,
                  "chunk_id": d.chunk_id} for d in self.docs]
        (p / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False))

    @classmethod
    def load(cls, directory: str, dim: int) -> "FAISSStore":
        p = pathlib.Path(directory)
        store = cls(dim)
        store.index = faiss.read_index(str(p / "faiss.index"))
        meta = json.loads((p / "metadata.json").read_text())
        store.docs = [Document(**m) for m in meta]
        return store
```

## 5단계: 검색 (Retrieval)

```python
# src/retriever.py
from .embedder import Embedder
from .store import FAISSStore

class Retriever:
    def __init__(self, store: FAISSStore, embedder: Embedder):
        self.store = store
        self.embedder = embedder

    def retrieve(self, query: str, k: int = 5):
        q_vec = self.embedder.encode([query])[0]
        results = self.store.search(q_vec, k=k)
        return results  # [(Document, score), ...]
```

## 6단계: 프롬프트 조립 & LLM 생성

검색 결과를 컨텍스트로 조립해 LLM에 전달한다.

![RAG 시스템 전체 파이프라인](/assets/posts/project-rag-from-scratch-architecture.svg)

```python
# src/generator.py
import anthropic

SYSTEM_PROMPT = """당신은 주어진 컨텍스트를 기반으로만 답변하는 AI 어시스턴트입니다.
컨텍스트에 없는 내용은 "제공된 문서에서 찾을 수 없습니다"라고 답변하세요."""

def build_prompt(query: str, hits) -> str:
    context_parts = []
    for i, (doc, score) in enumerate(hits, 1):
        context_parts.append(
            f"[출처 {i}: {doc.source}]\n{doc.text}"
        )
    context = "\n\n---\n\n".join(context_parts)
    return f"컨텍스트:\n{context}\n\n질문: {query}"

class Generator:
    def __init__(self, model: str = "claude-opus-4-5"):
        self.client = anthropic.Anthropic()
        self.model = model

    def generate(self, query: str, hits) -> str:
        prompt = build_prompt(query, hits)
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
```

## 7단계: 파이프라인 통합

```python
# main.py
from src.loader import DocumentLoader
from src.chunker import RecursiveCharacterSplitter
from src.embedder import Embedder
from src.store import FAISSStore, Document
from src.retriever import Retriever
from src.generator import Generator

def build_index(sources: list[str], index_dir: str = "indexes"):
    loader  = DocumentLoader()
    chunker = RecursiveCharacterSplitter(chunk_size=512, chunk_overlap=64)
    embedder = Embedder("BAAI/bge-m3")
    store   = FAISSStore(dim=embedder.dim)

    for source in sources:
        raw   = loader.load(source)
        texts = chunker.split(raw)
        docs  = [Document(text=t, source=source, chunk_id=i)
                 for i, t in enumerate(texts)]
        vecs  = embedder.encode([d.text for d in docs])
        store.add(docs, vecs)

    store.save(index_dir)
    print(f"인덱스 저장 완료: {len(store.docs)} 청크")
    return store, embedder

def query(question: str, index_dir: str = "indexes"):
    embedder  = Embedder("BAAI/bge-m3")
    store     = FAISSStore.load(index_dir, dim=embedder.dim)
    retriever = Retriever(store, embedder)
    generator = Generator()

    hits   = retriever.retrieve(question, k=5)
    answer = generator.generate(question, hits)
    return answer, hits

if __name__ == "__main__":
    # 인덱싱
    build_index(["data/raw/doc1.pdf", "https://example.com/page"])

    # 검색·생성
    answer, hits = query("RAG 시스템의 주요 구성 요소는?")
    print("답변:", answer)
```

## 8단계: 평가 (Faithfulness & Relevance)

RAG 시스템의 품질을 측정하는 두 가지 핵심 지표다.

- **Faithfulness**: 생성된 답변이 검색된 컨텍스트에 충실한가 (Hallucination 측정)
- **Relevance**: 검색된 청크가 쿼리와 얼마나 관련 있는가

```python
# src/evaluator.py
import numpy as np
from .embedder import Embedder

class RAGEvaluator:
    def __init__(self):
        self.embedder = Embedder()

    def relevance_score(self, query: str, hits) -> float:
        """코사인 유사도 기반 검색 관련성 점수"""
        if not hits:
            return 0.0
        scores = [score for _, score in hits]
        return float(np.mean(scores))

    def faithfulness_score(
        self, answer: str, hits, threshold: float = 0.5
    ) -> float:
        """답변의 각 문장이 컨텍스트와 얼마나 유사한지 확인"""
        sentences = [s.strip() for s in answer.split(".") if s.strip()]
        context_texts = [doc.text for doc, _ in hits]

        if not sentences or not context_texts:
            return 0.0

        sent_vecs = self.embedder.encode(sentences)
        ctx_vecs  = self.embedder.encode(context_texts)

        # 각 문장에 대해 가장 높은 컨텍스트 유사도
        sim_matrix = sent_vecs @ ctx_vecs.T  # (S, C)
        max_sims   = sim_matrix.max(axis=1)  # (S,)
        faithful   = (max_sims >= threshold).mean()
        return float(faithful)
```

```python
# 평가 실행
from src.evaluator import RAGEvaluator

evaluator = RAGEvaluator()
answer, hits = query("RAG 시스템의 청킹 전략은?")

rel  = evaluator.relevance_score("RAG 시스템의 청킹 전략은?", hits)
faith = evaluator.faithfulness_score(answer, hits)
print(f"Relevance: {rel:.3f} | Faithfulness: {faith:.3f}")
```

## 실전 팁 & 자주 겪는 함정

**청크 크기 튜닝**: "더 작은 청크 = 더 좋은 검색"이 아니다. 청크가 너무 작으면 문맥이 잘려 LLM이 답변을 생성하기 어렵다. 512 tokens + 64 overlap을 기본값으로 시작하고 평가 지표를 보면서 조정한다.

**임베딩 모델 선택**: 한국어 문서라면 `BAAI/bge-m3`(다국어) 또는 `jhgan/ko-sbert-nli`(한국어 특화)를 권장한다. 인덱싱 시 사용한 모델과 쿼리 시 사용한 모델이 반드시 동일해야 한다.

**FAISS 인덱스 유형**: 문서가 100만 건 이상이면 `IndexFlatIP` 대신 `IndexIVFFlat`(근사 최근접 이웃)으로 전환해 검색 속도를 높인다.

**프롬프트 설계**: 컨텍스트를 `---` 구분선으로 명확히 분리하고, LLM에게 "컨텍스트에 없으면 모른다고 답하라"고 명시해야 Hallucination이 줄어든다.

**인덱스 업데이트**: FAISS `IndexFlatIP`는 삭제를 지원하지 않는다. 문서가 자주 업데이트된다면 전체 재인덱싱 또는 `IndexIDMap`을 사용한다.

**메타데이터 활용**: 청크마다 출처 파일명, 페이지 번호, 생성 날짜를 저장하면 답변에 출처를 표시하고 추후 필터링이 가능하다.

## 정리

이 프로젝트에서 구현한 RAG 파이프라인을 정리하면 다음과 같다.

| 단계 | 구현 | 핵심 고려사항 |
|---|---|---|
| 문서 로딩 | PDF/TXT/URL 통합 | 인코딩, 노이즈 제거 |
| 청킹 | 재귀 분할 + Overlap | 크기 vs 문맥 트레이드오프 |
| 임베딩 | sentence-transformers | 인덱싱·쿼리 모델 동일 |
| 벡터 저장 | FAISS IndexFlatIP | 메타데이터 별도 저장 |
| 검색 | k-NN (코사인 유사도) | k 값, score 임계값 |
| 생성 | LLM API (Claude) | 컨텍스트 주입 프롬프트 |
| 평가 | Faithfulness + Relevance | 자동 + 사람 평가 병행 |

라이브러리 없이 직접 구현하면 각 컴포넌트의 동작 원리를 명확히 이해할 수 있고, 성능 병목이 어디에 있는지 정확히 파악할 수 있다. 다음 글에서는 RAG를 넘어 **에이전트 시스템을 처음부터 직접 구축하는 프로젝트**를 다룬다.

---

**지난 글:** [GPU 메모리 최적화: OOM 없이 더 크게 훈련하는 법](/posts/gpu-memory-tuning/)

**다음 글:** [에이전트 시스템 처음부터 구축하기: 실전 프로젝트](/posts/project-agent-from-scratch/)

<br>
읽어주셔서 감사합니다. 😊
