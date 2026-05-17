---
title: "모델 프루닝: 신경망의 불필요한 가중치 제거하기"
description: "구조적·비구조적 프루닝의 원리, Magnitude Pruning, SparseGPT, Wanda, LLM-Pruner 실전 적용, 그리고 2:4 구조적 희소성으로 NVIDIA GPU에서 실제 속도 향상."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["프루닝", "Pruning", "SparseGPT", "Wanda", "희소성", "LLM최적화"]
featured: false
draft: false
---

[지난 글](/posts/distillation/)에서 큰 모델의 지식을 작은 모델로 이전하는 증류를 다뤘다. 이번에는 완전히 다른 접근이다. 이미 훈련된 모델에서 "덜 중요한" 가중치를 0으로 만들거나 아예 제거하는 **프루닝(Pruning)**이다. 인간의 뇌가 발달 과정에서 시냅스를 가지치기(pruning)하는 것에서 이름을 따왔다. 제대로 적용하면 모델 크기와 연산량을 50% 이상 줄이면서도 성능 손실을 최소화할 수 있다.

## 프루닝의 두 가지 축

프루닝을 이해하려면 두 가지 질문에 답해야 한다. **무엇을 제거하는가?** 그리고 **제거 후 어떻게 처리하는가?**

### 비구조적 프루닝 vs 구조적 프루닝

**비구조적 프루닝(Unstructured Pruning)**은 개별 가중치를 선택적으로 0으로 만든다. 가중치 행렬에 구멍이 뚫리는 형태라 **희소 행렬(Sparse Matrix)**이 생긴다. 이론적으로 50~90%까지 제거해도 성능 손실이 적지만, 실제로 추론을 빠르게 하려면 희소 행렬 연산을 지원하는 전용 하드웨어(NVIDIA A100의 Sparse Tensor Core)나 특수 라이브러리가 필요하다. 일반 GPU에서는 제거된 0도 연산에 포함되므로 실제 속도 향상이 없다.

**구조적 프루닝(Structured Pruning)**은 뉴런(행), 필터(채널), 어텐션 헤드처럼 의미 있는 단위를 통째로 제거한다. 행 전체가 사라지므로 행렬 크기 자체가 줄어든다. 일반 하드웨어에서도 즉각 속도 향상이 있고 모델 파일 크기도 줄어든다. 단, 같은 희소성 비율에서 비구조적 방식보다 성능 손실이 크다.

![구조적 vs 비구조적 프루닝](/assets/posts/pruning-concept.svg)

### 재훈련 시점에 따른 분류

- **원샷 프루닝(One-shot)**: 훈련 후 한 번에 제거. 빠르지만 성능 손실이 클 수 있다.
- **반복 프루닝(Iterative)**: 조금씩 제거하면서 중간에 파인튜닝을 반복. 품질이 좋지만 시간이 많이 든다.
- **프루닝 중 훈련(Pruning During Training)**: 마스크를 학습 파라미터로 포함. 가장 정교하지만 계산 비용 큼.

## Magnitude Pruning: 가장 단순한 기준

가장 직관적인 방법은 가중치의 **절댓값(magnitude)**이 작은 것이 덜 중요하다는 가정이다. 임계값 이하의 가중치를 모두 0으로 만든다.

```python
import torch
import torch.nn.utils.prune as prune

model = ...  # 이미 훈련된 모델

# 레이어별 비구조적 L1 프루닝 (50% 제거)
for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):
        prune.l1_unstructured(module, name="weight", amount=0.5)

# 마스크를 가중치에 영구 적용 (mask 제거, 파라미터 정리)
for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):
        prune.remove(module, "weight")

# 희소성 확인
total, zero = 0, 0
for p in model.parameters():
    total += p.numel()
    zero += (p == 0).sum().item()
print(f"희소성: {zero/total*100:.1f}%")
```

구조적 프루닝(채널 단위)도 PyTorch가 지원한다.

```python
# ln_structured: 채널 단위 구조적 프루닝
prune.ln_structured(
    module=linear_layer,
    name="weight",
    amount=0.3,    # 30% 채널 제거
    n=2,           # L2 norm 기준
    dim=0,         # 행(출력 채널) 방향
)
```

## NVIDIA 2:4 구조적 희소성

NVIDIA A100 이후 GPU는 **2:4 희소성**을 하드웨어 레벨에서 지원한다. 4개 연속 가중치 중 2개만 남기고 2개를 0으로 만드는 패턴이다. 정확히 50% 희소성이며, Sparse Tensor Core가 이 패턴을 인식하면 FP16 대비 2배의 처리량을 낸다.

```python
# PyTorch 2:4 희소성 적용
from torch.sparse import to_sparse_semi_structured, SparseSemiStructuredTensor

# 2:4 희소화
sparse_weight = to_sparse_semi_structured(dense_weight)
# → CUTLASS Sparse GEMM 커널이 자동 적용됨

# 또는 accelerate 라이브러리 활용
from accelerate.utils import load_and_quantize_model
# ASP (Automatic Sparsity Pruner): 2:4 패턴 자동 적용
```

## SparseGPT: LLM을 위한 OBC 기반 프루닝

