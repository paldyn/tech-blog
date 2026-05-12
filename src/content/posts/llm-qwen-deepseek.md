---
title: "Qwen과 DeepSeek: 중국 오픈소스 LLM의 도전"
description: "Alibaba의 Qwen 시리즈와 High-Flyer의 DeepSeek 시리즈의 탄생 배경, 기술적 혁신(MLA, MoE), DeepSeek-R1의 강화학습 추론, 그리고 미국 AI 업계에 미친 충격을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["Qwen", "DeepSeek", "중국LLM", "오픈소스", "DeepSeekR1", "MoE", "강화학습", "추론모델"]
featured: false
draft: false
---

[지난 글](/posts/llm-mistral-family/)에서 유럽 오픈소스 LLM의 혁신, Mistral AI를 살펴봤다. AI 생태계의 지형은 훨씬 더 넓다. 2024~2025년, 중국에서 두 개의 LLM 가문이 조용히 성장해 전 세계를 놀라게 했다. Alibaba Cloud의 **Qwen**과 헤지펀드 출신 스타트업 **DeepSeek**이다. 특히 DeepSeek의 등장은 미국 AI 업계에 실질적인 충격을 줬다.

## Qwen: 알리바바의 이중 언어 LLM 제국

**Qwen(通义千问, 통의천문)**은 2023년 알리바바 클라우드가 공개한 LLM 시리즈다. "통의"는 알리바바의 AI 브랜드이고, "천문"은 "천 가지 질문"을 의미한다.

Qwen의 가장 큰 강점은 **중국어와 영어 이중 언어 능력**이다. 대부분의 서구 LLM이 중국어를 지원하더라도 영어에서 파인튜닝된 모델을 번역에 의존하는 것과 달리, Qwen은 중국어 데이터를 방대하게 포함해 사전학습했다.

**Qwen 시리즈 주요 버전:**

Qwen 1(2023.09): 7B, 14B, 72B로 출발. 중국어 벤치마크에서 당시 최고 성능. 영어도 경쟁력 있는 수준 달성.

Qwen 1.5(2024.02): 0.5B~72B까지 8개 크기. "갤럭시 모델"이라 불릴 만큼 다양한 스케일을 제공해 엣지 디바이스부터 서버까지 커버.

Qwen 2(2024.06): 0.5B~72B. 30개 이상 언어 지원으로 다국어 확장. 특히 아랍어, 러시아어, 한국어 등 비영어·비중국어 언어에서 크게 향상.

Qwen 2.5(2024.09): **72B 모델이 LLaMA 3.1 405B와 경쟁하는 성능**을 달성했다. 코딩, 수학, 지시 따르기 모두에서 대폭 향상. Qwen 2.5-Coder, Qwen 2.5-Math 특화 버전도 공개.

Qwen 3(2025): 다양한 크기의 모델과 MoE 버전을 제공하며, 전 세계 상위권 벤치마크에서 경쟁력을 유지.

```python
# Qwen 모델 Ollama로 실행
# ollama run qwen2.5:7b

# Python으로 Qwen API 호출 (DashScope)
from dashscope import Generation

response = Generation.call(
    model="qwen-max",  # 또는 qwen-turbo, qwen-plus
    messages=[
        {
            "role": "user",
            "content": "한국 스타트업 생태계와 중국 스타트업 생태계의 차이점을 비교해줘."
        }
    ]
)
print(response.output.text)
```

Qwen은 오픈소스(HuggingFace, ModelScope에서 무료 다운로드)와 상업 API(DashScope) 두 가지 경로를 병행한다. 특히 ModelScope(阿里云模型库)는 중국 버전의 HuggingFace라 할 수 있으며, Qwen 모델을 국내에서 더 빠르게 다운로드할 수 있다.

![Qwen과 DeepSeek 비교](/assets/posts/llm-qwen-deepseek-overview.svg)

## DeepSeek: 헤지펀드가 만든 충격적 LLM

**DeepSeek**은 중국 최대 양적 헤지펀드 중 하나인 High-Flyer Quant의 AI 연구 부문이 2023년 독립해 설립한 회사다. 금융 알고리즘 최적화에서 쌓은 수학적 능력을 AI 훈련에 적용했다.

DeepSeek의 목표는 명확했다. "제한된 GPU 자원으로 최고 성능을 달성한다." 미국의 반도체 수출 규제로 H100/A100 GPU 확보가 어려운 상황에서, **알고리즘 혁신으로 컴퓨팅 효율성을 극대화**하는 것이 생존 전략이었다.

**DeepSeek V2(2024.05): Multi-head Latent Attention**

DeepSeek V2의 핵심 혁신은 **MLA(Multi-head Latent Attention)**다. 기존 KV 캐시는 각 Attention Head의 Key와 Value를 모두 저장하므로 메모리를 많이 차지한다. MLA는 KV를 저차원 잠재 벡터로 압축해 저장하고, 필요할 때 복원한다. 이로써 KV 캐시 메모리를 93.3% 줄였다.

