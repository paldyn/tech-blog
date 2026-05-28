---
title: "Google Gemini SDK 활용 가이드"
description: "google-generativeai 패키지로 Gemini 2.0 Flash부터 1.5 Pro까지 — generate_content(), 스트리밍, 채팅 세션, 멀티모달 입력, Function Declarations, safety_settings, generation_config, 비동기 클라이언트, Google AI Studio vs Vertex AI까지 실전 예제 완전 정리"
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["Gemini", "Google", "SDK", "GenerativeAI", "Multimodal", "FunctionCalling", "VertexAI", "Python", "gemini-2.0-flash"]
featured: false
draft: false
---

[지난 글](/posts/openai-sdk/)에서 OpenAI Python SDK의 Chat Completions, Function Calling, 임베딩, Structured Outputs, 배치 API를 처음부터 끝까지 다뤘다. 이번에는 멀티모달 네이티브 설계로 탄생한 **Google Gemini SDK**를 살펴본다. `google-generativeai` 패키지 하나로 텍스트, 이미지, 동영상, 코드 실행까지 아우르는 Gemini의 강점과 독특한 API 패턴을 실전 예제로 완전 정리한다.

## 설치와 초기 설정

```bash
pip install google-generativeai pillow
```

Google AI Studio에서 API 키를 발급받은 후, `genai.configure()`로 글로벌하게 설정한다.

```python
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
```

OpenAI SDK와 달리 Gemini SDK는 전역 설정 방식을 기본으로 사용한다. 이후 모든 API 호출에 자동으로 적용된다.

## GenerativeModel과 generate_content()

`GenerativeModel`은 특정 모델에 바인딩된 클라이언트 객체다. 모델별로 하나씩 생성해 재사용한다.

```python
model = genai.GenerativeModel("gemini-2.0-flash")

response = model.generate_content("파이썬의 GIL이란 무엇인지 설명해주세요.")
print(response.text)
```

`generate_content()`는 단일 텍스트 프롬프트부터 복잡한 멀티모달 입력까지 모두 처리하는 핵심 메서드다.

![Gemini SDK generate_content 흐름](/assets/posts/gemini-sdk-generate.svg)

## 모델 선택 가이드

### gemini-2.0-flash

현재 Gemini 계열에서 가장 범용적으로 권장되는 모델이다. 속도와 품질의 균형이 뛰어나고, 멀티모달 처리가 가능하며, 비용도 합리적이다. 대부분의 프로덕션 사용 사례에 첫 번째 선택지다.

### gemini-1.5-pro

최대 **1M 토큰**(약 700,000 단어)의 컨텍스트를 지원한다. 소설 전집, 긴 코드베이스, 전체 법률 문서를 한 번에 처리할 수 있다. 긴 문서 분석, 동영상 전체 이해, 대규모 코드 리뷰에 적합하다.

## generation_config로 생성 제어

`GenerationConfig`로 응답의 무작위성, 길이, 다양성을 세밀하게 제어한다.

```python
from google.generativeai.types import GenerationConfig

model = genai.GenerativeModel(
    "gemini-2.0-flash",
    generation_config=GenerationConfig(
        temperature=0.4,      # 0.0(결정적) ~ 1.0(창의적)
        top_p=0.95,           # nucleus sampling
        top_k=40,             # top-k sampling
        max_output_tokens=1024,
        candidate_count=1,    # 생성할 응답 후보 수
    ),
)

response = model.generate_content("딥러닝이란?")
print(response.text)
```

`temperature=0.0`은 항상 같은 응답을 반환해 결정적 작업(분류, 파싱 등)에 적합하다. `temperature=0.8~1.0`은 창작, 브레인스토밍에 사용한다.

## 스트리밍

`stream=True`로 토큰을 실시간으로 받아 출력한다.

```python
for chunk in model.generate_content(
    "우주의 탄생을 자세히 설명해주세요.",
    stream=True,
):
    print(chunk.text, end="", flush=True)
```

스트리밍 중에는 `response.text` 대신 `chunk.text`로 각 청크의 텍스트를 접근한다.

## 채팅 세션 (start_chat)

멀티턴 대화는 `start_chat()`으로 세션을 생성하고 `send_message()`로 메시지를 주고받는다. 대화 히스토리가 세션 객체 내부에 자동으로 유지된다.

