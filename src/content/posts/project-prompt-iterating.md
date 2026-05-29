---
title: "프롬프트 반복 개발: 체계적인 이터레이션 워크플로우"
description: "감으로 프롬프트를 고치는 시대는 끝났다. 버전 관리, A/B 테스트, 자동 채점, 회귀 테스트를 갖춘 체계적인 프롬프트 이터레이션 시스템을 처음부터 구축한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["프롬프트엔지니어링", "PromptOps", "A/B테스트", "버전관리", "프로젝트", "반복개발"]
featured: false
draft: false
---

[지난 글](/posts/project-evaluation-harness/)에서 LLM 성능을 체계적으로 측정하는 평가 하네스를 구축했다. 이제 그 평가 시스템을 무기로 삼아 프롬프트 자체를 과학적으로 개선해야 한다. "이 문장을 조금 더 자세하게 설명하게 바꿔보자"처럼 감으로 프롬프트를 고치는 방식은 개선인지 퇴보인지 알 수 없다. 이 글에서는 YAML 기반 프롬프트 버전 관리, 자동화된 A/B 테스트, 회귀 테스트 스위트, Git 기반 프롬프트 히스토리까지 체계적인 프롬프트 이터레이션 시스템을 처음부터 만들어본다.

## 즉흥적 이터레이션의 문제

대부분의 팀이 프롬프트를 개선하는 방식은 대략 이렇다. 모델 출력이 마음에 들지 않으면 시스템 프롬프트를 직접 열어 문장을 수정하고, 몇 가지 예시를 다시 실행해보고, "괜찮은 것 같다"고 판단하면 배포한다. 이 방식에는 여러 구조적 문제가 있다.

**이력 부재**: 어떤 변경이 어떤 이유로 이루어졌는지 알 수 없다. 3개월 뒤 "왜 이렇게 됐지?"라는 질문에 답할 수 없다.

**회귀 무감각**: 특정 케이스를 개선하면서 다른 케이스에 회귀가 발생해도 모른다. 테스트 커버리지가 없기 때문이다.

**재현 불가능한 비교**: "이전 버전보다 나아졌나요?"라는 질문에 정량적으로 대답할 수 없다.

**협업 불가**: 프롬프트가 하드코딩되어 있으면 여러 명이 동시에 작업하기 어렵고 코드 리뷰도 불가능하다.

## 프롬프트를 코드처럼: YAML 템플릿

첫 단계는 프롬프트를 코드에서 분리해 독립된 파일로 관리하는 것이다. YAML은 멀티라인 텍스트와 메타데이터를 함께 표현하기 좋아 프롬프트 템플릿에 적합하다.

```yaml
# prompts/summarizer/v2.0.yaml
version: "2.0"
name: "article-summarizer"
description: "기사 요약 프롬프트 — CoT 방식 적용, 3문장 제한"
created_at: "2026-05-20"
author: "dev-team"
tags: ["summarization", "korean", "cot"]

system: |
  당신은 전문 에디터입니다. 주어진 기사를 다음 절차로 요약하세요.

  1. 기사의 핵심 주제를 한 문장으로 파악한다.
  2. 주요 논거나 사실을 최대 3개 추려낸다.
  3. 위 분석을 바탕으로 정확히 3문장의 한국어 요약을 작성한다.

  규칙:
  - 반드시 3문장으로만 작성할 것
  - 원문에 없는 추측이나 의견을 추가하지 말 것
  - 수동태보다 능동태를 선호할 것

user_template: |
  다음 기사를 요약하라:

  {article}

parameters:
  temperature: 0.2
  max_tokens: 512

# 평가 메타데이터 (eval runner가 채움)
eval:
  score: null
  pass_rate: null
  last_run_id: null
```

이 YAML을 파이썬에서 로드해 사용하는 로더를 만든다.

