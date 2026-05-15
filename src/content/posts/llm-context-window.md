---
title: "컨텍스트 윈도우: LLM의 작업 기억"
description: "컨텍스트 윈도우의 개념과 토큰 제한의 의미, KV 캐시와 메모리 사용량, 긴 컨텍스트 처리 기법(Sliding Window, Sparse Attention, RoPE), 그리고 RAG vs 긴 컨텍스트의 실용적 판단 기준을 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["LLM", "컨텍스트윈도우", "KV캐시", "RAG", "SlidingWindow", "RoPE", "토큰", "메모리"]
featured: false
draft: false
---

[지난 글](/posts/llm-emergent-abilities/)에서 규모가 임계값을 넘을 때 창발적 능력이 등장한다는 사실을 살펴봤다. 그런데 아무리 강력한 LLM이라 해도 한 번에 처리할 수 있는 정보의 양에는 명확한 상한선이 있다. 바로 **컨텍스트 윈도우(Context Window)**다. 인간이 단기 기억(Working Memory)을 통해 대화 맥락을 유지하듯, LLM은 컨텍스트 윈도우 안의 토큰들만을 "현재 생각"의 재료로 활용한다. 이 제한이 LLM의 실용적 배포에서 얼마나 중요한 제약이 되는지, 그리고 이를 극복하기 위해 어떤 기법이 등장했는지를 이 글에서 깊이 살펴본다.

## 컨텍스트 윈도우란 무엇인가

컨텍스트 윈도우는 LLM이 한 번의 추론(forward pass)에서 처리할 수 있는 **토큰의 최대 개수**다. 입력 프롬프트와 생성된 출력을 합친 전체 토큰 수가 이 한계를 넘을 수 없다. 초기 GPT-2는 1,024 토큰에 불과했지만, GPT-4 Turbo는 128,000 토큰, Claude 3 Opus는 200,000 토큰을 지원한다. Gemini 1.5 Pro는 무려 1,000,000 토큰(약 750,000 단어)을 처리할 수 있다.

토큰이란 무엇일까? 토큰은 단어보다 작은 단위로, 영어 기준으로 평균 약 0.75 단어에 해당한다. 한국어는 형태소 구조 때문에 영어보다 토큰화 효율이 다소 낮아, 같은 정보량을 전달하는 데 더 많은 토큰이 필요하다. 1,000 토큰은 영어로는 약 750단어, 한국어로는 약 400~500 어절에 해당한다고 보면 된다.

![컨텍스트 윈도우 구조](/assets/posts/llm-context-window-structure.svg)

## 컨텍스트 윈도우의 구성

실제 사용에서 컨텍스트 윈도우는 크게 세 부분으로 나뉜다.

**시스템 프롬프트(System Prompt)**는 모델의 역할, 행동 지침, 응답 형식 등을 정의하는 고정 텍스트다. 애플리케이션마다 다르지만 일반적으로 수백~수천 토큰을 차지하며, 모든 요청에 재사용된다.

**대화 기록(Conversation History)**은 이전 사용자 메시지와 모델 응답의 누적이다. 장기 대화일수록 이 부분이 폭발적으로 증가한다. 10번의 왕복 대화만으로도 수천 토큰이 쌓일 수 있다.

**현재 쿼리(Current Query)**는 사용자의 현재 입력으로, 첨부 문서, 코드, RAG 검색 결과 등이 포함될 수 있다.

이 세 부분의 합이 컨텍스트 한계를 넘으면, 모델은 오래된 내용을 **잘라내거나(truncation)** 다른 전략을 적용해야 한다.

## KV 캐시: 추론 효율의 핵심

Transformer의 Self-Attention 연산에서 각 토큰은 이전 모든 토큰에 대한 Key(K)와 Value(V) 행렬을 계산해야 한다. 이를 매번 재계산하면 엄청난 비용이 발생하므로, 현대 LLM 추론 시스템은 **KV 캐시(Key-Value Cache)**를 사용한다. 이미 처리된 토큰의 K, V 값을 GPU 메모리에 저장해두고, 새 토큰 생성 시 재활용하는 방식이다.

이 KV 캐시의 메모리 사용량은 컨텍스트 길이에 **선형 비례**한다.

```python
# 컨텍스트 길이별 KV 캐시 메모리 계산
def kv_cache_memory_gb(
    seq_len: int,
    num_layers: int = 32,
    num_heads: int = 32,
    head_dim: int = 128,
    batch_size: int = 1,
    dtype_bytes: int = 2,  # fp16
) -> float:
    # K + V 각각 (layer × head × dim)
    kv_elements = 2 * num_layers * num_heads * head_dim
    total_bytes = kv_elements * seq_len * batch_size * dtype_bytes
    return total_bytes / (1024 ** 3)

print(f"4K  토큰: {kv_cache_memory_gb(4_096):.2f} GB")
print(f"32K 토큰: {kv_cache_memory_gb(32_768):.2f} GB")
print(f"128K토큰: {kv_cache_memory_gb(131_072):.2f} GB")
```

LLaMA-2 70B 기준으로 계산하면, 4K 토큰은 약 0.5GB, 32K는 4GB, 128K는 무려 16GB의 메모리가 KV 캐시에만 소비된다. A100 GPU 한 장(80GB)의 20%가 캐시에 사용된다는 의미다. 게다가 Attention 연산 자체는 시퀀스 길이의 **제곱(O(n²))**에 비례하므로, 긴 컨텍스트는 메모리와 연산 시간 모두에서 급격한 비용 증가를 유발한다.

![KV 캐시 메모리 계산](/assets/posts/llm-context-window-kvcache.svg)

## 긴 컨텍스트 처리 기법

