---
title: "컨텍스트 관리: 긴 대화에서 LLM이 기억을 유지하는 방법"
description: "컨텍스트 윈도우 한계, 슬라이딩 윈도우·요약 압축·외부 메모리·계층적 요약 4가지 전략, Prompt Caching 비용 절감, Lost-in-the-Middle 문제, 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["컨텍스트관리", "프롬프트엔지니어링", "LLM", "PromptCaching", "메모리", "슬라이딩윈도우", "요약압축", "RAG"]
featured: false
draft: false
---

[지난 글](/posts/prompt-injection-defense/)에서 외부 입력이 LLM을 오염시키는 프롬프트 인젝션과 방어법을 다뤘다. 이번 글에서는 다른 도전 과제를 살펴본다. 대화가 길어지거나 큰 문서를 처리할 때, **컨텍스트 윈도우(Context Window)**라는 물리적 한계에 부딪힌다. LLM은 이 창 밖의 내용은 "기억"하지 못한다. 이 한계를 극복하는 네 가지 전략과 실전 구현을 정리한다.

## 컨텍스트 윈도우란

LLM은 처리할 수 있는 토큰 수에 상한이 있다. 이를 **컨텍스트 윈도우**라 한다. 2024~2025년 기준 주요 모델의 컨텍스트 크기는 다음과 같다.

| 모델 | 컨텍스트 크기 |
|---|---|
| GPT-4o | 128K 토큰 |
| Claude 3.5 Sonnet | 200K 토큰 |
| Claude 3.7 Sonnet | 200K 토큰 |
| Gemini 1.5 Pro | 1M 토큰 |
| Gemini 2.0 | 2M 토큰 |

200K 토큰은 약 15만 단어, 중간 분량의 소설 한 권에 해당한다. 하지만 장기 서비스나 수백 개의 문서를 다루는 에이전트에서는 여전히 부족하다.

## 4가지 컨텍스트 관리 전략

![컨텍스트 윈도우 관리 전략 4가지](/assets/posts/prompt-context-management-strategies.svg)

### 전략 1: 슬라이딩 윈도우

가장 단순한 방법. 최근 N턴만 유지하고 이전 대화는 버린다.

```python
from collections import deque
import anthropic

client = anthropic.Anthropic()

class SlidingWindowChat:
    def __init__(self, window_size: int = 10, system: str = ""):
        self.window = deque(maxlen=window_size * 2)  # user+assistant 쌍
        self.system = system

    def chat(self, user_message: str) -> str:
        self.window.append({"role": "user", "content": user_message})

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=self.system,
            messages=list(self.window),
        )
        assistant_msg = response.content[0].text
        self.window.append({"role": "assistant", "content": assistant_msg})
        return assistant_msg

bot = SlidingWindowChat(window_size=5)
print(bot.chat("안녕하세요, 파이썬을 배우고 싶어요."))
print(bot.chat("리스트와 튜플의 차이가 뭔가요?"))
```

**언제 쓸까**: 일반 챗봇, 단기 고객 지원. 각 턴이 이전 맥락에 크게 의존하지 않는 경우.

### 전략 2: 요약 압축

오래된 대화를 LLM이 요약해 압축 보관한다. 세부 정보는 일부 유실되지만 핵심 맥락은 유지된다.

```python
class SummarizingChat:
    def __init__(
        self,
        recent_turns: int = 6,
        summarize_threshold: int = 20,
        system: str = "",
    ):
        self.recent: list[dict] = []
        self.summary: str = ""
        self.total_turns = 0
        self.recent_turns = recent_turns
        self.summarize_threshold = summarize_threshold
        self.system = system

    def _summarize_old(self) -> None:
        """오래된 대화를 요약"""
        old_messages = self.recent[:-self.recent_turns]
        if not old_messages:
            return

        summary_prompt = f"""이전 대화 내용을 3~5문장으로 핵심만 요약하세요.

기존 요약:
{self.summary}

새로운 대화:
{self._format_messages(old_messages)}

통합 요약:"""

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": summary_prompt}]
        )
        self.summary = response.content[0].text
        self.recent = self.recent[-self.recent_turns:]

    def _format_messages(self, messages: list[dict]) -> str:
        return "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        )

    def chat(self, user_message: str) -> str:
        self.recent.append({"role": "user", "content": user_message})
        self.total_turns += 1

        if self.total_turns % self.summarize_threshold == 0:
            self._summarize_old()

        # 요약을 시스템 메시지에 포함
        full_system = self.system
        if self.summary:
            full_system += f"\n\n이전 대화 요약:\n{self.summary}"

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=full_system,
            messages=self.recent,
        )
        assistant_msg = response.content[0].text
        self.recent.append({"role": "assistant", "content": assistant_msg})
        return assistant_msg
```

