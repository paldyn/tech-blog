---
title: "GPT 패밀리 완전 해부: GPT-1부터 GPT-4o까지"
description: "OpenAI GPT 시리즈의 탄생 배경, GPT-1·2·3·3.5·4·4o의 핵심 변화, Transformer Decoder-only 아키텍처, RLHF 적용, 멀티모달 확장까지 한국어로 깊이 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["GPT", "OpenAI", "LLM", "ChatGPT", "GPT-4", "Transformer", "RLHF", "언어모델"]
featured: false
draft: false
---

[지난 글](/posts/llm-limits-and-hallucination/)에서 LLM이 왜 환각을 일으키는지, 그 근본 원인과 완화 전략을 살펴봤다. 이번 글부터는 실제로 세상을 바꾼 LLM들을 하나씩 해부한다. 그 첫 번째 주인공은 현재 LLM 생태계를 정의한 OpenAI의 **GPT 시리즈**다. GPT-1이 2018년에 등장한 이후 불과 6년 만에 수억 명이 매일 쓰는 도구로 진화한 이 여정을 처음부터 추적한다.

## GPT의 출발: 비지도 사전학습의 가능성

2018년 OpenAI는 논문 "Improving Language Understanding by Generative Pre-Training"을 발표하며 **GPT-1**을 공개했다. 당시 NLP 커뮤니티의 주류는 특정 태스크에 맞게 처음부터 학습시키는 방식이었다. GPT-1은 이 패러다임에 정면으로 도전했다.

핵심 아이디어는 단순하지만 강력했다. "인터넷에 있는 방대한 텍스트로 다음 단어를 예측하도록 사전학습(Pre-training)시킨 다음, 소량의 레이블 데이터로 파인튜닝(Fine-tuning)하면 어떨까?" GPT-1은 1억 1700만 개(117M) 파라미터의 Transformer Decoder-only 모델로, Books Corpus(약 4.5GB)로 사전학습했다. 결과는 놀라웠다. 당시 12개 NLU 태스크 중 9개에서 최고 성능을 달성했다.

![GPT 패밀리 진화 타임라인](/assets/posts/llm-gpt-family-timeline.svg)

## GPT-2: "너무 위험해서 공개 불가"

2019년 등장한 **GPT-2**는 15억 개(1.5B) 파라미터로 GPT-1의 약 12배 규모였다. 학습 데이터도 WebText(Reddit 외부 링크 텍스트, 약 40GB)로 대폭 확장했다. 모델 구조는 크게 변하지 않았다. 핵심은 **규모**였다.

GPT-2의 텍스트 생성 품질은 당시 기준으로 충격적이었다. 주어진 첫 문장에서 이어지는 여러 단락을 사람이 쓴 것처럼 생성할 수 있었다. OpenAI는 이 모델이 허위 정보 생성에 악용될 수 있다며 처음에는 전체 모델 공개를 거부했다. 당시로서는 매우 이례적인 결정이었고, AI 안전성 논의를 촉발시킨 계기가 됐다. 결국 6개월 뒤 전체 모델이 공개됐다.

GPT-2가 남긴 중요한 교훈: **모델 크기와 데이터 크기를 함께 늘리면 새로운 능력이 창발한다.**

## GPT-3: 스케일이 모든 것을 바꾼다

2020년 공개된 **GPT-3**는 1750억 개(175B) 파라미터로 당시 가장 큰 언어모델이었다. 학습 데이터는 Common Crawl, WebText2, Books, Wikipedia 등을 포함해 약 570GB의 텍스트였다.

GPT-3의 가장 혁명적인 발견은 **Few-shot Learning**의 창발이었다. 별도의 파인튜닝 없이, 프롬프트에 예시 몇 개를 보여주는 것만으로 새로운 태스크를 수행했다. 번역, 요약, 코드 생성, 산수 문제까지. 이것은 이전 모델들이 하지 못했던 것이다.

GPT-3 이후 "프롬프트 엔지니어링"이라는 새로운 분야가 등장했다. 모델을 바꾸는 대신 입력을 어떻게 구성하느냐가 성능을 결정하게 됐다.

```python
# GPT-3의 Few-shot Learning 예시
import openai

client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {
            "role": "user",
            "content": """다음 형식으로 감정을 분류하세요.

텍스트: 오늘 발표가 정말 잘 됐어요!
감정: 긍정

텍스트: 버스를 놓쳤네요...
감정: 부정

텍스트: 내일 회의가 있습니다.
감정:"""
        }
    ]
)
print(response.choices[0].message.content)  # 중립
```

## GPT-3.5와 ChatGPT: 대중화의 문이 열리다

GPT-3는 강력했지만 일반 사용자에게는 너무 기술적이었다. 2022년 11월, OpenAI는 **ChatGPT**를 출시했다. 기반 모델은 GPT-3.5(text-davinci-003)였고, 결정적 차이는 **RLHF(Reinforcement Learning from Human Feedback)** 적용이었다.

RLHF는 세 단계로 작동한다. 첫째, 인간 피드백자들이 모델 출력에 점수를 매긴다. 둘째, 이 점수를 예측하는 보상 모델(Reward Model)을 학습한다. 셋째, 보상 모델의 점수를 최대화하도록 강화학습으로 LLM을 파인튜닝한다.

