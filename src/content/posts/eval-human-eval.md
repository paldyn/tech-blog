---
title: "LLM 인간 평가: 신뢰할 수 있는 정성 평가 설계하기"
description: "LLM 인간 평가의 설계 원리, 절대/비교 평가 방식, 평가자 간 일치도(IAA), 위치·길이 편향 통제, 크라우드소싱 품질 관리 방법을 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["인간평가", "LLM평가", "평가자간일치도", "IAA", "CohenKappa", "위치편향", "크라우드소싱", "평가설계"]
featured: false
draft: false
---

[지난 글](/posts/eval-llm-benchmarks/)에서 MMLU, MATH, HumanEval 같은 자동 벤치마크가 LLM의 다양한 능력을 어떻게 측정하는지 살펴보았다. 자동 벤치마크는 빠르고 재현 가능하지만 결정적인 한계가 있다. 창의성, 유용함, 안전성, 문화적 맥락 같은 주관적 품질은 컴퓨터가 자동으로 판정하기 어렵다. **인간 평가(Human Evaluation)** 는 이 간극을 메우는 방법이지만, 잘못 설계하면 노이즈 많은 데이터만 얻고 비용과 시간을 낭비하게 된다. 이번 글에서는 신뢰할 수 있는 인간 평가를 설계하는 방법을 처음부터 끝까지 다룬다.

## 언제 인간 평가가 필요한가

자동 메트릭이 측정하기 어려운 상황이 인간 평가의 영역이다.

**창의성과 문체**: "이 글이 더 창의적인가?" "문체가 자연스러운가?" 같은 질문은 BLEU 점수나 퍼플렉서티로 측정할 수 없다.

**안전성과 무해성**: "이 응답이 유해한가?"는 키워드 필터로는 부족하고, 맥락을 고려한 인간의 판단이 필요하다.

**유용함**: "이 답변이 실제로 도움이 되는가?"는 사용자 의도와 맥락에 따라 달라진다.

**새로운 능력 발견**: 자동 벤치마크에 없는 새로운 능력이나 실패 패턴을 발견하려면 인간의 열린 탐색이 필요하다.

## 평가 방식 선택: 절대 vs 비교

인간 평가는 크게 두 가지 방식으로 나뉜다.

![인간 평가 프레임워크 설계](/assets/posts/eval-human-eval-concept.svg)

**절대 평가(Likert Scale)**: 응답 하나를 보고 1~5점(또는 1~7점)으로 점수를 매긴다.

```text
응답 A:
"파이썬에서 리스트를 역순으로 만들려면 list.reverse() 메서드를 쓰거나
 슬라이싱 [::-1]을 사용합니다. 두 방법의 차이점은..."

[유용성] 1 ○ 2 ○ 3 ○ 4 ● 5 ○
[정확성] 1 ○ 2 ○ 3 ○ 4 ○ 5 ●
[간결성] 1 ○ 2 ● 3 ○ 4 ○ 5 ○
```

장점: 각 응답의 절대적 품질을 파악할 수 있고 평가 규모를 늘리기 쉽다. 단점: 평가자마다 "4점"의 기준이 다를 수 있어 평가자 간 비교가 어렵다.

**비교 평가(Pairwise)**: 같은 프롬프트에 대한 두 응답을 나란히 보고 어느 쪽이 더 좋은지 선택한다.

```text
프롬프트: "파이썬으로 피보나치 수열 생성하는 법?"

응답 A (모델 1): [코드 + 설명]
응답 B (모델 2): [코드 + 설명]

○ A가 훨씬 더 좋음
● A가 약간 더 좋음
○ 동등함
○ B가 약간 더 좋음
○ B가 훨씬 더 좋음
```

장점: 절대 기준 없이 상대적 비교만 하므로 일관성이 높다. 단점: N개 모델 비교 시 O(N²) 쌍이 필요하다. Chatbot Arena의 ELO 시스템이 이 방식을 사용한다.

## 평가 차원 정의

"좋은 응답"이 무엇인지 구체적으로 정의해야 평가자들이 같은 기준으로 판단한다.

```python
# 평가 차원 예시 (LLM 응답 품질)
EVALUATION_DIMENSIONS = {
    "helpfulness": {
        "description": "응답이 사용자의 의도와 질문에 얼마나 잘 답하는가",
        "rubric": {
            1: "전혀 관련 없거나 도움이 안 됨",
            2: "부분적으로 관련 있으나 핵심 누락",
            3: "질문에 답하나 불완전함",
            4: "질문에 잘 답하며 대부분 완전함",
            5: "완벽하게 도움되며 추가 정보도 제공"
        }
    },
    "accuracy": {
        "description": "응답의 사실적 정확성",
        "rubric": {
            1: "심각한 사실 오류 다수",
            2: "일부 오류 있음",
            3: "대체로 정확, 사소한 오류",
            4: "거의 정확",
            5: "완전히 정확"
        }
    },
    "harmlessness": {
        "description": "응답이 해롭거나 부적절한 내용을 포함하지 않는가",
        "rubric": {
            1: "명백히 해롭거나 위험",
            3: "약간 우려스럽거나 애매",
            5: "완전히 안전하고 적절"
        }
    }
}
```

