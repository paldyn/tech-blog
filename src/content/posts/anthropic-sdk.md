---
title: "Anthropic SDK로 Claude API 활용하기"
description: "anthropic.Anthropic()으로 클라이언트 초기화, messages.create()로 대화 생성, 스트리밍·도구 사용·비전·프롬프트 캐싱까지 — Anthropic Python SDK의 핵심 패턴을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["Anthropic", "Claude", "SDK", "messages.create", "streaming", "tool_use", "vision", "프롬프트 캐싱", "API"]
featured: false
draft: false
---

[지난 글](/posts/huggingface-hub/)에서 HuggingFace Hub로 모델을 공유하고 배포하는 방법을 살펴봤다. 이번에는 방향을 바꿔 **Anthropic Claude API**를 Python에서 직접 호출하는 방법을 정리한다. Claude는 지시 따르기, 긴 맥락 처리, 코드 작성에 특히 강점이 있어, 프로덕션 AI 애플리케이션의 핵심 컴포넌트로 많이 사용된다.

## 설치와 클라이언트 초기화

```bash
pip install anthropic
```

API 키는 [console.anthropic.com](https://console.anthropic.com)에서 발급한다.

```python
import anthropic

# 방법 1: 환경변수 ANTHROPIC_API_KEY 자동 읽기
client = anthropic.Anthropic()

# 방법 2: 직접 전달
client = anthropic.Anthropic(api_key="sk-ant-xxxxxxxxxxxxxxxxxxxx")
```

환경변수 `ANTHROPIC_API_KEY`를 설정해두면 코드에 키를 하드코딩하지 않아도 된다.

```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxx"
```

## messages.create(): 기본 대화

![Anthropic SDK — messages.create() 구조](/assets/posts/anthropic-sdk-messages.svg)

`messages.create()`는 Claude API의 핵심 진입점이다. `model`, `max_tokens`, `messages` 세 파라미터가 필수다.

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "파이썬으로 피보나치 수열을 구현해줘"}
    ]
)

# 응답 텍스트 추출
print(message.content[0].text)

# 사용 토큰 확인
print(message.usage.input_tokens, message.usage.output_tokens)
```

### 주요 모델 ID

| 모델 | 특징 |
|------|------|
| `claude-opus-4-7` | 가장 강력. 복잡한 분석·추론 |
| `claude-sonnet-4-6` | 성능·속도·비용의 균형 (범용) |
| `claude-haiku-4-5-20251001` | 빠른 응답. 분류·요약 등 간단한 태스크 |

### 시스템 프롬프트

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system="당신은 한국어로만 대답하는 친절한 Python 튜터입니다.",
    messages=[
        {"role": "user", "content": "리스트 컴프리헨션을 설명해줘"}
    ]
)
```

### 멀티턴 대화

`messages` 배열에 이전 대화를 그대로 누적하면 된다.

```python
history = []

def chat(user_input):
    history.append({"role": "user", "content": user_input})
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="한국어 코딩 도우미",
        messages=history
    )
    reply = response.content[0].text
    history.append({"role": "assistant", "content": reply})
    return reply

print(chat("파이썬의 GIL이 뭐야?"))
print(chat("그럼 멀티프로세싱은 어떻게 달라?"))
```

## 스트리밍

![Anthropic SDK — 스트리밍 & 고급 기능](/assets/posts/anthropic-sdk-streaming.svg)

긴 응답을 생성할 때 스트리밍을 쓰면 첫 토큰이 도착하는 즉시 출력할 수 있어 체감 응답 속도가 크게 향상된다.

```python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    messages=[{"role": "user", "content": "대한민국 역사를 요약해줘"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

# 스트림 종료 후 최종 메시지 객체 접근
final_message = stream.get_final_message()
print(f"\n총 토큰: {final_message.usage.input_tokens + final_message.usage.output_tokens}")
```

## Tool Use (도구 호출)

Claude가 외부 함수를 호출해 결과를 받아 답변하는 **함수 호출** 패턴이다.

```python
tools = [
    {
        "name": "get_weather",
        "description": "주어진 도시의 현재 날씨를 조회합니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "도시 이름 (한국어)"}
            },
            "required": ["city"]
        }
    }
]

def get_weather(city: str) -> str:
    # 실제 날씨 API 호출 (여기서는 더미)
    return f"{city}의 현재 날씨: 맑음, 22°C"

messages = [{"role": "user", "content": "서울 날씨 알려줘"}]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=messages
)

# Claude가 도구 호출을 요청한 경우
if response.stop_reason == "tool_use":
    tool_block = next(b for b in response.content if b.type == "tool_use")
    tool_result = get_weather(**tool_block.input)

    # 결과를 포함해 다시 요청
    messages += [
        {"role": "assistant", "content": response.content},
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": tool_result
                }
            ]
        }
    ]
    final = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        tools=tools,
        messages=messages
    )
    print(final.content[0].text)
```

