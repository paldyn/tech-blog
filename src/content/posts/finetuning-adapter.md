---
title: "Adapter: 트랜스포머 레이어에 소형 모듈을 삽입하는 파인튜닝"
description: "Adapter 튜닝의 원리, bottleneck 구조, AdapterFusion, LoRA와의 비교를 이해하고 HuggingFace PEFT로 구현하는 방법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["Adapter", "AdapterTuning", "PEFT", "BottleNeck", "파인튜닝", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-prefix-tuning/)에서 Prefix Tuning과 P-Tuning이 학습 가능한 접두사 벡터를 Transformer 레이어의 Key·Value에 삽입해 모델을 조율하는 방식을 살펴봤다. 이번에는 또 다른 관점의 PEFT — **Adapter 튜닝**을 다룬다. Adapter는 Transformer 레이어 내부에 작은 병목(bottleneck) 모듈을 삽입하고, 기본 모델 가중치는 완전히 동결한 채 이 모듈만 학습시킨다. 2019년에 제안된 오래된 방법이지만, 멀티태스크 학습과 모델 공유 측면에서 여전히 독자적인 위치를 차지하고 있다.

## Adapter의 탄생 배경

2019년 Neil Houlsby, Andrei Giurgiu 등이 Google Research에서 발표한 논문 「Parameter-Efficient Transfer Learning for NLP」는 당시 NLP 파인튜닝의 표준이었던 BERT에 주목했다. BERT를 각 태스크에 맞게 Full Fine-tuning하면 태스크마다 BERT 전체(약 110M 파라미터)를 별도로 저장해야 한다. 만약 100개의 태스크가 있다면 110M × 100 = 11B 파라미터를 저장해야 하는 셈이다.

Adapter는 이 문제를 정면으로 해결한다. 기본 모델(BERT) 하나를 공유하고, 각 태스크에 대해 **소형 모듈(Adapter)만 학습시켜 별도 저장**하면 된다. 태스크별 저장 비용이 Adapter 파라미터 크기(전체의 0.5~4%)로 줄어든다.

## Bottleneck Adapter 구조

Adapter의 핵심은 **병목(bottleneck) 구조**다. 입력 히든 차원 d에서 매우 작은 차원 r로 줄였다가 다시 d로 확장한다. 이때 잔차 연결(residual connection)을 추가해 학습 안정성을 확보한다.

```
# Adapter 모듈의 수식
x_down = W_down · x + b_down   # d → r (Down-projection)
x_act  = GELU(x_down)          # 비선형 활성화
x_up   = W_up · x_act + b_up  # r → d (Up-projection)
output = x_up + x              # Residual connection
```

파라미터 수를 계산하면 다음과 같다. `W_down`은 d×r, `W_up`은 r×d이므로:

- **Adapter 1개당 파라미터** = 2 × d × r (bias 제외 시)
- **전체 Adapter 파라미터** = 2 × d × r × L × N (L: 레이어 수, N: Adapter 삽입 횟수)

BERT-base(d=768, L=12)에서 r=64로 설정하면: 2 × 768 × 64 × 12 × 2 ≈ 2.36M (전체 110M의 2.1%)

![Adapter 모듈 구조](/assets/posts/finetuning-adapter-architecture.svg)

### 삽입 위치

원 논문(Houlsby et al.)에서는 Adapter를 각 Transformer 레이어에 두 번 삽입한다.

1. **Self-Attention 서브레이어 뒤**: 어텐션 출력에 Adapter 적용 후 잔차 덧셈
2. **Feed-Forward 서브레이어 뒤**: FFN 출력에 Adapter 적용 후 잔차 덧셈

이를 **Serial(직렬) Adapter**라 부른다. 이후 연구들은 삽입 위치를 다양하게 변형했다. 예를 들어 FFN 뒤에만 삽입하는 **단일 Adapter** 설정도 성능 저하 없이 파라미터를 절반으로 줄일 수 있음을 보였다.

## Parallel Adapter: 병렬 삽입

