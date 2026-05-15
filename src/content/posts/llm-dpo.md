---
title: "DPO: 보상 모델 없는 직접 선호도 최적화"
description: "DPO(Direct Preference Optimization)의 수학적 원리와 RLHF와의 차이를 상세히 설명하고, TRL 라이브러리를 활용한 실제 구현부터 SimPO·IPO 등 변형 알고리즘까지 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["DPO", "RLHF", "선호도최적화", "LLM정렬", "TRL", "SimPO", "IPO", "파인튜닝"]
featured: false
draft: false
---

[지난 글](/posts/llm-rlhf/)에서 RLHF의 3단계 파이프라인—SFT, 보상 모델, PPO—을 살펴봤다. RLHF는 강력하지만 복잡하다. 보상 모델을 별도로 학습해야 하고, PPO 학습 시 정책 모델·기준 모델·보상 모델·가치 모델 총 4개를 동시에 GPU에 올려야 한다. 하이퍼파라미터도 민감해서 실제 구현이 까다롭다. 2023년 스탠퍼드 연구팀이 발표한 **DPO(Direct Preference Optimization)**는 이 복잡성을 획기적으로 줄였다. 보상 모델을 아예 없애고 선호 데이터에서 직접 최적화하는 방식으로, 수학적으로 RLHF와 동일한 목표를 달성하면서 구현은 지도학습만큼 단순하다.

## DPO의 핵심 아이디어

RLHF의 목적함수를 떠올려보자:

```
max E[r(x,y)] - β · KL[π_θ(y|x) ‖ π_ref(y|x)]
```

이 최적화 문제의 해는 수식으로 표현할 수 있다:

```
π*(y|x) ∝ π_ref(y|x) · exp(r(x,y) / β)
```

이를 r(x,y)에 대해 역으로 풀면:

```
r(x,y) = β · log(π*(y|x) / π_ref(y|x)) + β · log Z(x)
```

`Z(x)`는 분할 함수(partition function)로 모든 y에 대한 합산이지만, 비교(chosen vs rejected)에서는 같은 x에 대해 계산하므로 상쇄된다. DPO는 이 사실을 이용해 보상 함수를 정책 모델로 대체하고, 직접 최적화한다:

```
L_DPO = -E[ log σ( β·log(π_θ(y_w|x)/π_ref(y_w|x)) - β·log(π_θ(y_l|x)/π_ref(y_l|x)) ) ]
```

이것이 DPO 손실 함수 전부다. 보상 모델이 없다. π_θ(선호 응답)의 로그 확률을 높이고, π_θ(거부 응답)의 로그 확률을 낮추는 방향으로 직접 학습한다.

![DPO vs RLHF 비교](/assets/posts/llm-dpo-vs-rlhf.svg)

## 선호 데이터 형식

DPO 학습에는 세 가지 요소가 필요하다:

- **prompt(x):** 입력 프롬프트
- **chosen(y_w):** 선호된 응답
- **rejected(y_l):** 거부된 응답

```python
from trl import DPOTrainer, DPOConfig

config = DPOConfig(
    model_name_or_path="sft-model",
    beta=0.1,          # KL 페널티 강도
    loss_type="sigmoid",
    learning_rate=5e-7,
    per_device_train_batch_size=4,
    num_train_epochs=3,
)
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=config,
    train_dataset=dataset,
    tokenizer=tokenizer,
)
trainer.train()
```

![DPO 손실 함수 구현](/assets/posts/llm-dpo-loss.svg)

데이터셋은 보통 HuggingFace의 `datasets` 라이브러리 형식을 사용한다:

```python
from datasets import Dataset

preference_data = [
    {
        "prompt": "기후 변화의 주요 원인을 설명해줘.",
        "chosen": (
            "기후 변화의 주요 원인은 온실가스 배출입니다. "
            "이산화탄소(CO2), 메탄(CH4), 아산화질소(N2O) 등이 "
            "대기 중에 축적되어 지구 온도를 높입니다. "
            "주요 배출원은 화석연료 연소, 산업 활동, 삼림 벌채입니다."
        ),
        "rejected": "기후가 변해요. 왜냐면 지구가 따뜻해져서요.",
    },
    {
        "prompt": "Python에서 리스트 중복 제거 방법은?",
        "chosen": (
            "여러 방법이 있습니다:\n\n"
            "1. set() 변환: `list(set(lst))` - 순서 보장 안됨\n"
            "2. dict.fromkeys(): `list(dict.fromkeys(lst))` - 순서 유지 (Python 3.7+)\n"
            "3. 리스트 컴프리헨션으로 순서 유지하며 중복 제거"
        ),
        "rejected": "set을 쓰면 됩니다.",
    },
]

dataset = Dataset.from_list(preference_data)
```

## beta 값의 의미와 조정

DPO에서 `beta`(β)는 정책이 기준 모델(ref_model)에서 얼마나 벗어날 수 있는지를 제어한다. RLHF의 KL 페널티 계수와 동일한 역할을 한다.

- **β가 작을수록(예: 0.01):** 정책이 자유롭게 변화할 수 있어 선호도를 강하게 반영하지만, 기준 모델에서 크게 벗어나 다양성이 감소하거나 응답이 이상해질 수 있다.
- **β가 클수록(예: 0.5):** 기준 모델(SFT)에 가깝게 유지되어 안정적이지만, 선호도 신호를 약하게 반영한다.
- **실용적 권장값:** 0.05~0.2. Llama 모델에는 0.1이 많이 사용된다.

