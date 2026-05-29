---
title: "평가 하네스 구축: LLM 성능을 체계적으로 측정하라"
description: "직접 만드는 LLM 평가 시스템 — 테스트셋 설계, 자동 채점(LLM-as-Judge), 사람 평가 워크플로우, 지표 집계, 회귀 감지까지 실전 평가 하네스 구축 가이드."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["LLM평가", "EvalHarness", "LLMasJudge", "벤치마크", "프로젝트", "품질관리"]
featured: false
draft: false
---

[지난 글](/posts/project-finetune-pipeline/)에서 파인튜닝 파이프라인을 처음부터 구축해봤다. 모델을 훈련했다면 이제 핵심 질문이 남는다. "이 모델이 이전보다 실제로 나아졌는가?" 대답을 감이 아닌 숫자로 내놓으려면 **평가 하네스(Eval Harness)** 가 필요하다. 체계적인 평가 시스템 없이는 프롬프트를 바꿀 때마다, 모델을 업데이트할 때마다 품질이 올랐는지 내려갔는지 알 방법이 없다. 이 글에서는 테스트셋 설계부터 자동 채점, 사람 평가 통합, 회귀 감지까지 실전에서 바로 쓸 수 있는 평가 하네스를 파이썬으로 처음부터 만들어본다.

## 왜 체계적인 평가가 필요한가

LLM 개발에서 가장 흔한 실수는 "마지막으로 테스트한 몇 가지 케이스를 직접 보니 좋아진 것 같다"는 방식으로 품질을 판단하는 것이다. 이 접근에는 세 가지 문제가 있다.

**확증 편향**: 개발자는 자신이 고친 케이스를 테스트하려는 경향이 있다. 고치지 않은 영역에서 조용히 회귀가 발생해도 모른다.

**재현 불가능**: 어떤 기준으로, 어떤 입력으로 테스트했는지 기록이 없으면 다음 버전과 비교할 수 없다.

**커버리지 부족**: 한두 명이 직접 보는 케이스 수는 매우 제한적이다. 엣지 케이스, 언어 다양성, 다양한 사용자 의도를 커버하기 어렵다.

체계적인 평가 하네스는 이 세 문제를 동시에 해결한다. 고정된 테스트셋, 자동 채점, 버전 간 비교를 통해 "이번 변경이 정말 나아졌는가"를 데이터로 증명한다.

## 테스트셋 설계

좋은 평가는 좋은 테스트셋에서 시작된다. 테스트셋 설계의 핵심 원칙은 세 가지다.

**대표성**: 실제 프로덕션 트래픽의 분포를 반영해야 한다. 사용자의 80%가 간단한 질문을 한다면 테스트셋도 그 비율을 유지해야 한다.

**다양성**: 쉬운 케이스만으로는 모델 간 차별화가 어렵다. 엣지 케이스, 모호한 입력, 적대적 프롬프트를 의도적으로 포함시킨다.

**큐레이션**: 실패 케이스에서 학습한다. 프로덕션에서 유저가 불만을 표한 사례, 이전 버전이 틀린 케이스를 황금 테스트셋에 추가한다.

```python
# eval_dataset.py
import json
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

@dataclass
class EvalCase:
    case_id: str
    input: str
    expected_output: Optional[str] = None      # 정답이 명확한 경우
    reference_criteria: Optional[str] = None   # LLM-as-Judge용 채점 기준
    tags: list[str] = field(default_factory=list)  # 카테고리 태그
    difficulty: str = "medium"                 # easy / medium / hard

class EvalDataset:
    def __init__(self, path: str):
        self.cases: list[EvalCase] = []
        self._load(path)

    def _load(self, path: str):
        with open(path) as f:
            for line in f:
                data = json.loads(line)
                self.cases.append(EvalCase(**data))

    def filter_by_tag(self, tag: str) -> list[EvalCase]:
        return [c for c in self.cases if tag in c.tags]

    def summary(self):
        from collections import Counter
        tags = Counter(t for c in self.cases for t in c.tags)
        diffs = Counter(c.difficulty for c in self.cases)
        print(f"Total: {len(self.cases)} cases")
        print(f"By difficulty: {dict(diffs)}")
        print(f"Top tags: {tags.most_common(5)}")
```

