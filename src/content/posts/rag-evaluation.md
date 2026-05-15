---
title: "RAG 평가: RAGAS로 검색 품질과 답변 품질 측정하기"
description: "RAG 파이프라인의 품질을 체계적으로 측정하는 RAGAS 프레임워크의 4가지 핵심 지표, TruLens RAG Triad, 그리고 합성 테스트 데이터셋 구축까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["RAG", "RAGAS", "평가", "TruLens", "Faithfulness", "LLM평가"]
featured: false
draft: false
---

[지난 글](/posts/rag-graph-rag/)에서 지식 그래프를 활용한 Graph RAG를 배웠다. 다양한 RAG 기법을 익혔다면 이제 자연스럽게 드는 질문은 "어떻게 내 RAG 시스템이 잘 작동하는지 알 수 있나?"다. **RAG 평가**는 단순히 LLM의 답변 품질만 보는 것이 아니라, 검색 단계와 생성 단계를 각각 측정하고 파이프라인 전체의 병목을 파악하는 것이 핵심이다.

## RAG 평가의 어려움

전통적인 NLP 평가는 정답 레이블이 있는 데이터셋에서 F1, BLEU 같은 지표를 계산했다. RAG 평가는 훨씬 복잡하다. "답변이 얼마나 좋은가?"를 측정하려면 단순 문자열 비교로는 부족하고, 답변이 컨텍스트에 근거했는지, 검색이 제대로 됐는지, 질문에 실제로 응답했는지를 모두 봐야 한다.

RAGAS(Retrieval Augmented Generation Assessment)는 이 문제를 체계적으로 해결하는 오픈소스 평가 프레임워크다.

![RAGAS 평가 프레임워크](/assets/posts/rag-evaluation-ragas.svg)

## RAGAS 4가지 핵심 지표

### 1. Faithfulness (충실도)

생성된 답변이 검색된 컨텍스트에 **사실적으로 근거**했는지 측정한다. 할루시네이션 감지의 핵심 지표다.

- 답변에서 주장(claim)을 추출
- 각 주장이 컨텍스트로 지지되는지 확인
- `충실한 주장 수 / 전체 주장 수`

### 2. Answer Relevance (답변 관련성)

답변이 **질문과 얼마나 관련 있는지** 측정한다. 컨텍스트에 근거했더라도 엉뚱한 내용을 말하면 낮아진다.

- 답변에서 역으로 질문을 생성
- 생성된 질문들의 임베딩과 원본 질문의 코사인 유사도 측정

### 3. Context Precision (컨텍스트 정밀도)

검색된 문서 중 **실제로 답변에 유용한 문서 비율**. 불필요한 문서가 많으면 낮아진다.

### 4. Context Recall (컨텍스트 재현율)

정답 답변에 필요한 정보가 **검색된 컨텍스트에 얼마나 포함됐는지**. Ground truth가 필요하다.

## RAGAS 실행

```python
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)

# 평가 데이터셋 구성
# ground_truths는 Context Recall 측정에 필요
data = {
    "question": ["RAG가 무엇인가요?", "LLM이란?"],
    "answer": [
        "RAG는 검색 증강 생성으로, 외부 지식을 검색해 LLM 응답을 강화합니다.",
        "LLM은 대규모 언어 모델로, 대규모 텍스트 데이터로 학습된 AI입니다."
    ],
    "contexts": [
        ["RAG는 Retrieval-Augmented Generation의 약자..."],
        ["LLM은 Large Language Model의 약자..."]
    ],
    "ground_truths": [
        ["RAG는 외부 문서를 검색해 AI 응답 정확성을 높이는 기술입니다."],
        ["LLM은 텍스트 데이터로 사전 학습된 대규모 신경망 모델입니다."]
    ]
}

dataset = Dataset.from_dict(data)

results = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall]
)

print(results)
# {'faithfulness': 0.95, 'answer_relevancy': 0.88,
#  'context_precision': 0.82, 'context_recall': 0.90}
```

## 합성 테스트 데이터셋 생성

실제 레이블 데이터 없이도 LLM으로 테스트 데이터셋을 자동 생성할 수 있다.

```python
from ragas.testset import TestsetGenerator
from ragas.testset.evolutions import simple, reasoning, multi_context

# 테스트 데이터 자동 생성
generator = TestsetGenerator.from_langchain(
    generator_llm=ChatAnthropic(model="claude-sonnet-4-6"),
    critic_llm=ChatAnthropic(model="claude-sonnet-4-6"),
    embeddings=OpenAIEmbeddings()
)

testset = generator.generate_with_langchain_docs(
    documents=docs,
    test_size=50,
    distributions={
        simple: 0.5,       # 단순 사실 질문
        reasoning: 0.3,    # 추론 필요 질문
        multi_context: 0.2 # 여러 문서 필요 질문
    }
)
```

![RAG 평가 삼각형](/assets/posts/rag-evaluation-triad.svg)

## TruLens로 실시간 모니터링

RAGAS가 배치 평가라면, TruLens는 RAG 애플리케이션에 **실시간 피드백**을 붙인다.

```python
from trulens.core import TruSession
from trulens.apps.langchain import TruChain
from trulens.providers.langchain import Langchain

session = TruSession()
provider = Langchain(chain=llm)

# RAG Triad 피드백 설정
from trulens.core import Feedback
import numpy as np

# 컨텍스트 관련성: 검색기 품질
context_relevance = (
    Feedback(provider.context_relevance_with_cot_reasons)
    .on_input()
    .on(TruChain.select_context())
    .aggregate(np.mean)
)

# 근거성: 할루시네이션 감지
groundedness = (
    Feedback(provider.groundedness_measure_with_cot_reasons)
    .on(TruChain.select_context().collect())
    .on_output()
)

# 래핑: 모든 호출에 자동 평가 적용
tru_rag = TruChain(
    rag_chain,
    app_name="ProductionRAG",
    feedbacks=[context_relevance, groundedness]
)

# 대시보드에서 실시간 확인
session.get_leaderboard()
```

## 지표 해석과 개선 방향

| 낮은 지표 | 원인 | 개선 방향 |
|---------|-----|---------|
| Context Precision | 불필요한 문서 검색 | 리랭킹 추가, Top-K 감소 |
| Context Recall | 필요 정보 미검색 | 청킹 크기 조정, 쿼리 재작성 |
| Faithfulness | 할루시네이션 | 프롬프트 강화, 온도 감소 |
| Answer Relevance | 엉뚱한 답변 | 프롬프트 개선, 컨텍스트 품질 향상 |

평가 지표는 개발 초기에 한 번이 아니라 지속적으로 측정해야 의미가 있다. 문서가 업데이트되거나 쿼리 패턴이 변화하면 성능이 달라지기 때문이다. CI/CD 파이프라인에 RAGAS 평가를 통합해 배포마다 자동으로 품질을 검증하는 것이 현업 모범 사례다.

---

**지난 글:** [Graph RAG: 지식 그래프로 RAG의 한계를 극복하다](/posts/rag-graph-rag/)

**다음 글:** [RAG vs 파인튜닝: 언제 무엇을 선택해야 하나](/posts/rag-vs-finetuning/)

<br>
읽어주셔서 감사합니다. 😊