루브릭(rubric)을 숫자마다 구체적으로 정의하면 평가자 간 기준 불일치를 크게 줄일 수 있다.

## 평가자 간 일치도 측정

여러 평가자의 판단이 얼마나 일치하는지를 **IAA(Inter-Annotator Agreement)** 로 측정한다.

![평가자 간 일치도 계산 (Python)](/assets/posts/eval-human-eval-code.svg)

```python
from sklearn.metrics import cohen_kappa_score
import krippendorff
import numpy as np

# 평가자 3명, 50개 샘플, 1-5점 평가
rater_a = [4, 2, 5, 3, 4, 2, 3, 5, 1, 4]  # 10개 예시
rater_b = [4, 3, 5, 3, 3, 2, 3, 4, 2, 4]
rater_c = [5, 2, 4, 4, 4, 1, 3, 5, 1, 3]

# Cohen's Kappa: 2명 평가자 간 우연 보정 일치도
kappa_ab = cohen_kappa_score(rater_a, rater_b)
kappa_ac = cohen_kappa_score(rater_a, rater_c)
kappa_bc = cohen_kappa_score(rater_b, rater_c)

print(f"κ(A,B)={kappa_ab:.3f}, κ(A,C)={kappa_ac:.3f}, κ(B,C)={kappa_bc:.3f}")
print(f"평균 κ={np.mean([kappa_ab, kappa_ac, kappa_bc]):.3f}")

# 해석:
# κ < 0.2: 거의 일치 없음 (평가 기준 재설계 필요)
# 0.2-0.4: 공정한 일치
# 0.4-0.6: 보통 일치
# 0.6-0.8: 양호한 일치 (허용 가능)
# 0.8-1.0: 우수한 일치 (목표 수준)

# Krippendorff α: 3명 이상, 순서형 척도에 적합
ratings_matrix = np.array([rater_a, rater_b, rater_c])
alpha = krippendorff.alpha(ratings_matrix, level_of_measurement="ordinal")
print(f"Krippendorff α={alpha:.3f}")

# 낮은 IAA 원인 진단
def diagnose_low_iaa(rater_a, rater_b, threshold=2):
    """평가자 간 불일치 사례 찾기"""
    disagreements = []
    for i, (a, b) in enumerate(zip(rater_a, rater_b)):
        if abs(a - b) >= threshold:
            disagreements.append({
                "sample_idx": i,
                "rater_a_score": a,
                "rater_b_score": b,
                "diff": abs(a - b)
            })
    return disagreements

high_disagreements = diagnose_low_iaa(rater_a, rater_b, threshold=2)
print(f"큰 불일치(≥2점) 사례 수: {len(high_disagreements)}")
# → 이 사례들을 분석해 가이드라인 개선
```

## 편향 통제

인간 평가에는 다양한 인지 편향이 개입한다.

**위치 편향(Position Bias)**: 비교 평가에서 A/B 중 어느 위치에 있느냐에 따라 선택이 달라진다. 해결책: 응답 순서를 50%는 A/B, 50%는 B/A로 랜덤화한다.

```python
import random

def create_balanced_pairs(model_a_responses, model_b_responses, prompts):
    """위치 편향 제거를 위한 균형 쌍 생성"""
    evaluation_items = []
    for prompt, resp_a, resp_b in zip(prompts, model_a_responses, model_b_responses):
        if random.random() < 0.5:
            # 정방향
            item = {"prompt": prompt, "left": resp_a, "right": resp_b,
                    "left_model": "A", "right_model": "B"}
        else:
            # 역방향: A/B 위치 교체
            item = {"prompt": prompt, "left": resp_b, "right": resp_a,
                    "left_model": "B", "right_model": "A"}
        evaluation_items.append(item)
    return evaluation_items
```

**길이 편향(Verbosity Bias)**: 평가자들이 긴 응답을 더 좋게 평가하는 경향이 있다. 해결책: 응답 길이를 평가 기준에 명시하거나, 동일 길이로 트런케이션한다.

**자기 선호 편향(Self-Preference)**: LLM을 심판으로 사용할 때(LLM-as-Judge), 자신의 스타일과 유사한 응답을 선호한다. 해결책: 서로 다른 모델 계열에서 여러 심판을 사용하고 과반수 투표한다.

## 크라우드소싱 품질 관리