긴 시퀀스를 효율적으로 처리하기 위해 다양한 기법이 개발됐다.

### Sliding Window Attention

전통적인 Full Attention은 모든 토큰 쌍 사이의 관계를 계산한다. Sliding Window Attention(슬라이딩 윈도우 어텐션)은 각 토큰이 **가장 최근 w개의 토큰**에만 주의를 기울이도록 제한한다. Mistral 7B가 이 방식을 채택했으며, 연산 복잡도를 O(n²)에서 O(n·w)로 줄인다. 단점은 윈도우 너머의 오래된 정보에 직접 접근이 불가하다는 점이다.

### Sparse Attention

Longformer, BigBird 등이 채택한 방식으로, 지역적 어텐션(local)과 전역 어텐션(global)을 결합한다. 특정 "글로벌 토큰"(예: [CLS] 토큰)은 모든 다른 토큰과 상호작용하고, 나머지는 근처 토큰과만 교류한다. 문서 전체의 구조를 파악하면서도 연산 효율을 유지할 수 있다.

### RoPE: 위치 정보의 확장

**RoPE(Rotary Position Embedding)**는 절대적 위치 인코딩 대신, 토큰 간의 **상대적 위치**를 회전 행렬로 표현하는 방식이다. LLaMA, Mistral, Qwen 등 대부분의 현대 오픈소스 LLM이 채택하고 있다.

RoPE의 큰 장점은 **길이 외삽(Length Extrapolation)**이 가능하다는 점이다. YaRN(Yet another RoPE extensioN), LongRoPE 등의 기법으로 RoPE의 회전 주파수를 조정하면, 학습 시 보지 못한 긴 시퀀스에도 적용 가능하다. Llama 3.1은 이를 활용해 8K에서 128K로 컨텍스트를 확장했다.

### FlashAttention

하드웨어 수준의 최적화로, GPU 메모리 계층 구조를 활용해 Attention 연산을 **타일(tile)** 단위로 처리한다. 동일한 결과를 내면서 메모리 사용량을 대폭 줄이고 속도를 높인다. FlashAttention-2, FlashAttention-3가 현재 대부분의 고성능 LLM 추론에서 표준이 됐다.

## Lost in the Middle: 긴 컨텍스트의 함정

"이제 128K 토큰을 쓸 수 있으니 걱정 없다"고 생각하면 오산이다. Liu et al. (2023)의 연구 "Lost in the Middle"은 LLM이 긴 컨텍스트에서 **중간 부분의 정보를 잘 활용하지 못한다**는 사실을 발견했다. 모델은 컨텍스트의 시작 부분과 끝 부분에 더 강하게 주의를 기울이고, 중간 부분은 상대적으로 무시하는 경향이 있다.

이는 Attention 메커니즘의 근본적 특성과 사전학습 데이터 분포에서 비롯된다. 따라서 중요한 정보를 컨텍스트의 시작이나 끝에 배치하는 것이 현실적인 프롬프팅 전략이 된다.

## RAG vs 긴 컨텍스트: 실용적 판단

128K~1M 토큰을 지원하는 모델이 등장하면서, **RAG(Retrieval-Augmented Generation)가 여전히 필요한가**라는 질문이 생겼다. 답은 "상황에 따라 다르다"다.

| 기준 | 긴 컨텍스트 선호 | RAG 선호 |
|---|---|---|
| 문서 수 | 소수(~수십) | 다수(수천~수만) |
| 업데이트 빈도 | 낮음 | 높음(실시간) |
| 비용 | 토큰당 비용 증가 | 검색 인프라 비용 |
| 정확성 | 전체 맥락 활용 | 검색 품질에 의존 |
| 지연 시간 | 느림(긴 프리필) | 빠름(짧은 컨텍스트) |

수백 페이지 분량의 계약서를 분석하거나, 소설 전체를 읽고 질문에 답해야 할 때는 긴 컨텍스트 모델이 유리하다. 반면 수만 건의 문서 중 관련 정보를 동적으로 조합해야 한다면 RAG가 더 경제적이고 유연하다.

## 컨텍스트 윈도우 관리 전략

실제 애플리케이션에서는 다음 전략들을 조합해 컨텍스트를 관리한다.

**압축(Compression):** LLMLingua 같은 도구를 사용해 컨텍스트를 압축한다. 덜 중요한 토큰을 제거해 동일 정보를 더 적은 토큰으로 표현한다.

**요약(Summarization):** 오래된 대화 기록을 주기적으로 요약해 축약된 형태로 보관한다. 세부 내용은 일부 손실되지만 핵심 맥락은 유지된다.

**메모리 구조(Memory Architecture):** 단기 메모리(현재 컨텍스트), 장기 메모리(외부 저장소), 에피소딕 메모리(과거 대화 요약)를 계층적으로 운용하는 복합 아키텍처다. AI 에이전트 시스템에서 점점 중요해지고 있다.

컨텍스트 윈도우는 단순한 기술적 제약이 아니라, LLM의 "현재 의식"의 범위를 정의한다. 이 범위를 어떻게 채우고 관리하느냐에 따라 LLM 애플리케이션의 품질이 결정된다. 다음 글에서는 컨텍스트 안에서 모델이 어떻게 다음 토큰을 선택하는지, 즉 생성 과정의 다양성을 제어하는 Temperature, Top-k, Top-p 파라미터를 알아본다.

---

**지난 글:** [창발적 능력: 규모에서 탄생하는 새로운 역량](/posts/llm-emergent-abilities/)

**다음 글:** [Temperature·Top-k·Top-p: 생성 다양성 제어](/posts/llm-temperature-top-k-top-p/)

<br>
읽어주셔서 감사합니다. 😊