ChatGPT는 출시 5일 만에 100만 사용자를 달성했고, 2개월 만에 1억 명을 돌파했다. 역사상 가장 빠르게 성장한 소비자 애플리케이션이었다. 단순한 기술 발전을 넘어 AI가 대중의 일상으로 들어온 전환점이었다.

![GPT 아키텍처 핵심 구성](/assets/posts/llm-gpt-family-architecture.svg)

## GPT-4: 멀티모달과 추론의 도약

2023년 3월 공개된 **GPT-4**는 OpenAI가 파라미터 수를 공개하지 않은 첫 번째 GPT 모델이다. 내부적으로는 **Mixture of Experts(MoE)** 아키텍처를 사용한다는 분석이 있으나 공식 확인은 없다.

GPT-4의 가장 큰 변화는 세 가지다.

**멀티모달 입력:** 이미지를 함께 입력할 수 있다. "이 그래프에서 이상한 점을 찾아줘"처럼 시각 정보와 언어를 결합한 추론이 가능해졌다.

**추론 능력의 급격한 향상:** GPT-4는 미국 변호사 시험(Bar Exam)에서 상위 10% 성적을 받았다. GPT-3.5는 하위 10%였다. 동일한 구조의 발전이지만 추론 능력은 비선형적으로 향상됐다.

**컨텍스트 창 확장:** GPT-4 Turbo는 128K 토큰(약 96,000 단어)의 컨텍스트를 지원한다. 소설 한 권 분량을 한 번에 처리할 수 있다.

## GPT-4o: "o"는 Omni

2024년 5월 공개된 **GPT-4o**는 "Omni"를 의미한다. 텍스트, 음성, 이미지를 하나의 모델이 통합적으로 처리한다. 이전의 ChatGPT 음성 기능은 STT → GPT → TTS의 파이프라인이었다. GPT-4o는 이 세 단계를 단일 모델로 처리하며, 응답 지연(latency)을 대폭 줄였다.

GPT-4o는 인간의 자연스러운 감정 표현(웃음, 놀람)에도 반응하며, 실시간 대화 중 끼어들기(interruption)도 처리한다. AI와의 상호작용이 텍스트 입출력에서 자연어 대화로 진화하는 이정표였다.

## GPT 패밀리의 공통 아키텍처 원리

GPT-1부터 GPT-4o까지 모든 GPT 모델은 동일한 기본 아키텍처를 공유한다.

**Transformer Decoder-only:** BERT와 달리 양방향 어텐션이 아닌 단방향 Masked Self-Attention만 사용한다. 왼쪽에서 오른쪽으로, 이전 토큰들만 보고 다음 토큰을 예측한다.

**자기회귀(Autoregressive) 생성:** 한 번에 하나의 토큰을 생성하고, 그 토큰이 다음 스텝의 입력이 된다. 토큰을 생성할수록 컨텍스트가 쌓인다.

**스케일링 법칙:** 파라미터 수, 데이터 크기, 학습 컴퓨팅을 함께 늘릴수록 성능이 예측 가능하게 향상된다.

```python
# GPT 스타일 자기회귀 생성 (개념 코드)
import torch
import torch.nn.functional as F

def generate_greedy(model, input_ids, max_new_tokens=50):
    """GPT 방식의 Greedy Decoding"""
    for _ in range(max_new_tokens):
        # 현재까지의 모든 토큰으로 다음 토큰 예측
        logits = model(input_ids)          # (batch, seq, vocab)
        next_token_logits = logits[:, -1, :]  # 마지막 위치만
        next_token = torch.argmax(next_token_logits, dim=-1, keepdim=True)
        input_ids = torch.cat([input_ids, next_token], dim=1)

        # EOS 토큰이면 종료
        if next_token.item() == model.config.eos_token_id:
            break

    return input_ids
```

## GPT 시리즈가 바꾼 것들

GPT 패밀리가 AI 생태계에 남긴 유산은 기술을 넘어선다.

**API 경제:** GPT-3부터 제공된 API는 수천 개의 스타트업을 탄생시켰다. 모델을 학습시킬 필요 없이 API 호출만으로 AI 제품을 만들 수 있게 됐다.

**프롬프트 엔지니어링:** "AI에게 어떻게 말하느냐"가 기술 스킬이 됐다. 모델을 파인튜닝하는 대신 프롬프트를 정교하게 설계하는 것이 실용적 접근법으로 자리 잡았다.

**AI 안전성 논의 가속:** ChatGPT의 등장으로 AI의 사회적 영향에 대한 논의가 학계를 벗어나 정책, 교육, 법률 영역으로 확산됐다. RLHF를 통한 정렬(Alignment) 기법이 산업 표준이 됐다.

GPT 시리즈는 단순한 언어모델을 넘어, AI와 인간이 상호작용하는 방식을 재정의했다. 다음 글에서는 OpenAI와 함께 이 분야를 이끄는 또 다른 주인공, Anthropic의 **Claude 패밀리**를 해부한다.

---

**다음 글:** [Claude 패밀리 완전 해부: Constitutional AI와 안전성 우선 설계](/posts/llm-claude-family/)

<br>
읽어주셔서 감사합니다. 😊