```python
# prompt_loader.py
import yaml
from pathlib import Path
from string import Formatter

class PromptTemplate:
    def __init__(self, path: str):
        with open(path) as f:
            self.data = yaml.safe_load(f)
        self.version = self.data["version"]
        self.system = self.data["system"]
        self.user_template = self.data["user_template"]
        self.parameters = self.data.get("parameters", {})

    def render(self, **kwargs) -> dict:
        """템플릿 변수를 채워 메시지 딕셔너리 반환"""
        # 정의되지 않은 변수 검사
        required = {v for _, v, _, _ in Formatter().parse(self.user_template) if v}
        missing = required - set(kwargs.keys())
        if missing:
            raise ValueError(f"누락된 템플릿 변수: {missing}")

        return {
            "system": self.system,
            "user": self.user_template.format(**kwargs),
            "parameters": self.parameters,
        }

    def __repr__(self):
        return f"PromptTemplate(name={self.data['name']}, version={self.version})"


class PromptRegistry:
    """프롬프트 레지스트리 — 이름+버전으로 템플릿 조회"""
    def __init__(self, prompts_dir: str = "prompts"):
        self.root = Path(prompts_dir)

    def get(self, name: str, version: str = "latest") -> PromptTemplate:
        namespace_dir = self.root / name
        if version == "latest":
            # 버전 번호 기준으로 가장 최신 파일 선택
            files = sorted(namespace_dir.glob("v*.yaml"))
            if not files:
                raise FileNotFoundError(f"프롬프트 '{name}'을 찾을 수 없습니다.")
            path = files[-1]
        else:
            path = namespace_dir / f"v{version}.yaml"
        return PromptTemplate(str(path))

    def list_versions(self, name: str) -> list[str]:
        return [f.stem for f in sorted((self.root / name).glob("v*.yaml"))]


# 사용
registry = PromptRegistry("prompts")
tmpl = registry.get("summarizer")  # 최신 버전 자동 선택
messages = tmpl.render(article="LG전자가 올해 3분기 영업이익...")
print(messages["system"])
```

## A/B 테스트 프레임워크

두 버전의 프롬프트가 있을 때 어떤 쪽이 통계적으로 유의하게 더 나은지 확인하는 A/B 테스트 프레임워크다.

![프롬프트 이터레이션 워크플로우](/assets/posts/project-prompt-iterating-workflow.svg)

```python
# ab_test.py
import asyncio
import json
from dataclasses import dataclass
from scipy.stats import wilcoxon
from eval_runner import EvalRunner
from eval_dataset import EvalDataset
from judge import LLMJudge
from prompt_loader import PromptRegistry

@dataclass
class ABTestResult:
    prompt_a_version: str
    prompt_b_version: str
    a_scores: list[float]
    b_scores: list[float]
    a_avg: float
    b_avg: float
    delta: float
    p_value: float
    winner: str        # "A", "B", "tie"
    confidence: str    # "high", "medium", "low"

async def run_ab_test(
    dataset_path: str,
    prompt_name: str,
    version_a: str,
    version_b: str,
    model: str = "gpt-4o",
    judge_model: str = "gpt-4o",
    alpha: float = 0.05,
) -> ABTestResult:
    registry = PromptRegistry("prompts")
    tmpl_a = registry.get(prompt_name, version_a)
    tmpl_b = registry.get(prompt_name, version_b)
    dataset = EvalDataset(dataset_path)
    judge = LLMJudge(judge_model)
    runner = EvalRunner(model=model, concurrency=8)

    # 두 버전 동시 실행
    msgs_a = [tmpl_a.render(**{"article": c.input}) for c in dataset.cases]
    msgs_b = [tmpl_b.render(**{"article": c.input}) for c in dataset.cases]

    results_a, results_b = await asyncio.gather(
        runner.run(dataset.cases, tmpl_a.system),
        runner.run(dataset.cases, tmpl_b.system),
    )

    # 채점
    scores_a, scores_b = [], []
    for case, r_a, r_b in zip(dataset.cases, results_a, results_b):
        criteria = case.reference_criteria or "전반적인 품질을 1~5점으로 평가"
        score_a = judge.score(case.input, r_a.actual_output, criteria)["score"]
        score_b = judge.score(case.input, r_b.actual_output, criteria)["score"]
        scores_a.append(score_a)
        scores_b.append(score_b)

    # 통계 검정
    a_avg = sum(scores_a) / len(scores_a)
    b_avg = sum(scores_b) / len(scores_b)
    delta = b_avg - a_avg

    p_value = 1.0
    try:
        _, p_value = wilcoxon(scores_b, scores_a)
    except ValueError:
        pass  # 점수가 동일한 경우

    is_significant = p_value < alpha
    if not is_significant:
        winner, confidence = "tie", "low"
    elif delta > 0:
        winner = "B"
        confidence = "high" if p_value < 0.01 else "medium"
    else:
        winner = "A"
        confidence = "high" if p_value < 0.01 else "medium"

    result = ABTestResult(
        prompt_a_version=version_a,
        prompt_b_version=version_b,
        a_scores=scores_a, b_scores=scores_b,
        a_avg=round(a_avg, 4), b_avg=round(b_avg, 4),
        delta=round(delta, 4),
        p_value=round(p_value, 4),
        winner=winner, confidence=confidence,
    )
    _print_ab_report(result)
    return result

def _print_ab_report(r: ABTestResult):
    print("=" * 50)
    print(f"A/B 테스트 결과: {r.prompt_a_version} vs {r.prompt_b_version}")
    print(f"  A 평균: {r.a_avg:.4f}")
    print(f"  B 평균: {r.b_avg:.4f}")
    print(f"  Delta : {r.delta:+.4f}  (p={r.p_value:.4f})")
    print(f"  승자  : {r.winner}  (신뢰도: {r.confidence})")
    print("=" * 50)
```

