---
title: "BPE: 바이트 쌍 인코딩 토크나이저"
description: "BPE(Byte Pair Encoding)가 말뭉치에서 가장 빈번한 인접 바이트 쌍을 반복 병합해 서브워드 어휘를 구축하는 알고리즘과 학습·인코딩 과정을 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["BPE", "토크나이저", "서브워드", "GPT", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/tokenizer-and-tokens/)에서 토크나이저가 텍스트를 정수 ID로 변환하는 개념을 살펴봤다. 이번에는 GPT 시리즈, LLaMA, Mistral 등 현대 LLM 대부분이 채택한 서브워드 알고리즘인 **BPE(Byte Pair Encoding)**의 작동 원리를 상세히 해부한다. BPE는 원래 데이터 압축 알고리즘이었는데, 2016년 Sennrich et al.이 NLP에 적용하면서 서브워드 토크나이저의 기준이 됐다.

## BPE의 핵심 아이디어

BPE는 두 단계로 나뉜다.

**학습(Training)**: 말뭉치를 문자 단위로 분해한 뒤, 가장 자주 등장하는 인접 심볼 쌍을 반복적으로 하나의 새 심볼로 병합한다. 이를 지정한 횟수(num_merges) 또는 어휘 크기 목표에 도달할 때까지 반복한다. 병합 규칙 목록이 학습 결과물이다.

**인코딩(Encoding)**: 새 텍스트가 들어오면, 문자 단위로 분해한 후 학습된 병합 규칙을 순서대로 적용해 가능한 한 큰 단위로 합친다.

자주 쓰이는 단어(예: "the", "is")는 통째로 하나의 토큰이 되고, 드문 단어(예: "tokenization")는 여러 서브워드로 분해된다.

## 단계별 알고리즘

말뭉치에 "low"(5회), "lower"(2회), "newest"(6회), "widest"(3회)가 있다고 가정한다. 먼저 모든 단어를 문자 단위로 분해하고 단어 경계 마커 `</w>`를 추가한다.

```
l o w </w>      × 5
l o w e r </w>  × 2
n e w e s t </w>× 6
w i d e s t </w>× 3
```

![BPE 병합 알고리즘 단계별 시각화](/assets/posts/tokenizer-bpe-algorithm.svg)

각 병합 후 어휘가 확장된다. `num_merges=10000`이면 최종 어휘에 "lowest", "newest", "widest" 같은 완전한 단어도 포함될 수 있다.

## 구현 코드

![BPE 학습 루프 구현](/assets/posts/tokenizer-bpe-code.svg)

실제 구현에서는 `merge_vocab` 함수가 기존 어휘 내 모든 단어 표현에서 선택된 쌍을 새 심볼로 교체한다:

```python
import re

def merge_vocab(vocab, pair):
    """어휘 내 모든 단어에서 best pair를 병합"""
    new_vocab = {}
    # 쌍을 정규식 패턴으로 변환
    pattern = re.escape(' '.join(pair))
    replacement = ''.join(pair)
    for word, freq in vocab.items():
        # word는 공백으로 구분된 심볼 시퀀스
        new_word = re.sub(pattern, replacement, word)
        new_vocab[new_word] = freq
    return new_vocab

# 초기 어휘: 각 단어를 공백으로 구분된 문자 시퀀스로 표현
vocab = {
    'l o w </w>': 5,
    'l o w e r </w>': 2,
    'n e w e s t </w>': 6,
    'w i d e s t </w>': 3,
}

merges = bpe_train(vocab, num_merges=10)
# merges: [('e','s'), ('es','t'), ('l','o'), ('lo','w'), ...]
```

## 인코딩(추론 시 적용)

학습된 병합 규칙을 새 텍스트에 적용할 때는 규칙 순서가 중요하다. 먼저 학습된 순서(빈도가 높았던 순서)대로 병합을 시도한다:

```python
def encode(text, merges):
    """학습된 병합 규칙으로 텍스트를 토큰 시퀀스로 변환"""
    # 1. 문자 단위 분해 + 단어 경계 추가
    words = text.split()
    tokens = [list(w) + ['</w>'] for w in words]

    # 2. 병합 규칙을 순서대로 적용
    for pair in merges:
        tokens = [apply_merge(t, pair) for t in tokens]

    return [tok for word in tokens for tok in word]

def apply_merge(symbols, pair):
    merged = []
    i = 0
    while i < len(symbols):
        if (i < len(symbols) - 1
                and symbols[i] == pair[0]
                and symbols[i+1] == pair[1]):
            merged.append(pair[0] + pair[1])
            i += 2
        else:
            merged.append(symbols[i])
            i += 1
    return merged
```

## Byte-Level BPE: GPT-2의 혁신

GPT-2는 **Byte-Level BPE**를 도입했다. 기존 BPE는 유니코드 문자를 기본 단위로 사용하므로, 훈련 데이터에 없는 문자는 `<UNK>` 처리된다. Byte-Level BPE는 유니코드 문자 대신 **256개 바이트를 기본 어휘**로 사용한다.

```python
# 256개 바이트 어휘 초기화
base_vocab = {bytes([i]).decode('latin-1'): i for i in range(256)}
# 이 위에 BPE 병합을 쌓아올림
```

이로써 OOV가 사실상 불가능해진다. 어떤 유니코드 문자도 바이트 시퀀스로 표현되기 때문이다. GPT-4의 tiktoken, LLaMA 3의 토크나이저 모두 Byte-Level BPE를 사용한다.

## 어휘 크기 선택

어휘 크기는 중요한 하이퍼파라미터다:

| 어휘 크기 | 트레이드오프 |
|---------|-----------|
| 작음 (~10K) | 시퀀스 길이 증가, 알 수 없는 단어 분해 많음 |
| 중간 (~50K) | GPT-2 수준, 영어에 최적화 |
| 큼 (~100K+) | 다국어 효율 향상, 임베딩 행렬 증가 |

한국어 비중이 높은 서비스라면 한국어 텍스트를 충분히 포함한 말뭉치로 BPE를 학습해 어휘에 한국어 서브워드를 풍부하게 포함해야 한다. 다음 글에서는 BERT가 채택한 WordPiece가 BPE와 어떻게 다른지 살펴본다.

---

**지난 글:** [토크나이저와 토큰: LLM이 텍스트를 보는 방법](/posts/tokenizer-and-tokens/)

**다음 글:** [WordPiece: BERT의 서브워드 토크나이저](/posts/tokenizer-wordpiece/)

<br>
읽어주셔서 감사합니다. 😊
