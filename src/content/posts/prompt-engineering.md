---
title: "프롬프트 엔지니어링 완전 정복: AI와 대화하는 기술"
description: "프롬프트 엔지니어링의 핵심 원칙, System/User 프롬프트 구조, 역할 부여·제약 명시·형식 지정 기법, 실전 패턴 10가지, 그리고 Claude/GPT/Gemini 각 모델별 차이를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["프롬프트엔지니어링", "PromptEngineering", "LLM활용", "SystemPrompt", "AI프롬프트", "ChatGPT활용", "Claude활용", "AI기술"]
featured: false
draft: false
---

[지난 글](/posts/llm-comparison-benchmarks/)에서 LLM 벤치마크와 평가 방법론을 살펴봤다. 이제부터는 LLM을 실제로 잘 활용하는 기술로 넘어간다. 그 첫 번째 주제가 **프롬프트 엔지니어링(Prompt Engineering)**이다. "AI에게 어떻게 말하느냐"가 결과의 70%를 결정한다는 말이 있을 정도로, 프롬프트는 LLM 활용의 핵심이다.

## 프롬프트 엔지니어링이란

프롬프트 엔지니어링은 LLM이 원하는 결과를 내도록 **입력을 설계하는 기술**이다. 단순히 "잘 물어보는 것"이 아니다. LLM의 동작 원리를 이해하고, 모델이 올바르게 추론할 수 있는 환경을 만들어주는 체계적인 접근이다.

왜 이것이 중요한가? LLM은 자기회귀 방식으로 텍스트를 생성한다. 첫 번째 토큰이 이어지는 토큰들의 방향을 결정하고, 초반 맥락이 전체 출력에 영향을 미친다. 즉, **처음 프롬프트를 어떻게 설계하느냐가 전체 답변의 품질을 결정**한다.

## 프롬프트의 기본 구조: System과 User

현대 LLM API는 대부분 두 가지 메시지 타입을 지원한다.

**System Prompt:** 모델의 기본 행동 방식, 역할, 형식, 언어 등을 설정한다. 대화 내내 지속적으로 유효하다. 모델에게 "이 대화에서 너는 어떤 존재인가"를 정의한다.

**User Prompt:** 실제 사용자의 요청이다. 구체적인 질문, 태스크, 데이터를 포함한다.

```python
import anthropic

client = anthropic.Anthropic()

# 잘 설계된 프롬프트 구조
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system="""당신은 10년 경력의 시니어 파이썬 백엔드 개발자입니다.

응답 형식:
1. 간략한 설명 (2-3문장)
2. 구현 코드 (Python 3.11+, 타입 힌트 포함)
3. 주의사항 또는 개선 방향

언어: 한국어로 답변, 코드 주석은 영어
금지사항: 기본적인 개념 설명 반복 금지""",
    messages=[
        {
            "role": "user",
            "content": """컨텍스트: FastAPI + PostgreSQL(asyncpg) 프로젝트
            
요청: 대용량 데이터 조회를 위한 cursor-based 페이지네이션 구현
제약: offset 방식 금지 (성능 이슈), 정렬 기준은 created_at DESC"""
        }
    ]
)
print(response.content[0].text)
```

![프롬프트 구조 분해](/assets/posts/prompt-engineering-structure.svg)

## 6대 핵심 원칙

![프롬프트 엔지니어링 6대 원칙](/assets/posts/prompt-engineering-principles.svg)

**원칙 1: 역할 부여(Role Assignment)**

"당신은 전문가입니다"처럼 구체적인 페르소나를 부여하면, 모델은 해당 역할에 맞는 어투, 전문성, 접근 방식으로 응답한다. "파이썬 개발자"보다 "Python 백엔드 스타트업에서 FastAPI와 PostgreSQL을 주로 사용하는 시니어 엔지니어"처럼 구체적일수록 좋다.

**원칙 2: 명확한 태스크 정의**

"설명해줘"는 너무 모호하다. "3개 불릿 포인트로, 각 항목 2문장 이내로 요약해줘"처럼 출력 형식을 명시하라. "짧게"보다 "100단어 이내", "자세히"보다 "각 단계를 코드 예시와 함께 설명" 같은 구체적 지시가 훨씬 효과적이다.

**원칙 3: 충분한 컨텍스트**

모델은 당신의 상황을 모른다. 사용 기술 스택, 대상 독자, 프로젝트 목적, 이미 시도한 방법 등을 제공하면 모델이 훨씬 적절한 답을 낸다.

**원칙 4: 예시 포함(Few-shot)**

"이런 형식으로" 한 가지 예시만 보여줘도 모델의 출력 품질이 크게 오른다. 입력-출력 쌍 2~3개를 보여주면 Zero-shot 대비 대부분의 태스크에서 성능이 향상된다.

**원칙 5: 제약 및 금지사항 명시**

"~하지 마세요"도 중요하다. "서론 없이", "결론 없이", "markdown 형식 없이", "코드만" 같은 네거티브 지시가 불필요한 출력을 줄인다.

