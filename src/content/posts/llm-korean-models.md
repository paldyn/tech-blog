---
title: "한국 LLM 완전 해부: EXAONE, HyperCLOVA X, SOLAR"
description: "HyperCLOVA X, EXAONE, SOLAR 등 한국 LLM의 기술적 특징, 한국어 토크나이저의 효율성, 벤치마크 비교, API 사용법, 그리고 한국어 AI 서비스 구축 실전 가이드를 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["한국LLM", "HyperCLOVAX", "EXAONE", "SOLAR", "LG", "NAVER", "Upstage", "한국어AI"]
featured: false
draft: false
---

[지난 글](/posts/llm-qwen-deepseek/)에서 중국발 LLM 혁신, Qwen과 DeepSeek을 살펴봤다. 이번 글은 한국어 AI 개발자라면 반드시 알아야 할 주제다. "GPT-4로도 한국어가 잘 되는데 굳이 한국 LLM이 필요한가?" 이 질문에 명확하게 답하는 것에서 시작한다.

## 왜 한국어 특화 LLM이 필요한가

결론부터 말하면, 2024~2025년 기준으로 GPT-4o, Claude 3.5 Sonnet 같은 글로벌 최고 성능 모델들은 한국어도 매우 잘 처리한다. 그럼에도 한국어 특화 LLM이 유의미한 이유는 세 가지다.

**토크나이저 효율성:** 한국어는 교착어(조사·어미가 어근에 붙는 언어)로, 영어 중심 BPE 토크나이저는 한국어를 매우 비효율적으로 분해한다. "안녕하세요"가 12개 토큰이 되면, API 비용과 컨텍스트 창 사용량이 늘어난다. 한국어 특화 토크나이저는 동일 텍스트를 2~4배 적은 토큰으로 처리한다.

**한국 문화·법률·제도 이해:** 공정거래법, 주민등록번호 형식, 한국 금융 규제처럼 한국 특유의 맥락이 필요한 태스크에서 글로벌 모델은 학습 데이터의 한국어 비중이 낮아 성능이 떨어질 수 있다.

**데이터 주권과 규정 준수:** 의료, 금융, 공공 데이터를 해외 API로 전송하는 것에 규제 문제가 있을 수 있다. 온프레미스나 국내 클라우드에서 한국 LLM을 운영하면 이 문제를 피할 수 있다.

![한국어 토크나이저 효율성 비교](/assets/posts/llm-korean-models-tokenizer.svg)

## HyperCLOVA X: 네이버의 한국어 초거대 AI

**HyperCLOVA X**는 2023년 네이버가 공개한 한국어 특화 LLM이다. 전작 HyperCLOVA(2021, 82B)의 후속으로, 한국어 데이터를 대규모로 포함한 학습 코퍼스와 Instruction Tuning, RLHF를 결합했다.

HyperCLOVA X의 핵심은 **한국어 중심 사전학습 데이터**다. 뉴스, 블로그, 지식인, 법률 문서, 학술 자료 등 한국어 텍스트를 방대하게 포함했다. 한국어 이해와 생성 품질, 특히 존댓말/반말 구분, 한국식 비유, 문화적 맥락 이해에서 글로벌 모델 대비 강점을 보인다.

**CLOVA Studio API로 사용하기:**

```python
# CLOVA Studio API 사용 (v2)
import requests

API_KEY = "YOUR_CLOVASTUDIO_API_KEY"
REQUEST_ID = "YOUR_REQUEST_ID"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "messages": [
        {
            "role": "system",
            "content": "당신은 한국 법률 전문가입니다. 정확하고 이해하기 쉽게 답변하세요."
        },
        {
            "role": "user",
            "content": "임대차보호법에서 묵시적 갱신이 되었을 때 세입자의 권리는 무엇인가요?"
        }
    ],
    "maxTokens": 1024,
    "temperature": 0.5,
    "topP": 0.8
}

response = requests.post(
    "https://clovastudio.stream.naver.com/testapp/v1/chat-completions/HCX-003",
    headers=headers,
    json=payload
)
print(response.json()["result"]["message"]["content"])
```

HyperCLOVA X는 **CLOVA X** 서비스(clova.ai)로 일반 사용자에게도 제공된다. 기업용으로는 CLOVA Studio에서 API를 통해 접근하며, 커스텀 파인튜닝 서비스도 지원한다.

## EXAONE: LG AI Research의 오픈소스 전략

**EXAONE(Expert AI for EverytONE)**은 2023년 LG AI Research가 공개한 LLM 시리즈다. 2024년 EXAONE 3.0(7.8B)을 연구용 오픈소스로 공개해 주목을 받았다.

