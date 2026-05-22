---
title: "LLM 기반 추천 시스템: 언어 모델이 바꾸는 추천의 패러다임"
description: "LLM을 추천 시스템에 활용하는 방법, 프롬프트 기반 추천, 임베딩 기반 검색, 설명 생성, LLM 재랭킹 파이프라인을 실제 코드와 함께 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["LLM추천", "추천시스템", "언어모델", "임베딩", "RAG추천", "개인화", "재랭킹", "설명생성"]
featured: false
draft: false
---

[지난 글](/posts/recsys-two-tower/)에서 투타워 모델이 대규모 환경에서 실시간 추천을 어떻게 처리하는지 살펴보았다. 투타워는 빠른 후보 검색을 가능하게 해주지만, "왜 이걸 추천했는가"를 설명하지 못하고 사용자의 복잡한 의도를 자연어로 표현하기 어렵다는 한계가 있다. 대형 언어 모델(LLM)의 등장은 이 한계를 정면으로 돌파한다. LLM은 사용자의 자연어 쿼리를 깊이 이해하고, 아이템의 의미를 풍부하게 표현하며, 추천 이유를 자연어로 생성할 수 있다. 이번 글에서는 LLM을 추천 시스템에 통합하는 다양한 접근법을 실제 코드와 함께 완전히 해설한다.

## 왜 LLM이 추천에 혁신인가

전통적인 협업 필터링과 딥러닝 추천 모델은 모두 **ID 기반 표현**에 의존한다. 사용자 ID 123과 아이템 ID 456을 임베딩 테이블에 조회해 벡터를 얻는다. 이 방식은 콜드 스타트 문제에 취약하고, 아이템의 풍부한 의미 정보(설명, 리뷰, 맥락)를 활용하지 못하며, "최근 등록된 공포 소설 중 심리 스릴러 요소가 강한 것"처럼 복잡한 의도를 처리할 수 없다.

LLM은 이 세 가지 문제를 동시에 해결한다. 텍스트 기반 표현이므로 새 아이템도 즉시 임베딩 가능하고, 수억 개의 텍스트로 사전 학습한 세계 지식이 내재되어 있으며, 자연어 쿼리를 그대로 이해할 수 있다.

## 접근법 1: 프롬프트 기반 추천

가장 단순한 방식은 LLM에게 직접 추천을 요청하는 것이다. 사용자 이력, 현재 컨텍스트, 후보 아이템 목록을 프롬프트에 담아 LLM이 최적 순서를 정하도록 한다.

```python
import anthropic

client = anthropic.Anthropic()

def llm_rank_items(user_history: list[str], candidates: list[dict]) -> list[dict]:
    """LLM으로 후보 아이템 재랭킹"""
    history_str = "\n".join(f"- {h}" for h in user_history[-10:])
    items_str = "\n".join(
        f"{i+1}. [{c['id']}] {c['title']}: {c['description'][:80]}"
        for i, c in enumerate(candidates)
    )

    prompt = f"""사용자 최근 시청 이력:
{history_str}

후보 콘텐츠 목록:
{items_str}

위 이력을 바탕으로 사용자가 가장 좋아할 순서로 번호를 나열하고,
각 추천 이유를 한 줄로 설명하세요. JSON 형식으로 응답하세요."""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return resp.content[0].text
```

이 방식은 구현이 단순하고 강력하지만, 후보가 수백 개를 넘으면 컨텍스트 윈도우 한계에 걸린다. 따라서 실제 시스템에서는 **투타워 모델로 Top-100을 먼저 추리고, LLM으로 Top-10을 선별**하는 2단계 파이프라인을 구성한다.

![LLM 기반 추천 아키텍처](/assets/posts/recsys-llm-based-architecture.svg)

## 접근법 2: LLM 임베딩 기반 시맨틱 검색

LLM의 임베딩 능력을 활용해 사용자와 아이템을 의미 공간에 표현하면, 협업 필터링의 콜드 스타트 문제를 해결할 수 있다.

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def embed_text(text: str, client) -> np.ndarray:
    """텍스트를 LLM 임베딩 벡터로 변환 (OpenAI text-embedding-3-large 예시)"""
    from openai import OpenAI
    oa = OpenAI()
    resp = oa.embeddings.create(model="text-embedding-3-large", input=text)
    return np.array(resp.data[0].embedding)

def build_user_profile(history: list[str], client) -> np.ndarray:
    """사용자 이력을 하나의 프로필 임베딩으로 집약"""
    embeddings = [embed_text(h, client) for h in history]
    # 최근 이력에 가중치 부여 (지수 감쇠)
    weights = np.exp(np.linspace(-1, 0, len(embeddings)))
    weights /= weights.sum()
    return np.average(embeddings, axis=0, weights=weights)

def semantic_recommend(user_profile: np.ndarray,
                        item_embeddings: np.ndarray,
                        item_ids: list,
                        k: int = 20) -> list:
    """코사인 유사도 기반 Top-K 추천"""
    scores = cosine_similarity([user_profile], item_embeddings)[0]
    top_indices = np.argsort(scores)[::-1][:k]
    return [(item_ids[i], scores[i]) for i in top_indices]
