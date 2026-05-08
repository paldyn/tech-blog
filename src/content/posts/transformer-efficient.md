---
title: "효율적인 트랜스포머: 긴 시퀀스를 다루는 방법들"
description: "Self-Attention의 O(N²) 복잡도 병목, Longformer·BigBird의 희소 어텐션, Flash Attention의 IO-aware 최적화, Sliding Window와 State Space Model까지 한눈에 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "효율화", "Flash Attention", "Longformer", "Mamba", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/transformer-bart/)에서 BART가 노이즈 복원으로 사전학습해 요약·번역에서 강력한 성능을 내는 방법을 살펴봤다. 이제 트랜스포머의 구조적 한계를 하나 짚어야 한다. Self-Attention은 시퀀스 길이 N에 대해 **O(N²) 시간·메모리**를 소비한다. N=512이면 26만 셀, N=8192이면 6700만 셀이다. 긴 문서·코드·이미지를 다루는 현대 LLM에서 이 병목을 해결하는 일은 선택이 아닌 필수가 됐다.

## 왜 O(N²)인가

```python
import torch

def naive_attention(Q, K, V):
    # Q, K, V: (batch, N, d_k)
    scores = Q @ K.transpose(-2, -1)  # (batch, N, N) ← N² 원소
    weights = torch.softmax(scores / Q.size(-1)**0.5, dim=-1)
    return weights @ V
    # 메모리: O(N²), 연산: O(N²·d_k)
```

`Q @ K.T`의 결과가 `N×N` 행렬이므로, 메모리 자체가 이차적으로 증가한다.

![Self-Attention의 이차 복잡도 문제](/assets/posts/transformer-efficient-complexity.svg)

## 접근 방법 1: 희소 어텐션 (Sparse Attention)

"모든 토큰이 모든 토큰을 볼 필요는 없다"는 가정에서 출발한다.

### Longformer (2020, Allen AI)

- **지역 윈도**: 각 토큰이 인접 `w`개 토큰만 참조 — O(N·w)  
- **글로벌 토큰**: `[CLS]`, `[SEP]` 등 일부 토큰은 전체 참조 — O(N)  
- 합산 복잡도: O(N·w + g·N) = O(N)

### BigBird (2020, Google)

Longformer의 지역+글로벌에 **랜덤 어텐션**을 추가. 이론적으로 Turing Complete임을 증명해 전체 어텐션의 표현력과 동등함을 보임.

```python
# Longformer: attention_window 파라미터로 로컬 창 크기 설정
from transformers import LongformerModel, LongformerConfig

config = LongformerConfig(attention_window=512)  # 각 방향 256개 참조
model = LongformerModel(config)
```

## 접근 방법 2: Flash Attention (IO-Aware)

![희소 어텐션 패턴 비교](/assets/posts/transformer-efficient-patterns.svg)

복잡도를 낮추는 것이 아닌, GPU 메모리 계층 구조를 활용해 **HBM 접근 횟수**를 최소화하는 방식이다. 핵심 아이디어:

- 입력을 **타일(tile)** 단위로 나눠 SRAM(온칩 메모리)에서 계산  
- N×N 어텐션 행렬을 HBM에 쓰지 않고 직접 결과 집계  
- 메모리 복잡도: O(N²) → O(N), 실제 속도: 2-4배 향상

Flash Attention은 현재 대부분의 트랜스포머 구현(PyTorch 2.0+, HuggingFace, vLLM)에 기본으로 탑재됐다.

```python
# PyTorch 2.0+ — Flash Attention 자동 활성화
with torch.backends.cuda.sdp_kernel(
    enable_flash=True,
    enable_math=False,
    enable_mem_efficient=False,
):
    output = torch.nn.functional.scaled_dot_product_attention(Q, K, V)
```

## 접근 방법 3: Sliding Window (Mistral, Gemma)

각 레이어에서 토큰이 최근 `W`개 토큰만 참조하는 방식이다. 단, 여러 레이어를 거치면 정보가 전파되므로 장거리 의존성도 간접적으로 포착된다.

- KV Cache 크기: O(W × 레이어 수) — 컨텍스트 길이와 무관  
- Mistral 7B: W=4096으로 32k 컨텍스트에서도 안정적

## 접근 방법 4: State Space Model (Mamba, S4)

어텐션을 완전히 포기하고 **선형 재귀(linear recurrence)**로 O(N) 복잡도를 달성한다. Mamba(2023)는 입력에 따라 SSM 파라미터를 동적으로 변화시키는 **선택적 SSM**을 도입해 어텐션과 비슷한 선택적 기억을 구현했다.

| 특성 | Self-Attention | Mamba |
|------|---------------|-------|
| 복잡도 | O(N²) | O(N) |
| 병렬 학습 | ✓ | △ (특수 알고리즘) |
| 추론 상태 크기 | O(N) (KV Cache) | O(1) |
| 긴 시퀀스 | 취약 | 강점 |

## 효율 트랜스포머 비교 요약

| 방법 | 복잡도 | 메모리 | 구현 난이도 | 채택 모델 |
|------|--------|--------|-----------|---------|
| Full Attention | O(N²) | O(N²) | 기본 | BERT, GPT |
| Sparse (Longformer) | O(N) | O(N) | 중 | Longformer, BigBird |
| Flash Attention | O(N²)* | O(N) | 낮음 | LLaMA, Mistral 등 |
| Sliding Window | O(N·W) | O(W) | 낮음 | Mistral, Gemma |
| SSM (Mamba) | O(N) | O(1) | 높음 | Mamba |

*연산량은 동일, HBM 접근이 줄어 실질 속도 향상

## 정리

- 표준 Self-Attention은 O(N²) 메모리로 긴 시퀀스에 취약  
- **희소 어텐션** (Longformer, BigBird): 지역+글로벌+랜덤으로 O(N) 달성  
- **Flash Attention**: 복잡도 동일, HBM 접근 최소화로 2-4배 가속  
- **Sliding Window**: KV Cache를 O(W)로 고정해 무한 컨텍스트 가능  
- **Mamba/SSM**: 어텐션 없이 O(N), 긴 시퀀스 언어 모델의 유망 대안

---

**지난 글:** [BART: 시퀀스-투-시퀀스 사전학습 모델](/posts/transformer-bart/)

<br>
읽어주셔서 감사합니다. 😊