테스트 케이스는 JSONL 형식으로 저장한다. 한 줄이 하나의 케이스이므로 스트리밍 처리와 부분 로드가 쉽다.

```jsonc
// eval_cases.jsonl
{"case_id": "sum-001", "input": "다음 글을 3줄로 요약하라: ...", "expected_output": null, "reference_criteria": "핵심 내용 포함 여부, 3줄 준수, 한국어", "tags": ["summarization", "korean"], "difficulty": "medium"}
{"case_id": "cls-001", "input": "이 리뷰의 감성을 positive/negative/neutral로 분류하라: ...", "expected_output": "positive", "tags": ["classification"], "difficulty": "easy"}
{"case_id": "code-001", "input": "파이썬 퀵소트 구현", "expected_output": null, "reference_criteria": "정확한 정렬, 재귀 구조, 타입 힌트 포함", "tags": ["coding"], "difficulty": "hard"}
```

## Eval Runner: 비동기 배치 추론

테스트 케이스가 100개든 10,000개든 효율적으로 처리하려면 비동기 배치 추론이 필요하다. 동기 방식으로 API를 순차 호출하면 케이스당 1~2초가 쌓여 전체 eval에 수 시간이 걸릴 수 있다.

![평가 하네스 파이프라인 아키텍처](/assets/posts/project-evaluation-harness-architecture.svg)

```python
# eval_runner.py
import asyncio
import time
from dataclasses import dataclass
from openai import AsyncOpenAI
from eval_dataset import EvalCase

@dataclass
class InferenceResult:
    case_id: str
    actual_output: str
    latency_ms: float
    model: str
    error: str | None = None

class EvalRunner:
    def __init__(self, model: str = "gpt-4o", concurrency: int = 8):
        self.client = AsyncOpenAI()
        self.model = model
        self.semaphore = asyncio.Semaphore(concurrency)  # 동시 요청 제한

    async def _infer_one(self, case: EvalCase, system_prompt: str) -> InferenceResult:
        async with self.semaphore:
            start = time.monotonic()
            try:
                resp = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": case.input},
                    ],
                    temperature=0,  # 재현 가능성을 위해 0으로 고정
                    max_tokens=1024,
                )
                output = resp.choices[0].message.content
                latency = (time.monotonic() - start) * 1000
                return InferenceResult(
                    case_id=case.case_id,
                    actual_output=output,
                    latency_ms=round(latency, 1),
                    model=self.model,
                )
            except Exception as e:
                latency = (time.monotonic() - start) * 1000
                return InferenceResult(
                    case_id=case.case_id,
                    actual_output="",
                    latency_ms=round(latency, 1),
                    model=self.model,
                    error=str(e),
                )

    async def run(
        self, cases: list[EvalCase], system_prompt: str
    ) -> list[InferenceResult]:
        tasks = [self._infer_one(c, system_prompt) for c in cases]
        results = await asyncio.gather(*tasks)
        return list(results)

# 사용
async def main():
    dataset = EvalDataset("eval_cases.jsonl")
    runner = EvalRunner(model="gpt-4o", concurrency=8)
    results = await runner.run(dataset.cases, system_prompt="당신은 전문 AI 어시스턴트입니다.")
    print(f"완료: {len(results)}개, 오류: {sum(1 for r in results if r.error)}")

asyncio.run(main())
```

`semaphore(concurrency=8)`는 동시 API 요청 수를 8개로 제한한다. 이 값은 사용하는 API의 Rate Limit에 맞게 조정한다. GPT-4o는 Tier에 따라 다르지만 기본적으로 분당 500 RPM, 30,000 TPM을 제공한다.

## 메트릭 유형과 선택 기준

평가 메트릭은 태스크 특성과 비용에 따라 선택해야 한다.

![LLM 평가 메트릭 비교](/assets/posts/project-evaluation-harness-metrics.svg)

### 1. Exact Match — 정형 출력 태스크

분류, 정보 추출, 예/아니오 답변처럼 정답이 명확한 경우에 사용한다. 빠르고 비용이 없으며 완전히 결정론적이다.

