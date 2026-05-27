---
title: "AI 챗봇 서비스 설계: 아키텍처부터 배포까지"
description: "대화 이력 관리, RAG 연동, 스트리밍 응답, 안전 필터를 갖춘 프로덕션 수준 AI 챗봇 서비스의 설계 원칙과 구현 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI챗봇", "챗봇설계", "대화관리", "AnthropicSDK", "스트리밍", "RAG", "프로덕션AI"]
featured: false
draft: false
---

[지난 글](/posts/ai-coding-review/)에서 AI 코드 리뷰 자동화 시스템을 살펴봤다. 이번 글부터는 AI 기술을 실제 서비스로 구현하는 **애플리케이션 구축 패턴** 시리즈를 시작한다. 첫 번째 주제는 가장 대중적인 AI 응용 형태인 챗봇 서비스 설계다. 단순히 API를 호출하는 것을 넘어 대화 이력, 문서 검색, 안전 필터, 스트리밍 응답을 모두 갖춘 프로덕션 수준의 아키텍처를 살펴본다.

## 챗봇 서비스의 핵심 컴포넌트

AI 챗봇을 단순 데모 수준에서 실제 서비스로 발전시키려면 다음 세 가지 레이어가 필요하다.

**프론트엔드 레이어**: 웹, iOS, Android 등 사용자 접점. 스트리밍 응답 처리와 로딩 상태 관리가 핵심이다.

**백엔드 레이어**: API 서버, 대화 관리자, 세션 스토어. 이 레이어에서 대화 이력을 유지하고, RAG 문서를 검색하며, LLM API를 호출한다.

**AI 레이어**: LLM API(Claude, GPT-4o, Gemini)와 Vector DB. 실제 언어 처리와 지식 검색이 이루어진다.

![AI 챗봇 서비스 아키텍처](/assets/posts/app-chatbot-design-architecture.svg)

## 대화 이력 관리: 상태 유지 챗봇

LLM API 자체는 무상태(stateless)다. 대화 맥락을 유지하려면 클라이언트나 서버에서 이력을 누적해 매 요청마다 전달해야 한다.

```python
import anthropic

client = anthropic.Anthropic()

class ChatBot:
    def __init__(self, system_prompt: str):
        self.system = system_prompt
        self.history: list[dict] = []

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=self.system,
            messages=self.history,
        )

        assistant_message = response.content[0].text
        self.history.append({"role": "assistant", "content": assistant_message})
        return assistant_message

    def clear(self) -> None:
        self.history = []
```

이 패턴의 핵심은 `self.history` 리스트다. 매 대화마다 사용자 메시지와 어시스턴트 응답을 쌍으로 추가하고, 다음 호출 시 전체 이력을 넘긴다. LLM은 이 이력을 통해 "앞서 말씀하신 것처럼..."과 같은 참조가 가능해진다.

### 컨텍스트 윈도우 초과 대응

대화가 길어지면 전체 이력이 모델의 컨텍스트 윈도우를 초과할 수 있다. 이를 방지하는 전략은 세 가지다.

**슬라이딩 윈도우**: 최근 N턴만 유지한다. 구현이 단순하지만 오래된 정보를 잃는다.

**요약 압축**: 오래된 이력을 AI가 요약해 압축한 후 새 이력의 시작에 붙인다. 정보 손실을 최소화할 수 있다.

**토큰 기반 트리밍**: 실제 토큰 수를 계산해 한계에 가까워지면 이력을 정리한다. 가장 정확하지만 토크나이저가 필요하다.

```python
def trim_history(history: list[dict], max_turns: int = 20) -> list[dict]:
    if len(history) <= max_turns * 2:
        return history
    # 시스템 지시 쌍은 항상 유지, 최근 N턴 보존
    return history[-(max_turns * 2):]
```

## 스트리밍 응답 구현

긴 응답을 기다리는 것은 사용자 경험에 치명적이다. SSE(Server-Sent Events)를 활용한 스트리밍으로 응답이 생성되는 즉시 화면에 표시한다.

