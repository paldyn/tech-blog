---
title: "Masking: 트랜스포머의 정보 차단 전략"
description: "Padding Mask와 Causal Mask(Look-Ahead Mask)가 어텐션 점수에 어떻게 적용되는지, 인코더와 디코더 각 위치에서 어떤 마스크를 사용하는지 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "Masking", "Causal Mask", "Padding Mask", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/transformer-encoder-decoder/)에서 Encoder-Decoder 전체 구조와 Cross-Attention이 소스와 타깃을 연결하는 방식을 살펴봤다. 트랜스포머의 어텐션이 올바르게 동작하려면 **어느 위치의 정보를 볼 수 없게 막아야 하는지**를 명시적으로 지정해야 한다. 이것이 마스킹(Masking)이다.

## 마스킹이 필요한 두 가지 이유

1. **패딩 무시**: 배치 처리를 위해 짧은 시퀀스를 `<PAD>`로 채우지만, 패딩 토큰은 의미가 없으므로 어텐션 계산에서 제외해야 한다.  
2. **미래 차단**: 디코더가 다음 토큰을 예측할 때 아직 생성되지 않은 토큰의 정보를 미리 보면 안 된다.

## 마스킹 메커니즘

어텐션 점수(`Q·K^T / √d_k`)에 마스크 값을 **더한 뒤** Softmax를 적용한다. 차단할 위치에 −∞를 더하면 `softmax(-∞) ≈ 0`이 되어 해당 위치의 어텐션 가중치가 0에 수렴한다.

```python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = (Q @ K.transpose(-2, -1)) / (d_k ** 0.5)
    if mask is not None:
        scores = scores + mask          # -inf 덧셈
    attn = F.softmax(scores, dim=-1)
    return attn @ V, attn
```

## Padding Mask

배치 내 각 시퀀스의 `<PAD>` 위치를 표시하는 불리언 텐서다. `True`인 열(Key)에 해당하는 어텐션 점수가 −∞가 된다.

```python
def make_pad_mask(seq: torch.Tensor, pad_idx: int = 0) -> torch.Tensor:
    # seq: (batch, seq_len)
    # 반환: (batch, seq_len) — True이면 PAD
    return seq == pad_idx
```

PyTorch의 `nn.MultiheadAttention`에서는 `key_padding_mask` 파라미터로 전달한다. `True`인 위치를 −∞로 처리한다.

## Causal Mask (Look-Ahead Mask)

디코더의 Masked Self-Attention에서 위치 `i`가 `i+1` 이후를 볼 수 없게 막는 상삼각 행렬이다.

```python
def make_causal_mask(sz: int) -> torch.Tensor:
    # 상삼각(diagonal=1 이상)이 -inf, 하삼각이 0인 행렬
    return torch.triu(
        torch.full((sz, sz), float('-inf')),
        diagonal=1,
    )
    # 예: sz=4
    # [[  0, -inf, -inf, -inf],
    #  [  0,    0, -inf, -inf],
    #  [  0,    0,    0, -inf],
    #  [  0,    0,    0,    0]]
```

`nn.MultiheadAttention`에서 `attn_mask` 파라미터로 전달한다.

## 두 마스크의 시각적 비교

![마스킹 유형 비교: Padding vs Causal](/assets/posts/transformer-masking-types.svg)

![마스크 생성 코드와 적용 위치](/assets/posts/transformer-masking-code.svg)

## 어디서 어떤 마스크를 쓰는가

| 위치 | Padding Mask | Causal Mask |
|------|:---:|:---:|
| Encoder Self-Attention | ✓ | ✗ |
| Decoder Masked Self-Attention | ✓ | ✓ |
| Decoder Cross-Attention | ✓ (소스 PAD) | ✗ |
| Decoder-only (GPT류) 생성 | ✓ | ✓ |

두 마스크를 동시에 적용할 때는 합산(`mask = pad_mask + causal_mask`)하거나, `nn.Transformer`의 `tgt_mask`와 `tgt_key_padding_mask` 파라미터에 각각 전달한다.

## Teacher Forcing 학습에서의 마스킹

학습 시 정답 시퀀스 전체를 디코더에 한 번에 입력하더라도, Causal Mask 덕분에 위치 `i`의 예측에 `i+1` 이후 정답이 새어들지 않는다. 이것이 Teacher Forcing이 올바르게 동작하는 핵심 조건이다.

```python
# 학습 루프에서의 마스크 생성 예시
tgt_len = tgt.size(1)
causal = make_causal_mask(tgt_len).to(device)            # (tgt_len, tgt_len)
src_pad_mask = make_pad_mask(src).to(device)             # (batch, src_len)
tgt_pad_mask = make_pad_mask(tgt[:, :-1]).to(device)     # (batch, tgt_len)

logits = model(src, tgt[:, :-1],
               tgt_mask=causal,
               src_key_padding_mask=src_pad_mask,
               tgt_key_padding_mask=tgt_pad_mask)
loss = F.cross_entropy(
    logits.reshape(-1, vocab_size),
    tgt[:, 1:].reshape(-1),
    ignore_index=PAD_IDX,
)
```

## 정리

- **Padding Mask**: `<PAD>` 토큰을 어텐션에서 제외. 인코더·디코더 모두 사용.  
- **Causal Mask**: 미래 토큰 참조를 차단. 디코더 Self-Attention에서만 사용.  
- 두 마스크 모두 −∞ 덧셈 + Softmax 조합으로 구현.  
- 올바른 마스크 적용이 Teacher Forcing 학습과 자기 회귀 추론의 정확성을 보장.

---

**지난 글:** [Encoder-Decoder 구조: 번역에서 요약까지](/posts/transformer-encoder-decoder/)

**다음 글:** [BERT: 양방향 사전학습 언어 모델의 등장](/posts/transformer-bert/)

<br>
읽어주셔서 감사합니다. 😊
