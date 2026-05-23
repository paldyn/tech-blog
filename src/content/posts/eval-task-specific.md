---
title: "태스크별 맞춤 평가 지표 설계"
description: "코드 생성, 번역, 요약, QA 등 태스크별로 최적화된 평가 지표와 Pass@K·BLEU·ROUGE·F1 등의 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["태스크별평가", "Pass@K", "BLEU", "ROUGE", "F1", "ExactMatch", "HumanEval", "평가지표설계"]
featured: false
draft: false
---

[지난 글](/posts/eval-elo-ratings/)에서 ELO 레이팅으로 모델 간 상대 순위를 매기는 방법을 살펴보았다. 순위는 좋지만 태스크별 세밀한 능력 진단을 위해서는 태스크별 맞춤 평가 지표가 필요하다.

"GPT-4가 Claude보다 낫다"는 말은 사실 불완전하다. 코드 생성에서는 GPT-4가 앞서지만, 한국어 번역에서는 Claude가 더 자연스러울 수 있다. 전체 벤치마크 점수 하나로 LLM을 평가하는 시대는 지났다. 이 글에서는 각 태스크에 최적화된 평가 지표를 설계하는 방법을 다룬다.

![태스크별 평가 지표 매트릭스](/assets/posts/eval-task-specific-matrix.svg)

---

## 왜 태스크별 평가인가

범용 벤치마크(MMLU, HellaSwag 등)는 모델의 전반적인 능력을 측정하기에 유용하지만, 실제 프로덕션 환경에서는 특정 태스크에 특화된 평가가 필요하다. 그 이유를 세 가지로 정리할 수 있다.

**1. 태스크 성격의 근본적 차이**

코드 생성은 "문법적으로 올바른가"보다 "실행하면 테스트를 통과하는가"가 더 중요하다. 반면 번역은 의미의 보존과 자연스러운 표현이 핵심이다. 동일한 지표로 두 태스크를 평가하면 의미 없는 숫자만 나온다.

**2. 실패 모드의 차이**

요약 태스크에서 LLM이 원문에 없는 사실을 생성하는 "환각(hallucination)"은 치명적이다. 그러나 대화 태스크에서는 어느 정도의 창의적 추론이 오히려 긍정적으로 평가될 수 있다. 태스크별 실패 모드를 정의해야 올바른 지표를 선택할 수 있다.

**3. 비즈니스 목표와의 정렬**

고객 지원 챗봇을 구축한다면 응답의 정확성과 안전성이 핵심 지표다. 코드 보조 도구라면 Pass@1이 핵심이다. 평가 지표는 비즈니스 목표와 직접 연결되어야 한다.

---

## 코드 생성 평가 — Pass@K, HumanEval, MBPP

### Pass@K란?

코드 생성 평가의 표준은 **Pass@K**다. 이 지표는 "k번 시도했을 때 최소 한 번 정답(테스트 통과)이 나올 확률"을 측정한다. Chen et al. (2021)이 HumanEval 논문에서 제안한 공식은 다음과 같다:

$$\text{Pass@K} = 1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}$$

- **n**: 총 생성 횟수
- **c**: 테스트를 통과한 생성물의 수
- **k**: 허용 시도 횟수

직관적으로 말하면, Pass@1은 "한 번 생성했을 때 정답률", Pass@10은 "10번 중 1번이라도 정답이 나올 확률"이다.

![Pass@K 계산 코드](/assets/posts/eval-task-specific-code.svg)

### 왜 이항계수 공식을 쓰는가?

단순히 n번 시도 중 몇 번 통과했는지 비율을 쓰면 되지 않을까? 실제로는 n이 고정되지 않고, k=1일 때와 k=10일 때를 공정하게 비교하기 위해 이 공식이 필요하다. 분산도 낮고 편향도 없는 추정값을 제공한다.

