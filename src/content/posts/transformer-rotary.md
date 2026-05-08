---
title: "RoPE: 회전으로 위치를 인코딩하다"
description: "Rotary Position Embedding(RoPE)이 쿼리·키 벡터를 위치별 각도로 회전시켜 상대 위치 의존성을 내적에 자연스럽게 녹여내는 원리를 수식과 코드로 완전히 해부한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["RoPE", "위치 인코딩", "트랜스포머", "LLM", "어텐션"]
featured: false
draft: false
---

[지난 글](/posts/transformer-efficient/)에서 긴 시퀀스의 O(N²) 병목을 해결하는 다양한 효율화 기법을 살펴봤다. 이번에는 그 기반이 되는 **위치 정보 인코딩** 문제를 완전히 새롭게 푼 방법, RoPE(Rotary Position Embedding)를 해부한다. RoPE는 Meta의 LLaMA, Mistral, Qwen 등 현대 주요 LLM 대부분이 채택한 사실상의 표준 위치 인코딩으로, 절대 위치 임베딩·상대 위치 바이어스와는 근본적으로 다른 철학을 갖는다.

## 왜 새로운 위치 인코딩이 필요했나

오리지널 트랜스포머는 사인·코사인 절대 위치 임베딩을 입력에 더한다. 이 방식은 직관적이지만 두 가지 약점이 있다. 첫째, 위치 정보가 토큰 임베딩에 섞여버려 어텐션 내적에서 위치 관계를 표현하기 어렵다. 둘째, 훈련 길이를 벗어난 시퀀스(외삽, extrapolation)에서 성능이 급격히 떨어진다.

BERT 이후 Shaw 등의 **상대 위치 바이어스** 방식이 등장했다. 어텐션 점수에 토큰 간 거리에 따른 편향을 직접 더하는 방식인데, 구현이 복잡하고 메모리 비용이 크다는 단점이 있다. Sukhbaatar의 ALiBi도 유사한 아이디어다.

RoPE는 2021년 Su et al.이 제안했다. 핵심 아이디어: **쿼리·키 벡터 자체를 위치에 해당하는 각도로 회전**시키면, 내적에 자연스럽게 상대 위치 정보가 인코딩된다.

## 회전 행렬의 직관

2D 벡터 `v = (x, y)`를 각도 `θ`만큼 반시계 방향으로 회전하면:

```
R(θ) · v = [cos θ · x − sin θ · y]
            [sin θ · x + cos θ · y]
```

위치 `m`의 쿼리 `q`와 위치 `n`의 키 `k`에 각각 `R(mθ)`와 `R(nθ)`를 적용한 후 내적을 계산하면:

```
R(mθ)q · R(nθ)k = q^T · R(mθ)^T · R(nθ) · k
                 = q^T · R((n−m)θ) · k
```

내적 결과가 `q`, `k`, 그리고 **상대 거리 `n−m`**에만 의존한다. 위치 `m`과 `n` 절댓값은 사라지고 차이만 남는 것이다.

![RoPE 회전 개념과 상대 위치 의존성](/assets/posts/transformer-rotary-concept.svg)

## 고차원 확장: 차원쌍별 독립 회전

실제 헤드 차원 `d`는 64~128이다. RoPE는 `d`개의 차원을 2개씩 짝지어 `d/2`개의 독립 2D 회전을 적용한다. 각 쌍 `i`마다 서로 다른 주파수를 사용한다:

```
θ_i = 1 / 10000^(2i/d),   i = 0, 1, ..., d/2 − 1
```

낮은 인덱스 `i`는 빠른 주파수(짧은 거리에 민감), 높은 인덱스 `i`는 느린 주파수(긴 거리에 민감)를 담당한다. 사인·코사인 절대 임베딩의 주파수 설계와 같은 정신이지만, **입력에 더하지 않고 회전으로 적용**한다는 점이 결정적으로 다르다.

전체 회전 행렬은 2×2 블록 대각 행렬이 되므로, 실제로는 행렬 곱 대신 요소별 cos/sin 곱으로 효율적으로 계산할 수 있다:

```python
def rotate_half(x):
    # 마지막 차원을 반으로 나눠 교차 배치
    x1, x2 = x[..., : x.shape[-1] // 2], x[..., x.shape[-1] // 2 :]
    return torch.cat([-x2, x1], dim=-1)

def apply_rotary(x, cos, sin):
    # 행렬 곱 없이 요소별 연산으로 회전 구현
    return x * cos + rotate_half(x) * sin
```

## PyTorch 전체 구현

![RoPE PyTorch 구현 코드](/assets/posts/transformer-rotary-code.svg)

`inv_freq`를 미리 계산해 버퍼로 등록하면 GPU 이동이 자동으로 처리된다. `torch.outer(t, inv_freq)`는 시퀀스 각 위치 `t`와 주파수 벡터의 외적으로, `(seq_len, d/2)` 크기의 주파수 매트릭스를 만든다. 이를 두 번 이어 붙여 `(seq_len, d)` 크기의 임베딩을 만들고, cos/sin을 쿼리·키에 적용한다.

실제 LLaMA 코드에서는 `cos_cached`, `sin_cached`를 최대 시퀀스 길이로 미리 계산해 캐시하는 방식을 쓴다. 추론 시 매 스텝 재계산 비용을 피할 수 있다.

## RoPE의 외삽 문제와 해결책

이론적으로 RoPE는 외삽에 강해야 하지만, 실제로는 훈련 길이의 2배를 넘으면 퍼플렉시티가 급상승한다. 이유는 훈련에서 보지 못한 큰 `m`값에서 회전 주파수가 불안정해지기 때문이다.

이를 해결하기 위해 여러 방법이 제안됐다:

- **Position Interpolation (PI)**: 위치 인덱스를 선형 스케일링해 원래 범위 안에 우겨 넣는 방법. `m → m · (L_train / L_new)`. 간단하지만 짧은 거리 해상도가 낮아진다.
- **YaRN (Yet another RoPE extensioN)**: 주파수 대역별로 다른 스케일 인수를 적용해 짧은 거리 해상도를 보전하면서 긴 범위를 확장한다. LLaMA-3 등에서 채택.
- **LongRoPE**: 비균일 위치 보간으로 2M 토큰까지 확장하는 방법.

```python
# Position Interpolation: 간단한 컨텍스트 확장
def scaled_rope(seq_len, train_len=4096, scale=1.0):
    # 훈련 길이를 넘으면 축소 비율 적용
    if seq_len > train_len:
        scale = train_len / seq_len
    t = torch.arange(seq_len).float() * scale
    return t
```

## RoPE를 채택한 주요 모델

| 모델 | 기반 컨텍스트 | 확장 방식 |
|------|-------------|----------|
| LLaMA 2 | 4K | PI |
| LLaMA 3 | 8K | YaRN |
| Mistral 7B | 8K | Sliding Window |
| Qwen2 | 32K | YaRN |
| Gemma 2 | 8K | RoPE 기본 |
| Claude (추정) | 미공개 | 미공개 |

RoPE는 구현이 간결하고 KV 캐시와 잘 결합되며 외삽 확장이 용이하다는 이유로 현대 LLM의 사실상 표준이 되었다. 다음 글에서 살펴볼 FlashAttention은 이 어텐션 연산 자체를 IO 관점에서 극적으로 가속한다.

---

**지난 글:** [효율적인 트랜스포머: 긴 시퀀스를 다루는 방법들](/posts/transformer-efficient/)

**다음 글:** [FlashAttention: IO-Aware 어텐션 연산](/posts/transformer-flash-attention/)

<br>
읽어주셔서 감사합니다. 😊