## 회귀 테스트 스위트: 골든 케이스

A/B 테스트가 새 버전의 개선을 확인하는 도구라면, 회귀 테스트는 **절대로 나빠지면 안 되는 케이스**를 지키는 안전망이다. 과거에 실패해서 고친 케이스, 핵심 비즈니스 기능에 해당하는 케이스를 골든 케이스로 지정해 항상 통과해야 한다.

```python
# regression_suite.py
import json
from pathlib import Path

GOLDEN_CASES_PATH = "eval_data/golden_cases.jsonl"
REGRESSION_THRESHOLD = 0.8   # 골든 케이스 pass rate 최소 기준

def load_golden_cases(path: str = GOLDEN_CASES_PATH) -> list[dict]:
    cases = []
    with open(path) as f:
        for line in f:
            item = json.loads(line)
            if item.get("is_golden"):
                cases.append(item)
    return cases

def check_regression_suite(
    scores_by_case_id: dict[str, float],
    threshold: float = REGRESSION_THRESHOLD,
) -> dict:
    """골든 케이스 pass rate가 threshold 미만이면 회귀로 판정"""
    golden_cases = load_golden_cases()
    passed, failed = 0, []

    for case in golden_cases:
        cid = case["case_id"]
        score = scores_by_case_id.get(cid, 0.0)
        normalized = score / 5.0 if score > 1 else score   # 5점 척도 정규화
        if normalized >= 0.6:  # 5점 중 3점(0.6) 이상이면 통과
            passed += 1
        else:
            failed.append({"case_id": cid, "score": normalized})

    pass_rate = passed / len(golden_cases) if golden_cases else 1.0
    is_regression = pass_rate < threshold

    result = {
        "total_golden": len(golden_cases),
        "passed": passed,
        "failed": len(failed),
        "pass_rate": round(pass_rate, 4),
        "threshold": threshold,
        "is_regression": is_regression,
        "failed_cases": failed,
        "verdict": "FAIL — 골든 케이스 회귀" if is_regression else "PASS",
    }
    print(f"회귀 스위트: {result['verdict']} (pass_rate={pass_rate:.1%})")
    if failed:
        print(f"실패 케이스: {[c['case_id'] for c in failed]}")
    return result
```

## Git 기반 프롬프트 히스토리

프롬프트 YAML 파일을 Git으로 관리하면 자연스럽게 완전한 히스토리가 생긴다. 변경 이유는 커밋 메시지에, 변경 내용은 diff에 남는다.

```bash
# 프롬프트 개선 작업 예시
git checkout -b prompt/summarizer-v2.1

# YAML 수정 후
git add prompts/summarizer/v2.1.yaml
git commit -m "feat(prompt): summarizer v2.1 — 능동태 강조 규칙 추가

- 시스템 프롬프트에 '수동태보다 능동태를 선호할 것' 규칙 추가
- eval 결과: A/B 대비 +8% (p=0.02), 골든 케이스 100% pass
- 이슈: #234 (번역투 문체 개선 요청)"

git push origin prompt/summarizer-v2.1
# PR 생성 → 코드 리뷰 → CI eval 자동 실행 → 통과 시 merge
```

프롬프트 diff를 사람이 읽기 쉽게 출력하는 도구도 만들어두면 리뷰에 유용하다.

```python
# prompt_diff.py
import difflib
import yaml
from prompt_loader import PromptRegistry

def diff_prompts(name: str, version_a: str, version_b: str):
    registry = PromptRegistry("prompts")
    tmpl_a = registry.get(name, version_a)
    tmpl_b = registry.get(name, version_b)

    a_lines = tmpl_a.system.splitlines(keepends=True)
    b_lines = tmpl_b.system.splitlines(keepends=True)

    diff = difflib.unified_diff(
        a_lines, b_lines,
        fromfile=f"v{version_a}/system",
        tofile=f"v{version_b}/system",
    )
    print("".join(diff))

# 사용
diff_prompts("summarizer", "2.0", "2.1")
# --- v2.0/system
# +++ v2.1/system
# @@ -8,6 +8,7 @@
#    규칙:
#    - 반드시 3문장으로만 작성할 것
#    - 원문에 없는 추측이나 의견을 추가하지 말 것
# +  - 수동태보다 능동태를 선호할 것
```

## CI/CD for Prompts

프롬프트 변경 PR을 열면 자동으로 eval이 실행되고 결과가 PR 코멘트로 달리는 워크플로우를 GitHub Actions로 구성한다.