총 236B 파라미터의 MoE 구조지만, 추론 시 21B만 활성화된다. GPT-4급 성능을 당시 대비 약 1/10 비용으로 API 제공.

**DeepSeek V3(2024.12): 새로운 훈련 효율성의 기준**

DeepSeek V3는 671B 파라미터 MoE 모델로, 추론 시 37B가 활성화된다. 놀라운 것은 훈련 비용이다. 총 2,048개의 H800 GPU로 55.8일 훈련 — 약 557만 달러. 비슷한 성능의 경쟁 모델 대비 추정 훈련 비용의 1/10 수준이었다.

DeepSeek V3는 Sonnet, GPT-4o 등과 비교했을 때 코딩, 수학, 추론 벤치마크에서 동급 또는 그 이상의 성능을 보였다.

## DeepSeek-R1: 강화학습만으로 추론을 깨우다

2025년 1월 공개된 **DeepSeek-R1**은 업계 전체에 충격을 줬다. OpenAI의 o1처럼 "생각하는" 추론 모델인데, **인간이 작성한 Chain-of-Thought 데이터 없이** 강화학습만으로 추론 능력을 창발시켰다.

R1의 학습 과정은 다음과 같다. 사전학습된 DeepSeek-V3에 순수 강화학습(GRPO 알고리즘)을 적용했다. 보상 신호는 단순하다. 수학 문제는 답이 맞으면 +1, 틀리면 0. 형식이 맞으면 추가 보상. 인간 피드백 없이, 정답 유무만으로 학습했다.

결과: 모델은 스스로 "생각하는" 방법을 학습했다. `<think>...</think>` 태그 내에서 수백~수천 토큰의 내부 추론을 수행하고, 최종 답을 제시한다.

![DeepSeek-R1 추론 학습 파이프라인](/assets/posts/llm-qwen-deepseek-r1.svg)

```python
# DeepSeek API 사용 (OpenAI 호환)
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_DEEPSEEK_API_KEY",
    base_url="https://api.deepseek.com"
)

# 추론 모델 (R1)
response = client.chat.completions.create(
    model="deepseek-reasoner",  # R1 모델
    messages=[
        {
            "role": "user",
            "content": "소수 판별 알고리즘 중 밀러-라빈 소수판별법을 구현하고 원리를 설명해줘."
        }
    ]
)

# reasoning_content: R1의 사고 과정
# content: 최종 답변
print(response.choices[0].message.reasoning_content[:500])  # 사고 과정
print("---")
print(response.choices[0].message.content)  # 최종 답변
```

**DeepSeek-R1의 성능:** AIME(미국 수학 올림피아드) 2024에서 79.8% 달성, OpenAI o1과 동급. SWE-bench(소프트웨어 엔지니어링) 49.2%로 Claude 3.5 Sonnet을 능가. MIT 라이선스로 완전 무료 상업 사용 가능.

R1 공개 당일, 미국 AI 관련 주식이 하락했다. NVIDIA 주가가 17% 떨어졌다. DeepSeek이 적은 GPU로 최고 성능을 달성했다는 것은, 대규모 GPU 투자가 필수라는 전제에 의문을 제기했기 때문이다.

## Qwen vs DeepSeek: 어떻게 선택할까

두 모델 가문의 실용적 선택 기준이다.

**Qwen을 선택할 때:** 중국어 처리가 핵심인 애플리케이션, 한국어를 포함한 아시아 언어 다국어 서비스, 0.5B~72B까지 다양한 크기로 디바이스별 최적화가 필요할 때.

**DeepSeek를 선택할 때:** 수학·코딩·논리 추론이 핵심인 태스크, R1의 사고 과정이 필요한 복잡한 문제 해결, OpenAI API 대비 비용을 크게 줄이고 싶을 때.

두 모델 모두 로컬에서 실행할 수 있다.

```bash
# Qwen 로컬 실행
ollama run qwen2.5:7b

# DeepSeek 로컬 실행 (R1 distilled 버전)
ollama run deepseek-r1:8b  # R1의 증류 버전
```

이제 GPT, Claude, Gemini, LLaMA, Mistral, Qwen, DeepSeek까지 주요 LLM 패밀리를 살펴봤다. 다음 글에서는 한국어 처리에 강점을 가진 **한국 LLM 모델들**을 살펴본다.

---

**지난 글:** [Mistral 패밀리 완전 해부: 유럽 오픈소스 LLM의 반격](/posts/llm-mistral-family/)

**다음 글:** [한국 LLM 완전 해부: EXAONE, HyperCLOVA X, 그리고 한국어 AI](/posts/llm-korean-models/)

<br>
읽어주셔서 감사합니다. 😊
