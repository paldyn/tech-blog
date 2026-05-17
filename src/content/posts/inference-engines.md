---
title: "LLM 추론 엔진 완전 비교: vLLM·TGI·llama.cpp·Ollama"
description: "vLLM, TGI, SGLang, llama.cpp, Ollama, TensorRT-LLM 등 주요 LLM 추론 엔진의 특징·성능·PagedAttention·Continuous Batching 원리와 시나리오별 선택 기준."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["vLLM", "TGI", "llama.cpp", "Ollama", "LLM추론", "PagedAttention"]
featured: false
draft: false
---

[지난 글](/posts/speculative-decoding/)에서 투기적 디코딩으로 추론 속도를 높이는 알고리즘을 다뤘다. 이제 이를 실제 서비스에 올리는 도구인 **추론 엔진**을 살펴볼 차례다. vLLM, Hugging Face TGI, llama.cpp, Ollama, SGLang, TensorRT-LLM 등 선택지가 많아 혼란스러울 수 있다. 이 글에서는 각 엔진의 특징, 핵심 기술, 성능, 그리고 어떤 상황에서 무엇을 선택해야 하는지 구체적 기준을 제시한다.

## 추론 엔진이 필요한 이유

Hugging Face Transformers의 `model.generate()`로도 추론할 수 있다. 그런데 왜 전용 추론 엔진이 필요한가? 이유는 두 가지다.

**배치 효율성**: `generate()`는 각 요청을 독립적으로 처리한다. 동시 요청이 10개라면 GPU가 10번 직렬로 처리한다. 전용 엔진은 Continuous Batching으로 10개 요청을 GPU 한 번의 Forward Pass에 섞어 처리한다.

**메모리 효율성**: Transformers는 각 요청에 최대 컨텍스트 길이만큼 KV 캐시를 미리 예약한다. 실제 사용량과 무관하게. 64K 컨텍스트를 지원하는 모델이라면 짧은 응답에도 64K 분량의 GPU 메모리가 예약된다. PagedAttention 같은 기술이 이를 해결한다.

## 핵심 기술 1: Continuous Batching

전통적 정적 배치는 한 배치의 모든 요청이 끝날 때까지 다음 요청이 기다려야 한다. 500 토큰 요청 하나가 10 토큰 요청 7개를 막는 상황이 발생한다. **Continuous Batching(Iteration-level Scheduling)**은 각 Forward Pass(iteration) 단위로 배치를 재구성한다. 완료된 요청은 즉시 제거하고 대기 중인 요청을 빈 슬롯에 채운다. GPU 활용률이 크게 향상된다.

## 핵심 기술 2: PagedAttention

vLLM이 도입한 **PagedAttention**은 운영체제의 가상 메모리 페이지 개념을 KV 캐시에 적용한다. KV 캐시를 고정 크기 블록(보통 16~32 토큰)으로 나눠 관리한다. 요청은 실제 필요한 블록만 동적으로 할당받는다.

```python
from vllm import LLM, SamplingParams

# vLLM 기본 사용 - PagedAttention이 자동으로 적용됨
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    max_model_len=8192,
    gpu_memory_utilization=0.90,   # GPU 메모리 90% 사용
    max_num_seqs=256,               # 최대 동시 시퀀스 수
)

sampling_params = SamplingParams(temperature=0.7, max_tokens=512)
prompts = ["Python 데코레이터를 설명해줘", "서울의 역사를 알려줘"]
outputs = llm.generate(prompts, sampling_params)
for out in outputs:
    print(out.outputs[0].text)
```

![LLM 추론 엔진 비교](/assets/posts/inference-engines-comparison.svg)

## vLLM: GPU 서버의 사실상 표준

**vLLM**은 현재 GPU 기반 LLM 서빙에서 가장 널리 사용되는 엔진이다. PagedAttention, Continuous Batching, Flash Attention을 통합했고, OpenAI API 호환 서버를 내장한다.

```bash
pip install vllm

# OpenAI 호환 API 서버 실행
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --quantization awq \
  --tensor-parallel-size 2 \
  --max-model-len 32768 \
  --port 8000
```