```python
def exact_match_score(predicted: str, expected: str) -> float:
    return 1.0 if predicted.strip().lower() == expected.strip().lower() else 0.0

def keyword_inclusion_score(predicted: str, keywords: list[str]) -> float:
    """모든 키워드 포함 여부 체크"""
    hits = sum(1 for kw in keywords if kw.lower() in predicted.lower())
    return hits / len(keywords) if keywords else 0.0
```

### 2. ROUGE / BERTScore — 텍스트 유사도

요약, 번역처럼 참조 출력이 있지만 정확한 매칭이 아닌 경우에 사용한다. ROUGE는 어휘 겹침(n-gram overlap)을, BERTScore는 의미적 유사도(코사인 유사도)를 측정한다.

```python
from rouge_score import rouge_scorer
from bert_score import score as bert_score

def rouge_l_score(hypothesis: str, reference: str) -> float:
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)
    result = scorer.score(reference, hypothesis)
    return result["rougeL"].fmeasure

def bert_score_f1(hypotheses: list[str], references: list[str]) -> list[float]:
    """BERTScore F1 — 배치 처리 권장"""
    P, R, F = bert_score(
        hypotheses, references,
        lang="ko",  # 한국어 모델 사용
        model_type="klue/roberta-large",
    )
    return F.tolist()
```

### 3. LLM-as-Judge — 복잡한 기준 자동화

창의성, 논리성, 지시 따르기처럼 규칙으로 정의하기 어려운 기준을 GPT-4나 Claude 같은 강력한 모델이 채점한다. 비용이 발생하지만 사람 평가에 가장 가까운 결과를 자동으로 얻을 수 있다.

```python
# judge.py
import json
from openai import OpenAI

JUDGE_SYSTEM_PROMPT = """당신은 AI 출력 품질을 평가하는 전문 채점관입니다.
주어진 기준에 따라 1~5점으로 채점하고, 반드시 JSON으로만 응답하세요.
형식: {"score": <1-5>, "reasoning": "<간단한 이유>"}"""

JUDGE_TEMPLATE = """[태스크 설명]
{criteria}

[모델 입력]
{input}

[모델 출력]
{output}

위 출력을 1~5점으로 평가하세요. 5점: 완벽, 4점: 양호, 3점: 보통, 2점: 미흡, 1점: 부적절."""

class LLMJudge:
    def __init__(self, judge_model: str = "gpt-4o"):
        self.client = OpenAI()
        self.judge_model = judge_model

    def score(self, input_text: str, output: str, criteria: str) -> dict:
        prompt = JUDGE_TEMPLATE.format(
            criteria=criteria,
            input=input_text,
            output=output,
        )
        resp = self.client.chat.completions.create(
            model=self.judge_model,
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)

# 사용
judge = LLMJudge(judge_model="gpt-4o")
result = judge.score(
    input_text="한국 경제의 현황을 분석하라",
    output="...<모델 출력>...",
    criteria="사실 정확성, 논리적 구조, 객관성을 5점 척도로 평가",
)
print(result)  # {"score": 4, "reasoning": "논리 구조는 명확하나 최신 데이터 미반영"}
```

LLM-as-Judge를 사용할 때 중요한 점은 **채점 기준을 구체적으로 작성**하는 것이다. "좋은지 평가하라"보다 "사실 정확성, 200자 이내 준수, 한국어 문체 일관성"처럼 측정 가능한 기준을 나열해야 채점 일관성이 높아진다.

## 사람 평가 워크플로우 통합

LLM-as-Judge는 편리하지만 모든 경우에 신뢰할 수 없다. 특히 새로운 도메인에서는 Judge 모델도 틀릴 수 있다. 사람 평가와 LLM 평가의 상관관계를 주기적으로 검증해야 한다.