단순 Magnitude Pruning은 LLM에 효과적이지 않다. 가중치 절댓값이 작더라도 활성화 크기가 크면 중요할 수 있다. **SparseGPT(Frantar & Alistarh, 2023)**는 GPTQ와 같은 OBC(Optimal Brain Compression) 프레임워크를 프루닝에 적용한다. 가중치를 0으로 만들 때 같은 레이어 나머지 가중치를 조정해 출력 변화를 보상한다.

```bash
# SparseGPT 실행 (공식 구현)
git clone https://github.com/IST-DASLab/sparsegpt
cd sparsegpt

# LLaMA-2-7B 50% 비구조적 프루닝
python llama.py \
  meta-llama/Llama-2-7b-hf \
  c4 \
  --sparsity 0.5 \
  --sparsity-type unstructured
```

```bash
# 2:4 구조적 희소성 (NVIDIA GPU 가속)
python llama.py \
  meta-llama/Llama-2-7b-hf \
  c4 \
  --sparsity 0.5 \
  --sparsity-type 2:4
```

![SparseGPT와 Wanda 비교](/assets/posts/pruning-sparsegpt.svg)

## Wanda: 빠른 LLM 프루닝

**Wanda(Sun et al., 2023)**는 "Weight AND Activation"의 줄임말이다. 가중치 중요도를 `|W_ij| × ‖Xⱼ‖₂`로 정의한다. 가중치 절댓값과 해당 입력 채널의 활성화 L2 norm의 곱이다. Hessian을 계산하지 않아 SparseGPT보다 훨씬 빠르다.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

def wanda_prune_layer(W, X_calib, sparsity=0.5):
    """
    W: [out, in] 가중치 행렬
    X_calib: [n_samples, in] 보정 데이터 활성화
    """
    # 활성화 L2 norm: [in]
    act_norm = X_calib.norm(p=2, dim=0)
    # 중요도 점수: [out, in]
    scores = W.abs() * act_norm.unsqueeze(0)
    # 행별 정규화 후 임계값 계산
    thresh = scores.quantile(sparsity, dim=1, keepdim=True)
    mask = (scores >= thresh).float()
    return W * mask

# 실제 사용: 각 레이어에 보정 데이터 통과시켜 활성화 수집 후 적용
```

## 구조적 LLM 프루닝: LLM-Pruner

비구조적 희소성은 전용 하드웨어가 없으면 실제 속도 향상이 없다. **LLM-Pruner**는 구조적 프루닝으로 실제 모델 크기와 추론 속도를 줄인다. 어텐션 헤드, FFN 차원, 레이어 전체를 중요도 기반으로 제거한다.

```bash
pip install llm-pruner
```

```python
# LLM-Pruner 사용 예시 (개략적 구조)
from pruner import hf_prune

hf_prune(
    base_model="meta-llama/Llama-2-7b-hf",
    pruning_ratio=0.25,         # 25% 파라미터 제거
    block_wise=True,             # 블록 단위 프루닝
    block_mlp_layer_start=4,
    block_mlp_layer_end=30,
    save_model="./llama2-pruned",
)
```

**ShortGPT**는 레이어 중요도를 측정해 전체 레이어를 통째로 제거하는 방식이다. LLaMA-2-13B에서 25%의 레이어를 제거해도 성능 손실이 미미하다는 결과를 보였다.

## 프루닝 후 파인튜닝: 성능 회복

어떤 프루닝 방법을 쓰든 소량의 파인튜닝(Fine-tuning)이 성능 회복에 크게 도움이 된다. 프루닝 후 LoRA 파인튜닝을 결합하는 것이 실용적이다.

```python
from transformers import AutoModelForCausalLM
from peft import get_peft_model, LoraConfig, TaskType

# 프루닝된 모델 로드
pruned_model = AutoModelForCausalLM.from_pretrained("./pruned-model")

# LoRA로 파인튜닝 (적은 파라미터로 성능 회복)
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,
    lora_alpha=16,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
)
model = get_peft_model(pruned_model, lora_config)
model.print_trainable_parameters()
# trainable params: 4M / 6B → 0.07%
```

## 정리

| 방법 | 유형 | 특징 | 실제 속도 향상 |
|---|---|---|---|
| Magnitude | 비구조적 | 단순, 성능 손실 큼 | 전용 HW 필요 |
| SparseGPT | 비구조적/2:4 | OBC 보정, 고품질 | 2:4면 2× 가능 |
| Wanda | 비구조적 | 매우 빠른 보정 | 전용 HW 필요 |
| LLM-Pruner | 구조적 | 실제 크기 감소 | 즉각 속도 향상 |
| ShortGPT | 레이어 제거 | 구현 단순 | 즉각 속도 향상 |

프루닝은 양자화·증류와 상호 보완적이다. SparseGPT + GPTQ를 결합하면 50% 희소화 + INT4 양자화를 동시에 달성할 수 있다. 다음 글에서는 추론 속도를 높이는 완전히 다른 접근인 **투기적 디코딩(Speculative Decoding)**을 다룬다.

---

**지난 글:** [지식 증류: 대형 모델의 지식을 소형 모델로 이전하기](/posts/distillation/)

**다음 글:** [투기적 디코딩: LLM 추론 속도를 2~3배 높이는 기술](/posts/speculative-decoding/)

<br>
읽어주셔서 감사합니다. 😊
