---
title: "시스템 메시지 설계: LLM의 역할과 경계를 정의하다"
description: "시스템 메시지(시스템 프롬프트)의 6가지 구성 요소, 운영자-사용자 우선순위 충돌 처리, Prompt Caching 비용 절감, 실전 설계 패턴, Claude·OpenAI API 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["시스템메시지", "시스템프롬프트", "프롬프트엔지니어링", "LLM", "Claude", "OpenAI", "PromptCaching", "API"]
featured: false
draft: false
---

[지난 글](/posts/prompt-self-consistency/)에서 다수결 앙상블로 정확도를 높이는 Self-Consistency를 살펴봤다. 이번 글에서는 LLM 프로덕션 시스템의 기반이 되는 **시스템 메시지(System Message)** 설계를 다룬다. 잘 설계된 시스템 메시지는 모델의 페르소나, 행동 경계, 출력 형식을 일관되게 제어해준다. 실제 서비스에서 사용자가 보내는 질문이 아무리 다양해도, 시스템 메시지가 탄탄하면 일관된 경험을 제공할 수 있다.

## 시스템 메시지란 무엇인가

시스템 메시지는 사용자 입력보다 **먼저, 그리고 항상** 모델에게 전달되는 지시문이다. API 호출에서 `system` 파라미터로 전달되며, 대화가 진행되는 동안 변하지 않는다. Claude에서는 "운영자(Operator) 지시"로, OpenAI에서는 `role: "system"` 메시지로 구현된다.

시스템 메시지가 없으면 모델은 기본 행동 방식으로 동작한다. 시스템 메시지가 있으면 모델은 그 지시를 최우선 기준으로 삼아 사용자 요청에 응답한다.

## 6가지 구성 요소

![시스템 메시지 해부도](/assets/posts/prompt-system-message-anatomy.svg)

### ① 역할(Role) · 페르소나

모델이 "누구"로 행동할지 정의한다. 단순히 "당신은 AI 어시스턴트입니다"보다, 전문성·경험·관점을 구체적으로 명시할수록 효과적이다.

```python
role_example = """당신은 10년 이상 경력의 시니어 풀스택 엔지니어입니다.
Python(FastAPI), TypeScript(React), PostgreSQL에 깊은 전문성을 가지며,
코드 품질과 성능 최적화를 최우선으로 여깁니다."""
```

### ② 컨텍스트(Context) · 배경

모델이 응답할 때 참고해야 할 환경 정보다. 서비스 성격, 사용자 유형, 현재 상황 등을 담는다.

```python
context_example = """우리 서비스 정보:
- 서비스명: DevHelper Pro
- 대상: 중급~고급 개발자
- 주요 기능: 코드 리뷰, 디버깅 지원, 아키텍처 상담
- 언어: 한국어 우선 (영어 질문 가능)"""
```

### ③ 지시사항(Instructions)

해야 할 것과 하지 말아야 할 것을 명시한다. 부정형("하지 마라")보다 긍정형("이렇게 해라") 지시가 더 잘 따라진다.

```python
instructions_example = """행동 지침:
- 코드 예시는 항상 실행 가능한 완성된 형태로 제공하세요
- 불확실한 정보는 "확실하지 않으나"로 명시하고 대안 탐색을 제안하세요
- 답변 길이: 질문 복잡도에 맞게 조절 (단순 질문 → 간결하게)"""
```

### ④ 출력 형식(Output Format)

응답의 구조, 길이, 마크다운 사용 여부 등을 지정한다.

```python
format_example = """출력 형식:
- 코드 블록에는 반드시 언어 식별자를 붙이세요 (```python, ```typescript)
- 핵심 포인트는 불릿 리스트로 구조화하세요
- 응답이 500토큰을 초과할 경우 마지막에 ## 요약 섹션 추가"""
```

### ⑤ 제약(Constraints) · 경계

안전, 법적, 비즈니스 측면의 경계선이다.

```python
constraints_example = """금지 사항:
- 개인 식별 정보(이름, 이메일, 전화번호)를 그대로 출력하지 마세요
- 보안 취약점을 악용하는 코드는 작성하지 마세요
- 경쟁사(A사, B사) 제품을 직접 비교하거나 평가하지 마세요"""
```

### ⑥ 예시(Examples)

원하는 입출력 패턴을 구체적으로 보여준다. 특히 JSON 형식이나 특수한 출력 구조가 필요할 때 필수적이다.

## 우선순위 충돌과 Prompt Caching