MTurk, Scale AI, Surge AI 같은 크라우드소싱 플랫폼을 사용할 때 품질 관리가 핵심이다.

```python
# 품질 관리: Honeypot 문항 삽입
def check_annotator_quality(annotations, honeypots):
    """
    honeypots: 명백한 정답이 있는 확인용 문항
    annotator_id → 정답률로 신뢰도 평가
    """
    quality_scores = {}
    for annotator_id, answers in annotations.items():
        correct = 0
        total_honeypots = 0
        for q_id, answer in answers.items():
            if q_id in honeypots:
                total_honeypots += 1
                if answer == honeypots[q_id]["expected"]:
                    correct += 1
        if total_honeypots > 0:
            quality_scores[annotator_id] = correct / total_honeypots

    # 정확도 70% 미만 평가자 제외
    trusted = {k: v for k, v in quality_scores.items() if v >= 0.7}
    rejected = set(quality_scores.keys()) - set(trusted.keys())
    print(f"신뢰 평가자: {len(trusted)}, 제외: {len(rejected)}")
    return trusted

# 최소 3명 독립 평가 + 과반수 결정
def aggregate_annotations(annotations_by_sample, min_annotators=3):
    """각 샘플에 대한 최종 레이블 집계"""
    final_labels = {}
    for sample_id, ratings in annotations_by_sample.items():
        if len(ratings) < min_annotators:
            continue  # 평가자 부족 → 추가 수집
        # 과반수 투표
        from collections import Counter
        vote = Counter(ratings)
        majority_label, count = vote.most_common(1)[0]
        confidence = count / len(ratings)
        final_labels[sample_id] = {
            "label": majority_label,
            "confidence": confidence,
            "agreement": confidence >= 0.67  # 2/3 이상 동의
        }
    return final_labels
```

## 인간 평가 규모와 통계적 유의성

몇 개나 평가해야 충분한가? 통계적 유의성을 계산한다.

```python
from scipy import stats

def required_sample_size(effect_size=0.3, alpha=0.05, power=0.8):
    """
    검정력 분석: 필요한 최소 샘플 수
    effect_size: Cohen's d (0.2=소, 0.5=중, 0.8=대)
    """
    from scipy.stats.power import tt_ind_solve_power
    n = tt_ind_solve_power(effect_size=effect_size, alpha=alpha,
                           power=power, alternative="two-sided")
    return int(np.ceil(n))

# 효과 크기 0.3 (적당히 다른 두 모델) 감지하려면
n_needed = required_sample_size(effect_size=0.3)
print(f"필요 샘플 수 (각 모델): {n_needed}")  # ~176

# 두 모델 비교 결과 검정
model_a_scores = [4, 5, 3, 4, 4, 5, 3, 4, 5, 4]  # 예시
model_b_scores = [3, 4, 3, 3, 4, 4, 2, 3, 4, 3]  # 예시

t_stat, p_value = stats.wilcoxon(model_a_scores, model_b_scores)
print(f"Wilcoxon p-value: {p_value:.4f}")
print(f"유의미한 차이: {'있음' if p_value < 0.05 else '없음'} (α=0.05)")
```

## 인간 평가 vs LLM-as-Judge

최근 GPT-4, Claude 같은 강력한 LLM을 평가자로 사용하는 **LLM-as-Judge** 방법이 인기를 얻고 있다.

| 비교 항목 | 인간 평가 | LLM-as-Judge |
|---------|---------|-------------|
| 비용 | 높음 | 낮음 |
| 속도 | 느림 | 빠름 |
| 규모 | 제한적 | 무제한 |
| 일관성 | 변동 있음 | 높음 |
| 편향 | 인간 편향 | 자기 선호 편향 |
| 신뢰도 | 높음 | 중간 |

최선의 전략은 하이브리드다. 소규모 황금 데이터셋(~200개)을 인간이 평가하고, LLM-as-Judge 결과와 상관관계를 검증한 뒤, 확인된 상관관계를 바탕으로 LLM Judge를 대규모로 활용한다.

## 마무리

인간 평가는 자동 벤치마크로 측정하기 어려운 유용함, 창의성, 안전성을 평가하는 핵심 도구다. 절대/비교 방식 선택, 명확한 루브릭 정의, IAA 검증, 편향 통제, 통계적 유의성 확보가 신뢰할 수 있는 평가의 기반이다. 다음 글에서는 LLM을 심판으로 활용하는 LLM-as-Judge 방법론을 심층 탐구한다.

---

**지난 글:** [LLM 벤치마크 완전 정리: MMLU부터 HumanEval까지](/posts/eval-llm-benchmarks/)

**다음 글:** [LLM-as-Judge: AI가 AI를 평가하는 방법](/posts/eval-llm-as-judge/)

<br>
읽어주셔서 감사합니다. 😊
