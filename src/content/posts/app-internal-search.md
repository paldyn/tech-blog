---
title: "사내 지식 검색 시스템 구축"
description: "직원들이 회사 문서, Wiki, Confluence, Slack 메시지를 자연어로 검색할 수 있는 사내 AI 검색 시스템의 설계와 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["사내검색", "하이브리드검색", "BM25", "벡터검색", "RRF", "Elasticsearch", "Knowledge Management"]
featured: false
draft: false
---

[지난 글](/posts/app-document-qa/)에서 특정 문서에 대한 Q&A 시스템을 만들었다. 이번에는 범위를 넓혀 **회사 전체의 지식 자산**을 검색하는 시스템을 구축한다. Confluence Wiki, Google Drive 문서, Slack 대화, GitHub README, 사내 블로그가 흩어져 있을 때 직원이 자연어로 "OKTA 설정 방법", "온보딩 체크리스트" 같은 질문을 던지면 즉시 관련 문서를 찾아주는 시스템이다.

## 사내 검색의 특수성

일반 검색 엔진과 달리 사내 검색은 몇 가지 독특한 요구사항이 있다.

**정확성이 모호함보다 중요하다**: 고객 지원 챗봇은 비슷한 답변도 괜찮지만 사내 검색에서는 "이 제품의 SLA가 99.9%인가 99.95%인가"처럼 정확한 숫자와 정책이 중요하다. 환각(hallucination)은 잘못된 업무 처리로 이어진다.

**접근 권한 관리가 필요하다**: HR 문서는 HR 담당자만, 재무 자료는 재무팀만 볼 수 있어야 한다. 검색 결과에 권한 필터링이 필수다.

**다양한 소스 통합이 필요하다**: Confluence, Google Drive, GitHub, Slack, Jira 등 각기 다른 API와 포맷을 처리해야 한다.

![사내 하이브리드 검색 아키텍처](/assets/posts/app-internal-search-architecture.svg)

## 하이브리드 검색: BM25 + 벡터

순수 벡터 검색의 약점은 정확한 키워드 매칭이 필요한 경우다. 예를 들어 "K-BIZ-2024-001 계약서"라는 문서 번호를 벡터 검색으로 찾으면 의미론적으로 비슷한 다른 계약서들이 나온다. BM25 키워드 검색과 벡터 검색을 결합하면 이 두 약점을 상호 보완한다.

```python
from elasticsearch import Elasticsearch
import numpy as np

es = Elasticsearch()

def bm25_search(query: str, index: str = "internal_docs", top_k: int = 20) -> list[dict]:
    result = es.search(
        index=index,
        body={
            "query": {"multi_match": {"query": query, "fields": ["title^2", "content"]}},
            "size": top_k,
        },
    )
    return [{"id": hit["_id"], "score": hit["_score"], "content": hit["_source"]["content"]}
            for hit in result["hits"]["hits"]]

def vector_search(query: str, top_k: int = 20, conn) -> list[dict]:
    q_vec = embed_text(query)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, content, 1 - (embedding <=> %s::vector) AS score "
            "FROM doc_chunks ORDER BY score DESC LIMIT %s",
            (q_vec, top_k),
        )
        return [{"id": row[0], "content": row[1], "score": row[2]} for row in cur.fetchall()]
```

## RRF(Reciprocal Rank Fusion)으로 결과 통합

두 검색의 결과를 어떻게 하나로 합칠까? 단순히 점수를 더하면 점수 척도가 달라 공정하지 않다. **RRF(상호 순위 융합)**는 점수 대신 순위를 사용해 시스템 간 점수 차이에 영향을 받지 않는다.

```python
def rrf_merge(
    results_a: list[dict],
    results_b: list[dict],
    k: int = 60,
    top_n: int = 10,
) -> list[dict]:
    scores: dict[str, float] = {}
    doc_map: dict[str, dict] = {}

    for rank, doc in enumerate(results_a):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        doc_map[doc_id] = doc

    for rank, doc in enumerate(results_b):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        doc_map[doc_id] = doc

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [doc_map[doc_id] for doc_id in sorted_ids[:top_n]]
```

RRF의 `k=60`은 경험적으로 검증된 값이다. 낮은 순위 항목의 영향을 줄여 상위 결과의 안정성을 높인다.

![RRF 스코어링 시각화](/assets/posts/app-internal-search-hybrid.svg)

