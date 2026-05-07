---
title: "WordPiece: BERT의 서브워드 토크나이저"
description: "WordPiece가 언어 모델 우도를 기준으로 서브워드를 병합하는 원리, BPE와의 핵심 차이, ## 접두사 표기법, 그리고 BERT에서의 실전 사용법을 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["WordPiece", "BERT", "토크나이저", "서브워드", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/tokenizer-bpe/)에서 BPE가 빈도 기반 병합으로 어휘를 구축하는 방법을 살펴봤다. 이번에는 같은 서브워드 계열이지만 병합 기준이 근본적으로 다른 **WordPiece**를 다룬다. WordPiece는 Google이 2012년 일본어·한국어 음성 인식에서 처음 제안했고, 이후 BERT(2018)에 적용되며 NLP 주류로 자리잡았다. DistilBERT, ELECTRA, mBERT, KoBERT 등 BERT 계열 모델이 모두 WordPiece를 사용한다.

## BPE와 WordPiece의 핵심 차이

두 알고리즘 모두 문자 단위에서 시작해 반복적으로 쌍을 병합하지만, **병합을 선택하는 기준이 다르다**.

- **BPE**: `score(a, b) = count(ab)` — 단순 빈도 최대화
- **WordPiece**: `score(a, b) = P(ab) / (P(a) · P(b))` — 상호 정보량(PMI) 최대화

WordPiece의 기준을 풀어 설명하면: 병합 후 생기는 새 심볼 `ab`의 언어 모델 우도가, 두 심볼이 독립적으로 등장할 때와 비교해 **얼마나 높아지는가**다. 단순히 자주 함께 나오는 쌍이 아니라, 함께 있을 때 **의미적으로 연결이 강한** 쌍을 우선 병합한다.

예를 들어 "en"은 빈도가 매우 높지만 "un"+"known" → "unknown"처럼 의미 단위 조합의 PMI가 더 높을 수 있다. 결과적으로 WordPiece는 언어학적으로 더 자연스러운 서브워드를 생성하는 경향이 있다.

![WordPiece vs BPE 병합 기준 비교](/assets/posts/tokenizer-wordpiece-compare.svg)

## ## 접두사: WordPiece의 시각적 특징

WordPiece 결과물의 가장 눈에 띄는 특징은 **`##` 접두사**다. 단어의 첫 번째 서브워드를 제외한 나머지 서브워드 앞에 `##`를 붙여 단어 내부 조각임을 표시한다.

```
"unaffable" → ["un", "##aff", "##able"]
"tokenization" → ["token", "##ization"]
"playing" → ["play", "##ing"]
```

BPE가 단어 끝에 `</w>`를 붙이는 것과 반대 방향이다. 이 표기법 덕분에 `"ing"`(독립 단어)과 `"##ing"`(접미사)를 구분할 수 있다.

## 최장 일치 인코딩

WordPiece의 인코딩(추론) 방식도 BPE와 다르다. BPE는 학습된 병합 규칙을 순서대로 적용하는 반면, WordPiece는 **최장 일치(Longest Match First)** 방식으로 왼쪽에서 오른쪽으로 탐욕적으로 분할한다:

```python
def wordpiece_encode(word, vocab):
    """최장 일치로 단어를 서브워드 시퀀스로 분할"""
    tokens = []
    start = 0
    while start < len(word):
        end = len(word)
        cur_substr = None
        while start < end:
            substr = word[start:end]
            if start > 0:
                substr = '##' + substr
            if substr in vocab:
                cur_substr = substr
                break
            end -= 1
        if cur_substr is None:
            return ['[UNK]']  # 어휘에 없으면 전체를 UNK로
        tokens.append(cur_substr)
        start = end
    return tokens
```

이 방식의 특성상 단어가 어휘에 전혀 없는 조각을 포함하면 `[UNK]`가 된다. BPE가 바이트 레벨에서 OOV를 완전히 없앤 것과 달리, WordPiece는 여전히 `[UNK]`가 발생할 수 있다는 약점이 있다.

## BERT의 특수 토큰

BERT WordPiece는 일반 토큰 외에 모델 구조에 필수적인 특수 토큰을 정의한다:

| 토큰 | ID | 역할 |
|-----|-----|-----|
| `[PAD]` | 0 | 배치 패딩 |
| `[UNK]` | 100 | 어휘 외 토큰 |
| `[CLS]` | 101 | 문장 시작 / 분류 토큰 |
| `[SEP]` | 102 | 문장 구분 / 종료 |
| `[MASK]` | 103 | MLM 마스킹 토큰 |

`[CLS]` 토큰의 최종 hidden state가 문장 전체의 표현으로 분류 태스크에 사용된다. `[SEP]`은 두 문장을 구분하거나 문장 끝을 표시한다.

## 실전: HuggingFace BERT 토크나이저

![BERT WordPiece 토크나이저 코드 예시](/assets/posts/tokenizer-wordpiece-bert.svg)

```python
from transformers import BertTokenizer

tokenizer = BertTokenizer.from_pretrained("klue/bert-base")  # 한국어 BERT

text = "토크나이저는 텍스트를 서브워드로 분해한다."
tokens = tokenizer.tokenize(text)
print(tokens)
# ['토크', '##나이', '##저', '##는', '텍스트', '##를', '서브', '##워드', '##로',
#  '분해', '##한다', '.']
```

한국어는 한 음절 단위가 WordPiece의 기본 단위가 되는 경우가 많아, 한국어 특화 학습 없이는 대부분의 음절이 분리된다. KLUE BERT, KoBERT 등은 한국어 텍스트로 어휘를 별도 학습해 이 문제를 완화했다.

## WordPiece의 한계와 현재

WordPiece는 GPT 계열의 Byte-Level BPE에 비해 두 가지 약점이 있다. 첫째, 어휘에 없는 바이트 조합이 `[UNK]`가 될 수 있다. 둘째, 학습 과정이 BPE보다 느리다(우도 계산 필요). 이 때문에 GPT-4, LLaMA 3 등 최신 생성 모델은 모두 BPE를 택했고, WordPiece는 BERT 계열 인코더 모델에서 주로 남아 있다.

다음 글에서는 언어에 완전히 구애받지 않는 방식으로 설계된 SentencePiece를 다룬다.

---

**지난 글:** [BPE: 바이트 쌍 인코딩 토크나이저](/posts/tokenizer-bpe/)

**다음 글:** [SentencePiece: 언어에 구애받지 않는 토크나이저](/posts/tokenizer-sentencepiece/)

<br>
읽어주셔서 감사합니다. 😊