EXAONE 3.5(2024.12)는 2.4B, 7.8B, 32B 세 가지 크기를 오픈소스로 공개했다. 특이한 점은 **연구용 라이선스**로 공개됐다는 것이다. 학술 연구와 비상업적 목적으로는 자유롭게 사용할 수 있지만, 상업적 사용은 LG AI Research에 별도 문의가 필요하다.

EXAONE의 기술적 특징은 **전문 도메인 성능**이다. 특히 의료, 법률, 금융 분야의 한국어 전문 지식에서 강점을 보인다. LG그룹의 다양한 사업 영역(화학, 에너지, 가전)과 관련된 전문 데이터로 학습됐다.

```bash
# EXAONE 3.5 HuggingFace에서 실행
# pip install transformers torch

from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)

messages = [
    {"role": "system", "content": "당신은 도움이 되는 AI 어시스턴트입니다."},
    {"role": "user", "content": "파이썬으로 한국어 형태소 분석기를 만들려면 어떤 라이브러리를 써야 하나요?"}
]

input_ids = tokenizer.apply_chat_template(
    messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
)
```

![한국 LLM 생태계 지도](/assets/posts/llm-korean-models-landscape.svg)

## SOLAR: Upstage의 글로벌 1위 오픈소스 모델

**Upstage**는 국내 AI 스타트업으로, 2023년 SOLAR 10.7B를 공개해 HuggingFace Open LLM Leaderboard에서 1위를 달성하며 세계적 주목을 받았다.

SOLAR의 핵심 기술은 **Depth-Up Scaling(DUS)**이다. 두 개의 작은 모델을 단순 연결해 더 큰 모델을 만드는 방식이다. LLaMA 2 7B 두 개를 연결해 10.7B를 만들되, 연결 부분의 레이어를 삭제하고 새로 파인튜닝하는 방식이다. 훈련 비용을 줄이면서도 높은 성능을 달성했다.

```python
# SOLAR 모델 HuggingFace에서 실행
from transformers import pipeline

# SOLAR 10.7B Instruct (Apache 2.0)
pipe = pipeline(
    "text-generation",
    model="upstage/SOLAR-10.7B-Instruct-v1.0",
    torch_dtype="auto",
    device_map="auto"
)

messages = [
    {"role": "user", "content": "한국의 AI 규제 현황과 EU AI Act와의 비교를 설명해줘."}
]
print(pipe(messages, max_new_tokens=512)[0]["generated_text"])
```

Upstage는 SOLAR 이후 상업 서비스 **Solar Pro**를 출시했다. Document AI(OCR, 문서 파싱)와 결합된 RAG 특화 솔루션으로 차별화를 시도하고 있다.

## 한국어 LLM 벤치마크: 어떻게 평가하나

한국어 LLM 성능을 평가하는 벤치마크는 다음과 같다.

**KMMLU(Korean MMLU):** 한국어로 번역된 MMLU. 57개 과목의 객관식 문제로 한국어 지식 이해도 측정.

**KoMT-Bench:** MT-Bench의 한국어 버전. 다양한 주제의 개방형 질문으로 대화 품질 평가. GPT-4가 심사위원 역할.

**Ko-H4:** HuggingFace H4 평가의 한국어 버전. ARC-KO, HellaSwag-KO, MMLU-KO, TruthfulQA-KO 포함.

**KoBEST(Korean Balanced Evaluation of Short Text):** 상식 추론, 독해, 자연어 추론 등 5개 태스크.

실용적 선택 기준에서, 2025년 현재 한국어 태스크에 대한 권장사항이다. 최고 성능이 필요하다면 Claude Sonnet/GPT-4o가 여전히 강력하다. 비용 최적화가 중요하다면 Qwen 2.5나 DeepSeek V3가 한국어에서도 우수한 성능을 보인다. 데이터 규정 준수나 온프레미스 배포가 필요하다면 EXAONE이나 HyperCLOVA X API를 검토하라.

이제 주요 LLM 패밀리를 모두 살펴봤다. 다음 글에서는 이 모델들을 어떻게 **객관적으로 비교**할 수 있는지, LLM 벤치마크와 평가 방법론을 깊이 파헤친다.

---

**지난 글:** [Qwen과 DeepSeek: 중국 오픈소스 LLM의 도전](/posts/llm-qwen-deepseek/)

**다음 글:** [LLM 벤치마크 완전 해부: MMLU, HumanEval, LMSYS Chatbot Arena](/posts/llm-comparison-benchmarks/)

<br>
읽어주셔서 감사합니다. 😊
