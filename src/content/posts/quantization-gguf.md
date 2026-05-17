---
title: "GGUF 완전 정복: llama.cpp의 양자화 포맷과 실전 사용법"
description: "GGUF 파일 구조, Q4_K_M·Q5_K_S 등 양자화 레벨의 차이, Hugging Face에서 모델 다운로드·변환·추론까지 실전 가이드."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["GGUF", "llama.cpp", "양자화", "LLM추론", "Q4_K_M", "로컬LLM"]
featured: false
draft: false
---

[지난 글](/posts/quantization-basics/)에서 INT8·INT4 양자화의 수학적 원리와 PTQ·QAT 전략을 다뤘다. 이론을 익혔다면 이제 실제 파일을 손에 쥐어야 한다. Hugging Face에서 "GGUF" 확장자 파일을 본 적 있을 것이다. 오늘은 그 GGUF가 정확히 무엇인지, 어떤 양자화 레벨을 골라야 하는지, 그리고 llama.cpp와 Python에서 어떻게 추론하는지를 처음부터 끝까지 다룬다.

## GGUF가 등장한 이유

2023년 8월 이전까지 llama.cpp는 **GGML** 포맷을 사용했다. GGML은 양자화 정보를 담을 수 있었지만 메타데이터(토크나이저, 아키텍처 정보, 컨텍스트 길이)를 저장하는 표준 방법이 없었고, 모델 구조가 바뀔 때마다 파일 레이아웃도 달라져 역호환성이 엉망이었다. GGUF(GPT-Generated Unified Format)는 이 문제를 해결하기 위해 Georgi Gerganov가 설계한 포맷이다. 핵심 설계 원칙 두 가지는 다음과 같다.

**단일 파일에 모든 것을 담는다**: 토크나이저 어휘, BPE 병합 규칙, 모델 하이퍼파라미터, 양자화된 가중치까지 하나의 파일에 들어간다. 예전에는 `tokenizer_config.json`, `config.json`, 여러 개의 `.bin` 파일을 함께 배포해야 했다.

**mmap으로 제로카피 접근**: 파일 내 텐서 데이터 영역이 페이지 경계에 정렬되어 있어, 운영체제의 메모리 맵(mmap)을 통해 디스크에서 GPU 메모리로 직접 로드할 수 있다. 대형 모델을 RAM에 전부 올리지 않고도 추론 가능하다.

![GGUF 파일 구조](/assets/posts/quantization-gguf-structure.svg)

## GGUF 파일 구조 분해

바이너리 레이아웃을 이해하면 디버깅이 쉬워진다.

**헤더(24바이트 고정)**:
- `magic`: `GGUF` ASCII 문자열 (0x47475546)
- `version`: 현재 3 (하위 호환 유지)
- `tensor_count`: 텐서 개수 (7B 모델은 약 291개)
- `metadata_kv_count`: KV 쌍 개수

**메타데이터 KV 쌍**: 키(문자열)와 값(다양한 타입)으로 구성된 딕셔너리다. 주요 키들은 다음과 같다.

```python
# 실제 GGUF 메타데이터 키 예시
"general.architecture"    # "llama"
"general.name"            # "Meta-Llama-3-8B"
"llama.context_length"    # 8192
"llama.embedding_length"  # 4096
"llama.block_count"       # 32
"tokenizer.ggml.model"    # "llama"
"tokenizer.ggml.tokens"   # [...어휘 목록...]
```

**텐서 정보 배열**: 각 텐서마다 이름, 차원 수, 형태, 양자화 타입, 파일 내 오프셋을 저장한다.

**텐서 데이터**: 실제 양자화된 가중치 블록. `ALIGNMENT`(기본 32바이트) 단위로 정렬된 패딩 이후 시작한다.

## 양자화 레벨 해석법

GGUF 파일명에서 양자화 레벨을 읽는 패턴을 익혀야 한다.

- **Q숫자**: 비트 수. Q4는 4비트, Q8은 8비트.
- **_K**: K-Quant 방식. 레이어 중요도에 따라 혼합 비트를 적용한다.
- **_M / _S / _L**: K-Quant의 크기 변형. M(Medium), S(Small), L(Large). 같은 비트 수에서 중요 레이어에 할당하는 고비트 비율이 다르다.
- **숫자만**: 단순 균일 양자화. Q4_0은 모든 가중치에 균일하게 4비트 적용.

![GGUF 양자화 레벨 비교](/assets/posts/quantization-gguf-levels.svg)

