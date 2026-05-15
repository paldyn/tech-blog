---
title: "Zero-shot과 Few-shot Learning: 예시의 힘"
description: "Zero-shot, One-shot, Few-shot 프롬프팅의 원리 차이, 각 방식의 장단점, 좋은 예시를 고르는 방법, 동적 예시 선택(Dynamic Few-shot), 그리고 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["Fewshot", "Zeroshot", "프롬프팅", "ICL", "InContextLearning", "프롬프트엔지니어링", "LLM활용", "GPT3"]
featured: false
draft: false
---

[지난 글](/posts/prompt-engineering/)에서 프롬프트 엔지니어링의 6대 원칙과 기본 구조를 살펴봤다. 이번 글에서는 프롬프트 기법 중 가장 근본적인 두 가지, **Zero-shot과 Few-shot Learning**을 깊이 파고든다. 2020년 GPT-3 논문에서 최초로 체계적으로 제시된 이 개념들은 오늘날 모든 프롬프트 엔지니어링의 기초를 이룬다.

## In-Context Learning: 파인튜닝 없이 학습하다

Few-shot의 이론적 기반은 **In-Context Learning(ICL)**이다. LLM은 파라미터를 업데이트하는 파인튜닝 없이도, **프롬프트에 포함된 예시를 보고 그 패턴을 그 자리에서 학습**해 새로운 입력에 적용할 수 있다.

왜 이것이 가능한가? Transformer 아키텍처의 Self-Attention이 입력의 모든 토큰 간의 관계를 계산하기 때문이다. 예시 입력-출력 쌍들이 컨텍스트로 주어지면, 모델은 그 패턴을 내부 어텐션 메커니즘으로 파악하고 새 입력에 적용한다. 마치 KNN(K-최근접 이웃) 알고리즘처럼, 주어진 예시들에서 유사성을 찾아 예측한다는 분석도 있다.

이것은 GPT-3가 처음 시연했을 때 연구자들을 충격에 빠뜨렸다. 별도의 학습 없이, 단 몇 개의 예시만으로 번역, 분류, 요약, 수학 문제 풀이까지 수행했다. **"크기가 임계점을 넘으면 새로운 능력이 창발한다"**는 스케일링 법칙의 가장 극적인 사례였다.

## Zero-shot: 예시 없이 직접 지시

**Zero-shot Prompting**은 예시 없이 지시만으로 태스크를 수행하는 방식이다.

```python
import anthropic

client = anthropic.Anthropic()

# Zero-shot: 예시 없이 감정 분류
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=50,
    messages=[{
        "role": "user",
        "content": """다음 문장의 감정을 '긍정', '부정', '중립' 중 하나로 분류하세요.
        
문장: "오늘 발표가 생각보다 잘 됐다."
감정:"""
    }]
)
print(response.content[0].text)  # "긍정"
```

Zero-shot이 잘 작동하는 경우는 명확하다. 일반적인 태스크(번역, 요약, 질문 답변), 모델이 이미 잘 학습한 형식, 간단한 지시로 충분한 상황.

Zero-shot이 실패하는 경우: 특수한 출력 형식이 필요할 때, 도메인 특화 용어나 맥락이 필요할 때, 추론 단계가 복잡할 때.

## One-shot과 Few-shot: 예시의 힘

**Few-shot Prompting**은 프롬프트에 입력-출력 쌍의 예시를 포함하는 방식이다.

```python
# Few-shot: 예시 3개로 한국어 감정 분류
few_shot_prompt = """다음 예시를 참고해 문장의 감정을 분류하세요.

예시 1:
문장: "이 영화 진짜 최고야. 두 번 봤어."
감정: 긍정

예시 2:
문장: "버스를 놓쳐서 30분 기다렸어."
감정: 부정

예시 3:
문장: "내일 회의가 오전 10시에 있어."
감정: 중립

이제 분류하세요:
문장: "생각보다 별로였는데 그냥 그랬어."
감정:"""

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=20,
    messages=[{"role": "user", "content": few_shot_prompt}]
)
print(response.content[0].text)  # "중립" 또는 "부정"
```

![Zero-shot vs Few-shot vs One-shot 비교](/assets/posts/prompt-zero-few-shot-comparison.svg)

## 예시 수와 성능의 관계

GPT-3 논문(Brown et al., 2020)은 예시 수와 성능의 관계를 체계적으로 측정했다. 핵심 발견은 다음과 같다.

**예시가 많을수록 성능이 향상된다.** Zero-shot → One-shot → Few-shot 순으로 대부분의 태스크에서 성능이 높아진다.

**수확 체감이 존재한다.** 일반적으로 4~8개 예시에서 성능이 포화되며, 그 이상은 큰 효과 없이 토큰만 소비한다.

**태스크 복잡도에 따라 최적 예시 수가 다르다.** 단순 분류는 2~3개로 충분하고, 복잡한 추론은 5~8개가 필요하다.

## 좋은 예시 선택의 원칙

Few-shot의 성능은 예시의 수만큼 **예시의 질**에 달려 있다.

![Few-shot 예시 설계 원칙](/assets/posts/prompt-zero-few-shot-selection.svg)

실제로 나쁜 예시가 포함되면 Zero-shot보다 오히려 성능이 낮아질 수 있다. 예시 선택 시 핵심 원칙 세 가지:

**다양성:** 클래스/패턴이 고르게 포함돼야 한다. 긍정 예시 5개, 부정 예시 0개로 학습하면 모델이 긍정 편향을 보인다.