**원칙 6: 단계별 사고 요청**

"단계별로 생각한 다음 답하세요"처럼 Chain-of-Thought를 유도하면 복잡한 추론 태스크에서 정확도가 크게 향상된다.

## 실전 프롬프트 패턴 10가지

**패턴 1: 전문가 코드 리뷰**

```python
SYSTEM = """당신은 엄격한 코드 리뷰어입니다.
리뷰 형식:
[심각도: 높음/중간/낮음] 문제 설명
→ 개선 방법 (코드 포함)

보안 > 성능 > 가독성 순으로 우선순위."""

USER = """다음 코드를 리뷰해주세요:
def get_user(db, user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return db.execute(query).fetchone()"""
```

**패턴 2: 구조화된 데이터 추출**

```python
SYSTEM = """텍스트에서 정보를 추출해 JSON으로 반환합니다.
스키마: {"name": str, "date": "YYYY-MM-DD", "amount": float}
확인 불가 필드는 null로 설정."""

USER = """다음 영수증에서 정보를 추출해줘:
스타벅스 강남점 2024년 3월 15일 아메리카노 4,500원"""
```

**패턴 3: 단계별 문제 해결**

```python
SYSTEM = """복잡한 문제는 다음 순서로 접근하세요:
1. 문제 분해: 핵심 요소 파악
2. 각 요소 분석: 개별 해결책
3. 통합: 전체 해결책 제시
4. 검증: 엣지 케이스 확인"""
```

## 모델별 프롬프트 차이점

각 LLM 모델은 미묘하게 다른 특성을 갖는다.

**Claude(Anthropic):** System Prompt를 매우 충실히 따른다. "절대 하지 마세요"처럼 강한 지시에도 잘 반응한다. 긴 컨텍스트에서 일관성을 잘 유지한다. XML 태그(`<instruction>`, `<context>`) 사용이 효과적이다.

```python
# Claude에 효과적인 XML 구조
SYSTEM = """<role>시니어 개발자</role>
<rules>
- 한국어로 답변
- 코드 예시 필수 포함
- 추측 대신 "확인 필요"로 표시
</rules>"""
```

**GPT-4(OpenAI):** 창의적 태스크에서 강하다. 지시를 약간 유연하게 해석하는 경향. JSON 형식 지시에 잘 반응한다. `response_format={"type": "json_object"}` 파라미터 사용 가능.

**Gemini(Google):** 멀티모달 프롬프트에서 강점. 구글 생태계 통합 사용 시 효과적. 긴 컨텍스트(1M 토큰) 활용 시 효율적 구조화 필요.

## 프롬프트 이터레이션: 개선 사이클

좋은 프롬프트는 한 번에 완성되지 않는다. 체계적인 이터레이션이 필요하다.

```python
# 프롬프트 버전 관리 및 평가 구조
class PromptExperiment:
    def __init__(self, system: str, user_template: str):
        self.system = system
        self.user_template = user_template
        self.results = []
    
    def run(self, test_cases: list[dict], client) -> float:
        """여러 테스트 케이스로 프롬프트 평가"""
        scores = []
        for case in test_cases:
            user = self.user_template.format(**case["input"])
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=self.system,
                messages=[{"role": "user", "content": user}]
            )
            output = response.content[0].text
            score = case["eval_fn"](output)  # 평가 함수
            scores.append(score)
        
        avg_score = sum(scores) / len(scores)
        self.results.append(avg_score)
        return avg_score
```

## 흔한 실수와 해결법

**실수 1: 너무 긴 System Prompt.** 지시가 많아지면 모델이 일부를 무시한다. 핵심 지시 3~5개로 집중하라.

**실수 2: 모순된 지시.** "짧게 답하면서 자세히 설명해줘"처럼 상충하는 지시는 모델을 혼란시킨다.

**실수 3: 부정적 지시만 사용.** "~하지 마세요"만 쓰면 모델이 무엇을 해야 할지 모른다. 항상 긍정적 대안을 함께 제공하라.

**실수 4: 결과를 기대하고 프롬프트를 설계하지 않는 것.** 원하는 출력을 먼저 구체적으로 적고, 그 출력을 만들려면 어떤 입력이 필요한지를 역으로 설계하라.

프롬프트 엔지니어링의 기초를 다졌다. 다음 글에서는 프롬프트 기법 중 가장 기본이 되는 **Zero-shot과 Few-shot Learning**을 깊이 파고든다. 예시의 수와 위치가 성능에 어떻게 영향을 미치는지 실험 결과와 함께 살펴본다.

---

**지난 글:** [LLM 벤치마크 완전 해부: MMLU, HumanEval, LMSYS Chatbot Arena](/posts/llm-comparison-benchmarks/)

**다음 글:** [Zero-shot과 Few-shot Learning: 예시의 힘](/posts/prompt-zero-few-shot/)

<br>
읽어주셔서 감사합니다. 😊