```python
import numpy as np
from typing import Callable

def pass_at_k(n: int, c: int, k: int) -> float:
    """n: 총 시도 횟수, c: 정답 개수, k: k 값"""
    if n - c < k:
        return 1.0
    return 1.0 - float(np.prod(
        [(n - c - i) / (n - i) for i in range(k)]
    ))

# HumanEval 스타일 평가 루프
def evaluate_humaneval(model_fn: Callable, problems: list, n: int = 10, k: int = 1) -> float:
    """
    model_fn: 문제를 받아 코드를 생성하는 함수
    problems: {"prompt": str, "test": str} 리스트
    """
    all_scores = []
    for problem in problems:
        generations = [model_fn(problem["prompt"]) for _ in range(n)]
        results = [run_tests(code, problem["test"]) for code in generations]
        c = sum(results)  # 통과한 케이스 수
        score = pass_at_k(n=n, c=c, k=k)
        all_scores.append(score)
    return float(np.mean(all_scores))

def run_tests(code: str, test: str) -> bool:
    """코드를 실행하고 테스트 통과 여부를 반환"""
    try:
        exec_globals = {}
        exec(code, exec_globals)
        exec(test, exec_globals)
        return True
    except Exception:
        return False
```

### HumanEval vs MBPP

| 벤치마크 | 문제 수 | 언어 | 특징 |
|---------|--------|------|------|
| HumanEval | 164 | Python | 함수 완성, 단위 테스트 |
| MBPP | 374 | Python | 초급~중급 프로그래밍 |
| LiveCodeBench | 400+ | 다국어 | 오염 방지, 동적 업데이트 |
| SWE-bench | 300 | Python | 실제 GitHub 이슈 해결 |

실무에서는 HumanEval만으로는 부족하다. 모델이 벤치마크 데이터를 학습했을 가능성(데이터 오염)이 있기 때문이다. LiveCodeBench처럼 동적으로 업데이트되는 벤치마크를 활용하거나, 자체 테스트셋을 구축하는 것이 좋다.

---

## 번역 평가 — BLEU, chrF, COMET

### BLEU의 원리와 한계

BLEU(Bilingual Evaluation Understudy)는 n-gram 정밀도를 기반으로 한 번역 평가 지표다. 생성된 번역과 참조 번역 간의 n-gram 겹침을 측정한다.

```python
from collections import Counter
import math

def bleu_score(hypothesis: str, references: list[str], max_n: int = 4) -> float:
    """단순화된 BLEU 구현 (학습 목적)"""
    hyp_tokens = hypothesis.split()
    ref_tokens_list = [ref.split() for ref in references]
    
    # Brevity Penalty
    hyp_len = len(hyp_tokens)
    ref_len = min(len(ref) for ref in ref_tokens_list)
    bp = 1.0 if hyp_len >= ref_len else math.exp(1 - ref_len / hyp_len)
    
    precisions = []
    for n in range(1, max_n + 1):
        hyp_ngrams = Counter(
            tuple(hyp_tokens[i:i+n]) for i in range(len(hyp_tokens) - n + 1)
        )
        max_counts = Counter()
        for ref_tokens in ref_tokens_list:
            ref_ngrams = Counter(
                tuple(ref_tokens[i:i+n]) for i in range(len(ref_tokens) - n + 1)
            )
            for ngram, count in hyp_ngrams.items():
                max_counts[ngram] = max(max_counts[ngram], min(count, ref_ngrams[ngram]))
        
        clipped_count = sum(max_counts.values())
        total_count = sum(hyp_ngrams.values())
        precisions.append(clipped_count / max(total_count, 1))
    
    if min(precisions) == 0:
        return 0.0
    
    log_avg = sum(math.log(p) for p in precisions) / max_n
    return bp * math.exp(log_avg)

# 사용 예시
hyp = "인공지능은 미래의 기술이다"
refs = ["AI는 미래를 바꿀 기술이다", "인공지능이 미래 기술을 선도한다"]
score = bleu_score(hyp, refs)
print(f"BLEU: {score:.4f}")
```

BLEU의 한계는 명확하다. 완벽한 동의어 표현이나 어순 변화에 민감하게 반응한다. "빠른 갈색 여우"와 "신속한 갈색 여우"는 의미상 동일하지만 BLEU 점수는 다르게 계산된다.

### chrF와 COMET

**chrF**는 문자 n-gram을 사용해 형태론적으로 복잡한 언어(한국어, 핀란드어 등)에 더 적합하다:

```python
# sacrebleu 라이브러리 사용
import sacrebleu

def evaluate_translation(hypotheses: list[str], references: list[list[str]]):
    bleu = sacrebleu.corpus_bleu(hypotheses, references)
    chrf = sacrebleu.corpus_chrf(hypotheses, references)
    
    print(f"BLEU: {bleu.score:.2f}")
    print(f"chrF: {chrf.score:.2f}")
    return {"bleu": bleu.score, "chrf": chrf.score}
```

