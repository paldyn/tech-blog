---
title: "토크나이저와 토큰: LLM이 텍스트를 보는 방법"
description: "LLM이 텍스트를 정수 ID 시퀀스로 변환하는 토크나이저의 개념, 토큰의 정의, 특수 토큰, 언어별 토큰 효율 차이를 코드와 함께 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["토크나이저", "토큰", "BPE", "LLM", "NLP", "한국어"]
featured: false
draft: false
---

[지난 글](/posts/transformer-moe/)에서 MoE가 희소 활성화로 거대 모델을 효율적으로 만드는 방법을 살펴봤다. 이제 시선을 바꿔, LLM에 텍스트가 **어떻게 입력되는지** 가장 근본적인 질문부터 시작한다. LLM은 문자열을 직접 처리하지 않는다. 텍스트를 정수 ID의 시퀀스로 변환한 뒤에야 임베딩 레이어를 통해 모델에 들어간다. 이 변환을 담당하는 것이 **토크나이저(Tokenizer)**다.

## 토크나이저가 없던 시절

초기 NLP 모델은 문자 단위(character-level) 또는 단어 단위(word-level) 분할을 썼다. 문자 단위는 어휘 크기가 작지만(~100) 시퀀스가 길어 학습이 어렵다. 단어 단위는 직관적이지만 어휘 크기가 수십만 이상으로 커지고, OOV(Out-of-Vocabulary) 문제가 심각하다. "GPT-4"처럼 본 적 없는 단어나 오타에 취약하다.

**서브워드(Subword) 토크나이저**는 이 두 극단의 중간을 찾는다. 자주 등장하는 글자 조합은 하나의 토큰으로, 드문 단어는 더 작은 조각으로 분해한다. 어휘 크기 3만~15만 정도에서 대부분의 텍스트를 효율적으로 표현할 수 있다.

## 토큰이란 무엇인가

토큰은 서브워드 단위의 텍스트 조각이다. 영어에서는 대략 단어의 75%가 하나의 토큰에 대응한다. 긴 단어, 전문 용어, 코드, 특수문자는 여러 토큰으로 분해된다.

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")  # GPT-4 기준

# 단순 영어 단어
print(enc.encode("cat"))         # [9336]   — 1토큰
print(enc.encode("category"))    # [5639]   — 1토큰
print(enc.encode("categorization"))  # [3, 23491, 2065]  — 3토큰

# 코드는 상대적으로 효율적
print(enc.encode("def forward(self):"))  # 5토큰

# 숫자는 다양
print(enc.encode("2024"))   # [2366]     — 1토큰
print(enc.encode("20243"))  # [2366, 18]  — 2토큰
```

![텍스트→토큰→ID 변환 파이프라인](/assets/posts/tokenizer-and-tokens-pipeline.svg)

## 어휘(Vocabulary)

어휘는 토크나이저가 알고 있는 모든 토큰의 집합이다. 각 토큰에는 고유한 정수 ID가 부여된다. 모델의 임베딩 행렬 크기가 곧 어휘 크기(`vocab_size × d_model`)이므로, 어휘가 클수록 표현력이 높지만 파라미터와 메모리가 증가한다.

| 모델 | 어휘 크기 | 토크나이저 |
|------|---------|---------|
| GPT-2 | 50,257 | BPE |
| LLaMA 2 | 32,000 | SentencePiece BPE |
| GPT-4 (cl100k) | 100,277 | tiktoken BPE |
| LLaMA 3 | 128,256 | tiktoken BPE |
| GPT-4o (o200k) | 200,019 | tiktoken BPE |
| EXAONE (LG) | 102,400 | BPE |

한국어·중국어·일본어 비중이 높은 모델은 더 큰 어휘가 유리하다. LLaMA 3의 어휘(128K)는 LLaMA 2(32K)의 4배로 다국어 효율이 크게 향상됐다.

## 특수 토큰

일반 텍스트 토큰 외에도 토크나이저는 제어 목적의 특수 토큰을 정의한다:

```python
# LLaMA 3 특수 토큰 예시
tokenizer.bos_token    # "<|begin_of_text|>"   — 문장 시작
tokenizer.eos_token    # "<|end_of_text|>"     — 문장 끝
tokenizer.pad_token    # 배치 패딩
# 채팅 템플릿 토큰
"<|start_header_id|>"  # 역할 헤더 시작
"<|end_header_id|>"    # 역할 헤더 끝
"<|eot_id|>"           # 턴 종료
```

특수 토큰은 모델이 구조화된 대화, 멀티턴 채팅, 도구 호출 등을 구분하는 데 사용된다. 잘못된 특수 토큰 처리는 모델이 생성을 멈추지 않거나(EOS 누락), 역할 구분이 깨지는 문제를 일으킨다.

## 한국어 토큰 효율

한국어는 교착어로 조사와 어미가 단어에 결합하며, 음절 기반 구조가 영어와 다르다. 대부분의 BPE 토크나이저는 영어 텍스트로 주로 학습되어 한국어를 처리할 때 비효율적이다.

![tiktoken으로 언어별 토큰 효율 비교](/assets/posts/tokenizer-and-tokens-code.svg)

같은 의미의 문장이라도 한국어는 영어보다 2~4배 많은 토큰을 소비할 수 있다. 이는 한국어 사용자에게 두 가지 비용을 의미한다. 첫째, 컨텍스트 윈도우를 더 빨리 소진한다. 둘째, API 비용이 더 든다(대부분의 LLM API가 토큰 수 기준 과금).

한국어 특화 모델(HyperCLOVA X, EXAONE, SOLAR, Qwen2 등)은 한국어 서브워드를 어휘에 충분히 포함해 이 비효율을 줄인다.

## 토크나이저의 한계

토크나이저는 완벽하지 않다. 대표적 한계:

- **산술 오류의 원인**: "1234"가 하나의 토큰이고 "12345"가 두 토큰이라면, 모델이 수 계산을 배우기 어렵다. 자릿수가 일관되게 분리되지 않기 때문이다.
- **역할 누수**: 특수 토큰이 포함된 입력을 제대로 이스케이프하지 않으면 프롬프트 인젝션 위험이 있다.
- **공백 민감성**: "Hello"와 " Hello"(앞 공백)는 서로 다른 토큰이다. 이는 모델이 공백에 예민하게 반응하는 원인이다.

```python
enc = tiktoken.get_encoding("cl100k_base")
print(enc.encode("Hello"))    # [9906]
print(enc.encode(" Hello"))   # [22691]  — 다른 토큰!
```

다음 글에서는 가장 널리 쓰이는 서브워드 알고리즘인 BPE(Byte Pair Encoding)의 작동 원리를 상세히 살펴본다.

---

**지난 글:** [Mixture of Experts: 희소 활성화로 거대 모델 만들기](/posts/transformer-moe/)

**다음 글:** [BPE: 바이트 쌍 인코딩 토크나이저](/posts/tokenizer-bpe/)

<br>
읽어주셔서 감사합니다. 😊