Serial Adapter는 Adapter 모듈이 FFN 또는 Attention의 출력을 순차적으로 처리하므로 추론 지연(latency)이 증가한다. 이 문제를 해결하기 위해 **Parallel Adapter**가 제안됐다.

Parallel Adapter는 Adapter를 기존 서브레이어와 **병렬**로 배치한다. 동일한 입력 x를 Adapter와 원래 FFN/Attention에 동시에 통과시키고, 출력을 합산한다.

```python
import torch
import torch.nn as nn

class ParallelAdapter(nn.Module):
    """
    Parallel Adapter: Frozen FFN과 병렬로 실행되는 Adapter 모듈
    참고: He et al. (2022) Towards a Unified View of Parameter-Efficient Transfer Learning
    """
    def __init__(self, d_model: int, bottleneck_dim: int, dropout: float = 0.0):
        super().__init__()
        self.down = nn.Linear(d_model, bottleneck_dim)
        self.up   = nn.Linear(bottleneck_dim, d_model)
        self.act  = nn.GELU()
        self.drop = nn.Dropout(dropout)
        # Up-projection 초기화: 0으로 초기화해 학습 초기에 항등 함수로 동작
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.up(self.drop(self.act(self.down(x))))


class TransformerLayerWithParallelAdapter(nn.Module):
    def __init__(self, frozen_ffn, d_model, bottleneck_dim):
        super().__init__()
        self.ffn = frozen_ffn                # 동결된 원본 FFN
        self.adapter = ParallelAdapter(d_model, bottleneck_dim)

    def forward(self, x):
        # FFN과 Adapter를 동시에 실행하고 합산 (병렬)
        ffn_out = self.ffn(x)
        adapter_out = self.adapter(x)
        return x + ffn_out + adapter_out     # Residual 포함
```

Parallel Adapter는 GPU가 FFN과 Adapter를 동시에 계산할 수 있어 Sequential보다 빠를 수 있다. 단, 실제로는 Adapter가 워낙 작아 병렬 실행의 이점이 크지 않은 경우도 많다.

## AdapterFusion: 여러 태스크 Adapter를 융합하기

2020년 Pfeiffer et al.은 **AdapterFusion**을 제안했다. 아이디어는 다음과 같다: 서로 다른 태스크를 위해 학습된 여러 Adapter들의 지식을 새 태스크에 **동적으로 조합**하는 것이다.

AdapterFusion은 두 단계로 학습한다.

1. **Knowledge Extraction**: 각 소스 태스크에 대해 개별적으로 Adapter를 학습한다. 예를 들어 감성 분석, NLI, QA 태스크 각각의 Adapter를 따로 학습.
2. **Knowledge Composition**: 새 타깃 태스크를 위해, 위에서 학습된 Adapter들을 입력으로 받는 **Attention 기반 Fusion 레이어**를 추가로 학습한다. 이 Fusion 레이어는 각 Adapter의 출력에 가중치를 부여해 타깃 태스크에 맞게 조합한다.

이 방식의 장점은 **소스 태스크 간 catastrophic forgetting이 없다**는 것이다. 각 Adapter는 독립적으로 학습되므로 서로 간섭하지 않고, Fusion 레이어만 재학습하면 된다.

## HuggingFace PEFT로 Adapter 구현하기

HuggingFace PEFT 라이브러리는 Adapter 계열 중 **IA³(Infused Adapter by Inhibiting and Amplifying Inner Activations)**를 직접 지원한다. IA³는 Adapter보다 더 경량화된 변형으로, 가중치 벡터를 통해 Attention과 FFN 내부 활성화를 조절한다.

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from peft import IA3Config, TaskType, get_peft_model
import torch

# 기반 모델 로드
model_name = "bert-base-uncased"
base_model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=2
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# IA³ 설정 (Adapter 계열)
config = IA3Config(
    task_type=TaskType.SEQ_CLS,
    target_modules=["query", "value", "dense"],   # 적용할 레이어
    feedforward_modules=["dense"],                # FFN 대상 모듈
)

# PEFT 모델 생성
peft_model = get_peft_model(base_model, config)
peft_model.print_trainable_parameters()
# trainable params: 30,720 || all params: 109,514,754 || trainable%: 0.0281