**COMET**은 신경망 기반 지표로, 참조 번역 없이도 평가가 가능한 QE(Quality Estimation) 모드를 지원한다. 인간 평가와의 상관관계가 BLEU보다 현저히 높다.

```python
from comet import download_model, load_from_checkpoint

# COMET 모델 로드
model_path = download_model("Unbabel/wmt22-comet-da")
model = load_from_checkpoint(model_path)

data = [
    {"src": "The cat sat on the mat.", "mt": "고양이가 매트 위에 앉았다.", "ref": "고양이가 방석 위에 앉아 있었다."}
]
scores = model.predict(data, batch_size=8, gpus=1)
print(f"COMET: {scores.system_score:.4f}")
```

---

## 요약 평가 — ROUGE-L, BERTScore, faithfulness

### ROUGE 지표

ROUGE(Recall-Oriented Understudy for Gisting Evaluation)는 요약 평가의 표준이다. 정밀도보다 재현율을 강조한다는 점에서 BLEU와 다르다.

```python
from rouge_score import rouge_scorer

def evaluate_summary(generated: str, reference: str) -> dict:
    """ROUGE-1, ROUGE-2, ROUGE-L 계산"""
    scorer = rouge_scorer.RougeScorer(
        ['rouge1', 'rouge2', 'rougeL'], 
        use_stemmer=True
    )
    scores = scorer.score(reference, generated)
    
    return {
        "rouge1_f": scores['rouge1'].fmeasure,
        "rouge2_f": scores['rouge2'].fmeasure,
        "rougeL_f": scores['rougeL'].fmeasure,
    }

# 배치 평가
def batch_evaluate_summaries(generations: list[str], references: list[str]) -> dict:
    all_scores = [evaluate_summary(gen, ref) for gen, ref in zip(generations, references)]
    return {
        key: sum(s[key] for s in all_scores) / len(all_scores)
        for key in all_scores[0]
    }
```

ROUGE-L은 최장 공통 부분 수열(LCS)을 사용해 단어 순서를 고려한다는 장점이 있다.

### Faithfulness 평가

요약에서 가장 중요한 것은 **충실도(faithfulness)**다. 원문에 없는 내용을 생성하는 환각을 감지해야 한다:

```python
def check_faithfulness_with_llm(summary: str, source: str, judge_model) -> dict:
    """LLM을 사용한 충실도 평가"""
    prompt = f"""다음 원문과 요약을 비교하여 평가하세요.

원문: {source}

요약: {summary}

평가 기준:
1. 원문에 없는 사실이 있는가? (환각)
2. 원문의 핵심 내용이 보존되었는가?
3. 수치/고유명사가 정확한가?

JSON으로 응답:
{{"faithful": true/false, "hallucinations": ["..."], "missing_key_info": ["..."]}}"""
    
    response = judge_model.generate(prompt)
    return response
```

---

## 질의응답 평가 — Exact Match, F1, 컨텍스트 충실도

### Exact Match와 Token-level F1

SQuAD 스타일의 QA에서는 두 가지 지표를 함께 사용한다:

```python
import re
from collections import Counter

def normalize_answer(s: str) -> str:
    """소문자 변환, 관사·구두점 제거"""
    s = s.lower()
    s = re.sub(r'\b(a|an|the)\b', ' ', s)
    s = re.sub(r'[^\w\s]', '', s)
    return ' '.join(s.split())

def exact_match(prediction: str, ground_truths: list[str]) -> float:
    """정규화 후 완전 일치 여부"""
    pred_normalized = normalize_answer(prediction)
    return max(
        float(pred_normalized == normalize_answer(gt))
        for gt in ground_truths
    )

def token_f1(prediction: str, ground_truth: str) -> float:
    """토큰 수준 F1 점수"""
    pred_tokens = normalize_answer(prediction).split()
    gt_tokens = normalize_answer(ground_truth).split()
    
    common = Counter(pred_tokens) & Counter(gt_tokens)
    num_same = sum(common.values())
    
    if num_same == 0:
        return 0.0
    
    precision = num_same / len(pred_tokens)
    recall = num_same / len(gt_tokens)
    return 2 * precision * recall / (precision + recall)

def squad_evaluate(predictions: list[str], ground_truths: list[list[str]]) -> dict:
    """SQuAD 스타일 평가"""
    em_scores = [exact_match(pred, gts) for pred, gts in zip(predictions, ground_truths)]
    f1_scores = [
        max(token_f1(pred, gt) for gt in gts)
        for pred, gts in zip(predictions, ground_truths)
    ]
    return {
        "exact_match": sum(em_scores) / len(em_scores) * 100,
        "f1": sum(f1_scores) / len(f1_scores) * 100,
    }

# 평가 실행
predictions = ["1969년 7월 20일", "나사", "아폴로 11호"]
ground_truths = [
    ["1969년 7월 20일", "July 20, 1969"],
    ["NASA", "나사(NASA)"],
    ["아폴로 11호 우주선"],
]
results = squad_evaluate(predictions, ground_truths)
print(f"EM: {results['exact_match']:.1f}, F1: {results['f1']:.1f}")
```

