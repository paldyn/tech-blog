---
title: "AI 고객 지원 자동화: 티켓 분류부터 답변 생성까지"
description: "AI를 활용해 고객 문의를 자동 분류하고, FAQ를 기반으로 답변을 생성하며, 복잡한 케이스는 상담원에게 에스컬레이션하는 고객 지원 자동화 시스템을 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["고객지원", "티켓분류", "에스컬레이션", "AI자동화", "챗봇", "감정분석", "CRM연동"]
featured: false
draft: false
---

[지난 글](/posts/app-internal-search/)에서 사내 지식을 검색하는 시스템을 만들었다. 이번에는 외부 고객을 대상으로 하는 **AI 고객 지원 자동화** 시스템을 구축한다. 24/7 즉각 응답, 일관된 품질, 상담원 업무 부담 감소가 핵심 목표다. 단, AI가 모든 것을 처리하려 하면 안 된다. 복잡하거나 감정적으로 예민한 케이스는 반드시 사람 상담원에게 넘겨야 한다.

## 자동화 범위 정의

AI가 처리할 수 있는 것과 그렇지 않은 것을 명확히 구분하는 것이 설계의 출발점이다.

**AI 자동 처리 가능**: FAQ 질문(배송 정책, 반품 규정, 제품 사양), 주문 상태 조회, 계정 기본 정보 확인, 일반 기술 지원(재시작, 설정 방법).

**상담원 에스컬레이션 필요**: 환불 요청(금액이 크거나 정책 예외), 보안/계정 침해 의심, 법적 분쟁 가능성, 감정적으로 격앙된 고객, AI가 3번 이상 답변 실패한 케이스.

![AI 고객 지원 처리 워크플로우](/assets/posts/app-customer-support-workflow.svg)

## 티켓 분류기 구현

첫 번째 단계는 들어온 문의를 카테고리, 우선순위, 감정으로 분류하는 것이다.

```python
import anthropic
import json

client = anthropic.Anthropic()

CLASSIFY_SYSTEM = """고객 문의를 분석하고 다음 JSON 형식으로 응답하세요.
응답 형식:
{
  "category": "billing|technical|shipping|account|general",
  "priority": "critical|high|medium|low",
  "sentiment": "positive|neutral|negative|angry",
  "can_auto_reply": true,
  "summary": "문의 내용 한 줄 요약"
}
JSON 외 다른 텍스트는 출력하지 마세요."""

def classify_ticket(ticket_text: str) -> dict:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",  # 빠르고 저렴한 모델로 분류
        max_tokens=256,
        system=CLASSIFY_SYSTEM,
        messages=[{"role": "user", "content": ticket_text}],
    )
    return json.loads(response.content[0].text)
```

분류에는 비용이 저렴하고 빠른 Claude Haiku를 사용한다. 분류 결과에서 `can_auto_reply: false`이거나 `priority: critical`이면 즉시 에스컬레이션한다.

## FAQ 기반 자동 답변 생성

FAQ 지식베이스와 RAG를 결합해 자동 답변을 생성한다.

```python
def generate_auto_reply(ticket: str, classification: dict, conn) -> str | None:
    # 자동 답변 불가 케이스
    if not classification.get("can_auto_reply"):
        return None
    if classification.get("sentiment") in ("angry",):
        return None

    # FAQ에서 관련 내용 검색
    faq_chunks = retrieve_faq_chunks(ticket, top_k=3, conn=conn)
    if not faq_chunks:
        return None

    context = "\n\n".join(faq_chunks)

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=(
            "당신은 친절하고 전문적인 고객 지원 담당자입니다. "
            "주어진 FAQ 내용을 바탕으로 고객 문의에 답변하세요. "
            "FAQ에 없는 내용은 담당자 연결을 안내하세요. "
            "항상 정중하고 공감적인 톤을 유지하세요."
        ),
        messages=[
            {
                "role": "user",
                "content": f"FAQ 내용:\n{context}\n\n고객 문의:\n{ticket}",
            }
        ],
    )
    return response.content[0].text
```

## 에스컬레이션 로직

AI가 처리하지 못하는 케이스를 상담원에게 넘길 때 중요한 것은 **컨텍스트 전달**이다. 상담원이 처음부터 상황을 파악하지 않아도 되도록 AI가 정리해서 넘긴다.

