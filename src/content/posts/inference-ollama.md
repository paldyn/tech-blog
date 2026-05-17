---
title: "Ollama 완전 가이드: 로컬 LLM을 가장 쉽게 실행하기"
description: "Ollama 설치, 모델 pull·run·serve, Modelfile 커스터마이징, OpenAI 호환 API, Python/JS SDK, Open WebUI 연동, 멀티모달 지원 완전 가이드."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["Ollama", "로컬LLM", "llama.cpp", "OpenWebUI", "Modelfile", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/inference-llama-cpp/)에서 llama.cpp를 직접 빌드하고 사용하는 방법을 다뤘다. **Ollama**는 llama.cpp를 내부 엔진으로 사용하면서도 개발자 경험을 극적으로 단순화한 도구다. 설치 1분, 모델 다운로드 1줄, 실행 1줄. macOS·Linux·Windows를 모두 지원하며 Docker 이미지도 제공한다. 개인 개발·테스트·프로토타이핑에 최적의 선택이다.

## 설치

```bash
# macOS / Linux (한 줄 설치)
curl -fsSL https://ollama.com/install.sh | sh

# Windows: https://ollama.com/download 에서 설치 파일 다운로드

# Docker
docker run -d \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama

# Docker GPU 지원 (NVIDIA)
docker run -d \
  --gpus=all \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama
```

## 모델 실행

```bash
# 모델 다운로드 + 실행 (한 번에)
ollama run llama3.1:8b
# >>> 프롬프트 입력

# 인기 모델들
ollama run gemma3:12b         # Google Gemma3
ollama run qwen2.5:14b        # Alibaba Qwen
ollama run phi4               # Microsoft Phi-4
ollama run mistral:7b         # Mistral AI
ollama run deepseek-r1:8b     # DeepSeek R1 (추론 특화)
ollama run llava:13b          # 멀티모달 (이미지 분석)

# 코딩 특화
ollama run codellama:13b
ollama run qwen2.5-coder:14b

# 한국어 특화
ollama run EEVE-Korean-Instruct-10.8B  # 한국어 파인튜닝
```

Ollama 모델 허브(`ollama.com/library`)에서 태그별로 양자화 레벨을 선택할 수 있다.

```bash
# 양자화 레벨 선택 (기본은 Q4_K_M 계열)
ollama run llama3.1:8b-instruct-q8_0   # Q8: 고품질
ollama run llama3.1:8b-instruct-fp16   # FP16: 최고품질(VRAM 많이 필요)
```

## 주요 명령어

```bash
ollama list               # 설치된 모델 목록
ollama ps                 # 현재 실행 중인 모델
ollama show llama3.1:8b   # 모델 상세 정보 (파라미터, 크기)
ollama rm llama3.1:8b     # 모델 삭제

# 모델 정보 확인
ollama show llama3.1:8b --modelfile   # Modelfile 내용 출력
ollama show llama3.1:8b --parameters  # 파라미터 설정 출력
```

![Ollama 아키텍처와 사용 흐름](/assets/posts/inference-ollama-flow.svg)

## REST API 직접 호출

Ollama는 자동으로 HTTP 서버를 실행한다(포트 11434).

```bash
# 기본 생성 API
curl http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "prompt": "서울의 가볼 만한 곳 5가지",
    "stream": false
  }'

# Chat API (OpenAI 호환)
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "안녕하세요!"}]
  }'
```

## Python SDK

```python
import ollama

# 기본 채팅
response = ollama.chat(
    model="llama3.1:8b",
    messages=[
        {"role": "system", "content": "당신은 친절한 AI입니다."},
        {"role": "user", "content": "Python 제너레이터를 설명해줘"},
    ],
)
print(response["message"]["content"])

# 스트리밍
for chunk in ollama.chat(
    model="llama3.1:8b",
    messages=[{"role": "user", "content": "머신러닝이란?"}],
    stream=True,
):
    print(chunk["message"]["content"], end="", flush=True)
print()

# 임베딩 생성
embeddings = ollama.embeddings(
    model="nomic-embed-text",
    prompt="서울은 대한민국의 수도입니다.",
)
print(f"벡터 차원: {len(embeddings['embedding'])}")  # 768
```