**7B 모델 기준 실전 선택 가이드**:

- 8~16GB VRAM GPU → **Q5_K_M** 또는 **Q6_K** (최고 품질)
- 6~8GB VRAM GPU → **Q4_K_M** (품질과 크기의 황금 균형)
- 4~6GB VRAM 또는 RAM 추론 → **Q4_K_S** 또는 **Q4_0**
- 4GB 이하 초저사양 → **Q3_K_M** (품질 손실 감수)

## llama.cpp로 추론하기

먼저 llama.cpp를 빌드한다.

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# CPU 전용
cmake -B build && cmake --build build -j8

# CUDA (NVIDIA GPU)
cmake -B build -DGGML_CUDA=ON && cmake --build build -j8
```

Hugging Face에서 GGUF 파일을 다운로드한다.

```bash
pip install huggingface-hub
huggingface-cli download \
  bartowski/Meta-Llama-3.1-8B-Instruct-GGUF \
  Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  --local-dir ./models
```

명령줄에서 바로 추론한다.

```bash
./build/bin/llama-cli \
  -m models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  -p "한국의 수도는?" \
  -n 128 \
  --temp 0.7 \
  -ngl 33   # GPU 레이어 수 (전체 오프로드)
```

## Python에서 llama-cpp-python 활용

Python 바인딩으로 애플리케이션에 직접 통합할 수 있다.

```python
from llama_cpp import Llama

llm = Llama(
    model_path="models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    n_gpu_layers=33,    # GPU에 올릴 레이어 수 (-1=전체)
    n_ctx=4096,         # 컨텍스트 길이
    n_batch=512,        # 배치 크기
    verbose=False,
)

response = llm.create_chat_completion(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Python의 GIL이란 무엇인가요?"},
    ],
    max_tokens=512,
    temperature=0.7,
    stream=False,
)
print(response["choices"][0]["message"]["content"])
```

스트리밍 응답도 간단하다.

```python
for chunk in llm.create_chat_completion(
    messages=[{"role": "user", "content": "피타고라스 정리를 설명해줘"}],
    stream=True,
):
    delta = chunk["choices"][0]["delta"]
    if "content" in delta:
        print(delta["content"], end="", flush=True)
```

## 직접 GGUF로 변환하기

Hugging Face 형식 모델을 GGUF로 변환할 수 있다.

```bash
# 의존성 설치
pip install -r requirements.txt

# 변환 (F16 먼저)
python convert_hf_to_gguf.py \
  ./my-finetuned-model \
  --outtype f16 \
  --outfile ./my-model-f16.gguf

# 양자화 적용
./build/bin/llama-quantize \
  ./my-model-f16.gguf \
  ./my-model-Q4_K_M.gguf \
  Q4_K_M
```

## GGUF 메타데이터 직접 읽기

`gguf` Python 패키지로 파일을 열지 않고도 메타데이터를 확인할 수 있다.

```bash
pip install gguf
```

```python
from gguf import GGUFReader

reader = GGUFReader("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")

# 주요 메타데이터 출력
for key in ["general.name", "llama.context_length",
            "llama.block_count", "llama.embedding_length"]:
    if key in reader.fields:
        print(f"{key}: {reader.fields[key].parts[-1]}")

# 텐서 통계
total_params = 0
for t in reader.tensors:
    params = 1
    for d in t.shape:
        params *= d
    total_params += params
print(f"총 파라미터: {total_params/1e9:.2f}B")
```

## 정리

GGUF는 로컬 LLM 추론의 사실상 표준 포맷이다. 핵심을 요약하면:

- **단일 파일**: 토크나이저부터 가중치까지 전부 포함
- **K-Quant**: 중요 레이어에 상위 비트, 나머지에 하위 비트를 혼합해 같은 크기에서 더 높은 품질
- **Q4_K_M**: 7B 모델에서 4GB대 크기에 94% 품질을 달성하는 범용 최선택
- **mmap**: 대용량 모델도 디스크에서 직접 읽어 RAM 사용량 최적화

다음 글에서는 GGUF와 함께 INT4 양자화의 양대 산맥인 **AWQ와 GPTQ**의 알고리즘 원리와 실전 비교를 다룬다.

---

**지난 글:** [양자화 완전 정복: 모델 크기를 절반으로 줄이는 기술](/posts/quantization-basics/)

**다음 글:** [AWQ vs GPTQ: 고급 INT4 양자화 완전 비교](/posts/quantization-awq-gptq/)

<br>
읽어주셔서 감사합니다. 😊
