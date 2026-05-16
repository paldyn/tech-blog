---
title: "양자화 완전 정복: 모델 크기를 절반으로 줄이는 기술"
description: "LLM 양자화의 원리(PTQ/QAT), INT8/INT4/FP16/BF16의 차이, 양자화 오차와 보정 기법, 그리고 실제 적용 전략을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["양자화", "Quantization", "INT8", "INT4", "PTQ", "QAT", "LLM최적화"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-on-prem/)에서 온프레미스 GPU 서버로 LLM을 파인튜닝하는 방법을 다뤘다. 정성 들여 훈련한 모델을 이제 실제 서비스에 올려야 한다. 그런데 문제가 있다. 7B 모델 하나가 BF16 기준으로 14GB, 70B 모델은 140GB에 달한다. A100 한 장에도 간신히 올라가는 모델을 소비자용 GPU에 올리거나, 엣지 디바이스에 배포하거나, 수백 개의 요청을 동시에 처리하려면? 이 문제를 해결하는 핵심 기술이 **양자화(Quantization)** 다. 이번 글에서는 양자화의 수학적 원리부터 PTQ·QAT 두 가지 전략, 실제 코드 적용 방법까지 빠짐없이 다룬다.

## 왜 양자화가 필요한가

양자화의 필요성은 세 가지 축으로 요약된다.

**메모리**: FP32 7B 모델은 28GB, BF16은 14GB를 차지한다. INT8로 줄이면 7GB, INT4면 3.5GB다. 소비자용 RTX 3090(24GB)에서 FP16으로 겨우 들어가는 7B 모델이 INT4로는 여유롭게 올라가고, 13B 모델도 INT4 8GB면 게이밍 노트북에서 동작한다.

**속도**: 정수 연산은 부동소수점 연산보다 하드웨어 수준에서 빠르다. NVIDIA Ampere 이후 아키텍처의 INT8 텐서 코어는 FP16 대비 2배의 처리량을 낸다. 메모리 대역폭도 절반으로 줄어들어 메모리 바운드인 LLM 추론에서 체감 속도 향상이 크다.

**비용**: 클라우드 추론 서비스를 운영하면 GPU 메모리가 곧 비용이다. 같은 GPU로 2배 많은 요청을 처리하거나, 절반 크기의 GPU를 사용할 수 있다면 운영비가 크게 줄어든다.

## 부동소수점 표현: 비트 하나하나의 역할

컴퓨터는 실수를 IEEE 754 표준의 부동소수점 형식으로 저장한다. 비트를 세 구역으로 나눈다.

- **부호 비트(Sign)**: 1비트. 양수(0)인지 음수(1)인지.
- **지수 비트(Exponent)**: 수의 동적 범위(얼마나 크거나 작은 수까지 표현하는가)를 결정한다.
- **가수 비트(Mantissa/Fraction)**: 수의 정밀도(소수점 아래 몇 자리까지 정확한가)를 결정한다.

![부동소수점 정밀도 비교: FP32 → FP16 → BF16 → INT8 → INT4](/assets/posts/quantization-basics-precision.svg)

### FP32 (32비트 단정밀도)

부호 1 + 지수 8 + 가수 23 = 32비트. 딥러닝 연구의 전통적 기준이다. 동적 범위와 정밀도 모두 충분하다. 7B 모델 기준 28GB를 차지한다.

### FP16 (16비트 반정밀도)

부호 1 + 지수 5 + 가수 10 = 16비트. FP32 대비 메모리를 절반으로 줄인다. 가수 비트가 10개뿐이라 작은 차이를 표현하는 능력이 낮다. 지수가 5비트로 줄어 표현 가능한 최댓값이 65504에 그친다. 훈련 중 일부 레이어에서 값이 이 범위를 벗어나면 **오버플로(Inf)**가 발생할 수 있다. 이를 막기 위해 Loss Scaling 기법을 함께 사용한다.

### BF16 (Brain Float 16)

Google Brain에서 개발. 부호 1 + 지수 8 + 가수 7 = 16비트. 지수 비트 수가 FP32와 동일(8비트)해서 표현 범위가 FP32와 같다. 오버플로 걱정이 없어 LLM 학습에서 FP16을 대부분 대체했다. 정밀도(가수 7비트)는 FP16(10비트)보다 낮지만, 대형 모델 학습에서는 이 정도 정밀도로 충분하다. A100·H100에서 BF16 텐서 코어를 하드웨어 수준으로 지원한다.

### INT8 (8비트 정수)

