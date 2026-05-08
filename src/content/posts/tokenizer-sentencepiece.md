---
title: "SentencePiece: 언어에 구애받지 않는 토크나이저"
description: "SentencePiece가 공백 사전 분리 없이 원시 유니코드를 직접 처리해 한국어·중국어·일본어 등 어떤 언어도 동일하게 다루는 원리와 커스텀 어휘 학습 방법을 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["SentencePiece", "토크나이저", "다국어", "한국어", "LLaMA", "T5"]
featured: false
draft: false
---

[지난 글](/posts/tokenizer-wordpiece/)에서 WordPiece가 언어 모델 우도를 기준으로 서브워드를 병합하는 방법을 살펴봤다. 이번에는 **SentencePiece**를 다룬다. Google의 Kudo & Richardson이 2018년 발표한 SentencePiece는 BPE나 WordPiece와 알고리즘 자체가 다른 것이 아니라, 텍스트를 **어떻게 전처리하는가**에서 근본적으로 다른 접근을 취한다. T5, LLaMA 2, mT5, ALBERT, XLNet 등 다국어 모델에서 널리 쓰인다.

## 핵심 혁신: 언어 독립적 전처리

기존 토크나이저는 반드시 **사전 토크나이제이션(Pre-tokenization)** 단계가 필요하다. 영어라면 공백으로 단어를 분리하고, 한국어라면 형태소 분석기를 돌리고, 중국어라면 문자 단위로 분리하는 등 언어별로 다른 규칙이 필요하다. 이는 다국어 모델 개발의 큰 장벽이었다.

SentencePiece는 이 단계를 완전히 없앤다. **텍스트를 유니코드 문자의 스트림으로 취급**하고, 공백도 `▁`(U+2581, Lower One Eighth Block) 기호로 치환해 일반 문자처럼 처리한다. 이로써 어떤 언어든 동일한 파이프라인으로 처리할 수 있다.

![SentencePiece 언어 독립 개념](/assets/posts/tokenizer-sentencepiece-concept.svg)

## ▁ 기호의 역할

공백을 `▁`로 치환하면 두 가지 이점이 생긴다.

첫째, 역변환(decode)이 완벽해진다. 토큰 시퀀스를 다시 원래 텍스트로 복원할 때 `▁`를 공백으로 바꾸고 나머지는 그대로 이으면 원본과 동일한 문자열이 나온다.

둘째, 단어 시작을 명시적으로 표시한다. BPE의 `</w>`처럼 단어 경계를 인코딩하되, 접미사가 아닌 접두사로 표시한다.

```python
import sentencepiece as spm

sp = spm.SentencePieceProcessor()
sp.load("llama2.model")  # LLaMA 2 토크나이저

text = "Hello, World!"
tokens = sp.encode(text, out_type=str)
# ['▁Hello', ',', '▁World', '!']

ids = sp.encode(text)
# [15043, 29892, 2787, 29991]

# 완벽한 역변환
decoded = sp.decode(ids)
# "Hello, World!"
assert decoded == text  # True 보장
```

## 알고리즘 선택: BPE vs Unigram

SentencePiece는 두 가지 알고리즘을 지원한다.

**BPE 모드**: 앞 글에서 설명한 바이트 쌍 병합을 사전 분리 없이 유니코드 수준에서 수행한다. LLaMA 2가 이 방식을 사용한다.

**Unigram 모드**: 단순 병합 대신 **최대 우도 추정**으로 어휘를 구축한다. 크고 충분한 초기 어휘에서 시작해 전체 말뭉치의 우도를 가장 적게 손상시키는 토큰을 반복 제거한다. T5, ALBERT, XLNet이 Unigram 모드를 사용한다.

Unigram 인코딩은 Viterbi 알고리즘으로 주어진 어휘에서 최적 분할을 찾는다. 같은 텍스트에도 여러 가능한 분할이 있을 때 가장 높은 확률의 분할을 선택한다. 학습 시 **서브워드 정규화(Subword Regularization)**로 다양한 분할을 샘플링해 데이터 증강 효과도 낼 수 있다.

```python
# Unigram 모드 학습
spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="unigram_model",
    vocab_size=32000,
    model_type="unigram",  # BPE 대신 Unigram
    character_coverage=0.9999,
)
```

## 커스텀 어휘 학습

한국어 전용 LLM을 개발하거나 도메인 특화 어휘가 필요할 때, SentencePiece로 직접 어휘를 학습할 수 있다.

![SentencePiece 학습 및 사용 코드](/assets/posts/tokenizer-sentencepiece-code.svg)

중요한 하이퍼파라미터:

- `character_coverage`: 1.0이면 모든 문자, 0.9999면 99.99% 문자를 커버하는 어휘 구축. 한국어처럼 문자 종류가 많은 언어는 0.9995~0.9999 권장.
- `vocab_size`: 한국어 전용이면 16K~32K, 다국어라면 64K~128K.
- `user_defined_symbols`: 특수 토큰 추가 (`<pad>`, `<unk>` 등).

## 모델별 SentencePiece 어휘

| 모델 | 어휘 크기 | 알고리즘 | 한국어 커버리지 |
|------|---------|---------|-------------|
| T5 | 32,000 | Unigram | 낮음 |
| LLaMA 2 | 32,000 | BPE | 낮음 |
| mT5 | 250,000 | Unigram | 높음 |
| SOLAR 10.7B | 32,000 | BPE | 낮음 |
| EXAONE | 102,400 | BPE | 높음 |

영어 중심으로 학습된 32K 어휘에서 한국어는 음절 단위로 분해되는 경우가 많다. 한국어 서비스 품질을 높이려면 한국어 텍스트를 충분히 포함한 말뭉치로 어휘를 재학습하거나, 처음부터 다국어 어휘를 설계해야 한다.

## HuggingFace 통합

HuggingFace `transformers`에서 SentencePiece 기반 토크나이저를 쓸 때는 `tokenizers` 백엔드에서 자동으로 처리된다:

```python
from transformers import AutoTokenizer

# LLaMA 2 SentencePiece 토크나이저
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")
tokens = tokenizer.tokenize("한국어 처리도 됩니다")
# ['▁한', '국어', '▁처', '리', '도', '▁됩', '니다']  ← 음절 수준 분해

# mT5 (다국어 최적화)
tokenizer = AutoTokenizer.from_pretrained("google/mt5-base")
tokens = tokenizer.tokenize("한국어 처리도 됩니다")
# ['▁한국어', '▁처리도', '▁됩니다']  ← 더 효율적
```

다음 글에서는 OpenAI가 개발한 고속 BPE 구현체인 tiktoken을 살펴본다.

---

**지난 글:** [WordPiece: BERT의 서브워드 토크나이저](/posts/tokenizer-wordpiece/)

**다음 글:** [tiktoken: OpenAI의 빠른 BPE 토크나이저](/posts/tokenizer-tiktoken/)

<br>
읽어주셔서 감사합니다. 😊