```python
# human_eval.py — 어노테이션 작업 생성기
import json
import random
from pathlib import Path

def create_annotation_batch(
    inference_results: list[dict],
    sample_size: int = 50,
    output_path: str = "annotation_batch.jsonl"
):
    """
    자동 채점 결과 중 샘플을 추출해 사람이 검토할 배치 생성.
    LLM Judge 점수와 최종 사람 점수를 비교해 Judge 신뢰도 측정.
    """
    sampled = random.sample(inference_results, min(sample_size, len(inference_results)))

    with open(output_path, "w") as f:
        for item in sampled:
            annotation_item = {
                "case_id": item["case_id"],
                "input": item["input"],
                "actual_output": item["actual_output"],
                "llm_judge_score": item.get("judge_score"),
                "human_score": None,   # 어노테이터가 채울 필드
                "human_notes": None,
            }
            f.write(json.dumps(annotation_item, ensure_ascii=False) + "\n")

    print(f"{len(sampled)}개 어노테이션 배치 생성 → {output_path}")

def compute_judge_correlation(annotation_path: str) -> float:
    """사람 평가와 LLM Judge 점수의 상관계수 계산"""
    from scipy.stats import pearsonr
    human_scores, llm_scores = [], []

    with open(annotation_path) as f:
        for line in f:
            item = json.loads(line)
            if item["human_score"] is not None and item["llm_judge_score"] is not None:
                human_scores.append(item["human_score"])
                llm_scores.append(item["llm_judge_score"])

    if len(human_scores) < 10:
        print("⚠ 상관계수 계산에는 최소 10개 이상의 사람 평가가 필요합니다.")
        return 0.0

    corr, pvalue = pearsonr(human_scores, llm_scores)
    print(f"Judge 상관계수: r={corr:.3f}, p={pvalue:.4f}")
    print(f"판단: {'신뢰 가능' if corr > 0.7 else '추가 검토 필요'}")
    return corr
```

경험상 LLM Judge와 사람 평가의 피어슨 상관계수가 0.7 이상이면 Judge를 자동화에 신뢰할 수 있다고 본다. 상관이 낮다면 채점 기준 프롬프트를 개선하거나 Judge 모델을 바꿔야 한다.

## 결과 집계와 지표 대시보드

모든 채점이 끝나면 결과를 집계해 버전 간 비교가 가능하도록 저장한다.

```python
# aggregator.py
import json
import sqlite3
from datetime import datetime
from dataclasses import dataclass

@dataclass
class EvalRun:
    run_id: str
    model: str
    prompt_version: str
    timestamp: str
    scores: dict          # 메트릭별 집계 점수
    case_results: list    # 개별 케이스 결과

class ResultsDB:
    def __init__(self, db_path: str = "eval_results.db"):
        self.conn = sqlite3.connect(db_path)
        self._init_schema()

    def _init_schema(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS eval_runs (
                run_id TEXT PRIMARY KEY,
                model TEXT,
                prompt_version TEXT,
                timestamp TEXT,
                avg_score REAL,
                pass_rate REAL,
                avg_latency_ms REAL,
                scores_json TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS case_results (
                run_id TEXT,
                case_id TEXT,
                score REAL,
                latency_ms REAL,
                error TEXT,
                FOREIGN KEY(run_id) REFERENCES eval_runs(run_id)
            )
        """)
        self.conn.commit()

    def save_run(self, run: EvalRun):
        scores = run.scores
        self.conn.execute(
            "INSERT INTO eval_runs VALUES (?,?,?,?,?,?,?,?)",
            (
                run.run_id, run.model, run.prompt_version, run.timestamp,
                scores.get("avg_score"), scores.get("pass_rate"),
                scores.get("avg_latency_ms"), json.dumps(scores),
            ),
        )
        for case in run.case_results:
            self.conn.execute(
                "INSERT INTO case_results VALUES (?,?,?,?,?)",
                (run.run_id, case["case_id"], case.get("score"), case.get("latency_ms"), case.get("error")),
            )
        self.conn.commit()
        print(f"Run {run.run_id} 저장 완료 (avg_score={scores.get('avg_score'):.3f})")

    def compare_versions(self, run_id_a: str, run_id_b: str):
        """두 eval run 비교"""
        rows = self.conn.execute(
            "SELECT run_id, prompt_version, avg_score, pass_rate FROM eval_runs WHERE run_id IN (?,?)",
            (run_id_a, run_id_b),
        ).fetchall()
        for row in rows:
            print(f"run={row[0]} | version={row[1]} | score={row[2]:.3f} | pass_rate={row[3]:.3f}")
```

## 회귀 감지: 자동 경보 시스템

