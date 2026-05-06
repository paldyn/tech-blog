---
title: "GPT: 자기회귀적 언어 모델의 진화"
description: "GPT-1부터 GPT-4까지, Decoder-only 트랜스포머가 어떻게 텍스트 생성과 In-Context Learning을 가능하게 했는지, BERT와의 차이를 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["GPT", "트랜스포머", "언어모델", "자기회귀", "생성AI", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-bert/)에서 BERT가 Encoder만으로 양방향 문맥을 학습하는 방법을 살펴봤다. 같은 시기 OpenAI는 반대 방향으로 나아갔다. **Decoder만 사용**해 다음 토큰을 예측하는 자기 회귀(autoregressive) 언어 모델, **GPT**(Generative Pre-trained Transformer)다.

## Decoder-only 구조

GPT는 트랜스포머 Decoder 블록에서 **Cross-Attention을 제거**한 형태다. 각 블록은 두 개의 서브레이어만 갖는다.

1. **Masked Multi-Head Self-Attention** (Causal Mask 항상 적용)  
2. **Feed-Forward Network**

Cross-Attention이 없으니 인코더도 필요 없다. 입력 시퀀스를 조건으로 다음 토큰 확률 분포를 모델링한다.

```
P(w1, w2, ..., wN) = ∏ P(wi | w1, ..., w(i-1))
```

이 자기 회귀 분해가 **무한 길이의 시퀀스 생성**을 이론적으로 가능하게 한다.

![GPT 아키텍처 — Decoder-only 구조](/assets/posts/transformer-gpt-architecture.svg)

## GPT-1: 사전학습 + 파인튜닝 패러다임

GPT-1(2018)은 BooksCorpus로 언어 모델 사전학습을 한 뒤, 태스크별 헤드를 붙여 파인튜닝하는 방식을 제안했다. BERT와 거의 동시기에 나왔지만, BERT가 더 넓은 태스크 커버리지를 보여주며 NLU 분야를 장악했다.

## GPT-2: Zero-shot의 발견

2019년 공개된 GPT-2(1.5B)는 더 다양한 웹 텍스트(WebText)로 학습한 결과, **별도 파인튜닝 없이도** 번역·요약·QA를 수행하는 Zero-shot 능력을 보였다. OpenAI는 '너무 위험하다'는 이유로 초기에 전체 모델 공개를 거부해 화제가 됐다.

```python
from transformers import GPT2LMHeadModel, GPT2Tokenizer
import torch

tokenizer = GPT2Tokenizer.from_pretrained('gpt2')
model     = GPT2LMHeadModel.from_pretrained('gpt2')
model.eval()

prompt = "Artificial intelligence will"
inputs = tokenizer(prompt, return_tensors='pt')

with torch.no_grad():
    output = model.generate(
        **inputs,
        max_new_tokens=50,
        do_sample=True,
        temperature=0.8,
        top_p=0.9,
        repetition_penalty=1.2,
    )
print(tokenizer.decode(output[0], skip_special_tokens=True))
```

## GPT-3: 스케일과 In-Context Learning

2020년 175B 파라미터의 GPT-3가 등장하며 **In-Context Learning(ICL)**이 주목받았다. 프롬프트에 예제를 몇 개 넣어주면(Few-shot), 그래디언트 업데이트 없이 모델이 새로운 태스크에 적응한다.

![GPT 추론 — 자기 회귀 생성과 In-Context Learning](/assets/posts/transformer-gpt-inference.svg)

ICL이 가능한 이유는 GPT-3가 방대한 텍스트에서 "패턴-완성"을 반복 학습했기 때문이다. Few-shot 프롬프트 자체가 암묵적 학습 신호로 작동한다.

## InstructGPT와 RLHF

GPT-3는 강력하지만 유해한 콘텐츠나 지시를 따르지 않는 응답을 생성했다. 2022년 InstructGPT는 **RLHF**(강화 학습 from 인간 피드백)로 GPT-3를 정렬(align)해 지시 따르기와 안전성을 크게 개선했다. ChatGPT는 이 기술의 직접적 산물이다.

## BERT vs GPT 요약

| 구분 | BERT | GPT |
|------|------|-----|
| 아키텍처 | Encoder-only | Decoder-only |
| 어텐션 방향 | 양방향 | 단방향 (Causal) |
| 사전학습 | MLM + NSP | 자기 회귀 LM |
| 강점 | 이해·분류·추출 | 생성·In-Context |
| 대표 태스크 | NER, QA, 분류 | 챗봇, 코드, 번역 |

## GPT 모델 아키텍처 비교

| 모델 | 레이어 | 히든 | 헤드 | 파라미터 |
|------|--------|------|------|---------|
| GPT-1 | 12 | 768 | 12 | 117M |
| GPT-2 (large) | 36 | 1280 | 20 | 774M |
| GPT-3 | 96 | 12288 | 96 | 175B |

GPT-4의 정확한 사양은 공개되지 않았으나, Mixture-of-Experts 구조와 멀티모달 입력을 지원한다.

## 정리

- GPT = Decoder-only, Causal Mask 항상 적용, 다음 토큰 예측  
- 스케일이 커질수록 Zero-shot / Few-shot 창발 능력이 등장  
- InstructGPT와 RLHF가 지시 따르기·안전성을 해결하며 ChatGPT를 탄생시킴  
- BERT는 이해, GPT는 생성이라는 역할 분담이 이후 LLM 생태계의 기반이 됨

---

**지난 글:** [BERT: 양방향 사전학습 언어 모델의 등장](/posts/transformer-bert/)

**다음 글:** [T5: 텍스트를 텍스트로 변환하는 통합 프레임워크](/posts/transformer-t5/)

<br>
읽어주셔서 감사합니다. 😊
