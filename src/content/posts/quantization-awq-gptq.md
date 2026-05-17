---
title: "AWQ vs GPTQ: 고급 INT4 양자화 완전 비교"
description: "AWQ(활성화 인식 가중치 양자화)와 GPTQ(OBC 기반 최적 압축)의 알고리즘 원리와 차이, 벤치마크 비교, AutoAWQ·auto-gptq 실전 적용."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["AWQ", "GPTQ", "양자화", "INT4", "LLM최적화", "vLLM"]
featured: false
draft: false
---

[지난 글](/posts/quantization-gguf/)에서 GGUF 포맷과 K-Quant 레벨을 살펴봤다. GGUF가 CPU 추론에 최적화된 로컬용 포맷이라면, AWQ와 GPTQ는 GPU 서버에서 높은 처리량을 유지하면서 INT4로 압축하는 데 특화된 방법이다. 같은 INT4라도 어떤 알고리즘으로 양자화하느냐에 따라 품질과 속도가 크게 달라진다. 이 글에서는 두 방법의 수학적 핵심과 실전 적용 방법을 나란히 비교한다.

## 왜 단순 INT4 양자화는 성능이 떨어지는가

가장 단순한 INT4 양자화는 **RTN(Round-to-Nearest)**이다. 각 가중치를 그냥 반올림해서 INT4로 변환한다. LLaMA-2-7B를 RTN INT4로 변환하면 Perplexity가 5.47에서 8.12로 크게 오른다(낮을수록 좋은 지표이므로 이는 심각한 성능 저하다). MMLU 정확도도 45.2%에서 38.4%로 떨어진다.

문제는 두 가지다. 첫째, LLM 가중치에는 **outlier**가 존재한다. 특정 채널의 가중치가 다른 채널보다 10~100배 큰 경우, absmax scale로는 나머지 채널이 모두 0 또는 1의 정수로 뭉개진다. 둘째, INT4는 표현 범위가 너무 좁아(-8~7) 양자화 오차가 누적될 때 모델 출력에 심각한 영향을 준다.

AWQ와 GPTQ는 각각 다른 전략으로 이 문제를 해결한다.

![AWQ vs GPTQ 알고리즘 비교](/assets/posts/quantization-awq-gptq-comparison.svg)

## AWQ: 활성화를 보면 가중치가 보인다

**AWQ(Activation-aware Weight Quantization)**의 핵심 통찰은 "모든 가중치가 똑같이 중요하지 않다"는 것이다. Lin et al. (2023)은 실험을 통해 전체 가중치의 약 1%만이 전체 모델 성능의 대부분을 담당한다는 것을 보였다. 이 1%를 어떻게 식별하는가? **활성화(activation) 크기**를 본다.

가중치 `W`와 입력 `X`의 곱 `WX`에서, 특정 입력 채널 `j`의 활성화 크기 `|Xⱼ|`가 크면 해당 가중치 열 `Wⱼ`가 출력에 미치는 영향도 크다. 따라서 `|Xⱼ|`가 큰 채널을 "중요 채널"로 식별하고, 이 채널의 양자화 오차를 줄이는 것이 핵심이다.

AWQ는 이를 scale 변환으로 해결한다. 가중치 행렬에 channel-wise scale `s`를 곱하고 입력에는 `1/s`를 곱하는 등가 변환을 통해, 중요 채널의 가중치 값을 작게 만든다. 작은 값은 INT4의 제한된 범위 안에 더 잘 들어맞는다.

수식으로 표현하면:

```python
# AWQ의 등가 변환 원리
# 원래: Y = WX
# 변환 후: Y = (W * s) * (X / s)  →  수학적으로 동일
# W_scaled = W * s  →  이 값을 INT4로 양자화
# 추론 시: X를 넣기 전에 s로 나눔 (activation scaling)
# 실제 구현은 linear layer의 weight를 합치는 방식

import torch
# 채널별 활성화 크기 측정 (보정 데이터로)
activation_scales = X.abs().mean(dim=0)  # [hidden_dim]
# 최적 scale 탐색 (α ∈ [0, 1] 사이 grid search)
# scale_j = activation_scales_j ** alpha
# 이 scale로 가중치를 변환 후 일반 INT4 양자화
```

### AutoAWQ로 모델 양자화하기

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_path = "meta-llama/Llama-2-7b-hf"
quant_config = {
    "zero_point": True,
    "q_group_size": 128,   # 그룹 크기 (클수록 느리고 정확)
    "w_bit": 4,             # 4비트 양자화
    "version": "GEMM",      # GEMM: 빠른 추론, GEMV: 배치 1 최적화
}

model = AutoAWQForCausalLM.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)

# 보정 (몇 분 소요)
model.quantize(tokenizer, quant_config=quant_config)
model.save_quantized("./llama2-7b-awq")
```

저장된 AWQ 모델 로드 및 추론:

```python
model = AutoAWQForCausalLM.from_quantized(
    "./llama2-7b-awq",
    fuse_layers=True,       # attention 레이어 융합으로 속도 향상
)
tokenizer = AutoTokenizer.from_pretrained("./llama2-7b-awq")

