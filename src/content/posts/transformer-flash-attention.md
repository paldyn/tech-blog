---
title: "FlashAttention: IO-Aware 어텐션 연산"
description: "FlashAttention이 GPU 메모리 계층(HBM↔SRAM)을 타일링으로 활용해 어텐션의 속도와 메모리 효율을 동시에 극적으로 개선하는 원리를 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["FlashAttention", "GPU 최적화", "트랜스포머", "어텐션", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/transformer-rotary/)에서 RoPE가 회전을 통해 어텐션 내적에 위치 정보를 심는 방법을 살펴봤다. 이번에는 그 어텐션 연산 자체를 근본적으로 가속하는 방법인 **FlashAttention**을 다룬다. 2022년 Tri Dao 등이 발표한 FlashAttention은 알고리즘적 혁신 없이 오직 메모리 계층 구조 활용만으로 어텐션을 최대 7.6배 빠르게, 메모리는 O(N) 수준으로 줄였다. 현재 주요 LLM 학습·추론의 사실상 필수 구성요소다.

## 병목은 FLOPS가 아니라 IO였다

표준 어텐션의 연산 복잡도는 O(N²d)로 이미 알려진 사실이다. 그런데 현대 GPU에서 어텐션이 이론 FLOPS 대비 훨씬 느린 이유는 따로 있다. **HBM(High Bandwidth Memory, GPU 메인 메모리)과 SRAM(온칩 캐시) 사이의 데이터 이동**이 실제 병목이다.

A100 GPU 기준으로 SRAM 대역폭은 ~19TB/s인 반면 HBM 대역폭은 ~2TB/s다. SRAM이 10배 빠르지만 크기는 40MB에 불과하다(HBM은 40~80GB). 표준 어텐션은 N×N 어텐션 행렬 S와 softmax 결과 P를 HBM에 쓰고 다시 읽는 과정을 반복한다. N=4096이면 16M 원소짜리 행렬을 여러 차례 이동하는 셈이다.

```
표준 어텐션 HBM 접근:
1. Q, K, V 읽기          → HBM read: O(Nd)
2. S = QK^T 쓰기         → HBM write: O(N²)
3. S 읽어 softmax        → HBM read: O(N²)
4. P 쓰기                → HBM write: O(N²)
5. P, V 읽어 O = PV     → HBM read: O(N² + Nd)
총 IO: O(N²) — N=4K이면 64GB 이동
```

## FlashAttention의 해법: 타일링 + Online Softmax

FlashAttention의 핵심 아이디어는 두 가지다.

**타일링(Tiling)**: Q, K, V를 SRAM에 들어오는 크기의 블록으로 잘라, 각 블록 쌍에 대해 어텐션을 SRAM 내에서 완결한다. N×N 행렬을 HBM에 쓸 필요 없이, 타일별 결과를 누적해 최종 출력 O를 한 번만 HBM에 기록한다.

**Online Softmax**: 문제는 softmax가 전체 행의 최댓값을 알아야 수치적으로 안정하다는 것이다. Milakov & Gimelshein(2018)의 online softmax 기법을 활용해, 새 블록을 볼 때마다 현재까지의 최댓값과 정규화 상수를 갱신하는 방식으로 전체 S를 저장하지 않고도 올바른 softmax를 계산한다.

![FlashAttention IO 메모리 계층 비교](/assets/posts/transformer-flash-attention-io.svg)

```python
# Online Softmax 누적 원리 (의사코드)
m_i = -inf   # 현재까지 최댓값
l_i = 0      # 정규화 상수 (분모)
O_i = 0      # 출력 누적

for block_j in range(num_blocks):
    S_ij = Q_i @ K_j.T / sqrt(d)     # 타일 어텐션 점수
    m_new = max(m_i, S_ij.max())      # 최댓값 갱신
    # 이전 누적 보정 + 새 블록 기여 합산
    l_new = exp(m_i - m_new) * l_i + exp(S_ij - m_new).sum()
    O_i = (l_i * exp(m_i - m_new) * O_i
           + exp(S_ij - m_new) @ V_j) / l_new
    m_i, l_i = m_new, l_new
```

이 알고리즘으로 HBM 읽기/쓰기가 O(N²) → O(N²/M·d)로 줄어든다. M은 SRAM 크기다. 실측 기준 A100에서 표준 어텐션 대비 **2.4~7.6배 빠름**, 메모리는 O(N) 사용.

## 역전파에서의 재계산

FlashAttention의 또 다른 혁신은 역전파다. 표준적으로는 역전파를 위해 순전파의 어텐션 행렬 P를 저장해야 한다. FlashAttention은 이 대신 **순전파 시 각 블록의 소프트맥스 통계값(최댓값 m, 정규화 상수 l)만 저장**하고, 역전파에서 해당 블록을 다시 계산(recomputation)한다. 저장 비용 O(N²) → O(N), 역전파 연산 비용은 소폭 증가하지만 IO 비용이 훨씬 크므로 전체적으로 이득이다.

## PyTorch 통합과 실전 사용법

![FlashAttention 사용법과 버전별 특징](/assets/posts/transformer-flash-attention-code.svg)

PyTorch 2.0부터 `torch.nn.functional.scaled_dot_product_attention`에 FlashAttention이 내장됐다. `torch.nn.MultiheadAttention`도 내부적으로 이를 활용한다. `torch.compile`과 함께 쓰면 추가 최적화가 적용된다.

```python
# 모델 전체에 FlashAttention 자동 적용
import torch

model = MyTransformer()
# torch.compile이 내부 어텐션에 FlashAttn 커널을 선택
model = torch.compile(model)

# 수동으로 sdpa 컨텍스트 지정
with torch.backends.cuda.sdp_kernel(
    enable_flash=True,
    enable_math=False,
    enable_mem_efficient=False
):
    output = model(input_ids)
```

주의: FlashAttention은 헤드 차원이 **64, 96, 128** 등 특정 값이어야 CUDA 커널이 최적화된다. 비표준 차원에서는 자동으로 math 백엔드로 폴백된다.

## FlashAttention v2, v3

| 버전 | 주요 개선 | 속도 향상 |
|-----|---------|---------|
| v1 (2022) | IO-Aware 타일링 원형 | 2.4–7.6× vs 표준 |
| v2 (2023) | 병렬화 개선, GQA 지원 | v1 대비 ~2× |
| v3 (2024) | H100 TMA, FP8 지원 | v2 대비 1.5–2× |

v2는 쿼리 블록 병렬화를 추가해 GPU 워프 활용률을 높였다. v3는 H100의 Tensor Memory Accelerator(TMA)와 비동기 파이프라인을 활용해 A100 대비 획기적으로 개선됐다.

## 한계

FlashAttention은 시퀀스 병렬(Sequence Parallelism) 없이는 단일 GPU에서 처리 가능한 최대 컨텍스트 길이에 한계가 있다. 또한 CPU나 비CUDA GPU에서는 지원되지 않는다. Ring Attention, Ulysses 등의 기법은 FlashAttention을 다중 GPU로 확장해 수백만 토큰 컨텍스트를 가능하게 한다.

---

**지난 글:** [RoPE: 회전으로 위치를 인코딩하다](/posts/transformer-rotary/)

**다음 글:** [MQA와 GQA: KV Cache 경량화 전략](/posts/transformer-mqa-gqa/)

<br>
읽어주셔서 감사합니다. 😊