### RAG 환경에서의 컨텍스트 충실도

검색 증강 생성(RAG) 시스템에서는 두 가지 추가 지표가 중요하다:

- **Context Recall**: 검색된 컨텍스트가 정답을 포함하는가?
- **Answer Faithfulness**: 생성된 답변이 컨텍스트에 근거하는가?

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_recall

# RAGAS 프레임워크를 이용한 RAG 평가
dataset = {
    "question": questions,
    "answer": generated_answers,
    "contexts": retrieved_contexts,
    "ground_truth": reference_answers,
}
results = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_recall])
print(results)
```

---

## 지표 선택 가이드

태스크에 맞는 지표를 선택할 때 다음 프레임워크를 활용하라:

### 1단계: 출력 유형 파악

| 출력 유형 | 예시 | 권장 지표 |
|---------|------|---------|
| 실행 가능한 코드 | 함수 생성 | Pass@K |
| 정답이 명확한 텍스트 | QA, NER | Exact Match, F1 |
| 참조 번역이 있는 텍스트 | MT, 요약 | BLEU, ROUGE, chrF |
| 오픈엔디드 텍스트 | 대화, 창작 | 인간 평가, LLM-Judge |

### 2단계: 자동화 vs 인간 평가 비율 결정

자동화 지표만으로는 한계가 있다. 최소한 10~20% 샘플에 대해 인간 평가나 LLM-Judge를 병행하라.

```python
class HybridEvaluator:
    """자동 지표 + LLM-Judge 혼합 평가"""
    
    def __init__(self, auto_weight: float = 0.6, llm_weight: float = 0.4):
        self.auto_weight = auto_weight
        self.llm_weight = llm_weight
    
    def evaluate(self, predictions: list[str], references: list[str], 
                 judge_fn=None, sample_rate: float = 0.2) -> dict:
        # 자동 지표 (전체)
        rouge_scores = batch_evaluate_summaries(predictions, references)
        
        # LLM-Judge (샘플링)
        n_sample = max(1, int(len(predictions) * sample_rate))
        indices = list(range(0, len(predictions), len(predictions) // n_sample))
        
        if judge_fn:
            llm_scores = [judge_fn(predictions[i], references[i]) for i in indices]
            avg_llm = sum(llm_scores) / len(llm_scores)
        else:
            avg_llm = 0.0
        
        # 가중 합산
        combined = (
            self.auto_weight * rouge_scores["rougeL_f"] +
            self.llm_weight * avg_llm
        )
        return {**rouge_scores, "llm_judge": avg_llm, "combined": combined}
```

### 3단계: 기준선 설정

새로운 지표를 도입할 때는 반드시 기준선(baseline)을 먼저 설정하라. "Pass@1이 0.72"는 맥락 없이는 의미가 없다. GPT-4o가 0.90이라면 개선이 필요하지만, Claude Haiku가 0.65라면 우리 모델은 충분히 경쟁력 있다.

---

## 마무리

태스크별 평가 지표는 "정확한 AI"를 만들기 위한 나침반이다. 코드 생성에는 Pass@K, 번역에는 BLEU/chrF/COMET, 요약에는 ROUGE+faithfulness, QA에는 EM+F1을 사용하되, 항상 자동화 지표와 인간 판단을 병행하는 것이 최선이다.

다음 글에서는 정확성 지표로는 잡히지 않는 **편향과 독성**을 어떻게 측정하고 완화하는지 살펴본다.

---

**지난 글:** [ELO 레이팅으로 LLM 순위 매기기](/posts/eval-elo-ratings/)
**다음 글:** [LLM 편향과 독성 평가](/posts/eval-bias-and-toxicity/)

읽어주셔서 감사합니다. 😊
