---
title: "LLM 프롬프트 관리: 버전, 테스트, 배포까지"
description: "프롬프트를 코드처럼 버전 관리하고, A/B 테스트로 개선을 측정하며, CI/CD에 통합하는 프롬프트 엔지니어링 운영 체계를 Langfuse 실전 예제와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["프롬프트관리", "LLMOps", "Langfuse", "A/B테스트", "버전관리", "프롬프트엔지니어링"]
featured: false
draft: false
---

[지난 글](/posts/llmops-overview/)에서 LLMOps의 전체 그림을 살펴봤다. 이번 글에서는 그 중에서도 가장 독특한 영역인 **프롬프트 관리**를 집중적으로 다룬다. 프롬프트는 코드이고, 코드는 관리되어야 한다.

많은 팀이 프롬프트를 하드코딩된 문자열로 관리한다. 코드 파일 안에 `system_prompt = "..."` 형태로 박혀 있다. 이렇게 하면 프롬프트를 수정할 때마다 코드 배포가 필요하고, 어떤 버전이 어떤 성능을 냈는지 추적할 수 없으며, A/B 테스트는 꿈도 꾸기 어렵다. **프롬프트 레지스트리**는 이 문제를 해결한다.

## 프롬프트 관리의 세 원칙

**1. 외부화**: 프롬프트를 코드 파일에서 분리해 별도 저장소에 보관한다. 애플리케이션은 런타임에 레지스트리에서 최신 프롬프트를 조회한다.

**2. 버전 관리**: 모든 프롬프트 변경에 버전 번호를 부여하고, 변경 이유와 성능 변화를 기록한다. Git 커밋 히스토리처럼 언제든 이전 버전으로 돌아갈 수 있어야 한다.

**3. 측정**: 프롬프트 변경의 영향을 데이터로 증명한다. "이 버전이 더 좋은 것 같아"가 아니라 "이 버전이 LLM 평가 점수 기준 0.04점 높다"로 말할 수 있어야 한다.

## 프롬프트 관리 워크플로우

![프롬프트 관리 워크플로우](/assets/posts/llmops-prompt-management-flow.svg)

## Langfuse 설정과 기본 사용법

```bash
pip install langfuse
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_HOST="https://cloud.langfuse.com"
```

```python
from langfuse import Langfuse
import anthropic

lf = Langfuse()
claude = anthropic.Anthropic()

# 프롬프트 등록 (최초 1회 또는 업데이트 시)
lf.create_prompt(
    name="document-summarizer",
    type="chat",
    prompt=[
        {
            "role": "system",
            "content": "당신은 전문 요약 작가입니다. 핵심만 담은 간결한 요약을 작성하세요."
        },
        {
            "role": "user",
            "content": "다음 문서를 {{length}}줄 이내로 요약해주세요:\n\n{{document}}"
        }
    ],
    config={
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
        "temperature": 0.3,
    },
    labels=["production"],
)

# 런타임에서 프롬프트 조회 및 사용
def summarize(document: str, length: int = 3) -> str:
    prompt = lf.get_prompt("document-summarizer", label="production")
    messages = prompt.compile(document=document, length=length)

    with lf.trace(name="summarize") as trace:
        response = claude.messages.create(
            model=prompt.config["model"],
            max_tokens=prompt.config["max_tokens"],
            messages=messages,
        )
        text = response.content[0].text
        trace.generation(
            name="claude-response",
            model=prompt.config["model"],
            input=messages,
            output=text,
            usage={
                "input": response.usage.input_tokens,
                "output": response.usage.output_tokens,
            },
        )
    return text
```

## A/B 테스트 설계

![프롬프트 A/B 테스트 구조](/assets/posts/llmops-prompt-management-ab.svg)

