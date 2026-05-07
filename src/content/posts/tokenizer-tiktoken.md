---
title: "tiktoken: OpenAI의 빠른 BPE 토크나이저"
description: "tiktoken이 Rust로 구현한 고속 BPE 엔진으로 cl100k_base, o200k_base 인코딩을 지원하며 실제 LLM 앱에서 토큰 수 계산, 컨텍스트 관리, 배치 인코딩에 어떻게 활용되는지 완전히 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["tiktoken", "토크나이저", "BPE", "OpenAI", "GPT-4", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/tokenizer-sentencepiece/)에서 SentencePiece가 언어 독립적으로 원시 텍스트를 처리하는 방법을 살펴봤다. 이번에는 OpenAI가 개발하고 오픈소스로 공개한 **tiktoken**을 다룬다. tiktoken은 GPT-4, GPT-4o, ChatGPT 등 OpenAI 모델이 내부적으로 사용하는 BPE 토크나이저의 Python 바인딩이다. 핵심 연산이 Rust로 구현되어 순수 Python BPE 대비 5~10배 빠른 속도를 자랑하며, LLM 앱을 개발할 때 토큰 수 추정, 컨텍스트 관리, 비용 최적화에 필수적으로 쓰인다.

## 왜 tiktoken인가

LLM API를 사용하는 모든 앱은 두 가지 문제를 반드시 해결해야 한다.

**토큰 수 계산**: 대부분의 API는 입력+출력 토큰 수에 비례해 과금한다. 요청을 보내기 전에 토큰 수를 예측하지 않으면 비용 추정이 불가능하다.

**컨텍스트 윈도우 관리**: 모델마다 최대 컨텍스트(4K~200K 토큰)가 있다. 긴 문서를 처리할 때 이 한계를 넘지 않도록 텍스트를 자르거나 요약해야 한다.

tiktoken은 이 두 가지를 정확하고 빠르게 수행한다. HuggingFace tokenizers도 빠르지만, OpenAI API와 완전히 동일한 인코딩을 재현하려면 tiktoken이 필수다.

## 설치와 기본 사용

```bash
pip install tiktoken
```

```python
import tiktoken

# 방법 1: 모델 이름으로 인코딩 자동 선택
enc = tiktoken.encoding_for_model("gpt-4o")

# 방법 2: 인코딩 이름 직접 지정
enc = tiktoken.get_encoding("o200k_base")

text = "tiktoken은 매우 빠릅니다."
ids = enc.encode(text)
print(ids)         # [83, 1609, 2963, 374, ...]
print(len(ids))    # 토큰 수

decoded = enc.decode(ids)
print(decoded)     # "tiktoken은 매우 빠릅니다."
```

## 인코딩 종류와 모델 매핑

![tiktoken 인코딩별 특성 비교](/assets/posts/tokenizer-tiktoken-encodings.svg)

핵심은 **같은 텍스트라도 인코딩이 다르면 토큰 ID가 다르다**는 점이다. `cl100k_base`의 ID 1234와 `o200k_base`의 ID 1234는 전혀 다른 토큰을 가리킨다. API를 바꿀 때 반드시 인코딩을 함께 교체해야 한다.

## 실전 활용 패턴

![tiktoken 실전 활용 코드](/assets/posts/tokenizer-tiktoken-code.svg)

가장 많이 쓰이는 세 가지 패턴이다:

**패턴 1: 토큰 수 계산**

```python
import tiktoken

def num_tokens_from_messages(messages, model="gpt-4o"):
    enc = tiktoken.encoding_for_model(model)
    # 채팅 API 오버헤드: 메시지당 3 + 응답 프라이머 3
    total = 3
    for msg in messages:
        total += 3  # role + content + separator
        for key, value in msg.items():
            total += len(enc.encode(value))
            if key == "name":
                total += 1  # name이 있으면 role 생략 → -1 + 1
    return total
```

**패턴 2: 안전한 텍스트 자르기**

단순히 `text[:n]`으로 자르면 멀티바이트 유니코드 문자(한국어 등)가 깨진다. tiktoken으로 토큰 단위로 자르면 안전하다.

```python
def safe_truncate(text: str, max_tokens: int, model="gpt-4o") -> str:
    enc = tiktoken.encoding_for_model(model)
    ids = enc.encode(text)
    if len(ids) <= max_tokens:
        return text
    return enc.decode(ids[:max_tokens])
```

**패턴 3: 특수 토큰 처리**

채팅 완성 API의 내부 포맷(`<|im_start|>`, `<|im_end|>`)을 파싱해야 할 때:

```python
enc = tiktoken.get_encoding("o200k_base")
# 특수 토큰을 허용해서 인코딩
ids = enc.encode(
    "<|im_start|>user\nHello<|im_end|>",
    allowed_special={"<|im_start|>", "<|im_end|>"}
)
```

기본적으로 특수 토큰은 허용 목록에 명시하지 않으면 오류가 발생한다. 이는 프롬프트 인젝션을 방지하기 위한 안전장치다.

## cl100k_base vs o200k_base

GPT-4와 GPT-4o의 인코딩 차이는 단순히 어휘 크기뿐이 아니다. 정규식 패턴도 다르다. `cl100k_base`는 소문자 단어와 대문자 단어를 별도 토큰으로 처리하는 반면, `o200k_base`는 수치 데이터, 코드, 다국어 문자에 최적화된 패턴을 사용한다.

```python
cl100k = tiktoken.get_encoding("cl100k_base")
o200k = tiktoken.get_encoding("o200k_base")

text = "서울特별시 Tokyo 2024年"
print(f"cl100k: {len(cl100k.encode(text))}토큰")  # 예: 14토큰
print(f"o200k:  {len(o200k.encode(text))}토큰")   # 예: 9토큰 (더 효율적)
```

o200k는 한자, 한글, 일본어를 더 큰 단위로 묶어 아시아 언어 효율이 약 30~50% 향상됐다.

## 속도 비교

```python
import time, tiktoken
from transformers import AutoTokenizer

enc = tiktoken.get_encoding("cl100k_base")
hf_tok = AutoTokenizer.from_pretrained("gpt2")
text = "Hello world " * 10000  # ~20K 단어

t0 = time.time(); enc.encode_batch([text]*100); print(f"tiktoken: {time.time()-t0:.2f}s")
t0 = time.time(); hf_tok([text]*100); print(f"HF fast:  {time.time()-t0:.2f}s")
# tiktoken이 약 2~5배 빠름 (Rust 멀티스레드)
```

LLM 앱에서 수백만 토큰을 처리해야 하는 전처리 파이프라인이라면 tiktoken의 속도 이점이 유의미하다. 다음 글부터는 토크나이저를 통해 처리된 토큰들이 모델에서 어떻게 고차원 벡터로 표현되는지, 임베딩의 세계로 들어간다.

---

**지난 글:** [SentencePiece: 언어에 구애받지 않는 토크나이저](/posts/tokenizer-sentencepiece/)

**다음 글:** [임베딩 기초: 단어를 벡터 공간에 배치하다](/posts/embedding-basics/)

<br>
읽어주셔서 감사합니다. 😊
