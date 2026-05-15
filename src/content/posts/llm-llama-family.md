---
title: "LLaMA 패밀리 완전 해부: 오픈소스 LLM 혁명"
description: "Meta LLaMA 시리즈의 탄생 배경, LLaMA 1·2·3 버전별 혁신, 오픈소스 생태계(Vicuna·Alpaca·Code Llama), 로컬 실행 방법(Ollama·llama.cpp), 그리고 상업 모델과의 실전 비교를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["LLaMA", "Meta", "오픈소스LLM", "Ollama", "llama.cpp", "LLaMA3", "로컬AI", "파인튜닝"]
featured: false
draft: false
---

[지난 글](/posts/llm-gemini-family/)에서 Google Gemini의 멀티모달 네이티브 전략을 살펴봤다. GPT, Claude, Gemini 모두 API를 통해서만 접근 가능하고, 모델 자체는 공개되지 않은 상업 모델이다. 그런데 AI 생태계에는 전혀 다른 방향이 있다. 누구나 모델 가중치를 직접 다운로드해 자신의 컴퓨터에서 실행하고, 원하는 방식으로 파인튜닝할 수 있는 완전한 오픈소스 LLM. 이 혁명의 진원지가 바로 Meta의 **LLaMA 패밀리**다.

## 왜 Meta가 오픈소스 LLM을 공개했나

2023년 초, 언어모델 연구는 소수의 거대 기업이 독점하는 구조였다. OpenAI의 GPT-3는 API를 통해서만 접근 가능했고, 가중치는 공개되지 않았다. 연구자들이 LLM의 내부를 직접 들여다보거나, 커스텀 파인튜닝을 하거나, 로컬에서 실행하는 것은 사실상 불가능했다.

Meta의 AI 연구소(FAIR)는 다른 방향을 선택했다. "AI 연구의 진보는 투명성과 재현 가능성에서 온다"는 철학 아래, **LLaMA(Large Language Model Meta AI)**를 연구자들에게 공개했다. 처음에는 비상업용으로 시작했지만, 이후 완전한 상업용 오픈소스로 발전했다.

## LLaMA 1: 유출이 만든 혁명

2023년 2월 공개된 **LLaMA 1**은 7B, 13B, 33B, 65B의 네 가지 크기로 제공됐다. 공식적으로는 연구자용 신청 폼을 통해 배포됐지만, 공개 이틀 만에 4chan에 토렌트 링크가 올라왔다. Meta는 이 상황을 방관했고, 결과적으로 LLaMA 1은 사실상 오픈소스가 됐다.

LLaMA 1의 핵심 발견은 충격적이었다. **13B 파라미터 모델이 175B GPT-3를 대부분의 벤치마크에서 능가했다.** 크기가 아니라 **데이터의 질과 양, 효율적인 학습**이 성능을 결정한다는 것을 증명했다. LLaMA 1은 Common Crawl, C4, Github, Wikipedia, Books, ArXiv, StackExchange 등 다양한 고품질 데이터로 학습했다.

오픈소스 커뮤니티의 반응은 폭발적이었다. 일주일 만에 스탠퍼드 연구팀이 LLaMA 1을 파인튜닝한 **Alpaca**를 발표했다. 단 600달러의 비용으로 ChatGPT 수준의 대화 능력을 달성했다. 이어서 Vicuna, WizardLM 등 수십 개의 파생 모델이 쏟아졌다.

![LLaMA 패밀리 버전 진화](/assets/posts/llm-llama-family-versions.svg)

## LLaMA 2: 상업용 오픈소스의 공식화

2023년 7월, Meta는 Microsoft와 협력해 **LLaMA 2**를 상업용으로 완전 공개했다. 7B, 13B, 70B 세 가지 크기로, 사전학습 모델(Base)과 RLHF로 파인튜닝한 채팅 모델(Chat)을 함께 제공했다.

LLaMA 2의 기술적 개선은 세 가지다. 첫째, 컨텍스트 창이 2K에서 4K로 확장됐다. 둘째, **Grouped Query Attention(GQA)**을 70B 모델에 적용해 추론 속도를 개선했다. 셋째, Ghost Attention(GAtt)으로 긴 대화에서 시스템 프롬프트 준수가 더 안정적이 됐다.

LLaMA 2 Chat 모델은 RLHF와 안전성 학습을 통해, 일부 태스크에서 ChatGPT와 경쟁할 수 있는 수준의 대화 품질을 달성했다. 상업적으로 완전히 사용 가능한 최초의 고성능 오픈소스 LLM이었다.

## LLaMA 3: 오픈소스와 상업 모델의 간격이 좁혀지다

2024년 4월 공개된 **LLaMA 3**는 오픈소스 LLM 역사에서 가장 중요한 전환점이다. **8B와 70B**, 그리고 2024년 8월 공개된 **405B** 모델을 포함한다.