**대표성:** 실제 입력 데이터의 분포와 유사해야 한다. 완벽하게 깔끔한 예시만 있고 실제 노이즈가 많은 데이터를 처리하면 성능이 떨어진다.

**간결성:** 예시 자체가 너무 길면 토큰 낭비다. 예시의 요점만 담아야 한다.

## 동적 Few-shot 선택 (Dynamic Few-shot)

정적으로 예시를 정해놓는 것보다 **현재 입력과 가장 유사한 예시를 동적으로 선택**하면 성능이 더 좋다. 이것이 Dynamic Few-shot Selection이다.

```python
from anthropic import Anthropic
import numpy as np

client = Anthropic()

# 예시 풀(pool)과 임베딩
example_pool = [
    {"input": "맛있는 음식 먹었어", "output": "긍정"},
    {"input": "화가 났어", "output": "부정"},
    {"input": "회의 있어", "output": "중립"},
    {"input": "대박이다", "output": "긍정"},
    {"input": "진짜 짜증나", "output": "부정"},
    {"input": "일정이 바뀌었어", "output": "중립"},
]

def cosine_similarity(a: list, b: list) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def get_embedding(text: str) -> list:
    """텍스트 임베딩 (실제로는 임베딩 API 사용)"""
    # 예시: Voyage AI, OpenAI Embedding 등
    # 여기서는 개념 설명용 stub
    pass

def dynamic_few_shot(query: str, k: int = 3) -> str:
    """쿼리와 가장 유사한 k개 예시를 선택해 프롬프트 생성"""
    query_emb = get_embedding(query)
    
    # 유사도 계산 후 상위 k개 선택
    scored = [
        (ex, cosine_similarity(query_emb, get_embedding(ex["input"])))
        for ex in example_pool
    ]
    top_k = sorted(scored, key=lambda x: x[1], reverse=True)[:k]
    
    # 프롬프트 구성
    examples_text = "\n\n".join([
        f"문장: {ex['input']}\n감정: {ex['output']}"
        for ex, _ in top_k
    ])
    
    return f"""다음 예시를 참고해 문장의 감정을 분류하세요.

{examples_text}

문장: {query}
감정:"""
```

Dynamic Few-shot는 특히 **RAG(Retrieval-Augmented Generation)**와 함께 사용할 때 강력하다. 관련 문서를 검색해 컨텍스트로 제공하는 것과 같은 원리다.

## 레이블 vs 형식: 무엇이 더 중요한가

흥미로운 연구 결과가 있다. Min et al.(2022)의 논문 "Rethinking the Role of Demonstrations"에서, Few-shot 예시에서 레이블이 틀려도 성능이 크게 떨어지지 않는 경우가 있다는 것을 발견했다.

즉, 예시에서 가장 중요한 것은 **레이블 자체의 정확성보다 입력-출력의 형식과 길이, 그리고 입력 도메인**이다.

```python
# 실험: 레이블이 틀린 예시 vs 올바른 예시
wrong_label_prompt = """예시:
문장: "정말 행복해" → 부정  ← (틀린 레이블)
문장: "너무 슬퍼" → 긍정   ← (틀린 레이블)

문장: "오늘 기분 최고야"
감정:"""

# 실제로 많은 모델에서 위 프롬프트도 "긍정"을 출력한다
# → 레이블보다 형식과 맥락 패턴이 중요
```

단, 이 발견이 "예시 레이블을 대충 써도 된다"는 의미는 아니다. 태스크가 복잡할수록 정확한 레이블이 중요하며, GPT-3.5/4처럼 강한 모델은 잘못된 레이블에 더 민감하게 반응하는 경향이 있다.

## 실전 사용 전략: 언제 무엇을 쓸까

```python
# 실전 전략 요약 코드
def choose_prompting_strategy(task_complexity: str, token_budget: int) -> str:
    """태스크 복잡도와 토큰 예산에 따른 전략 선택"""
    
    if task_complexity == "simple" and token_budget < 500:
        return "zero-shot"  # 단순 분류, 번역 등
    
    elif task_complexity == "simple" and token_budget >= 500:
        return "one-shot"   # 형식 힌트만 필요한 경우
    
    elif task_complexity == "medium":
        return "few-shot-3"  # 3개 예시로 충분
    
    elif task_complexity == "complex":
        return "few-shot-5-8"  # 다양한 케이스 커버 필요
    
    else:  # 매우 복잡한 추론
        return "chain-of-thought"  # 다음 글에서 다룸

# 실전 Few-shot 템플릿 (재사용 가능)
def build_few_shot_prompt(examples: list[dict], query: str, task_desc: str) -> str:
    example_text = "\n\n".join([
        f"입력: {ex['input']}\n출력: {ex['output']}"
        for ex in examples
    ])
    return f"""{task_desc}

{example_text}

입력: {query}
출력:"""
```

Zero-shot과 Few-shot은 프롬프트 엔지니어링의 가장 기초적인 기법이지만, 올바르게 적용하면 파인튜닝 없이도 놀라운 성능을 달성할 수 있다. 다음 글에서는 더 복잡한 추론 태스크를 위한 **Chain-of-Thought(CoT)** 기법을 깊이 살펴본다. "단계별로 생각하세요"라는 한 문장이 왜 수학 문제 정확도를 2배 높이는지 이유를 분석한다.

---

**지난 글:** [프롬프트 엔지니어링 완전 정복: AI와 대화하는 기술](/posts/prompt-engineering/)

**다음 글:** [Chain-of-Thought 프롬프팅: 단계별 추론의 마법](/posts/prompt-chain-of-thought/)

<br>
읽어주셔서 감사합니다. 😊