새 버전의 모델이나 프롬프트를 배포하기 전에 이전 버전 대비 성능이 하락했는지 자동으로 감지한다. CI/CD 파이프라인에 통합하면 배포 전 자동으로 eval이 실행되고, 회귀가 감지되면 배포를 차단할 수 있다.

```python
# regression_check.py
from scipy.stats import wilcoxon

def detect_regression(
    baseline_scores: list[float],
    candidate_scores: list[float],
    threshold: float = -0.05,  # -5% 이상 하락 시 회귀
    alpha: float = 0.05,       # 통계적 유의수준
) -> dict:
    """
    Wilcoxon Signed-Rank Test로 통계적으로 유의한 성능 하락인지 검증.
    단순 평균 비교만으로는 노이즈에 취약하므로 비모수 검정을 사용한다.
    """
    baseline_avg = sum(baseline_scores) / len(baseline_scores)
    candidate_avg = sum(candidate_scores) / len(candidate_scores)
    delta = candidate_avg - baseline_avg

    # 통계 검정 (충분한 샘플이 있을 때)
    is_significant = False
    p_value = 1.0
    if len(baseline_scores) >= 20:
        try:
            stat, p_value = wilcoxon(candidate_scores, baseline_scores, alternative="less")
            is_significant = p_value < alpha
        except ValueError:
            pass  # 두 분포가 동일하면 예외 발생 (점수 변화 없음)

    is_regression = delta < threshold and is_significant
    result = {
        "baseline_avg": round(baseline_avg, 4),
        "candidate_avg": round(candidate_avg, 4),
        "delta": round(delta, 4),
        "p_value": round(p_value, 4),
        "is_significant": is_significant,
        "is_regression": is_regression,
        "verdict": "FAIL — 회귀 감지됨" if is_regression else "PASS",
    }
    print(f"회귀 검사: {result['verdict']} (delta={delta:+.4f}, p={p_value:.4f})")
    return result

# CI/CD 통합 예시
if __name__ == "__main__":
    import sys

    baseline = [0.82, 0.74, 0.91, 0.68, 0.87]  # 이전 버전 점수 목록
    candidate = [0.71, 0.62, 0.80, 0.55, 0.73]  # 신규 버전 점수 목록

    result = detect_regression(baseline, candidate)
    sys.exit(1 if result["is_regression"] else 0)  # 회귀 시 exit code 1로 CI 실패
```

## eval-driven 개발 마인드셋

평가 하네스를 만드는 것보다 중요한 것은 **eval-driven 개발 습관**이다. 코드를 바꾸기 전에 먼저 테스트 케이스를 추가하고, 변경 후에는 반드시 eval을 돌린다. 새로운 실패 케이스가 발견되면 즉시 테스트셋에 추가한다. 이 사이클을 반복하면 테스트셋 자체가 점점 정밀해지고, 모델의 실제 약점이 코드에 문서화된다.

실전 팁 몇 가지를 정리하면 다음과 같다.

**작게 시작하라**: 처음부터 완벽한 평가 시스템을 만들려 하지 말고, 20~50개의 골든 케이스와 Exact Match부터 시작한다. 필요에 따라 메트릭을 추가한다.

**케이스를 꾸준히 추가하라**: 프로덕션 오류 로그, 사용자 피드백, 버그 리포트에서 새 케이스를 정기적으로 추가한다. 테스트셋은 살아 있는 문서다.

**Judge 신뢰도를 주기적으로 검증하라**: 두 달마다 30~50개 케이스를 사람이 직접 채점해 LLM Judge와의 상관관계를 확인한다.

**eval 속도를 지켜라**: eval이 오래 걸리면 개발자가 실행을 게을리한다. 핵심 케이스 서브셋으로 구성한 "빠른 eval"(5분 이내)을 따로 만들어 커밋마다 실행하고, 전체 eval은 PR 때만 실행한다.

---

**지난 글:** [파인튜닝 파이프라인: QLoRA부터 Ollama 배포까지](/posts/project-finetune-pipeline/)

**다음 글:** [프롬프트 반복 개발: 체계적인 이터레이션 워크플로우](/posts/project-prompt-iterating/)

<br>
읽어주셔서 감사합니다. 😊