부호 1 + 정수 7 = 8비트. 양자화의 핵심 대상이다. -128~127 또는 0~255의 정수값만 표현한다. 부동소수점처럼 지수 개념이 없어 표현 범위가 고정된다. 대신 텐서 코어에서 처리량이 FP16 대비 2배다.

### INT4 (4비트 정수)

-8~7의 16가지 값만 표현한다. 메모리가 FP16의 1/4로 극적으로 줄어드는 대신 정밀도 손실도 커진다. GGUF, GPTQ, AWQ 같은 고급 양자화 기법을 사용하면 INT4에서도 FP16 대비 성능 손실을 2~3%로 억제할 수 있다.

## PTQ vs QAT: 두 가지 접근법

양자화를 적용하는 시점에 따라 크게 두 가지 전략으로 나뉜다.

![PTQ vs QAT: 두 가지 양자화 전략](/assets/posts/quantization-basics-types.svg)

### PTQ (Post-Training Quantization)

이미 학습을 마친 FP32 모델을 가져다 INT8로 변환한다. 핵심은 **보정(calibration)** 단계다. 소량의 대표 데이터(보통 512개 이하)를 모델에 통과시켜 각 레이어의 활성화 분포를 측정하고, 그 통계를 기반으로 scale과 zero-point를 계산한다.

**scale**은 정수 범위와 부동소수점 범위의 비율이다.

```
scale = max_float / max_int  # absmax 방식
# 예: 가중치 최댓값이 3.2이고 INT8 최댓값이 127이면
# scale = 3.2 / 127 ≈ 0.0252
# 양자화: q = round(x / scale)
# 역양자화: x_approx = q * scale
```

PTQ의 장점은 재학습이 필요 없다는 것이다. 기존 checkpoint를 그대로 사용하고 보정 데이터만 준비하면 몇 분 안에 양자화가 완료된다. 단점은 모델에 이미 고정된 가중치를 억지로 정수로 매핑하기 때문에, 특히 **outlier(이상치)**가 많은 레이어에서 정밀도 손실이 커질 수 있다는 것이다.

### QAT (Quantization-Aware Training)

학습 중에 양자화를 시뮬레이션한다. Forward pass에서 가짜 양자화(Fake Quantize) 연산을 삽입해 양자화 오차를 모델이 "경험"하게 한다. Backward pass에서는 양자화 연산이 미분 불가능하기 때문에 **STE(Straight-Through Estimator)**라는 근사 기법으로 그래디언트를 통과시킨다. 결과적으로 모델이 양자화 오차를 최소화하는 방향으로 가중치를 조정하며 수렴한다.

QAT는 PTQ보다 정밀도 손실이 훨씬 적다. 특히 INT4처럼 극단적인 압축에서 차이가 두드러진다. 단점은 재학습이 필요하다는 것이다. 전체 파인튜닝에 준하는 계산 비용이 든다.

**언제 어느 쪽을 선택하는가:**
- INT8 PTQ: 빠른 적용, 성능 손실 허용 범위 내 (FP16 대비 1% 이내)
- INT4 PTQ (AWQ/GPTQ): 메모리가 극히 부족한 환경, 성능 손실 2~3% 수용
- QAT: INT4에서 성능 손실이 허용 기준을 초과할 때, 재학습 비용을 감수할 수 있을 때

## 양자화 오차의 핵심: Outlier 문제

LLM에는 특수한 문제가 있다. 모델 크기가 6.7B 이상이 되면 일부 차원에서 절댓값이 매우 큰 **outlier** 값들이 나타난다. 예를 들어 대부분의 활성화 값이 -1~1 범위인데 특정 차원이 100 이상의 값을 가진다면, absmax 방식으로 scale을 계산하면 나머지 모든 값이 0~1의 정수 범위에 몰려 정보가 대부분 소실된다.

**LLM.int8()** (Dettmers et al., 2022)이 이 문제를 해결했다. outlier가 있는 차원은 FP16으로 계산하고, 나머지 대부분의 차원은 INT8로 계산하는 **혼합 정밀도(mixed-precision)** 접근이다. 이를 구현한 것이 `bitsandbytes` 라이브러리다.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model_name = "meta-llama/Llama-2-7b-hf"

# bitsandbytes INT8 로드 (load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    load_in_8bit=True,          # LLM.int8() 적용
    device_map="auto",          # 사용 가능한 GPU에 자동 배분
    torch_dtype=torch.float16,  # 비양자화 레이어는 FP16
)

tokenizer = AutoTokenizer.from_pretrained(model_name)