inputs = tokenizer("서울의 인구는", return_tensors="pt").to("cuda")
out = model.generate(**inputs, max_new_tokens=100)
print(tokenizer.decode(out[0]))
```

## GPTQ: 2차 최적화로 오차를 수학적으로 최소화

**GPTQ(Frantar et al., 2022)**는 **OBS(Optimal Brain Surgeon)** 프레임워크를 대형 언어 모델에 적용한 방법이다. 핵심 아이디어는 한 가중치를 양자화할 때 생기는 오차를, 같은 레이어의 나머지 가중치들을 조정해서 보상한다는 것이다.

레이어 `l`의 가중치 행렬 `W`를 양자화할 때, 목표는 다음 오차를 최소화하는 것이다:

```
argmin ||WX - Q(W)X||²_F
```

여기서 `Q(W)`는 양자화된 가중치, `X`는 보정 데이터의 입력이다. GPTQ는 이를 열(column) 단위로 처리한다. `j`번째 열을 양자화할 때 발생하는 오차를 **Hessian 행렬** `H = 2XXᵀ`의 역행렬을 이용해 나머지 열에 분산시킨다.

### auto-gptq로 모델 양자화하기

```python
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
from transformers import AutoTokenizer

quantize_config = BaseQuantizeConfig(
    bits=4,             # 4비트 양자화
    group_size=128,     # 그룹 크기 (작을수록 품질↑, 크기↑)
    desc_act=False,     # 활성화 순서 재배치 (True면 정확도↑, 느림)
)

model = AutoGPTQForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantize_config=quantize_config,
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# 보정 데이터 준비 (C4 데이터셋 128 샘플)
from datasets import load_dataset
data = load_dataset("allenai/c4", data_files="en/c4-train.00001*",
                    split="train").shuffle().select(range(128))
examples = [tokenizer(ex["text"], max_length=512, truncation=True)
            for ex in data]

# 양자화 실행 (수십 분 소요)
model.quantize(examples)
model.save_quantized("./llama2-7b-gptq", use_safetensors=True)
```

로드 및 추론:

```python
model = AutoGPTQForCausalLM.from_quantized(
    "./llama2-7b-gptq",
    use_triton=False,    # True면 Triton 커널 사용 (속도↑)
    inject_fused_mlp=True,
    inject_fused_attention=True,
)
```

## 벤치마크 비교

![INT4 양자화 방법별 벤치마크](/assets/posts/quantization-awq-gptq-benchmark.svg)

## vLLM과의 통합

AWQ와 GPTQ 모두 vLLM에서 직접 지원한다. 서빙 스택에서 가장 중요한 통합 방법이다.

```python
from vllm import LLM, SamplingParams

# AWQ 모델 로드
llm = LLM(
    model="TheBloke/Llama-2-7B-AWQ",
    quantization="awq",        # "gptq"도 동일 방식
    dtype="float16",
    gpu_memory_utilization=0.90,
)

sampling = SamplingParams(temperature=0.8, max_tokens=512)
outputs = llm.generate(
    ["서울의 사계절을 설명해줘", "Python 데코레이터란?"],
    sampling
)
for out in outputs:
    print(out.outputs[0].text)
```

## 선택 기준 요약

| 기준 | AWQ | GPTQ |
|---|---|---|
| 보정 시간 | 수 분 | 수십 분~수 시간 |
| 품질 (같은 비트) | ≈ 동등 | 미세하게 우세 |
| 추론 속도 | 빠름 (GEMM 커널) | 중간 |
| CPU/llama.cpp 호환 | 직접 불가 | GGUF 변환 필요 |
| vLLM 지원 | 완전 지원 | 완전 지원 |
| 메모리 | 3.5~3.8 GB (7B) | 3.6~4.0 GB (7B) |

**결론**: GPU 서빙 환경에서 빠른 적용이 필요하면 AWQ, 보정 비용을 감수하고 최대 품질을 원하면 GPTQ. 두 방법 모두 단순 RTN INT4 대비 품질이 훨씬 높아 실무에서 FP16 대체로 충분히 사용 가능하다.

다음 글에서는 모델 크기를 줄이는 또 다른 접근인 **지식 증류(Knowledge Distillation)**를 다룬다. 양자화가 기존 가중치를 압축하는 방법이라면, 증류는 큰 모델의 지식을 작은 모델에 이전하는 훈련 방법이다.

---

**지난 글:** [GGUF 완전 정복: llama.cpp의 양자화 포맷과 실전 사용법](/posts/quantization-gguf/)

**다음 글:** [지식 증류: 대형 모델의 지식을 소형 모델로 이전하기](/posts/distillation/)

<br>
읽어주셔서 감사합니다. 😊
