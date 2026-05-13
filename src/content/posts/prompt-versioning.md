---
title: "프롬프트 버전 관리: 프롬프트를 코드처럼 관리하기"
description: "프롬프트 버전 관리의 필요성, 시맨틱 버전닝, 생명주기(Draft→Production→Archive), YAML 기반 프롬프트 레지스트리, A/B 테스트, 롤백 전략, 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["프롬프트버전관리", "프롬프트엔지니어링", "LLMOps", "YAML", "GitOps", "A/B테스트", "프롬프트레지스트리", "MLOps"]
featured: false
draft: false
---

[지난 글](/posts/prompt-context-management/)에서 긴 대화와 문서에서 컨텍스트를 효율적으로 관리하는 전략을 다뤘다. 이번 글에서는 프롬프트 자체를 어떻게 관리할지를 다룬다. 프롬프트는 소프트웨어의 "소스 코드"다. 변경 이력이 없으면 어떤 수정이 성능을 떨어뜨렸는지 파악하기 어렵고, 배포 후 문제가 생겨도 되돌리기가 힘들다. **프롬프트 버전 관리**는 이 문제를 해결하는 체계적인 접근법이다.

## 왜 프롬프트 버전 관리가 필요한가

실제 서비스에서 프롬프트는 끊임없이 변한다. 모델 업그레이드, 새로운 엣지 케이스 처리, 성능 최적화, 비용 절감 등 다양한 이유로 수정이 발생한다. 버전 관리 없이 이를 운영하면 세 가지 문제에 직면한다.

1. **재현 불가**: 어떤 프롬프트가 그 시점에 운영됐는지 알 수 없다
2. **롤백 불가**: 새 프롬프트가 성능을 떨어뜨렸을 때 이전 버전으로 즉시 돌아갈 수 없다
3. **비교 불가**: A/B 테스트 결과를 정확히 어떤 프롬프트 차이에서 나온 것인지 알 수 없다

## 시맨틱 버전닝 (Semantic Versioning)

코드와 마찬가지로 프롬프트에도 `MAJOR.MINOR.PATCH` 버전 체계를 적용한다.

```
v1.2.3
│ │ └─ PATCH: 오타 수정, 표현 다듬기 (동작 변화 없음)
│ └─── MINOR: 새 기능 추가, 새 예시 (하위 호환)
└───── MAJOR: 구조적 변경, 출력 형식 변경 (하위 비호환)
```

예를 들어, `v1.1.0` 요약 프롬프트에 Chain-of-Thought를 추가해 동작이 바뀌면 `v1.2.0`이 된다. 오타를 고치면 `v1.1.1`이다.

## YAML 기반 프롬프트 레지스트리

프롬프트를 코드베이스에 YAML로 관리하면 Git으로 변경 이력을 추적할 수 있다.

![프롬프트 생명주기 관리](/assets/posts/prompt-versioning-lifecycle.svg)

```yaml
# prompts/summarizer/v1.2.0.yaml
version: "1.2.0"
name: "document-summarizer"
status: "production"
model: "claude-opus-4-7"
parameters:
  max_tokens: 1024
  temperature: 0.3
changelog: "CoT 추가로 요약 품질 +12%, 레이턴시 +340ms"
rollback_to: "1.1.0"
created_at: "2026-05-13"
author: "PALDYN Team"
template: |
  당신은 전문 문서 분석가입니다.

  다음 {doc_type}을 분석하세요:
  ---
  {content}
  ---

  단계별로 생각해 봅시다:
  1. 핵심 주제 파악
  2. 주요 주장과 근거 식별
  3. 결론 도출

  {style} 스타일로 {length} 분량의 요약을 작성하세요.
metrics:
  rouge_l: 0.82
  user_rating: 4.3
  latency_ms: 1480
  cost_per_1k: 0.12
```