```python
# OpenAI 클라이언트로 그대로 호출 가능
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")
resp = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "안녕하세요!"}],
    max_tokens=200,
)
print(resp.choices[0].message.content)
```

![vLLM PagedAttention 메모리 관리](/assets/posts/inference-engines-architecture.svg)

## TGI: Hugging Face 생태계의 서빙 엔진

**Text Generation Inference(TGI)**는 Hugging Face가 만든 프로덕션 서빙 솔루션이다. Hugging Face Hub의 모델을 Docker로 바로 배포할 수 있어 HF 생태계와의 통합이 뛰어나다.

```bash
# Docker로 TGI 실행
docker run --gpus all \
  -p 8080:80 \
  -v $HF_HOME:/root/.cache/huggingface \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3.1-8B-Instruct \
  --quantize awq \
  --max-input-length 4096 \
  --max-total-tokens 8192
```

```python
# Python 클라이언트
from huggingface_hub import InferenceClient

client = InferenceClient(model="http://localhost:8080")
for token in client.text_generation(
    "한국의 전통 음식을 설명해줘",
    max_new_tokens=200,
    stream=True,
):
    print(token, end="", flush=True)
```

## SGLang: 구조화 생성 특화

**SGLang**은 JSON 출력, 함수 호출, 복잡한 멀티스텝 생성에 특화된 엔진이다. Radix Attention으로 공통 프리픽스를 재사용해 배치 처리 효율을 높인다. 처리량 벤치마크에서 vLLM을 앞서는 경우가 많다.

```python
from sglang import function, system, user, assistant, gen, set_default_backend
from sglang.backend.runtime_endpoint import RuntimeEndpoint

set_default_backend(RuntimeEndpoint("http://localhost:30000"))

@function
def extract_info(s, text):
    s += system("정보를 JSON으로 추출하세요.")
    s += user(f"텍스트: {text}")
    s += assistant(gen("json", max_tokens=200, regex=r'\{.*\}'))

state = extract_info.run(text="김철수는 서울 출신 소프트웨어 엔지니어다.")
print(state["json"])
```

## 엔진별 사용 코드 패턴 비교

```python
# 같은 작업을 세 엔진으로 비교

# 1. vLLM (Python API)
from vllm import LLM, SamplingParams
llm = LLM(model="Qwen/Qwen2.5-7B-Instruct")
out = llm.generate(["안녕"], SamplingParams(max_tokens=100))

# 2. TGI (HTTP API)
import requests
resp = requests.post("http://localhost:8080/generate",
    json={"inputs": "안녕", "parameters": {"max_new_tokens": 100}})
text = resp.json()["generated_text"]

# 3. Ollama (REST API)
import requests
resp = requests.post("http://localhost:11434/api/generate",
    json={"model": "qwen2.5:7b", "prompt": "안녕", "stream": False})
text = resp.json()["response"]
```

## 선택 기준 요약

**GPU가 있는 프로덕션 서버**: vLLM이 첫 번째 선택이다. pip 설치 후 5분이면 OpenAI 호환 API 서버가 뜬다. 처리량 최고, 설정 최소.

**Hugging Face Hub 모델을 빠르게 서빙**: TGI가 Docker 한 줄로 해결한다. HF Inference Endpoints도 TGI 기반이다.

**JSON 구조화 출력이 중요한 서비스**: SGLang이 적합하다. 함수 호출, 에이전트 파이프라인에 특화.

**개발·테스트·개인 사용**: Ollama가 가장 쉽다. GUI 앱(Open WebUI, LM Studio)과 바로 연동.

**CPU 또는 VRAM이 없는 환경**: llama.cpp + GGUF가 유일한 선택. 다음 글에서 상세히 다룬다.

**NVIDIA 하드웨어 최고 성능 필요**: TensorRT-LLM. 설정이 복잡하지만 처리량이 가장 높다.

---

**지난 글:** [투기적 디코딩: LLM 추론 속도를 2~4배 높이는 기술](/posts/speculative-decoding/)

**다음 글:** [llama.cpp 완전 가이드: CPU에서 LLM 추론하기](/posts/inference-llama-cpp/)

<br>
읽어주셔서 감사합니다. 😊