```python
# beta 값에 따른 차이 실험
def compare_beta_values(model, ref_model, dataset):
    results = {}
    for beta in [0.01, 0.05, 0.1, 0.3, 0.5]:
        config = DPOConfig(
            beta=beta,
            learning_rate=5e-7,
            num_train_epochs=1,
            output_dir=f"./dpo-beta-{beta}",
        )
        trainer = DPOTrainer(
            model=model,
            ref_model=ref_model,
            args=config,
            train_dataset=dataset,
            tokenizer=tokenizer,
        )
        trainer.train()
        # 각 beta로 학습된 모델 평가
        results[beta] = evaluate_on_benchmark(trainer.model)
        print(f"beta={beta}: win_rate={results[beta]:.3f}")
    return results
```

## SimPO와 IPO: DPO의 변형들

DPO가 발표된 후 다양한 변형 알고리즘이 등장했다:

### IPO (Identity Preference Optimization)

DPO가 이론적으로 overfitting할 수 있다는 문제를 지적하며, 손실 함수에 정규화를 추가한다:

```
L_IPO = E[(log(π_θ(y_w|x)/π_ref(y_w|x)) - log(π_θ(y_l|x)/π_ref(y_l|x)) - 1/(2β))²]
```

MSE 형태의 손실로 더 안정적인 학습이 가능하다. TRL에서는 `loss_type="ipo"`로 사용할 수 있다.

### SimPO (Simple Preference Optimization)

기준 모델(ref_model)을 아예 제거하고, 응답 길이로 정규화된 평균 로그 확률을 직접 비교한다. 메모리 사용량이 DPO의 절반으로 줄어든다:

```python
# SimPO는 ref_model 없이 작동
# loss_type="simpo"로 설정 (일부 라이브러리에서 지원)
config = DPOConfig(
    beta=2.0,            # SimPO는 beta가 더 큼
    loss_type="simpo",   # 또는 커스텀 구현
    gamma=0.5,           # 마진 파라미터
    learning_rate=1e-6,
    output_dir="./simpo-output",
)
```

### ORPO (Odds Ratio Preference Optimization)

SFT와 선호도 정렬을 하나의 손실 함수로 통합해 SFT 단계 자체를 없앤다. 단일 학습 루프로 베이스 모델을 바로 정렬된 모델로 만들 수 있다:

```
L_ORPO = L_NLL + λ · L_OR
```

`L_NLL`은 일반적인 언어 모델 손실, `L_OR`은 odds ratio 기반 선호도 손실이다. TRL에서 `ORPOTrainer`로 지원된다.

## DPO의 실용적 고려사항

**데이터 품질이 핵심:** DPO는 보상 모델이라는 완충재 없이 선호 데이터를 직접 학습한다. 데이터 품질이 나쁘면 RLHF보다 더 빠르게 나쁜 방향으로 학습된다. chosen과 rejected 응답의 품질 차이가 명확해야 한다.

**오프라인 학습의 한계:** RLHF(PPO)는 학습 중 새로운 응답을 생성하며 탐색하는 온라인 학습이지만, DPO는 고정된 데이터셋을 사용하는 오프라인 학습이다. 분포 외(out-of-distribution) 응답에 대한 일반화가 상대적으로 약할 수 있다.

**ref_model 선택:** ref_model은 학습 중 고정된다. SFT 체크포인트를 사용하는 것이 표준이다. ref_model이 없으면 `beta`의 KL 제어 효과가 사라진다.

**학습률 설정:** DPO는 일반 파인튜닝(1e-4 ~ 2e-4)보다 훨씬 낮은 학습률(5e-7 ~ 1e-6)이 필요하다. 너무 높으면 chosen 응답의 확률이 아니라 모든 응답 확률이 함께 하락하는 "확률 붕괴" 현상이 발생한다.

## DPO가 실무에서 선택받는 이유

2024년 이후 공개된 대부분의 오픈소스 LLM(Llama 3, Mistral, Qwen 등)은 DPO 또는 DPO 변형을 사용해 정렬한다. 그 이유는 단순하다:

1. **단순성:** RLHF 대비 코드 수십 배 감소. 디버깅이 용이하다.
2. **안정성:** 지도학습과 유사한 학습 안정성. 하이퍼파라미터 민감도가 낮다.
3. **비용:** PPO 대비 GPU 메모리 절반, 학습 시간도 더 짧다.
4. **성능:** 많은 벤치마크에서 RLHF와 대등하거나 우수한 결과를 보인다.

다음 글에서는 보상 모델과 선호 데이터 자체를 AI가 생성하는 **Constitutional AI**를 살펴본다. Anthropic이 Claude를 어떻게 정렬하는지, 그 원칙 기반 접근법의 핵심을 다룬다.

---

**지난 글:** [RLHF: 인간 피드백으로 LLM 정렬하기](/posts/llm-rlhf/)

**다음 글:** [Constitutional AI: 원칙 기반 AI 정렬](/posts/llm-constitutional-ai/)

<br>
읽어주셔서 감사합니다. 😊