```python
import yaml
from pathlib import Path
from functools import lru_cache

class PromptRegistry:
    def __init__(self, registry_dir: str = "prompts/"):
        self.registry_dir = Path(registry_dir)
        self._cache: dict = {}

    @lru_cache(maxsize=64)
    def load(self, name: str, version: str = "latest") -> dict:
        """특정 버전의 프롬프트 로드"""
        if version == "latest":
            version = self._find_latest_production(name)

        path = self.registry_dir / name / f"v{version}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"프롬프트 없음: {name} v{version}")

        with open(path) as f:
            return yaml.safe_load(f)

    def _find_latest_production(self, name: str) -> str:
        """production 상태의 최신 버전 찾기"""
        versions = []
        for f in (self.registry_dir / name).glob("v*.yaml"):
            with open(f) as fp:
                data = yaml.safe_load(fp)
            if data.get("status") == "production":
                versions.append(data["version"])

        if not versions:
            raise ValueError(f"Production 버전 없음: {name}")

        return sorted(versions, key=lambda v: tuple(int(x) for x in v.split(".")))[-1]

    def render(self, name: str, version: str = "latest", **kwargs) -> str:
        """프롬프트 렌더링"""
        prompt_data = self.load(name, version)
        return prompt_data["template"].format(**kwargs)

    def rollback(self, name: str) -> str:
        """이전 버전으로 롤백"""
        current = self.load(name)
        rollback_to = current.get("rollback_to")
        if not rollback_to:
            raise ValueError("롤백 대상 버전 없음")

        # 현재 버전을 staging으로, 롤백 버전을 production으로
        print(f"롤백: v{current['version']} → v{rollback_to}")
        return rollback_to

# 사용
registry = PromptRegistry("prompts/")
prompt = registry.render(
    "summarizer",
    doc_type="계약서",
    content="제1조 목적...",
    style="비즈니스",
    length="200자",
)
```

## A/B 테스트와 점진적 롤아웃

새 버전을 바로 100% 적용하면 위험하다. 소량의 트래픽에 먼저 노출해 검증한다.

![프롬프트 A/B 테스트 흐름](/assets/posts/prompt-versioning-ab.svg)

```python
import hashlib
import anthropic

client = anthropic.Anthropic()
registry = PromptRegistry()

def get_prompt_version(user_id: str, experiment_name: str) -> str:
    """사용자 ID 해시로 일관된 버전 할당"""
    hash_val = int(hashlib.md5(f"{user_id}:{experiment_name}".encode()).hexdigest(), 16)
    bucket = hash_val % 100  # 0~99

    # 20%는 B 버전 (challenger)
    if bucket < 20:
        return "1.2.0"
    else:
        return "1.1.0"

def summarize_with_ab(
    user_id: str,
    content: str,
    doc_type: str = "문서",
) -> dict:
    """A/B 테스트 적용 요약"""
    version = get_prompt_version(user_id, "summarizer-cot-test")
    prompt = registry.render(
        "summarizer",
        version=version,
        content=content,
        doc_type=doc_type,
        style="간결하게",
        length="100자",
    )

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "summary": response.content[0].text,
        "prompt_version": version,
        "user_id": user_id,
        "tokens_used": response.usage.output_tokens,
    }
```

## Git으로 프롬프트 변경 이력 추적

```bash
# 프롬프트 변경 → 커밋 → 코드 리뷰 → 병합 워크플로
git checkout -b feat/summarizer-v1.2.0
# ... YAML 수정 ...
git add prompts/summarizer/v1.2.0.yaml
git commit -m "prompt: summarizer v1.2.0 - CoT 추가"
# PR 생성 → 리뷰 → main 병합 후 배포
```

```python
def get_prompt_git_hash(prompt_path: str) -> str:
    """현재 프롬프트 파일의 Git 커밋 해시"""
    import subprocess
    result = subprocess.run(
        ["git", "log", "-1", "--format=%H", "--", prompt_path],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def log_inference(prompt_name: str, version: str, result: dict) -> None:
    """추론 결과와 프롬프트 버전 함께 로깅"""
    import json, datetime
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "prompt_name": prompt_name,
        "prompt_version": version,
        "tokens_in": result.get("tokens_in"),
        "tokens_out": result.get("tokens_out"),
        "latency_ms": result.get("latency_ms"),
        "user_rating": result.get("user_rating"),
    }
    with open("logs/prompt_metrics.jsonl", "a") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
```

## Anthropic Workbench와 외부 도구

수동 YAML 관리 외에도 전문 도구들이 있다.

- **Anthropic Console Workbench**: 프롬프트 실험과 버전 비교를 브라우저에서 할 수 있다
- **LangSmith (LangChain)**: 프롬프트 허브, 실험 추적, A/B 테스트 기능 제공
- **PromptLayer**: 프롬프트 버전 관리 전문 SaaS
- **MLflow**: 실험 추적과 모델 레지스트리, 프롬프트도 아티팩트로 관리 가능

작은 팀이라면 Git + YAML로 시작해도 충분하다. 조직이 커지면 LangSmith나 PromptLayer 같은 전문 도구로 이전하는 것을 권장한다.

---

**지난 글:** [컨텍스트 관리: 긴 대화에서 LLM이 기억을 유지하는 방법](/posts/prompt-context-management/)

**다음 글:** [프롬프트 평가: 좋은 프롬프트를 측정하는 방법](/posts/prompt-evaluation/)

<br>
읽어주셔서 감사합니다. 😊