## OpenAI 호환 API로 기존 코드 재활용

Ollama의 `/v1` 경로는 OpenAI API와 완벽 호환된다. 기존 OpenAI SDK 코드를 base_url만 바꿔서 로컬에서 실행할 수 있다.

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # 아무 값이나 OK
)

# 기존 OpenAI 코드와 동일
response = client.chat.completions.create(
    model="qwen2.5:14b",
    messages=[
        {"role": "system", "content": "You are a Korean coding assistant."},
        {"role": "user", "content": "Python에서 async/await를 설명해줘"},
    ],
    max_tokens=500,
    temperature=0.7,
)
print(response.choices[0].message.content)

# 스트리밍도 그대로
for chunk in client.chat.completions.create(
    model="llama3.1:8b",
    messages=[{"role": "user", "content": "데코레이터 패턴 예제"}],
    stream=True,
):
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

## Modelfile: 커스텀 모델 만들기

Modelfile로 시스템 프롬프트, 파라미터, 템플릿을 고정한 맞춤 모델을 만들 수 있다.

![Ollama Modelfile 구조](/assets/posts/inference-ollama-modelfile.svg)

```bash
# Modelfile 생성
cat > Modelfile << 'EOF'
FROM llama3.1:8b

SYSTEM """
당신은 한국의 스타트업 생태계 전문가입니다.
항상 한국어로 답변하고, 구체적인 사례와 데이터를 인용하세요.
답변은 명확한 구조(도입-본론-결론)를 따르세요.
"""

PARAMETER temperature 0.5
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
PARAMETER num_predict 1024
EOF

# 커스텀 모델 빌드
ollama create startup-expert -f Modelfile

# 실행
ollama run startup-expert
# >>> 한국 스타트업 투자 현황은?
```

로컬 GGUF 파일도 FROM으로 직접 사용할 수 있다.

```bash
cat > Modelfile << 'EOF'
FROM ./my-finetuned-model-Q4_K_M.gguf

SYSTEM "당신은 내부 업무 보조 AI입니다."
PARAMETER temperature 0.3
EOF

ollama create my-work-assistant -f Modelfile
```

## 멀티모달: 이미지 분석

```python
import ollama
import base64

with open("photo.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

response = ollama.chat(
    model="llava:13b",
    messages=[{
        "role": "user",
        "content": "이 이미지에 있는 텍스트를 모두 추출해줘",
        "images": [img_b64],
    }],
)
print(response["message"]["content"])
```

## Open WebUI 연동

Open WebUI는 ChatGPT와 유사한 UI를 Ollama 위에 올려주는 오픈소스 프로젝트다.

```bash
docker run -d \
  -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v open-webui:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main

# http://localhost:3000 접속 → 계정 생성 → 모델 선택
```

## LangChain·LlamaIndex 통합

```python
# LangChain + Ollama
from langchain_ollama import ChatOllama

llm = ChatOllama(model="llama3.1:8b", temperature=0.7)
response = llm.invoke("서울의 유명한 음식을 알려줘")
print(response.content)

# 스트리밍
for chunk in llm.stream("한국의 IT 산업 현황은?"):
    print(chunk.content, end="", flush=True)
```

## 정리

Ollama는 개발자가 로컬 LLM을 가장 빠르게 시작할 수 있는 도구다.

- **설치·실행 최소화**: 1분 내 첫 모델 실행
- **OpenAI 호환 API**: 기존 코드 재활용
- **Modelfile**: 시스템 프롬프트·파라미터를 모델에 내장
- **자동 GGUF 관리**: 다운로드·캐싱·버전 관리 자동화
- **멀티모달**: llava 모델로 이미지 분석

프로덕션 서버에서 높은 처리량이 필요하다면 vLLM으로 이동하고, 개발·테스트 환경에서는 Ollama로 시작하는 것이 최선이다.

---

**지난 글:** [llama.cpp 완전 가이드: CPU에서 LLM 추론하기](/posts/inference-llama-cpp/)

**다음 글:** [TGI 완전 가이드: Hugging Face의 프로덕션급 LLM 서빙](/posts/inference-tgi/)

<br>
읽어주셔서 감사합니다. 😊