LLaMA 3의 가장 혁신적인 부분은 토크나이저다. 어휘 크기를 32K에서 **128K 토큰**으로 4배 확장했다. 이는 한국어, 일본어, 중국어 같은 비영어권 언어를 훨씬 효율적으로 처리할 수 있게 한다.

LLaMA 3 405B는 **GPT-4와 동급 수준의 성능**을 MMLU, HumanEval, GSM8K 등 주요 벤치마크에서 달성했다. 완전 오픈소스 모델로는 처음 있는 일이었다. 비용 걱정 없이 직접 실행하고, 원하는 데이터로 파인튜닝하고, 프라이버시를 지키며 사용할 수 있는 GPT-4급 모델이 등장한 것이다.

## 로컬에서 LLaMA 실행하기: Ollama

LLaMA를 가장 쉽게 실행하는 방법은 **Ollama**다. macOS, Linux, Windows에서 단 몇 줄의 명령으로 LLaMA를 실행할 수 있다.

```bash
# 1. Ollama 설치 (macOS)
brew install ollama

# 2. LLaMA 3.1 8B 모델 다운로드 및 실행 (약 4.7GB)
ollama run llama3.1:8b

# 3. 터미널에서 바로 대화
# >>> 파이썬으로 피보나치 수열을 재귀로 구현해줘.

# 4. API 서버로 사용 (백그라운드)
ollama serve  # http://localhost:11434 에서 OpenAI 호환 API 제공
```

![LLaMA 로컬 실행 방법](/assets/posts/llm-llama-family-inference.svg)

```python
# Ollama API를 Python으로 호출 (OpenAI 호환 인터페이스)
from openai import OpenAI

# Ollama는 OpenAI 호환 API를 제공하므로 동일한 SDK 사용 가능
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"  # 필요 없지만 라이브러리가 요구
)

response = client.chat.completions.create(
    model="llama3.1:8b",
    messages=[
        {"role": "system", "content": "당신은 코딩 전문가입니다."},
        {"role": "user", "content": "Python 데코레이터 패턴을 설명하고 예시를 보여줘."}
    ]
)
print(response.choices[0].message.content)
```

## LLaMA 생태계: 파생 모델의 폭발

LLaMA가 오픈소스 생태계에 미친 가장 큰 영향은 파생 모델의 폭발이다. 수백 개의 연구팀과 기업이 LLaMA를 기반으로 특화 모델을 만들었다.

**Code Llama:** Meta가 직접 만든 코딩 특화 모델이다. 7B, 13B, 34B, 70B 크기로 제공되며, 코드 생성, 코드 설명, Fill-in-the-Middle(FIM, 중간 부분 채우기) 기능을 지원한다. GitHub Copilot의 오픈소스 대안으로 자주 사용된다.

**Vicuna:** UC Berkeley, CMU 연구팀이 LLaMA에 ShareGPT(ChatGPT 대화 기록) 7만 건을 파인튜닝한 모델이다. GPT-4가 평가할 때 ChatGPT의 92% 수준을 달성했다고 보고됐다.

**WizardLM:** Evol-Instruct 방법론으로 지시 따르기를 강화한 모델이다. 간단한 지시를 AI가 자동으로 더 복잡하게 변형해 학습 데이터를 만드는 방식이다.

## 오픈소스 vs 상업 모델: 언제 무엇을 선택할까

오픈소스 LLM이 강력하다고 해서 무조건 좋은 선택은 아니다. 두 가지 방향에는 각각 적합한 상황이 있다.

**오픈소스(LLaMA 계열) 선택 기준:** 데이터 프라이버시가 최우선일 때(의료, 법률, 금융 데이터), 특정 도메인에 깊이 파인튜닝해야 할 때, API 비용이 사업성을 위협할 만큼 클 때, 인터넷 연결 없이 오프라인에서 동작해야 할 때.

**상업 모델(GPT·Claude·Gemini) 선택 기준:** 최고 수준의 일반 성능이 필요할 때, 빠르게 프로토타입을 만들어야 할 때, 인프라 관리 리소스가 없을 때, 멀티모달 기능이 필요하면서 즉시 사용 가능해야 할 때.

오픈소스 LLM 세계에서 LLaMA가 이정표를 세웠다면, 다음 글에서는 유럽에서 조용히 업계를 놀라게 한 **Mistral 패밀리**를 살펴본다.

---

**지난 글:** [Gemini 패밀리 완전 해부: Google의 멀티모달 LLM 전략](/posts/llm-gemini-family/)

**다음 글:** [Mistral 패밀리 완전 해부: 유럽 오픈소스 LLM의 반격](/posts/llm-mistral-family/)

<br>
읽어주셔서 감사합니다. 😊