![시스템 메시지 우선순위와 캐싱](/assets/posts/prompt-system-message-priority.svg)

시스템 메시지(운영자)와 사용자 메시지가 충돌할 때 모델은 어떻게 동작해야 하는가? Claude의 경우 **Anthropic > 운영자 > 사용자** 순서의 신뢰 계층이 있다. 시스템 메시지에서 명시적으로 허용하지 않은 것은 사용자가 요청해도 수행하지 않는다.

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM_PROMPT = """당신은 DevHelper Pro의 기술 지원 에이전트입니다.

역할: 코드 관련 질문에 전문적으로 답변
언어: 반드시 한국어로 응답
금지: 코드와 무관한 주제(정치, 종교, 개인사)는 정중히 거절

출력 형식:
1. 핵심 답변 (3문장 이내)
2. 코드 예시 (해당하는 경우)
3. 추가 참고사항 (선택)"""

def ask_dev_helper(
    user_question: str,
    conversation_history: list | None = None,
) -> str:
    messages = conversation_history or []
    messages.append({"role": "user", "content": user_question})

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=messages,
    )
    return response.content[0].text

# 사용 예시
answer = ask_dev_helper("Python에서 async/await와 threading의 차이점은?")
print(answer)
```

시스템 메시지가 1,024 토큰 이상이면 `cache_control: ephemeral`을 설정해 **Prompt Caching**을 활성화할 수 있다. 캐시 히트 시 입력 토큰 비용이 약 90% 절감된다. 동일한 시스템 메시지로 트래픽이 많은 서비스라면 반드시 적용해야 할 최적화다.

## 실전 설계 패턴

### 패턴 1: 도메인 전문가 에이전트

```python
FINANCE_SYSTEM = """당신은 공인 재무분석사(CFA) 자격을 가진 투자 분석 전문가입니다.

컨텍스트: 개인 투자자 대상 정보 제공 플랫폼
규제 준수: 특정 종목 매수·매도 추천은 금지. 교육·정보 제공만 가능.
응답 형식: 
  - 사실과 의견을 명확히 구분 ("~ 데이터에 따르면" vs "~ 판단됩니다")
  - 투자 위험 경고 문구 포함
  - 출처 명시 (블룸버그, 금융감독원 등)"""
```

### 패턴 2: 멀티턴 대화 상태 유지

```python
def build_system_with_state(
    user_name: str,
    subscription_tier: str,
    conversation_topic: str,
) -> str:
    return f"""당신은 개인화된 AI 어시스턴트입니다.

사용자 정보:
- 이름: {user_name}
- 구독 플랜: {subscription_tier}
- 현재 대화 주제: {conversation_topic}

{'고급 기능(코드 실행, 파일 분석) 사용 가능' if subscription_tier == 'pro' else '기본 기능만 제공, 업그레이드 안내 가능'}

응답 시 사용자 이름을 첫 메시지에서만 사용하세요."""
```

### 패턴 3: 언어·톤 제어

```python
TONE_FORMAL = "격식체(~습니다, ~입니다)를 사용하고, 전문 용어를 적절히 활용하세요."
TONE_CASUAL = "편한 구어체(~요)를 사용하고, 이모지를 적절히 활용해 친근감을 주세요."
TONE_TECHNICAL = "전문가 수준 기술 용어를 사용하고, 영문 원어를 병기하세요."
```

## 흔한 실수와 해결책

**실수 1: 너무 많은 지시를 한꺼번에**
LLM도 우선순위가 불명확하면 헷갈린다. 지시사항이 10개를 넘기면 중요도 순으로 정렬하거나, 관련 지시끼리 묶어서 구조화한다.

**실수 2: 부정형 위주의 금지 목록**
"~하지 마세요" 10개보다 "~이렇게 하세요" 5개가 더 효과적이다. 긍정형 지시를 우선으로 작성하고, 정말 중요한 금지사항만 명시한다.

**실수 3: 시스템 메시지와 사용자 프롬프트의 중복**
같은 지시가 두 곳에 있으면 모델이 어느 것을 따라야 할지 혼란스러울 수 있다. 시스템 메시지에는 항상 적용되는 규칙, 사용자 프롬프트에는 그 턴에만 적용되는 요청을 분리한다.

---

**지난 글:** [Self-Consistency: 다수결로 정확도를 높이다](/posts/prompt-self-consistency/)

**다음 글:** [프롬프트 템플릿: 재사용 가능한 프롬프트 설계](/posts/prompt-templates/)

<br>
읽어주셔서 감사합니다. 😊
