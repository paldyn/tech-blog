---
title: "파인튜닝 vs 프롬프트 엔지니어링 vs RAG: 세 전략의 완전 비교"
description: "LLM을 최적화하는 세 가지 핵심 전략, 프롬프트 엔지니어링·RAG·파인튜닝의 차이와 강점, 언제 무엇을 선택해야 하는지 판단 기준을 실전 코드와 함께 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "RAG", "프롬프트엔지니어링", "LLM최적화", "전략선택"]
featured: false
draft: false
---

[지난 글](/posts/rag-vs-finetuning/)에서 RAG와 파인튜닝의 차이를 심층적으로 비교했다. 이번에는 한 발 물러서서 LLM을 특정 목적에 맞게 최적화하는 **세 가지 핵심 전략 전체**를 비교한다. 프롬프트 엔지니어링, RAG, 파인튜닝은 서로 다른 문제를 해결하며, 실제 프로젝트에서 어떤 순서로 접근해야 하는지 명확한 기준이 필요하다.

## 세 전략의 본질

세 가지 전략을 단순하게 요약하면 다음과 같다.

- **프롬프트 엔지니어링**: 모델에게 더 잘 요청하는 방법을 찾는다
- **RAG**: 모델에게 필요한 정보를 검색해 제공한다
- **파인튜닝**: 모델 자체를 변경해 원하는 방향으로 학습시킨다

세 전략은 상호 배타적이지 않다. 최고 성능의 AI 시스템은 보통 세 가지를 모두 조합한다.

![세 전략 완전 비교 매트릭스](/assets/posts/finetuning-vs-prompt-vs-rag-matrix.svg)

## 전략 1: 프롬프트 엔지니어링

항상 가장 먼저 시도해야 하는 방법이다. 추가 인프라 없이 프롬프트 개선만으로 놀라운 성과를 얻을 수 있다.

```python
# 나쁜 프롬프트 → 좋은 프롬프트 진화 예시
from anthropic import Anthropic

client = Anthropic()

# 단계 1: 기본 (나쁜 예)
basic = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "계약서 요약해줘"}]
)

# 단계 2: 역할 + 형식 명시 (개선)
structured = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="""당신은 법률 문서 분석 전문가입니다.
계약서를 분석할 때 항상 다음 형식으로 출력하세요:
1. 핵심 조항 (3개 이내)
2. 위험 요소 (있다면)
3. 놓치기 쉬운 조항""",
    messages=[{"role": "user", "content": f"다음 계약서를 분석하라:\n{contract_text}"}]
)

# 단계 3: 퓨샷 예시 추가 (추가 개선)
few_shot = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="...",
    messages=[
        {"role": "user", "content": "예시 계약서..."},
        {"role": "assistant", "content": "예시 분석 결과..."},  # 퓨샷
        {"role": "user", "content": f"실제 계약서:\n{contract_text}"}
    ]
)
```

**프롬프트 엔지니어링이 충분한 경우**: 작업이 명확히 정의되고, LLM이 이미 그 능력을 보유하며, 추가 데이터나 지식이 필요하지 않은 경우.

## 전략 2: RAG

프롬프트로 해결이 안 되는 **지식 부족** 문제를 해결한다.

```python
from anthropic import Anthropic
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

# RAG 파이프라인
client = Anthropic()
embeddings = OpenAIEmbeddings()
vectorstore = FAISS.load_local("company_docs", embeddings)

def rag_query(user_question: str) -> str:
    # 1. 관련 문서 검색
    docs = vectorstore.similarity_search(user_question, k=5)
    context = "\n\n".join(doc.page_content for doc in docs)

    # 2. 컨텍스트와 함께 LLM 호출
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system="""사내 문서 전문가로서 제공된 컨텍스트만 바탕으로 답변하라.
컨텍스트에 없는 내용은 '해당 정보를 찾을 수 없습니다'로 답하라.""",
        messages=[{
            "role": "user",
            "content": f"컨텍스트:\n{context}\n\n질문: {user_question}"
        }]
    )
    return response.content[0].text

answer = rag_query("연차 휴가 정책이 어떻게 되나요?")
```

**RAG가 필요한 경우**: 모델 학습 데이터에 없는 사내 문서, 최신 정보, 또는 특정 도메인 문서가 필요할 때.

## 전략 3: 파인튜닝

프롬프트와 RAG로도 해결되지 않는 **행동 패턴** 문제를 해결한다.

```python
# Anthropic API를 통한 파인튜닝 데이터 형식
training_data = [
    {
        "messages": [
            {"role": "user", "content": "계약 위반 시 어떻게 해야 하나요?"},
            {
                "role": "assistant",
                "content": """[법적 주의사항] 이 내용은 일반 정보이며 법률 자문이 아닙니다.

계약 위반 발생 시:
1. 즉시 서면으로 상대방에게 통보
2. 위반 증거 문서화
3. 내부 법무팀 또는 외부 변호사 상담

자세한 내용은 법무팀(legal@company.com)에 문의하세요."""
            }
        ]
    }
    # ... 수백 개의 예시
]

# 파인튜닝이 적합한 경우:
# - 항상 특정 면책 조항을 포함해야 할 때
# - 특정 응답 형식을 100% 준수해야 할 때
# - 도메인 전문 용어를 자연스럽게 사용해야 할 때
```

## 세 전략을 결합한 실전 사례

```python
# 실전: 법률 문서 AI 어시스턴트
# = 파인튜닝(스타일) + RAG(지식) + 프롬프트(지시)

class LegalAIAssistant:
    def __init__(self):
        self.client = Anthropic()
        # 파인튜닝된 모델 (법률 응답 형식 학습됨)
        self.model = "ft:claude-haiku-4-5:company:legal-v1:abc123"
        # RAG 컴포넌트
        self.retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    def answer(self, question: str) -> str:
        # RAG: 관련 법률 문서 검색
        docs = self.retriever.invoke(question)
        context = "\n\n".join(d.page_content for d in docs)

        # 파인튜닝 모델 + 프롬프트 조합
        return self.client.messages.create(
            model=self.model,  # 파인튜닝 모델
            max_tokens=2048,
            system="법률 전문가로서 제공된 문서를 바탕으로 답변하라.",  # 프롬프트
            messages=[{
                "role": "user",
                "content": f"관련 문서:\n{context}\n\n질문: {question}"  # RAG 컨텍스트
            }]
        ).content[0].text
```

![전략 선택 플로우차트](/assets/posts/finetuning-vs-prompt-vs-rag-flowchart.svg)

## 황금 원칙: 단순함에서 시작

LLM 프로젝트를 시작할 때 많은 팀이 처음부터 파인튜닝을 고려한다. 그러나 올바른 순서는 다음과 같다.

1. **프롬프트 엔지니어링**으로 시작 → 만족스러우면 완료
2. 지식이 부족하면 **RAG 추가** → 만족스러우면 완료
3. 행동/스타일이 문제면 **파인튜닝 추가** → 가장 나중에

이 순서를 지키면 대부분의 문제를 최소한의 비용으로 해결할 수 있다. 파인튜닝은 강력하지만 데이터 준비, 학습 비용, 평가 등 상당한 공수가 필요하다. 프롬프트 개선으로 해결된다면 파인튜닝 없이 유지하는 것이 훨씬 효율적이다.

---

**지난 글:** [RAG vs 파인튜닝: 언제 무엇을 선택해야 하나](/posts/rag-vs-finetuning/)

**다음 글:** [파인튜닝 완전 정복: 사전 학습 모델을 내 데이터로 특화하는 방법](/posts/finetuning-overview/)

<br>
읽어주셔서 감사합니다. 😊