```python
chat = model.start_chat(history=[])

# 첫 번째 메시지
r1 = chat.send_message("안녕하세요! 저는 파이썬을 배우고 있어요.")
print(r1.text)

# 두 번째 메시지 (이전 맥락 자동 포함)
r2 = chat.send_message("리스트와 튜플의 차이점이 뭔가요?")
print(r2.text)

# 세 번째 메시지
r3 = chat.send_message("그렇다면 언제 튜플을 쓰는 게 좋나요?")
print(r3.text)

# 히스토리 확인
for msg in chat.history:
    print(f"[{msg.role}]: {msg.parts[0].text[:50]}...")
```

`history` 파라미터에 이전 대화 내역을 미리 넣어 맥락 있는 대화를 이어받을 수 있다.

## 멀티모달 입력

Gemini의 가장 강력한 기능이다. 텍스트와 이미지, 동영상, PDF를 동시에 입력할 수 있다.

![Gemini SDK 멀티모달 입력 흐름](/assets/posts/gemini-sdk-multimodal.svg)

### 이미지 입력 (PIL)

```python
from PIL import Image
import google.generativeai as genai

model = genai.GenerativeModel("gemini-2.0-flash")
image = Image.open("architecture_diagram.png")

response = model.generate_content([
    image,
    "이 아키텍처 다이어그램에서 잠재적인 단일 장애점(SPOF)을 찾아주세요.",
])
print(response.text)
```

### URL로 이미지 입력

```python
import httpx

image_url = "https://example.com/chart.png"
image_data = httpx.get(image_url).content

response = model.generate_content([
    {"mime_type": "image/png", "data": image_data},
    "이 차트의 주요 인사이트를 3가지로 요약해주세요.",
])
```

### Google Files API로 대용량 파일 처리

```python
# 동영상 파일 업로드 (최대 2GB)
video_file = genai.upload_file("presentation.mp4")

response = model.generate_content([
    video_file,
    "이 발표 동영상의 핵심 내용을 시간순으로 요약해주세요.",
])
print(response.text)

# 사용 후 삭제
genai.delete_file(video_file.name)
```

## Function Declarations (도구 사용)

Gemini의 Function Calling은 OpenAI와 유사하지만 `function_declarations` 형식을 사용한다.

```python
import json

# 도구 정의
tools = [
    genai.protos.Tool(function_declarations=[
        genai.protos.FunctionDeclaration(
            name="get_current_weather",
            description="특정 도시의 현재 날씨를 조회합니다.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "city": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="도시 이름 (예: 서울, 부산)"
                    ),
                    "unit": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        enum=["celsius", "fahrenheit"]
                    ),
                },
                required=["city"],
            ),
        )
    ])
]

model = genai.GenerativeModel("gemini-2.0-flash", tools=tools)
response = model.generate_content("서울 날씨 알려줘")

# 함수 호출 확인
if response.candidates[0].content.parts[0].function_call:
    fc = response.candidates[0].content.parts[0].function_call
    print(f"호출 함수: {fc.name}")
    print(f"인자: {dict(fc.args)}")
```

`tool_config`로 모델이 반드시 도구를 쓰도록 강제하거나(`ANY`), 특정 함수만 허용하거나(`NONE`으로 비활성화) 제어할 수 있다.

## safety_settings

Gemini는 유해 콘텐츠 필터링 정책을 개발자가 직접 조정할 수 있다.

```python
from google.generativeai.types import HarmCategory, HarmBlockThreshold

model = genai.GenerativeModel(
    "gemini-2.0-flash",
    safety_settings={
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
)
```

응답이 차단됐는지 확인하려면 `response.candidates[0].finish_reason`이 `SAFETY`인지 확인한다. 차단된 경우 `response.text` 접근 시 예외가 발생할 수 있으므로 반드시 처리해야 한다.

## 비동기 클라이언트

FastAPI나 asyncio 환경에서는 동기 클라이언트를 그대로 사용하면 이벤트 루프를 블로킹한다. `asyncio`와 함께 사용하려면 비동기 메서드를 활용한다.

```python
import asyncio
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

async def analyze_batch(texts: list[str]) -> list[str]:
    model = genai.GenerativeModel("gemini-2.0-flash")
    tasks = [
        asyncio.to_thread(model.generate_content, text)
        for text in texts
    ]
    responses = await asyncio.gather(*tasks)
    return [r.text for r in responses]

results = asyncio.run(analyze_batch([
    "파이썬 특징 요약",
    "자바스크립트 특징 요약",
    "러스트 특징 요약",
]))
```