```python
import anthropic

client = anthropic.Anthropic()

def stream_chat(messages: list[dict], system: str):
    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=system,
        messages=messages,
    ) as stream:
        for text_chunk in stream.text_stream:
            yield text_chunk

# FastAPI 예시
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream(request: dict):
    def generate():
        for chunk in stream_chat(request["messages"], request["system"]):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

프론트엔드에서는 `EventSource` API 또는 `fetch` with `ReadableStream`으로 스트림을 소비한다.

## RAG 연동: 도메인 지식 주입

일반 LLM은 회사 내부 문서나 최신 정보를 모른다. 이를 해결하려면 사용자 질문과 관련된 문서를 벡터 검색으로 찾아 프롬프트에 주입하는 RAG 패턴을 사용한다.

```python
def build_rag_messages(
    user_query: str,
    history: list[dict],
    retrieved_docs: list[str],
) -> list[dict]:
    context = "\n\n---\n\n".join(retrieved_docs)
    augmented_query = (
        f"참고 문서:\n{context}\n\n"
        f"질문: {user_query}"
    )
    return history + [{"role": "user", "content": augmented_query}]
```

검색된 문서를 사용자 메시지 앞에 배치하는 것이 핵심이다. 시스템 프롬프트에 넣는 것보다 실제 질문과 가까운 위치에 두는 편이 어텐션 효과가 더 좋다.

![대화 처리 플로우](/assets/posts/app-chatbot-design-flow.svg)

## 안전 필터와 가드레일

프로덕션 챗봇에는 반드시 안전 레이어가 필요하다. 입력 단계와 출력 단계 두 곳에 적용한다.

**입력 필터**: 스팸, 악성 프롬프트 인젝션, 과도한 길이를 차단한다. 시스템 프롬프트에서 규칙을 명시하는 것이 첫 번째 방어선이다.

**출력 필터**: LLM 응답에서 개인정보(이메일, 전화번호), 내부 시스템 정보 유출 여부를 정규식이나 2차 LLM 검사로 확인한다.

```python
import re

SENSITIVE_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"  # 이메일
    r"|\b\d{3}-\d{3,4}-\d{4}\b"  # 전화번호
)

def filter_response(text: str) -> str:
    return SENSITIVE_PATTERN.sub("[REDACTED]", text)
```

## 세션 관리와 멀티테넌시

여러 사용자의 대화를 격리하려면 세션 ID 기반 관리가 필수다.

```python
import uuid
from redis import Redis

redis = Redis()

def get_session(session_id: str) -> list[dict]:
    data = redis.get(f"chat:{session_id}")
    return json.loads(data) if data else []

def save_session(session_id: str, history: list[dict], ttl: int = 3600):
    redis.setex(f"chat:{session_id}", ttl, json.dumps(history, ensure_ascii=False))

def new_session() -> str:
    return str(uuid.uuid4())
```

Redis의 `setex`로 TTL을 설정하면 오래된 세션이 자동으로 만료된다. 이력 저장에는 PostgreSQL의 JSONB 컬럼을 사용하면 영구 보관과 검색이 가능하다.

## 프로덕션 체크리스트

서비스를 출시하기 전에 확인해야 할 항목들이다.

**성능**: LLM API 호출 레이턴시가 P99 기준 3초를 초과하면 스트리밍이 필수다. 캐싱 레이어(의미론적으로 동일한 질문)도 고려한다.

**비용**: 모델 선택이 비용의 90%를 결정한다. Claude Haiku, GPT-4o mini처럼 빠르고 저렴한 모델을 기본으로 사용하고, 복잡한 질문에만 큰 모델을 라우팅한다.

**신뢰성**: API 타임아웃(30초), 재시도(지수 백오프, 최대 3회), 폴백 메시지를 구현한다.

**모니터링**: 응답 레이턴시, 토큰 사용량, 사용자 만족도(thumbs up/down), 에러율을 추적한다.

---

**지난 글:** [AI로 코드 리뷰하기: 자동화와 사람 리뷰의 균형](/posts/ai-coding-review/)

**다음 글:** [문서 Q&A 시스템 구축: RAG 기반 PDF·문서 검색](/posts/app-document-qa/)

<br>
읽어주셔서 감사합니다. 😊