## 소스 커넥터 구현

다양한 소스를 통합하는 커넥터 패턴이다. 각 소스는 동일한 인터페이스를 구현한다.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class Document:
    id: str
    title: str
    content: str
    source: str
    url: str
    permissions: list[str]  # 접근 가능한 그룹/사용자 목록
    updated_at: str

class BaseConnector(ABC):
    @abstractmethod
    def fetch_documents(self, since: str | None = None) -> list[Document]:
        pass

class ConfluenceConnector(BaseConnector):
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token

    def fetch_documents(self, since: str | None = None) -> list[Document]:
        # Confluence REST API 호출
        pages = self._fetch_all_pages(since)
        return [
            Document(
                id=f"confluence:{page['id']}",
                title=page["title"],
                content=self._html_to_text(page["body"]["storage"]["value"]),
                source="confluence",
                url=f"{self.base_url}/wiki{page['_links']['webui']}",
                permissions=self._get_space_permissions(page["space"]["key"]),
                updated_at=page["version"]["when"],
            )
            for page in pages
        ]
```

동일한 인터페이스로 Google Drive, GitHub, Notion 커넥터를 만들면 인덱싱 파이프라인에서 모두 동일하게 처리할 수 있다.

## 권한 기반 필터링

검색 결과를 반환하기 전에 현재 사용자가 접근 권한이 있는 문서만 보여줘야 한다.

```python
def search_with_permissions(
    query: str,
    user_groups: list[str],
    top_k: int = 10,
    conn,
) -> list[dict]:
    # 권한 없이 검색 (더 많은 결과)
    all_results = hybrid_search(query, top_k=top_k * 3, conn=conn)
    # 사용자 그룹 기반 필터링
    allowed = [
        r for r in all_results
        if any(group in r.get("permissions", []) for group in user_groups + ["public"])
    ]
    return allowed[:top_k]
```

권한 정보를 청크 메타데이터에 저장하고 필터링하는 방식이다. 대규모 시스템에서는 Elasticsearch의 `bool filter`나 pgvector의 WHERE 절로 DB 레벨에서 필터링하는 것이 더 효율적이다.

## 증분 인덱싱과 동기화

초기 인덱싱 후 새로운 문서와 변경된 문서를 지속적으로 동기화해야 한다.

```python
import schedule
import time

def incremental_sync():
    last_sync = get_last_sync_time()  # Redis나 DB에서 마지막 동기화 시간 조회

    for connector in [ConfluenceConnector(...), GoogleDriveConnector(...)]:
        new_docs = connector.fetch_documents(since=last_sync)
        for doc in new_docs:
            chunks = semantic_chunks(doc.content)
            vectors = embed_texts(chunks)
            upsert_to_db(doc, chunks, vectors)  # 기존 문서면 UPDATE, 없으면 INSERT

    save_last_sync_time()

schedule.every(30).minutes.do(incremental_sync)

while True:
    schedule.run_pending()
    time.sleep(60)
```

변경 감지는 소스 API의 `updated_at` 타임스탬프나 webhook을 활용한다. Confluence와 Notion은 webhook을 지원하므로 실시간 업데이트가 가능하다.

## 검색 품질 평가

시스템을 배포한 후에도 지속적인 품질 관리가 필요하다.

**Click-through Rate (CTR)**: 검색 결과를 클릭했는지 여부. 높을수록 관련성이 좋다.

**NDCG (Normalized Discounted Cumulative Gain)**: 상위 결과의 관련성이 더 높을수록 점수가 높다.

**사용자 피드백**: 결과 옆에 👍/👎 버튼을 두고 피드백을 수집한다. 나쁜 결과가 많은 쿼리 패턴을 찾아 개선한다.

```python
def log_search_event(query: str, results: list[str], clicked_id: str | None):
    event = {
        "timestamp": datetime.now().isoformat(),
        "query": query,
        "result_ids": [r["id"] for r in results],
        "clicked_id": clicked_id,
    }
    # 분석 DB나 이벤트 스트림에 저장
    analytics_db.insert(event)
```

---

**지난 글:** [문서 Q&A 시스템 구축: RAG 기반 PDF·문서 검색](/posts/app-document-qa/)

**다음 글:** [AI 고객 지원 자동화: 티켓 분류부터 답변 생성까지](/posts/app-customer-support/)

<br>
읽어주셔서 감사합니다. 😊