# 메모리 확인
for i in range(torch.cuda.device_count()):
    mem = torch.cuda.memory_allocated(i) / 1e9
    print(f"GPU {i}: {mem:.2f} GB")
# FP16(14GB) 대신 INT8(~7GB) 사용
```

INT4 로드도 마찬가지로 간단하다:

```python
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",       # NormalFloat4: 정규분포에 최적화된 4비트
    bnb_4bit_use_double_quant=True,  # 이중 양자화로 추가 메모리 절약
    bnb_4bit_compute_dtype=torch.bfloat16,
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
)
# 7B 모델이 약 4~5GB VRAM으로 동작
```

## 스케일 인수 계산: absmax vs zero-point

실제 구현에서 scale을 계산하는 두 가지 주요 방식을 이해할 필요가 있다.

**absmax (대칭 양자화)**: 텐서의 절댓값 최댓값을 기준으로 scale을 정한다. zero-point는 0으로 고정된다. 대칭 분포(가중치 행렬)에 적합하다.

```
scale = max(|x|) / 127
q = clamp(round(x / scale), -128, 127)
```

**zero-point (비대칭 양자화)**: 텐서의 실제 최솟값과 최댓값을 모두 고려한다. 비대칭 분포(ReLU 이후 활성화처럼 0 이상의 값만 있는 경우)에 적합하다.

```
scale = (max(x) - min(x)) / 255
zero_point = round(-min(x) / scale)
q = clamp(round(x / scale) + zero_point, 0, 255)
```

bitsandbytes의 NF4(NormalFloat 4-bit)는 한발 더 나아가, 정규분포를 가정하고 각 분위수(quantile)를 동일한 간격으로 배분해 정보 손실을 최소화한다. LLM 가중치가 대체로 정규분포를 따른다는 관찰에서 나온 아이디어다.

## 실전 성능 비교

실제 벤치마크 결과를 기반으로 한 수치다. (7B 모델, MMLU 기준)

| 형식 | VRAM | 추론 속도 | 정밀도 손실 |
|---|---|---|---|
| FP16 | 14 GB | 기준 | 기준 |
| INT8 (LLM.int8()) | 7 GB | 약 동등~1.2× | <1% |
| INT4 (NF4, double quant) | ~4 GB | 약 1.3~1.5× | 2~3% |
| INT4 (AWQ) | ~4 GB | 약 1.5~2.0× | 1~2% |

INT8은 FP16 대비 성능 손실이 거의 없어 대부분의 서비스 환경에서 기본 선택지다. INT4는 메모리가 절대적으로 부족할 때, 또는 엣지 디바이스 배포 시 사용한다. AWQ(Activation-aware Weight Quantization)와 GPTQ는 PTQ 기반이지만 더 정교한 보정 알고리즘으로 INT4에서도 높은 정밀도를 달성한다. 이는 다음 글에서 자세히 다룬다.

## 언제 양자화를 적용하면 안 되는가

양자화가 만능은 아니다. 다음 경우에는 주의가 필요하다.

- **수학·코딩 벤치마크**: 세밀한 수치 계산이 필요한 태스크에서 INT4는 실수가 늘어날 수 있다.
- **소형 모델(1B 이하)**: 파라미터가 적을수록 양자화 오차의 영향이 크다.
- **계속 파인튜닝할 모델**: INT8 양자화 상태에서는 일반적인 Full Fine-tuning이 어렵다. QLoRA는 예외적으로 가능하다.

## 정리

양자화는 현대 LLM 배포의 핵심 기술이다. 핵심을 정리하면:

1. **FP32→BF16**: 거의 무손실, 메모리 50% 절약. 학습과 추론 모두에 권장.
2. **BF16→INT8**: 성능 손실 1% 미만. 대부분의 서비스 환경에서 최선의 균형점.
3. **INT8→INT4**: 성능 손실 2~3%. AWQ/GPTQ 사용 시 1~2%로 억제 가능. 엣지/저사양 환경에 적합.
4. **PTQ**: 빠른 적용, 재학습 불필요. INT8까지는 충분하다.
5. **QAT**: 정밀도 최우선, 재학습 비용 감수. INT4 극단 압축에 유리.
6. **Outlier 문제**: LLM.int8()처럼 혼합 정밀도로 해결.

다음 글에서는 더 정교한 양자화 포맷인 **GGUF, AWQ, GPTQ**의 내부 동작 원리와 실전 활용법을 다룬다.

---

**지난 글:** [온프레미스에서 LLM 파인튜닝: GPU 서버 구성 완전 가이드](/posts/finetuning-on-prem/)

<br>
읽어주셔서 감사합니다. 😊