```yaml
# .github/workflows/prompt-eval.yml
name: Prompt Eval

on:
  pull_request:
    paths:
      - 'prompts/**/*.yaml'    # 프롬프트 파일 변경 시에만 실행

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python 환경 설정
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: 의존성 설치
        run: pip install -r requirements.txt

      - name: 변경된 프롬프트 파일 감지
        id: changed
        run: |
          git diff --name-only origin/main...HEAD | grep 'prompts/' > changed_prompts.txt
          cat changed_prompts.txt

      - name: Eval 실행
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          python scripts/run_eval_for_changed_prompts.py \
            --changed-files changed_prompts.txt \
            --baseline-branch main \
            --output eval_report.json

      - name: 회귀 검사
        run: |
          python scripts/regression_check.py \
            --report eval_report.json \
            --threshold 0.8

      - name: PR 코멘트 게시
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('eval_report.json'));
            const body = `## Prompt Eval 결과\n\n` +
              `| 버전 | 점수 | Pass Rate | 판정 |\n` +
              `|------|------|-----------|------|\n` +
              `| baseline | ${report.baseline_avg} | ${report.baseline_pass_rate} | — |\n` +
              `| candidate | ${report.candidate_avg} | ${report.candidate_pass_rate} | ${report.verdict} |`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

## 버전 트리와 스코어 추이

프롬프트 버전이 쌓이면 어떤 변경이 개선을 가져왔는지 트리 구조로 시각화하면 전략 수립에 도움이 된다.

![프롬프트 버전 트리](/assets/posts/project-prompt-iterating-versioning.svg)

버전 트리를 보면 몇 가지 패턴이 보인다. 주요 리팩토링(v1.0 → v2.0)은 큰 점수 상승을 가져왔고, 세부 조정(v2.0 → v2.1)이 오히려 회귀를 일으킨 사례도 있다. 실험 브랜치(v1.1-exp)는 점수가 좋았지만 아직 메인에 병합되지 않았다. 이런 정보를 코드 없이 숫자로 파악할 수 있는 것이 체계적인 버전 관리의 가치다.

```python
# version_history.py — 버전별 점수 이력 조회
from results_db import ResultsDB

def print_version_history(prompt_name: str):
    db = ResultsDB()
    rows = db.conn.execute(
        """SELECT prompt_version, avg_score, pass_rate, timestamp
           FROM eval_runs
           WHERE model LIKE ?
           ORDER BY timestamp""",
        (f"%{prompt_name}%",),
    ).fetchall()

    print(f"\n{'버전':<12} {'avg_score':<12} {'pass_rate':<12} {'날짜'}")
    print("-" * 52)
    prev_score = None
    for version, score, pass_rate, ts in rows:
        delta = ""
        if prev_score is not None and score is not None:
            diff = score - prev_score
            delta = f"  ({diff:+.3f})"
            if diff < -0.05:
                delta += " ⚠ REGRESSION"
        print(f"{version:<12} {score or 'N/A':<12} {pass_rate or 'N/A':<12} {ts[:10]}{delta}")
        if score is not None:
            prev_score = score
```

## 실전 워크플로우: Propose → Test → Compare → Merge

모든 도구가 갖춰졌다면 실제 작업 흐름은 다음과 같다.

**1. Propose**: 개선하고 싶은 내용을 YAML에 작성하고 새 버전 파일로 저장한다. 커밋 메시지에 변경 이유를 명확히 적는다.

**2. Test**: `python scripts/run_ab_test.py --a v2.0 --b v2.1 --dataset eval_data/core.jsonl` 명령으로 A/B 테스트를 실행한다. 개발 중에는 빠른 서브셋(50케이스)을 쓰고, PR 단계에서 전체 셋(500케이스)을 돌린다.

**3. Compare**: A/B 결과와 회귀 스위트 결과를 함께 본다. 점수가 올랐더라도 골든 케이스를 하나라도 실패하면 배포하지 않는다.

**4. Merge**: CI가 통과하면 PR을 병합한다. 자동으로 `prompts/` 변경이 배포 파이프라인을 트리거한다.

이 흐름을 팀이 습관화하면 프롬프트 엔지니어링이 감이 아닌 공학이 된다. 6개월 뒤 "왜 이 프롬프트가 이렇게 됐지?"라는 질문에 Git 로그와 eval 리포트가 완전한 답을 줄 수 있다.

---

**지난 글:** [평가 하네스 구축: LLM 성능을 체계적으로 측정하라](/posts/project-evaluation-harness/)

**다음 글:** [LLM 서비스 배포: API 서버부터 모니터링까지](/posts/project-deploying-llm/)

<br>
읽어주셔서 감사합니다. 😊
