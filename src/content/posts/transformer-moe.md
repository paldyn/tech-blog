---
title: "Mixture of Experts: 희소 활성화로 거대 모델 만들기"
description: "Mixture of Experts(MoE)가 FFN 레이어를 다수의 전문가로 교체하고 토큰마다 Top-K만 활성화해 파라미터는 늘리되 연산량은 유지하는 원리와 실전 구현을 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["MoE", "Mixture of Experts", "희소 활성화", "트랜스포머", "Mixtral", "DeepSeek"]
featured: false
draft: false
---

[지난 글](/posts/transformer-mqa-gqa/)에서 GQA가 KV 헤드를 줄여 메모리를 절감하는 방법을 살펴봤다. 이번에는 파라미터 규모와 연산 비용을 분리하는 전혀 다른 전략인 **Mixture of Experts(MoE)**를 다룬다. MoE는 1991년 Jacobs et al.의 아이디어를 현대 트랜스포머에 접목한 것으로, 2024년 GPT-4, Mixtral 8×7B, DeepSeek-V3 등에서 적용되며 LLM 아키텍처의 새로운 주류가 됐다.

## 핵심 아이디어: 희소 활성화

밀집(Dense) 트랜스포머에서 FFN 레이어는 모든 토큰에 대해 동일하게 활성화된다. MoE는 이 FFN을 **N개의 독립 전문가(Expert) FFN**으로 교체한다. 각 토큰은 라우터(Router)를 통해 이 중 **Top-K개만 선택**해 실행한다. K=2이면 전체 N개 파라미터 중 2/N만 활성화되는 셈이다.

```
Dense FFN:    토큰 → FFN(전체 파라미터) → 출력
MoE FFN:      토큰 → Router → Expert₁, Expert₃ → 가중 합산 → 출력
```

결과적으로 **파라미터 수는 N배 증가**하지만 **추론 FLOPs는 거의 동일**하다. "같은 연산 비용으로 더 큰 모델"이 가능해진다. Mixtral 8×7B는 총 47B 파라미터지만 추론 시 활성 파라미터는 13B 수준이다.

## 라우터와 게이팅 메커니즘

라우터는 간단한 선형 레이어다. 입력 토큰 벡터 x를 받아 각 전문가의 적합도 점수를 계산한다:

```python
# 라우터 게이팅
logits = W_g @ x          # (num_experts,)
gates, indices = logits.topk(K)   # Top-K 선택
gates = softmax(gates)     # 정규화 (합 = 1)

# 출력 = 선택된 전문가의 가중 합산
output = sum(gates[i] * Expert_i(x) for i in indices)
```

![MoE 구조와 토큰 라우팅](/assets/posts/transformer-moe-architecture.svg)

## PyTorch 구현

![MoE 레이어 구현 코드](/assets/posts/transformer-moe-code.svg)

위 구현은 개념 설명용이다. 실제 분산 학습에서는 전문가를 서로 다른 GPU에 배치하고, 토큰을 해당 GPU로 올바르게 라우팅하는 **Expert Parallelism**과 **All-to-All 통신**이 필요하다.

## 로드 밸런싱 문제와 보조 손실

MoE의 고질적 문제는 **라우터 붕괴(Router Collapse)**다. 학습 초기에 특정 전문가가 우연히 좋은 성능을 보이면, 라우터가 그 전문가만 계속 선택하게 되어 나머지 전문가는 학습이 안 된다.

이를 막기 위해 **보조 로드 밸런싱 손실(Auxiliary Load Balancing Loss)**을 추가한다:

```python
def load_balancing_loss(router_probs, expert_indices, num_experts):
    # 전문가별 할당 비율 f_i
    expert_mask = F.one_hot(expert_indices, num_experts).float()
    tokens_per_expert = expert_mask.mean(dim=0)   # (num_experts,)
    # 전문가별 라우터 점수 평균 p_i
    avg_probs = router_probs.mean(dim=0)          # (num_experts,)
    # 균등 분배 유도: f_i * p_i의 합을 최소화
    loss = num_experts * (tokens_per_expert * avg_probs).sum()
    return loss

# 총 손실 = 언어 모델링 손실 + α * 로드 밸런싱 손실
total_loss = lm_loss + 0.01 * load_balancing_loss(...)
```

이 손실은 모든 전문가가 균등하게 토큰을 받도록 유도한다. α(보조 손실 계수)는 0.001~0.01 사이가 일반적이다.

## Expert Choice vs Token Choice

기존 방식(Token Choice)은 각 토큰이 Top-K 전문가를 선택한다. 문제는 인기 전문가에 토큰이 몰릴 때 처리 용량 제한(Expert Capacity)을 초과하면 일부 토큰이 전문가를 건너뛰어야 한다는 것이다.

**Expert Choice**(Zhou et al., 2022) 방식은 반대다. 각 전문가가 처리할 Top-K 토큰을 선택한다. 전문가 용량이 보장되고 로드 밸런싱이 자연스럽지만, 일부 토큰이 어떤 전문가에도 선택받지 못할 수 있다.

DeepSeek은 **공유 전문가(Shared Expert)**를 추가로 두어, 모든 토큰이 반드시 거치는 공통 표현 학습을 담당하게 했다. 나머지 전문가들은 특화된 능력을 학습한다.

## 주요 MoE 모델 비교

| 모델 | 총 파라미터 | 활성 파라미터 | 전문가 수 | Top-K |
|------|-----------|-------------|---------|------|
| Mixtral 8×7B | 47B | 13B | 8 | 2 |
| Mixtral 8×22B | 141B | 39B | 8 | 2 |
| DeepSeek-V3 | 671B | 37B | 256 | 8 |
| GPT-4 (추정) | ~1.8T | ~220B | ~16 | 2 |

DeepSeek-V3는 256개 전문가 중 8개를 선택하는 극단적 희소성으로 효율을 극대화했다. 총 파라미터가 671B지만 추론 비용은 Dense 37B 수준이다.

## 추론 최적화

MoE 추론에서는 배치 내 다른 토큰이 서로 다른 전문가를 선택하므로, GPU 활용률이 Dense 모델보다 낮을 수 있다. 이를 해결하는 방법:

- **Expert 배치 최적화**: 같은 전문가를 선택한 토큰끼리 묶어 행렬 곱 한 번에 처리
- **전문가 캐싱**: 최근에 자주 사용된 전문가를 GPU 메모리에 유지
- **vLLM, TensorRT-LLM**: MoE 최적화 커널 내장

다음 글에서는 이 거대한 LLM들이 텍스트를 처음 받아들이는 방법, 토크나이저를 다룬다.

---

**지난 글:** [MQA와 GQA: KV Cache 경량화 전략](/posts/transformer-mqa-gqa/)

**다음 글:** [토크나이저와 토큰: LLM이 텍스트를 보는 방법](/posts/tokenizer-and-tokens/)

<br>
읽어주셔서 감사합니다. 😊