```python
def escalate_to_agent(ticket: str, classification: dict, reason: str) -> dict:
    # AI가 상담원을 위한 요약 생성
    summary_response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system="고객 문의를 상담원이 빠르게 파악할 수 있도록 3줄 이내로 요약하세요.",
        messages=[{"role": "user", "content": ticket}],
    )

    return {
        "ticket": ticket,
        "classification": classification,
        "escalation_reason": reason,
        "agent_summary": summary_response.content[0].text,
        "suggested_template": get_template(classification["category"]),
        "priority_queue": classification["priority"],
    }

def should_escalate(classification: dict, reply_attempts: int) -> tuple[bool, str]:
    if classification["priority"] == "critical":
        return True, "긴급 케이스"
    if classification["sentiment"] == "angry":
        return True, "고객 감정 격앙"
    if not classification["can_auto_reply"]:
        return True, "자동 답변 불가 카테고리"
    if reply_attempts >= 3:
        return True, "자동 답변 3회 실패"
    return False, ""
```

![에스컬레이션 우선순위 기준](/assets/posts/app-customer-support-escalation.svg)

## 감정 분석과 공감 응답

고객이 화가 나 있거나 실망한 상태라면 답변 톤이 완전히 달라야 한다. 냉정하고 절차적인 답변은 상황을 악화시킨다.

```python
EMPATHETIC_SYSTEM = """당신은 공감 능력이 뛰어난 고객 지원 담당자입니다.
규칙:
1. 먼저 고객의 불편함에 진심으로 공감을 표현하세요
2. 문제를 인정하고 책임감 있는 자세를 보여주세요
3. 구체적인 해결 방법이나 다음 단계를 명확히 안내하세요
4. 프로모션이나 보상을 임의로 약속하지 마세요"""

def generate_empathetic_reply(ticket: str, context: str) -> str:
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        system=EMPATHETIC_SYSTEM,
        messages=[
            {"role": "user", "content": f"관련 정보:\n{context}\n\n고객 메시지:\n{ticket}"}
        ],
    )
    return response.content[0].text
```

## 품질 관리와 A/B 테스트

자동 답변의 품질을 지속적으로 측정하고 개선한다.

```python
import random

def process_ticket(ticket_text: str, conn) -> dict:
    classification = classify_ticket(ticket_text)
    should_esc, reason = should_escalate(classification, reply_attempts=0)

    if should_esc:
        return {"type": "escalation", "data": escalate_to_agent(ticket_text, classification, reason)}

    # A/B 테스트: 10%는 상담원 처리로 샘플링 (품질 기준선 유지)
    if random.random() < 0.1:
        return {"type": "quality_sample", "data": escalate_to_agent(ticket_text, classification, "품질 샘플링")}

    reply = generate_auto_reply(ticket_text, classification, conn)
    if reply is None:
        return {"type": "escalation", "data": escalate_to_agent(ticket_text, classification, "답변 생성 실패")}

    return {"type": "auto_reply", "reply": reply, "classification": classification}
```

A/B 테스트로 자동 답변 품질을 사람 답변과 지속적으로 비교한다. CSAT(고객 만족도) 점수가 특정 임계값 아래로 내려가면 자동화 비율을 줄이는 회로 차단기(circuit breaker)도 구현한다.

## 운영 지표

고객 지원 자동화 성공 여부는 다음 지표로 측정한다.

- **자동 처리율(Containment Rate)**: 전체 문의 중 상담원 에스컬레이션 없이 처리된 비율. 목표: 60~75%.
- **CSAT(Customer Satisfaction Score)**: 자동 답변 만족도. 상담원 답변 대비 5% 이내 차이 유지.
- **첫 답변 시간(FRT, First Response Time)**: AI는 즉시 응답. 에스컬레이션 시 SLA 내 응답.
- **재문의율**: 같은 문제로 다시 연락하는 비율. 낮을수록 답변 품질이 좋다.

---

**지난 글:** [사내 지식 검색 시스템 구축](/posts/app-internal-search/)

**다음 글:** [AI 콘텐츠 생성 자동화 파이프라인](/posts/app-content-generation/)

<br>
읽어주셔서 감사합니다. 😊