```

임베딩 기반 접근의 핵심 장점은 **콜드 스타트 해결**이다. 새로 등록된 아이템도 제목과 설명 텍스트만 있으면 즉시 임베딩을 생성해 추천 풀에 포함할 수 있다.

## 접근법 3: RAG 기반 추천

검색 증강 생성(RAG)을 추천에 적용하면 벡터 DB의 효율적인 검색과 LLM의 추론 능력을 결합할 수 있다.

```python
# RAG 추천 파이프라인 (pgvector 활용)
import psycopg2

def rag_recommend(user_query: str, pg_conn, client, k=10):
    """
    1. 쿼리 임베딩 → 벡터 DB 검색 → LLM 설명 생성
    """
    query_emb = embed_text(user_query, client)

    # pgvector로 ANN 검색
    cur = pg_conn.cursor()
    cur.execute("""
        SELECT id, title, description,
               1 - (embedding <=> %s::vector) AS score
        FROM items
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """, (query_emb.tolist(), query_emb.tolist(), k * 3))
    candidates = cur.fetchall()

    # LLM으로 최종 재랭킹 + 설명 생성
    prompt = build_rerank_prompt(user_query, candidates)
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return parse_ranked_results(resp.content[0].text, candidates)
```

![LLM 기반 추천 구현 패턴](/assets/posts/recsys-llm-based-code.svg)

## 접근법 4: LLM as 피처 엔지니어링

LLM을 직접 추론에 쓰지 않고, 추천 모델의 입력 피처를 풍부하게 만드는 데 활용할 수도 있다. 아이템 설명 텍스트에서 구조화된 속성(장르, 감정 톤, 대상 연령, 주제)을 자동 추출하는 방식이다.

```python
def extract_item_features(item_desc: str, client) -> dict:
    """LLM으로 아이템 속성 구조화 추출"""
    prompt = f"""다음 콘텐츠 설명에서 추천 시스템에 유용한 속성을 추출하세요.
설명: {item_desc}

JSON으로 응답:
- genre: 장르 목록
- tone: 감정 톤 (밝음/어두움/중립)
- age_group: 대상 연령대
- themes: 핵심 주제 키워드 3개"""

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",  # 저비용 모델로 배치 처리
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}]
    )
    import json
    return json.loads(resp.content[0].text)
```

Haiku 같은 소형 모델을 사용하면 수백만 개의 아이템을 배치로 처리해도 비용을 통제할 수 있다.

## 추천 설명 생성: 사용자 신뢰 구축

LLM 기반 추천의 가장 강력한 차별점은 **추천 이유를 자연어로 생성**할 수 있다는 것이다. "이 영화를 추천하는 이유: 최근에 즐겨보신 노아 바움백 감독 특유의 뉴욕 배경 가족 드라마 스타일과 유사하며, 선호하시는 블랙 코미디 요소가 강합니다."

```python
def generate_explanation(user_profile: dict, item: dict, client) -> str:
    """추천 근거 자연어 설명 생성"""
    prompt = f"""사용자 프로필: {user_profile['summary']}
추천 아이템: {item['title']} - {item['description']}

이 사용자에게 이 아이템을 추천하는 이유를 2-3문장으로 설명하세요.
구체적인 사용자 선호와 아이템 특성을 연결해서 설명하세요."""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )
    return resp.content[0].text
```

## LLM 추천의 실전 아키텍처

실제 프로덕션 시스템은 비용과 지연 시간을 고려해 레이어드 아키텍처를 구성한다.

| 단계 | 방법 | 후보 수 | 지연 |
|------|------|---------|------|
| Recall | ANN 벡터 검색 | 10만 → 100 | ~10ms |
| Pre-rank | 경량 신경망 | 100 → 30 | ~20ms |
| Re-rank | LLM (Haiku) | 30 → 10 | ~200ms |
| Explain | LLM (Sonnet) | Top-5 | ~500ms |

각 단계를 분리하면 전체 추천 지연을 수백 ms 내로 유지하면서 LLM의 추론 품질도 활용할 수 있다.

## LLM 추천의 한계

| 한계 | 설명 |
|------|------|
| 비용 | 사용자당 LLM API 호출 비용 발생 |
| 지연 | LLM 추론은 ms 단위 불가 (수백ms~수s) |
| 규모 | 실시간 대용량 처리 어려움 |
| 환각 | 존재하지 않는 아이템 추천 가능성 |

이 한계 때문에 LLM을 전체 파이프라인에 적용하지 않고 **Recall → Re-rank → Explain** 구조에서 마지막 단계에만 투입하는 전략이 현실적이다.

## 마무리

LLM 기반 추천 시스템은 전통적인 협업 필터링의 한계를 의미론적 이해, 자연어 쿼리 처리, 추천 설명 생성으로 보완한다. 단독으로 쓰기보다는 투타워 + ANN 검색 + LLM 재랭킹의 하이브리드 파이프라인으로 비용과 품질을 균형 있게 설계하는 것이 핵심이다.

---

**지난 글:** [투타워 모델: 대규모 추천 시스템 구조 완전 해설](/posts/recsys-two-tower/)

**다음 글:** [강화학습 기초: 에이전트, 환경, 보상의 언어](/posts/rl-basics/)

<br>
읽어주셔서 감사합니다. 😊
