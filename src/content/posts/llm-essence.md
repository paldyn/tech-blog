---
title: "LLM의 본질: 거대 언어 모델이란 무엇인가"
description: "LLM이 단순한 '더 큰 모델'이 아닌 이유, 창발적 능력의 정체, 파라미터-데이터-컴퓨팅의 3요소, ChatGPT 충격의 기술적 배경, 그리고 LLM API 첫 호출까지 LLM의 본질을 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["LLM", "대규모언어모델", "GPT", "Claude", "창발적능력", "파운데이션모델", "스케일링법칙"]
featured: false
draft: false
---

[지난 글](/posts/nlp-korean-processing/)에서 한국어 NLP의 특수성과 주요 도구를 살펴봤다. 이제 NLP의 전체 역사가 수렴하는 정점, **대규모 언어 모델(Large Language Model, LLM)**을 본격적으로 탐구한다. LLM은 단순히 "크기가 큰 언어 모델"이 아니다. 특정 규모를 넘어서면 기존 모델과는 질적으로 다른 능력이 나타나기 시작한다. 수학 문제를 풀고, 코드를 작성하고, 철학적 논쟁을 하고, 새로운 언어를 가르친다. 이 "창발(Emergence)"의 정체가 무엇인지, 그리고 LLM이 왜 AI 역사를 바꿨는지를 이 글에서 다룬다.

## ChatGPT 충격: 무엇이 달랐나

2022년 11월 30일, OpenAI가 ChatGPT를 출시했다. 출시 5일 만에 100만 사용자를 넘겼고, 2개월 만에 1억 명을 달성해 역사상 가장 빠르게 성장한 서비스가 됐다. 기술자들뿐만 아니라 일반 대중도 AI와 자연스러운 대화를 경험한 첫 번째 순간이었다.

ChatGPT 이전에도 GPT-3가 존재했다. 그런데 왜 GPT-3는 ChatGPT만큼의 충격을 주지 못했을까? 핵심 차이는 **Instruction Tuning(지시 따르기 미세조정)**과 **RLHF(인간 피드백 강화학습)**였다. 단순히 다음 토큰을 예측하는 모델에서, 인간의 의도를 파악하고 따르도록 정렬(Alignment)된 모델로의 전환이 "챗봇 혁명"을 일으켰다.

## LLM의 정의

**대규모 언어 모델(LLM)**은 다음 조건을 모두 만족하는 언어 모델이다.

1. **파라미터 규모:** 수십억(10B) 이상, 일반적으로 70B~1T+ 범위
2. **대규모 사전학습:** 웹 텍스트, 책, 코드 등 수조 개 토큰으로 학습
3. **Transformer 아키텍처:** Self-Attention 기반 딥러닝 모델
4. **범용성:** 특정 태스크가 아닌 다양한 언어 태스크 수행 가능
5. **창발적 능력:** 소형 모델에서는 나타나지 않는 질적으로 새로운 능력

![LLM의 본질: 규모와 창발적 능력](/assets/posts/llm-essence-overview.svg)

## 창발적 능력이란

Wei et al. (2022)의 연구는 모델 규모가 특정 임계값을 넘으면 특정 태스크의 성능이 급격히 향상되는 현상을 "창발적 능력(Emergent Abilities)"이라 명명했다.

예를 들어 수학 단어 문제(GSM8K)에서 10B 이하 모델은 ~5% 정확도에 그치지만, 100B 이상에서 ~30~50%, 175B GPT-3.5에서 ~57%, GPT-4에서 ~90%로 급격히 도약한다. 이 도약은 선형적 성능 향상이 아니라 **질적 전환**이다.

주요 창발적 능력:
- **Chain-of-Thought 추론:** "단계별로 생각해보자"라는 프롬프트 한 줄이 수학 문제 해결 능력을 수십 배 향상시킨다. 100B 이하에서는 효과 없음.
- **In-Context Learning:** 예제 몇 개만으로 새로운 태스크 수행. 파인튜닝 없이.
- **Instruction Following:** 자연어 지시를 정확히 따르는 능력.
- **Code Generation:** 기능 명세서를 보고 코드 작성.

## LLM의 세 가지 핵심 요소

모든 강력한 LLM은 세 가지를 동시에 갖춰야 한다.

### 1. 파라미터 (Model Capacity)

트랜스포머의 가중치 행렬 수. 더 많은 파라미터 = 더 많은 지식과 패턴을 저장 가능. GPT-4는 추정 1.8조 개(MoE 구조), Claude 3 Opus는 수천억 개 수준으로 추정된다.