# 학습 (일반 Trainer와 동일)
from transformers import TrainingArguments, Trainer

training_args = TrainingArguments(
    output_dir="./results",
    per_device_train_batch_size=16,
    num_train_epochs=3,
    learning_rate=3e-4,           # PEFT는 보통 Full FT보다 높은 LR 사용
    fp16=True,
    save_strategy="epoch",
)

# trainer = Trainer(model=peft_model, args=training_args, ...)
# trainer.train()

# 저장: Adapter 가중치만 별도 저장
peft_model.save_pretrained("./ia3-adapter-sentiment")

# 불러오기
from peft import PeftModel
loaded = PeftModel.from_pretrained(base_model, "./ia3-adapter-sentiment")
loaded.eval()
```

전통적인 Bottleneck Adapter를 직접 구현하고 싶다면 `adapters` 라이브러리(구 AdapterHub)를 활용할 수도 있다.

```python
# AdapterHub 라이브러리 사용 예시 (pip install adapters)
from adapters import AutoAdapterModel

model = AutoAdapterModel.from_pretrained("bert-base-uncased")

# Bottleneck Adapter 추가
model.add_adapter("sentiment", config="pfeiffer")  # Pfeiffer 설정 (FFN 뒤 1개)
# 또는
model.add_adapter("sentiment", config="houlsby")   # Houlsby 설정 (Attn+FFN 뒤 각 1개)

# Adapter만 학습 가능하게 설정
model.train_adapter("sentiment")

# 학습 후 저장 (Adapter 가중치만)
model.save_adapter("./sentiment-adapter", "sentiment")