```python
import hashlib

def get_prompt_variant(user_id: str, experiment: str) -> str:
    """사용자 ID를 기반으로 일관된 variant 할당 (같은 사용자는 항상 같은 variant)"""
    hash_val = int(hashlib.md5(f"{user_id}:{experiment}".encode()).hexdigest(), 16)
    bucket = hash_val % 100  # 0~99
    return "treatment" if bucket < 30 else "control"  # 30% treatment

def summarize_with_experiment(document: str, user_id: str) -> str:
    variant = get_prompt_variant(user_id, "cot-summarizer-v2")
    label = "staging" if variant == "treatment" else "production"

    prompt = lf.get_prompt("document-summarizer", label=label)
    messages = prompt.compile(document=document, length=3)

    with lf.trace(name="summarize", tags=[f"variant:{variant}"]) as trace:
        response = claude.messages.create(
            model=prompt.config["model"],
            max_tokens=prompt.config["max_tokens"],
            messages=messages,
        )
        text = response.content[0].text
        # Langfuse에 variant 정보와 함께 로깅 → 대시보드에서 비교 가능
        trace.update(metadata={"variant": variant, "prompt_version": prompt.version})

    return text
```

## CI에서 프롬프트 자동 평가

프롬프트를 PR로 변경할 때 CI가 자동으로 평가 점수를 계산하고, 임계값 미달 시 merge를 막는다.

```python
# tests/test_prompts.py (pytest)
import pytest
from src.summarizer import summarize
from src.evaluator import llm_judge

TEST_CASES = [
    {
        "document": "..." ,  # 긴 문서
        "expected_topics": ["핵심 주제", "결론"],
        "max_sentences": 5,
    },
]

@pytest.mark.parametrize("case", TEST_CASES)
def test_summarizer_quality(case):
    summary = summarize(case["document"])
    
    # LLM-as-Judge로 품질 평가
    score = llm_judge(
        prompt=f"요약 품질을 1~5점으로 평가하세요. 문서: {case['document'][:500]}... 요약: {summary}",
        criteria=["간결성", "정확성", "완성도"],
    )
    
    assert score >= 3.5, f"요약 품질 임계값 미달: {score:.2f}"
    assert len(summary.split("\n")) <= case["max_sentences"]
```

```yaml
# .github/workflows/prompt-eval.yml
name: Prompt Evaluation
on: [pull_request]
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest tests/test_prompts.py -v --tb=short
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
```

## 프롬프트 파일 구조 (Git 기반 관리)

Langfuse 같은 SaaS가 없을 때는 Git에 YAML로 프롬프트를 관리하는 방법도 실용적이다.

```yaml
# prompts/document-summarizer/v2.yaml
name: document-summarizer
version: 2
description: "Chain-of-Thought 추가 버전"
created_at: "2026-05-01"
author: "alice@company.com"

system: |
  당신은 전문 요약 작가입니다.
  먼저 문서의 핵심 주제를 파악하고,
  그 다음 {{length}}줄 이내로 요약을 작성하세요.

user: |
  문서:
  {{document}}

config:
  model: claude-sonnet-4-6
  temperature: 0.3
  max_tokens: 1024

eval:
  baseline_version: 1
  score_delta: +0.04
  test_dataset: datasets/summarizer-eval-v2.json
```

## 프롬프트 변경 리뷰 체크리스트

코드 리뷰처럼 프롬프트 변경에도 리뷰어가 확인할 항목이 있다.

- **의도 명확성**: 프롬프트가 원하는 동작을 정확히 명세하는가
- **경계 케이스**: 빈 입력, 매우 긴 입력, 특수 문자 입력에서 동작이 안정적인가
- **보안**: 프롬프트 인젝션 취약점이 없는가
- **비용 영향**: 프롬프트 길이 변화로 토큰 비용이 얼마나 증가하는가
- **평가 결과**: 자동화 평가 점수가 기존 버전 대비 개선됐는가

---

**지난 글:** [LLMOps 개요: LLM 운영의 새로운 과제](/posts/llmops-overview/)

**다음 글:** [LLM 평가 파이프라인: 자동화된 품질 보장](/posts/llmops-eval-pipelines/)

<br>
읽어주셔서 감사합니다. 😊