### 전략 3: 외부 메모리 (RAG Memory)

대화 내용을 벡터 DB에 저장하고, 새 질문과 유사한 과거 대화를 검색해 컨텍스트로 주입한다. 이론상 무한한 기억이 가능하다.

```python
# 벡터 DB로 메모리 관리 (실 구현에서는 pgvector, Chroma, Pinecone 사용)
from dataclasses import dataclass
from datetime import datetime

@dataclass
class MemoryEntry:
    content: str
    timestamp: datetime
    embedding: list[float]
    turn_id: str

class VectorMemoryChat:
    def __init__(self, vector_store, embed_model):
        self.vector_store = vector_store
        self.embed_model = embed_model
        self.recent: list[dict] = []  # 최근 4턴은 항상 포함

    def _embed(self, text: str) -> list[float]:
        return self.embed_model.encode(text).tolist()

    def _save_turn(self, role: str, content: str) -> None:
        embedding = self._embed(content)
        entry = MemoryEntry(
            content=f"{role}: {content}",
            timestamp=datetime.now(),
            embedding=embedding,
            turn_id=f"{role}_{datetime.now().timestamp()}"
        )
        self.vector_store.upsert(entry)

    def _retrieve_relevant(self, query: str, top_k: int = 3) -> list[str]:
        query_emb = self._embed(query)
        results = self.vector_store.search(query_emb, top_k=top_k)
        return [r.content for r in results]

    def chat(self, user_message: str) -> str:
        relevant = self._retrieve_relevant(user_message)
        memory_context = "\n".join(relevant) if relevant else ""

        messages = self.recent[-4:].copy()
        if memory_context:
            messages[0]["content"] = (
                f"[관련 이전 대화]\n{memory_context}\n\n"
                f"[현재 질문]\n{user_message}"
            )

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            messages=messages + [{"role": "user", "content": user_message}]
        )
        answer = response.content[0].text
        self._save_turn("user", user_message)
        self._save_turn("assistant", answer)
        return answer
```

### 전략 4: Prompt Caching으로 비용 절감

긴 문서를 반복적으로 참조할 때는 **Prompt Caching**이 결정적으로 효과적이다.

![Prompt Caching으로 컨텍스트 비용 절감](/assets/posts/prompt-context-management-code.svg)

```python
def qa_with_cache(document: str, questions: list[str]) -> list[str]:
    """긴 문서를 캐시하고 여러 질문에 재사용"""
    answers = []
    for q in questions:
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": document,
                        "cache_control": {"type": "ephemeral"}
                    },
                    {"type": "text", "text": q}
                ]
            }]
        )
        answers.append(resp.content[0].text)
        # 첫 호출 후 document 부분은 캐시됨 → 이후 질문은 비용 90% 절감
    return answers

# 100페이지 계약서에 대해 10가지 질문 → 첫 질문만 전체 비용, 나머지는 ~10%
contract = open("contract.txt").read()
questions = ["면책 조항이 있나요?", "계약 기간은?", "위약금 조항은?"]
answers = qa_with_cache(contract, questions)
```

## "Lost in the Middle" 문제

Liu et al. 2023 연구에서 **"Lost in the Middle"** 현상이 발견됐다. 긴 컨텍스트에서 LLM은 **처음과 끝 부분의 정보를 더 잘 기억**하고 중간 부분은 상대적으로 무시한다.

```python
def arrange_for_attention(docs: list[str], query: str) -> list[str]:
    """Lost-in-the-Middle 최소화 배열"""
    if not docs:
        return docs

    # 가장 관련성 높은 문서를 처음과 끝에 배치
    # 나머지는 중간에 (덜 중요한 것)
    most_relevant = docs[0]
    second_most = docs[1] if len(docs) > 1 else None
    rest = docs[2:]

    if second_most:
        return [most_relevant] + rest + [second_most]
    return [most_relevant] + rest
```

컨텍스트 관리는 LLM 애플리케이션의 성능과 비용 모두에 직접 영향을 미친다. 서비스 특성에 맞는 전략을 선택하고, Prompt Caching을 적극 활용하면 품질을 유지하면서 비용을 크게 줄일 수 있다.

---

**지난 글:** [프롬프트 인젝션 방어: LLM 보안의 첫 번째 전선](/posts/prompt-injection-defense/)

**다음 글:** [프롬프트 버전 관리: 프롬프트를 코드처럼 관리하기](/posts/prompt-versioning/)

<br>
읽어주셔서 감사합니다. 😊