# 다른 모델 인스턴스에 로드 (기본 모델은 공유)
model.load_adapter("./sentiment-adapter", load_as="sentiment")
model.set_active_adapters("sentiment")
```

![Adapter vs LoRA vs Prefix Tuning 비교](/assets/posts/finetuning-adapter-comparison.svg)

## LoRA 대비 Adapter의 장단점

### Adapter의 장점

**멀티태스크 서빙이 명시적이다.** 기본 모델을 메모리에 한 번만 올려두고, 요청마다 해당 태스크의 Adapter를 교체해 서빙할 수 있다. 각 Adapter의 용량은 수십 MB 수준이므로, 수십 개의 Adapter를 보관하더라도 저장 공간이 크게 증가하지 않는다.

**모듈성이 뛰어나다.** AdapterFusion처럼 여러 Adapter를 조합하는 방법이 자연스럽게 연결된다. 소스 태스크 지식을 체계적으로 전이하고 조합할 수 있는 프레임워크가 잘 갖춰져 있다.

**구현 개념이 직관적이다.** "기존 레이어 사이에 작은 레이어를 삽입한다"는 개념이 명확하여, 커스텀 아키텍처에 통합하기 쉽다.

### Adapter의 단점

**추론 시 지연(latency)이 증가한다.** Adapter 모듈이 Transformer 레이어 연산 경로에 직렬로 삽입되므로, 추론 시 추가 행렬 연산이 필수적으로 발생한다. LoRA는 학습 완료 후 가중치를 기본 모델에 병합(merge)할 수 있어 추론 오버헤드가 사라지지만, Adapter는 병합이 불가능하다(잔차 구조 때문에).

**LoRA 대비 성능이 낮은 경우가 많다.** 2022년 이후 다수의 벤치마크에서 LoRA가 Adapter보다 같거나 더 나은 성능을 달성했다. 특히 대규모 언어 생성 태스크에서 이 차이가 두드러진다.

**깊은 레이어에서 경사 소실이 생길 수 있다.** Adapter의 잔차 연결이 어느 정도 완충하지만, 매우 깊은 모델에서 학습 신호가 Adapter 레이어를 거치며 희석되는 문제가 있다.

## 추론 지연 문제에 대한 실용적 해결책

Adapter의 가장 큰 약점인 추론 지연을 줄이는 실용적인 접근들이 연구됐다.

**AdapterDrop** (Rücklé et al., 2021): 추론 시 일부 레이어의 Adapter를 "드롭"하는 방법이다. 하위 레이어의 Adapter를 생략해도 성능이 크게 떨어지지 않는 경우가 많다. 태스크에 따라 전체 Adapter의 50%를 드롭하면서도 Full Adapter의 99% 이상의 성능을 유지할 수 있었다.

**Tiny-Attention Adapter**: Adapter 내부에 소형 Attention 레이어를 넣어 표현력을 높이는 방향. 파라미터 수 대비 성능 향상 폭이 크다.

**Compacter**: Krönecker Product를 이용해 Adapter 가중치를 더욱 압축하는 방법. Adapter 파라미터의 1/10만으로도 유사한 성능을 달성한다.

## Adapter를 선택해야 할 상황

다음 조건을 모두 만족한다면 Adapter가 좋은 선택이다.

**수십~수백 개의 태스크를 단일 모델 인스턴스에서 서빙해야 한다.** 기본 모델은 공유하고 Adapter만 교체하면 되므로, 메모리 효율이 극대화된다. LoRA 병합 방식은 태스크마다 별도 모델이 필요하다.

**소스 태스크에서 타깃 태스크로 지식을 체계적으로 전이해야 한다.** AdapterFusion은 이 시나리오에서 강력한 성능을 보인다. 사전 학습된 Adapter 허브(AdapterHub.ml)에서 수백 개의 공개 Adapter를 다운로드해 활용할 수도 있다.

**추론 지연보다 메모리 절약과 모듈성이 더 중요하다.** 예를 들어 배치 추론이 지배적이고, 개별 요청 지연이 덜 중요한 환경.

반대로, **단일 태스크에 집중 파인튜닝하고 추론 속도가 중요하다면 LoRA가 더 적합하다.** 2023년 이후 실용적인 파인튜닝의 주류는 LoRA와 그 변형들이며, Adapter는 멀티태스크 NLP 연구와 모듈형 아키텍처 실험에서 독자적인 위치를 유지하고 있다.

## 최신 트렌드: LoRA가 주류, Adapter는 틈새 강자

2024~2025년 현재, 오픈소스 파인튜닝 생태계는 명확하게 LoRA 중심으로 수렴됐다. LLaMA Factory, Axolotl, Unsloth 같은 주요 파인튜닝 프레임워크는 모두 LoRA/QLoRA를 기본으로 제공하고, Adapter는 선택 옵션으로만 지원한다.

그럼에도 Adapter 연구는 계속 활발하다. 특히 **언어 모델의 모듈성(modularity)** — 여러 능력을 별도로 학습해 동적으로 조합한다는 개념 — 의 맥락에서 Adapter 계열 방법들이 핵심적인 역할을 한다. Mixture of Experts(MoE) 구조와 Adapter의 결합, 태스크별 Adapter를 자동으로 선택하는 라우팅 메커니즘 등이 연구 최전선에 있다.

## 정리

Adapter 튜닝(Houlsby et al., 2019)은 PEFT의 선구자 중 하나다. Transformer 레이어에 소형 bottleneck 모듈(d → r → d)을 삽입하고, 기본 모델을 완전히 동결한 채 이 모듈만 학습함으로써, 태스크당 0.5~4%의 파라미터 추가로 Full Fine-tuning에 근접한 성능을 달성한다.

Serial vs Parallel 삽입 방식, AdapterFusion을 통한 멀티태스크 지식 합성, AdapterDrop을 통한 추론 가속 등 다양한 변형이 존재한다. 단일 태스크 파인튜닝 효율 면에서는 LoRA가 앞서지만, 대규모 멀티태스크 서빙과 모듈형 지식 전이 시나리오에서는 Adapter 계열이 여전히 유력한 선택지다.

---

**지난 글:** [Prefix Tuning & P-Tuning: 접두사 토큰으로 LLM 조율하기](/posts/finetuning-prefix-tuning/)

**다음 글:** [파인튜닝 데이터 준비: 형식·품질·양 완전 가이드](/posts/finetuning-data-prep/)

<br>
읽어주셔서 감사합니다. 😊