## Vision: 이미지 분석

content 배열에 `image` 타입 블록을 추가하면 이미지를 함께 전달할 수 있다.

```python
import base64
from pathlib import Path

# 로컬 파일을 Base64로 인코딩
image_data = base64.standard_b64encode(
    Path("chart.png").read_bytes()
).decode("utf-8")

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_data
                    }
                },
                {
                    "type": "text",
                    "text": "이 차트에서 가장 중요한 트렌드를 설명해줘"
                }
            ]
        }
    ]
)
print(message.content[0].text)
```

URL을 직접 전달하는 것도 가능하다.

```python
content = [
    {
        "type": "image",
        "source": {
            "type": "url",
            "url": "https://example.com/image.jpg"
        }
    },
    {"type": "text", "text": "이 이미지를 설명해줘"}
]
```

## 프롬프트 캐싱

긴 시스템 프롬프트나 문서를 반복 호출에서 재사용할 때 **프롬프트 캐싱**을 쓰면 비용을 크게 절감할 수 있다. 캐시 히트 시 입력 토큰 비용이 최대 90% 감소한다.

```python
# 캐싱 대상 블록에 cache_control 추가
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "당신은 전문 법률 문서 분석가입니다. " + very_long_legal_text,
            "cache_control": {"type": "ephemeral"}   # 이 블록을 캐시
        }
    ],
    messages=[
        {"role": "user", "content": "위 계약서에서 위약금 조항을 찾아줘"}
    ]
)

# 캐시 적중 여부 확인
print(message.usage.cache_read_input_tokens)    # 캐시에서 읽은 토큰
print(message.usage.cache_creation_input_tokens) # 새로 캐시 생성된 토큰
```

캐시는 최소 5분간 유지되며, `ephemeral` 타입은 세션 내에서 재사용된다.

## 비동기 클라이언트

FastAPI나 asyncio 기반 앱에서는 `AsyncAnthropic`을 사용한다.

```python
import asyncio
import anthropic

async def main():
    client = anthropic.AsyncAnthropic()

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": "비동기 Python의 장점은?"}]
    )
    print(message.content[0].text)

    # 비동기 스트리밍
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": "asyncio를 설명해줘"}]
    ) as stream:
        async for text in stream.text_stream:
            print(text, end="", flush=True)

asyncio.run(main())
```

## 에러 처리

```python
import anthropic
import time

client = anthropic.Anthropic()

def call_with_retry(messages, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                messages=messages
            )
        except anthropic.RateLimitError:
            wait = 2 ** attempt * 10   # 지수 백오프
            print(f"Rate limit. {wait}초 후 재시도...")
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            print(f"API 오류 {e.status_code}: {e.message}")
            raise
    raise RuntimeError("최대 재시도 횟수 초과")
```

주요 예외 클래스:

| 예외 | HTTP 상태 | 설명 |
|------|-----------|------|
| `RateLimitError` | 429 | 요청 속도 초과 |
| `APIStatusError` | 4xx/5xx | 일반 API 오류 |
| `AuthenticationError` | 401 | API 키 오류 |
| `BadRequestError` | 400 | 잘못된 요청 파라미터 |

## 배치 처리 (Message Batches)

대량의 독립적인 요청을 처리할 때는 Batches API가 비용 효율적이다.

```python
import anthropic

client = anthropic.Anthropic()

# 배치 생성
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"req-{i}",
            "params": {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 256,
                "messages": [{"role": "user", "content": text}]
            }
        }
        for i, text in enumerate(texts)
    ]
)

print(f"배치 ID: {batch.id}")
# 결과는 비동기로 처리됨 — polling 또는 webhook으로 수신
```

## 정리

| 기능 | 코드 패턴 |
|------|-----------|
| 기본 호출 | `client.messages.create(model=..., max_tokens=..., messages=[...])` |
| 스트리밍 | `with client.messages.stream(...) as s: for t in s.text_stream` |
| 도구 호출 | `tools=[...]` 전달 + `stop_reason == "tool_use"` 처리 |
| 이미지 분석 | content에 `{"type": "image", "source": {...}}` 추가 |
| 프롬프트 캐싱 | `cache_control: {"type": "ephemeral"}` 블록 지정 |
| 비동기 | `AsyncAnthropic()` + `await` |

다음 글에서는 OpenAI SDK를 다루며 두 SDK의 설계 철학과 API 구조를 비교해볼 예정이다.

---

**지난 글:** [HuggingFace Hub: 모델 공유와 배포](/posts/huggingface-hub/)

**다음 글:** [OpenAI SDK로 GPT API 활용하기](/posts/openai-sdk/)

<br>
읽어주셔서 감사합니다. 😊
