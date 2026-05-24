---
title: "LLMOps 개요: LLM 운영의 새로운 과제"
description: "전통 MLOps와 다른 LLMOps의 핵심 개념, 스택 구성, 라이프사이클을 체계적으로 정리합니다. 프롬프트 관리부터 비용 추적, 환각 모니터링까지 LLM 시스템 운영의 전모를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["LLMOps", "MLOps", "프롬프트관리", "LLM모니터링", "비용최적화", "환각감지", "Langfuse"]
featured: false
draft: false
---

[지난 글](/posts/mlops-pipeline/)에서 전통적인 ML 파이프라인 자동화를 다뤘다. LLM이 등장하면서 새로운 운영 패러다임이 필요해졌다. **LLMOps**는 MLOps에서 진화한 개념이지만, 단순한 확장이 아니다. LLM은 기존 ML 모델과 근본적으로 다른 방식으로 움직이기 때문이다.

전통 ML에서는 학습된 가중치를 배포하면 그것이 곧 "모델"이다. 입력 형태가 고정되어 있고, 출력도 예측 가능한 범위 안에 있다. 반면 LLM은 **자연어 프롬프트**로 동작하고, 출력이 본질적으로 비결정적이다. 같은 질문에 다른 답이 나올 수 있고, 올바른 답인지 판단하는 것 자체가 어렵다. 이 차이가 LLMOps라는 별도 영역을 만들어냈다.

## MLOps vs LLMOps: 무엇이 다른가

| 항목 | MLOps | LLMOps |
|------|-------|--------|
| 배포 단위 | 학습된 가중치 | 프롬프트 + (가중치) |
| 성능 지표 | 정량 메트릭(정확도, RMSE) | 정성 평가 + 정량 메트릭 혼합 |
| 실패 모드 | 예측 오류 | 환각, 유해 출력, 탈옥 |
| 비용 구조 | 학습 비용 지배적 | **토큰 단위 추론 비용** 지배적 |
| 재학습 주기 | 월/분기 | 프롬프트 수정은 즉각 배포 가능 |
| 평가 방법 | 자동화 가능 | LLM-as-Judge 등 반자동 필요 |

LLMOps에서 가장 낯선 개념은 **프롬프트가 코드**라는 점이다. 학습 없이 프롬프트 한 줄을 바꾸는 것만으로도 모델의 동작이 완전히 달라진다. 이 "소프트웨어"는 일반 코드처럼 Git으로 버전을 관리하고, 테스트하고, 리뷰해야 한다.

## LLMOps 스택 구조

![LLMOps 스택 전체 구조](/assets/posts/llmops-overview-stack.svg)

LLMOps 스택은 크게 네 레이어로 나뉜다.

**API 게이트웨이**: 모든 LLM 요청이 통과하는 관문이다. 인증, 속도 제한, 로깅, 시맨틱 캐싱이 여기서 이루어진다. LiteLLM 같은 프록시를 사용하면 OpenAI·Anthropic·Google 등 여러 제공자를 단일 인터페이스로 추상화할 수 있다.

**프롬프트 관리**: 프롬프트 템플릿의 버전을 관리하고, A/B 테스트로 어떤 버전이 더 나은지 실측한다. Langfuse나 PromptLayer 같은 도구가 이 역할을 담당한다.

**LLM 라우터**: 요청의 복잡도·비용·지연시간 요건에 따라 적절한 모델로 라우팅한다. 간단한 질문은 소형 모델로, 복잡한 추론은 대형 모델로 보내는 전략이 일반적이다.

**관측성(Observability)**: 각 요청의 토큰 수·비용·레이턴시·품질 점수를 기록하고 대시보드에서 추세를 확인한다.

## LLM 운영 라이프사이클

![LLM 운영 라이프사이클](/assets/posts/llmops-overview-lifecycle.svg)

## 프롬프트 버전 관리 실전

```python
# Langfuse로 프롬프트 버전 관리
from langfuse import Langfuse

lf = Langfuse()

# 프롬프트 등록 (Langfuse UI 또는 API)
lf.create_prompt(
    name="customer-support",
    prompt="당신은 친절한 고객 지원 전문가입니다. {{user_question}}",
    config={"model": "claude-sonnet-4-6", "temperature": 0.3},
    labels=["production"],
)

# 애플리케이션에서 최신 프로덕션 프롬프트 조회
prompt = lf.get_prompt("customer-support", label="production")
compiled = prompt.compile(user_question="환불 정책이 궁금합니다")

# LLM 호출 추적
with lf.trace(name="support-response") as trace:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": compiled}],
    )
    trace.generation(
        prompt=compiled,
        completion=response.content[0].text,
        usage={"input": response.usage.input_tokens,
               "output": response.usage.output_tokens},
    )
```

## 비용 모니터링과 최적화

LLMOps에서 비용은 ML과 달리 **요청마다 발생**한다. 토큰 사용량이 곧 청구액이다.

```python
# 토큰 비용 계산 헬퍼
PRICES = {
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},  # USD per 1M tokens
    "claude-haiku-4-5":  {"input": 0.8, "output": 4.0},
}

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICES[model]
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000

# 일일 비용 임계값 알림
daily_cost = sum(calculate_cost(r.model, r.input_tokens, r.output_tokens)
                 for r in today_requests)
if daily_cost > BUDGET_ALERT_USD:
    send_alert(f"LLM 일일 비용 ${daily_cost:.2f} 초과")
```

비용을 줄이는 대표 전략:
- **시맨틱 캐싱**: 의미적으로 동일한 질문에 캐시된 답변 반환
- **모델 라우팅**: 단순 질문은 저렴한 소형 모델 활용
- **프롬프트 압축**: 불필요한 컨텍스트 제거로 토큰 절감
- **배치 처리**: 실시간이 불필요한 요청은 Batch API 활용

## 환각 모니터링

LLM 고유의 실패 모드인 **환각(Hallucination)** 은 전통 ML에서는 없던 개념이다. 모델이 틀린 정보를 자신있게 출력한다.

```python
# LLM-as-Judge 패턴으로 환각 감지
def check_hallucination(question: str, answer: str, context: str) -> dict:
    judge_prompt = f"""
    다음 질문에 대한 답변이 주어진 컨텍스트에 근거한지 평가하세요.
    질문: {question}
    컨텍스트: {context}
    답변: {answer}
    
    JSON으로 응답: {{"grounded": true/false, "confidence": 0-1, "reason": "..."}}
    """
    result = llm.generate(judge_prompt)
    return parse_json(result)

# 프로덕션 샘플링으로 지속 평가
for request in sample(production_logs, n=100):
    score = check_hallucination(**request)
    log_metric("hallucination_rate", 1 - score["grounded"])
```

## LLMOps 도구 생태계

| 카테고리 | 도구 |
|----------|------|
| 프롬프트 관리 | Langfuse, PromptLayer, LangSmith |
| LLM 라우팅 | LiteLLM, PortKey, BerriAI |
| 관측성 | Langfuse, Helicone, Arize Phoenix |
| 평가 | RAGAS, DeepEval, Braintrust |
| 파인튜닝 | Hugging Face, Modal, RunPod |

---

**지난 글:** [ML 파이프라인 자동화: 끝까지 이어지는 워크플로우](/posts/mlops-pipeline/)

**다음 글:** [LLM 프롬프트 관리: 버전, 테스트, 배포까지](/posts/llmops-prompt-management/)

<br>
읽어주셔서 감사합니다. 😊