### 2. 데이터 (Training Data)

Common Crawl(웹), Books3(책), GitHub(코드), Wikipedia, ArXiv(논문) 등을 혼합. GPT-3는 약 570GB 텍스트, LLaMA-3은 15T 토큰으로 학습됐다. 데이터 품질 필터링이 양만큼이나 중요하다.

### 3. 컴퓨팅 (FLOP)

Chinchilla 법칙에 따르면 최적 학습을 위해 파라미터 수 × 20 개의 토큰이 필요하다. 70B 모델이면 1.4T 토큰. GPT-4 학습에는 약 2.15e25 FLOP(A100 GPU 수백 대를 수개월)이 소비됐다고 추정된다.

## 언어 모델 학습의 기본 목표

LLM의 사전학습 목표는 놀라울 정도로 단순하다: **다음 토큰 예측(Next Token Prediction)**.

$$\mathcal{L} = -\sum_{i=1}^{N} \log P(\text{토큰}_i \mid \text{토큰}_1, \ldots, \text{토큰}_{i-1}; \theta)$$

이 단순한 목표로 수조 개 토큰을 학습하면, 모델은 언어의 통계적 구조뿐만 아니라 세계에 대한 사실, 추론 방법, 코딩 패턴 등을 암묵적으로 내재화한다.

```python
# 언어 모델의 핵심 목표를 PyTorch로 표현
import torch
import torch.nn.functional as F

def language_model_loss(logits, targets):
    """
    logits: (batch, seq_len, vocab_size)
    targets: (batch, seq_len) — 정답 다음 토큰 ID
    """
    # 시퀀스를 1개 밀어서 다음 토큰 예측 손실 계산
    shift_logits  = logits[:, :-1, :].contiguous()
    shift_targets = targets[:, 1:].contiguous()

    # Cross-entropy = negative log likelihood
    loss = F.cross_entropy(
        shift_logits.view(-1, shift_logits.size(-1)),
        shift_targets.view(-1),
        ignore_index=-100,  # 패딩 무시
    )
    return loss

# Perplexity = exp(loss)
# 낮을수록 다음 토큰을 더 잘 예측함
```

## LLM API 첫 호출

![Claude + OpenAI API 첫 호출](/assets/posts/llm-essence-code.svg)

```python
# Claude API (Anthropic)
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="당신은 전문 AI 교육자입니다. 한국어로 명확하게 설명해주세요.",
    messages=[
        {
            "role": "user",
            "content": (
                "LLM이 단순한 '더 큰 언어 모델'이 아닌 이유를 "
                "3가지로 설명해주세요."
            ),
        }
    ],
)
print(response.content[0].text)
```

## 주요 LLM 가문

현재 상용/오픈소스 LLM은 몇 가지 주요 가문으로 나뉜다.

| 가문 | 대표 모델 | 특징 |
|---|---|---|
| GPT | GPT-4o, o3 | OpenAI 독점, 최강 성능 |
| Claude | Sonnet 4, Opus 4 | Anthropic, 안전성 강조 |
| Gemini | Gemini 2.5 Pro | Google, 멀티모달 |
| LLaMA | LLaMA 3.3, LLaMA 4 | Meta 오픈소스 기반 |
| Mistral | Mistral Large | 유럽, 효율적 |
| Qwen | Qwen2.5 | 알리바바, 다국어 |
| HyperCLOVA X | HCX-005 | 네이버, 한국어 특화 |

## LLM이 혁명적인 이유

기존 AI 모델은 "하나의 모델 = 하나의 태스크"였다. 스팸 분류기는 스팸만, 번역기는 번역만 할 수 있었다. LLM은 이 패러다임을 깨뜨렸다. **하나의 모델이 수천 가지 태스크를 프롬프트 하나로 수행한다**.

이것이 "파운데이션 모델(Foundation Model)"이라는 개념이 등장한 이유다. LLM은 범용 지능의 기반(foundation)이 되고, 특정 도메인·태스크의 적응은 파인튜닝·RAG·프롬프팅으로 수행한다.

다음 글에서는 이 강력한 LLM이 어떻게 사전학습되는지, 수조 개 토큰에서 언어 모델이 무엇을 배우는지를 깊이 살펴본다.

---

**지난 글:** [한국어 NLP: 교착어 처리와 한국어 특화 모델](/posts/nlp-korean-processing/)

**다음 글:** [LLM 사전학습: 수조 개 토큰으로 무엇을 배우나](/posts/llm-pretraining/)

<br>
읽어주셔서 감사합니다. 😊