또는 `vertexai` 패키지의 `AsyncGenerativeModel`을 사용하면 네이티브 비동기를 지원한다.

## Google AI Studio vs Vertex AI

Gemini API를 사용하는 두 가지 경로를 명확히 구분해야 한다.

**Google AI Studio (`google-generativeai`):**
- 개인 API 키 기반의 빠른 시작 환경
- 무료 티어(분당 요청 제한) 제공
- 프로토타이핑, 개인 프로젝트, 학습용
- `genai.configure(api_key=...)` 한 줄로 시작
- 데이터가 Google 서버에서 학습에 사용될 수 있음

**Vertex AI (`vertexai`):**
- Google Cloud Platform 기반의 엔터프라이즈 환경
- 데이터 거버넌스, VPC, 프라이빗 엔드포인트 지원
- SOC2, HIPAA 등 컴플라이언스 요건 충족
- 사용자 데이터가 학습에 사용되지 않음 보장
- 프로덕션 배포, 기업 서비스용

```python
# Vertex AI 방식
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project="my-project", location="us-central1")
model = GenerativeModel("gemini-2.0-flash")
response = model.generate_content("안녕하세요!")
```

API 인터페이스는 거의 동일하지만 인증 방식(서비스 계정 vs API 키)과 데이터 처리 정책이 다르다. 스타트업이나 학습 단계에서는 Google AI Studio, 엔터프라이즈 서비스에서는 Vertex AI를 선택한다.

## 1M 토큰 컨텍스트 활용

Gemini 1.5 Pro의 1M 토큰 컨텍스트는 단순한 스펙이 아니라 기존에 불가능했던 사용 사례를 열어준다.

```python
model = genai.GenerativeModel("gemini-1.5-pro")

# 대용량 코드베이스 전체 분석
with open("entire_codebase.py", "r") as f:
    code = f.read()  # 수만 줄 가능

response = model.generate_content(
    f"다음 코드베이스에서 보안 취약점을 모두 찾아주세요:\n\n{code}"
)
print(response.text)
```

단, 긴 컨텍스트는 비용도 높아진다. `response.usage_metadata.prompt_token_count`로 실제 사용된 토큰 수를 확인하며 비용을 모니터링한다.

## 에러 핸들링

```python
import google.api_core.exceptions as gexc

def safe_generate(model, prompt: str, max_retries: int = 3) -> str:
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            # 안전 필터 차단 확인
            if not response.candidates:
                return "[응답 없음: 안전 필터 차단]"
            return response.text
        except gexc.ResourceExhausted:
            import time
            wait = 2 ** attempt
            print(f"할당량 초과. {wait}초 후 재시도...")
            time.sleep(wait)
        except gexc.InvalidArgument as e:
            print(f"잘못된 요청: {e}")
            raise
        except gexc.InternalServerError:
            print("서버 오류. 재시도 중...")
    return "[오류: 최대 재시도 초과]"
```

`BlockedPromptException`은 입력 자체가 안전 정책에 위반될 때 발생한다. `StopCandidateException`은 생성 중간에 안전 필터가 작동했을 때 발생한다.

## 실전 패턴 정리

**모델 선택**: 일반 작업은 `gemini-2.0-flash`, 장문 처리는 `gemini-1.5-pro`.

**멀티모달 조합**: 텍스트와 이미지를 리스트로 전달. 순서는 자유롭지만 이미지를 앞에 두는 것이 컨텍스트 이해에 유리하다.

**채팅 세션 재사용**: `start_chat()`으로 생성한 세션 객체를 재사용해 대화를 이어나간다. 새 세션은 히스토리가 초기화된다.

**safety_settings 최적화**: 기본 설정은 꽤 보수적이다. B2B 서비스나 전문 도메인에서는 `BLOCK_ONLY_HIGH`로 완화하는 경우가 많다.

**토큰 비용**: `response.usage_metadata`로 항상 실제 사용량을 추적한다. 1M 토큰 컨텍스트는 강력하지만 비용이 선형 증가한다.

---

**지난 글:** [OpenAI SDK 완전 정복](/posts/openai-sdk/)

<br>
읽어주셔서 감사합니다. 😊
